// Program yükleme (Görev 15): tablo (Excel/CSV) ya da fotoğraftan okunan satırları haftalık kayıtlara çevirir.
// Saf işlevler; cihazda çalışır. Kaynak ne olursa olsun çıktı aynıdır:
// parseSchedule(satırlar, dersler) → { format: 'grid' | 'list', rows: Row[] }
// Row: { id, day: 1..7 | null, start: 'SS:dd' | '', end: 'SS:dd' | '', title, note, kind: EventKind | null,
//        issue: engelleyen sorun metni | '', hint: uyarı metni | '', suggest: önerilen ad | '' }
// - Izgara (okulun ders programı): bir satırda en az 2 gün adı olan başlık → sütunlar gün, saat sütunu satırın saati.
//   Günler satırlarda, saatler başlıkta olan (yan yatmış) tablo da okunur.
// - Liste: her satırda gün, başlangıç, bitiş, ad (ve isteğe bağlı tür, not); sıra serbest. Günü olmayan satır bir önceki
//   satırın gününü alır ("Pazartesi" tek başına bir satırsa altındakilerin günüdür: fotoğraftaki el yazısı listeler).
import { guessKind } from './quickAdd';

export const MAX_ROWS = 200;
// Fotoğraftan okunan hücrede güveni düşük kelime işareti (utils/ocr.js LOW_MARK)
const LOW = '\u0007';
const isLow = (c) => String(c ?? '').includes(LOW);
const unmark = (c) => String(c ?? '').replaceAll(LOW, '');

const lower = (s) => s.toLocaleLowerCase('tr');
// Karşılaştırma için: küçük harf, Türkçe karakterler sadeleşir, harf ve rakam dışı atılır ("Fen Bil." → "fenbil")
export const norm = (s) => lower(s ?? '').replace(/[çğıöşüâîû]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c])
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const DAY_ALIASES = [
  [1, ['pazartesi', 'pzt', 'pts', 'ptesi', 'pazt', 'pt', 'mon', 'monday']],
  [2, ['sali', 'sal', 'sl', 'tue', 'tuesday']],
  [3, ['carsamba', 'car', 'crs', 'carsm', 'cars', 'wed', 'wednesday']],
  [4, ['persembe', 'per', 'prs', 'pers', 'prsmb', 'thu', 'thursday']],
  [5, ['cuma', 'cum', 'cm', 'fri', 'friday']],
  [6, ['cumartesi', 'cmt', 'cts', 'ctesi', 'cmrts', 'sat', 'saturday']],
  [7, ['pazar', 'paz', 'pz', 'sun', 'sunday']],
];
const DAY_BY_ALIAS = new Map(DAY_ALIASES.flatMap(([d, list]) => list.map((a) => [a, d])));
const FULL_DAYS = [['pazartesi', 1], ['cumartesi', 6], ['carsamba', 3], ['persembe', 4], ['sali', 2], ['cuma', 5], ['pazar', 7]];

// Hücre ya da kelime bir gün adı mı ("Pzt", "PAZARTESİ", "Salı:", "Çarşamba günü"); değilse null
export function dayOf(text) {
  const n = norm(text);
  if (!n) return null;
  if (DAY_BY_ALIAS.has(n)) return DAY_BY_ALIAS.get(n);
  for (const [name, d] of FULL_DAYS) if (n.startsWith(name) && n.length - name.length <= 4) return d;
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// Metindeki saatler, sırayla: 08:30, 8.30, 8,30, 08h30, "8:30-9:10"; hücrenin tamamıysa 0830. Geçersizler atılır.
const TIME_RE = /(?<![\d:.,])([01]?\d|2[0-3])\s?[:.,h]\s?([0-5]\d)(?![\d])/g;
export function timesIn(text) {
  const s = String(text ?? '').trim();
  // Tek başına 3-4 hane ("830", "0830"): yalnızca hücrenin tamamıysa (yıl "2026" saat sayılmasın)
  const bare = /^([01]?\d|2[0-3])([0-5]\d)$/.exec(s);
  if (bare) return [`${pad(Number(bare[1]))}:${bare[2]}`];
  const out = [];
  for (const m of s.matchAll(TIME_RE)) out.push(`${pad(Number(m[1]))}:${m[2]}`);
  return out;
}
// Hücrenin saatler çıkarıldıktan sonra kalan metni
const withoutTimes = (text) => String(text ?? '').replace(TIME_RE, ' ').replace(/^[\s\-–—/|:.,]+|[\s\-–—/|:.,]+$/g, '')
  .replace(/\s*[-–—/]\s*$/, '').replace(/\s{2,}/g, ' ').trim();

// Atlanan hücreler: boş ders, teneffüs, öğle arası
const SKIP = new Set(['', '-', 'x', 'bos', 'yok', 'teneffus', 'oglearasi', 'ogleyemegi', 'ogle', 'ara', 'mola', 'lunch', 'break']);
const isSkip = (text) => SKIP.has(norm(text)) || /^[-–—_.\s]+$/.test(text ?? '');

// Tür sütunu: uygulamanın tür adları
const KIND_NAMES = new Map([['okul', 'School'], ['ders', 'School'], ['kurs', 'School'], ['spor', 'Training'],
  ['antrenman', 'Training'], ['muzik', 'Music'], ['konser', 'Concert'], ['bulusma', 'Meeting'], ['sinav', 'Exam'],
  ['diger', 'Event'], ['etkinlik', 'Event'], ['aktivite', 'Event']]);
const kindName = (text) => KIND_NAMES.get(norm(text)) ?? null;

// Başlık satırındaki sütun adları (liste biçimi): atlanır
const HEADER_WORDS = new Set(['gun', 'gunler', 'baslangic', 'bitis', 'saat', 'saatler', 'ad', 'adi', 'aktivite', 'ders',
  'dersler', 'baslik', 'etkinlik', 'tur', 'turu', 'not', 'notlar', 'aciklama', 'saataraligi', 'zaman', 'sira', 'no']);
const isHeaderRow = (cells) => cells.filter((c) => c).length >= 2 && cells.every((c) => !c || HEADER_WORDS.has(norm(c)));

// Okul derslerinin yaygın adları: kısaltmaları açmak için ("Mat" → Matematik). Ailenin ders listesi önceliklidir.
const COMMON_SUBJECTS = ['Matematik', 'Türkçe', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce', 'Almanca', 'Fransızca',
  'Din Kültürü ve Ahlak Bilgisi', 'Beden Eğitimi', 'Görsel Sanatlar', 'Müzik', 'Bilişim Teknolojileri', 'Hayat Bilgisi',
  'Teknoloji ve Tasarım', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Türk Dili ve Edebiyatı', 'Fizik', 'Kimya', 'Biyoloji',
  'Tarih', 'Coğrafya', 'Felsefe', 'Rehberlik', 'Serbest Etkinlikler', 'Okuma Becerileri', 'Peygamberimizin Hayatı',
  'Kuran-ı Kerim', 'Satranç', 'Drama', 'Robotik Kodlama'];

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// "Fen Bil." → Fen Bilimleri: her kelime adayın sıradaki kelimesinin başı
function abbreviates(title, name) {
  const tw = lower(title).split(/[\s.]+/).map(norm).filter(Boolean);
  const nw = lower(name).split(/[\s.]+/).map(norm).filter(Boolean);
  if (!tw.length || tw.length > nw.length) return false;
  if (tw.length === 1 && tw[0].length < 2) return false;
  return tw.every((w, i) => nw[i].startsWith(w));
}

// Adı ailenin ders listesine (yoksa yaygın ders adlarına) göre düzeltir.
// → { title, suggest } : yazım farkı (büyük-küçük harf, Türkçe karakter) ve kısaltma sessizce düzelir; 1-2 harf fark
//   (fotoğrafta yanlış okunan harf) yalnızca öneri olur.
export function matchName(title, subjects = []) {
  const n = norm(title);
  if (!n) return { title, suggest: '' };
  const names = [...subjects, ...COMMON_SUBJECTS.filter((c) => !subjects.some((s) => norm(s) === norm(c)))];
  const exact = names.find((s) => norm(s) === n);
  if (exact) return { title: exact, suggest: '' };
  const abbr = names.filter((s) => abbreviates(title, s));
  if (abbr.length === 1) return { title: abbr[0], suggest: '' };
  if (n.length >= 5) {
    const near = names.filter((s) => levenshtein(n, norm(s)) <= (n.length >= 8 ? 2 : 1));
    if (near.length === 1) return { title, suggest: near[0] };
  }
  return { title, suggest: '' };
}

let seq = 0;
const newId = () => `r${(seq += 1)}`;

// Hücre metni → ad ve not ("Matematik\nAyşe Öğretmen": ad ilk satır, kalan not)
function splitCell(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { title: lines[0] ?? '', note: lines.slice(1).join(' · ') };
}

// ---------- Izgara ----------

// Başlık satırı: en az 2 gün adı olan ilk satır (ilk 8 satırda)
function findDayHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 8); r += 1) {
    const days = new Map();
    rows[r].forEach((c, i) => { const d = dayOf(unmark(c)); if (d && ![...days.values()].includes(d)) days.set(i, d); });
    if (days.size >= 2) return { row: r, days };
  }
  return null;
}

// Saat sütunu: gün sütunu olmayan ve altında en çok saat bulunan sütun
function findTimeCol(rows, from, dayCols) {
  const width = Math.max(...rows.map((r) => r.length));
  let best = -1, bestCount = 0;
  for (let c = 0; c < width; c += 1) {
    if (dayCols.has(c)) continue;
    const count = rows.slice(from).filter((r) => timesIn(unmark(r[c])).length > 0).length;
    if (count > bestCount) { best = c; bestCount = count; }
  }
  return best;
}

function parseGrid(rows, header) {
  const out = [];
  const timeCol = findTimeCol(rows, header.row + 1, header.days);
  for (let r = header.row + 1; r < rows.length; r += 1) {
    const row = rows[r];
    const times = timeCol >= 0 ? timesIn(unmark(row[timeCol])) : [];
    for (const [col, day] of header.days) {
      const lowConfidence = isLow(row[col]);
      const cell = unmark(row[col]);
      if (isSkip(cell)) continue;
      // Hücrenin kendi saati varsa (ör. "Piyano 17:00-18:00") o kullanılır
      const own = timesIn(cell);
      const { title, note } = splitCell(withoutTimes(cell) || cell);
      if (!title || isSkip(title)) continue;
      out.push({ day, start: own[0] ?? times[0] ?? '', end: own[0] ? (own[1] ?? '') : (times[1] ?? ''), title, note, kind: null,
        lowConfidence });
    }
  }
  return out;
}

// Günler ilk sütunda, saatler başlık satırındaysa tablo çevrilir
function transpose(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  return Array.from({ length: width }, (_, c) => rows.map((r) => r[c] ?? ''));
}

// ---------- Liste ----------

function parseListRow(cells, carryDay) {
  let day = null, kind = null;
  const times = [];
  const texts = [];
  for (const raw of cells) {
    const cell = String(raw ?? '').trim();
    if (!cell) continue;
    const d = dayOf(cell);
    if (d && !day) { day = d; continue; }
    const k = kindName(cell);
    if (k && !kind) { kind = k; continue; }
    const ts = timesIn(cell);
    times.push(...ts);
    const rest = ts.length ? withoutTimes(cell) : cell;
    if (!rest) continue;
    // Hücre gün adıyla başlıyorsa ("Pazartesi 08:30 Matematik": fotoğraftan tek satır) gün ayrılır
    const words = rest.split(/\s+/);
    if (!day && words.length > 1 && dayOf(words[0])) { day = dayOf(words[0]); texts.push(words.slice(1).join(' ')); }
    else texts.push(rest);
  }
  const text = texts.filter((t) => !isSkip(t));
  if (!text.length && !times.length) return day ? { onlyDay: day } : null;
  const { title, note } = splitCell(text[0] ?? '');
  return { day: day ?? carryDay, start: times[0] ?? '', end: times[1] ?? '', title: title.replace(/^[-–—:•*\d.)\s]+(?=\p{L})/u, ''),
    note: [note, ...text.slice(1)].filter(Boolean).join(' · '), kind };
}

function parseList(rows) {
  const out = [];
  let carry = null;
  for (const marked of rows) {
    const cells = marked.map(unmark);
    if (isHeaderRow(cells)) continue;
    const r = parseListRow(cells, carry);
    if (!r) continue;
    if (marked.some((c) => isLow(c) && withoutTimes(unmark(c)))) r.lowConfidence = true; // yalnızca saat olan hücre değil
    if (r.onlyDay) { carry = r.onlyDay; continue; }
    carry = r.day ?? carry;
    out.push(r);
  }
  return out;
}

// ---------- Ortak ----------

// Aynı gün, aynı ad, art arda (arada en fazla 15 dk) gelen saatler tek kayıt olur (iki saatlik matematik)
export function mergeConsecutive(rows) {
  const sorted = [...rows].sort((a, b) => (a.day ?? 9) - (b.day ?? 9) || (toMin(a.start) ?? 9999) - (toMin(b.start) ?? 9999));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.day && last.day === r.day && norm(last.title) === norm(r.title) && (last.kind ?? '') === (r.kind ?? '')
      && last.end && r.start && r.end && !last.issue && !r.issue) {
      const gap = toMin(r.start) - toMin(last.end);
      if (gap >= 0 && gap <= 15) {
        out[out.length - 1] = { ...last, end: r.end, merged: (last.merged ?? 1) + 1 };
        continue;
      }
    }
    out.push(r);
  }
  return out;
}

// Satırın sorunları: issue (eklenmez, düzeltilmeli), hint (eklenir, kontrol edilmeli)
export function checkRow(r) {
  let issue = '';
  if (!r.day) issue = 'Gün bulunamadı';
  else if (!r.title?.trim()) issue = 'Ad yok';
  else if (!r.start) issue = 'Saat okunamadı';
  else if (r.end && toMin(r.end) <= toMin(r.start)) issue = 'Bitiş saati başlangıçtan önce';
  const hint = issue ? '' : r.suggest ? `"${r.title}" okundu · ${r.suggest} mi?` : r.lowConfidence ? 'Okunuşu belirsiz · kontrol et' : '';
  return { ...r, issue, hint };
}

// Okunan satırları son hâline getirir: ad düzeltme, tür tahmini, tekrar edenleri atma, sorun denetimi.
// subjects: ailenin ders adları. Satır sınırı MAX_ROWS.
// Tür: ızgarada (okul programı) satırda yazmıyorsa boş kalır (önizlemedeki Tür seçimi, varsayılan Okul; "Müzik" dersi
// Müzik aktivitesi olmasın). Listede: bilinen ders adı Okul, değilse anahtar kelime (yüzme → Spor), o da yoksa Diğer.
export function finalize(items, subjects = [], format = 'list') {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const raw = (it.title ?? '').slice(0, 150).trim();
    const { title, suggest } = matchName(raw, subjects);
    const known = norm(title) !== norm(raw) || [...subjects, ...COMMON_SUBJECTS].some((x) => norm(x) === norm(title));
    const kind = it.kind ?? (format === 'grid' ? null : known ? 'School' : guessKind(title) ?? 'Event');
    const row = {
      id: newId(), day: it.day ?? null, start: it.start ?? '', end: it.end && it.end !== it.start ? it.end : '',
      title, note: (it.note ?? '').slice(0, 500), kind, suggest,
      lowConfidence: !!it.lowConfidence,
    };
    const key = `${row.day}|${row.start}|${norm(row.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(checkRow(row));
  }
  return out.slice(0, MAX_ROWS);
}

// Tablo (string[][]) → { format, rows }. rows finalize'dan geçmiş, sıralı ve birleştirilmemiştir (birleştirme önizlemede açılıp kapanır).
export function parseSchedule(table, subjects = []) {
  const rows = (table ?? []).filter((r) => r.some((c) => String(c ?? '').trim()));
  if (!rows.length) return { format: 'list', rows: [], truncated: false };
  let header = findDayHeader(rows);
  let grid = rows;
  // Yan yatmış ızgara: saatler bir başlık satırında (gün adı olmayan, en az 2 saatli satır), günler ilk sütunlarda.
  // Liste satırlarında da 2 saat olabilir ama listede satırın günü vardır.
  const timeHeader = rows.slice(0, 8).some((r) => !r.some((c) => dayOf(unmark(c))) && r.filter((c) => timesIn(unmark(c)).length).length >= 2);
  if (!header && timeHeader) {
    const t = transpose(rows);
    const h = findDayHeader(t);
    if (h && h.days.size >= 2) { header = h; grid = t; }
  }
  const items = header ? parseGrid(grid, header) : parseList(rows);
  const all = finalize(items, subjects, header ? 'grid' : 'list');
  return { format: header ? 'grid' : 'list', rows: all, truncated: items.length > MAX_ROWS };
}

// Önizlemedeki satırlar → POST /api/series/bulk gövdesi. defaultKind: türü belirsiz satırlara (ızgarada Okul).
export function toSeriesItems(rows, { startDate, untilDate, defaultKind }) {
  return rows.filter((r) => !r.issue).map((r) => ({
    kind: r.kind ?? defaultKind,
    title: r.title.trim(),
    time: r.start,
    endTime: r.end || '',
    note: r.note ?? '',
    daysOfWeek: [r.day],
    startDate,
    untilDate,
  }));
}

export const minutesBetween = (a, b) => (a && b ? toMin(b) - toMin(a) : 0);
export { hm, toMin };

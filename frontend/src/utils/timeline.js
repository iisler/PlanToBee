import { formatDuration } from './format';
import { eventLabel, isTraining } from './events';

// Saat hesabı (Görev 09; Görev 17'den beri akış listesi ve Hafta sayfası kullanır):
// pencere 07:00–22:00; bitiş = endTime ?? derivedEndTime; ikisi de yoksa 60 dk ("süre belirsiz");
// bitiş < başlangıç ise gece yarısını aşar (gün sonunda kesilir); boşluklar yalnızca pencere içinde hesaplanır.
// Saf işlevler: React'e bağımlı değil (React Native'e aynen taşınabilir).

export const WS = 7 * 60;   // 07:00
export const WE = 22 * 60;  // 22:00
export const NO_END_MIN = 60;
export const GAP_LABEL_MIN = 60; // 1 saatten kısa boşluk etiketlenmez

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "09:30" → 570; SS:dd değilse (boş ya da eski serbest metin) null
export function toMin(t) {
  const m = HM.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const pad = (n) => String(n).padStart(2, '0');
// 570 → "09:30" (24 saatte sarar; 1320 → "22:00", 1440 → "00:00")
export const hm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
// Hafta metni: tam saatte "07", değilse "17:30"
export const hShort = (m) => (m % 60 === 0 ? pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) : hm(m));

// Ekran okuyucu için uzun süre: "4 saat", "1 saat 30 dakika", "30 dakika"
export function durationLong(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} dakika`;
  if (m === 0) return `${h} saat`;
  return `${h} saat ${m} dakika`;
}

// Kaydın görünen bitişi (gerçek ya da eski süreden türetilmiş); yoksa null
export const endOf = (ev) => ev.endTime || ev.derivedEndTime || null;

// ---------- Dersler çizelgede (Görev 10) ----------
// Ders (StudyEntryDto) çizelgeye aktiviteyle aynı biçimde girer: { ...ders, isStudy: true, time: startTime, endTime }.
// Dersin süresi her zaman vardır (bitiş = başlangıç + dakika; "süre belirsiz" ders olmaz).
export const studyItem = (e) => ({ ...e, isStudy: true, time: e.startTime ?? '' });
export const isStudy = (x) => !!x?.isStudy;
// Ders ve aktivite kimlikleri ayrı tablolardan gelir: çizelgede ayırt edici anahtar.
// Tekrarlanan (sanal) aktivitenin id'si 0'dır: anahtarı seri + gün ("r12-2026-10-21", Görev 11).
export const itemKey = (x) => (x.isStudy ? `s${x.id}` : !x.id && x.seriesId ? `r${x.seriesId}-${x.occurrenceDate}` : `e${x.id}`);
// Bee (Ajanda) öğeleri: önce dersler (eklenme sırası), sonra aktiviteler; "Saati yok" şeridi bu sırayı korur
export const agendaItems = (studyEntries = [], events = []) => [...studyEntries.map(studyItem), ...events];

// Tek kayıt: { ev, S, E, noEnd, night } (saatsizse null). E gece aşımında 1440'tan büyüktür.
export function span(ev) {
  const S = toMin(ev.time);
  if (S == null) return null;
  if (ev.isStudy && ev.minutes > 0) {
    // Gece yarısında ya da sonrasında biten ders ertesi güne geçer (sunucu: endTime < startTime)
    // 1440 dk'lık ders tam 24 saat sürer: bitiş saati başlangıçla aynı olduğundan "full" ile ayrı yazılır
    const E = S + ev.minutes;
    return { ev, S, E, noEnd: false, night: E >= 1440, full: E - S >= 1440, start: hm(S), end: hm(E) };
  }
  const e = toMin(endOf(ev));
  const noEnd = e == null || e === S;
  let E = noEnd ? S + NO_END_MIN : e;
  let night = false;
  if (E < S) { E += 1440; night = true; }
  return { ev, S, E, noEnd, night, start: hm(S), end: noEnd ? null : hm(e) };
}

// Günün kayıtlarını sınıflar: saatsiz / 07:00 öncesi / 22:00 sonrası / pencere içi (cs–ce kesilmiş).
// Pencere içi kayıtlar cs'ye göre sıralı (eşitse uzun olan önce).
// end: pencerenin bittiği an. Hafta ızgarası sabit yükseklikte olduğundan 22:00'de keser, sonrası "22:00 sonrası" olur;
// gün çizelgesi 1440 verir: 22:00'yi aşan ve 22:00'den sonra başlayan kayıtlar da çizelgede görünür, yalnızca
// gece yarısında kesilir.
export function classify(events, end = WE) {
  const untimed = [], before = [], after = [], inw = [];
  for (const ev of events) {
    const r = span(ev);
    if (!r) { untimed.push(ev); continue; }
    if (r.E <= WS) before.push(r);
    else if (r.S >= end) after.push(r);
    else inw.push({ ...r, cs: Math.max(r.S, WS), ce: Math.min(r.E, end), cutTop: r.S < WS, cutBot: r.E > end });
  }
  inw.sort((a, b) => a.cs - b.cs || b.ce - a.ce);
  return { untimed, before, after, inw };
}

// Pencere içi boşluklar [a, b] (kayıtların birleşiminin tümleyeni)
export function gaps(inw) {
  const out = [];
  let cur = WS;
  for (const r of inw) {
    if (r.cs > cur) out.push([cur, r.cs]);
    cur = Math.max(cur, r.ce);
  }
  if (cur < WE) out.push([cur, WE]);
  return out;
}

export const freeMinutes = (inw) => gaps(inw).reduce((s, [a, b]) => s + b - a, 0);

// Kart başlığı özeti: "9 sa 30 dk boş" / "tüm gün boş"
export function freeSummary(events) {
  const { inw } = classify(events);
  if (!inw.length) return 'tüm gün boş';
  const f = freeMinutes(inw);
  return f > 0 ? `${formatDuration(f)} boş` : 'boş saat yok';
}

// Blok saat metni. level 1: "09:00–13:00 · 4 sa", 2: "09:00–13:00", 3: "09:00"
export function timeText(r, level = 1) {
  if (r.noEnd) return level < 3 ? `${r.start} · süre belirsiz` : r.start;
  if (level === 3) return r.start + (r.night ? '↷' : '');
  if (r.full) return level === 2 ? `${r.start} · 24 sa` : `${r.start} · 24 sa ↷`;
  const rng = `${r.start}–${r.end}`;
  if (level === 2) return r.night ? `${rng} ↷` : rng;
  if (r.night) return `${rng} ↷ ertesi gün`;
  return `${rng} · ${formatDuration(r.E - r.S)}`;
}

// Kısa aralık metni (pencere dışı satırları, form, şerit): "09:00–13:00" / "15:00"
export const rangeText = (r) => (r.noEnd ? r.start : r.full ? `${r.start} · 24 sa` : `${r.start}–${r.end}`);

// Ekran okuyucu: "Kurs, 09:00–13:00, 4 saat" / "Okul konseri, 15:00, süre belirsiz" / "Sinema, 21:00–00:30, ertesi gün biter"
export function ariaEvent(r) {
  const name = eventLabel(r.ev) + (r.ev.isStudy ? ', ders' : '');
  if (r.noEnd) return `${name}, ${r.start}, süre belirsiz`;
  if (r.full) return `${name}, ${r.start}, 24 saat, ertesi gün biter`;
  const rng = `${r.start}–${r.end}`;
  if (r.night) return `${name}, ${rng}, ertesi gün biter`;
  return `${name}, ${rng}, ${durationLong(r.E - r.S)}`;
}

// ---------- Günün akışı (Görev 17) ----------
// Akış listesinde renk: ders, spor, okul (nötr; her hafta içi tekrar eden sabit zaman) ve diğer aktiviteler.
export const flowClass = (ev) => (ev.isStudy ? 'study' : isTraining(ev) ? 'sport' : ev.kind === 'School' ? 'school' : 'evt');

// Günün akışı: saatli kayıtlar başlangıca göre, aralarında 1 saat ve üstü boşluklar (07:00–22:00 penceresinde).
// nowMin (bugün): süren kayıt (tamamlanmış ders hariç) ve boşluk "now", bitmiş kayıt "past" işaretlenir; bitmiş boşluk gösterilmez.
// Dönen: { rows: [{ type: 'item', key, r, now, past } | { type: 'gap', key, a, b, now }], untimed: [kayıt] }
const evDone = (ev) => ev.isStudy && ev.status === 'done';
export function flowRows(items, withGaps = true, nowMin = null) {
  const timed = [], untimed = [];
  for (const ev of items) { const r = span(ev); if (r) timed.push(r); else untimed.push(ev); }
  const rows = timed.map((r) => ({
    type: 'item', key: itemKey(r.ev), at: r.S, r,
    now: nowMin != null && r.S <= nowMin && nowMin < r.E && !evDone(r.ev), past: nowMin != null && r.E <= nowMin,
  }));
  if (withGaps && timed.length) {
    for (const [a, b] of gaps(classify(items).inw)) {
      if (b - a < GAP_LABEL_MIN || (nowMin != null && b <= nowMin)) continue;
      rows.push({ type: 'gap', key: `g${a}`, at: a, a, b, now: nowMin != null && a <= nowMin && nowMin < b });
    }
  }
  rows.sort((x, y) => x.at - y.at || (x.type === 'gap' ? 1 : -1) - (y.type === 'gap' ? 1 : -1));
  return { rows, untimed };
}

// Ders eklerken önerilen başlangıçlar: o günün en az "mins" dakikalık boşluklarının başı (bugünse şu andan sonrası,
// 5 dakikaya yuvarlanır). Saatli kayıt yoksa öneri yok. En çok 3 saat ("17:45").
export function freeSlots(items, mins, nowMin = null) {
  const { inw } = classify(items);
  if (!inw.length) return [];
  const from = nowMin == null ? WS : Math.ceil(nowMin / 5) * 5;
  return gaps(inw).map(([a, b]) => [Math.max(a, from), b]).filter(([a, b]) => b - a >= (mins || 30)).slice(0, 3).map(([a]) => hm(a));
}

// ---------- Hafta ızgarası ----------
// Bir günün pencere içi kayıtları ve boşlukları (Hafta sayfası: şerit ve en uzun boşluk)
export function weekColumn(events) {
  const { inw } = classify(events);
  return { inw, gaps: gaps(inw) };
}

// En uzun boşluğu en büyük 3 gün: [{ label: "Cum", a, b }]; hiç pencere içi kayıt yoksa null
export function longestGaps(cols, shortNames) {
  if (!cols.some((c) => c.inw.length)) return null;
  const list = [];
  cols.forEach((c, i) => {
    if (!c.gaps.length) return;
    const g = c.gaps.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
    list.push({ d: g[1] - g[0], i, a: g[0], b: g[1] });
  });
  list.sort((x, y) => y.d - x.d || x.i - y.i);
  return list.slice(0, 3).map((x) => `${shortNames[x.i]} ${hShort(x.a)}–${hShort(x.b)}`);
}

// ---------- Form yardımcıları ----------
// Formdaki aralıkla çakışan diğer kayıtlar (saatsizler ve excludeKey hariç), başlangıca göre sıralı.
// events: aktiviteler ve (studyItem ile) dersler; excludeKey: düzenlenen kaydın itemKey'i.
// range: { time, endTime } ya da ders için { time, minutes, isStudy: true }
export function overlapping(events, range, excludeKey) {
  const r = span(range);
  if (!r) return [];
  return events
    .filter((ev) => itemKey(ev) !== excludeKey)
    .map(span)
    .filter((o) => o && o.S < r.E && r.S < o.E)
    .sort((a, b) => a.S - b.S);
}

// Çakışma uyarısı: "20:00 Antrenman ile çakışıyor." / "20:00 Antrenman ve 1 kayıt daha ile çakışıyor." (dersler dahil)
export function overlapText(list) {
  if (!list.length) return '';
  const first = `${list[0].start} ${eventLabel(list[0].ev)}`;
  return list.length === 1 ? `${first} ile çakışıyor.` : `${first} ve ${list.length - 1} kayıt daha ile çakışıyor.`;
}

// Ders formu uyarısı: "Kurs (09:00–13:00) ile çakışıyor." / "Kurs (09:00–13:00) ve 1 kayıt daha ile çakışıyor."
export function clashText(list) {
  if (!list.length) return '';
  const first = `${eventLabel(list[0].ev)} (${rangeText(list[0])})`;
  return list.length === 1 ? `${first} ile çakışıyor.` : `${first} ve ${list.length - 1} kayıt daha ile çakışıyor.`;
}

// başlangıç + süre (24 saatte sarar)
export const addMinutes = (t, mins) => { const s = toMin(t); return s == null ? '' : hm(s + mins); };


// Sesle ya da yazıyla hızlı aktivite ekleme (Görev 13). "1 Kasım saat 13:00 ila 15:00 arasına voleybol maçı gir" gibi bir
// cümleden tarih, başlangıç–bitiş, tür ve ad çıkarılır. Kurallarla cihazda çalışır; metin sunucuya ya da yapay zekâya gitmez.
// Saf işlevler (React Native'e aynen taşınabilir).
// parseQuickAdd(metin, bugün) → { date, time, endTime, kind, title }
// - date: "yyyy-AA-gg"; söylenmediyse null (seçili gün kullanılır). Yıl söylenmezse geçmiş tarih gelecek yıla gider.
// - time / endTime: "SS:dd" ya da "". Gündüz saati varsayılır: "3'te" 15:00, "sabah 9" 09:00, "akşam 7" 19:00.
//   Bitiş başlangıçtan sonraki en yakın saattir ("10'dan 2'ye" 10:00–14:00); süre de söylenebilir ("2 saat").
// - kind: sunucudaki EventKind (anahtar kelimeden; bulunamazsa 'Event' = Diğer). title: kalan kelimeler ya da "".

const lower = (s) => s.toLocaleLowerCase('tr');
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const plusDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isoDay = (d) => ((d.getDay() + 6) % 7) + 1;

// Sayı ve isimlere gelen ekler (ünlü uyumu ve kaynaştırmayla): 13'te, 15'e, 1 Kasım'da, salıya, kasımın 1'inde
const SFX = new Set(['', 'de', 'da', 'te', 'ta', 'den', 'dan', 'ten', 'tan', 'e', 'a', 'ye', 'ya', 'i', 'ı', 'u', 'ü',
  'yi', 'yı', 'yu', 'yü', 'in', 'ın', 'un', 'ün', 'nin', 'nın', 'nun', 'nün', 'inde', 'ında', 'unda', 'ünde', 'ki']);
const AT_FROM = new Set(['de', 'da', 'te', 'ta', 'den', 'dan', 'ten', 'tan']); // "13'te", "13'ten": saat
const TO = new Set(['e', 'a', 'ye', 'ya']); // "15'e": bitiş saati
const withSfx = (w, stem) => w.startsWith(stem) && SFX.has(w.slice(stem.length));

const NUM_WORDS = [['dokuz', 9], ['sekiz', 8], ['yirmi', 20], ['otuz', 30], ['yedi', 7], ['altı', 6], ['dört', 4], ['dörd', 4],
  ['beş', 5], ['iki', 2], ['bir', 1], ['üç', 3], ['on', 10]];
const MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const WEEKDAYS = [['pazartesi', 1], ['cumartesi', 6], ['çarşamba', 3], ['perşembe', 4], ['salı', 2], ['cuma', 5], ['pazar', 7]];
const NEXT_WEEK = new Set(['haftaya', 'gelecek', 'önümüzdeki', 'sonraki']);
const WEEK = new Set(['hafta', 'haftaki', 'haftanın']);
const DAY_TAIL = new Set(['gün', 'günü', 'gününe', 'gününde', 'tarihine', 'tarihinde', 'tarihli', 'tarihte']);
const DAYPARTS = { sabah: 'am', sabahleyin: 'am', öğle: 'noon', öğlen: 'noon', öğleyin: 'noon', ikindi: 'pm', akşam: 'pm',
  akşamleyin: 'pm', akşamüstü: 'pm', akşamüzeri: 'pm', gece: 'night' };
const RANGE = new Set(['ila', 'ilâ', 'ile', '-']);
const TIME_TAIL = new Set(['arası', 'arasına', 'arasında', 'aralığı', 'aralığına', 'aralığında', 'kadar', 'itibaren', 'sonra',
  'gibi', 'civarı', 'civarında', 'sularında']);
const HOUR_UNIT = new Set(['saat', 'sa', 'saatlik', 'saatlık']);
const MIN_UNIT = new Set(['dakika', 'dk', 'dak', 'dakikalık']);
const isHalf = (w) => /^buçu[kğ]/.test(w ?? '');

// Başlıktan atılanlar: her yerde (ekle, lütfen, takvime…), uçlarda (bağlaçlar) ve sonda (komut: gir, koy, yaz, kaydet…)
const DROP = new Set(['ekle', 'lütfen', 'saat', 'takvime', 'ajandaya', 'plana', 'programa']);
const EDGE = new Set(['için', 'de', 'da', 've', 'ile', 'ila', 'olarak']);
const COMMAND = new Set(['gir', 'koy', 'yaz', 'kaydet', 'oluştur', 'planla', 'ayarla', 'ekler', 'girer', 'koyar', 'yazar',
  'kaydeder', 'ekleyin', 'girin', 'koyun', 'yazın', 'kaydedin', 'ekleyebilir', 'girebilir', 'eklesene', 'girsene',
  'misin', 'mısın', 'musun', 'müsün', 'mi', 'mı']);

// Tür anahtar kelimeleri, öncelik sırasıyla ("piyano sınavı" Sınav, "okul konseri" Konser). 4 harften kısa kökler
// yalnızca ekle eşleşir ("maçı" evet, "şans" hayır).
const KIND_WORDS = [
  ['Exam', ['sınav', 'deneme', 'yazılı', 'sözlü', 'quiz', 'lgs', 'yks', 'tyt', 'ayt']],
  ['Concert', ['konser', 'resital', 'dinleti', 'gösteri', 'müsamere']],
  ['Training', ['maç', 'antrenman', 'idman', 'spor', 'voleybol', 'basketbol', 'futbol', 'hentbol', 'tenis', 'badminton',
    'yüzme', 'koşu', 'atletizm', 'jimnastik', 'bale', 'dans', 'karate', 'judo', 'tekvando', 'taekwondo', 'boks', 'güreş',
    'eskrim', 'okçuluk', 'binicilik', 'pilates', 'yoga', 'fitness', 'turnuva']],
  ['Music', ['müzik', 'piyano', 'gitar', 'keman', 'viyola', 'çello', 'viyolonsel', 'flüt', 'klarnet', 'saksafon', 'bateri',
    'davul', 'bağlama', 'ukulele', 'solfej', 'koro', 'şan', 'org', 'saz']],
  ['School', ['okul', 'kurs', 'etüt', 'etüd', 'ders', 'veli']],
  ['Meeting', ['buluş', 'sinema', 'parti', 'doğum', 'arkadaş', 'kahve', 'ziyaret', 'misafir', 'davet', 'toplantı', 'piknik']],
];
const SHORT_SFX = new Set([...SFX, 'ına', 'ine', 'una', 'üne', 'ında', 'inde', 'unda', 'ünde']);
const kindWord = (w, stem) => (stem.length < 4 ? w.startsWith(stem) && SHORT_SFX.has(w.slice(stem.length)) : w.startsWith(stem));

function tokenize(text) {
  const spaced = text.replace(/[’‘`´]/g, "'").replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 - $2');
  return spaced.split(/\s+/).map((raw) => {
    const t = /^[-–—]$/.test(raw) ? '-' : raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return { raw: t, w: lower(t).replace(/'/g, '') };
  }).filter((t) => t.w);
}

function wordNum(w) {
  for (const [stem, n] of NUM_WORDS) if (withSfx(w, stem)) return { n, sfx: w.slice(stem.length) };
  return null;
}

// i'deki sayı: "13", "13:00", "13.30", "13'te", "on üçte" (iki kelime) → { n, m (dakika ya da null), sfx, zero, span }
function numAt(toks, i) {
  const w = toks[i]?.w;
  if (!w) return null;
  const d = /^(\d{1,3})(?:[:.](\d{2}))?([a-zçğıöşü]*)$/.exec(w);
  if (d) {
    if (!SFX.has(d[3])) return null;
    return { n: Number(d[1]), m: d[2] == null ? null : Number(d[2]), sfx: d[3], zero: /^0\d/.test(d[1]), span: 1 };
  }
  const a = wordNum(w);
  if (!a) return null;
  if (a.n >= 10 && !a.sfx) { // on üç, yirmi bir, otuz bir
    const b = toks[i + 1] && wordNum(toks[i + 1].w);
    if (b && b.n < 10) return { n: a.n + b.n, m: null, sfx: b.sfx, zero: false, span: 2 };
  }
  return { n: a.n, m: null, sfx: a.sfx, zero: false, span: 1 };
}

// Yıl verilmezse bugünden önceki tarih gelecek yıla kayar. Geçersiz gün (31 Kasım) null.
function makeDate(today, y, mo, d) {
  let year = y ?? today.getFullYear();
  if (y == null && keyOf(new Date(year, mo, d)) < keyOf(today)) year++;
  const t = new Date(year, mo, d);
  return t.getMonth() === mo && t.getDate() === d ? keyOf(t) : null;
}

// İlk tarih ifadesi: bugün, yarın, öbür gün, haftaya; 1 Kasım (2026); kasımın 1'i; (haftaya / bu) salı; 1/11; ayın 5'i
function findDate(toks, used, today) {
  const take = (from, to, key) => {
    let end = to;
    while (DAY_TAIL.has(toks[end]?.w)) end++;
    for (let k = from; k < end; k++) used[k] = true;
    return key;
  };
  const monday = plusDays(today, 1 - isoDay(today));
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    const next = toks[i + 1]?.w;
    if (withSfx(w, 'bugün')) return take(i, i + 1, keyOf(today));
    if (w === 'yarından' && next === 'sonra') return take(i, i + 2, keyOf(plusDays(today, 2)));
    if (withSfx(w, 'yarın')) return take(i, i + 1, keyOf(plusDays(today, 1)));
    if (withSfx(w, 'öbürgün')) return take(i, i + 1, keyOf(plusDays(today, 2)));
    if (w === 'öbür' && next && withSfx(next, 'gün')) return take(i, i + 2, keyOf(plusDays(today, 2)));

    const wd = WEEKDAYS.find(([stem]) => withSfx(w, stem));
    if (wd) {
      let from = i - (WEEK.has(toks[i - 1]?.w) ? 1 : 0);
      const mod = toks[from - 1]?.w;
      let key;
      if (NEXT_WEEK.has(mod)) { from--; key = keyOf(plusDays(monday, 7 + wd[1] - 1)); }
      else if (mod === 'bu') { from--; key = keyOf(plusDays(monday, wd[1] - 1)); }
      else { from = i; key = keyOf(plusDays(today, (wd[1] - isoDay(today) + 7) % 7)); }
      return take(from, i + 1, key);
    }
    if (w === 'haftaya' && !(next && WEEKDAYS.some(([stem]) => withSfx(next, stem)))) return take(i, i + 1, keyOf(plusDays(today, 7)));

    const x = numAt(toks, i);
    if (x && x.m == null && x.n >= 1 && x.n <= 31 && !x.sfx) {
      const j = i + x.span;
      const mo = toks[j] ? MONTHS.findIndex((m) => withSfx(toks[j].w, m)) : -1;
      if (mo >= 0) {
        const y = /^(20\d\d)([a-zçğıöşü]*)$/.exec(toks[j + 1]?.w ?? '');
        return take(i, j + 1 + (y ? 1 : 0), makeDate(today, y ? Number(y[1]) : null, mo, x.n));
      }
    }
    const mo = MONTHS.findIndex((m) => w === `${m}ın` || w === `${m}in` || w === `${m}un` || w === `${m}ün`);
    if (mo >= 0 || w === 'ayın') {
      const y = numAt(toks, i + 1);
      if (y && y.m == null && y.n >= 1 && y.n <= 31) {
        let key;
        if (mo >= 0) key = makeDate(today, null, mo, y.n);
        else { // "ayın 5'i": bu ay, geçtiyse gelecek ay
          key = makeDate(today, today.getFullYear(), today.getMonth(), y.n);
          const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          if (!key || key < keyOf(today)) key = makeDate(today, nm.getFullYear(), nm.getMonth(), y.n);
        }
        return take(i, i + 1 + y.span, key);
      }
    }
    const nd = /^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})$/.exec(w) ?? /^(\d{1,2})\/(\d{1,2})()$/.exec(w);
    if (nd) {
      const y = nd[3] ? Number(nd[3].length === 2 ? `20${nd[3]}` : nd[3]) : null;
      return take(i, i + 1, makeDate(today, y, Number(nd[2]) - 1, Number(nd[1])));
    }
  }
  return null;
}

// Süre: "2 saat", "90 dakika", "bir buçuk saat", "1,5 saat", "yarım saat", "1 saat 30 dakika" (dakika cinsinden, yoksa 0)
function findDuration(toks, used) {
  let total = 0;
  for (let i = 0; i < toks.length; i++) {
    if (used[i]) continue;
    let val = null, j = i + 1;
    const dec = /^(\d+)[.,](\d)$/.exec(toks[i].w);
    if (toks[i].w === 'yarım') val = 0.5;
    else if (dec) val = Number(`${dec[1]}.${dec[2]}`);
    else {
      const x = numAt(toks, i);
      if (x && x.m == null && !x.sfx) {
        val = x.n;
        j = i + x.span;
        if (isHalf(toks[j]?.w)) { val += 0.5; j++; }
      }
    }
    if (val == null || used[j]) continue;
    const unit = toks[j]?.w;
    if (HOUR_UNIT.has(unit)) total += Math.round(val * 60);
    else if (MIN_UNIT.has(unit)) total += Math.round(val);
    else continue;
    for (let k = i; k <= j; k++) used[k] = true;
    i = j;
  }
  return total;
}

// Saat: önce gündüz varsayımı; sabah / öğlen / akşam / gece söylendiyse ona göre
function clock(h, m, part, zero) {
  let hh = h === 24 ? 0 : h;
  if (part === 'pm' && hh < 12) hh += 12;
  else if (part === 'noon' && hh <= 5) hh += 12;
  else if (part === 'night') { if (hh >= 6 && hh < 12) hh += 12; else if (hh === 12) hh = 0; }
  else if (!part && !zero && hh >= 1 && hh <= 6) hh += 12;
  return hh * 60 + m;
}
// Bitiş: kendi gün parçası yoksa başlangıçtan sonraki en yakın saat (2 → 02:00 ya da 14:00)
function endClock(t, start) {
  if (t.part || t.zero || t.h >= 12) return clock(t.h, t.m, t.part, t.zero);
  const after = (x) => (x - start + 1440) % 1440 || 1440;
  const a = t.h * 60 + t.m;
  return after(a) <= after(a + 720) ? a : a + 720;
}

// En çok iki saat (başlangıç, bitiş). Saat sayılan sayılar: dakikalı (13:00), "saat"ten sonra, -de/-den ekli (13'te),
// buçuklu, aralıklı (13 ila 15), bitişte -e ekli (15'e), gün parçasından sonra (akşam 7).
function findTimes(toks, used) {
  const parts = [];
  for (let i = 0; i < toks.length; i++) {
    if (used[i]) continue;
    if (toks[i].w === 'öğleden' && (toks[i + 1]?.w === 'sonra' || toks[i + 1]?.w === 'önce')) {
      parts.push({ from: i, to: i + 1, p: toks[i + 1].w === 'sonra' ? 'pm' : 'am' });
      i++;
    } else if (DAYPARTS[toks[i].w]) parts.push({ from: i, to: i, p: DAYPARTS[toks[i].w] });
  }
  const times = [];
  let expectEnd = false;
  for (let i = 0; i < toks.length && times.length < 2; i++) {
    if (used[i]) continue;
    const x = numAt(toks, i);
    if (!x || x.n > 24 || (x.m != null && x.m > 59)) continue;
    let j = i + x.span, m = x.m ?? 0, sfx = x.sfx;
    const half = x.m == null && !x.sfx && isHalf(toks[j]?.w) && !used[j];
    if (half) { m = 30; sfx = toks[j].w.replace(/^buçu[kğ]/, ''); j++; }
    const saat = i > 0 && toks[i - 1].w === 'saat' && !used[i - 1];
    const before = saat ? i - 2 : i - 1;
    const dp = parts.find((p) => p.to === before && !used[p.from]);
    const range = RANGE.has(toks[j]?.w) && !!numAt(toks, j + 1);
    const ok = x.m != null || saat || half || AT_FROM.has(sfx) || (TO.has(sfx) && times.length === 1) || range || expectEnd || !!dp;
    if (!ok) continue;
    for (let k = i; k < j; k++) used[k] = true;
    if (saat) used[i - 1] = true;
    if (dp) for (let k = dp.from; k <= dp.to; k++) used[k] = true;
    times.push({ h: x.n, m, zero: x.zero, part: dp?.p ?? null });
    expectEnd = range;
    if (range) used[j++] = true;
    while (TIME_TAIL.has(toks[j]?.w)) used[j++] = true;
    i = j - 1;
  }
  return times;
}

function kindOf(words) {
  for (const [kind, stems] of KIND_WORDS) {
    if (words.some((w) => stems.some((s) => kindWord(w, s)))) return kind;
  }
  return 'Event';
}

export function parseQuickAdd(text, today = new Date()) {
  const toks = tokenize(text ?? '');
  const used = toks.map(() => false);
  const date = findDate(toks, used, today);
  const dur = findDuration(toks, used);
  const times = findTimes(toks, used);

  let time = '', endTime = '';
  if (times.length) {
    const s = clock(times[0].h, times[0].m, times[0].part, times[0].zero);
    let e = times[1] ? endClock(times[1], s) : dur ? (s + dur) % 1440 : null;
    if (e === s) e = null;
    time = hm(s);
    endTime = e == null ? '' : hm(e % 1440);
  }

  let rest = toks.filter((t, i) => !used[i] && !DROP.has(t.w));
  while (rest.length && (COMMAND.has(rest[rest.length - 1].w) || EDGE.has(rest[rest.length - 1].w))) rest.pop();
  while (rest.length && (EDGE.has(rest[0].w) || rest[0].w === 'bir') && rest.length > 1) rest.shift();
  if (rest.length === 1 && EDGE.has(rest[0].w)) rest = [];
  const words = rest.map((t) => t.w);
  const joined = rest.map((t) => t.raw).join(' ').slice(0, 150).trim();
  const title = joined && joined[0].toLocaleUpperCase('tr') + joined.slice(1);
  return { date, time, endTime, kind: kindOf(words), title };
}

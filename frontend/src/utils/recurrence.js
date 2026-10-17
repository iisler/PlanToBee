import { MONTHS, WEEKDAYS, WEEKDAYS_FULL } from './format';

// Tekrarlayan aktiviteler (Görev 11). Sunucu seriyi (haftalık kural) günlere yayar; her gün "sanal" bir kayıt gelir:
// id = 0, seriesId dolu, occurrenceDate = o gün, recurring = { daysOfWeek: [1..7], startDate, untilDate }.
// Günler ISO: 1 = Pzt … 7 = Paz. Tarihler "yyyy-AA-gg". Saf işlevler (React Native'e aynen taşınabilir).

export const isOccurrence = (ev) => !!ev && !ev.isStudy && !!ev.seriesId && !ev.id;

export const WEEKDAY_ISO = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS_ISO = [1, 2, 3, 4, 5];

// "2026-10-20" → yerel Date (saat 00:00)
export function parseKey(k) {
  const [y, m, d] = (k ?? '').split('-').map(Number);
  return new Date(y, m - 1, d);
}
// ISO hafta günü (1 = Pzt … 7 = Paz)
export const isoDay = (k) => ((parseKey(k).getDay() + 6) % 7) + 1;

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Başlangıçtan tam 1 yıl sonrası (29 Şubat → 28 Şubat; sunucudaki AddYears(1) ile aynı)
export function plusYear(k) {
  const d = parseKey(k);
  const t = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
  if (t.getMonth() !== d.getMonth()) t.setDate(0);
  return keyOf(t);
}

// Seçili günler metni: ardışık 3+ gün aralık ("Pzt–Cum"), değilse virgüllü ("Pzt, Çar, Cum")
export function daysText(days) {
  const s = [...new Set(days)].sort((a, b) => a - b);
  if (!s.length) return '';
  const consecutive = s.every((d, i) => i === 0 || d === s[i - 1] + 1);
  if (s.length >= 3 && consecutive) return `${WEEKDAYS[s[0] - 1]}–${WEEKDAYS[s[s.length - 1] - 1]}`;
  return s.map((d) => WEEKDAYS[d - 1]).join(', ');
}

// Sayıya yönelme eki (okunuşa göre): 2027'ye, 2026'ya, 2028'e, 2030'a
const UNIT_DAT = ['', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'];
const TEN_DAT = ['', 'a', 'ye', 'a', 'a', 'ye', 'a', 'e', 'e', 'a'];
export function withDative(n) {
  let suffix;
  if (n % 10 !== 0) suffix = UNIT_DAT[n % 10];
  else if (n % 100 !== 0) suffix = TEN_DAT[(n % 100) / 10];
  else suffix = 'e'; // yüz, bin
  return `${n}'${suffix}`;
}

// Ay adına belirtme eki: "20 Ekim'i", "3 Temmuz'u", "1 Eylül'ü"
const MONTH_ACC = ['ı', 'ı', 'ı', 'ı', 'ı', 'ı', 'u', 'u', 'ü', 'i', 'ı', 'ı'];

// "20 Ekim"
export const dayMonth = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
// "20 Ekim'i"
export const dayMonthAcc = (k) => `${dayMonth(k)}'${MONTH_ACC[parseKey(k).getMonth()]}`;
// "20 Ekim Salı"
export const dayMonthWeekday = (k) => `${dayMonth(k)} ${WEEKDAYS_FULL[isoDay(k) - 1]}`;
// "15 Haz 2027'ye kadar"
export function untilText(k) {
  const d = parseKey(k);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${withDative(d.getFullYear())} kadar`;
}

// Kural kaç haftaya yayılıyor (başlangıç ve bitiş günü dahil, yukarı yuvarlanır)
export function weekCount(start, until) {
  const days = Math.round((parseKey(until) - parseKey(start)) / 86400000) + 1;
  return days > 0 ? Math.ceil(days / 7) : 0;
}

// Seçili günlerden en az biri aralığa düşüyor mu (sunucu da reddeder; istemci hatayı önceden gösterir)
export function hasOccurrence(days, start, until) {
  const a = parseKey(start), b = parseKey(until);
  for (let d = new Date(a), i = 0; d <= b && i < 7; d.setDate(d.getDate() + 1), i++) {
    if (days.includes(((d.getDay() + 6) % 7) + 1)) return true;
  }
  return false;
}

// ⋯ menüsü alt satırının başı: "↻ Her hafta Pzt–Cum · 15 Haz 2027'ye kadar"
export const recurringLine = (r) => (r ? `↻ Her hafta ${daysText(r.daysOfWeek)} · ${untilText(r.untilDate)}` : '');

// Ekran okuyucu eki
export const repeatAria = (ev) => (isOccurrence(ev) ? ', her hafta tekrarlanıyor' : '');

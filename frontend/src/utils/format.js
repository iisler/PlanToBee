// Tarih, süre ve kişi adı biçimlendirme yardımcıları (DOM'a bağlı değil, React Native'de de kullanılabilir).

export const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const WEEKDAYS_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function dkey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function mondayOf(d) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() - (nd.getDay() + 6) % 7);
  nd.setHours(0, 0, 0, 0);
  return nd;
}
export function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}
const NBSP = '\u00a0';
// Hafta aralığı: aynı ay "5 – 11 Ekim", iki ay "28 Eyl – 4 Eki".
// - Şerit başlığında (withYear=false) yıl hiç yazılmaz: "28 Ara – 3 Oca".
// - Hafta paneli başlığında (withYear=true) yıl, içinde bulunulan yıldan farklıysa (ya da hafta iki yıla yayılıyorsa) yazılır:
//   "29 Ara 2026 – 4 Oca 2027". Tarihlerin içi bölünmez (NBSP); satır yalnızca "–" sonrasında kırılabilir.
export function weekRangeLabel(monday, { withYear = false, today = new Date() } = {}) {
  const sun = addDays(monday, 6);
  const short = (d) => MONTHS[d.getMonth()].slice(0, 3);
  const nb = (...p) => p.join(NBSP);
  const left = (...p) => `${nb(...p)}${NBSP}– `;
  if (withYear && monday.getFullYear() !== sun.getFullYear()) {
    return left(monday.getDate(), short(monday), monday.getFullYear()) + nb(sun.getDate(), short(sun), sun.getFullYear());
  }
  const year = withYear && sun.getFullYear() !== today.getFullYear() ? [sun.getFullYear()] : [];
  if (monday.getMonth() === sun.getMonth()) return left(monday.getDate()) + nb(sun.getDate(), MONTHS[sun.getMonth()], ...year);
  return left(monday.getDate(), short(monday)) + nb(sun.getDate(), short(sun), ...year);
}

// Gün başlığı: "Cumartesi, 10 Ekim" (yıl farklıysa "…, 10 Ekim 2027")
export function dayTitle(d, today = new Date()) {
  const year = d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${WEEKDAYS_FULL[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

// Sayıya iyelik eki: 1'i, 2'si, 3'ü, 6'sı, 10'u, 40'ı ("3 dersten 1'i tamam")
const UNIT_SUFFIX = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
const TEN_SUFFIX = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];
export function withPossessive(n) {
  let suffix;
  if (n % 10 !== 0 || n === 0) suffix = UNIT_SUFFIX[n % 10];
  else if (n % 100 !== 0) suffix = TEN_SUFFIX[(n % 100) / 10];
  else if (n % 1000 !== 0) suffix = 'ü';
  else suffix = 'i';
  return `${n}'${suffix}`;
}

export function formatDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

const pad = (n) => String(n).padStart(2, '0');

// Bugünse "18:40", değilse "26 Eyl 18:40"
export function formatStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (dkey(d) === dkey(new Date())) return time;
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${time}`;
}

export const ROLE_LABEL = { Parent: 'Ebeveyn', Child: 'Çocuk' };

export function initial(name) {
  return (name || '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
}

function auditName(m) {
  return m.isFormerMember ? `Eski üye: ${m.displayName}` : m.displayName;
}

const isForeign = (m, myMemberId) => !!m && (m.isFormerMember || m.memberId !== myMemberId);
const sameMember = (a, b) => !!a && !!b && a.memberId === b.memberId && a.isFormerMember === b.isFormerMember;

// Satırdaki "kim ekledi" işareti yalnızca ekleyene göre: kaydı başkası eklediyse { name, text }, aksi halde null.
// Durum değişikliği ya da düzenleme işaret göstermez (ayrıntısı ⋯ menüsünde).
export function creatorMark(entry, myMemberId) {
  const c = entry?.createdBy;
  if (!isForeign(c, myMemberId)) return null;
  return { name: c.displayName, text: `${auditName(c)} ekledi` };
}

// ⋯ menüsündeki kayıt izi: ekleyen her zaman, başkası değiştirdiyse değiştiren de.
// "Ayşe ekledi · 9 Eki 20:14 · Deniz değiştirdi · 12:22", "Sen ekledin · 9 Eki 20:14", "Ayşe ekledi · … · Sen değiştirdin · 12:22".
export function auditLine(entry, myMemberId) {
  if (!entry) return '';
  const parts = [];
  const c = entry.createdBy;
  const created = formatStamp(entry.createdAt);
  if (c) parts.push(`${isForeign(c, myMemberId) ? `${auditName(c)} ekledi` : 'Sen ekledin'}${entry.isImported ? ' (aktarıldı)' : ''}`);
  else if (entry.isImported) parts.push('Aktarıldı');
  if (parts.length && created) parts.push(created);
  const u = entry.updatedBy;
  if (u && entry.updatedAt && !sameMember(u, c)) {
    parts.push(isForeign(u, myMemberId) ? `${auditName(u)} değiştirdi` : 'Sen değiştirdin');
    const when = formatStamp(entry.updatedAt);
    if (when) parts.push(when);
  }
  return parts.join(' · ');
}

export const STATUS_ORDER = ['todo', 'inprogress', 'done'];
export const STATUS_SHORT = { todo: 'Yapılacak', inprogress: 'Devam Ediyor', done: 'Tamamlandı' };
export function nextStatus(s) {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
}

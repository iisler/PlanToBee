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

// Kayıt izi: { text, who }. text örn. "Annem ekledi", "Babam düzenledi · 18:40", "Eski üye: Ayşe ekledi",
// "Sen ekledin". who: izdeki başka kişinin adı (kısa gösterimde baş harfi yazılır); kendi kaydında null.
// showOwn: planı başkalarıyla paylaşıyorsan kendi eklediklerinde de "Sen ekledin" yazılır.
// Gösterilecek iz yoksa null.
export function auditInfo(entry, myMemberId, showOwn = false) {
  if (!entry) return null;
  const foreign = (m) => m && (m.isFormerMember || m.memberId !== myMemberId);
  if (foreign(entry.updatedBy)) {
    const when = formatStamp(entry.updatedAt);
    return { text: `${auditName(entry.updatedBy)} düzenledi${when ? ` · ${when}` : ''}`, who: entry.updatedBy.displayName };
  }
  if (foreign(entry.createdBy)) {
    return { text: `${auditName(entry.createdBy)} ekledi${entry.isImported ? ' (aktarıldı)' : ''}`, who: entry.createdBy.displayName };
  }
  if (showOwn && entry.createdBy) return { text: `Sen ekledin${entry.isImported ? ' (aktarıldı)' : ''}`, who: null };
  if (entry.isImported) return { text: 'Aktarıldı', who: null };
  return null;
}

export function auditTrail(entry, myMemberId, showOwn = false) {
  return auditInfo(entry, myMemberId, showOwn)?.text ?? '';
}

export const STATUS_ORDER = ['todo', 'inprogress', 'done'];
export const STATUS_SHORT = { todo: 'Yapılacak', inprogress: 'Devam Ediyor', done: 'Tamamlandı' };
export function nextStatus(s) {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
}

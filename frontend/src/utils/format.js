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

// Davetin kalan süresi: "6 gün kaldı", "5 saat kaldı", "12 dk kaldı"
export function formatRemaining(seconds) {
  if (seconds == null) return '';
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)} gün kaldı`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} saat kaldı`;
  return `${Math.max(1, Math.floor(seconds / 60))} dk kaldı`;
}

// Türkçe iyelik eki: "Ela" → "Ela'nın", "Ömer" → "Ömer'in", "Umut" → "Umut'un"
export function possessive(name) {
  const n = (name || '').trim();
  if (!n) return '';
  const lower = n.toLocaleLowerCase('tr-TR');
  const vowels = 'aıoueiöü';
  let last = '';
  for (let i = lower.length - 1; i >= 0; i--) {
    if (vowels.includes(lower[i])) { last = lower[i]; break; }
  }
  const suffixVowel = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[last] || 'i';
  const endsWithVowel = vowels.includes(lower[lower.length - 1]);
  return `${n}'${endsWithVowel ? 'n' : ''}${suffixVowel}n`;
}

export const ROLE_LABEL = { Parent: 'Ebeveyn', Child: 'Çocuk' };
export const MEMBER_STATUS_LABEL = { NoAccount: 'Hesabı yok', Invited: 'Davet bekliyor', Joined: 'Katıldı' };
export const INVITE_STATUS_LABEL = { Pending: 'Bekliyor', Accepted: 'Katıldı', Expired: 'Süresi doldu', Cancelled: 'İptal' };

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

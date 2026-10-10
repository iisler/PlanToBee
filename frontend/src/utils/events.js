import { formatDuration } from './format';

// Aktivite türleri (sunucudaki EventKind). 'Training' Spor, 'Event' Diğer'dir (eski "etkinlik" kayıtları da Diğer'dir).
// Ad boş bırakılırsa türün adı kullanılır; yalnızca Diğer'de ad zorunludur.
export const ACTIVITY_KINDS = [
  { kind: 'Training', icon: '🏅', label: 'Spor', placeholder: 'ör. Voleybol antrenmanı, Maç' },
  { kind: 'Music', icon: '🎵', label: 'Müzik', placeholder: 'ör. Piyano dersi' },
  { kind: 'Concert', icon: '🎤', label: 'Konser', placeholder: 'ör. Okul konseri' },
  { kind: 'Meeting', icon: '👥', label: 'Buluşma', placeholder: 'ör. Arkadaşlarla sinema' },
  { kind: 'Exam', icon: '📝', label: 'Sınav', placeholder: 'ör. Deneme sınavı' },
  { kind: 'Event', icon: '✦', label: 'Diğer', placeholder: 'ör. Veteriner randevusu', nameRequired: true },
];

// Tanınmayan tür Diğer gibi gösterilir.
export const kindInfo = (kind) => ACTIVITY_KINDS.find((k) => k.kind === kind) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];

export const isTraining = (ev) => ev?.kind === 'Training';

// Eski antrenman kayıtlarında ad yoktur; ad türden türetilir ("Top antrenmanı", "Voleybol kampı").
const LEGACY_TRAINING_TYPES = ['Top', 'Kuvvet', 'Maç', 'Kondisyon'];
function legacyTrainingLabel(ev, short) {
  const type = ev.trainingType || 'Antrenman';
  return LEGACY_TRAINING_TYPES.includes(type) && !short ? `${type} antrenmanı` : type;
}

// Görünen ad. short: hafta çiplerinde eski antrenmanlar için yalnızca tür ("Top").
export function eventLabel(ev, short = false) {
  if (ev.title) return ev.title;
  if (isTraining(ev)) return legacyTrainingLabel(ev, short);
  return kindInfo(ev.kind).label;
}

// Kısa ek bilgi: "17:00 · 1 sa 30 dk", "10:00", "45 dk". Süre yalnızca eski spor kayıtlarında olabilir.
export function eventMeta(ev) {
  const parts = [];
  if (ev.time) parts.push(ev.time);
  if (isTraining(ev) && ev.minutes > 0) parts.push(formatDuration(ev.minutes));
  return parts.join(' · ');
}

export const trainingMinutes = (events) =>
  events.filter(isTraining).reduce((s, e) => s + (e.minutes || 0), 0);

// "Geri al" bildirimi metni
export const deletedText = (ev) => `${eventLabel(ev)} silindi`;

// Bir günün şerit ve Hafta paneli özeti (GET /days/week/{pzt}/details cevabındaki DayDto'dan):
// done: tamamlanan ders sayısı, total: ders sayısı, minutes: planlanan ders dakikaları, events: sunucu sırasıyla aktiviteler.
export function daySummary(day) {
  const entries = day?.studyEntries ?? [];
  return {
    done: entries.filter((e) => e.status === 'done').length,
    total: entries.length,
    minutes: entries.reduce((s, e) => s + e.minutes, 0),
    events: day?.events ?? [],
  };
}

// Haftalık toplam (Hafta paneli alt bilgisi): planlanan ders dakikası (durumdan bağımsız),
// en az bir Spor aktivitesi olan gün sayısı ve bütün aktivitelerin sayısı (Spor dahil).
export function weekTotals(days) {
  let minutes = 0, sportDays = 0, events = 0, entries = 0;
  for (const d of days) {
    const s = daySummary(d);
    minutes += s.minutes;
    entries += s.total;
    events += s.events.length;
    if (s.events.some(isTraining)) sportDays++;
  }
  return { minutes, sportDays, events, empty: entries === 0 && events === 0 };
}

// Ekran okuyucu ve panel için "Yüzme 10:00" (saat yoksa yalnızca ad)
export const eventWithTime = (ev) => (ev.time ? `${eventLabel(ev)} ${ev.time}` : eventLabel(ev));

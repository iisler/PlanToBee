import { formatDuration } from './format';

// Etkinlik listesindeki kayıtlar iki türdür: 'Event' (adı olan etkinlik) ve 'Training' (antrenman).
export const TRAINING_TYPES = ['Top', 'Kuvvet', 'Maç', 'Kondisyon'];

export const isTraining = (ev) => ev?.kind === 'Training';

// Görünen ad: "Deneme sınavı", "Top antrenmanı". Kullanıcının yazdığı türler olduğu gibi gösterilir
// ("Voleybol kampı"); eski içe aktarılmış "Antrenman" türü de olduğu gibi.
export function eventLabel(ev) {
  if (!isTraining(ev)) return ev.title;
  const type = ev.trainingType || 'Antrenman';
  return TRAINING_TYPES.includes(type) ? `${type} antrenmanı` : type;
}

// Kısa ek bilgi: "17:00 · 1 sa 30 dk", "10:00", "45 dk". Süresiz eski antrenmanlarda yalnızca saat.
export function eventMeta(ev) {
  const parts = [];
  if (ev.time) parts.push(ev.time);
  if (isTraining(ev) && ev.minutes > 0) parts.push(formatDuration(ev.minutes));
  return parts.join(' · ');
}

export const trainingMinutes = (events) =>
  events.filter(isTraining).reduce((s, e) => s + (e.minutes || 0), 0);

// "Geri al" bildirimi metni
export const deletedText = (ev) => (isTraining(ev) ? `${eventLabel(ev)} silindi` : `${ev.title} etkinliği silindi`);

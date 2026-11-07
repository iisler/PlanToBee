import { useEffect, useState } from 'react';
import { formatDuration, withPossessive } from '../utils/format';
import { eventLabel } from '../utils/events';
import { kindClass, toMin } from '../utils/timeline';

const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// Bugün için dakikada bir güncellenen "şu an" (dakika); başka günlerde null
function useNowMinutes(active) {
  const [now, setNow] = useState(nowMinutes);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : null;
}

// Kaydın süresi (dk): ders kendi süresi, aktivite bitiş − başlangıç (gece yarısını geçebilir); bilinmiyorsa null
function lengthOf(x, start) {
  if (x.isStudy) return x.minutes || null;
  const end = toMin(x.endTime || x.derivedEndTime);
  return end == null ? null : (end - start + 1440) % 1440 || null;
}

// Gün ekranının özet kutuları (Görev 16), Ajanda kartının üstünde:
// - Dersler: tamamlanan / toplam, ilerleme çubuğu ve tamamlanmamış ilk ders ("Kalan: Fizik · 30 dk").
// - Sıradaki (bugün): şu andan sonra başlayan ilk saatli ders ya da aktivite ve kaç dakika sonra başladığı.
//   Başka günde "İlk plan": günün ilk saatli kaydı ve süresi. Kutunun rengi kaydın türünden (ders, spor, aktivite).
// entries: günün dersleri (DayDto.studyEntries), items: utils/timeline agendaItems (dersler + aktiviteler).
export default function DayTiles({ entries, items, isToday }) {
  const now = useNowMinutes(isToday);
  const total = entries.length;
  const done = entries.filter((e) => e.status === 'done').length;
  const left = entries.find((e) => e.status !== 'done');

  // Tamamlanmış ders "sıradaki" sayılmaz
  const timed = items
    .map((x) => ({ x, s: toMin(x.time) }))
    .filter((t) => t.s != null && !(t.x.isStudy && t.x.status === 'done'))
    .sort((a, b) => a.s - b.s);
  const next = isToday ? timed.find((t) => t.s > now) : timed[0];
  let sub = '';
  if (next && isToday) sub = `${formatDuration(next.s - now)} sonra`;
  else if (next) {
    const len = lengthOf(next.x, next.s);
    sub = len ? formatDuration(len) : '';
  }
  const none = isToday && timed.length > 0 ? 'Bugün başka saatli plan yok' : 'Saatli plan yok';
  const lessons = total === 0 ? (isToday ? 'Bugün ders yok' : 'Bu gün ders yok')
    : left ? `Kalan: ${left.subject} · ${formatDuration(left.minutes)}` : 'Hepsi tamam';

  return (
    <section className="daytiles" aria-label="Günün özeti">
      <div className="dtile study">
        <div className="dt-hd">
          <span className="dt-lb">Dersler</span>
          <span className="dt-big" aria-hidden="true">{total ? `${done}/${total}` : '–'}</span>
        </div>
        {total > 0 && <span className="sr-only">{total} dersten {withPossessive(done)} tamam.</span>}
        {total > 0 && <div className="dt-bar" aria-hidden="true"><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>}
        <div className="dt-t2">{lessons}</div>
      </div>
      <div className={`dtile${next ? ` ${kindClass(next.x)}` : ''}`}>
        <div className="dt-hd">
          <span className="dt-lb">{isToday ? 'Sıradaki' : 'İlk plan'}</span>
          <span className="dt-big mono">{next ? next.x.time : '–'}</span>
        </div>
        <div className="dt-t1">{next ? (next.x.isStudy ? next.x.subject : eventLabel(next.x)) : none}</div>
        {sub && <div className="dt-t2">{sub}</div>}
      </div>
    </section>
  );
}

import useNow from '../hooks/useNow';
import { formatDuration, withPossessive } from '../utils/format';
import { eventLabel } from '../utils/events';
import { span, toMin } from '../utils/timeline';
import { Check } from './Icons';

const open = (x) => !(x.isStudy && x.status === 'done'); // tamamlanan ders "şimdi" ya da "sırada" sayılmaz

// Şimdi kartı (Görev 17): gün ekranının en üstündeki koyu kart. "Şimdi ne yapıyorum, sırada ne var, ne kadar kaldı?"
// sorusunu yanıtlar ve ekranın tek birincil eylemini taşır. Bugün için durumlar (öncelik sırasıyla):
// 1. Saati gelmiş, tamamlanmamış ders: ad, kalan süre, süre çubuğu ve "Tamamla".
// 2. "Devam ediyor" durumundaki ders (saatsiz ya da saati dışında): "Tamamla".
// 3. Süren aktivite (Okul, antrenman): ad ve kalan süre.
// 4. Bütün dersler tamam: "Petek doldu".
// 5. Boşluk: sıradaki kayda kadar boş süre; boşluğa sığan saatsiz ders varsa "Başla" ile önerilir.
// Başka günde günün özeti; hiç kayıt yoksa "Plan yok" ve ekleme düğmeleri. Sağda günün ders peteği (tamamlanan / toplam).
// entries: günün dersleri, items: utils/timeline agendaItems. onStatus(ders, durum), onAdd('study' | 'event').
export default function NowCard({ entries, items, isToday, onStatus, onAdd }) {
  const now = useNow(isToday);
  const total = entries.length;
  const done = entries.filter((e) => e.status === 'done').length;
  const timed = items.map(span).filter(Boolean).sort((a, b) => a.S - b.S);
  const name = (r) => eventLabel(r.ev);
  const left = (r) => `${formatDuration(r.E - now)} kaldı`;
  const bar = (r) => Math.min(100, Math.max(2, Math.round(((now - r.S) / (r.E - r.S)) * 100)));
  const finish = (entry) => (
    <button type="button" className="now-btn" onClick={() => onStatus(entry, 'done')}><Check />Tamamla</button>
  );

  let v;
  if (!items.length) {
    v = { over: isToday ? 'Bugün' : 'Bu gün', title: 'Plan yok', sub: 'Tüm gün boş', empty: true };
  } else if (!isToday) {
    const first = timed[0];
    v = {
      over: 'Günün özeti',
      title: total === 0 ? `${items.length} aktivite` : done === total ? 'Petek doldu' : `${total} dersin ${withPossessive(done)} tamam`,
      sub: first ? <>İlk plan <b>{first.start}</b> {name(first)}</> : 'Saatli plan yok',
    };
  } else {
    const inWindow = timed.filter((r) => r.S <= now && now < r.E && open(r.ev));
    const lesson = inWindow.find((r) => r.ev.isStudy);
    const started = entries.find((e) => e.status === 'inprogress');
    const current = inWindow[0];
    // Sıradaki: şu andan sonra başlayan ilk açık kayıt; kartta gösterilen dersin kendisi sayılmaz
    const shownId = lesson ? lesson.ev.id : started?.id;
    const next = timed.find((r) => r.S > now && open(r.ev) && !(r.ev.isStudy && r.ev.id === shownId));
    const after = next && <>Sonra <b>{next.start}</b> {name(next)}</>;
    if (lesson) {
      v = {
        over: `Şimdi · bitiş ${lesson.end}`, title: lesson.ev.subject, sub: [lesson.ev.topic, left(lesson)].filter(Boolean).join(' · '),
        bar: bar(lesson), action: finish(lesson.ev), foot: after,
      };
    } else if (started) {
      v = {
        over: 'Şimdi · devam ediyor', title: started.subject, sub: [started.topic, formatDuration(started.minutes)].filter(Boolean).join(' · '),
        action: finish(started), foot: after,
      };
    } else if (current) {
      v = { over: current.noEnd ? 'Şimdi' : `Şimdi · bitiş ${current.end}`, title: name(current), sub: current.noEnd ? '' : left(current), bar: current.noEnd ? null : bar(current), foot: after };
    } else if (total > 0 && done === total) {
      const minutes = entries.reduce((s, e) => s + e.minutes, 0);
      v = {
        over: 'Bugün', title: 'Petek doldu',
        sub: `${total === 1 ? 'Bugünün dersi tamam' : `${total} dersin de tamam`} · ${formatDuration(minutes)}`,
        foot: next && <>Sırada <b>{next.start}</b> {name(next)}</>,
      };
    } else {
      const gap = next ? next.S - now : null;
      const remaining = total - done;
      // Boşluğa sığan saatsiz ders (boşluk yoksa: bekleyen ilk saatsiz ders)
      const fit = entries.find((e) => e.status !== 'done' && toMin(e.startTime) == null && (gap == null || e.minutes <= gap));
      v = {
        over: 'Şimdi boşsun',
        title: next ? `${formatDuration(gap)} boş` : remaining > 0 ? `${remaining} ders kaldı` : 'Günün kalanı boş',
        sub: next ? <>Sırada <b>{next.start}</b> {name(next)}</> : remaining > 0 ? 'Saatli planın bitti' : 'Saatli plan kalmadı',
        hint: fit && (
          <div className="now-hint">
            <span>Saatsiz dersin <b>{fit.subject}</b> ({formatDuration(fit.minutes)}) {next ? 'bu boşluğa sığar.' : 'seni bekliyor.'}</span>
            <button type="button" className="now-btn" onClick={() => onStatus(fit, 'inprogress')}>Başla</button>
          </div>
        ),
      };
    }
  }

  return (
    <section className="nowcard" aria-label={isToday ? 'Şimdi' : 'Günün özeti'}>
      <div className="now-top">
        <div className="now-tx">
          <span className="now-over">{v.over}</span>
          <b className="now-title">{v.title}</b>
          {v.sub && <span className="now-sub">{v.sub}</span>}
        </div>
        {total > 0 && (
          <div className="now-hex" role="img" aria-label={`${total} dersten ${withPossessive(done)} tamam`}>
            <span className={`hx${done === total ? ' full' : ''}`}>
              <i style={{ height: `${Math.round((done / total) * 100)}%` }} />
              {done === total && <Check />}
            </span>
            <span className="c"><b>{done}/{total}</b> ders</span>
          </div>
        )}
      </div>
      {v.bar != null && <div className="now-bar" aria-hidden="true"><i style={{ width: `${v.bar}%` }} /></div>}
      {(v.action || v.foot) && (
        <div className="now-foot">
          {v.action}
          {v.foot && <span className="now-next">{v.foot}</span>}
        </div>
      )}
      {v.hint}
      {v.empty && (
        <div className="now-add">
          <button type="button" className="now-btn" onClick={() => onAdd('study')}>Ders ekle</button>
          <button type="button" className="now-btn ghost" onClick={() => onAdd('event')}>Aktivite ekle</button>
        </div>
      )}
    </section>
  );
}

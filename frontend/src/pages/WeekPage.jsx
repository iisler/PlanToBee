import WeekHead from '../components/WeekHead';
import HoneycombSpinner from '../components/HoneycombSpinner';
import { addDays, dkey, formatDuration, mondayOf, MONTHS, WEEKDAYS, WEEKDAYS_FULL, weekRangeLabel, withPossessive } from '../utils/format';
import { daySummary, eventWithTime, weekTotals } from '../utils/events';
import { holidayAria, holidayTone } from '../utils/holidays';
import { agendaItems, flowClass, itemKey, longestGaps, toMin, WE, weekColumn, WS } from '../utils/timeline';

const AXIS = [7, 10, 13, 16, 19, 22];
const pct = (min) => `${((min - WS) / (WE - WS)) * 100}%`;

// Hafta sayfası (Görev 17; eski Hafta panelinin yerine): üstte haftanın özeti (tamamlanan ders, çalışılan süre, spor günü),
// altında gün başına bir satır: petek (ders dolumu), gün adı ve ders sayacı, 07–22 şeridi (ders mavi, spor yeşil, aktivite
// mercan, okul taralı gri) ve aktivite adları. Satıra dokununca o gün açılır (onPick). En altta renk açıklaması ve en uzun
// boşluklar. days: 7 DayDto ya da null (yükleniyor); error: yükleme hatası. onStep(-1 | +1): hafta değiştirir.
export default function WeekPage({ monday, days, error, onRetry, onStep, onPick, headingRef, children }) {
  const todayKey = dkey(new Date());
  const isThisWeek = dkey(mondayOf(new Date())) === dkey(monday);
  const head = (
    <WeekHead over={isThisWeek ? 'Bu hafta' : 'Hafta'} title={weekRangeLabel(monday, { withYear: true })} onStep={onStep} headingRef={headingRef}>
      {children}
    </WeekHead>
  );

  if (!days) return (
    <>
      {head}
      {error ? (
        <div className="load-error" role="alert">
          <p>Hafta yüklenemedi: {error}</p>
          <button type="button" className="btn" onClick={onRetry}>Tekrar dene</button>
        </div>
      ) : (
        <div className="sheet-loading" role="status"><HoneycombSpinner size={64} /><span>Yükleniyor, biraz bekle…</span></div>
      )}
    </>
  );

  const totals = weekTotals(days);
  const lessons = days.reduce((a, d) => {
    for (const e of d.studyEntries ?? []) {
      a.total++;
      if (e.status === 'done') { a.done++; a.doneMin += e.minutes; }
    }
    return a;
  }, { done: 0, total: 0, doneMin: 0 });
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayOf = (i) => days.find(d => d.date === dkey(addDays(monday, i)));
  const cols = WEEKDAYS.map((_, i) => {
    const day = dayOf(i);
    return weekColumn(agendaItems(day?.studyEntries, daySummary(day).events));
  });
  const longest = longestGaps(cols, WEEKDAYS);

  return (
    <>
      {head}
      {!totals.empty && (
        <section className="wk-sum" aria-label="Haftanın özeti">
          <div>
            <b>{lessons.done}/{lessons.total}</b><span>ders tamam</span>
            <i className="bar" aria-hidden="true"><i style={{ width: `${lessons.total ? Math.round((lessons.done / lessons.total) * 100) : 0}%` }} /></i>
          </div>
          <div><b>{formatDuration(lessons.doneMin)}</b><span>çalışıldı</span><small>{formatDuration(totals.minutes)} planlı</small></div>
          <div><b>{totals.sportDays} gün</b><span>spor</span></div>
        </section>
      )}

      <div className="wk-axis" aria-hidden="true">
        <span>{AXIS.map(h => <i key={h} style={{ left: pct(h * 60) }}>{String(h).padStart(2, '0')}</i>)}</span>
      </div>
      <div className="wk-days">
        {cols.map((col, i) => {
          const date = addDays(monday, i);
          const key = dkey(date);
          const day = dayOf(i);
          const s = daySummary(day);
          const today = key === todayKey;
          const hol = holidayAria(day);
          const tone = holidayTone(day);
          const named = s.events.filter(ev => ev.kind !== 'School').map(eventWithTime);
          const untimed = (day?.studyEntries ?? []).filter(e => toMin(e.startTime) == null).length;
          if (untimed) named.push(`${untimed} ders saatsiz`);
          const empty = s.total === 0 && s.events.length === 0;
          const fill = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
          const label = `${WEEKDAYS_FULL[i]} ${date.getDate()} ${MONTHS[date.getMonth()]}${today ? ', bugün' : ''}${hol ? `, ${hol}` : ''}: `
            + `${empty ? 'plan yok' : `${s.total ? `${s.total} dersten ${withPossessive(s.done)} tamam` : 'ders yok'}${s.events.length ? `; ${s.events.map(eventWithTime).join(', ')}` : ''}`}. Günü aç`;
          return (
            <button key={key} type="button" className={`wk-day${today ? ' today' : ''}${empty ? ' empty' : ''}`} aria-current={today ? 'date' : undefined}
              aria-label={label} onClick={() => onPick(date)}>
              <span className="hex" aria-hidden="true">
                <span className="hex-in">
                  {fill > 0 && <span className="hex-fill" style={{ height: `${fill}%` }} />}
                  <span className="num">{date.getDate()}</span>
                </span>
              </span>
              <span className="wk-tx" aria-hidden="true">
                <span className="l1">
                  <b>{WEEKDAYS_FULL[i]}{today && ' · bugün'}{tone && <i className={`hd ${tone}`} />}</b>
                  <span className={s.total > 0 && s.done === s.total ? 'full' : ''}>{s.total > 0 ? `${s.done}/${s.total} ders` : 'ders yok'}</span>
                </span>
                <span className="wk-bar">
                  {col.inw.map(r => <i key={itemKey(r.ev)} className={flowClass(r.ev)} style={{ left: pct(r.cs), width: `max(4px, ${((r.ce - r.cs) / (WE - WS)) * 100}%)` }} />)}
                  {today && nowMin >= WS && nowMin < WE && <i className="nowline" style={{ left: pct(nowMin) }} />}
                </span>
                <span className="l3">{empty ? 'Plan yok · tüm gün boş' : named.join(' · ') || (hol ?? '')}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="wk-leg">
        <span><i className="study" aria-hidden="true" />Ders</span>
        <span><i className="sport" aria-hidden="true" />Spor</span>
        <span><i className="evt" aria-hidden="true" />Aktivite</span>
        <span><i className="school" aria-hidden="true" />Okul</span>
      </div>
      <p className="wk-foot">
        {longest
          ? <><b>En uzun boşluk:</b> {longest.map((t, i) => <span key={t} className="nw">{i > 0 && ' · '}{t}</span>)}</>
          : (isThisWeek ? 'Bu hafta saatli ders ya da aktivite yok.' : 'Saatli ders ya da aktivite yok.')}
      </p>
    </>
  );
}

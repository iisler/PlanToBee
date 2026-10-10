import { useId } from 'react';
import Sheet from './Sheet';
import HoneycombSpinner from './HoneycombSpinner';
import { addDays, dkey, mondayOf, MONTHS, WEEKDAYS, WEEKDAYS_FULL, weekRangeLabel } from '../utils/format';
import { daySummary, weekTotals } from '../utils/events';
import { iconOf, kindClass, longestGaps, weekColumn, weekColumnLabel, WE, WG_HEIGHT, WG_PX, WS } from '../utils/timeline';

const AXIS = [7, 10, 13, 16, 19, 22];
const GRID_LINES = [10, 13, 16, 19];

// "📅 Hafta" alt sayfası (Görev 09): 7 sütunlu zaman ızgarası (07–22, 20 px/saat, sıkıştırma yok; günler karşılaştırılabilir).
// Her gün tek düğme; dokununca o gün seçilir (onPick) ve panel kapanır. Bloklar yalnızca bilgi; ayrıntı Gün ekranında.
// Altında en uzun boşluklar metinle, renk açıklaması ve haftalık toplam.
// days: 7 DayDto ya da null (yükleniyor); error: yükleme hatası metni.
export default function WeekSheet({ monday, days, error, onRetry, onPick, onClose, returnFocusRef }) {
  const titleId = useId();
  const todayKey = dkey(new Date());
  const range = weekRangeLabel(monday, { withYear: true });
  const isThisWeek = dkey(mondayOf(new Date())) === dkey(monday);

  let body;
  if (!days && error) {
    body = (
      <div className="load-error" role="alert">
        <p>Hafta yüklenemedi: {error}</p>
        <button type="button" className="btn" onClick={onRetry}>Tekrar dene</button>
      </div>
    );
  } else if (!days) {
    body = (
      <div className="sheet-loading" role="status">
        <HoneycombSpinner size={64} />
        <span>Yükleniyor, lütfen bekleyiniz…</span>
      </div>
    );
  } else {
    const totals = weekTotals(days);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const cols = WEEKDAYS.map((_, i) => weekColumn(daySummary(days.find(d => d.date === dkey(addDays(monday, i)))).events));
    const longest = longestGaps(cols, WEEKDAYS);
    body = (
      <>
        <div className="wg">
          <div className="wg-axis" aria-hidden="true" style={{ marginTop: 60, height: WG_HEIGHT }}>
            {AXIS.map(h => <span key={h} style={{ top: (h * 60 - WS) * WG_PX }}>{String(h).padStart(2, '0')}</span>)}
          </div>
          {cols.map((col, i) => {
            const date = addDays(monday, i);
            const key = dkey(date);
            const today = key === todayKey;
            const head = `${WEEKDAYS_FULL[i]} ${date.getDate()} ${MONTHS[date.getMonth()]}${today ? ', bugün' : ''}`;
            return (
              <button key={key} type="button" className={`wg-col${today ? ' today' : ''}`} aria-current={today ? 'date' : undefined}
                aria-label={weekColumnLabel(head, col)} onClick={() => onPick(date)}>
                <span className="wg-hd" aria-hidden="true"><span className="w">{WEEKDAYS[i]}</span><span className="n">{date.getDate()}</span></span>
                <span className="wg-un" aria-hidden="true">
                  {col.untimed.length > 0 && iconOf(col.untimed[0])}
                  {col.untimed.length > 1 && <i>+{col.untimed.length - 1}</i>}
                  {col.before.length > 0 && <i>▲</i>}
                </span>
                <span className="wg-tr" style={{ height: WG_HEIGHT }} aria-hidden="true">
                  {GRID_LINES.map(h => <span key={h} className="wg-gl" style={{ top: (h * 60 - WS) * WG_PX }} />)}
                  {col.blocks.map(({ r, lane, n, top, height }) => (
                    <i key={r.ev.id} className={`wg-b ${kindClass(r.ev)}${r.noEnd ? ' noend' : ''}${r.cutBot ? ' cut-bot' : ''}${r.cutTop ? ' cut-top' : ''}`}
                      style={{ top: Math.round(top) + 1, height: Math.round(height) - 2, left: `calc(2px + ${lane} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n} - ${n > 1 ? 1 : 0}px)` }}>
                      {n === 1 && height >= 20 && <span className="ic">{iconOf(r.ev)}</span>}
                      {n === 1 && height >= 40 && <span className="t">{r.start.endsWith(':00') ? r.start.slice(0, 2) : r.start}</span>}
                    </i>
                  ))}
                  {today && nowMin >= WS && nowMin < WE && <span className="wg-now" style={{ top: Math.round((nowMin - WS) * WG_PX) }} />}
                </span>
                <span className="wg-un bot" aria-hidden="true">
                  {col.night && <i>↷</i>}
                  {col.after.length > 0 && <i>▼</i>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="wg-foot">
          Bir güne dokun: o gün açılır.<br />
          {longest
            ? <><b>En uzun boşluk:</b> <span className="mono">{longest.map((t, i) => <span key={t} className="nw">{i > 0 && ' · '}{t}</span>)}</span></>
            : <>Bu hafta saatli aktivite yok · <b>tüm hafta boş</b></>}
        </p>
        <div className="wg-leg">
          <span><i className="lg-sport" aria-hidden="true" />Spor</span>
          <span><i className="lg-evt" aria-hidden="true" />Aktivite</span>
          <span><i className="lg-free" aria-hidden="true" />Boş</span>
          <span><i className="lg-noend" aria-hidden="true" />Süre belirsiz</span>
          <span>Üst sıra: saati yok, ▲ 07:00 öncesi</span>
          <span>Alt sıra: ↷ ertesi güne geçer, ▼ 22:00 sonrası</span>
        </div>
        <p className="wsfoot">
          {totals.empty ? (isThisWeek ? 'Bu hafta henüz plan yok.' : 'Plan yok.')
            : `${isThisWeek ? 'Bu hafta' : 'Toplam'} ${totals.minutes} dk ders · ${totals.sportDays} gün spor · ${totals.events} aktivite`}
        </p>
      </>
    );
  }

  return (
    <Sheet className="weeksheet" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="sheet-head">
        <h3 id={titleId} tabIndex={-1}>{isThisWeek ? `Bu hafta · ${range}` : range}</h3>
        <button type="button" className="sheet-close" onClick={onClose}>Kapat</button>
      </div>
      <div className="sheet-body">{body}</div>
    </Sheet>
  );
}

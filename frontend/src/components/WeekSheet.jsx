import { useId } from 'react';
import Sheet from './Sheet';
import HoneycombSpinner from './HoneycombSpinner';
import { addDays, dkey, mondayOf, WEEKDAYS, WEEKDAYS_FULL, weekRangeLabel } from '../utils/format';
import { daySummary, eventLabel, kindInfo, weekTotals } from '../utils/events';

const NBSP = '\u00a0';

// "📅 Hafta" alt sayfası: haftanın 7 günü salt okunur özetle. Satıra dokununca o gün seçilir (onPick) ve panel kapanır.
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
    body = (
      <>
        {WEEKDAYS.map((wd, i) => {
          const date = addDays(monday, i);
          const key = dkey(date);
          const s = daySummary(days.find(d => d.date === key));
          const today = key === todayKey;
          return (
            <button key={key} type="button" className={`wsrow${today ? ' today' : ''}`}
              aria-current={today ? 'date' : undefined} onClick={() => onPick(date)}>
              <span className="d">
                <span className="w" aria-hidden="true">{wd}</span>
                <span className="sr-only">{WEEKDAYS_FULL[i]} </span>
                <span className="n">{date.getDate()}</span>
                <span className="sr-only">, </span>
              </span>
              <span className="sm">
                <b>{today ? 'Bugün · ' : ''}{s.total > 0 ? `${s.done}/${s.total} ders · ${s.minutes} dk` : 'Ders yok'}</b>
                <span className="evs">
                  {/* İkon ile ad, ad ile saat ve "·" ile önceki öğe NBSP ile bağlı: satır sonunda yalnız ikon ya da
                      satır başında "· ✦" kalmaz; satır yalnızca "·" sonrasında ya da adın kendi boşluklarında kırılır. */}
                  {s.events.length === 0 ? 'Aktivite yok' : s.events.map((ev, j) => (
                    <span key={ev.id}>
                      {j > 0 && `${NBSP}· `}
                      <span aria-hidden="true">{kindInfo(ev.kind).icon}{NBSP}</span>{eventLabel(ev)}
                      {ev.time && <>{NBSP}<span className="t">{ev.time}</span></>}
                    </span>
                  ))}
                </span>
              </span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          );
        })}
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

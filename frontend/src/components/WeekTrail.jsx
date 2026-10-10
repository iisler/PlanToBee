import { addDays, dkey, MONTHS, WEEKDAYS, WEEKDAYS_FULL, withPossessive } from '../utils/format';
import { daySummary, eventWithTime, kindInfo } from '../utils/events';

// Ekran okuyucu adı: "Cumartesi 10 Ekim, bugün: 3 dersten 1'i tamam; Yüzme 10:00, Okul konseri 15:00",
// "Cuma 9 Ekim: plan yok". Veri yoksa (yükleniyor / hata) yalnızca tarih.
function cellLabel(date, isToday, s) {
  const head = `${WEEKDAYS_FULL[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTHS[date.getMonth()]}${isToday ? ', bugün' : ''}`;
  if (!s) return head;
  if (s.total === 0 && s.events.length === 0) return `${head}: plan yok`;
  const study = s.total > 0 ? `${s.total} dersten ${withPossessive(s.done)} tamam` : 'ders yok';
  const events = s.events.map(eventWithTime).join(', ');
  return `${head}: ${study}${events ? `; ${events}` : ''}`;
}

// Hafta şeridi: 7 gün hücresi. Hücrede gün kısaltması, numara, ders sayacı ("2/3", ders yoksa "–") ve
// aktivite ikonları (en çok 2; fazlası ikonların altında "+N").
// days: seçili haftanın 7 DayDto'su (GET /days/week/{pzt}/details); yükleniyor ya da hata ise null:
// hücreler gün adı ve numarasıyla çizilir, sayaç ve ikon yerleri boş kalır.
export default function WeekTrail({ monday, currentDate, setCurrentDate, days }) {
  const selectedKey = dkey(currentDate);
  const todayKey = dkey(new Date());

  return (
    <div className="trail">
      {WEEKDAYS.map((wd, i) => {
        const date = addDays(monday, i);
        const key = dkey(date);
        const s = days ? daySummary(days.find(d => d.date === key)) : null;
        const isSelected = selectedKey === key;
        const isToday = todayKey === key;
        const evs = s?.events ?? [];
        const shown = evs.slice(0, 2);

        return (
          <button
            key={key}
            type="button"
            className={`trail-dot${isSelected ? ' selected' : ''}${isToday ? ' istoday' : ''}`}
            aria-pressed={isSelected}
            aria-current={isToday ? 'date' : undefined}
            aria-label={cellLabel(date, isToday, s)}
            onClick={() => setCurrentDate(new Date(date))}
          >
            <span className="wk" aria-hidden="true">{wd}</span>
            <span className="num" aria-hidden="true">{date.getDate()}</span>
            <span className={`cnt${s && s.total > 0 && s.done === s.total ? ' full' : ''}`} aria-hidden="true">
              {s ? (s.total > 0 ? `${s.done}/${s.total}` : '–') : ''}
            </span>
            <span className={`ics${evs.length ? ' on' : ''}`} aria-hidden="true">
              {shown.map(ev => <span key={ev.id} className="e">{kindInfo(ev.kind).icon}</span>)}
            </span>
            {/* 2 ikon + "+N" yan yana dar ekranda (360 px) hücreye sığmaz; "+N" ikonların altında durur */}
            {evs.length > 2 && <span className="more" aria-hidden="true">+{evs.length - 2}</span>}
          </button>
        );
      })}
    </div>
  );
}

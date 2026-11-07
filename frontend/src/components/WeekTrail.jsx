import { addDays, dkey, MONTHS, WEEKDAYS, WEEKDAYS_FULL, withPossessive } from '../utils/format';
import { daySummary, eventWithTime } from '../utils/events';
import { itemKey, kindClass } from '../utils/timeline';
import { holidayAria, holidayTone } from '../utils/holidays';

// Ekran okuyucu adı: "Cumartesi 10 Ekim, bugün: 3 dersten 1'i tamam; Yüzme 10:00, Okul konseri 15:00",
// "Cuma 9 Ekim: plan yok". Veri yoksa (yükleniyor / hata) yalnızca tarih.
function cellLabel(date, isToday, s, day) {
  const hol = holidayAria(day);
  const head = `${WEEKDAYS_FULL[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTHS[date.getMonth()]}${isToday ? ', bugün' : ''}${hol ? `, ${hol}` : ''}`;
  if (!s) return head;
  if (s.total === 0 && s.events.length === 0) return `${head}: plan yok`;
  const study = s.total > 0 ? `${s.total} dersten ${withPossessive(s.done)} tamam` : 'ders yok';
  const events = s.events.map(eventWithTime).join(', ');
  return `${head}: ${study}${events ? `; ${events}` : ''}`;
}

const MAX_DOTS = 4;

// Haftanın peteği (Görev 16): 7 gün hücresi. Hücrede petek (o günün dersleri tamamlandıkça alttan bal rengiyle dolar,
// içinde gün numarası), gün kısaltması, ders sayacı ("2/3", ders yoksa "–") ve aktivite noktaları (en çok 4; spor
// yeşil, diğerleri mercan; tam liste hücrenin erişilebilir adında). Seçili gün koyu çerçeveli. Altta haftanın özeti.
// days: seçili haftanın 7 DayDto'su (GET /days/week/{pzt}/details); yükleniyor ya da hata ise null:
// hücreler gün adı ve numarasıyla çizilir, sayaç ve nokta yerleri boş kalır, özet satırı görünmez.
export default function WeekTrail({ monday, currentDate, setCurrentDate, days }) {
  const selectedKey = dkey(currentDate);
  const todayKey = dkey(new Date());
  const tot = (days ?? []).map(daySummary).reduce((a, s) => ({
    done: a.done + s.done,
    total: a.total + s.total,
    full: a.full + (s.total > 0 && s.done === s.total ? 1 : 0),
  }), { done: 0, total: 0, full: 0 });

  return (
    <>
      <div className="trail">
        {WEEKDAYS.map((wd, i) => {
          const date = addDays(monday, i);
          const key = dkey(date);
          const day = days?.find(d => d.date === key);
          const s = days ? daySummary(day) : null;
          const tone = holidayTone(day);
          const isSelected = selectedKey === key;
          const isToday = todayKey === key;
          const evs = s?.events ?? [];
          const pct = s && s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
          const empty = s && s.total === 0 && evs.length === 0;

          return (
            <button
              key={key}
              type="button"
              className={`trail-dot${isSelected ? ' selected' : ''}${isToday ? ' istoday' : ''}${empty ? ' empty' : ''}`}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={cellLabel(date, isToday, s, day)}
              onClick={() => setCurrentDate(new Date(date))}
            >
              {tone && <span className={`hdot ${tone}`} aria-hidden="true" />}
              <span className="hex" aria-hidden="true">
                <span className="hex-in">
                  {pct > 0 && <span className="hex-fill" style={{ height: `${pct}%` }} />}
                  <span className="num">{date.getDate()}</span>
                </span>
              </span>
              <span className="wk" aria-hidden="true">{wd}</span>
              <span className={`cnt${s && s.total > 0 && s.done === s.total ? ' full' : ''}`} aria-hidden="true">
                {s ? (s.total > 0 ? `${s.done}/${s.total}` : '–') : ''}
              </span>
              <span className="dots" aria-hidden="true">
                {evs.slice(0, MAX_DOTS).map(ev => <i key={itemKey(ev)} className={kindClass(ev)} />)}
              </span>
            </button>
          );
        })}
      </div>
      {days && tot.total > 0 && (
        <div className="trail-foot">
          <span className="tf-a"><i aria-hidden="true" />{tot.done}/{tot.total} ders tamam</span>
          <span className="tf-b">{tot.full > 0 ? `${tot.full} gün tam petek` : 'Henüz tam petek yok'}</span>
        </div>
      )}
    </>
  );
}

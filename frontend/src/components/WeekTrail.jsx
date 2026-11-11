import { addDays, dkey, MONTHS, WEEKDAYS, WEEKDAYS_FULL, withPossessive } from '../utils/format';
import { daySummary, eventWithTime } from '../utils/events';
import { flowClass, itemKey } from '../utils/timeline';
import { holidayAria, holidayTone } from '../utils/holidays';
import { ChevNext, ChevPrev } from './Icons';

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

const MAX_DOTS = 3;

// Haftanın peteği (Görev 16; Görev 17'de inceltildi): iki yanında hafta okları, ortada 7 gün hücresi. Hücrede gün
// kısaltması, petek (o günün dersleri tamamlandıkça alttan bal rengiyle dolar; içinde gün numarası) ve aktivite
// noktaları (en çok 3; spor yeşil, diğerleri mercan; Okul nokta üretmez). Sayaç ve hafta özeti Hafta sayfasındadır;
// tam bilgi hücrenin erişilebilir adında. Seçili gün koyu çerçeveli.
// days: seçili haftanın 7 DayDto'su; yükleniyor ya da hata ise null (hücreler yalnızca gün adı ve numarasıyla çizilir).
// onStepWeek(-1 | +1): önceki / sonraki hafta.
export default function WeekTrail({ monday, currentDate, setCurrentDate, days, onStepWeek }) {
  const selectedKey = dkey(currentDate);
  const todayKey = dkey(new Date());

  return (
    <nav className="trail" aria-label="Hafta">
      <button type="button" className="trail-nav" aria-label="Önceki hafta" onClick={() => onStepWeek(-1)}><ChevPrev /></button>
      {WEEKDAYS.map((wd, i) => {
        const date = addDays(monday, i);
        const key = dkey(date);
        const day = days?.find(d => d.date === key);
        const s = days ? daySummary(day) : null;
        const tone = holidayTone(day);
        const isSelected = selectedKey === key;
        const isToday = todayKey === key;
        const dots = (s?.events ?? []).filter(ev => ev.kind !== 'School');
        const pct = s && s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
        const empty = s && s.total === 0 && s.events.length === 0;

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
            <span className="wk" aria-hidden="true">{wd}</span>
            <span className="hex" aria-hidden="true">
              <span className="hex-in">
                {pct > 0 && <span className="hex-fill" style={{ height: `${pct}%` }} />}
                <span className="num">{date.getDate()}</span>
              </span>
            </span>
            <span className="dots" aria-hidden="true">
              {dots.slice(0, MAX_DOTS).map(ev => <i key={itemKey(ev)} className={flowClass(ev)} />)}
            </span>
          </button>
        );
      })}
      <button type="button" className="trail-nav" aria-label="Sonraki hafta" onClick={() => onStepWeek(1)}><ChevNext /></button>
    </nav>
  );
}

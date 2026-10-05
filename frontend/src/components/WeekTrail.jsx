import { WEEKDAYS_FULL } from '../utils/format';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function mondayOf(d) {
  const nd = new Date(d);
  const dow = (nd.getDay() + 6) % 7;
  nd.setDate(nd.getDate() - dow);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function dkey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeekTrail({ currentDate, setCurrentDate, weekSummaries }) {
  const mon = mondayOf(currentDate);

  return (
    <div className="trail">
      {WEEKDAYS.map((wd, i) => {
        const date = new Date(mon);
        date.setDate(mon.getDate() + i);
        const key = dkey(date);
        const s = weekSummaries?.find(x => x.date === key);
        const hasStudy = s?.studyMinutes > 0;
        const hasSport = s?.trainingDone;
        const hasEvt = s?.eventCount > 0;
        const isSelected = dkey(currentDate) === key;
        const isToday = dkey(new Date()) === key;

        return (
          <button
            key={i}
            className={`trail-dot${isSelected ? ' selected' : ''}${isToday ? ' istoday' : ''}`}
            aria-pressed={isSelected}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${WEEKDAYS_FULL[i]} ${date.getDate()}${[hasStudy && 'ders', hasSport && 'spor', hasEvt && 'aktivite'].filter(Boolean).map(x => `, ${x} var`).join('')}`}
            onClick={() => setCurrentDate(new Date(date))}
          >
            <span className="wk">{wd}</span>
            <span className="num">{date.getDate()}</span>
            <span className="pips" aria-hidden="true">
              <span className={`pip${hasStudy ? ' study' : ''}`} />
              <span className={`pip${hasSport ? ' sport' : ''}`} />
              <span className={`pip${hasEvt ? ' evt' : ''}`} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

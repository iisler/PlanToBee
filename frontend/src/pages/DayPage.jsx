import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import useMutation from '../hooks/useMutation';
import WeekTrail from '../components/WeekTrail';
import StatsBar from '../components/StatsBar';
import StudyCard from '../components/StudyCard';
import TrainingCard from '../components/TrainingCard';
import EventCard from '../components/EventCard';
import { addDays, dkey, MONTHS, WEEKDAYS_FULL } from '../utils/format';
import Loading from '../components/Loading';

// Ailenin ortak planında tek bir gün. myId: giriş yapan üyenin kimliği (kayıt izleri için).
export default function DayPage({
  currentDate, setCurrentDate, weekSummaries, myId,
  subjects, onAddSubject, onDeleteSubject, onDataChanged, onAccessChanged,
}) {
  const [day, setDay] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const date = dkey(currentDate);
  const isToday = dkey(new Date()) === date;

  useEffect(() => {
    let active = true;
    client.get(`/days/${date}`)
      .then(r => { if (active) { setDay(r.data); setLoadError(''); } })
      .catch(err => { if (active) setLoadError(errorText(err)); });
    return () => { active = false; };
  }, [date, retry]);

  const reload = useCallback(async () => {
    try {
      const r = await client.get(`/days/${date}`);
      setDay(r.data);
    } finally {
      onDataChanged();
    }
  }, [date, onDataChanged]);

  const mutate = useMutation({ state: day, setState: setDay, reload, onAccessChanged });

  // Gün değişirken önceki günün verisi gösterilmesin
  const ready = day && day.date === date;

  if (loadError && !ready) return (
    <div className="load-error" role="alert">
      <p>Gün yüklenemedi: {loadError}</p>
      <button className="btn" onClick={() => { setLoadError(''); setRetry(n => n + 1); }}>Tekrar dene</button>
    </div>
  );

  const totalStudy = ready ? day.studyEntries.reduce((s, e) => s + e.minutes, 0) : 0;
  const totalTrain = ready ? day.trainingEntries.reduce((s, e) => s + e.minutes, 0) : 0;
  const common = { date, myId, mutate };

  return (
    <>
      <section className="dayhero">
        <div className="datenav">
          <button aria-label="Önceki gün" onClick={() => setCurrentDate(d => addDays(d, -1))}>‹</button>
          <div className="label">
            <div className="day">{WEEKDAYS_FULL[(currentDate.getDay() + 6) % 7]}</div>
            <div className="sub">{currentDate.getDate()} {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}{isToday && <span className="today">bugün</span>}</div>
          </div>
          <button aria-label="Sonraki gün" onClick={() => setCurrentDate(d => addDays(d, 1))}>›</button>
        </div>

        <WeekTrail currentDate={currentDate} setCurrentDate={setCurrentDate} weekSummaries={weekSummaries} />
        <StatsBar weekSummaries={weekSummaries} />
      </section>

      {!ready ? <Loading /> : (
        <>
          <StudyCard {...common} entries={day.studyEntries} totalMinutes={totalStudy}
            subjects={subjects} onAddSubject={onAddSubject} onDeleteSubject={onDeleteSubject} />
          <TrainingCard {...common} entries={day.trainingEntries} totalMinutes={totalTrain} />
          <EventCard {...common} events={day.events} />
        </>
      )}

      <div className="note">
        "Hafta Planı" sekmesinden gelecek günler için önceden ders/antrenman/etkinlik girebilirsiniz.
      </div>
    </>
  );
}

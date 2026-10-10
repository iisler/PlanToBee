import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import useMutation from '../hooks/useMutation';
import WeekTrail from '../components/WeekTrail';
import WeekSheet from '../components/WeekSheet';
import StudyCard from '../components/StudyCard';
import EventCard from '../components/EventCard';
import { addDays, dayTitle, dkey, mondayOf, MONTHS, WEEKDAYS_FULL, weekRangeLabel } from '../utils/format';
import Loading from '../components/Loading';

const EMPTY_ADD_FORM = { open: false, subject: '', topic: '', minutes: '', subjectsOpen: false };

// Tek ekran plan: üstte siyah hafta alanı (aralık, ‹ › hafta okları, "📅 Hafta" paneli, şerit), altında seçili günün
// Çalışma Planı ve Aktiviteleri. Ailenin ortak planıdır; myId: giriş yapan üyenin kimliği (kayıt izleri için).
// weekDays: seçili haftanın 7 DayDto'su (yükleniyor/hata ise null), weekError: hafta ayrıntısı hata metni.
// layerReset değişince (bildirimden gün açıldı) açık Hafta paneli ve ⋯ menüleri kapanır.
export default function DayPage({
  currentDate, setCurrentDate, weekDays, weekError, onRetryWeek, onDayChanged, myId,
  subjects, onAddSubject, onDeleteSubject, onDataChanged, onAccessChanged, layerReset,
}) {
  const [day, setDay] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  // Hafta paneli, açıldığı andaki layerReset değeriyle tutulur (bildirimden gün açılınca kendiliğinden kapanır)
  const [weekOpenAt, setWeekOpenAt] = useState(null);
  const weekOpen = weekOpenAt === layerReset;
  const setWeekOpen = (open) => setWeekOpenAt(open ? layerReset : null);
  // "+ Ders ekle" formu gün değişince de açık kalır (D1): durumu burada tutulur
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const headingRef = useRef(null);
  const weekBtnRef = useRef(null);
  const focusHeading = useRef(false);
  const date = dkey(currentDate);
  const today = new Date();
  const isToday = dkey(today) === date;
  const monday = mondayOf(currentDate);
  const isThisWeek = dkey(mondayOf(today)) === dkey(monday);

  // Geç gelen yanıtlar yalnızca hâlâ seçili güne aitse yazılır
  const dateRef = useRef(date);
  useEffect(() => { dateRef.current = date; });

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
      if (dateRef.current === date) setDay(r.data);
    } finally {
      onDataChanged();
    }
  }, [date, onDataChanged]);

  // Gösterilen gün: sunucudan gelen gün verisi; henüz gelmediyse haftalık veride aynı gün (aynı DayDto biçimi).
  // Böylece aynı haftada gün değiştirmek beklemeden açılır, kartlar (ve açık ekleme formu) yerinde kalır.
  const shown = day && day.date === date ? day : weekDays?.find(d => d.date === date) ?? null;
  // İyimser değişiklik ve geri alma hem gün verisine hem haftalık veriye (şerit, panel) yazılır
  const setShown = useCallback((d) => {
    setDay(d);
    if (d) onDayChanged(d);
  }, [onDayChanged]);
  const mutate = useMutation({ state: shown, setState: setShown, reload, onAccessChanged });

  // Bildirimden gün açılınca (layerReset arttı) açık katman kapanır ve odak gün başlığına gider.
  // (Sheet'in "odak açan düğmeye döner" temizliği bu etkiden önce çalışır.)
  const lastReset = useRef(layerReset);
  useEffect(() => {
    if (lastReset.current === layerReset) return;
    lastReset.current = layerReset;
    headingRef.current?.focus({ preventScroll: true });
  }, [layerReset]);

  // Hafta panelinde güne dokununca: panel kapanır, sayfa en üste kayar ve odak gün başlığına gider.
  // (Sheet'in "odak açan düğmeye döner" temizliği bu etkiden önce çalışır.)
  useEffect(() => {
    if (!weekOpen && focusHeading.current) {
      focusHeading.current = false;
      window.scrollTo(0, 0);
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [weekOpen]);

  function pickFromSheet(d) {
    focusHeading.current = true;
    setCurrentDate(new Date(d));
    setWeekOpen(false);
  }

  function goToday() {
    setCurrentDate(new Date());
    // Düğme bu haftada gizlendiği için odak gün başlığına taşınır
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  const ready = !!shown;
  const range = weekRangeLabel(monday);

  // Hafta aralığı başlık satırına sığmazsa (360 px'te "24 – 30 Ağustos") yazı 0,5 px adımlarla en çok 13 px'e küçülür;
  // düğmeler küçülmez. (React Native'de Text adjustsFontSizeToFit karşılığı.)
  const rangeRef = useRef(null);
  useLayoutEffect(() => {
    const el = rangeRef.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > 13) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) fit(); });
    window.addEventListener('resize', fit);
    return () => { alive = false; window.removeEventListener('resize', fit); };
  }, [range]);
  const dateLabel = `${WEEKDAYS_FULL[(currentDate.getDay() + 6) % 7]} ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]}`;
  const common = { date, myId, mutate, menuReset: layerReset };

  return (
    <>
      <section className="dayhero">
        <div className="weekhead">
          <div className="range" ref={rangeRef} aria-live="polite">{range}</div>
          <button type="button" className="navbtn" aria-label="Önceki hafta" onClick={() => setCurrentDate(d => addDays(d, -7))}>‹</button>
          <button type="button" className="navbtn" aria-label="Sonraki hafta" onClick={() => setCurrentDate(d => addDays(d, 7))}>›</button>
          <button type="button" ref={weekBtnRef} className="weekbtn" aria-haspopup="dialog" aria-label="Haftanın tamamını gör"
            onClick={() => setWeekOpen(true)}><span aria-hidden="true">📅</span>Hafta</button>
        </div>

        <WeekTrail monday={monday} currentDate={currentDate} setCurrentDate={setCurrentDate} days={weekDays} />
        {!isThisWeek && <button type="button" className="today-btn" onClick={goToday}>Bugüne dön</button>}
      </section>

      <h2 className="dayhead" ref={headingRef} tabIndex={-1}>
        {dayTitle(currentDate, today)}{isToday && <span className="today-pill">bugün</span>}
      </h2>

      {loadError && !ready ? (
        <div className="load-error" role="alert">
          <p>Gün yüklenemedi: {loadError}</p>
          <button className="btn" onClick={() => { setLoadError(''); setRetry(n => n + 1); }}>Tekrar dene</button>
        </div>
      ) : !ready ? (
        // Hafta paneli açıkken tam ekran yükleniyor katmanı panelin üstünü kapatmasın
        weekOpen ? <div className="loading-placeholder" aria-hidden="true" /> : <Loading />
      ) : (
        <>
          <StudyCard {...common} dateLabel={dateLabel} entries={shown.studyEntries}
            subjects={subjects} onAddSubject={onAddSubject} onDeleteSubject={onDeleteSubject}
            addForm={addForm} setAddForm={setAddForm} />
          <EventCard {...common} events={shown.events} isToday={isToday} />
        </>
      )}

      {weekOpen && (
        <WeekSheet monday={monday} days={weekDays} error={weekError} onRetry={onRetryWeek}
          onPick={pickFromSheet} onClose={() => setWeekOpen(false)} returnFocusRef={weekBtnRef} />
      )}
    </>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import useMutation, { patchEntry, removeEntry } from '../hooks/useMutation';
import WeekTrail from '../components/WeekTrail';
import WeekSheet from '../components/WeekSheet';
import StudyCard from '../components/StudyCard';
import EventCard from '../components/EventCard';
import AgendaCard from '../components/AgendaCard';
import SectionTabs, { panelId, tabId } from '../components/SectionTabs';
import { addDays, dayTitle, dkey, mondayOf, MONTHS, nextStatus, STATUS_SHORT, WEEKDAYS_FULL, weekRangeLabel } from '../utils/format';
import { deletedText, eventLabel } from '../utils/events';
import { addMinutes, agendaItems, itemKey } from '../utils/timeline';
import { dayMonth, isOccurrence, isoDay } from '../utils/recurrence';
import { useNotice } from '../context/NoticeContext';
import { holidayLine, holidayTone } from '../utils/holidays';
import Loading from '../components/Loading';

// Aktivite listesinde anahtarla değiştirme / silme (tekrarlanan sanal kayıtların id'si 0'dır, Görev 11)
const mapEvents = (d, fn) => ({ ...d, events: d.events.map(fn) });
const patchItem = (d, ev, patch) => mapEvents(d, (e) => (itemKey(e) === itemKey(ev) ? { ...e, ...patch } : e));
const removeItem = (d, ev) => ({ ...d, events: d.events.filter((e) => itemKey(e) !== itemKey(ev)) });
const ofSeries = (e, id) => isOccurrence(e) && e.seriesId === id;
const patchSeries = (d, id, patch) => mapEvents(d, (e) => (ofSeries(e, id) ? { ...e, ...patch } : e));
const dropSeries = (d, id) => ({ ...d, events: d.events.filter((e) => !ofSeries(e, id)) });
// Silinen seriyi "Geri al": seri kısaltıldıysa eski kural geri yazılır (PUT), tamamen silindiyse yeniden oluşturulur (POST, yeni id)
function restoreSeries({ truncated, series: s }) {
  const rule = { title: s.title, time: s.time ?? '', endTime: s.endTime ?? '', note: s.note ?? '', daysOfWeek: s.daysOfWeek, untilDate: s.untilDate };
  return truncated ? client.put(`/series/${s.id}`, rule)
    : client.post('/series', { ...rule, kind: s.kind, startDate: s.startDate, exceptions: s.exceptions ?? [] });
}

const EMPTY_ADD_FORM = { open: false, subject: '', topic: '', minutes: '', startTime: '', subjectsOpen: false };

// Tek ekran plan: üstte siyah hafta alanı (top: logo ve ad menüsü; aralık, ‹ › hafta okları, "Hafta" paneli, şerit), altında bölüm seçici
// (Plan · To-do · Bee, Görev 10), gün başlığı ve seçili bölümün tek kartı: Bee = saat çizelgesi (dersler + aktiviteler),
// To-do = dersler, Plan = aktiviteler. section / setSection: seçili bölüm (PlanShell'de; açılışta Bee). Ailenin ortak planıdır; myId: giriş yapan üyenin kimliği (kayıt izleri için).
// weekDays: seçili haftanın 7 DayDto'su (yükleniyor/hata ise null), weekError: hafta ayrıntısı hata metni.
// layerReset değişince (bildirimden gün açıldı) açık Hafta paneli ve ⋯ menüleri kapanır.
// banner: bölüm seçicinin altında gösterilecek bant (bildirim izni); onAdded: ders ya da aktivite eklendi.
export default function DayPage({
  currentDate, setCurrentDate, weekDays, weekError, onRetryWeek, onDayChanged, myId,
  subjects, onAddSubject, onDeleteSubject, onDataChanged, onAccessChanged, layerReset, section, setSection,
  top, banner, onAdded,
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

  // Ders ve aktivite işlemleri tek yerde: Bee ve To-do aynı gün verisini (shown) değiştirir; durum iki bölümde senkron.
  // add() başarılıysa sunucunun döndürdüğü kaydı (odak için), aksi halde null döner.
  const [announce, setAnnounce] = useState('');
  const study = useMemo(() => ({
    cycle(entry) {
      const status = nextStatus(entry.status);
      setAnnounce(`${entry.subject}: ${STATUS_SHORT[status]}`);
      return mutate(d => patchEntry(d, 'studyEntries', entry.id, { status }),
        () => client.patch(`/days/${date}/entries/${entry.id}/status`, { status }));
    },
    async add(body) {
      let created = null;
      const ok = await mutate(null, async () => { created = (await client.post(`/days/${date}/entries`, body)).data; });
      if (ok) onAdded?.();
      return ok ? created ?? {} : null;
    },
    save(entry, body) {
      const st = body.startTime || null;
      const patch = { ...body, startTime: st, endTime: st ? addMinutes(st, body.minutes) : null };
      return mutate(d => patchEntry(d, 'studyEntries', entry.id, patch), () => client.put(`/days/${date}/entries/${entry.id}`, body));
    },
    remove(entry) {
      return mutate(d => removeEntry(d, 'studyEntries', entry.id), (cfg) => client.delete(`/days/${date}/entries/${entry.id}`, cfg),
        { undo: `${entry.subject} kaydı silindi` });
    },
  }), [date, mutate, onAdded]);
  const { notify } = useNotice();
  const events = useMemo(() => ({
    // body.repeat varsa (Görev 11) seri eklenir; dönüş, seri bu güne düşüyorsa bugünkü tekrarın anahtar alanları
    async add({ repeat, ...body }) {
      let created = null;
      const ok = await mutate(null, async () => {
        if (!repeat) { created = (await client.post(`/days/${date}/events`, body)).data; return; }
        const sr = (await client.post('/series', { ...body, ...repeat })).data;
        created = repeat.daysOfWeek.includes(isoDay(date)) ? { id: 0, seriesId: sr.id, occurrenceDate: date } : {};
      });
      if (ok) onAdded?.();
      return ok ? created ?? {} : null;
    },
    // scope: yok (tek aktivite) · 'one' (o günü seriden ayır) · 'all' (kuralı düzenle). Dönüş: kaydın itemKey'i ya da null.
    async save(ev, { repeat, ...body }, scope) {
      if (scope === 'one') {
        let created = null;
        const ok = await mutate(d => patchItem(d, ev, body), async () => {
          created = (await client.post(`/series/${ev.seriesId}/detach`, { date: ev.occurrenceDate, ...body })).data;
        });
        return ok ? (created?.id ? `e${created.id}` : itemKey(ev)) : null;
      }
      if (scope === 'all') {
        const rule = { ...body, daysOfWeek: repeat.daysOfWeek, untilDate: repeat.untilDate };
        const ok = await mutate(d => patchSeries(d, ev.seriesId, body), () => client.put(`/series/${ev.seriesId}`, rule));
        return ok ? itemKey(ev) : null;
      }
      const ok = await mutate(d => patchItem(d, ev, body), () => client.put(`/days/${date}/events/${ev.id}`, body));
      return ok ? itemKey(ev) : null;
    },
    // Tekrarlanan kayıtta yalnızca o gün atlanır (skip); istek, diğer silmeler gibi "Geri al" süresi kadar bekletilir.
    remove(ev) {
      if (isOccurrence(ev)) {
        return mutate(d => removeItem(d, ev), (cfg) => client.post(`/series/${ev.seriesId}/skip`, { date: ev.occurrenceDate }, cfg),
          { undo: `${dayMonth(ev.occurrenceDate)} silindi.` });
      }
      return mutate(d => removeItem(d, ev), (cfg) => client.delete(`/days/${date}/events/${ev.id}`, cfg),
        { undo: deletedText(ev) });
    },
    // Bugünden itibaren bütün tekrarlar silinir (geçmiş günler kalır); "Geri al" sunucudaki eski hâli geri yazar.
    removeSeries(ev) {
      const from = dkey(new Date());
      return mutate(d => (date >= from ? dropSeries(d, ev.seriesId) : d), async () => {
        const res = (await client.delete(`/series/${ev.seriesId}`, { params: { from } })).data;
        notify(`${eventLabel(ev)} tekrarları silindi.`, 'info', {
          duration: 6000,
          action: { label: 'Geri al', onClick: () => mutate(null, () => restoreSeries(res)) },
        });
      });
    },
  }), [date, mutate, notify, onAdded]);
  const items = useMemo(() => (shown ? agendaItems(shown.studyEntries, shown.events) : []), [shown]);

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
  const dayName = WEEKDAYS_FULL[(currentDate.getDay() + 6) % 7];
  const dateLabel = `${dayName} ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]}`;
  const common = { date, myId, menuReset: layerReset };
  const panel = { role: 'tabpanel', id: panelId(section), 'aria-labelledby': tabId(section), tabIndex: -1 };

  return (
    <>
      <section className="dayhero">
        {top}
        <div className="weekhead">
          <div className="range" ref={rangeRef} aria-live="polite">{range}</div>
          <button type="button" className="navbtn" aria-label="Önceki hafta" onClick={() => setCurrentDate(d => addDays(mondayOf(d), -7))}>‹</button>
          <button type="button" className="navbtn" aria-label="Sonraki hafta" onClick={() => setCurrentDate(d => addDays(mondayOf(d), 7))}>›</button>
          <button type="button" ref={weekBtnRef} className="weekbtn" aria-haspopup="dialog" aria-label="Hafta: haftanın tamamını gör"
            onClick={() => setWeekOpen(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>Hafta
          </button>
        </div>

        <WeekTrail monday={monday} currentDate={currentDate} setCurrentDate={setCurrentDate} days={weekDays} />
        {!isThisWeek && <button type="button" className="today-btn" onClick={goToday}>Bugüne dön</button>}
      </section>

      <SectionTabs value={section} onChange={setSection} />
      {banner}

      <h2 className="dayhead" ref={headingRef} tabIndex={-1}>
        {dayTitle(currentDate, today)}{isToday && <span className="today-pill">bugün</span>}
      </h2>

      {section === 'bee' && holidayLine(shown) && (
        <p className={`holstrip ${holidayTone(shown)}`}>{holidayLine(shown)}</p>
      )}

      {loadError && !ready ? (
        <div className="load-error" role="alert">
          <p>Gün yüklenemedi: {loadError}</p>
          <button className="btn" onClick={() => { setLoadError(''); setRetry(n => n + 1); }}>Tekrar dene</button>
        </div>
      ) : !ready ? (
        // Hafta paneli açıkken tam ekran yükleniyor katmanı panelin üstünü kapatmasın
        weekOpen ? <div className="loading-placeholder" aria-hidden="true" /> : <Loading />
      ) : (
        section === 'todo' ? (
          <StudyCard {...common} panel={panel} dateLabel={dateLabel} entries={shown.studyEntries} items={items} actions={study}
            subjects={subjects} onAddSubject={onAddSubject} onDeleteSubject={onDeleteSubject}
            addForm={addForm} setAddForm={setAddForm} />
        ) : section === 'plan' ? (
          <EventCard {...common} panel={panel} events={shown.events} items={items} actions={events} isToday={isToday} />
        ) : (
          <AgendaCard {...common} panel={panel} items={items} isToday={isToday} dateLabel={dateLabel}
            subjects={subjects} study={study} events={events} />
        )
      )}
      <span className="sr-only" aria-live="polite">{announce}</span>

      {weekOpen && (
        <WeekSheet monday={monday} days={weekDays} error={weekError} onRetry={onRetryWeek}
          onPick={pickFromSheet} onClose={() => setWeekOpen(false)} returnFocusRef={weekBtnRef} />
      )}
    </>
  );
}

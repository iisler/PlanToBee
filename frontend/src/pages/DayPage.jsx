import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import useMutation, { patchEntry, removeEntry } from '../hooks/useMutation';
import WeekTrail from '../components/WeekTrail';
import NowCard from '../components/NowCard';
import DayFlow from '../components/DayFlow';
import Loading from '../components/Loading';
import { addDays, dayTitle, dkey, mondayOf, MONTHS, STATUS_SHORT, WEEKDAYS_FULL } from '../utils/format';
import { deletedText, eventLabel } from '../utils/events';
import { addMinutes, agendaItems, itemKey } from '../utils/timeline';
import { dayMonth, isOccurrence } from '../utils/recurrence';
import { useNotice } from '../context/NoticeContext';
import { holidayLine, holidayTone } from '../utils/holidays';

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

// Seçili günün bugüne göre yeri (başlığın üstündeki küçük satır)
function relativeDay(date, today) {
  const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  return diff > 0 ? `${diff} gün sonra` : `${-diff} gün önce`;
}

// Bugün ekranı (Görev 17 "Akış"): üstte gün başlığı (sağında sesle ekleme ve profil düğmesi), haftanın peteği, Şimdi kartı
// (components/NowCard.jsx) ve günün akışı (components/DayFlow.jsx: süzgeç çipleri, saatsiz kayıtlar, sıralı liste).
// Ekleme alt menüdeki + ile açılan Ekle sayfasındadır (PlanShell); burada yalnızca durum, düzenleme ve silme var.
// Ailenin ortak planıdır; myId: giriş yapan üyenin kimliği (kayıt izleri için).
// weekDays: seçili haftanın 7 DayDto'su (yükleniyor/hata ise null). refreshKey artınca gün sunucudan yeniden okunur
// (Ekle sayfasından ya da Dersler sayfasından değişiklik). layerReset değişince (bildirimden gün açıldı) açık ⋯ menüleri kapanır.
// banner: peteğin altında gösterilecek bant (bildirim izni).
// onOpenAdd('study' | 'event'): Ekle sayfasını bu gün için açar. avatar: profil düğmesi.
export default function DayPage({
  currentDate, setCurrentDate, weekDays, onDayChanged, myId, subjects, onDataChanged, onAccessChanged, layerReset,
  refreshKey, banner, onOpenAdd, avatar,
}) {
  const [day, setDay] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const headingRef = useRef(null);
  const date = dkey(currentDate);
  const today = new Date();
  const isToday = dkey(today) === date;
  const monday = mondayOf(currentDate);

  // Geç gelen yanıtlar yalnızca hâlâ seçili güne aitse yazılır
  const dateRef = useRef(date);
  useEffect(() => { dateRef.current = date; });

  useEffect(() => {
    let active = true;
    client.get(`/days/${date}`)
      .then(r => { if (active) { setDay(r.data); setLoadError(''); } })
      .catch(err => { if (active) setLoadError(errorText(err)); });
    return () => { active = false; };
  }, [date, retry, refreshKey]);

  const reload = useCallback(async () => {
    try {
      const r = await client.get(`/days/${date}`);
      if (dateRef.current === date) setDay(r.data);
    } finally {
      onDataChanged();
    }
  }, [date, onDataChanged]);

  // Gösterilen gün: sunucudan gelen gün verisi; henüz gelmediyse haftalık veride aynı gün (aynı DayDto biçimi).
  // Böylece aynı haftada gün değiştirmek beklemeden açılır.
  const shown = day && day.date === date ? day : weekDays?.find(d => d.date === date) ?? null;
  // İyimser değişiklik ve geri alma hem gün verisine hem haftalık veriye (petek, Hafta, Dersler) yazılır
  const setShown = useCallback((d) => {
    setDay(d);
    if (d) onDayChanged(d);
  }, [onDayChanged]);
  const mutate = useMutation({ state: shown, setState: setShown, reload, onAccessChanged });

  // Ders ve aktivite işlemleri tek yerde: Şimdi kartı ve akış listesi aynı gün verisini (shown) değiştirir.
  const [announce, setAnnounce] = useState('');
  const study = useMemo(() => ({
    setStatus(entry, status) {
      setAnnounce(`${entry.subject}: ${STATUS_SHORT[status]}`);
      return mutate(d => patchEntry(d, 'studyEntries', entry.id, { status }),
        () => client.patch(`/days/${date}/entries/${entry.id}/status`, { status }));
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
  }), [date, mutate]);
  const { notify } = useNotice();
  const events = useMemo(() => ({
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
  }), [date, mutate, notify]);
  const items = useMemo(() => (shown ? agendaItems(shown.studyEntries, shown.events) : []), [shown]);

  // Bildirimden gün açılınca (layerReset arttı) odak gün başlığına gider.
  const lastReset = useRef(layerReset);
  useEffect(() => {
    if (lastReset.current === layerReset) return;
    lastReset.current = layerReset;
    headingRef.current?.focus({ preventScroll: true });
  }, [layerReset]);

  function goToday() {
    setCurrentDate(new Date());
    // Düğme bugünde gizlendiği için odak gün başlığına taşınır
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  const dayName = WEEKDAYS_FULL[(currentDate.getDay() + 6) % 7];
  const dateLabel = `${dayName} ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]}`;
  const ready = !!shown;

  return (
    <>
      <div className="dayhead-row">
        <div className="pg-title">
          <span className="pg-over">{relativeDay(currentDate, today)}</span>
          <h1 className="dayhead" ref={headingRef} tabIndex={-1}>{dayTitle(currentDate, today)}</h1>
        </div>
        {avatar}
      </div>

      <WeekTrail monday={monday} currentDate={currentDate} setCurrentDate={setCurrentDate} days={weekDays}
        onStepWeek={(n) => setCurrentDate(d => addDays(mondayOf(d), 7 * n))} />
      {!isToday && <button type="button" className="today-btn" onClick={goToday}>Bugüne dön</button>}

      {banner}
      {holidayLine(shown) && <p className={`holstrip ${holidayTone(shown)}`}>{holidayLine(shown)}</p>}

      {loadError && !ready ? (
        <div className="load-error" role="alert">
          <p>Gün yüklenemedi: {loadError}</p>
          <button className="btn" onClick={() => { setLoadError(''); setRetry(n => n + 1); }}>Tekrar dene</button>
        </div>
      ) : !ready ? <Loading /> : (
        <>
          <NowCard entries={shown.studyEntries} items={items} isToday={isToday} onStatus={study.setStatus} onAdd={onOpenAdd} />
          <DayFlow date={date} items={items} isToday={isToday} myId={myId} menuReset={layerReset} subjects={subjects}
            study={study} events={events} dateLabel={dateLabel} onStep={(n) => setCurrentDate(d => addDays(d, n))} />
        </>
      )}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </>
  );
}

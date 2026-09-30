import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import useMutation from '../hooks/useMutation';
import StatsBar from '../components/StatsBar';
import AuditTag from '../components/AuditTag';
import ReadOnlyMark from '../components/ReadOnlyMark';
import { addDays, dkey, formatDuration, mondayOf, MONTHS, nextStatus, STATUS_SHORT, WEEKDAYS, WEEKDAYS_FULL } from '../utils/format';
import Loading from '../components/Loading';

function readPref(k, def) { try { return localStorage.getItem(k) || def; } catch { return def; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* yoksay */ } }

// weekDays: [{ key, data: DayDto }]; iyimser güncellemeler için yardımcılar
function patchWeek(weekDays, key, listKey, id, patch) {
  return weekDays.map(w => w.key !== key ? w : {
    ...w, data: { ...w.data, [listKey]: w.data[listKey].map(e => e.id === id ? { ...e, ...patch } : e) },
  });
}
function removeFromWeek(weekDays, key, listKey, id) {
  return weekDays.map(w => w.key !== key ? w : {
    ...w, data: { ...w.data, [listKey]: w.data[listKey].filter(e => e.id !== id) },
  });
}
// Silme düğmesinin ekran okuyucu etiketi için kaydın kısa adı
function chipName(e) { return e.subject ?? e.type ?? e.title ?? ''; }
// Çiplerde "· 45 dk" gibi parçalar satır sonunda bölünmesin (satır ancak addan sonra kırılır)
const NBSP = '\u00a0';
const nb = t => t.replace(/ /g, NBSP);
const KIND_LABEL = { study: 'Ders', sport: 'Antrenman', event: 'Etkinlik' };
const INVALID_TEXT = {
  subject: 'Önce Gün ekranındaki "Dersleri düzenle" ile bir ders ekleyin.',
  minutes: 'Süreyi dakika olarak girin.',
  title: 'Etkinlik adını yazın.',
};
const LIST_KEY = { entries: 'studyEntries', training: 'trainingEntries', events: 'events' };

export default function WeekPage({ currentDate, setCurrentDate, onDataChanged, subjects, myId, onAccessChanged }) {
  const [weekDays, setWeekDays] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(currentDate));
  const [mode, setMode] = useState(() => readPref('weekMode', 'table'));
  const requestId = useRef(0);

  const loadWeek = useCallback(async (mon) => {
    const id = ++requestId.current;
    const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(mon, i)));
    try {
      // Haftanın 7 günü tek istekte (GET /days/week/{pazartesi}/details); cevap tarihe göre eşlenir
      const res = await client.get(`/days/week/${keys[0]}/details`);
      if (id !== requestId.current) return; // daha yeni bir istek var (hafta değişti)
      const byDate = new Map((res.data.days ?? []).map(d => [d.date, d]));
      const empty = k => ({ date: k, studyEntries: [], trainingEntries: [], events: [] });
      const results = keys.map(k => ({ key: k, data: byDate.get(k) ?? empty(k) }));
      setWeekDays(results);
      setLoadError('');
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(errorText(err));
    }
  }, []);

  useEffect(() => { loadWeek(weekStart); }, [weekStart, loadWeek]);

  const reload = useCallback(async () => {
    await loadWeek(weekStart);
    onDataChanged();
  }, [loadWeek, weekStart, onDataChanged]);

  const mutate = useMutation({ state: weekDays, setState: setWeekDays, reload, onAccessChanged });

  // Gösterilen veri seçili haftaya ait değilse (yükleniyor) boş kabul et
  const shownKeys = Array.from({ length: 7 }, (_, i) => dkey(addDays(weekStart, i)));
  const current = weekDays.length === 7 && weekDays[0].key === shownKeys[0] ? weekDays : [];

  // İstatistikler gösterilen haftadan hesaplanır (seçili günün haftasından değil)
  const shownWeekSummaries = current.map(({ key, data }) => ({
    date: key,
    studyMinutes: data.studyEntries.reduce((s, e) => s + e.minutes, 0),
    trainingDone: data.trainingEntries.length > 0,
    eventCount: data.events.length,
  }));

  function changeMode(m) {
    setMode(m);
    writePref('weekMode', m);
  }

  // Kayıt işlemleri (iyimser güncelleme + hata olursa geri alma)
  const actions = {
    add: (key, kindPath, body) => mutate(null, () => client.post(`/days/${key}/${kindPath}`, body)),
    remove: (key, kindPath, id) => mutate(w => removeFromWeek(w, key, LIST_KEY[kindPath], id), () => client.delete(`/days/${key}/${kindPath}/${id}`)),
    cycle: (key, entry) => {
      const status = nextStatus(entry.status);
      return mutate(w => patchWeek(w, key, 'studyEntries', entry.id, { status }),
        () => client.patch(`/days/${key}/entries/${entry.id}/status`, { status }));
    },
  };

  const mon = weekStart;
  const rangeLabel = `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} – ${addDays(mon, 6).getDate()} ${MONTHS[addDays(mon, 6).getMonth()].slice(0, 3)}`;
  const subjectNames = subjects.map(s => s.name);

  return (
    <>
      <div className="weeknav">
        <button aria-label="Önceki hafta" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Önceki</button>
        <span className="rng" aria-live="polite">{rangeLabel}</span>
        <button aria-label="Sonraki hafta" onClick={() => setWeekStart(addDays(weekStart, 7))}>Sonraki ›</button>
      </div>

      {loadError && (
        <div className="load-error" role="alert">
          <p>Hafta yüklenemedi: {loadError}</p>
          <button className="btn" onClick={() => loadWeek(weekStart)}>Tekrar dene</button>
        </div>
      )}

      <div className="weekbar">
        <div className="modetoggle" role="group" aria-label="Görünüm">
          <button className={mode === 'table' ? 'active' : ''} aria-pressed={mode === 'table'} onClick={() => changeMode('table')}>Tablo</button>
          <button className={mode === 'list' ? 'active' : ''} aria-pressed={mode === 'list'} onClick={() => changeMode('list')}>Liste</button>
        </div>
      </div>

      {current.length === 0 && !loadError ? <Loading />
        : mode === 'table' ? (
          <WeekTable
            weekStart={weekStart}
            weekDays={current}
            subjects={subjectNames}
            myId={myId}
            actions={actions}
            onGoToDay={setCurrentDate}
          />
        ) : (
          <>
            <StatsBar weekSummaries={shownWeekSummaries} standalone />

            {current.map(({ key, data }, i) => {
              const date = addDays(weekStart, i);
              return (
                <WeekDayCard
                  key={key}
                  dateKey={key}
                  date={date}
                  dayIndex={i}
                  data={data}
                  isToday={dkey(new Date()) === key}
                  subjects={subjectNames}
                  myId={myId}
                  actions={actions}
                  onGoToDay={() => setCurrentDate(date)}
                />
              );
            })}

            <div className="note">Buradan gelecek (veya geçmiş) günlere direkt ders, antrenman ve etkinlik girebilirsiniz.</div>
          </>
        )}
    </>
  );
}

function WeekTable({ weekStart, weekDays, subjects, myId, actions, onGoToDay }) {
  const todayKey = dkey(new Date());
  const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(weekStart, i)));
  const defaultDay = keys.includes(todayKey) ? todayKey : keys[0];

  const [kind, setKind] = useState('study');
  const [form, setForm] = useState({ day: defaultDay, subject: '', minutes: '', type: 'Top', title: '', time: '' });
  const [invalid, setInvalid] = useState(null);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef(null);
  const formRef = useRef(null);

  // Hafta değişince seçili gün o haftaya ait değilse varsayılana dön
  const day = keys.includes(form.day) ? form.day : defaultDay;

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setInvalid(null); };

  function prefill(key, k) {
    setKind(k);
    setForm(f => ({ ...f, day: key }));
    setInvalid(null);
    formRef.current?.scrollIntoView({ block: 'nearest' });
    setTimeout(() => firstFieldRef.current?.focus(), 0);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const subject = form.subject || subjects[0];
    let path, body, clear;
    if (kind === 'study') {
      if (!subject) return setInvalid('subject');
      if (!form.minutes) return setInvalid('minutes');
      path = 'entries'; body = { subject, topic: '', minutes: parseInt(form.minutes, 10) }; clear = { minutes: '' };
    } else if (kind === 'sport') {
      if (!form.minutes) return setInvalid('minutes');
      path = 'training'; body = { type: form.type, minutes: parseInt(form.minutes, 10), note: '' }; clear = { minutes: '' };
    } else {
      if (!form.title.trim()) return setInvalid('title');
      path = 'events'; body = { title: form.title.trim(), time: form.time.trim(), note: '' }; clear = { title: '', time: '' };
    }
    setBusy(true);
    const ok = await actions.add(day, path, body);
    setBusy(false);
    if (ok) setForm(f => ({ ...f, ...clear }));
  }

  let studyTotal = 0, trainTotal = 0, trainDays = 0, eventTotal = 0;
  for (const { data } of weekDays) {
    studyTotal += data.studyEntries.reduce((s, e) => s + e.minutes, 0);
    trainTotal += data.trainingEntries.reduce((s, e) => s + e.minutes, 0);
    if (data.trainingEntries.length > 0) trainDays++;
    eventTotal += data.events.length;
  }

  const err = f => (invalid === f ? ' input-error' : '');
  const bad = f => (invalid === f ? true : undefined);
  const plus = (key, k, i) => (
    <button type="button" className="plus" aria-label={`${WEEKDAYS_FULL[i]} için ${KIND_LABEL[k].toLocaleLowerCase('tr-TR')} ekle`} onClick={() => prefill(key, k)}>+</button>
  );
  const del = (key, path, e) => (e.canEdit
    ? <button type="button" className="x" aria-label={`${chipName(e)} kaydını sil`} onClick={() => actions.remove(key, path, e.id)}>×</button>
    : <ReadOnlyMark compact />);

  return (
    <>
      <form className="wkadd" data-kind={kind} ref={formRef} onSubmit={submit}>
        <select id="wk-day" aria-label="Gün" value={day} onChange={set('day')}>
          {keys.map((k, i) => (
            <option key={k} value={k}>{WEEKDAYS[i]} {addDays(weekStart, i).getDate()}</option>
          ))}
        </select>
        <div className="kind" role="group" aria-label="Tür">
          <button type="button" data-k="study" aria-pressed={kind === 'study'} onClick={() => setKind('study')}>Ders</button>
          <button type="button" data-k="sport" aria-pressed={kind === 'sport'} onClick={() => setKind('sport')}>Antrenman</button>
          <button type="button" data-k="event" aria-pressed={kind === 'event'} onClick={() => setKind('event')}>Etkinlik</button>
        </div>

        {kind === 'study' && (
          <>
            <select id="wk-subject" className={`grow${err('subject')}`} aria-invalid={bad('subject')} aria-label="Ders" value={form.subject || subjects[0] || ''} onChange={set('subject')}>
              {subjects.length === 0 && <option value="">Önce ders ekleyin</option>}
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input id="wk-minutes" ref={firstFieldRef} type="number" inputMode="numeric" min="1" max="1440" placeholder="dk" className={`num${err('minutes')}`} aria-invalid={bad('minutes')} aria-label="Dakika" value={form.minutes} onChange={set('minutes')} />
          </>
        )}
        {kind === 'sport' && (
          <>
            <select id="wk-type" className="grow" aria-label="Antrenman türü" value={form.type} onChange={set('type')}>
              <option value="Top">Top</option>
              <option value="Kuvvet">Kuvvet</option>
            </select>
            <input id="wk-sminutes" ref={firstFieldRef} type="number" inputMode="numeric" min="1" max="1440" placeholder="dk" className={`num${err('minutes')}`} aria-invalid={bad('minutes')} aria-label="Dakika" value={form.minutes} onChange={set('minutes')} />
          </>
        )}
        {kind === 'event' && (
          <>
            <input id="wk-title" ref={firstFieldRef} placeholder="Etkinlik adı" className={`grow${err('title')}`} aria-invalid={bad('title')} autoComplete="off" aria-label="Etkinlik" value={form.title} onChange={set('title')} />
            <input id="wk-time" placeholder="Saat" className="num" autoComplete="off" aria-label="Saat" value={form.time} onChange={set('time')} />
          </>
        )}
        <button type="submit" className="go" disabled={busy}>Ekle</button>
        {invalid && <div className="inline-error form-error" role="alert">{INVALID_TEXT[invalid]}</div>}
      </form>

      <div className="wktable-wrap">
        <table className="wktable">
          <colgroup><col className="c-day" /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th><span className="sr-only">Gün</span></th>
              <th><span className="dotc" style={{ background: 'var(--study)' }} />Ders</th>
              <th><span className="dotc" style={{ background: 'var(--sport)' }} />Antrenman</th>
              <th><span className="dotc" style={{ background: 'var(--event)' }} />Etkinlik</th>
            </tr>
          </thead>
          <tbody>
            {weekDays.map(({ key, data }, i) => {
              const date = addDays(weekStart, i);
              return (
                <tr key={key} className={`${key === todayKey ? 'today' : ''} ${i >= 5 ? 'weekend' : ''}`}>
                  <th className="daycell" scope="row">
                    <button title="Güne git" aria-label={`${WEEKDAYS_FULL[i]} ${date.getDate()} gününe git`} onClick={() => onGoToDay(date)}>
                      <span className="dw">{WEEKDAYS[i]}</span>
                      <span className="dn">{date.getDate()}</span>
                    </button>
                  </th>
                  <td>
                    <div className="cell">
                      {data.studyEntries.map(e => (
                        <span key={e.id} className={`chip study status-${e.status}`}>
                          {e.canEdit
                            ? <button type="button" className="clicktext" title="Durumu değiştir" onClick={() => actions.cycle(key, e)}>{e.subject} ·{NBSP}{e.minutes}{NBSP}dk<span className="sr-only">, {STATUS_SHORT[e.status]}</span></button>
                            : <span className="lbl">{e.subject} ·{NBSP}{e.minutes}{NBSP}dk<span className="sr-only">, {STATUS_SHORT[e.status]}</span></span>}
                          <AuditTag entry={e} myId={myId} compact />
                          {del(key, 'entries', e)}
                        </span>
                      ))}
                      {plus(key, 'study', i)}
                    </div>
                  </td>
                  <td>
                    <div className="cell">
                      {data.trainingEntries.map(e => (
                        <span key={e.id} className="chip sport">
                          <span className="lbl">{e.type} ·{NBSP}{nb(formatDuration(e.minutes))}</span>
                          <AuditTag entry={e} myId={myId} compact />
                          {del(key, 'training', e)}
                        </span>
                      ))}
                      {plus(key, 'sport', i)}
                    </div>
                  </td>
                  <td>
                    <div className="cell">
                      {data.events.map(e => (
                        <span key={e.id} className="chip event">
                          <span className="lbl">{e.title}{e.time ? ` ·${NBSP}${e.time}` : ''}</span>
                          <AuditTag entry={e} myId={myId} compact />
                          {del(key, 'events', e)}
                        </span>
                      ))}
                      {plus(key, 'event', i)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row"><abbr title="Toplam">Top.</abbr></th>
              <td><b>{studyTotal}</b> dk</td>
              <td><b>{trainDays}</b>/7 gün · {formatDuration(trainTotal)}</td>
              <td><b>{eventTotal}</b> etkinlik</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="note">
        Ders kaydına dokununca durumu değişir (Yapılacak → Devam → Tamam). Hücredeki + o günü ve türü ekleme çubuğuna getirir. Gün numarasına dokunarak o günün detayına geçebilirsiniz.
      </div>
    </>
  );
}

function WeekDayCard({ dateKey, date, dayIndex, data, isToday, subjects, myId, actions, onGoToDay }) {
  const [studyForm, setStudyForm] = useState({ subject: '', minutes: '' });
  const [trainForm, setTrainForm] = useState({ type: 'Top', hours: '', minutes: '' });
  const [eventForm, setEventForm] = useState({ title: '', time: '' });

  async function addStudy(e) {
    e.preventDefault();
    if (!studyForm.subject || !studyForm.minutes) return;
    if (await actions.add(dateKey, 'entries', { subject: studyForm.subject, topic: '', minutes: parseInt(studyForm.minutes, 10) }))
      setStudyForm(f => ({ ...f, minutes: '' }));
  }

  async function addTraining(e) {
    e.preventDefault();
    const totalMins = (parseInt(trainForm.hours, 10) || 0) * 60 + (parseInt(trainForm.minutes, 10) || 0);
    if (totalMins <= 0) return;
    if (await actions.add(dateKey, 'training', { type: trainForm.type, minutes: totalMins, note: '' }))
      setTrainForm(f => ({ ...f, hours: '', minutes: '' }));
  }

  async function addEvent(e) {
    e.preventDefault();
    if (!eventForm.title.trim()) return;
    if (await actions.add(dateKey, 'events', { title: eventForm.title.trim(), time: eventForm.time.trim(), note: '' }))
      setEventForm({ title: '', time: '' });
  }

  const del = (path, e) => (e.canEdit
    ? <button type="button" className="x" aria-label={`${chipName(e)} kaydını sil`} onClick={() => actions.remove(dateKey, path, e.id)}>×</button>
    : <ReadOnlyMark compact />);

  return (
    <div className={`weekcard${isToday ? ' today' : ''}`}>
      <div className="datecol">
        <div className="dn">{date.getDate()}</div>
        <div className="dw">{MONTHS[date.getMonth()].slice(0, 3)}</div>
      </div>
      <div className="body">
        <div className="weekcard-head">
          <div className="wd">
            {WEEKDAYS_FULL[dayIndex]}
            {isToday && <span className="datep today-tag">bugün</span>}
          </div>
          <button className="goto" onClick={onGoToDay}>Güne git →</button>
        </div>

        <div className="sectionlbl">Ders</div>
        {data.studyEntries.length > 0 && (
          <div className="chiprow">
            {data.studyEntries.map(e => (
              <span key={e.id} className={`chip study status-${e.status}`}>
                {e.canEdit
                  ? <button type="button" className="clicktext" onClick={() => actions.cycle(dateKey, e)}>{e.subject} ·{NBSP}{e.minutes}{NBSP}dk<span className="sr-only">, {STATUS_SHORT[e.status]}</span></button>
                  : <span className="lbl">{e.subject} ·{NBSP}{e.minutes}{NBSP}dk<span className="sr-only">, {STATUS_SHORT[e.status]}</span></span>}
                <AuditTag entry={e} myId={myId} compact />
                {del('entries', e)}
              </span>
            ))}
          </div>
        )}
        <form className="quickrow" onSubmit={addStudy}>
          <select aria-label="Ders" value={studyForm.subject} onChange={e => setStudyForm(f => ({ ...f, subject: e.target.value }))}>
            <option value="">Ders</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="number" inputMode="numeric" min="1" max="1440" placeholder="dk" className="small" aria-label="Dakika"
            value={studyForm.minutes} onChange={e => setStudyForm(f => ({ ...f, minutes: e.target.value }))} />
          <button type="submit" aria-label="Ders ekle">+</button>
        </form>

        <div className="sectionlbl sport">Antrenman</div>
        {data.trainingEntries.length > 0 && (
          <div className="chiprow">
            {data.trainingEntries.map(e => (
              <span key={e.id} className="chip sport">
                <span className="lbl">{e.type} ·{NBSP}{nb(formatDuration(e.minutes))}</span>
                <AuditTag entry={e} myId={myId} compact />
                {del('training', e)}
              </span>
            ))}
          </div>
        )}
        <form className="quickrow sport" onSubmit={addTraining}>
          <select aria-label="Antrenman türü" value={trainForm.type} onChange={e => setTrainForm(f => ({ ...f, type: e.target.value }))}>
            <option value="Top">Top</option>
            <option value="Kuvvet">Kuvvet</option>
          </select>
          <input type="number" inputMode="numeric" min="0" placeholder="sa" className="small" aria-label="Saat"
            value={trainForm.hours} onChange={e => setTrainForm(f => ({ ...f, hours: e.target.value }))} />
          <input type="number" inputMode="numeric" min="0" max="59" placeholder="dk" className="small" aria-label="Dakika"
            value={trainForm.minutes} onChange={e => setTrainForm(f => ({ ...f, minutes: e.target.value }))} />
          <button type="submit" aria-label="Antrenman ekle">+</button>
        </form>

        <div className="sectionlbl event">Etkinlik</div>
        {data.events.length > 0 && (
          <div className="chiprow">
            {data.events.map(e => (
              <span key={e.id} className="chip event">
                <span className="lbl">{e.title}{e.time ? ` ·${NBSP}${e.time}` : ''}</span>
                <AuditTag entry={e} myId={myId} compact />
                {del('events', e)}
              </span>
            ))}
          </div>
        )}
        <form className="quickrow event" onSubmit={addEvent}>
          <input placeholder="Etkinlik" aria-label="Etkinlik" value={eventForm.title}
            onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
          <input placeholder="Saat" className="small" aria-label="Saat" value={eventForm.time}
            onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))} />
          <button type="submit" aria-label="Etkinlik ekle">+</button>
        </form>
      </div>
    </div>
  );
}

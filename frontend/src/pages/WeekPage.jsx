import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import useMutation from '../hooks/useMutation';
import StatsBar from '../components/StatsBar';
import AuditTag from '../components/AuditTag';
import EventForm from '../components/EventForm';
import EditEventDialog from '../components/EditEventDialog';
import ReadOnlyMark from '../components/ReadOnlyMark';
import { addDays, dkey, formatDuration, mondayOf, MONTHS, nextStatus, STATUS_SHORT, WEEKDAYS, WEEKDAYS_FULL } from '../utils/format';
import Loading from '../components/Loading';
import { deletedText, eventLabel, isTraining, kindInfo } from '../utils/events';

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
function chipName(e) { return e.subject ?? (e.kind ? eventLabel(e) : ''); }
// Hafta çipindeki kısa metin: "⚽ Top · 17:00 · 1 sa 30 dk", "📝 Deneme sınavı · 10:00"
function eventChipText(e) {
  const parts = [`${kindInfo(e.kind).icon}${NBSP}${eventLabel(e, true)}`];
  if (e.time) parts.push(e.time);
  if (isTraining(e) && e.minutes > 0) parts.push(nb(formatDuration(e.minutes)));
  return parts.join(` ·${NBSP}`);
}
// Çiplerde "· 45 dk" gibi parçalar satır sonunda bölünmesin (satır ancak addan sonra kırılır)
const NBSP = '\u00a0';
const nb = t => t.replace(/ /g, NBSP);
const KIND_LABEL = { study: 'Ders', event: 'Aktivite' };
const INVALID_TEXT = {
  subject: 'Önce Gün ekranındaki "Dersleri düzenle" ile bir ders ekleyin.',
  minutes: 'Süreyi dakika olarak girin.',
};
const LIST_KEY = { entries: 'studyEntries', events: 'events' };

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
      const empty = k => ({ date: k, studyEntries: [], events: [] });
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
    trainingDone: data.events.some(isTraining),
    eventCount: data.events.filter(e => !isTraining(e)).length,
  }));

  function changeMode(m) {
    setMode(m);
    writePref('weekMode', m);
  }

  // Kayıt işlemleri (iyimser güncelleme + hata olursa geri alma)
  const actions = {
    add: (key, kindPath, body) => mutate(null, () => client.post(`/days/${key}/${kindPath}`, body)),
    remove: (key, kindPath, e) => mutate(w => removeFromWeek(w, key, LIST_KEY[kindPath], e.id),
      (cfg) => client.delete(`/days/${key}/${kindPath}/${e.id}`, cfg), { undo: e.kind ? deletedText(e) : `${chipName(e)} silindi` }),
    editEvent: (key, e, body) => mutate(w => patchWeek(w, key, 'events', e.id, body),
      () => client.put(`/days/${key}/events/${e.id}`, body)),
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

            <div className="note">Buradan gelecek (veya geçmiş) günlere direkt ders ve aktivite girebilirsiniz. Bir aktiviteye dokunarak düzenleyebilirsiniz.</div>
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
  const [form, setForm] = useState({ day: defaultDay, subject: '', minutes: '' });
  const [invalid, setInvalid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { key, ev }
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
    setTimeout(() => (firstFieldRef.current ?? formRef.current?.querySelector('.evform input, .evform select'))?.focus(), 0);
  }

  async function submitStudy(e) {
    e.preventDefault();
    if (busy) return;
    const subject = form.subject || subjects[0];
    if (!subject) return setInvalid('subject');
    if (!form.minutes) return setInvalid('minutes');
    setBusy(true);
    const ok = await actions.add(day, 'entries', { subject, topic: '', minutes: parseInt(form.minutes, 10) });
    setBusy(false);
    if (ok) setForm(f => ({ ...f, minutes: '' }));
  }

  async function addEvent(body) {
    setBusy(true);
    const ok = await actions.add(day, 'events', body);
    setBusy(false);
    return ok;
  }

  let studyTotal = 0, trainTotal = 0, trainDays = 0, eventTotal = 0;
  for (const { data } of weekDays) {
    studyTotal += data.studyEntries.reduce((s, e) => s + e.minutes, 0);
    const trainings = data.events.filter(isTraining);
    trainTotal += trainings.reduce((s, e) => s + (e.minutes || 0), 0);
    if (trainings.length > 0) trainDays++;
    eventTotal += data.events.length - trainings.length;
  }

  const err = f => (invalid === f ? ' input-error' : '');
  const bad = f => (invalid === f ? true : undefined);
  const plus = (key, k, i) => (
    <button type="button" className="plus" aria-label={`${WEEKDAYS_FULL[i]} için ${KIND_LABEL[k].toLocaleLowerCase('tr-TR')} ekle`} onClick={() => prefill(key, k)}>+</button>
  );
  const del = (key, path, e) => (e.canEdit
    ? <button type="button" className="x" aria-label={`${chipName(e)} kaydını sil`} onClick={() => actions.remove(key, path, e)}>×</button>
    : <ReadOnlyMark compact />);

  return (
    <>
      <div className="wkadd" data-kind={kind} ref={formRef}>
        <div className="wkadd-top">
          <select id="wk-day" aria-label="Gün" value={day} onChange={set('day')}>
            {keys.map((k, i) => (
              <option key={k} value={k}>{WEEKDAYS[i]} {addDays(weekStart, i).getDate()}</option>
            ))}
          </select>
          <div className="kind" role="group" aria-label="Tür">
            <button type="button" data-k="study" aria-pressed={kind === 'study'} onClick={() => setKind('study')}>Ders</button>
            <button type="button" data-k="event" aria-pressed={kind === 'event'} onClick={() => setKind('event')}>Aktivite</button>
          </div>
        </div>

        {kind === 'study' ? (
          <form className="wkadd-study" onSubmit={submitStudy}>
            <select id="wk-subject" className={`grow${err('subject')}`} aria-invalid={bad('subject')} aria-label="Ders" value={form.subject || subjects[0] || ''} onChange={set('subject')}>
              {subjects.length === 0 && <option value="">Önce ders ekleyin</option>}
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input id="wk-minutes" ref={firstFieldRef} type="number" inputMode="numeric" min="1" max="1440" placeholder="dk" className={`num${err('minutes')}`} aria-invalid={bad('minutes')} aria-label="Dakika" value={form.minutes} onChange={set('minutes')} />
            <button type="submit" className="go" disabled={busy}>Ekle</button>
            {invalid && <div className="inline-error form-error" role="alert">{INVALID_TEXT[invalid]}</div>}
          </form>
        ) : (
          <EventForm mode="add" compact showNote={false} busy={busy} onSubmit={addEvent} />
        )}
      </div>

      <div className="wktable-wrap">
        <table className="wktable two">
          <colgroup><col className="c-day" /><col /><col /></colgroup>
          <thead>
            <tr>
              <th><span className="sr-only">Gün</span></th>
              <th><span className="dotc" style={{ background: 'var(--study)' }} />Ders</th>
              <th><span className="dotc" style={{ background: 'var(--event)' }} />Aktivite</th>
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
                      {data.events.map(e => (
                        <EventChip key={e.id} e={e} myId={myId} onEdit={() => setEditing({ key, ev: e })} del={del(key, 'events', e)} />
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
              <td><b>{eventTotal}</b> aktivite · <b>{trainDays}</b>/7 gün spor{trainTotal > 0 ? ` · ${formatDuration(trainTotal)}` : ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {editing && (
        <EditEventDialog ev={editing.ev} onClose={() => setEditing(null)}
          onSave={body => actions.editEvent(editing.key, editing.ev, body)} />
      )}

      <div className="note">
        Ders kaydına dokununca durumu değişir (Yapılacak → Devam → Tamam). Aktiviteye dokununca düzenleyebilirsiniz.
        Hücredeki + o günü ve türü ekleme çubuğuna getirir. Gün numarasına dokunarak o günün detayına geçebilirsiniz.
      </div>
    </>
  );
}

// Aktivite çipi: düzenleme yetkisi varsa metne dokununca düzenleme penceresi açılır.
function EventChip({ e, myId, onEdit, del }) {
  const text = eventChipText(e);
  return (
    <span className={`chip ${isTraining(e) ? 'sport' : 'event'}`}>
      {e.canEdit
        ? <button type="button" className="clicktext" title="Düzenle" aria-label={`${eventLabel(e)} düzenle`} onClick={onEdit}>{text}</button>
        : <span className="lbl">{text}</span>}
      <AuditTag entry={e} myId={myId} compact />
      {del}
    </span>
  );
}

function WeekDayCard({ dateKey, date, dayIndex, data, isToday, subjects, myId, actions, onGoToDay }) {
  const [studyForm, setStudyForm] = useState({ subject: '', minutes: '' });
  const [editing, setEditing] = useState(null);

  async function addStudy(e) {
    e.preventDefault();
    if (!studyForm.subject || !studyForm.minutes) return;
    if (await actions.add(dateKey, 'entries', { subject: studyForm.subject, topic: '', minutes: parseInt(studyForm.minutes, 10) }))
      setStudyForm(f => ({ ...f, minutes: '' }));
  }

  const del = (path, e) => (e.canEdit
    ? <button type="button" className="x" aria-label={`${chipName(e)} kaydını sil`} onClick={() => actions.remove(dateKey, path, e)}>×</button>
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

        <div className="sectionlbl event">Aktivite</div>
        {data.events.length > 0 && (
          <div className="chiprow">
            {data.events.map(e => (
              <EventChip key={e.id} e={e} myId={myId} onEdit={() => setEditing(e)} del={del('events', e)} />
            ))}
          </div>
        )}
        <EventForm mode="add" compact showNote={false} onSubmit={body => actions.add(dateKey, 'events', body)} />
      </div>

      {editing && (
        <EditEventDialog ev={editing} onClose={() => setEditing(null)} onSave={body => actions.editEvent(dateKey, editing, body)} />
      )}
    </div>
  );
}

import { useId, useRef, useState } from 'react';
import Sheet from './Sheet';
import StudyForm, { EMPTY_STUDY, studyDraft } from './StudyForm';
import EventForm from './EventForm';
import { formatDuration } from '../utils/format';
import { itemKey, studyItem, toMin } from '../utils/timeline';

const KINDS = [{ id: 'study', label: 'Ders' }, { id: 'event', label: 'Aktivite' }];

// Bee (Ajanda) alt sayfası (Görev 10). sheet:
// - { mode: 'add', start, end }: boşluktan "+ Ekle" ("13:00–15:00 arasına ekle"); boş günde start/end null ("Ekle").
//   Üstte Ders / Aktivite seçimi (varsayılan Ders). Ders: ders formu, başlangıç boşluğun başıyla dolu. Aktivite: tür
//   ikonları, türe dokununca aktivite formu saatler dolu açılır. Geçişte girilen başlangıç korunur.
// - { mode: 'study', entry }: "Dersi düzenle" (ders formu + Durum).
// - { mode: 'event', entry }: "Aktiviteyi düzenle" (aktivite formu).
// onDone(itemKey): başarılı kayıttan sonra; sayfa kapanır, odak o öğeye gider (AgendaCard).
export default function AgendaSheet({ sheet, items, subjects, study, events, dateLabel, onClose, onDone, returnFocusRef }) {
  const titleId = useId();
  const [tab, setTab] = useState('study');
  const [draft, setDraft] = useState(() => (sheet.mode === 'study' ? studyDraft(sheet.entry) : { ...EMPTY_STUDY, startTime: sheet.start ?? '' }));
  const [evPrefill, setEvPrefill] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const segRefs = useRef({});
  const names = subjects.map(s => s.name);

  const gap = sheet.mode === 'add' && sheet.start ? `${sheet.start}–${sheet.end}` : null;
  const title = sheet.mode === 'study' ? 'Dersi düzenle' : sheet.mode === 'event' ? 'Aktiviteyi düzenle'
    : gap ? `${gap} arasına ekle` : 'Ekle';

  function pick(id) {
    setTab(id);
    if (id === 'event') {
      // Aktivite formu, ders formunda girilen (ya da boşluğun) başlangıcıyla dolar; bitiş boşluğun sonu (başlangıçtan sonraysa)
      const start = draft.startTime || sheet.start || '';
      const end = sheet.end && toMin(sheet.end) > toMin(start) ? sheet.end : '';
      setEvPrefill(start ? { start, end } : null);
    }
  }
  function onSegKey(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const id = tab === 'study' ? 'event' : 'study';
    pick(id);
    segRefs.current[id]?.focus();
  }

  async function run(fn) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kayıt eklemesin
    busyRef.current = true;
    setBusy(true);
    const key = await fn();
    busyRef.current = false;
    setBusy(false);
    if (key) onDone(key);
    return !!key;
  }
  const addStudy = (body) => run(async () => { const c = await study.add(body); return c && (c.id ? `s${c.id}` : 'x'); });
  const addEvent = (body) => run(async () => { const c = await events.add(body); return c && (c.id ? `e${c.id}` : 'x'); });
  const saveStudy = (body) => run(async () => ((await study.save(sheet.entry, body)) ? `s${sheet.entry.id}` : null));
  const saveEvent = (body) => run(async () => ((await events.save(sheet.entry, body)) ? `e${sheet.entry.id}` : null));
  const studyForm = (mode) => (
    <>
      {names.length === 0 && mode === 'add' && (
        <p className="evsum">Ders listesi boş. To-do bölümünde “+ Ders ekle” ile ders ekleyebilirsin.</p>
      )}
      <StudyForm mode={mode} value={draft} onChange={p => setDraft(d => ({ ...d, ...p }))} subjects={names} items={items}
        excludeKey={mode === 'edit' ? itemKey(studyItem(sheet.entry)) : null} busy={busy}
        submitLabel={`${dateLabel} gününe ekle`} onSubmit={mode === 'edit' ? saveStudy : addStudy} onCancel={onClose} />
    </>
  );

  let body;
  if (sheet.mode === 'study') body = studyForm('edit');
  else if (sheet.mode === 'event') {
    body = <EventForm mode="edit" initial={sheet.entry} events={items} onSubmit={saveEvent} onCancel={onClose} />;
  } else {
    body = (
      <>
        <div className="seg" role="radiogroup" aria-label="Ne eklemek istersin?" onKeyDown={onSegKey}>
          {KINDS.map(k => (
            <button key={k.id} ref={el => { segRefs.current[k.id] = el; }} type="button" role="radio" aria-checked={tab === k.id}
              tabIndex={tab === k.id ? 0 : -1} className={tab === k.id ? 'active' : ''} onClick={() => pick(k.id)}>{k.label}</button>
          ))}
        </div>
        {gap && (
          <div className="tl-pre"><span>Boşluk: <b>{gap}</b> · {formatDuration(toMin(sheet.end) - toMin(sheet.start))}</span></div>
        )}
        {tab === 'study' ? studyForm('add') : (
          <EventForm mode="add" events={items} busy={busy} onSubmit={addEvent} prefill={evPrefill} hidePre
            onTimeChange={v => setDraft(d => ({ ...d, startTime: v }))} />
        )}
      </>
    );
  }

  return (
    <Sheet className="addsheet" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="sheet-head">
        <h3 id={titleId} tabIndex={-1}>{title}</h3>
        <button type="button" className="sheet-close" onClick={onClose}>Kapat</button>
      </div>
      <div className="sheet-body">{body}</div>
    </Sheet>
  );
}

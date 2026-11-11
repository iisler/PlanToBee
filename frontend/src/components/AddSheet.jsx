import { useId, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet';
import StudyForm, { EMPTY_STUDY } from './StudyForm';
import EventForm from './EventForm';
import KindIcon from './KindIcon';
import SubjectManager from './SubjectManager';
import { addDays, dkey, WEEKDAYS } from '../utils/format';
import { parseKey } from '../utils/recurrence';
import { agendaItems, freeSlots } from '../utils/timeline';

// Gün çipleri: Bugün, Yarın ve sonraki iki gün ("Cum 13")
function dayChips() {
  const today = new Date();
  return [0, 1, 2, 3].map((n) => {
    const d = addDays(today, n);
    return { key: dkey(d), label: n === 0 ? 'Bugün' : n === 1 ? 'Yarın' : `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}` };
  });
}

// Ekle sayfası (Görev 17): alt menüdeki + ile açılan tek ekleme yüzeyi (eski + menüsü, To-do ve Plan ekranlarının yerine).
// Üstte Ders / Aktivite seçimi ve gün çipleri (ekrandan çıkmadan başka güne eklenir); altında ilgili form.
// - Ders: StudyForm; başlangıç için o günün boşlukları önerilir (slots). Ders listesi boşsa önce dersler eklenir.
// - Aktivite: EventForm (tür ikonları, tekrar kuralı).
// init: { type: 'study' | 'event', date: 'yyyy-AA-gg', study?: ders taslağı, event?: aktivite taslağı } (taslaklar sesle
// eklemedeki "Düzenle"den gelir). weekDays: yüklü haftanın günleri (çakışma uyarısı ve boşluk önerisi; başka haftada boş).
// onSubmit(gün, type, body) true dönerse sayfa kapanır. onImport: "Program yükle".
export default function AddSheet({ init, subjects, weekDays, onAddSubject, onDeleteSubject, onSubmit, onImport, onClose, returnFocusRef }) {
  const titleId = useId();
  const [type, setType] = useState(init.type);
  const [date, setDate] = useState(init.date);
  const [form, setForm] = useState({ ...EMPTY_STUDY, ...init.study });
  const [draft, setDraft] = useState(init.event ?? null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const chips = useMemo(() => dayChips(), []);
  const names = subjects.map(s => s.name);

  const items = useMemo(() => {
    const day = weekDays?.find(d => d.date === date);
    return day ? agendaItems(day.studyEntries, day.events) : [];
  }, [weekDays, date]);
  const mins = /^\d+$/.test(form.minutes) ? Number(form.minutes) : 0;
  const slots = useMemo(() => {
    const n = new Date();
    return freeSlots(items, mins, date === dkey(n) ? n.getHours() * 60 + n.getMinutes() : null);
  }, [items, mins, date]);

  async function submit(kind, body) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kayıt eklemesin
    busyRef.current = true;
    setBusy(true);
    const ok = await onSubmit(date, kind, body);
    busyRef.current = false;
    setBusy(false);
    if (ok) onClose();
    return ok;
  }

  const otherDay = !chips.some(c => c.key === date);
  const d = parseKey(date);

  return (
    <Sheet className="addsheet" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="sheet-head">
        <h3 id={titleId} tabIndex={-1}>Ekle</h3>
        <button type="button" className="sheet-close" onClick={onClose}>Kapat</button>
      </div>
      <div className="sheet-body">
        <div className="seg2" role="group" aria-label="Ne ekliyorsun?">
          <button type="button" className={type === 'study' ? 'on' : ''} aria-pressed={type === 'study'} onClick={() => setType('study')}>
            <KindIcon kind="study" size={18} />Ders
          </button>
          <button type="button" className={type === 'event' ? 'on' : ''} aria-pressed={type === 'event'} onClick={() => setType('event')}>
            <KindIcon kind="Event" size={18} />Aktivite
          </button>
        </div>

        <div className="fl2">
          <span aria-hidden="true">Gün</span>
          <div className="daychips" role="group" aria-label="Gün">
            {chips.map(c => (
              <button key={c.key} type="button" className={c.key === date ? 'on' : ''} aria-pressed={c.key === date} onClick={() => setDate(c.key)}>{c.label}</button>
            ))}
            <label className={`daypick${otherDay ? ' on' : ''}`}>
              <span>{otherDay ? `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1}` : 'Başka gün'}</span>
              <input type="date" aria-label="Başka bir gün seç" value={date} onClick={(e) => e.currentTarget.showPicker?.()} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} />
            </label>
          </div>
        </div>

        {type === 'study' ? (
          names.length === 0 ? <SubjectManager subjects={subjects} onAdd={onAddSubject} onDelete={onDeleteSubject} /> : (
            <StudyForm mode="add" value={form} onChange={p => setForm(f => ({ ...f, ...p }))} subjects={names} items={items} slots={slots}
              busy={busy} onSubmit={body => submit('study', body)} onCancel={onClose} />
          )
        ) : (
          <EventForm key={date} mode="add" date={date} events={items} busy={busy} kindsLabel="Aktivite türü"
            draft={draft} onClearDraft={() => setDraft(null)} onSubmit={body => submit('event', body)} />
        )}

        <p className="add-import">Okul ya da kurs programın mı var? <button type="button" className="linkbtn" onClick={onImport}>Program yükle</button></p>
      </div>
    </Sheet>
  );
}

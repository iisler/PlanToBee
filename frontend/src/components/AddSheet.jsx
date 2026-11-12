import { useId, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet';
import StudyForm, { EMPTY_STUDY } from './StudyForm';
import EventForm from './EventForm';
import SubjectManager from './SubjectManager';
import { addDays, dkey, WEEKDAYS } from '../utils/format';
import { parseKey } from '../utils/recurrence';
import { agendaItems } from '../utils/timeline';

// Gün çipleri: Bugün, Yarın ve sonraki iki gün ("Cum 13")
function dayChips() {
  const today = new Date();
  return [0, 1, 2, 3].map((n) => {
    const d = addDays(today, n);
    return { key: dkey(d), label: n === 0 ? 'Bugün' : n === 1 ? 'Yarın' : `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}` };
  });
}

// Ekle ekranı (Görev 17; 17b, 17c): alt menüdeki + → Aktivite / Ders ile açılır; seçilen türün ekranı tam ekran açılır
// (alt menü altta görünür kalır). Başlık "Ders ekle" / "Aktivite ekle"; üstte gün çipleri, altında ilgili form.
// Ekle ya da Vazgeç'ten sonra Bugün ekranına dönülür (PlanShell).
// - Ders: StudyForm ("Boş saatler" önerisi 17d'de kaldırıldı: form tek ekrana sığsın). Ders listesi boşsa önce dersler eklenir.
// - Aktivite: EventForm (tür ikonları, tekrar kuralı).
// init: { date: 'yyyy-AA-gg', study?: ders taslağı, event?: aktivite taslağı }; taslak verilirse form dolu açılır.
// type ('study' | 'event') PlanShell'dedir: ekran açıkken + menüsünden seçilen tür formu değiştirir, gün ve taslak kalır.
// Ekranda tür seçimi yoktur (17c). weekDays: yüklü haftanın günleri (çakışma uyarısı ve boşluk önerisi; başka
// haftada boş). onSubmit(gün, type, body) true dönerse sayfa kapanır. Program yükleme alt menüde ayrı düğmedir.
export default function AddSheet({ init, type, subjects, weekDays, onAddSubject, onDeleteSubject, onSubmit, onClose, returnFocusRef }) {
  const titleId = useId();
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
    <Sheet className="addsheet full" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="sheet-head">
        <h3 id={titleId} tabIndex={-1}>{type === 'study' ? 'Ders ekle' : 'Aktivite ekle'}</h3>
        <button type="button" className="sheet-close" onClick={onClose}>Vazgeç</button>
      </div>
      <div className="sheet-body">
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
            <StudyForm mode="add" value={form} onChange={p => setForm(f => ({ ...f, ...p }))} subjects={names} items={items}
              busy={busy} onSubmit={body => submit('study', body)} onCancel={onClose} />
          )
        ) : (
          <EventForm key={date} mode="add" date={date} events={items} busy={busy} kindsLabel="Aktivite türü"
            draft={draft} onClearDraft={() => setDraft(null)} onSubmit={body => submit('event', body)} />
        )}
      </div>
    </Sheet>
  );
}

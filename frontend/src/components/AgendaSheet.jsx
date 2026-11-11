import { useId, useRef, useState } from 'react';
import Sheet from './Sheet';
import StudyForm, { studyDraft } from './StudyForm';
import EventForm from './EventForm';
import { itemKey, studyItem } from '../utils/timeline';

// Düzenleme sayfası (Görev 10). ⋯ → Düzenle ile açılır. sheet:
// - { mode: 'study', entry }: "Dersi düzenle" (ders formu + Durum).
// - { mode: 'event', entry, scope }: "Aktiviteyi düzenle" (tekrarlanan kayıtta scope 'one' | 'all').
// Ekleme burada değil, alt menüdeki + ile açılan Ekle sayfasındadır (AddSheet, Görev 17).
// onDone(itemKey): başarılı kayıttan sonra; sayfa kapanır, odak o öğeye gider (DayFlow).
export default function AgendaSheet({ sheet, items, subjects, study, events, dateLabel, onClose, onDone, returnFocusRef }) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => (sheet.mode === 'study' ? studyDraft(sheet.entry) : null));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const names = subjects.map(s => s.name);

  const title = sheet.mode === 'study' ? 'Dersi düzenle' : sheet.scope === 'all' ? 'Tüm tekrarları düzenle' : 'Aktiviteyi düzenle';

  async function run(fn) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kez kaydetmesin
    busyRef.current = true;
    setBusy(true);
    const key = await fn();
    busyRef.current = false;
    setBusy(false);
    if (key) onDone(key);
    return !!key;
  }
  const saveStudy = (body) => run(async () => ((await study.save(sheet.entry, body)) ? `s${sheet.entry.id}` : null));
  const saveEvent = (body) => run(() => events.save(sheet.entry, body, sheet.scope));

  const body = sheet.mode === 'study' ? (
    <StudyForm mode="edit" value={draft} onChange={p => setDraft(d => ({ ...d, ...p }))} subjects={names} items={items}
      excludeKey={itemKey(studyItem(sheet.entry))} busy={busy}
      submitLabel={`${dateLabel} gününe ekle`} onSubmit={saveStudy} onCancel={onClose} />
  ) : (
    <EventForm mode="edit" initial={sheet.entry} events={items} scope={sheet.scope} onSubmit={saveEvent} onCancel={onClose} />
  );

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

import { useId, useRef } from 'react';
import Sheet from './Sheet';
import { auditLine, STATUS_SHORT } from '../utils/format';
import { eventLabel, eventMeta } from '../utils/events';

export const READ_ONLY_STUDY_TEXT = 'Durumu daireye dokunarak değiştirebilirsin. Düzenleme ve silme yalnızca ekleyen kişi ya da bir ebeveyn içindir.';
export const READ_ONLY_EVENT_TEXT = 'Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir.';

// Ders ya da aktivite satırındaki ⋯ menüsü (alt sayfa): başlık, ayrıntı ve Düzenle / Sil / Vazgeç.
// kind: 'study' | 'event'. Salt okunur kayıtta (canEdit=false) Düzenle ve Sil yerine açıklama yazılır.
export default function EntryMenu({ kind, entry, myId, onEdit, onDelete, onClose, returnFocusRef }) {
  const titleId = useId();
  const deleted = useRef(false);
  const study = kind === 'study';

  const title = study
    ? `${entry.subject} · ${entry.minutes} dk`
    : [eventLabel(entry), eventMeta(entry)].filter(Boolean).join(' · ');
  const sub = [
    study ? entry.topic : entry.note,
    study ? STATUS_SHORT[entry.status] : '',
    auditLine(entry, myId),
  ].filter(Boolean).join(' · ');

  function remove() {
    // Çift dokunuş tek silme yapar (menü kapanana kadar ikinci dokunuş yok sayılır)
    if (deleted.current) return;
    deleted.current = true;
    onDelete();
    onClose();
  }

  return (
    <Sheet className="menusheet" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <h3 id={titleId} tabIndex={-1}>{title}</h3>
      {sub && <p className="menusheet-sub">{sub}</p>}
      {entry.canEdit ? (
        <>
          <button type="button" className="menu-item" onClick={() => { onClose(); onEdit(); }}>Düzenle</button>
          <button type="button" className="menu-item danger" onClick={remove}>Sil</button>
        </>
      ) : (
        <p className="menusheet-ro">{study ? READ_ONLY_STUDY_TEXT : READ_ONLY_EVENT_TEXT}</p>
      )}
      <button type="button" className="menu-item soft" onClick={onClose}>Vazgeç</button>
    </Sheet>
  );
}

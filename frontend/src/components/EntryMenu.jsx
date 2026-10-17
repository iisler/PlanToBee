import { useId, useRef } from 'react';
import Sheet from './Sheet';
import { auditLine, dkey, STATUS_SHORT } from '../utils/format';
import { eventLabel, eventMeta, kindInfo } from '../utils/events';
import { dayMonthAcc, dayMonthWeekday, isOccurrence, recurringLine } from '../utils/recurrence';

export const READ_ONLY_STUDY_TEXT = 'Durumu daireye dokunarak değiştirebilirsin. Düzenleme ve silme yalnızca ekleyen kişi ya da bir ebeveyn içindir.';
export const READ_ONLY_EVENT_TEXT = 'Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir.';

// Ders ya da aktivite satırındaki ⋯ menüsü (alt sayfa): başlık, ayrıntı ve Düzenle / Sil / Vazgeç.
// kind: 'study' | 'event'. Salt okunur kayıtta (canEdit=false) Düzenle ve Sil yerine açıklama yazılır.
// Tekrarlanan (sanal) aktivitede (Görev 11, menü A) iki grup: "Yalnızca bu gün" (onEdit: o günü ayırıp düzenle,
// onDelete: o günü atla) ve "Bütün tekrarlar" (onEditAll: kuralı düzenle, onDeleteAll: bugünden itibaren sil).
function MenuItem({ label, small, onClick, danger = false }) {
  return (
    <button type="button" className={`menu-item${danger ? ' danger' : ''}`} onClick={onClick}>
      <span className="two">{label}<small>{small}</small></span>
    </button>
  );
}

export default function EntryMenu({ kind, entry, myId, onEdit, onDelete, onEditAll, onDeleteAll, onClose, returnFocusRef }) {
  const titleId = useId();
  const deleted = useRef(false);
  const study = kind === 'study';
  const series = !study && isOccurrence(entry);

  const title = study
    ? [entry.subject, entry.startTime && `${entry.startTime}–${entry.endTime ?? ''}`.replace(/–$/, ''), `${entry.minutes} dk`].filter(Boolean).join(' · ')
    : [`${series ? `${kindInfo(entry.kind).icon} ` : ''}${eventLabel(entry)}`, eventMeta(entry)].filter(Boolean).join(' · ');
  const sub = [
    series ? recurringLine(entry.recurring) : '',
    study ? entry.topic : entry.note,
    study ? STATUS_SHORT[entry.status] : '',
    auditLine(entry, myId),
  ].filter(Boolean).join(' · ');

  function remove(fn = onDelete) {
    // Çift dokunuş tek silme yapar (menü kapanana kadar ikinci dokunuş yok sayılır)
    if (deleted.current) return;
    deleted.current = true;
    fn();
    onClose();
  }

  let actions;
  if (!entry.canEdit) actions = <p className="menusheet-ro">{study ? READ_ONLY_STUDY_TEXT : READ_ONLY_EVENT_TEXT}</p>;
  else if (series) {
    const day = entry.occurrenceDate;
    const isToday = day === dkey(new Date());
    const name = eventLabel(entry);
    actions = (
      <>
        <p className="mgrp">Yalnızca bu gün · {dayMonthWeekday(day)}</p>
        <MenuItem label={`${dayMonthAcc(day)} düzenle`} small={`Sadece ${isToday ? 'bugünün' : 'bu günün'} saatini ya da adını değiştir`} onClick={() => { onClose(); onEdit(); }} />
        <MenuItem label={`${dayMonthAcc(day)} sil`} small={`${isToday ? 'Bugün' : 'Bu gün'} yok; diğer günler aynen kalır`} onClick={() => remove()} danger />
        <p className="mgrp">Bütün tekrarlar</p>
        <MenuItem label={`Tüm ${name} tekrarlarını düzenle`} small="Her güne uygulanır" onClick={() => { onClose(); onEditAll(); }} />
        <MenuItem label={`Bugünden itibaren tüm ${name} tekrarlarını sil`} small="Geçmiş günler kalır; bugün ve sonrası kalkar." onClick={() => remove(onDeleteAll)} danger />
      </>
    );
  } else {
    actions = (
      <>
        <button type="button" className="menu-item" onClick={() => { onClose(); onEdit(); }}>Düzenle</button>
        <button type="button" className="menu-item danger" onClick={() => remove()}>Sil</button>
      </>
    );
  }

  return (
    <Sheet className="menusheet" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <h3 id={titleId} tabIndex={-1}>{title}</h3>
      {sub && <p className="menusheet-sub">{sub}</p>}
      {actions}
      <button type="button" className="menu-item soft" onClick={onClose}>Vazgeç</button>
    </Sheet>
  );
}

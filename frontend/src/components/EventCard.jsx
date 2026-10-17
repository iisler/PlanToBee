import { useEffect, useMemo, useRef, useState } from 'react';
import { eventLabel } from '../utils/events';
import { creatorMark } from '../utils/format';
import { useAuditSettings } from '../context/AuditContext';
import { ariaEvent, iconOf, itemKey, kindClass, span } from '../utils/timeline';
import { isOccurrence, repeatAria } from '../utils/recurrence';
import RepeatMark from './RepeatMark';
import EventForm from './EventForm';
import EntryMenu from './EntryMenu';
import AuditTag from './AuditTag';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';

// Plan sırası: saatliler başlangıca göre, sonra saatsizler (ve eski serbest metin saatliler) sunucu sırasıyla
export function sortEvents(events) {
  const withSpan = events.map(ev => ({ ev, r: span(ev) }));
  const timed = withSpan.filter(x => x.r).sort((a, b) => a.r.S - b.r.S);
  return [...timed, ...withSpan.filter(x => !x.r)];
}

// Satırın saat metni: "09:00–13:00", bitişsiz "15:00", gece aşımı "21:00–00:30 ↷"; saatsiz null
const whenText = (r) => (r.noEnd ? r.start : `${r.start}–${r.end}${r.night ? ' ↷' : ''}`);

// Plan (Aktiviteler, Görev 10): üstte aktivite türü ikonları (dokununca ekleme formu altında açılır), altında günün
// aktiviteleri liste olarak. Satır: tür ikonu · ad · saat aralığı ya da "saati yok" · ⋯ menüsü (Düzenle / Sil).
// Düzenleme formu satırın yerinde açılır. Bu kartta çizelge ve boşluk yok.
// items: Bee öğeleri (çakışma uyarısı dersleri de görsün). actions: DayPage'deki aktivite işlemleri (add, save, remove).
export default function EventCard({ date, events, items, actions, myId, menuReset, isToday, dayName, panel }) {
  const { hideInitials } = useAuditSettings();
  const [editing, setEditing] = useState(null); // düzenlenen kayıt: { key, scope } (scope: tekrarlanan kayıtta 'one' | 'all')
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const openerRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const rows = useMemo(() => sortEvents(events), [events]);
  const keyed = useMemo(() => rows.map(x => ({ id: itemKey(x.ev) })), [rows]);
  const focusAfterDelete = useFocusAfterDelete(keyed, cardRef, () => headingRef.current);
  const editFormRef = useRef(null);

  // Menü, açıldığı andaki menuReset değeriyle tutulur: bildirimden gün açılınca (menuReset artar) kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;

  // Gün değişince düzenleme kapanır
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setEditing(null); }

  // ⋯ → Düzenle: form satırın yerinde açılır, odak ilk alana
  useEffect(() => {
    if (editing) editFormRef.current?.querySelector('input')?.focus();
  }, [editing]);

  const focusRow = (id) => requestAnimationFrame(() => cardRef.current?.querySelector(`[data-id="${id}"]`)?.focus());

  async function add(body) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kayıt eklemesin
    busyRef.current = true;
    setBusy(true);
    const created = await actions.add(body);
    busyRef.current = false;
    setBusy(false);
    return !!created;
  }

  async function save(ev, body) {
    const was = editing;
    setEditing(null);
    focusRow(itemKey(ev));
    const key = await actions.save(ev, body, was?.scope);
    if (!key) setEditing(was); // hata: düzenleme formu açık kalsın
    else if (key !== itemKey(ev)) focusRow(key); // ayrılan gün yeni kimlik alır
    return !!key;
  }

  function cancelEdit() {
    const key = editing?.key;
    setEditing(null);
    focusRow(key);
  }

  function remove(ev, all = false) {
    focusAfterDelete({ id: itemKey(ev) });
    if (all) actions.removeSeries(ev);
    else actions.remove(ev);
  }

  const who = (ev) => {
    const m = hideInitials ? null : creatorMark(ev, myId);
    return `${repeatAria(ev)}${m ? `, ${m.text}` : ''}`;
  };
  const summary = !events.length ? 'Aktivite yok' : `${events.length} ${isToday ? 'bugün' : 'aktivite'}`;
  return (
    <div className="card" ref={cardRef} {...panel}>
      <div className="card-head">
        <h2 className="sumh" ref={headingRef} tabIndex={-1}>{summary}</h2>
      </div>

      <EventForm key="add" mode="add" onSubmit={add} busy={busy} events={items} date={date} />

      <div className="sub-lb">{isToday ? 'Bugün' : dayName}</div>
      {rows.length === 0 ? <div className="empty-note">Bu gün için aktivite yok.</div> : rows.map(({ ev, r }) => {
        const key = itemKey(ev);
        return editing?.key === key ? (
          <div key={key} className="entry-edit" ref={editFormRef}>
            <EventForm key={`edit${key}${editing.scope ?? ''}`} mode="edit" initial={ev} events={items} scope={editing.scope}
              onSubmit={body => save(ev, body)} onCancel={cancelEdit} />
          </div>
        ) : (
          <div key={key} className="entry">
            <span className={`ico ${kindClass(ev)}`} aria-hidden="true">{iconOf(ev)}</span>
            <div className="info"><div className="subj">{eventLabel(ev)}<RepeatMark entry={ev} /><AuditTag entry={ev} myId={myId} /></div></div>
            {r ? <span className="when">{whenText(r)}</span>
              : <span className="when none">{ev.time || 'saati yok'}</span>}
            <button type="button" className="more" data-id={key} aria-haspopup="dialog"
              aria-label={`${r ? ariaEvent(r) : `${eventLabel(ev)}, ${ev.time || 'saati yok'}`}${who(ev)}: seçenekler`}
              onClick={e => { openerRef.current = e.currentTarget; setMenu({ entry: ev, reset: menuReset }); }}>⋯</button>
          </div>
        );
      })}

      {menuEntry && (
        <EntryMenu kind="event" entry={menuEntry} myId={myId} returnFocusRef={openerRef} onClose={() => setMenu(null)}
          onEdit={() => setEditing({ key: itemKey(menuEntry), scope: isOccurrence(menuEntry) ? 'one' : undefined })}
          onEditAll={() => setEditing({ key: itemKey(menuEntry), scope: 'all' })}
          onDelete={() => remove(menuEntry)} onDeleteAll={() => remove(menuEntry, true)} />
      )}
    </div>
  );
}

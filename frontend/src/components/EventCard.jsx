import { useEffect, useMemo, useRef, useState } from 'react';
import { eventLabel } from '../utils/events';
import { creatorMark } from '../utils/format';
import { useAuditSettings } from '../context/AuditContext';
import { ariaEvent, iconOf, kindClass, span } from '../utils/timeline';
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
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const openerRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const rows = useMemo(() => sortEvents(events), [events]);
  const focusAfterDelete = useFocusAfterDelete(rows.map(x => x.ev), cardRef, () => headingRef.current);
  const editFormRef = useRef(null);

  // Menü, açıldığı andaki menuReset değeriyle tutulur: bildirimden gün açılınca (menuReset artar) kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;

  // Gün değişince düzenleme kapanır
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setEditingId(null); }

  // ⋯ → Düzenle: form satırın yerinde açılır, odak ilk alana
  useEffect(() => {
    if (editingId != null) editFormRef.current?.querySelector('input')?.focus();
  }, [editingId]);

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
    setEditingId(null);
    focusRow(ev.id);
    const ok = await actions.save(ev, body);
    if (!ok) setEditingId(ev.id); // hata: düzenleme formu açık kalsın
    return ok;
  }

  function cancelEdit() {
    const id = editingId;
    setEditingId(null);
    focusRow(id);
  }

  function remove(ev) {
    focusAfterDelete(ev);
    actions.remove(ev);
  }

  const who = (ev) => {
    const m = hideInitials ? null : creatorMark(ev, myId);
    return m ? `, ${m.text}` : '';
  };
  const summary = !events.length ? 'Aktivite yok' : `${events.length} ${isToday ? 'bugün' : 'aktivite'}`;
  return (
    <div className="card" ref={cardRef} {...panel}>
      <div className="card-head">
        <h2 className="sumh" ref={headingRef} tabIndex={-1}>{summary}</h2>
      </div>

      <EventForm key="add" mode="add" onSubmit={add} busy={busy} events={items} />

      <div className="sub-lb">{isToday ? 'Bugün' : dayName}</div>
      {rows.length === 0 ? <div className="empty-note">Bu gün için aktivite yok.</div> : rows.map(({ ev, r }) => (
        editingId === ev.id ? (
          <div key={ev.id} className="entry-edit" ref={editFormRef}>
            <EventForm key={`edit${ev.id}`} mode="edit" initial={ev} events={items}
              onSubmit={body => save(ev, body)} onCancel={cancelEdit} />
          </div>
        ) : (
          <div key={ev.id} className="entry">
            <span className={`ico ${kindClass(ev)}`} aria-hidden="true">{iconOf(ev)}</span>
            <div className="info"><div className="subj">{eventLabel(ev)}<AuditTag entry={ev} myId={myId} /></div></div>
            {r ? <span className="when">{whenText(r)}</span>
              : <span className="when none">{ev.time || 'saati yok'}</span>}
            <button type="button" className="more" data-id={ev.id} aria-haspopup="dialog"
              aria-label={`${r ? ariaEvent(r) : `${eventLabel(ev)}, ${ev.time || 'saati yok'}`}${who(ev)}: seçenekler`}
              onClick={e => { openerRef.current = e.currentTarget; setMenu({ entry: ev, reset: menuReset }); }}>⋯</button>
          </div>
        )
      ))}

      {menuEntry && (
        <EntryMenu kind="event" entry={menuEntry} myId={myId} returnFocusRef={openerRef}
          onClose={() => setMenu(null)} onEdit={() => setEditingId(menuEntry.id)} onDelete={() => remove(menuEntry)} />
      )}
    </div>
  );
}

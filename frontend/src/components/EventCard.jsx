import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import { deletedText } from '../utils/events';
import { freeSummary } from '../utils/timeline';
import EventForm from './EventForm';
import Timeline from './Timeline';
import EntryMenu from './EntryMenu';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';

const EVENT_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);

// Günün aktiviteleri saat çizelgesi olarak (Görev 09, components/Timeline). Bloğa ya da satıra dokununca ⋯ menüsü
// (Düzenle / Sil; yalnızca canEdit kayıtlarda) açılır. Düzenleme formu kartın altında, ekleme formunun yerinde açılır;
// kapanınca odak bloğa döner. Boşluktaki "+ Ekle" ekleme formunu o aralıkla doldurur (tür seçimi kullanıcıda).
export default function EventCard({ date, events, myId, mutate, menuReset, isToday }) {
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const [prefill, setPrefill] = useState(null); // boşluktan gelme: { start, end, n }
  const openerRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const formRef = useRef(null);
  const focusAfterDelete = useFocusAfterDelete(events, cardRef, () => headingRef.current);
  const editing = editingId != null ? events.find(e => e.id === editingId) : null;

  // Menü, açıldığı andaki menuReset değeriyle tutulur: bildirimden gün açılınca (menuReset artar) kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;

  // Gün değişince düzenleme ve boşluk ön doldurması kapanır
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setEditingId(null); setPrefill(null); }

  // ⋯ → Düzenle: form kartın altında açılır, odak ilk alana
  useEffect(() => {
    if (editingId != null) formRef.current?.querySelector('input')?.focus();
  }, [editingId]);

  // Boşluktan gelme: form görünür alana kayar, odak ilk tür düğmesine
  useEffect(() => {
    if (!prefill) return;
    const el = formRef.current;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.querySelector('.acts button')?.focus({ preventScroll: true });
  }, [prefill]);

  function focusEntry(id) {
    requestAnimationFrame(() => cardRef.current?.querySelector(`[data-id="${id}"]`)?.focus());
  }

  async function add(body) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kayıt eklemesin
    busyRef.current = true;
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/events`, body));
    busyRef.current = false;
    setBusy(false);
    if (ok) setPrefill(null);
    return ok;
  }

  async function save(ev, body) {
    setEditingId(null);
    focusEntry(ev.id);
    const ok = await mutate(d => patchEntry(d, 'events', ev.id, body), () => client.put(`/days/${date}/events/${ev.id}`, body));
    if (!ok) setEditingId(ev.id); // hata: düzenleme formu açık kalsın
    return ok;
  }

  function cancelEdit() {
    const id = editingId;
    setEditingId(null);
    focusEntry(id);
  }

  function remove(ev) {
    focusAfterDelete(ev);
    mutate(d => removeEntry(d, 'events', ev.id), (cfg) => client.delete(`/days/${date}/events/${ev.id}`, cfg),
      { undo: deletedText(ev) });
  }

  function fromGap(start, end) {
    setEditingId(null);
    setPrefill(p => ({ start, end, n: (p?.n ?? 0) + 1 }));
  }

  return (
    <div className="card" ref={cardRef}>
      <div className="card-head">
        <div className="card-title"><span className="icon-tile evt">{EVENT_ICON}</span><h2 ref={headingRef} tabIndex={-1}>Aktiviteler</h2></div>
        <span className="card-sum">{freeSummary(events)}</span>
      </div>

      <Timeline events={events} isToday={isToday} myId={myId} editingId={editingId}
        onOpen={(ev, el) => { openerRef.current = el; setMenu({ entry: ev, reset: menuReset }); }}
        onGap={fromGap} />

      <div className="evadd" ref={formRef}>
        {editing ? (
          <EventForm key={`edit${editing.id}`} mode="edit" initial={editing} events={events}
            onSubmit={body => save(editing, body)} onCancel={cancelEdit} />
        ) : (
          <EventForm key="add" mode="add" onSubmit={add} busy={busy} events={events}
            prefill={prefill} onClearPrefill={() => setPrefill(null)} />
        )}
      </div>

      {menuEntry && (
        <EntryMenu kind="event" entry={menuEntry} myId={myId} returnFocusRef={openerRef}
          onClose={() => setMenu(null)} onEdit={() => setEditingId(menuEntry.id)} onDelete={() => remove(menuEntry)} />
      )}
    </div>
  );
}

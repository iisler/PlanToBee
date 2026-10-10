import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import { formatDuration } from '../utils/format';
import { deletedText, eventLabel, eventMeta, isTraining, kindInfo, trainingMinutes } from '../utils/events';
import AuditTag from './AuditTag';
import EventForm from './EventForm';
import EntryMenu from './EntryMenu';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';

const EVENT_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);

// Günün aktiviteleri tek listede (sunucu sıralar: önce saatliler saat sırasıyla, sonra saatsizler).
// Satır: ikon · ad (ve not) · saat · ⋯ menüsü. Düzenle / Sil ⋯ menüsünde, yalnızca canEdit kayıtlarda.
export default function EventCard({ date, events, myId, mutate, menuReset }) {
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const openerRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const focusAfterDelete = useFocusAfterDelete(events, cardRef, () => headingRef.current);
  const trainTotal = trainingMinutes(events);

  // Menü, açıldığı andaki menuReset değeriyle tutulur: bildirimden gün açılınca (menuReset artar) kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;

  // ⋯ → Düzenle: açan düğme satırla birlikte kalktığı için odak formun ilk alanına taşınır
  const editRef = useRef(null);
  useEffect(() => {
    if (editingId != null) editRef.current?.querySelector('input')?.focus();
  }, [editingId]);

  async function add(body) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kayıt eklemesin
    busyRef.current = true;
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/events`, body));
    busyRef.current = false;
    setBusy(false);
    return ok;
  }

  async function save(ev, body) {
    setEditingId(null);
    const ok = await mutate(d => patchEntry(d, 'events', ev.id, body), () => client.put(`/days/${date}/events/${ev.id}`, body));
    if (!ok) setEditingId(ev.id); // hata: düzenleme formu açık kalsın
    return ok;
  }

  function remove(ev) {
    focusAfterDelete(ev);
    mutate(d => removeEntry(d, 'events', ev.id), (cfg) => client.delete(`/days/${date}/events/${ev.id}`, cfg),
      { undo: deletedText(ev) });
  }

  return (
    <div className="card" ref={cardRef}>
      <div className="card-head">
        <div className="card-title"><span className="icon-tile evt">{EVENT_ICON}</span><h2 ref={headingRef} tabIndex={-1}>Aktiviteler</h2></div>
        {trainTotal > 0 && <span className="total sport">{formatDuration(trainTotal)} spor</span>}
      </div>

      {events.length === 0
        ? <div className="empty-note">Bu gün için aktivite yok.</div>
        : events.map(ev => {
          const training = isTraining(ev);
          const label = eventLabel(ev);
          if (editingId === ev.id) return (
            <div key={ev.id} className="entry-edit" ref={editRef}>
              <EventForm mode="edit" initial={ev} onSubmit={body => save(ev, body)} onCancel={() => setEditingId(null)} />
            </div>
          );
          const meta = eventMeta(ev);
          return (
            <div key={ev.id} className="entry">
              <span className={`ico ${training ? 'sport' : 'evt'}`} aria-hidden="true">{kindInfo(ev.kind).icon}</span>
              <div className="info">
                <div className="subj">{label}<AuditTag entry={ev} myId={myId} /></div>
                {ev.note && <div className="topic">{ev.note}</div>}
              </div>
              {meta && <span className={`when ${training ? 'sport' : 'evt'}`}>{meta}</span>}
              <button type="button" className="more" data-id={ev.id} aria-label={`${label}: seçenekler`} aria-haspopup="dialog"
                onClick={e => { openerRef.current = e.currentTarget; setMenu({ entry: ev, reset: menuReset }); }}>⋯</button>
            </div>
          );
        })
      }

      <div className="evadd">
        <EventForm mode="add" onSubmit={add} busy={busy} />
      </div>

      {menuEntry && (
        <EntryMenu kind="event" entry={menuEntry} myId={myId} returnFocusRef={openerRef}
          onClose={() => setMenu(null)} onEdit={() => setEditingId(menuEntry.id)} onDelete={() => remove(menuEntry)} />
      )}
    </div>
  );
}

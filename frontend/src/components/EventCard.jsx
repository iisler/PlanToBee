import { useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import { formatDuration } from '../utils/format';
import { deletedText, eventLabel, eventMeta, isTraining, kindInfo, trainingMinutes } from '../utils/events';
import AuditTag from './AuditTag';
import EventForm from './EventForm';
import ReadOnlyMark from './ReadOnlyMark';

const EVENT_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);

// Günün aktiviteleri tek listede (sunucu sıralar: önce saatliler saat sırasıyla, sonra saatsizler).
export default function EventCard({ date, events, myId, mutate }) {
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const trainTotal = trainingMinutes(events);

  async function add(body) {
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/events`, body));
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
    mutate(d => removeEntry(d, 'events', ev.id), (cfg) => client.delete(`/days/${date}/events/${ev.id}`, cfg),
      { undo: deletedText(ev) });
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span className="icon-tile evt">{EVENT_ICON}</span><h2>Aktiviteler</h2></div>
        {trainTotal > 0 && <span className="total sport">{formatDuration(trainTotal)} spor</span>}
      </div>

      {events.length === 0
        ? <div className="empty-note">Bu gün için planlı aktivite yok.</div>
        : events.map(ev => {
          const training = isTraining(ev);
          const label = eventLabel(ev);
          if (editingId === ev.id) return (
            <div key={ev.id} className="entry-edit">
              <EventForm mode="edit" initial={ev} onSubmit={body => save(ev, body)} onCancel={() => setEditingId(null)} />
            </div>
          );
          const meta = eventMeta(ev);
          return (
            <div key={ev.id} className="entry">
              <span className={`ico ${training ? 'sport' : 'evt'}`} aria-hidden="true">{kindInfo(ev.kind).icon}</span>
              <div className="info">
                <div className="subj">{label}</div>
                {ev.note && <div className="topic">{ev.note}</div>}
                {meta
                  ? <div className="meta"><span className={`mins ${training ? 'sport' : 'evt'}`}>{meta}</span><AuditTag entry={ev} myId={myId} /></div>
                  : <AuditTag entry={ev} myId={myId} />}
              </div>
              {ev.canEdit ? (
                <span className="entry-actions">
                  <button className="edit" aria-label={`${label} kaydını düzenle`} onClick={() => setEditingId(ev.id)}>✎</button>
                  <button className="del" aria-label={`${label} kaydını sil`} onClick={() => remove(ev)}>×</button>
                </span>
              ) : <ReadOnlyMark />}
            </div>
          );
        })
      }

      <div className="evadd">
        <EventForm mode="add" onSubmit={add} busy={busy} />
      </div>
    </div>
  );
}

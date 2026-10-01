import { useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import AuditTag from './AuditTag';
import TimeInput from './TimeInput';
import ReadOnlyMark from './ReadOnlyMark';

const EVENT_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
);

export default function EventCard({ date, events, myId, mutate }) {
  const [form, setForm] = useState({ title: '', time: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [busy, setBusy] = useState(false);

  async function addEvent(e) {
    e.preventDefault();
    if (!form.title.trim() || busy) return;
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/events`,
      { title: form.title.trim(), time: form.time.trim(), note: form.note.trim() }));
    setBusy(false);
    if (ok) setForm({ title: '', time: '', note: '' });
  }

  function deleteEvent(ev) {
    mutate(d => removeEntry(d, 'events', ev.id), (cfg) => client.delete(`/days/${date}/events/${ev.id}`, cfg),
      { undo: `${ev.title} etkinliği silindi` });
  }

  async function saveEdit(id) {
    if (!editForm.title.trim()) return;
    const body = { title: editForm.title.trim(), time: editForm.time.trim(), note: editForm.note.trim() };
    setEditingId(null);
    const ok = await mutate(d => patchEntry(d, 'events', id, body),
      () => client.put(`/days/${date}/events/${id}`, body));
    if (!ok) setEditingId(id);
  }

  function startEdit(ev) {
    setEditingId(ev.id);
    setEditForm({ title: ev.title, time: ev.time || '', note: ev.note || '' });
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span className="icon-tile evt">{EVENT_ICON}</span><h2>Etkinlikler</h2></div>
      </div>

      {events.length === 0
        ? <div className="empty-note">Bu gün için planlı etkinlik yok.</div>
        : events.map(ev => editingId === ev.id ? (
          <form key={ev.id} className="edit-form" onSubmit={e => { e.preventDefault(); saveEdit(ev.id); }}>
            <input name="etitle" aria-label="Etkinlik" placeholder="Etkinlik" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            <TimeInput name="etime" value={editForm.time} onChange={time => setEditForm(f => ({ ...f, time }))} />
            <input name="enote" aria-label="Not" placeholder="Not" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
            <button type="submit" className="save">Kaydet</button>
            <button type="button" className="cancel" onClick={() => setEditingId(null)}>İptal</button>
          </form>
        ) : (
          <div key={ev.id} className="entry">
            <span className="swatch evt" />
            <div className="info">
              <div className="subj">{ev.title}</div>
              {ev.note && <div className="topic">{ev.note}</div>}
              <AuditTag entry={ev} myId={myId} />
            </div>
            {ev.time && <span className="mins evt">{ev.time}</span>}
            {ev.canEdit ? (
              <span className="entry-actions">
                <button className="edit" aria-label={`${ev.title} etkinliğini düzenle`} onClick={() => startEdit(ev)}>✎</button>
                <button className="del" aria-label={`${ev.title} etkinliğini sil`} onClick={() => deleteEvent(ev)}>×</button>
              </span>
            ) : <ReadOnlyMark />}
          </div>
        ))
      }

      <form className="addform event" onSubmit={addEvent}>
        <input className="wide" aria-label="Etkinlik" placeholder="Etkinlik (ör. deneme sınavı)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <TimeInput className="time" value={form.time} onChange={time => setForm(f => ({ ...f, time }))} />
        <input aria-label="Not" placeholder="Not" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        <button type="submit" disabled={busy}>Ekle</button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import { formatDuration } from '../utils/format';
import AuditTag from './AuditTag';

const SPORT_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 3c2.5 2.5 2.5 15.5 0 18" /><path d="M4.5 8c4 2 11 2 15 0" /><path d="M4.5 16c4-2 11-2 15 0" /></svg>
);
const TYPES = ['Top', 'Kuvvet'];

function toMinutes(f) {
  return (parseInt(f.hours, 10) || 0) * 60 + (parseInt(f.minutes, 10) || 0);
}

export default function TrainingCard({ date, entries, totalMinutes, myId, mutate }) {
  const [form, setForm] = useState({ type: 'Top', hours: '', minutes: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [busy, setBusy] = useState(false);

  async function addTraining(e) {
    e.preventDefault();
    const minutes = toMinutes(form);
    if (minutes <= 0 || busy) return;
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/training`,
      { type: form.type, minutes, note: form.note }));
    setBusy(false);
    if (ok) setForm({ type: 'Top', hours: '', minutes: '', note: '' });
  }

  function deleteTraining(id) {
    mutate(d => removeEntry(d, 'trainingEntries', id), () => client.delete(`/days/${date}/training/${id}`));
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditForm({ type: t.type, hours: String(Math.floor(t.minutes / 60) || ''), minutes: String(t.minutes % 60 || ''), note: t.note || '' });
  }

  async function saveEdit(id) {
    const minutes = toMinutes(editForm);
    if (minutes <= 0) return;
    const body = { type: editForm.type, minutes, note: editForm.note };
    setEditingId(null);
    const ok = await mutate(d => patchEntry(d, 'trainingEntries', id, body),
      () => client.put(`/days/${date}/training/${id}`, body));
    if (!ok) setEditingId(id);
  }

  const setE = k => ev => setEditForm(f => ({ ...f, [k]: ev.target.value }));
  const editTypes = editingId && !TYPES.includes(editForm.type) ? [editForm.type, ...TYPES] : TYPES;

  return (
    <div className="card sport">
      <div className="card-head">
        <div className="card-title"><span className="icon-tile sport">{SPORT_ICON}</span><h2>Antrenman</h2></div>
        {totalMinutes > 0 && <span className="total">{formatDuration(totalMinutes)} toplam</span>}
      </div>

      {entries.length === 0
        ? <div className="empty-note">Bu gün için henüz antrenman kaydı yok.</div>
        : entries.map(e => editingId === e.id ? (
          <form key={e.id} className="edit-form sport" onSubmit={ev => { ev.preventDefault(); saveEdit(e.id); }}>
            <select aria-label="Antrenman türü" value={editForm.type} onChange={setE('type')}>
              {editTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input aria-label="Saat" type="number" min="0" placeholder="sa" className="num" value={editForm.hours} onChange={setE('hours')} />
            <input aria-label="Dakika" type="number" min="0" max="59" placeholder="dk" className="num" value={editForm.minutes} onChange={setE('minutes')} />
            <input aria-label="Not" placeholder="Not" value={editForm.note} onChange={setE('note')} />
            <button type="submit" className="save">Kaydet</button>
            <button type="button" className="cancel" onClick={() => setEditingId(null)}>İptal</button>
          </form>
        ) : (
          <div key={e.id} className="entry">
            <span className="swatch sport" />
            <div className="info">
              <div className="subj">{e.type}</div>
              {e.note && <div className="topic">{e.note}</div>}
              <AuditTag entry={e} myId={myId} />
            </div>
            <span className="mins sport">{formatDuration(e.minutes)}</span>
            {e.canEdit && <button className="edit" aria-label="Düzenle" onClick={() => startEdit(e)}>✎</button>}
            {e.canEdit && <button className="del" aria-label="Sil" onClick={() => deleteTraining(e.id)}>×</button>}
          </div>
        ))
      }

      <form className="addform sport" onSubmit={addTraining}>
        <select aria-label="Antrenman türü" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="number" min="0" placeholder="sa" aria-label="Saat" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
        <input type="number" min="0" max="59" placeholder="dk" aria-label="Dakika" value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} />
        <input placeholder="Not (opsiyonel)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        <button type="submit" disabled={busy}>Ekle</button>
      </form>
    </div>
  );
}

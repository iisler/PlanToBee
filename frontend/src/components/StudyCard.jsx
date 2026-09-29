import { useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import { nextStatus, STATUS_ORDER, STATUS_SHORT } from '../utils/format';
import AuditTag from './AuditTag';

const STUDY_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" /></svg>
);

export default function StudyCard({
  date, entries, totalMinutes, myId, mutate,
  subjects, onAddSubject, onDeleteSubject,
}) {
  const [form, setForm] = useState({ subject: '', topic: '', minutes: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const subjectNames = subjects.map(s => s.name);

  async function addEntry(e) {
    e.preventDefault();
    if (!form.subject || !form.minutes || busy) return;
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/entries`,
      { subject: form.subject, topic: form.topic, minutes: parseInt(form.minutes, 10) }));
    setBusy(false);
    if (ok) setForm(f => ({ subject: f.subject, topic: '', minutes: '' }));
  }

  function deleteEntry(id) {
    mutate(d => removeEntry(d, 'studyEntries', id), () => client.delete(`/days/${date}/entries/${id}`));
  }

  function cycleStatus(entry) {
    const status = nextStatus(entry.status);
    mutate(d => patchEntry(d, 'studyEntries', entry.id, { status }),
      () => client.patch(`/days/${date}/entries/${entry.id}/status`, { status }));
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditForm({ subject: entry.subject, topic: entry.topic || '', minutes: String(entry.minutes), status: entry.status });
  }

  async function saveEdit(id) {
    const minutes = parseInt(editForm.minutes, 10);
    if (!editForm.subject || !minutes) return;
    const body = { subject: editForm.subject, topic: editForm.topic, minutes, status: editForm.status };
    setEditingId(null);
    const ok = await mutate(d => patchEntry(d, 'studyEntries', id, body),
      () => client.put(`/days/${date}/entries/${id}`, body));
    if (!ok) setEditingId(id); // hata: düzenleme formu açık kalsın, girilenler kaybolmasın
  }

  async function addSubject(e) {
    e.preventDefault();
    const name = newSubject.trim();
    if (!name) return;
    if (await onAddSubject(name)) setNewSubject('');
  }

  // Düzenlenen kaydın dersi listede yoksa (silinmiş olabilir) seçenek olarak yine de göster
  const editOptions = editingId && editForm.subject && !subjectNames.includes(editForm.subject)
    ? [editForm.subject, ...subjectNames] : subjectNames;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><span className="icon-tile study">{STUDY_ICON}</span><h2>Çalışma Planı</h2></div>
        {totalMinutes > 0 && <span className="total">{totalMinutes} dk toplam</span>}
      </div>
      {entries.some(e => e.canEdit) && <div className="hint">Rozete dokunarak durumu değiştirin: Yapılacak → Devam Ediyor → Tamamlandı</div>}

      {entries.length === 0
        ? <div className="empty-note">Bu gün için henüz ders kaydı yok.</div>
        : entries.map(e => editingId === e.id ? (
          <form key={e.id} className="edit-form study" onSubmit={ev => { ev.preventDefault(); saveEdit(e.id); }}>
            <select aria-label="Ders" value={editForm.subject} onChange={ev => setEditForm(f => ({ ...f, subject: ev.target.value }))}>
              {editOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input aria-label="Konu" placeholder="Konu" value={editForm.topic} onChange={ev => setEditForm(f => ({ ...f, topic: ev.target.value }))} />
            <input aria-label="Dakika" type="number" min="1" max="1440" placeholder="dk" className="num" value={editForm.minutes} onChange={ev => setEditForm(f => ({ ...f, minutes: ev.target.value }))} />
            <select aria-label="Durum" value={editForm.status} onChange={ev => setEditForm(f => ({ ...f, status: ev.target.value }))}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_SHORT[s]}</option>)}
            </select>
            <button type="submit" className="save">Kaydet</button>
            <button type="button" className="cancel" onClick={() => setEditingId(null)}>İptal</button>
          </form>
        ) : (
          <div key={e.id} className="entry">
            {e.canEdit
              ? <button className={`status-badge status-${e.status}`} onClick={() => cycleStatus(e)}>{STATUS_SHORT[e.status]}</button>
              : <span className={`status-badge status-${e.status}`}>{STATUS_SHORT[e.status]}</span>}
            <div className="info">
              <div className={`subj${e.status === 'done' ? ' done' : ''}`}>{e.subject}</div>
              {e.topic && <div className="topic">{e.topic}</div>}
              <AuditTag entry={e} myId={myId} />
            </div>
            <span className="mins">{e.minutes} dk</span>
            {e.canEdit && <button className="edit" aria-label="Düzenle" onClick={() => startEdit(e)}>✎</button>}
            {e.canEdit && <button className="del" aria-label="Sil" onClick={() => deleteEntry(e.id)}>×</button>}
          </div>
        ))
      }

      <form className="addform" onSubmit={addEntry}>
        <select aria-label="Ders" value={form.subject} onChange={ev => setForm(f => ({ ...f, subject: ev.target.value }))}>
          <option value="">Ders seçin</option>
          {subjectNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input name="topic" placeholder="Konu (opsiyonel)" value={form.topic} onChange={ev => setForm(f => ({ ...f, topic: ev.target.value }))} />
        <input name="minutes" type="number" min="1" max="1440" placeholder="dk" value={form.minutes} onChange={ev => setForm(f => ({ ...f, minutes: ev.target.value }))} />
        <button type="submit" disabled={busy}>Ekle</button>
      </form>

      <>
          <button className="manage-toggle" onClick={() => setSubjectsOpen(o => !o)}>
            {subjectsOpen ? '▲ Ders listesini kapat' : '✎ Dersleri düzenle (ekle/sil)'}
          </button>

          {subjectsOpen && (
            <div className="subject-panel">
              {subjects.length === 0
                ? <div className="empty-note">Henüz ders eklenmemiş.</div>
                : subjects.map(s => (
                  <span key={s.id} className="subject-chip">
                    {s.name}
                    {s.canEdit && <button className="x" aria-label={`${s.name} dersini sil`} onClick={() => onDeleteSubject(s)}>×</button>}
                  </span>
                ))
              }
              <form className="subject-addrow" onSubmit={addSubject}>
                <input id="new-subject" aria-label="Yeni ders adı" placeholder="Yeni ders adı (ör. Almanca)" value={newSubject}
                  onChange={e => setNewSubject(e.target.value)} />
                <button type="submit">Ekle</button>
              </form>
            </div>
          )}
      </>
    </div>
  );
}

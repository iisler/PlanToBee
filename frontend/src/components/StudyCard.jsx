import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { patchEntry, removeEntry } from '../hooks/useMutation';
import { nextStatus, STATUS_ORDER, STATUS_SHORT } from '../utils/format';
import AuditTag from './AuditTag';
import EntryMenu from './EntryMenu';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';

// Ders listesi boşken tek dokunuşla eklenebilen öneriler
const SUGGESTED_SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'İngilizce', 'Tarih'];

const STUDY_ICON = (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" /></svg>
);

// Günün çalışma planı. Satır: durum dairesi · ders ve konu · süre · ⋯ menüsü.
// - Durum dairesine ailedeki herkes dokunabilir (çocuk, ebeveynin eklediği dersi de işaretler).
// - Düzenle / Sil ⋯ menüsünde, yalnızca canEdit kayıtlarda.
// - Ekleme formunun durumu (addForm) üst bileşende tutulur: gün değişince form açık kalır, ders seçimi korunur
//   ve sonraki "Ekle" yeni seçili güne ekler.
// dateLabel: "Cumartesi 10 Ekim" (Ekle düğmesinin erişilebilir adı için). menuReset değişince açık menü kapanır.
export default function StudyCard({
  date, dateLabel, entries, myId, mutate,
  subjects, onAddSubject, onDeleteSubject,
  addForm, setAddForm, menuReset,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newSubject, setNewSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [addError, setAddError] = useState('');
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const [announce, setAnnounce] = useState('');
  const openerRef = useRef(null);
  const addBtnRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const focusAfterDelete = useFocusAfterDelete(entries, cardRef, () => addBtnRef.current ?? headingRef.current);
  const minutesRef = useRef(null);
  const subjectRef = useRef(null);
  const focusAddBtn = useRef(false);
  const focusSubject = useRef(false);
  const subjectNames = subjects.map(s => s.name);
  const form = addForm;
  const setForm = (fn) => setAddForm(f => ({ ...f, ...fn(f) }));

  // Menü, açıldığı andaki menuReset değeriyle tutulur: bildirimden gün açılınca (menuReset artar) kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;

  // Form açılınca odak ders seçimine; "İptal" sonrası "+ Ders ekle"ye döner (düğme ancak form kapanınca görünür).
  // Gün değişip kart yeniden kurulduğunda odak taşınmaz.
  useEffect(() => {
    if (form.open && focusSubject.current) subjectRef.current?.focus();
    if (!form.open && focusAddBtn.current) addBtnRef.current?.focus();
    focusSubject.current = false;
    focusAddBtn.current = false;
  }, [form.open]);

  // ⋯ → Düzenle: açan düğme satırla birlikte kalktığı için odak formun ilk alanına taşınır.
  // (autoFocus yerine etki: menü kapanırken kök hâlâ inert olduğundan autoFocus tutmuyor.)
  const editSelectRef = useRef(null);
  useEffect(() => {
    if (editingId != null) editSelectRef.current?.focus();
  }, [editingId]);

  const done = entries.filter(e => e.status === 'done').length;
  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);

  async function addEntry(e) {
    e.preventDefault();
    if (busyRef.current) return; // hızlı çift dokunuş iki kayıt eklemesin
    const minutes = parseInt(form.minutes, 10);
    if (!form.subject) return setAddError('Ders seç.');
    if (!(minutes >= 1 && minutes <= 1440)) return setAddError('Süreyi dakika olarak gir (1-1440).');
    setAddError('');
    busyRef.current = true;
    setBusy(true);
    const ok = await mutate(null, () => client.post(`/days/${date}/entries`,
      { subject: form.subject, topic: form.topic, minutes }));
    busyRef.current = false;
    setBusy(false);
    if (ok) {
      setForm(() => ({ topic: '', minutes: '' }));
      if (minutesRef.current?.isConnected) minutesRef.current.focus();
    }
  }

  function openForm() {
    setAddError('');
    focusSubject.current = true;
    setForm(() => ({ open: true }));
  }

  function closeForm() {
    setAddError('');
    focusAddBtn.current = true;
    setForm(() => ({ open: false, subjectsOpen: false }));
  }

  function deleteEntry(entry) {
    focusAfterDelete(entry);
    mutate(d => removeEntry(d, 'studyEntries', entry.id), (cfg) => client.delete(`/days/${date}/entries/${entry.id}`, cfg),
      { undo: `${entry.subject} kaydı silindi` });
  }

  function cycleStatus(entry) {
    const status = nextStatus(entry.status);
    setAnnounce(`${entry.subject}: ${STATUS_SHORT[status]}`);
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
  // Seçili ders listeden silindiyse seçim boş sayılır
  const selectedSubject = subjectNames.includes(form.subject) ? form.subject : '';

  return (
    <div className="card" ref={cardRef}>
      <div className="card-head">
        <div className="card-title"><span className="icon-tile study">{STUDY_ICON}</span><h2 ref={headingRef} tabIndex={-1}>Çalışma Planı</h2></div>
        {entries.length > 0 && <span className="card-sum">{done}/{entries.length} · {totalMinutes} dk</span>}
      </div>
      <span className="sr-only" aria-live="polite">{announce}</span>

      {entries.length === 0
        ? <div className="empty-note">Bu gün için ders yok.</div>
        : entries.map(e => editingId === e.id ? (
          <form key={e.id} className="edit-form study" onSubmit={ev => { ev.preventDefault(); saveEdit(e.id); }}>
            <select aria-label="Ders" ref={editSelectRef} value={editForm.subject} onChange={ev => setEditForm(f => ({ ...f, subject: ev.target.value }))}>
              {editOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input aria-label="Konu" placeholder="Konu" value={editForm.topic} onChange={ev => setEditForm(f => ({ ...f, topic: ev.target.value }))} />
            <input aria-label="Dakika" type="number" inputMode="numeric" min="1" max="1440" placeholder="dk" className="num" value={editForm.minutes} onChange={ev => setEditForm(f => ({ ...f, minutes: ev.target.value }))} />
            <select aria-label="Durum" value={editForm.status} onChange={ev => setEditForm(f => ({ ...f, status: ev.target.value }))}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_SHORT[s]}</option>)}
            </select>
            <button type="submit" className="save">Kaydet</button>
            <button type="button" className="cancel" onClick={() => setEditingId(null)}>İptal</button>
          </form>
        ) : (
          <div key={e.id} className="entry">
            <button type="button" className={`st st-${e.status}`} onClick={() => cycleStatus(e)}
              aria-label={`${e.subject}: ${STATUS_SHORT[e.status]}. Dokununca ${STATUS_SHORT[nextStatus(e.status)]} olur.`}>
              <i aria-hidden="true">{e.status === 'done' ? '✓' : ''}</i>
            </button>
            <div className="info">
              <div className={`subj${e.status === 'done' ? ' done' : ''}`}>{e.subject}<AuditTag entry={e} myId={myId} /></div>
              {e.topic && <div className="topic">{e.topic}</div>}
            </div>
            <span className="mins">{e.minutes} dk</span>
            <button type="button" className="more" data-id={e.id} aria-label={`${e.subject}: seçenekler`} aria-haspopup="dialog"
              onClick={ev => { openerRef.current = ev.currentTarget; setMenu({ entry: e, reset: menuReset }); }}>⋯</button>
          </div>
        ))
      }

      {subjectNames.length === 0 ? (
        <div className="subject-onboard">
          <b>Önce derslerini ekle</b>
          <span>Dokunarak ekle ya da kendin yaz:</span>
          <div className="suggest">
            {SUGGESTED_SUBJECTS.map(n => <button key={n} type="button" onClick={() => onAddSubject(n)}>+ {n}</button>)}
          </div>
          <form className="subject-addrow" onSubmit={addSubject}>
            <input aria-label="Ders adı" placeholder="Ders adı (ör. Geometri)" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
            <button type="submit">Ekle</button>
          </form>
        </div>
      ) : !form.open ? (
        <button type="button" ref={addBtnRef} className="add-study" onClick={openForm}>+ Ders ekle</button>
      ) : (
        <>
          <form className="addform" onSubmit={addEntry} noValidate>
            <select className="full" ref={subjectRef} aria-label="Ders" value={selectedSubject} onChange={ev => { setAddError(''); const v = ev.target.value; setForm(() => ({ subject: v })); }}>
              <option value="">Ders seç</option>
              {subjectNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input name="topic" aria-label="Konu" placeholder="Konu (isteğe bağlı)" value={form.topic}
              onChange={ev => { const v = ev.target.value; setForm(() => ({ topic: v })); }} />
            <input name="minutes" ref={minutesRef} aria-label="Dakika" type="number" inputMode="numeric" min="1" max="1440" placeholder="dk" value={form.minutes}
              onChange={ev => { setAddError(''); const v = ev.target.value; setForm(() => ({ minutes: v })); }} />
            {addError && <div className="inline-error full" role="alert">{addError}</div>}
            <div className="addform-actions">
              <button type="submit" className="go" disabled={busy} aria-label={`${dateLabel} gününe ekle`}>Ekle</button>
              <button type="button" className="btn-ghost" onClick={closeForm}>İptal</button>
              <button type="button" className="manage-toggle" aria-expanded={form.subjectsOpen}
                onClick={() => setForm(f => ({ subjectsOpen: !f.subjectsOpen }))}>Dersleri düzenle</button>
            </div>
          </form>

          {form.subjectsOpen && (
            <div className="subject-panel">
              {subjects.map(s => (
                <span key={s.id} className="subject-chip">
                  {s.name}
                  {s.canEdit && <button className="x" aria-label={`${s.name} dersini sil`} onClick={() => onDeleteSubject(s)}>×</button>}
                </span>
              ))}
              <form className="subject-addrow" onSubmit={addSubject}>
                <input id="new-subject" aria-label="Yeni ders adı" placeholder="Yeni ders adı (ör. Almanca)" value={newSubject}
                  onChange={e => setNewSubject(e.target.value)} />
                <button type="submit">Ekle</button>
              </form>
            </div>
          )}
        </>
      )}

      {menuEntry && (
        <EntryMenu kind="study" entry={menuEntry} myId={myId} returnFocusRef={openerRef}
          onClose={() => setMenu(null)} onEdit={() => startEdit(menuEntry)} onDelete={() => deleteEntry(menuEntry)} />
      )}
    </div>
  );
}

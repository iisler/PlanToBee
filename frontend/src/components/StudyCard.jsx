import { useEffect, useMemo, useRef, useState } from 'react';
import { nextStatus, STATUS_SHORT } from '../utils/format';
import { itemKey, studyItem, toMin } from '../utils/timeline';
import AuditTag from './AuditTag';
import EntryMenu from './EntryMenu';
import StudyForm, { studyDraft } from './StudyForm';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';

// Ders listesi boşken tek dokunuşla eklenebilen öneriler
const SUGGESTED_SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'İngilizce', 'Tarih'];

// To-do (Dersler) sırası: saatliler başlangıca göre, sonra saatsizler eklenme sırasıyla (sunucu sırası)
export function sortStudies(entries) {
  const timed = entries.filter(e => toMin(e.startTime) != null).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  return [...timed, ...entries.filter(e => toMin(e.startTime) == null)];
}

// To-do (Dersler, Görev 10): günün dersleri kontrol listesi. Üstte yalnızca özet ("1/3 · 100 dk") ve ilerleme çubuğu.
// Satır: durum dairesi · ders ve konu · "15:00 · 40 dk" (saatsizde "30 dk") · ⋯ menüsü.
// - Durum dairesine ailedeki herkes dokunabilir (çocuk, ebeveynin eklediği dersi de işaretler). Durum Bee ile aynı
//   kaynaktan (actions.cycle) değişir.
// - Düzenle / Sil ⋯ menüsünde, yalnızca canEdit kayıtlarda; düzenleme formu (StudyForm) satırın yerinde açılır.
// - Ekleme formunun durumu (addForm) üst bileşende tutulur: gün değişince form açık kalır, ders seçimi korunur
//   ve sonraki "Ekle" yeni seçili güne ekler.
// items: Bee öğeleri (çakışma uyarısı için). actions: DayPage'deki ders işlemleri (cycle, add, save, remove).
// dateLabel: "Cumartesi 10 Ekim" (Ekle düğmesinin erişilebilir adı için). menuReset değişince açık menü kapanır.
export default function StudyCard({
  date, dateLabel, entries, items, actions, myId, panel,
  subjects, onAddSubject, onDeleteSubject,
  addForm, setAddForm, menuReset,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [newSubject, setNewSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const openerRef = useRef(null);
  const addBtnRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const rows = useMemo(() => sortStudies(entries), [entries]);
  const focusAfterDelete = useFocusAfterDelete(rows, cardRef, () => addBtnRef.current ?? headingRef.current);
  const minutesRef = useRef(null);
  const subjectRef = useRef(null);
  const focusAddBtn = useRef(false);
  const focusSubject = useRef(false);
  const subjectNames = subjects.map(s => s.name);
  const form = addForm;
  const setForm = (fn) => setAddForm(f => ({ ...f, ...fn(f) }));

  // Menü, açıldığı andaki menuReset değeriyle tutulur: bildirimden gün açılınca (menuReset artar) kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;

  // Gün değişince satır içi düzenleme kapanır
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setEditingId(null); }

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

  async function addEntry(body) {
    if (busyRef.current) return false; // hızlı çift dokunuş iki kayıt eklemesin
    busyRef.current = true;
    setBusy(true);
    const created = await actions.add(body);
    busyRef.current = false;
    setBusy(false);
    if (created) {
      setForm(() => ({ topic: '', minutes: '', startTime: '' }));
      if (minutesRef.current?.isConnected) minutesRef.current.focus();
    }
    return !!created;
  }

  function openForm() {
    focusSubject.current = true;
    setForm(() => ({ open: true }));
  }

  function closeForm() {
    focusAddBtn.current = true;
    setForm(() => ({ open: false, subjectsOpen: false }));
  }

  function deleteEntry(entry) {
    focusAfterDelete(entry);
    actions.remove(entry);
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditForm(studyDraft(entry));
  }

  function focusRow(id) {
    requestAnimationFrame(() => cardRef.current?.querySelector(`[data-id="${id}"]`)?.focus());
  }

  async function saveEdit(entry, body) {
    setEditingId(null);
    focusRow(entry.id);
    const ok = await actions.save(entry, body);
    if (!ok) setEditingId(entry.id); // hata: düzenleme formu açık kalsın, girilenler kaybolmasın
    return ok;
  }

  function cancelEdit() {
    const id = editingId;
    setEditingId(null);
    focusRow(id);
  }

  async function addSubject(e) {
    e.preventDefault();
    const name = newSubject.trim();
    if (!name) return;
    if (await onAddSubject(name)) setNewSubject('');
  }

  const exclude = (e) => itemKey(studyItem(e));

  return (
    <div className="card" ref={cardRef} {...panel}>
      <div className="card-head">
        <h2 className="sumh" ref={headingRef} tabIndex={-1}>{entries.length ? `${done}/${entries.length} · ${totalMinutes} dk` : 'Ders yok'}</h2>
      </div>
      {entries.length > 0 && <div className="prog" aria-hidden="true"><i style={{ width: `${Math.round((done / entries.length) * 100)}%` }} /></div>}

      {rows.length === 0
        ? <div className="empty-note">Bu gün için ders yok.</div>
        : rows.map(e => editingId === e.id && editForm ? (
          <div key={e.id} className="entry-edit">
            <StudyForm mode="edit" value={editForm} onChange={p => setEditForm(f => ({ ...f, ...p }))} subjects={subjectNames}
              items={items} excludeKey={exclude(e)} subjectRef={editSelectRef}
              onSubmit={body => saveEdit(e, body)} onCancel={cancelEdit} />
          </div>
        ) : (
          <div key={e.id} className="entry">
            <button type="button" className={`st st-${e.status}`} onClick={() => actions.cycle(e)}
              aria-label={`${e.subject}: ${STATUS_SHORT[e.status]}. Dokununca ${STATUS_SHORT[nextStatus(e.status)]} olur.`}>
              <i aria-hidden="true">{e.status === 'done' ? '✓' : ''}</i>
            </button>
            <div className="info">
              <div className={`subj${e.status === 'done' ? ' done' : ''}`}>{e.subject}<AuditTag entry={e} myId={myId} /></div>
              {e.topic && <div className="topic">{e.topic}</div>}
            </div>
            <span className="mins">{e.startTime ? <><b>{e.startTime}</b> · {e.minutes} dk</> : `${e.minutes} dk`}</span>
            <button type="button" className="more" data-id={e.id} aria-haspopup="dialog"
              aria-label={`${e.subject}${e.startTime ? `, ${e.startTime}` : ''}, ${e.minutes} dakika: seçenekler`}
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
          <StudyForm mode="add" value={form} onChange={p => setForm(() => p)} subjects={subjectNames} items={items}
            subjectRef={subjectRef} minutesRef={minutesRef} busy={busy} submitLabel={`${dateLabel} gününe ekle`}
            onSubmit={addEntry} onCancel={closeForm}
            extra={(
              <button type="button" className="manage-toggle" aria-expanded={form.subjectsOpen}
                onClick={() => setForm(f => ({ subjectsOpen: !f.subjectsOpen }))}>Dersleri düzenle</button>
            )} />

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

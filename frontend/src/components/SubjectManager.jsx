import { useState } from 'react';

// Ders listesi boşken tek dokunuşla eklenebilen öneriler
const SUGGESTED_SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'İngilizce', 'Tarih'];

// Ailenin ders listesi (Görev 17: To-do kartından ayrıldı; Ekle sayfasında ve Dersler sayfasındaki "Ders listesi"nde).
// Liste boşsa öneriler; doluysa silinebilir çipler (yalnızca canEdit olanlar). Altında yeni ders ekleme satırı.
// onAdd(ad) true dönerse alan temizlenir; onDelete(ders).
export default function SubjectManager({ subjects, onAdd, onDelete }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(value) {
    const n = value.trim();
    if (!n || busy) return; // çift dokunuş mükerrer ders eklemesin
    setBusy(true);
    const ok = await onAdd(n);
    setBusy(false);
    if (ok && value === name) setName('');
  }

  const row = (
    <form className="subject-addrow" onSubmit={(e) => { e.preventDefault(); add(name); }}>
      <input aria-label="Yeni ders adı" placeholder="Ders adı (ör. Geometri)" maxLength={100} value={name} onChange={e => setName(e.target.value)} />
      <button type="submit" disabled={busy}>Ekle</button>
    </form>
  );

  if (subjects.length === 0) return (
    <div className="subject-onboard">
      <b>Önce derslerini ekle</b>
      <span>Dokunarak ekle ya da kendin yaz:</span>
      <div className="suggest">
        {SUGGESTED_SUBJECTS.map(n => <button key={n} type="button" disabled={busy} onClick={() => add(n)}>+ {n}</button>)}
      </div>
      {row}
    </div>
  );

  return (
    <div className="subject-panel">
      {subjects.map(s => (
        <span key={s.id} className="subject-chip">
          {s.name}
          {s.canEdit && <button type="button" className="x" aria-label={`${s.name} dersini sil`} onClick={() => onDelete(s)}>×</button>}
        </span>
      ))}
      {row}
    </div>
  );
}

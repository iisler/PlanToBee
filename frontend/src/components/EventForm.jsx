import { useState } from 'react';
import TimeInput from './TimeInput';
import { TRAINING_TYPES } from '../utils/events';

const OTHER = '__other';

function initialState(kind, initial = {}) {
  const type = initial.trainingType ?? '';
  const preset = TRAINING_TYPES.includes(type);
  const minutes = initial.minutes ?? 0;
  return {
    kind,
    title: initial.title ?? '',
    time: initial.time ?? '',
    note: initial.note ?? '',
    typeChoice: !type ? TRAINING_TYPES[0] : preset ? type : OTHER,
    customType: preset ? '' : type,
    hours: minutes >= 60 ? String(Math.floor(minutes / 60)) : '',
    mins: minutes % 60 ? String(minutes % 60) : '',
  };
}

// Etkinlik ya da antrenman ekleme / düzenleme formu (gün kartı, hafta tablosu ve hafta listesi ortak kullanır).
// - mode 'add': başta "Etkinlik | Antrenman" tür seçici; tür değişince saat ve not korunur.
// - mode 'edit': tür sabittir (kaydın türü değiştirilemez).
// - Antrenman türü hazır listeden seçilir ya da "Diğer…" ile yazılır.
// onSubmit(body) true dönerse (başarılı) ekleme formu temizlenir.
export default function EventForm({ mode = 'add', kind: initialKind = 'Event', initial, onSubmit, onCancel, showNote = true, compact = false, busy = false }) {
  const [f, setF] = useState(() => initialState(initialKind, initial));
  const [error, setError] = useState('');
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setError(''); };
  const setE = (k) => (e) => set(k)(e.target.value);
  const training = f.kind === 'Training';

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    let body;
    if (training) {
      const trainingType = (f.typeChoice === OTHER ? f.customType : f.typeChoice).trim();
      const minutes = (parseInt(f.hours, 10) || 0) * 60 + (parseInt(f.mins, 10) || 0);
      if (!trainingType) return setError('Antrenman türünü yazın.');
      if (minutes <= 0) return setError('Süreyi girin.');
      if (minutes > 1440) return setError('Süre en fazla 24 saat olabilir.');
      body = { trainingType, minutes, time: f.time, note: f.note.trim() };
    } else {
      if (!f.title.trim()) return setError('Etkinlik adını yazın.');
      body = { title: f.title.trim(), time: f.time, note: f.note.trim() };
    }
    if (mode === 'add') body.kind = f.kind;
    const ok = await onSubmit(body);
    if (ok && mode === 'add') setF((s) => ({ ...initialState(s.kind), typeChoice: s.typeChoice, time: '' }));
  }

  return (
    <form className={`evform${compact ? ' compact' : ''}${training ? ' training' : ''}`} onSubmit={submit} noValidate>
      {mode === 'add' && (
        <div className="seg evkind" role="group" aria-label="Tür">
          <button type="button" className={!training ? 'active' : ''} aria-pressed={!training} onClick={() => set('kind')('Event')}>Etkinlik</button>
          <button type="button" className={training ? 'active' : ''} aria-pressed={training} onClick={() => set('kind')('Training')}>Antrenman</button>
        </div>
      )}

      {training ? (
        <div className="evrow">
          <select aria-label="Antrenman türü" className="grow" value={f.typeChoice} onChange={setE('typeChoice')}>
            {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value={OTHER}>Diğer…</option>
          </select>
          {f.typeChoice === OTHER && (
            <input className="grow" aria-label="Antrenman türü (yaz)" placeholder="Tür (ör. Yüzme)" maxLength={50}
              value={f.customType} onChange={setE('customType')} autoFocus={mode === 'add'} />
          )}
        </div>
      ) : (
        <div className="evrow">
          <input className="grow" aria-label="Etkinlik adı" placeholder="Etkinlik (ör. deneme sınavı)" maxLength={150}
            value={f.title} onChange={setE('title')} aria-invalid={error ? true : undefined} />
        </div>
      )}

      <div className="evrow">
        {training && (
          <>
            <input type="number" inputMode="numeric" min="0" max="24" placeholder="sa" className="num" aria-label="Süre (saat)"
              value={f.hours} onChange={setE('hours')} />
            <input type="number" inputMode="numeric" min="0" max="59" placeholder="dk" className="num" aria-label="Süre (dakika)"
              value={f.mins} onChange={setE('mins')} />
          </>
        )}
        <TimeInput value={f.time} onChange={set('time')} label={training ? 'Başlama saati (isteğe bağlı)' : 'Saat (isteğe bağlı)'} />
      </div>

      {showNote && (
        <div className="evrow">
          <input className="grow" aria-label="Not" placeholder="Not (isteğe bağlı)" maxLength={500} value={f.note} onChange={setE('note')} />
        </div>
      )}

      {error && <div className="inline-error" role="alert">{error}</div>}

      <div className="evrow evactions">
        <button type="submit" className={`evsubmit ${training ? 'sport' : 'event'}`} disabled={busy}>{mode === 'add' ? 'Ekle' : 'Kaydet'}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  );
}

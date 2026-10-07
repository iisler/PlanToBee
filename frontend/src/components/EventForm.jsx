import { useState } from 'react';
import TimeInput from './TimeInput';
import { ACTIVITY_KINDS, eventLabel, isTraining, kindInfo } from '../utils/events';

function initialState(initial) {
  return {
    title: initial ? eventLabel(initial) : '',
    time: initial?.time ?? '',
    note: initial?.note ?? '',
  };
}

// Aktivite ekleme / düzenleme formu (gün kartı, hafta tablosu ve hafta listesi ortak kullanır).
// - mode 'add': tür ikonları (Spor, Müzik, Konser, Buluşma, Sınav, Diğer). İkona dokununca ad, saat ve not açılır;
//   aynı ikona yeniden dokunmak, İptal ya da başarılı ekleme formu kapatır.
// - mode 'edit': tür sabittir. Eski antrenmanların adı türden türetilip kutuya yazılır; kaydedince ad olarak saklanır,
//   eski süre olduğu gibi korunur.
// Ad boş bırakılırsa türün adı kullanılır; Diğer'de ad zorunludur.
// onSubmit(body) true dönerse (başarılı) ekleme formu kapanır.
export default function EventForm({ mode = 'add', initial, onSubmit, onCancel, showNote = true, compact = false, busy = false }) {
  const [kind, setKind] = useState(mode === 'edit' ? initial?.kind : null);
  const [f, setF] = useState(() => initialState(mode === 'edit' ? initial : null));
  const [error, setError] = useState('');
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setError(''); };
  const setE = (k) => (e) => set(k)(e.target.value);
  const info = kind ? kindInfo(kind) : null;

  function pick(k) {
    setError('');
    setKind((cur) => (cur === k ? null : k));
  }

  function close() {
    setKind(null);
    setF(initialState(null));
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    if (busy || !info) return;
    const name = f.title.trim();
    if (!name && info.nameRequired) return setError('Aktivite adını yaz.');
    const body = { title: name || info.label, time: f.time, note: f.note.trim() };
    if (mode === 'add') body.kind = kind;
    else if (isTraining(initial)) { body.trainingType = null; body.minutes = initial.minutes ?? null; }
    const ok = await onSubmit(body);
    if (ok && mode === 'add') close();
  }

  const cancel = mode === 'add' ? close : onCancel;

  return (
    <div className={`evform${compact ? ' compact' : ''}`}>
      {mode === 'add' && (
        <div className="acts" role="group" aria-label="Aktivite türü">
          {ACTIVITY_KINDS.map((k) => (
            <button key={k.kind} type="button" className={kind === k.kind ? 'on' : ''} aria-pressed={kind === k.kind} onClick={() => pick(k.kind)}>
              <span className="ai" aria-hidden="true">{k.icon}</span>{k.label}
            </button>
          ))}
        </div>
      )}

      {info && (
        <form className="evfields" onSubmit={submit} noValidate>
          <div className="evrow">
            <input className="grow" aria-label={`${info.label} adı`} placeholder={info.placeholder} maxLength={150}
              value={f.title} onChange={setE('title')} aria-invalid={error ? true : undefined} autoFocus={mode === 'add'} />
          </div>
          <div className="evrow">
            <TimeInput value={f.time} onChange={set('time')} label="Saat (isteğe bağlı)" />
            {showNote && <input className="grow" aria-label="Not" placeholder="Not (isteğe bağlı)" maxLength={500} value={f.note} onChange={setE('note')} />}
          </div>

          {error && <div className="inline-error" role="alert">{error}</div>}

          <div className="evrow evactions">
            <button type="submit" className={`evsubmit ${mode === 'add' ? 'add' : isTraining(initial) ? 'sport' : 'event'}`} disabled={busy}>{mode === 'add' ? 'Ekle' : 'Kaydet'}</button>
            {cancel && <button type="button" className="btn-ghost" onClick={cancel}>İptal</button>}
          </div>
        </form>
      )}
    </div>
  );
}

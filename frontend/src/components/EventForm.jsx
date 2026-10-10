import { useState } from 'react';
import TimeInput from './TimeInput';
import { ACTIVITY_KINDS, eventLabel, isTraining, kindInfo } from '../utils/events';
import { formatDuration } from '../utils/format';
import { addMinutes, endOf, hm, overlapText, overlapping, toMin } from '../utils/timeline';

const CHIPS = [
  { mins: 30, label: '30 dk' },
  { mins: 60, label: '1 sa' },
  { mins: 120, label: '2 sa' },
  { mins: 240, label: '4 sa' },
];

function initialState(initial) {
  return {
    title: initial ? eventLabel(initial) : '',
    time: initial?.time ?? '',
    // Düzenlemede gerçek bitiş, yoksa eski süreden türetilen bitiş dolar (kaydedilince gerçek bitiş olur)
    endTime: initial ? (endOf(initial) ?? '') : '',
    note: initial?.note ?? '',
  };
}

// Aktivite ekleme / düzenleme formu (gün kartı).
// - mode 'add': tür ikonları (Spor, Müzik, Konser, Buluşma, Sınav, Diğer). İkona dokununca ad, Başlangıç – Bitiş, süre
//   çipleri, özet ve not açılır; aynı ikona yeniden dokunmak, İptal ya da başarılı ekleme formu kapatır.
//   prefill ({ start, end }): boşluktaki "+ Ekle"den gelme; üstte "… aralığına ekliyorsun" satırı, tür seçilince saatler dolu.
// - mode 'edit': tür sabittir. Eski antrenmanların adı türden türetilip kutuya yazılır; eski süre olduğu gibi korunur.
//   endTime her zaman gönderilir (bitiş yoksa ""), böylece silinen bitiş sunucuda da silinir.
// Ad boş bırakılırsa türün adı kullanılır; Diğer'de ad zorunludur. Bitiş isteğe bağlı; başlangıç yokken girilemez.
// events: günün kayıtları (çakışma uyarısı için; engellemez). onSubmit(body) true dönerse ekleme formu kapanır.
export default function EventForm({ mode = 'add', initial, onSubmit, onCancel, busy = false, events = [], prefill, onClearPrefill }) {
  const [kind, setKind] = useState(mode === 'edit' ? initial?.kind : null);
  const [f, setF] = useState(() => initialState(mode === 'edit' ? initial : null));
  const [error, setError] = useState('');
  const info = kind ? kindInfo(kind) : null;
  const setE = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); setError(''); };

  // Yeni bir boşluktan gelince tür seçimi sıfırlanır (kullanıcı türü yeniden seçer)
  const [lastPrefill, setLastPrefill] = useState(prefill);
  if (prefill !== lastPrefill) {
    setLastPrefill(prefill);
    if (prefill) { setKind(null); setF(initialState(null)); setError(''); }
  }

  const startMin = toMin(f.time);
  const hasStart = startMin != null;
  const endMin = hasStart ? toMin(f.endTime) : null;
  const same = endMin != null && endMin === startMin;
  const dur = endMin != null && !same ? (endMin - startMin + 1440) % 1440 : null;

  function setStart(v) {
    // Başlangıç silinirse (ya da geçersizse) bitiş de temizlenir
    setF((s) => ({ ...s, time: v, endTime: toMin(v) == null ? '' : s.endTime }));
    setError('');
  }
  const setEnd = (v) => { setF((s) => ({ ...s, endTime: v })); setError(''); };
  const chip = (mins) => setEnd(addMinutes(f.time, mins));

  function pick(k) {
    setError('');
    if (kind === k) { setKind(null); return; }
    setKind(k);
    // Boşluk saatleri yalnızca saat henüz girilmemişse yazılır; tür değiştirmek elle girilen saatleri ezmez.
    if (prefill) setF((s) => (s.time ? s : { ...s, time: prefill.start, endTime: prefill.end }));
  }

  function close() {
    setKind(null);
    setF(initialState(null));
    setError('');
    onClearPrefill?.();
  }

  async function submit(e) {
    e.preventDefault();
    if (busy || !info) return;
    const name = f.title.trim();
    if (!name && info.nameRequired) return setError('Aktivite adını yaz.');
    if (same) return; // satır içi hata zaten görünüyor
    const body = { title: name || info.label, time: f.time, endTime: hasStart && endMin != null ? f.endTime : '', note: f.note.trim() };
    if (mode === 'add') body.kind = kind;
    else if (isTraining(initial)) { body.trainingType = null; body.minutes = initial.minutes ?? null; }
    const ok = await onSubmit(body);
    if (ok && mode === 'add') close();
  }

  const cancel = mode === 'add' ? close : onCancel;
  const clash = hasStart && !same ? overlapping(events, f.time, endMin != null ? f.endTime : '', initial?.id) : [];

  let summary;
  if (!hasStart) summary = <>Saat girmezsen “Saati yok” bölümünde görünür. Bitiş için önce başlangıcı seç.</>;
  else if (same) summary = null;
  else if (endMin == null) summary = <><b>{f.time}</b> · süre belirsiz. Çizelgede 1 saatlik yer kaplar.</>;
  else summary = <><b>{f.time}–{hm(endMin)}</b> · {formatDuration(dur)}{endMin < startMin && ' · ↷ ertesi gün biter'}</>;

  return (
    <div className="evform">
      {mode === 'add' && prefill && (!kind || (f.time === prefill.start && f.endTime === prefill.end)) && (
        <div className="tl-pre">
          <span><b>{prefill.start}–{prefill.end}</b> aralığına ekliyorsun. Tür seç.</span>
          <button type="button" onClick={close}>Vazgeç</button>
        </div>
      )}
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
              value={f.title} onChange={setE('title')} aria-invalid={error ? true : undefined} autoFocus={mode === 'add' && !prefill} />
          </div>

          <div className="evtimes">
            <label>Başlangıç
              <TimeInput value={f.time} onChange={setStart} label="Başlangıç" />
            </label>
            <span className="dash" aria-hidden="true">–</span>
            <label>Bitiş (isteğe bağlı)
              <TimeInput value={hasStart ? f.endTime : ''} onChange={setEnd} label="Bitiş (isteğe bağlı)" disabled={!hasStart}
                aria-invalid={same ? true : undefined} />
            </label>
          </div>

          <div className="evchips" role="group" aria-label="Hızlı süre">
            <span className="lb" aria-hidden="true">Süre:</span>
            {CHIPS.map((c) => {
              const on = hasStart && endMin != null && dur === c.mins;
              return (
                <button key={c.mins} type="button" className={on ? 'on' : ''} aria-pressed={on} disabled={!hasStart}
                  aria-label={`Süre ${c.label}`} onClick={() => chip(c.mins)}>{c.label}</button>
              );
            })}
          </div>

          <div className="evsum" aria-live="polite">{summary}</div>
          {same && <div className="inline-error" role="alert">Bitiş, başlangıçla aynı olamaz.</div>}
          {clash.length > 0 && (
            <div className="evwarn" role="status">
              <span aria-hidden="true">⚠</span><span>{overlapText(clash)} Yine de ekleyebilirsin.</span>
            </div>
          )}

          <div className="evrow">
            <input className="grow" aria-label="Not" placeholder="Not (isteğe bağlı)" maxLength={500} value={f.note} onChange={setE('note')} />
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

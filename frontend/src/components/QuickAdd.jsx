import { useEffect, useMemo, useRef, useState } from 'react';
import { kindInfo } from '../utils/events';
import { dayTitle, formatDuration } from '../utils/format';
import { parseKey } from '../utils/recurrence';
import { toMin } from '../utils/timeline';
import { parseQuickAdd } from '../utils/quickAdd';

// Tarayıcının konuşma tanıması (Chrome, Android, iPhone Safari). Yoksa ya da izin verilmezse kutuya yazılır;
// telefonda klavyenin 🎤 tuşu (dikte) her zaman çalışır.
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
let blocked = false; // izin reddedildi: bu oturumda kendiliğinden dinlemeye başlanmaz

const SPEECH_ERRORS = {
  'not-allowed': 'Mikrofon izni verilmedi.',
  'service-not-allowed': 'Bu cihazda sesle yazma kullanılamıyor.',
  'audio-capture': 'Mikrofon bulunamadı.',
  network: 'Ses tanıma için internet bağlantısı gerekiyor.',
  'no-speech': 'Ses duyulmadı.',
};

// Sesle ekleme (Görev 13): Plan kartındaki "+ Aktivite ekle" satırı ve yanındaki 🎤. 🎤 paneli açar ve dinlemeye başlar
// (tarayıcı dinlemeyi yalnızca dokunuşla başlatır); söylenen ya da yazılan cümle utils/quickAdd ile çözülür ve altında
// onay kartı çıkar: tür · ad, gün · saat.
// - Ekle: onAdd(gün, body) — söylenen gün seçili günden farklı olabilir. true dönerse panel kapanır.
// - Düzenle: onEdit(gün, { kind, title, time, endTime }) ekleme formunu o günde dolu açar.
// date: seçili gün (tarih söylenmezse kullanılır).
export default function QuickAdd({ date, onAdd, onEdit }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const rec = useRef(null);
  const micRef = useRef(null);
  const canListen = !!Recognition;

  function listen() {
    rec.current?.abort();
    const r = new Recognition();
    r.lang = 'tr-TR';
    r.interimResults = true;
    r.maxAlternatives = 1;
    // Önceki (iptal edilen) tanımanın geç gelen olayları yok sayılır
    r.onresult = (e) => { if (rec.current === r) setText(Array.from(e.results, (x) => x[0].transcript).join(' ').replace(/\s+/g, ' ').trim()); };
    r.onerror = (e) => {
      if (rec.current !== r || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') blocked = true;
      setProblem(SPEECH_ERRORS[e.error] ?? 'Ses anlaşılamadı.');
    };
    r.onend = () => {
      if (rec.current !== r) return;
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setProblem('');
    setText('');
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setProblem('Dinleme başlatılamadı.');
    }
  }

  // Kart kaldırılınca (gün yükleniyor, bölüm değişti) dinleme durur
  useEffect(() => () => rec.current?.abort(), []);

  function toggle() {
    if (open) return close();
    setOpen(true);
    setText('');
    setProblem('');
    if (Recognition && !blocked) listen();
  }
  function close() {
    rec.current?.abort();
    rec.current = null;
    setListening(false);
    setOpen(false);
    micRef.current?.focus({ preventScroll: true });
  }

  function type(e) {
    if (rec.current) { rec.current.abort(); rec.current = null; setListening(false); }
    setText(e.target.value);
  }

  const p = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text]);
  const key = p?.date ?? date;
  const info = p ? kindInfo(p.kind) : null;
  const name = p ? p.title || (info.nameRequired ? '' : info.label) : '';
  const canAdd = !!name && !listening && !busy;

  let when = 'saati yok';
  if (p?.time) {
    const s = toMin(p.time), e = toMin(p.endTime);
    when = e == null ? <b>{p.time}</b>
      : <><b>{p.time}–{p.endTime}</b> · {formatDuration((e - s + 1440) % 1440)}{e < s && ' · ↷ ertesi gün biter'}</>;
  }

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    const ok = await onAdd(key, { kind: p.kind, title: name, time: p.time, endTime: p.endTime, note: '' });
    setBusy(false);
    if (ok) close();
  }

  function edit() {
    onEdit(key, { kind: p.kind, title: p.title, time: p.time, endTime: p.endTime });
    close();
  }

  let state = 'Söyle ya da yaz';
  if (listening) state = 'Dinliyorum…';
  else if (!canListen || blocked) state = 'Yaz ya da klavyedeki 🎤 ile söyle';

  return (
    <>
      <div className="add-head">
        <div className="sub-lb add-lb" aria-hidden="true">+ Aktivite ekle</div>
        <button type="button" ref={micRef} className={`micbtn${open ? ' on' : ''}`} aria-label="Sesle ekle" aria-expanded={open} onClick={toggle}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="evform qa" role="group" aria-label="Sesle ekle">
          <div className="qa-top">
            <span className={`qa-state${listening ? ' on' : ''}`} aria-live="polite">{state}</span>
            {canListen && (
              <button type="button" className="qa-mic" onClick={listening ? () => rec.current?.stop() : listen}>
                {listening ? 'Bitti' : 'Yeniden dinle'}
              </button>
            )}
          </div>
          <input value={text} onChange={type} maxLength={300} enterKeyHint="done" aria-label="Ne ekleyelim?" autoFocus={!canListen || blocked}
            placeholder="ör. 1 Kasım 13:00–15:00 voleybol maçı"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} />
          {problem && <p className="qa-hint" role="alert">{problem} Yazabilir ya da klavyedeki 🎤 ile söyleyebilirsin.</p>}

          {p && !listening && (
            <>
              <div className="qa-card">
                <div className="qa-what"><span className="ai" aria-hidden="true">{info.icon}</span><b>{name || '—'}</b><small>{info.label}</small></div>
                <div className="qa-when">{dayTitle(parseKey(key))}{!p.date && ' (seçili gün)'} · {when}</div>
              </div>
              {!name && <div className="inline-error" role="alert">Ne ekleneceğini anlayamadım. Aktivitenin adını da söyle ya da yaz.</div>}
            </>
          )}

          <div className="evrow">
            {p && !listening && (
              <>
                <button type="button" className="evsubmit add" disabled={!canAdd} onClick={add}>Ekle</button>
                <button type="button" className="btn-ghost" onClick={edit}>Düzenle</button>
              </>
            )}
            <button type="button" className="btn-ghost" onClick={close}>Vazgeç</button>
          </div>
        </div>
      )}
    </>
  );
}

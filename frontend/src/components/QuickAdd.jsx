import { useEffect, useMemo, useRef, useState } from 'react';
import { kindInfo } from '../utils/events';
import { dayTitle, formatDuration } from '../utils/format';
import { parseKey } from '../utils/recurrence';
import { addMinutes, toMin } from '../utils/timeline';
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

const STUDY_MINUTES = 40; // ders süresi söylenmezse (kartta görünür, Düzenle'de değişir)

// Sesle ekleme (Görev 13): gün başlığı (children) ve sağ ucunda 🎤; her bölümde (Bee, To-do, Plan) aynı yerde.
// 🎤 paneli açar ve dinlemeye başlar (tarayıcı dinlemeyi yalnızca dokunuşla başlatır); söylenen ya da yazılan cümle
// utils/quickAdd ile çözülür ve altında onay kartı çıkar. Cümlede ailenin derslerinden biri geçerse ders (To-do), yoksa aktivite.
// - Ekle: onAdd(gün, type, body) — type 'study' | 'event'; söylenen gün seçili günden farklı olabilir. true dönerse panel kapanır.
// - Düzenle: onEdit(gün, type, taslak) ilgili bölümün ekleme formunu o günde dolu açar.
// date: seçili gün (tarih söylenmezse kullanılır). subjects: ailenin dersleri ({ name }).
export default function QuickAdd({ date, subjects, onAdd, onEdit, children }) {
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

  // Sayfa kaldırılınca dinleme durur
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

  const names = useMemo(() => subjects.map((s) => s.name), [subjects]);
  const p = useMemo(() => (text.trim() ? parseQuickAdd(text, new Date(), names) : null), [text, names]);
  const key = p?.date ?? date;
  const isStudy = !!p?.subject;
  const info = p && !isStudy ? kindInfo(p.kind) : null;
  const minutes = isStudy ? p.minutes || STUDY_MINUTES : 0;
  const name = !p ? '' : isStudy ? p.subject : p.title || (info.nameRequired ? '' : info.label);
  const canAdd = !!name && !listening && !busy;

  // Kartın saat bölümü: ders başlangıç + süre, aktivite başlangıç–bitiş
  let when = <>saati yok{isStudy && <> · {formatDuration(minutes)}</>}</>;
  if (p?.time) {
    const end = isStudy ? addMinutes(p.time, minutes) : p.endTime;
    const s = toMin(p.time), e = toMin(end);
    when = e == null ? <b>{p.time}</b>
      : <><b>{p.time}–{end}</b> · {formatDuration(isStudy ? minutes : (e - s + 1440) % 1440)}{e < s && ' · ↷ ertesi gün biter'}</>;
  }

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    const ok = isStudy
      ? await onAdd(key, 'study', { subject: p.subject, topic: p.topic, minutes, startTime: p.time })
      : await onAdd(key, 'event', { kind: p.kind, title: name, time: p.time, endTime: p.endTime, note: '' });
    setBusy(false);
    if (ok) close();
  }

  function edit() {
    if (isStudy) onEdit(key, 'study', { subject: p.subject, topic: p.topic, minutes: String(minutes), startTime: p.time });
    else onEdit(key, 'event', { kind: p.kind, title: p.title, time: p.time, endTime: p.endTime });
    close();
  }

  let state = 'Söyle ya da yaz';
  if (listening) state = 'Dinliyorum…';
  else if (!canListen || blocked) state = 'Yaz ya da klavyedeki 🎤 ile söyle';

  return (
    <>
      <div className="dayhead-row">
        {children}
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
          {!p && !problem && <p className="qa-hint">Ders adı geçerse ders (To-do), geçmezse aktivite (Plan) olarak eklenir.</p>}

          {p && !listening && (
            <>
              <div className="qa-card">
                <div className="qa-what">
                  <span className="ai" aria-hidden="true">{isStudy ? '📚' : info.icon}</span>
                  <b>{name || '—'}{isStudy && p.topic && <span className="qa-topic"> · {p.topic}</span>}</b>
                  <small>{isStudy ? 'Ders' : info.label}</small>
                </div>
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

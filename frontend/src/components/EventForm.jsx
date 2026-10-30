import { useRef, useState } from 'react';
import TimeInput from './TimeInput';
import { ACTIVITY_KINDS, eventLabel, isTraining, kindInfo } from '../utils/events';
import { formatDuration } from '../utils/format';
import { addMinutes, endOf, hm, itemKey, overlapText, overlapping, toMin } from '../utils/timeline';
import {
  dayMonth, daysText, hasOccurrence, isoDay, plusYear, untilText, WEEKDAY_ISO, WEEKDAYS_ISO, weekCount,
} from '../utils/recurrence';
import { WEEKDAYS, WEEKDAYS_FULL } from '../utils/format';

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

// Tekrar bölümü (Görev 11): kapalı başlar, gün olarak eklenen günün hafta günü seçili; "Tüm tekrarları düzenle"de kuraldan dolar.
function initialRepeat(scope, initial, date) {
  if (scope === 'all' && initial?.recurring) {
    return { on: true, days: [...initial.recurring.daysOfWeek], until: initial.recurring.untilDate };
  }
  return { on: false, days: date ? [isoDay(date)] : [], until: '' };
}
const sameDays = (a, b) => a.length === b.length && b.every((d) => a.includes(d));

// Tekrar kuralının istemci denetimi (sunucu da denetler); hata metni ya da ''
function repeatError(rep, start) {
  if (!rep.days.length) return 'En az bir gün seç.';
  if (!rep.until) return 'Bitiş tarihini seç.';
  if (rep.until > plusYear(start)) return 'Bitiş tarihi en fazla 1 yıl sonrası olabilir.';
  if (rep.until < start) return `Bitiş tarihi ${dayMonth(start)} ya da sonrası olmalı.`;
  if (!hasOccurrence(rep.days, start, rep.until)) return 'Seçtiğin günler bu tarih aralığına düşmüyor.';
  return '';
}

// Aktivite ekleme / düzenleme formu (gün kartı).
// - mode 'add': tür ikonları (Spor, Müzik, Konser, Buluşma, Sınav, Diğer). İkona dokununca ad, Başlangıç – Bitiş, süre
//   çipleri, özet ve not açılır; aynı ikona yeniden dokunmak, İptal ya da başarılı ekleme formu kapatır.
//   prefill ({ start, end }): boşluktaki "+ Ekle"den gelme; üstte "… aralığına ekliyorsun" satırı, tür seçilince saatler dolu.
// - mode 'edit': tür sabittir. Eski antrenmanların adı türden türetilip kutuya yazılır; eski süre olduğu gibi korunur.
//   endTime her zaman gönderilir (bitiş yoksa ""), böylece silinen bitiş sunucuda da silinir.
// Ad boş bırakılırsa türün adı kullanılır; Diğer'de ad zorunludur. Bitiş isteğe bağlı; başlangıç yokken girilemez.
// events: günün kayıtları, dersler dahil (çakışma uyarısı için; engellemez). onSubmit(body) true dönerse ekleme formu kapanır.
// Bee'deki boşluk sayfasında (Görev 10): hidePre üstteki 'aralığına ekliyorsun' satırını gizler (sayfa kendi bilgi satırını
// gösterir), onTimeChange(başlangıç) girilen başlangıcı sayfaya bildirir (Ders <-> Aktivite geçişinde korunur).
// Görev 11: date (yyyy-AA-gg) verilirse eklemede "↻ Her hafta tekrarla" bölümü çıkar; açıksa body.repeat =
// { daysOfWeek, startDate: date, untilDate }. scope (tekrarlanan kaydı düzenlerken): 'one' = yalnızca o gün (tekrar
// bölümü yok, bilgi satırı), 'all' = bütün tekrarlar (bölüm açık ve dolu; body.repeat yine gönderilir).
// kindsLabel: tür ikonları grubunun erişilebilir adı (Plan kartında "Aktivite ekle").
export default function EventForm({
  mode = 'add', initial, onSubmit, onCancel, busy = false, events = [], prefill, onClearPrefill, hidePre = false, onTimeChange,
  date, scope, kindsLabel = 'Aktivite türü',
}) {
  const [kind, setKind] = useState(mode === 'edit' ? initial?.kind : null);
  const [f, setF] = useState(() => initialState(mode === 'edit' ? initial : null));
  const [error, setError] = useState('');
  const [rep, setRep] = useState(() => initialRepeat(scope, initial, date));
  const [repErr, setRepErr] = useState('');
  const canRepeat = scope === 'all' || (mode === 'add' && !!date);
  const repStart = scope === 'all' ? initial?.recurring?.startDate : date;
  const updRep = (patch) => { setRep((r) => ({ ...r, ...patch })); setRepErr(''); };
  const toggleDay = (d) => updRep({ days: rep.days.includes(d) ? rep.days.filter((x) => x !== d) : [...rep.days, d] });
  const info = kind ? kindInfo(kind) : null;
  const setE = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); setError(''); };

  // Yeni bir boşluktan gelince tür seçimi sıfırlanır (kullanıcı türü yeniden seçer)
  // Ekleme formu gün değişince açık kalır: tekrar kapalıysa varsayılan gün yeni günün hafta günü olur
  const [lastDate, setLastDate] = useState(date);
  if (date !== lastDate) {
    setLastDate(date);
    if (!rep.on && mode === 'add') setRep(initialRepeat(null, null, date));
  }

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
    onTimeChange?.(v);
  }
  const setEnd = (v) => { setF((s) => ({ ...s, endTime: v })); setError(''); };
  const chip = (mins) => setEnd(addMinutes(f.time, mins));

  // Ad alanında klavyenin tuşu "İleri"dir: Enter formu göndermez (yarım aktivite eklenmesin), Başlangıç'a geçer
  const startRef = useRef(null);
  function nextOnEnter(e) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    startRef.current?.focus();
  }

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
    setRep(initialRepeat(null, null, date));
    setRepErr('');
    onClearPrefill?.();
  }

  async function submit(e) {
    e.preventDefault();
    if (busy || !info) return;
    const name = f.title.trim();
    if (!name && info.nameRequired) return setError('Aktivite adını yaz.');
    if (same) return; // satır içi hata zaten görünüyor
    const repeating = canRepeat && rep.on;
    if (repeating) {
      const msg = repeatError(rep, repStart);
      if (msg) return setRepErr(msg);
    }
    const body = { title: name || info.label, time: f.time, endTime: hasStart && endMin != null ? f.endTime : '', note: f.note.trim() };
    if (mode === 'add') body.kind = kind;
    else if (!scope && isTraining(initial)) { body.trainingType = null; body.minutes = initial.minutes ?? null; }
    if (repeating) body.repeat = { daysOfWeek: [...rep.days].sort((a, b) => a - b), startDate: repStart, untilDate: rep.until };
    const ok = await onSubmit(body);
    if (ok && mode === 'add') close();
  }

  const cancel = mode === 'add' ? close : onCancel;
  const clash = hasStart && !same
    ? overlapping(events, { time: f.time, endTime: endMin != null ? f.endTime : '' }, initial ? itemKey(initial) : null) : [];

  let summary;
  if (!hasStart) summary = <>Saat girmezsen “Saati yok” bölümünde görünür. Bitiş için önce başlangıcı seç.</>;
  else if (same) summary = null;
  else if (endMin == null) summary = <><b>{f.time}</b> · süre belirsiz. Çizelgede 1 saatlik yer kaplar.</>;
  else summary = <><b>{f.time}–{hm(endMin)}</b> · {formatDuration(dur)}{endMin < startMin && ' · ↷ ertesi gün biter'}</>;

  // Tekrar kutusu: kısayollar, gün dizisi, bitiş tarihi, özet ve hata
  let repeatBox = null;
  if (canRepeat && rep.on) {
    const timeTxt = hasStart ? (endMin != null && !same ? `${f.time}–${f.endTime}` : f.time) : '';
    const shortcut = (label, days) => {
      const on = sameDays(rep.days, days);
      return <button type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => updRep({ days })}>{label}</button>;
    };
    repeatBox = (
      <div className="repbox">
        <div className="repq">
          {shortcut('Hafta içi', WEEKDAYS_ISO)}
          {shortcut('Her gün', WEEKDAY_ISO)}
        </div>
        <div className="repdays" role="group" aria-label="Tekrar günleri">
          {WEEKDAY_ISO.map((d) => (
            <button key={d} type="button" className={rep.days.includes(d) ? 'on' : ''} aria-pressed={rep.days.includes(d)}
              aria-label={WEEKDAYS_FULL[d - 1]} onClick={() => toggleDay(d)}>{WEEKDAYS[d - 1]}</button>
          ))}
        </div>
        <label className="repd">Bitiş tarihi
          <input type="date" value={rep.until} min={repStart} max={plusYear(repStart)} aria-invalid={repErr ? true : undefined}
            onChange={(e) => updRep({ until: e.target.value })} />
        </label>
        <div className="repsum" aria-live="polite">
          {rep.days.length > 0 && <>↻ <b>{daysText(rep.days)}{timeTxt && ` ${timeTxt}`}</b>{!timeTxt && ' saatsiz'}</>}
          {rep.days.length > 0 && rep.until >= repStart && <> · {untilText(rep.until)} · {weekCount(repStart, rep.until)} hafta</>}
        </div>
        {repErr && <div className="inline-error" role="alert">{repErr}</div>}
      </div>
    );
  }

  return (
    <div className="evform">
      {mode === 'add' && prefill && !hidePre && (!kind || (f.time === prefill.start && f.endTime === prefill.end)) && (
        <div className="tl-pre">
          <span><b>{prefill.start}–{prefill.end}</b> aralığına ekliyorsun. Tür seç.</span>
          <button type="button" onClick={close}>Vazgeç</button>
        </div>
      )}
      {mode === 'add' && (
        <div className="acts" role="group" aria-label={kindsLabel}>
          {ACTIVITY_KINDS.map((k) => (
            <button key={k.kind} type="button" className={kind === k.kind ? 'on' : ''} aria-pressed={kind === k.kind} onClick={() => pick(k.kind)}>
              <span className="ai" aria-hidden="true">{k.icon}</span>{k.label}
            </button>
          ))}
        </div>
      )}

      {info && (
        <form className="evfields" onSubmit={submit} noValidate>
          {scope === 'one' && <p className="repinfo">Yalnızca {dayMonth(initial.occurrenceDate)} değişir, diğer günler aynı kalır.</p>}
          {scope === 'all' && <p className="repinfo">Ayrı düzenlediğin günler değişmez.</p>}
          <label className="fl">
            <span>Ad {!info.nameRequired && <span className="opt">(boş kalırsa “{info.label}” yazılır)</span>}</span>
            <input placeholder={info.placeholder} maxLength={150} enterKeyHint="next" onKeyDown={nextOnEnter}
              value={f.title} onChange={setE('title')} aria-invalid={error ? true : undefined} autoFocus={mode === 'add' && !prefill} />
          </label>

          <div className="evtimes">
            <label>Başlangıç
              <TimeInput ref={startRef} value={f.time} onChange={setStart} label="Başlangıç" />
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

          {canRepeat && (
            <>
              <div className="rep">
                <span>↻ Her hafta tekrarla<small>Seçtiğin günlerde, aynı saatte</small></span>
                {scope !== 'all' && (
                  <button type="button" role="switch" className={`switch${rep.on ? ' on' : ''}`} aria-checked={rep.on}
                    aria-label="Her hafta tekrarla" onClick={() => updRep({ on: !rep.on })} />
                )}
              </div>
              {rep.on && repeatBox}
            </>
          )}

          <label className="fl">
            <span>Not <span className="opt">(isteğe bağlı)</span></span>
            <input placeholder="ör. Adres, yanına alınacaklar" maxLength={500} value={f.note} onChange={setE('note')} />
          </label>

          {error && <div className="inline-error" role="alert">{error}</div>}

          <div className="evrow evactions">
            <button type="submit" className={`evsubmit ${mode === 'add' ? 'add' : isTraining(initial) ? 'sport' : 'event'}`} disabled={busy}>{mode === 'add' ? 'Ekle' : scope === 'all' ? 'Tüm tekrarları kaydet' : 'Kaydet'}</button>
            {cancel && <button type="button" className="btn-ghost" onClick={cancel}>İptal</button>}
          </div>
        </form>
      )}
    </div>
  );
}

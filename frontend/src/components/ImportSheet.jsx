import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet';
import TimeInput from './TimeInput';
import HoneycombSpinner from './HoneycombSpinner';
import BusyLabel from './BusyLabel';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { ACTIVITY_KINDS, kindInfo } from '../utils/events';
import { addDays, dkey, mondayOf, WEEKDAYS, WEEKDAYS_FULL } from '../utils/format';
import { isoDay, parseKey, plusYear } from '../utils/recurrence';
import { readSheetFile, SheetFileError } from '../utils/sheetFile';
import { checkRow, dayOf, matchName, mergeConsecutive, norm, parseSchedule, toSeriesItems } from '../utils/importSchedule';

// Program yükleme (Görev 15): + menüsü → "Program yükle". Excel/CSV ya da fotoğraf cihazda okunur, sunucuya gitmez.
// Adımlar: kaynak seç → (fotoğrafta) okunuyor → önizleme. Önizlemede satırlar düzenlenir ya da kaldırılır; "N kaydı ekle"
// hepsini tek istekte haftalık tekrar (seri) olarak ekler (POST /api/series/bulk). Hiçbir şey onaysız eklenmez.
// onDone({ importId, count }): eklendi (panel kapanır, "Geri al" bildirimi PlanShell'de). subjects: ailenin dersleri ({ name }).
// Herkes yükleyebilir (ebeveyn ve çocuk profili; kullanıcı kararı 03.11).

const ICON_SHEET = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M4 9h16M4 15h16M10 3v18" />
  </svg>
);
const ICON_CAMERA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
  </svg>
);

// Örnek dosyalar (CSV; Excel açar). ";" ayırıcı ve BOM: Türkçe Excel'de sütunlar ve ş, ğ, İ doğru görünür.
const SAMPLE_GRID = [
  ['Saat', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'],
  ['08:30-09:10', 'Matematik', 'Türkçe', 'Fen Bilimleri', 'Matematik', 'İngilizce'],
  ['09:20-10:00', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler', 'Türkçe', 'Müzik'],
  ['10:10-10:50', 'Türkçe', 'Beden Eğitimi', 'İngilizce', 'Din Kültürü', 'Görsel Sanatlar'],
];
const SAMPLE_LIST = [
  ['Gün', 'Başlangıç', 'Bitiş', 'Ad', 'Tür'],
  ['Salı', '17:00', '18:30', 'Yüzme', 'Spor'],
  ['Perşembe', '17:00', '18:30', 'Yüzme', 'Spor'],
  ['Cumartesi', '10:00', '11:00', 'Piyano dersi', 'Müzik'],
  ['Pazar', '11:00', '13:00', 'İngilizce kursu', 'Okul'],
];
function download(name, rows) {
  const csv = '﻿' + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Varsayılan bitiş: bir hafta (başlangıç + 6 gün; programın her günü bir kez). Kullanıcı başka tarih seçebilir
// (iki haftalık ya da dönem boyu program); en fazla başlangıçtan 1 yıl sonra (Görev 15c).
const oneWeek = (start) => dkey(addDays(parseKey(start), 6));

// Başlangıç–bitiş aralığına düşen hafta günleri (1..7)
function daysInRange(start, until) {
  const out = new Set();
  for (let d = parseKey(start), i = 0; dkey(d) <= until && i < 7; d = addDays(d, 1), i += 1) out.add(isoDay(dkey(d)));
  return out;
}

// Panel başlığı. onBack: solda ‹ (bir önceki adım); closeLabel/onClose: sağda kapat düğmesi.
function SheetHead({ id, title, closeLabel, onClose, onBack, backLabel }) {
  return (
    <div className="sheet-head">
      <div className="imp-headl">
        {onBack && (
          <button type="button" className="imp-back" onClick={onBack} aria-label={backLabel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <h3 id={id} tabIndex={-1}>{title}</h3>
      </div>
      {onClose && <button type="button" className="sheet-close" onClick={onClose}>{closeLabel}</button>}
    </div>
  );
}

const ICON_DOWNLOAD = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" />
  </svg>
);

// Tarih aralığının kısa açıklaması: "1 hafta", "2 hafta · her hafta tekrar eder", "3 gün · yalnızca Per, Cum, Cmt"
function rangeText(start, until) {
  const days = Math.round((parseKey(until) - parseKey(start)) / 86400000) + 1;
  if (days < 7) {
    const names = [...daysInRange(start, until)].map((d) => WEEKDAYS[d - 1]);
    return `${days} gün · yalnızca ${names.join(', ')}`;
  }
  const w = Math.floor(days / 7), d = days % 7;
  return `${w} hafta${d ? ` ${d} gün` : ''}${days > 7 ? ' · her hafta tekrar eder' : ''}`;
}

// Planda zaten olanlar: başlangıçtan itibaren 7 günün (en çok iki takvim haftası) aktiviteleri, tekrarlar dahil.
// Anahtar "haftaGünü|SS:dd|ad" (ad sadeleştirilmiş: büyük-küçük harf, Türkçe karakter). Saatsiz aktivite karşılaştırılmaz.
async function loadExisting(start) {
  const first = parseKey(start);
  const last = dkey(addDays(first, 6));
  const mondays = [...new Set([0, 6].map((n) => dkey(mondayOf(addDays(first, n)))))];
  const res = await Promise.all(mondays.map((m) => client.get(`/days/week/${m}/details`)));
  const keys = new Set();
  for (const r of res) {
    for (const day of r.data?.days ?? []) {
      if (day.date < start || day.date > last) continue;
      for (const ev of day.events ?? []) if (ev.time && ev.title) keys.add(`${isoDay(day.date)}|${ev.time}|${norm(ev.title)}`);
    }
  }
  return keys;
}

const timeText = (r) => (r.start ? (r.end ? `${r.start}–${r.end}` : r.start) : '--:--');

export default function ImportSheet({ subjects, onClose, onDone, returnFocusRef }) {
  const titleId = useId();
  const fileRef = useRef(null);
  const photoRef = useRef(null);
  const abortRef = useRef(null);
  const [step, setStep] = useState('source'); // 'source' | 'reading' | 'preview'
  const [error, setError] = useState('');
  const [source, setSource] = useState(null); // { name, kind: 'file' | 'photo', url? }
  const [progress, setProgress] = useState({ step: 'prepare', progress: 0 });
  const [format, setFormat] = useState('list');
  const [rows, setRows] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [defaultKind, setDefaultKind] = useState('School');
  const today = useMemo(() => dkey(new Date()), []);
  const [startDate, setStartDate] = useState(today);
  const [untilDate, setUntilDate] = useState(() => oneWeek(today));
  // Bitiş elle seçilmediyse başlangıçla birlikte kayar (hep bir hafta)
  const [untilTouched, setUntilTouched] = useState(false);
  function changeStart(v) {
    setStartDate(v);
    if (!untilTouched && v) setUntilDate(oneWeek(v));
  }
  const [editing, setEditing] = useState(null); // düzenlenen satırın taslağı
  // Planda zaten olanlar ({ start, keys }); başlangıç değişince yeniden yüklenir. Yüklenemezse uyarı gösterilmez.
  const [existing, setExisting] = useState(null);
  const checking = step === 'preview' && !!startDate && existing?.start !== startDate;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const names = useMemo(() => subjects.map((s) => s.name), [subjects]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => {
    if (step !== 'preview' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
    let alive = true;
    loadExisting(startDate)
      .then((keys) => { if (alive) setExisting({ start: startDate, keys }); })
      .catch(() => { if (alive) setExisting({ start: startDate, keys: new Set() }); });
    return () => { alive = false; };
  }, [step, startDate]);
  useEffect(() => () => { if (source?.url) URL.revokeObjectURL(source.url); }, [source]);
  // Adım değişince odak başlığa (ekran okuyucu yeni içeriği okur)
  useEffect(() => { document.getElementById(titleId)?.focus({ preventScroll: true }); }, [step, titleId]);

  const openFile = () => fileRef.current?.click();
  const openPhoto = () => photoRef.current?.click();

  function close() {
    abortRef.current?.abort();
    onClose();
  }

  function showPreview(table, src) {
    const parsed = parseSchedule(table, names);
    // Hiçbir satırda gün ya da saat yoksa bu bir program değildir (ör. başka bir tablo): önizleme yerine yol gösterilir
    if (!parsed.rows.some((r) => r.day || r.start)) {
      setError(src === 'photo'
        ? 'Fotoğrafta program bulunamadı. Kâğıdı düz ve aydınlık bir yerde, tamamı görünecek şekilde yeniden çek.'
        : 'Bu dosyada program bulunamadı. Gün adları (Pazartesi, Salı…) ve saatler (08:30) olmalı; örnek dosyalara bak.');
      setStep('source');
      return;
    }
    setFormat(parsed.format);
    setRows(mergeConsecutive(parsed.rows));
    setTruncated(parsed.truncated);
    setEditing(null);
    setStep('preview');
  }

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSource({ name: file.name, kind: 'file' });
    try {
      showPreview(await readSheetFile(file), 'file');
    } catch (err) {
      setError(err instanceof SheetFileError ? err.message : 'Dosya okunamadı. Excel (.xlsx) ya da CSV dosyası seç.');
    }
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSource({ name: file.name, kind: 'photo', url: URL.createObjectURL(file) });
    setProgress({ step: 'prepare', progress: 0 });
    setStep('reading');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { readPhoto } = await import('../utils/ocr');
      const table = await readPhoto(file, { signal: ctrl.signal, dayOf, onProgress: setProgress });
      if (!ctrl.signal.aborted) showPreview(table, 'photo');
    } catch (err) {
      if (ctrl.signal.aborted || err?.name === 'AbortError') return;
      setError(err?.message || 'Fotoğraf okunamadı.');
      setStep('source');
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  function cancelReading() {
    abortRef.current?.abort();
    setStep('source');
  }

  // ---------- Önizleme ----------
  const update = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? checkRow({ ...r, ...patch }) : r)));
  const remove = (id) => { setRows((rs) => rs.filter((r) => r.id !== id)); if (editing?.id === id) setEditing(null); };
  function applySuggest(r) {
    update(r.id, { title: r.suggest, suggest: '', lowConfidence: false, kind: format === 'grid' ? r.kind : (r.kind === 'Event' ? 'School' : r.kind) });
  }
  function saveEdit() {
    const { id, ...draft } = editing;
    const fixed = matchName(draft.title.trim(), names);
    const patch = { ...draft, day: draft.day ? Number(draft.day) : null, title: fixed.title, suggest: '', lowConfidence: false };
    if (rows.some((r) => r.id === id)) update(id, patch);
    else setRows((rs) => [...rs, checkRow({ id, note: '', ...patch })]);
    setEditing(null);
  }
  function addRow() {
    setEditing({ id: `n${Date.now()}`, day: '', start: '', end: '', title: '', kind: format === 'grid' ? null : 'Event' });
  }

  const dateError = !startDate || !untilDate ? 'Tarihleri seç.'
    : untilDate < startDate ? 'Bitiş tarihi başlangıçtan önce olamaz.'
    : untilDate > plusYear(startDate) ? 'Bitiş en fazla 1 yıl sonrası olabilir.' : '';
  // Aralık bir haftadan kısaysa bazı günler hiç düşmez: o günün kayıtları eklenmez (gün başlığında yazar)
  const inRange = useMemo(() => (dateError ? null : daysInRange(startDate, untilDate)), [dateError, startDate, untilDate]);
  const outOfRange = (r) => !r.issue && r.day && inRange && !inRange.has(r.day);
  // Aynı gün, aynı saat ve aynı adla planda zaten var: varsayılan olarak eklenmez ("Yine de ekle" ile eklenir)
  const inPlan = (r) => !r.issue && !outOfRange(r) && !r.allowDup && !checking
    && !!existing?.keys.has(`${r.day}|${r.start}|${norm(r.title)}`);
  const ready = rows.filter((r) => !r.issue && !outOfRange(r) && !inPlan(r));
  const skipped = rows.filter(outOfRange).length;
  const dups = rows.filter(inPlan).length;
  const blocked = rows.length - ready.length - skipped - dups;
  const warned = rows.filter((r) => r.issue || r.hint).length;

  const groups = useMemo(() => {
    const by = new Map();
    for (const r of rows) {
      const k = r.day ?? 0;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    }
    for (const list of by.values()) list.sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
    return [...by.entries()].sort(([a], [b]) => (a || 9) - (b || 9));
  }, [rows]);

  async function submit() {
    if (busyRef.current || !ready.length || dateError || checking) return;
    busyRef.current = true;
    setBusy(true);
    const items = toSeriesItems(ready, { startDate, untilDate, defaultKind });
    try {
      const res = await client.post('/series/bulk', { items });
      onDone({ importId: res.data.importId, count: res.data.series.length });
    } catch (err) {
      const list = err?.response?.data?.items;
      if (errorCode(err) === 'bulk_invalid' && Array.isArray(list)) {
        const byId = new Map(list.map((x) => [ready[x.index]?.id, x.message]));
        setRows((rs) => rs.map((r) => (byId.has(r.id) ? { ...r, issue: byId.get(r.id), hint: '' } : r)));
      }
      setError(errorText(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const rowEditor = (draft) => (
    <div className="imp-edit">
      <div className="imp-edit-grid">
        <label>Gün
          <select value={draft.day ?? ''} onChange={(e) => setEditing({ ...draft, day: e.target.value })}>
            <option value="">Seç</option>
            {WEEKDAYS_FULL.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </label>
        <label>Tür
          <select value={draft.kind ?? (format === 'grid' ? defaultKind : 'Event')}
            onChange={(e) => setEditing({ ...draft, kind: format === 'grid' && e.target.value === defaultKind ? null : e.target.value })}>
            {ACTIVITY_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.icon} {k.label}</option>)}
          </select>
        </label>
        <label>Başlangıç<TimeInput value={draft.start} label="Başlangıç" onChange={(v) => setEditing({ ...draft, start: v })} /></label>
        <label><span>Bitiş <span className="opt">(isteğe bağlı)</span></span><TimeInput value={draft.end} label="Bitiş" onChange={(v) => setEditing({ ...draft, end: v })} /></label>
      </div>
      <label className="imp-edit-name">Ad
        <input value={draft.title} maxLength={150} onChange={(e) => setEditing({ ...draft, title: e.target.value })} placeholder="ör. Matematik" />
      </label>
      <div className="frm-act">
        <button type="button" className="go" onClick={saveEdit}>Tamam</button>
        <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Vazgeç</button>
      </div>
    </div>
  );


  let content;
  if (step === 'source') {
    content = (
      <>
        <SheetHead id={titleId} title="Program yükle" closeLabel="Kapat" onClose={close} />
        <div className="sheet-body">
          {error && <p className="imp-error" role="alert">{error}</p>}
          <div className="imp-src">
            <button type="button" className="imp-opt" onClick={openFile}>
              <span className="bub xls">{ICON_SHEET}</span>
              <span><b>Excel ya da CSV</b><small>.xlsx · .csv — okulun verdiği tablo ya da kendi listen</small></span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
            <button type="button" className="imp-opt" onClick={openPhoto}>
              <span className="bub cam">{ICON_CAMERA}</span>
              <span><b>Fotoğraf</b><small>Kâğıttaki programın fotoğrafını çek ya da galeriden seç</small></span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
            <input ref={fileRef} type="file" hidden accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pickFile} />
            <input ref={photoRef} type="file" hidden accept="image/*" onChange={pickPhoto} />
          </div>
          <p className="imp-priv"><span aria-hidden="true">🔒</span><span>Dosya ve fotoğraf <b>telefonunda okunur</b>, sunucuya gönderilmez. Eklemeden önce hepsini görüp düzeltebilirsin.</span></p>
          <div className="imp-help">
            <h4>Nasıl hazırlamalı?</h4>
            <div className="imp-grid-wrap">
              <table className="imp-grid">
                <thead><tr><th scope="col"><span className="sr-only">Saat</span></th><th scope="col">Pzt</th><th scope="col">Salı</th><th scope="col">Çarş</th><th scope="col">Perş</th><th scope="col">Cuma</th></tr></thead>
                <tbody>
                  <tr><td className="t">08:30<br />09:10</td><td>Mat</td><td>Türkçe</td><td>Fen</td><td>Mat</td><td>İng</td></tr>
                  <tr><td className="t">09:20<br />10:00</td><td>Mat</td><td>Fen</td><td>Sosyal</td><td>Türkçe</td><td>Müzik</td></tr>
                </tbody>
              </table>
            </div>
            <p className="imp-or">ya da her satıra bir kayıt: <span className="mono nowrap">Salı · 17:00 · 18:30 · Yüzme</span></p>
            <div className="imp-dl">
              <button type="button" className="btn-ghost small imp-dlbtn" onClick={() => download('ders-programi-ornek.csv', SAMPLE_GRID)}>{ICON_DOWNLOAD}Örnek ders programı</button>
              <button type="button" className="btn-ghost small imp-dlbtn" onClick={() => download('program-listesi-ornek.csv', SAMPLE_LIST)}>{ICON_DOWNLOAD}Örnek liste</button>
            </div>
          </div>
        </div>
      </>
    );
  } else if (step === 'reading') {
    const pct = Math.round((progress.progress ?? 0) * 100);
    content = (
      <>
        <SheetHead id={titleId} title="Program yükle" closeLabel="Vazgeç" onClose={cancelReading} />
        <div className="sheet-body">
          <div className="imp-read" aria-live="polite">
            {source?.url ? <img className="imp-photo" src={source.url} alt="" /> : <HoneycombSpinner size={56} />}
            <div className="imp-bar" role="progressbar" aria-label="Fotoğraf okunuyor" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={progress.step === 'read' ? pct : 0}>
              <i style={{ width: `${progress.step === 'read' ? Math.max(4, pct) : 4}%` }} className={progress.step === 'read' ? '' : 'wait'} />
            </div>
            <h4>{progress.step === 'read' ? <>Fotoğraf okunuyor… <span className="pct">%{pct}</span></> : 'Hazırlanıyor…'}</h4>
            <p>İlk kullanımda Türkçe metin tanıma dosyası indirilir (bir kez, yaklaşık 6 MB). Fotoğraf telefonundan çıkmaz.</p>
            <p>İpucu: kâğıdı düz ve aydınlık bir yerde, tamamı görünecek şekilde çek.</p>
          </div>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <SheetHead id={titleId} title="Önizleme" backLabel="Geri: başka dosya ya da fotoğraf seç"
          onBack={() => { setError(''); setEditing(null); setStep('source'); }} />
        <div className="sheet-body imp-body">
          <div className="imp-sum">
            <span className="pill">{source?.kind === 'photo' ? '📷' : '📄'} {source?.name}</span>
            <span className="pill">{rows.length} kayıt</span>
            {warned > 0 && <span className="pill warn">⚠ {warned} kontrol et</span>}
            {dups > 0 && <span className="pill">✓ {dups} zaten planda</span>}
          </div>
          {dups > 0 && !ready.length && !blocked && (
            <p className="imp-info">Bu program zaten planında. Yine de eklemek istediğin kaydın yanındaki “Ekle”ye dokun.</p>
          )}
          {truncated && <p className="imp-error">En fazla 200 kayıt yüklenebilir; ilk 200 kayıt gösteriliyor.</p>}
          {error && <p className="imp-error" role="alert">{error}</p>}
          <div className="imp-set">
            {format === 'grid' && (
              <div className="row">
                <span id={`${titleId}-kind`}>Tür</span>
                <div className="seg" role="group" aria-labelledby={`${titleId}-kind`}>
                  {['School', 'Event'].map((k) => (
                    <button key={k} type="button" className={defaultKind === k ? 'active' : ''} aria-pressed={defaultKind === k}
                      onClick={() => setDefaultKind(k)}>{kindInfo(k).icon} {kindInfo(k).label}</button>
                  ))}
                </div>
              </div>
            )}
            <label className="row"><span>Başlangıç</span>
              <input type="date" value={startDate} min={today} onChange={(e) => changeStart(e.target.value)} />
            </label>
            <label className="row"><span>Bitiş</span>
              <input type="date" value={untilDate} min={startDate} max={startDate ? plusYear(startDate) : undefined}
                onChange={(e) => { setUntilTouched(true); setUntilDate(e.target.value); }} />
            </label>
            {dateError ? <p className="imp-error inline" role="alert">{dateError}</p>
              : <p className="imp-range" aria-live="polite">{rangeText(startDate, untilDate)}</p>}
          </div>

          {groups.map(([day, list]) => {
            const dayOff = !!(day && inRange && !inRange.has(day));
            return (
            <section className={`imp-day${dayOff ? ' off' : ''}`} key={day} aria-label={day ? WEEKDAYS_FULL[day - 1] : 'Günü bulunamayanlar'}>
              <h4>{day ? WEEKDAYS_FULL[day - 1] : 'Gün bulunamadı'}
                <small>{dayOff ? 'Seçilen tarihlerde yok · eklenmez' : `${list.length} kayıt`}</small></h4>
              <ul className="imp-rows">
                {list.map((r) => (
                  <li key={r.id} className={`imp-row${r.issue ? ' bad' : outOfRange(r) || inPlan(r) ? ' off' : r.hint ? ' check' : ''}`}>
                    {editing?.id === r.id ? rowEditor(editing) : (
                      <>
                        <button type="button" className="imp-main" onClick={() => setEditing({ id: r.id, day: r.day ?? '', start: r.start, end: r.end, title: r.title, kind: r.kind })}
                          aria-label={`${r.title || 'Adsız'}, ${timeText(r)}. Düzenle`}>
                          <span className="tm">{timeText(r)}</span>
                          <span className="nm">
                            {r.title || <i>Adsız</i>}
                            {(r.kind || r.merged > 1 || r.note) && (
                              <small className="sub">
                                {[r.kind && `${kindInfo(r.kind).icon} ${kindInfo(r.kind).label}`, r.merged > 1 && `${r.merged} ders saati`, r.note]
                                  .filter(Boolean).join(' · ')}
                              </small>
                            )}
                            {r.issue ? <small className="why">⚠ {r.issue} · dokunup düzelt</small>
                              : inPlan(r) ? <small className="why dup">✓ Zaten planda</small>
                              : r.hint && !outOfRange(r) ? <small className="why">⚠ {r.hint}</small> : null}
                          </span>
                        </button>
                        {inPlan(r) && (
                          <button type="button" className="btn-ghost small imp-fix" aria-label={`${r.title} zaten planda, yine de ekle`}
                            onClick={() => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, allowDup: true } : x)))}>Ekle</button>
                        )}
                        {r.suggest && !r.issue && !inPlan(r) && (
                          <button type="button" className="btn-ghost small imp-fix" aria-label={`Adı ${r.suggest} yap`}
                            onClick={() => applySuggest(r)}>Evet</button>
                        )}
                        <button type="button" className="x" aria-label={`${r.title || 'Kaydı'} kaldır`} onClick={() => remove(r.id)}>×</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            );
          })}
          {editing && !rows.some((r) => r.id === editing.id) ? (
            <section className="imp-day"><h4>Yeni kayıt</h4><div className="imp-rows">{rowEditor(editing)}</div></section>
          ) : (
            <button type="button" className="link imp-add" onClick={addRow}>+ Kayıt ekle</button>
          )}
        </div>
        <div className="imp-foot">
          <div className="acts">
            <button type="button" className="btn-ghost" onClick={close}>Vazgeç</button>
            <button type="button" className="go" onClick={submit} disabled={busy || checking || !ready.length || !!dateError}>
              <BusyLabel busy={busy} text={ready.length ? `${ready.length} kaydı ekle` : 'Eklenecek kayıt yok'} busyText="Ekleniyor…" />
            </button>
          </div>
          <p>
            {blocked + skipped + dups > 0
              ? [blocked > 0 && `eksik bilgili ${blocked}`, skipped > 0 && `tarih dışında ${skipped}`, dups > 0 && `zaten planda olan ${dups}`]
                .filter(Boolean).join(', ')
                .replace(/^./, (c) => c.toLocaleUpperCase('tr')) + ' kayıt eklenmez'
              : 'Ekledikten sonra “Geri al” ile hepsi birden silinebilir'}
          </p>
        </div>
      </>
    );
  }

  return (
    <Sheet className={`addsheet impsheet${step === 'preview' ? ' tall' : ''}`} labelledBy={titleId} onClose={close} returnFocusRef={returnFocusRef}>
      {content}
    </Sheet>
  );
}

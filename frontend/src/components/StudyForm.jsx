import { useId, useState } from 'react';
import TimeInput from './TimeInput';
import { STATUS_ORDER, STATUS_SHORT } from '../utils/format';
import { clashText, hm, overlapping, toMin } from '../utils/timeline';

const CHIPS = [30, 40, 60, 120];

export const EMPTY_STUDY = { subject: '', topic: '', minutes: '', startTime: '', status: 'todo' };

// Düzenlenen dersin form değeri
export const studyDraft = (entry) => ({
  subject: entry.subject, topic: entry.topic || '', minutes: String(entry.minutes),
  startTime: entry.startTime || '', status: entry.status,
});

// Ders formu (Görev 10; Görev 16: ders çipleri): Ders · Konu · Süre (çipler + dk) · Başlangıç (isteğe bağlı) | Bitiş (girilince süre ondan hesaplanır; 07.11) · özet ·
// çakışma uyarısı · hata · eylemler. Ekle sayfasında (AddSheet) ve düzenleme sayfasında (AgendaSheet) kullanılır.
// Denetimli bileşen: value ({ subject, topic, minutes, startTime, status }) ve onChange(kısmi değer) üst bileşende;
// böylece To-do'nun ekleme formu gün değişince açık kalır, Bee sayfasında Ders <-> Aktivite geçişinde başlangıç korunur.
// - subjects: ders adları; düzenlenen dersin adı listede yoksa (silinmiş) seçenek olarak eklenir.
// - items: Bee öğeleri (dersler + aktiviteler; çakışma uyarısı için, engellemez); excludeKey: düzenlenen dersin itemKey'i.
// - onSubmit(body): eklemede { subject, topic, minutes, startTime }; düzenlemede + status ve startTime her zaman
//   ("" = saati sil). true dönerse başarılıdır.
// - extra: eylem satırının sağına (ör. "Dersleri düzenle"); submitLabel: Ekle düğmesinin erişilebilir adı.
export default function StudyForm({
  mode = 'add', value, onChange, subjects, items = [], excludeKey = null,
  onSubmit, onCancel, busy = false, extra, submitLabel, subjectRef, minutesRef,
}) {
  const [error, setError] = useState('');
  const subjectId = useId();
  const set = (k) => (e) => { setError(''); onChange({ [k]: e.target.value }); };
  const edit = mode === 'edit';

  const options = value.subject && !subjects.includes(value.subject) && edit ? [value.subject, ...subjects] : subjects;
  // Eklemede seçili ders listeden silindiyse seçim boş sayılır
  const subject = options.includes(value.subject) ? value.subject : '';

  const mins = /^\d+$/.test(value.minutes) ? Number(value.minutes) : NaN;
  const minsOk = mins >= 1 && mins <= 1440;
  const S = toMin(value.startTime);
  const hasStart = S != null;
  const E = hasStart && minsOk ? S + mins : null;
  const end = E != null ? hm(E) : null;

  // Bitiş girilince süre ondan hesaplanır; gece yarısını geçebilir (23:00 → 01:00 = 120 dk). Saklanan yine başlangıç ve
  // süredir, bitiş alanı her zaman ikisinden türetilir. Başlangıç yokken bitiş girilemez.
  function setEnd(v) {
    setError('');
    const e = toMin(v);
    if (e == null || S == null) return;
    const diff = (e - S + 1440) % 1440;
    if (diff === 0) { setError('Bitiş başlangıçla aynı olamaz.'); return; }
    onChange({ minutes: String(diff) });
  }

  let summary;
  if (!hasStart) summary = <>Saat seçmezsen ders “Gün içinde · saati yok” bölümünde görünür.</>;
  else if (E == null) summary = <>Süreyi seçince bitiş görünür.</>;
  else if (E - S >= 1440) summary = <>Bitiş ertesi gün <b>{end}</b> · 24 saat</>;
  else if (E >= 1440) summary = <>Bitiş <b>{end}</b> · ↷ ertesi gün biter</>;
  else summary = <>Bitiş <b>{end}</b> · akışta {value.startTime}–{end} görünür</>;

  const clash = E != null
    ? overlapping(items, { time: value.startTime, minutes: mins, isStudy: true }, excludeKey) : [];

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!subject) return setError('Ders seç.');
    if (!minsOk) return setError('Süreyi dakika olarak gir (1-1440).');
    setError('');
    const body = { subject, topic: value.topic.trim(), minutes: mins, startTime: hasStart ? value.startTime : '' };
    if (edit) body.status = value.status;
    await onSubmit(body);
  }

  return (
    <form className="sform" onSubmit={submit} noValidate>
      <div className="fl">
        <span id={subjectId}>Ders</span>
        {/* Görev 16: açılır liste yerine tek dokunuşla seçilen çipler; seçili çip bal sarısı ve koyu çerçeveli */}
        <div className="subj-chips" role="group" aria-labelledby={subjectId} ref={subjectRef} tabIndex={-1}>
          {options.map(s => (
            <button key={s} type="button" className={s === subject ? 'on' : ''} aria-pressed={s === subject}
              onClick={() => { setError(''); onChange({ subject: s }); }}>{s}</button>
          ))}
        </div>
      </div>
      <label className="fl">
        <span>Konu <span className="opt">(isteğe bağlı)</span></span>
        <input placeholder="ör. Paragraf soruları" maxLength={200} value={value.topic} onChange={set('topic')} />
      </label>

      <div className="fl">
        <span aria-hidden="true">Süre</span>
        <div className="durrow">
          <div className="evchips" role="group" aria-label="Süre">
            {CHIPS.map(c => {
              const on = mins === c;
              return (
                <button key={c} type="button" className={on ? 'on' : ''} aria-pressed={on}
                  onClick={() => { setError(''); onChange({ minutes: String(c) }); }}>{c} dk</button>
              );
            })}
          </div>
          <input ref={minutesRef} type="number" inputMode="numeric" min="1" max="1440" aria-label="Dakika" placeholder="dk"
            value={value.minutes} onChange={set('minutes')} aria-invalid={error && !minsOk ? true : undefined} />
        </div>
      </div>

      <div className="evtimes two">
        <label>
          <span>Başlangıç <span className="opt">(isteğe bağlı)</span></span>
          <TimeInput value={value.startTime} onChange={v => { setError(''); onChange({ startTime: v }); }} label="Başlangıç (isteğe bağlı)" />
        </label>
        <label>
          <span>Bitiş</span>
          <TimeInput value={end ?? ''} onChange={setEnd} label="Bitiş" disabled={!hasStart}
            title={hasStart ? undefined : 'Önce başlangıç saatini seç'} />
        </label>
      </div>

      <p className="evsum" aria-live="polite">{summary}</p>
      {clash.length > 0 && (
        <div className="evwarn" role="status">
          <span aria-hidden="true">⚠</span><span>{clashText(clash)} Yine de ekleyebilirsin.</span>
        </div>
      )}

      {edit && (
        <label className="fl">Durum
          <select value={value.status} onChange={set('status')}>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_SHORT[s]}</option>)}
          </select>
        </label>
      )}

      {error && <div className="inline-error" role="alert">{error}</div>}

      <div className="frm-act">
        <button type="submit" className="go" disabled={busy} aria-label={!edit ? submitLabel : undefined}>{edit ? 'Kaydet' : 'Ekle'}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>İptal</button>}
        {extra}
      </div>
    </form>
  );
}

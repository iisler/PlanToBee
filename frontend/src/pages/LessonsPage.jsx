import { useId, useRef, useState } from 'react';
import WeekHead from '../components/WeekHead';
import HoneycombSpinner from '../components/HoneycombSpinner';
import Sheet from '../components/Sheet';
import StatusCheck from '../components/StatusCheck';
import SubjectManager from '../components/SubjectManager';
import { addDays, dkey, formatDuration, mondayOf, WEEKDAYS_FULL, weekRangeLabel, withPossessive } from '../utils/format';
import { parseKey } from '../utils/recurrence';
import { toMin } from '../utils/timeline';

// Günün dersleri: saatliler başlangıca göre, sonra saatsizler eklenme sırasıyla
function sortStudies(entries) {
  const timed = entries.filter(e => toMin(e.startTime) != null).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  return [...timed, ...entries.filter(e => toMin(e.startTime) == null)];
}
// Çıkma eki ünlü uyumuna göre: "Salı'dan kaldı", "Perşembe'den kaldı"
const FROM_DAY = ["Pazartesi'den", "Salı'dan", "Çarşamba'dan", "Perşembe'den", "Cuma'dan", "Cumartesi'den", "Pazar'dan"];
const dayName = (key) => WEEKDAYS_FULL[(parseKey(key).getDay() + 6) % 7];

// Dersler sayfası (Görev 17): haftanın bütün dersleri tek listede.
// - Üstte haftalık ilerleme (petek, tamamlanan / toplam, çalışılan ve kalan süre).
// - "Güne göre": bu haftaysa önce "Geride kalan" (önceki günlerin tamamlanmamış dersleri; "Bugüne al" ile bugüne taşınır),
//   sonra bugün ve sonraki günler, en sonda önceki günlerin tamamlananları. "Derse göre": ders başına toplam ve ilerleme.
// - Durum düğmesi her satırda (onStatus(gün, ders, durum)); satıra dokununca o gün açılır (onPick).
// - "Ders listesini düzenle": ailenin ders listesi (SubjectManager) alt sayfada.
// days: 7 DayDto ya da null; error: yükleme hatası. onMove(gün, ders): dersi bugüne taşır.
// Görev 17b: Hafta'nın alt sayfası (alt menüdeki yeri Program yükle'ye geçti); onBack Hafta'ya döner. Ders listesi sayfası
// açıldığı andaki layerReset değeriyle tutulur: alt menüye dokununca ya da bildirimden gün açılınca kendiliğinden kapanır.
export default function LessonsPage({
  monday, days, error, onRetry, onStep, onPick, onStatus, onMove, subjects, onAddSubject, onDeleteSubject, onBack, layerReset,
  headingRef, children,
}) {
  const [mode, setMode] = useState('day');
  const [listOpenAt, setListOpenAt] = useState(null);
  const listOpen = listOpenAt !== null && listOpenAt === layerReset;
  const closeList = () => setListOpenAt(null);
  const listBtnRef = useRef(null);
  const listTitleId = useId();
  const todayKey = dkey(new Date());
  const isThisWeek = dkey(mondayOf(new Date())) === dkey(monday);
  const range = weekRangeLabel(monday, { withYear: true });
  const head = (
    <>
      <button type="button" className="btn-ghost small backlink" onClick={onBack}>‹ Hafta</button>
      <WeekHead over={`${isThisWeek ? 'Bu hafta' : 'Hafta'} · ${range}`} title="Dersler" onStep={onStep} headingRef={headingRef}>{children}</WeekHead>
    </>
  );

  if (!days) return (
    <>
      {head}
      {error ? (
        <div className="load-error" role="alert">
          <p>Dersler yüklenemedi: {error}</p>
          <button type="button" className="btn" onClick={onRetry}>Tekrar dene</button>
        </div>
      ) : (
        <div className="sheet-loading" role="status"><HoneycombSpinner size={64} /><span>Yükleniyor, biraz bekle…</span></div>
      )}
    </>
  );

  const all = days.flatMap(d => sortStudies(d.studyEntries ?? []).map(e => ({ day: d, e })));
  const done = all.filter(x => x.e.status === 'done');
  const doneMin = done.reduce((s, x) => s + x.e.minutes, 0);
  const leftMin = all.reduce((s, x) => s + x.e.minutes, 0) - doneMin;
  const late = isThisWeek ? all.filter(x => x.day.date < todayKey && x.e.status !== 'done') : [];
  const earlier = isThisWeek ? all.filter(x => x.day.date < todayKey && x.e.status === 'done') : [];
  const upcoming = days.filter(d => (!isThisWeek || d.date >= todayKey) && (d.studyEntries ?? []).length > 0);

  const title = (key) => {
    if (key === todayKey) return `Bugün · ${dayName(key)}`;
    if (key === dkey(addDays(new Date(), 1))) return `Yarın · ${dayName(key)}`;
    return `${dayName(key)} ${parseKey(key).getDate()}`;
  };
  // extra: satırın hangi günden olduğu; movable: "Bugüne al" düğmesi (yalnızca geride kalan ve düzenlenebilir ders)
  const row = ({ day, e }, extra, movable = false) => {
    const sub = [e.topic, extra, e.startTime || 'saati yok', formatDuration(e.minutes), e.status === 'inprogress' && 'devam ediyor'].filter(Boolean).join(' · ');
    return (
      <li key={e.id} className={`ls-row${e.status === 'done' ? ' done' : ''}`}>
        <button type="button" className="ls-main" aria-label={`${e.subject}, ${sub}. ${dayName(day.date)} gününü aç`} onClick={() => onPick(parseKey(day.date))}>
          <span className="t1">{e.subject}</span>
          <span className="t2">{sub}</span>
        </button>
        {movable && e.canEdit && <button type="button" className="ls-move" onClick={() => onMove(day, e)}>Bugüne al</button>}
        <StatusCheck entry={e} onStatus={(entry, status) => onStatus(day, entry, status)} />
      </li>
    );
  };
  const group = (key, name, count, items, cls = '') => (
    <section key={key} className={`ls-group ${cls}`}>
      <h2><span>{name}</span><small>{count}</small></h2>
      <ul>{items}</ul>
    </section>
  );

  let body;
  if (all.length === 0) {
    body = <p className="fl-empty">{isThisWeek ? 'Bu hafta' : 'Bu haftada'} ders yok. Alt menüdeki + ile ekleyebilirsin.</p>;
  } else if (mode === 'day') {
    body = (
      <>
        {late.length > 0 && group('late', 'Geride kalan', `${late.length} ders`, late.map(x => row(x, `${FROM_DAY[(parseKey(x.day.date).getDay() + 6) % 7]} kaldı`, true)), 'late')}
        {upcoming.map(d => {
          const list = sortStudies(d.studyEntries);
          return group(d.date, title(d.date), `${list.filter(e => e.status === 'done').length}/${list.length}`, list.map(e => row({ day: d, e })));
        })}
        {earlier.length > 0 && group('earlier', 'Önceki günler', `${earlier.length} tamam`, earlier.map(x => row(x, dayName(x.day.date))))}
      </>
    );
  } else {
    const by = new Map();
    for (const { e } of all) {
      const s = by.get(e.subject) ?? { total: 0, done: 0, minutes: 0 };
      s.total++; s.minutes += e.minutes;
      if (e.status === 'done') s.done++;
      by.set(e.subject, s);
    }
    body = (
      <section className="ls-group">
        <ul>
          {[...by].sort((a, b) => b[1].minutes - a[1].minutes).map(([name, s]) => (
            <li key={name} className="ls-subj">
              <span className="t1">{name}<small>{s.done}/{s.total} · {formatDuration(s.minutes)}</small></span>
              <i className="bar" role="img" aria-label={`${s.total} dersten ${withPossessive(s.done)} tamam`}><i style={{ width: `${Math.round((s.done / s.total) * 100)}%` }} /></i>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      {head}
      {all.length > 0 && (
        <section className="ls-sum" aria-label="Haftalık ilerleme">
          <span className="hex" aria-hidden="true">
            <span className="hex-in"><span className="hex-fill" style={{ height: `${Math.round((done.length / all.length) * 100)}%` }} /></span>
          </span>
          <div>
            <b>{all.length} dersin {withPossessive(done.length)} tamam</b>
            <span>{formatDuration(doneMin)} çalışıldı{leftMin > 0 && ` · ${formatDuration(leftMin)} kaldı`}</span>
          </div>
        </section>
      )}
      {all.length > 0 && (
        <div className="seg2" role="group" aria-label="Sıralama">
          <button type="button" className={mode === 'day' ? 'on' : ''} aria-pressed={mode === 'day'} onClick={() => setMode('day')}>Güne göre</button>
          <button type="button" className={mode === 'subject' ? 'on' : ''} aria-pressed={mode === 'subject'} onClick={() => setMode('subject')}>Derse göre</button>
        </div>
      )}
      {body}
      <button type="button" ref={listBtnRef} className="btn-ghost ls-list" onClick={() => setListOpenAt(layerReset)}>Ders listesini düzenle</button>

      {listOpen && (
        <Sheet className="addsheet" labelledBy={listTitleId} onClose={closeList} returnFocusRef={listBtnRef}>
          <div className="sheet-head">
            <h3 id={listTitleId} tabIndex={-1}>Ders listesi</h3>
            <button type="button" className="sheet-close" onClick={closeList}>Kapat</button>
          </div>
          <div className="sheet-body"><SubjectManager subjects={subjects} onAdd={onAddSubject} onDelete={onDeleteSubject} /></div>
        </Sheet>
      )}
    </>
  );
}

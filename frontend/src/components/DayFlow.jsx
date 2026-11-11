import { useEffect, useMemo, useRef, useState } from 'react';
import useNow from '../hooks/useNow';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';
import useDaySwipe from '../hooks/useDaySwipe';
import { useAuditSettings } from '../context/AuditContext';
import { eventLabel } from '../utils/events';
import { addDays, creatorMark, dkey, formatDuration, STATUS_SHORT, WEEKDAYS } from '../utils/format';
import { isOccurrence, parseKey, repeatAria } from '../utils/recurrence';
import { ariaEvent, durationLong, flowClass, flowRows, freeSummary, hm, itemKey, timeText } from '../utils/timeline';
import AgendaSheet from './AgendaSheet';
import AuditTag from './AuditTag';
import EntryMenu from './EntryMenu';
import KindIcon from './KindIcon';
import RepeatMark from './RepeatMark';
import StatusCheck from './StatusCheck';
import { Check } from './Icons';

// Kaydırırken açılan kenardaki gün: "Paz 1", bugünse "Bugün"
function stepLabel(date, dir) {
  const d = addDays(parseKey(date), dir);
  return dkey(d) === dkey(new Date()) ? 'Bugün' : `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

const FILTERS = [['all', 'Tümü'], ['study', 'Dersler'], ['event', 'Aktiviteler']];
const EMPTY = { study: 'Bu gün için ders yok.', event: 'Bu gün için aktivite yok.' };

// Günün akışı (Görev 17): dersler ve aktiviteler tek sıralı listede; saat çizelgesinin (Görev 09) yerini alır.
// - Üstte süzgeç çipleri (Tümü · Dersler · Aktiviteler; eski To-do ve Plan ekranlarının yerine) ve günün boş süresi.
// - "Gün içinde · saati yok": saatsiz kayıtlar çip olarak; ders çipinde durum düğmesi.
// - Liste: saat · tür peteği · ad ve ayrıntı · (derste) durum düğmesi. Satıra dokununca ⋯ menüsü (Düzenle / Sil) açılır;
//   düzenleme alt sayfada (AgendaSheet). 1 saat ve üstü boşluklar ince bilgi satırı (ekleme alt menüdeki + ile, Görev 14b).
//   Bugün: süren kayıt bal zeminli, biten kayıt soluk. Tamamlanan dersin peteği bal rengiyle dolar.
// Liste sola çekilince ertesi güne, sağa çekilince önceki güne geçer (hooks/useDaySwipe); onStep(+1 | -1).
// items: utils/timeline agendaItems. study / events: DayPage'deki işlemler (study.setStatus, save, remove ...).
export default function DayFlow({ date, items, isToday, myId, menuReset, subjects, study, events, dateLabel, onStep }) {
  const { hideInitials } = useAuditSettings();
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const [sheet, setSheet] = useState(null); // açık düzenleme sayfası: { mode, entry, scope, reset }
  const openerRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const pendingFocus = useRef(null);
  const now = useNow(isToday);
  const keyed = useMemo(() => items.map(x => ({ id: itemKey(x) })), [items]);
  const focusAfterDelete = useFocusAfterDelete(keyed, cardRef, () => headingRef.current);
  const { bodyRef, hint } = useDaySwipe(cardRef, onStep, date);

  const counts = { all: items.length, study: items.filter(x => x.isStudy).length };
  counts.event = counts.all - counts.study;
  const shown = useMemo(() => (filter === 'all' ? items : items.filter(x => !!x.isStudy === (filter === 'study'))), [items, filter]);
  const { rows, untimed } = useMemo(() => flowRows(shown, filter === 'all', now), [shown, filter, now]);

  // Menü ve sayfa, açıldıkları andaki menuReset değeriyle tutulur: bildirimden gün açılınca kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;
  const openSheet = sheet && sheet.reset === menuReset ? sheet : null;

  // Gün değişince açık sayfa kapanır
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setSheet(null); }

  // Başarılı kayıttan sonra odak düzenlenen öğeye gider. Sheet'in "odak açan düğmeye döner" temizliği bu etkiden önce çalışır.
  useEffect(() => {
    if (!pendingFocus.current || openSheet) return;
    const el = cardRef.current?.querySelector(`[data-id="${pendingFocus.current}"]`);
    pendingFocus.current = null;
    el?.focus();
  }, [items, openSheet]);

  function remove(entry, all = false) {
    focusAfterDelete({ id: itemKey(entry) });
    if (all) events.removeSeries(entry);
    else (entry.isStudy ? study : events).remove(entry);
  }
  // scope: tekrarlanan kayıtta 'one' (yalnızca bu gün) ya da 'all' (bütün tekrarlar)
  const edit = (entry, scope) => setSheet({ mode: entry.isStudy ? 'study' : 'event', entry, scope, reset: menuReset });

  // Erişilebilir ada "kim ekledi" eklenir (görünen baş harf düğmenin aria-label'ı altında okunmaz)
  const who = (ev) => {
    const m = hideInitials ? null : creatorMark(ev, myId);
    return `${repeatAria(ev)}${m ? `, ${m.text}` : ''}`;
  };
  const opener = (ev, label) => ({
    type: 'button', 'data-id': itemKey(ev), 'aria-haspopup': 'dialog', 'aria-label': `${label}${who(ev)}: seçenekler`,
    onClick: (e) => { openerRef.current = e.currentTarget; setMenu({ entry: ev, reset: menuReset }); },
  });
  const state = (ev) => (ev.isStudy ? `, ${STATUS_SHORT[ev.status]}` : '');

  return (
    <section className="flow swipe" ref={cardRef} aria-label="Günün akışı">
      {hint && (
        <span className={`swipe-hint ${hint.dir > 0 ? 'next' : 'prev'}${hint.ready ? ' ready' : ''}`} style={{ top: hint.y }} aria-hidden="true">
          {hint.dir > 0 ? `${stepLabel(date, 1)} ›` : `‹ ${stepLabel(date, -1)}`}
        </span>
      )}
      <div className="swipe-body" ref={bodyRef}>
        <h2 className="sr-only" ref={headingRef} tabIndex={-1}>Günün akışı</h2>
        {/* Boş günde süzgeç yok: Şimdi kartı "Plan yok" der ve ekleme düğmelerini gösterir */}
        <div className="flow-head" hidden={items.length === 0}>
          <div className="fchips" role="group" aria-label="Göster">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? 'on' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}{id !== 'all' && counts[id] > 0 && <span className="n"> {counts[id]}</span>}
              </button>
            ))}
          </div>
          {filter === 'all' && rows.length > 0 && <span className="flow-free">{freeSummary(items)}</span>}
        </div>

        {untimed.length > 0 && (
          <div className="fl-un">
            <span className="lb" aria-hidden="true">Gün içinde · saati yok</span>
            <div className="fl-chips">
              {untimed.map(ev => (ev.isStudy ? (
                <span key={itemKey(ev)} className={`unchip two${ev.status === 'done' ? ' done' : ''}`}>
                  <StatusCheck entry={ev} onStatus={study.setStatus} />
                  <button {...opener(ev, `${ev.subject}, ders, saati yok, ${durationLong(ev.minutes)}${state(ev)}`)}>
                    <span className="nm">{ev.subject}</span><AuditTag entry={ev} myId={myId} /><small>{formatDuration(ev.minutes)}</small>
                  </button>
                </span>
              ) : (
                <button key={itemKey(ev)} className={`unchip ${flowClass(ev)}`} {...opener(ev, `${eventLabel(ev)}, saati yok`)}>
                  <KindIcon ev={ev} size={17} /><span className="nm">{eventLabel(ev)}</span><RepeatMark entry={ev} /><AuditTag entry={ev} myId={myId} />
                </button>
              )))}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <ol className="flist" aria-label="Saatli kayıtlar">
            {rows.map((row) => {
              if (row.type === 'gap') {
                const a = row.now ? now : row.a;
                return (
                  <li key={row.key} className={`fl-gap${row.now ? ' now' : ''}`}>
                    <span className="sr-only">{hm(a)}–{hm(row.b)} boş, {durationLong(row.b - a)}</span>
                    <span className="dot" aria-hidden="true" />
                    <span className="gt" aria-hidden="true">{row.now ? 'Şimdi' : hm(a)}–{hm(row.b)} boş · {formatDuration(row.b - a)}</span>
                  </li>
                );
              }
              const { r } = row;
              const ev = r.ev;
              const done = ev.isStudy && ev.status === 'done';
              const sub = ev.isStudy
                ? [ev.topic, formatDuration(ev.minutes), ev.status === 'inprogress' && 'devam ediyor'].filter(Boolean).join(' · ')
                : timeText(r, 1);
              return (
                <li key={row.key} className={`fl-row ${flowClass(ev)}${row.now ? ' now' : ''}${row.past ? ' past' : ''}${done ? ' done' : ''}`}>
                  <button className="fl-main" {...opener(ev, `${ariaEvent(r)}${state(ev)}`)}>
                    <span className="fl-time">{r.start}</span>
                    <span className="fl-node" aria-hidden="true"><span className="hx">{done ? <Check /> : <KindIcon ev={ev} size={16} />}</span></span>
                    <span className="fl-tx">
                      <span className="t1"><span className="nm">{eventLabel(ev)}</span><RepeatMark entry={ev} /><AuditTag entry={ev} myId={myId} /></span>
                      <span className="t2">{sub}</span>
                    </span>
                  </button>
                  {ev.isStudy && <StatusCheck entry={ev} onStatus={study.setStatus} />}
                </li>
              );
            })}
          </ol>
        )}

        {shown.length === 0 && filter !== 'all' && <p className="fl-empty">{EMPTY[filter]}</p>}
      </div>

      {menuEntry && (
        <EntryMenu kind={menuEntry.isStudy ? 'study' : 'event'} entry={menuEntry} myId={myId} returnFocusRef={openerRef}
          onClose={() => setMenu(null)} onEdit={() => edit(menuEntry, isOccurrence(menuEntry) ? 'one' : undefined)}
          onEditAll={() => edit(menuEntry, 'all')} onDelete={() => remove(menuEntry)} onDeleteAll={() => remove(menuEntry, true)} />
      )}
      {openSheet && (
        <AgendaSheet sheet={openSheet} items={items} subjects={subjects} study={study} events={events} dateLabel={dateLabel}
          returnFocusRef={openerRef} onClose={() => setSheet(null)} onDone={(key) => { pendingFocus.current = key; setSheet(null); }} />
      )}
    </section>
  );
}

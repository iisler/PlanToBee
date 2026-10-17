import { useEffect, useMemo, useRef, useState } from 'react';
import { freeSummary, itemKey } from '../utils/timeline';
import { isOccurrence } from '../utils/recurrence';
import Timeline from './Timeline';
import EntryMenu from './EntryMenu';
import AgendaSheet from './AgendaSheet';
import useFocusAfterDelete from '../hooks/useFocusAfterDelete';

// Bee (Ajanda, Görev 10): dersler ve aktiviteler tek saat çizelgesinde (components/Timeline). Üstte yalnızca boş süre
// özeti. Kartta ekleme formu yok: boşluktaki "+ Ekle" alt sayfayı (AgendaSheet) açar; ⋯ → Düzenle de alt sayfada.
// Ders dairesi durumu değiştirir (To-do ile aynı işlem: study.cycle). items: agendaItems (DayPage).
export default function AgendaCard({ date, items, isToday, myId, menuReset, subjects, study, events, dateLabel, panel }) {
  const [menu, setMenu] = useState(null); // açık ⋯ menüsü: { entry, reset }
  const [sheet, setSheet] = useState(null); // açık alt sayfa: { mode, start, end, entry, reset }
  const openerRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const pendingFocus = useRef(null);
  const keyed = useMemo(() => items.map(x => ({ id: itemKey(x) })), [items]);
  const focusAfterDelete = useFocusAfterDelete(keyed, cardRef, () => headingRef.current);

  // Menü ve sayfa, açıldıkları andaki menuReset değeriyle tutulur: bildirimden gün açılınca kendiliğinden kapanır
  const menuEntry = menu && menu.reset === menuReset ? menu.entry : null;
  const openSheet = sheet && sheet.reset === menuReset ? sheet : null;

  // Gün değişince açık sayfa kapanır
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setSheet(null); }

  // Başarılı kayıttan sonra odak yeni (ya da düzenlenen) öğeye gider. Sheet'in "odak açan düğmeye döner" temizliği
  // bu etkiden önce çalışır.
  useEffect(() => {
    if (!pendingFocus.current || openSheet) return;
    const el = cardRef.current?.querySelector(`[data-id="${pendingFocus.current}"]`);
    pendingFocus.current = null;
    el?.focus();
  }, [items, openSheet]);

  function onDone(key) {
    pendingFocus.current = key;
    setSheet(null);
  }

  function remove(entry, all = false) {
    focusAfterDelete({ id: itemKey(entry) });
    if (all) events.removeSeries(entry);
    else (entry.isStudy ? study : events).remove(entry);
  }

  // scope: tekrarlanan kayıtta 'one' (yalnızca bu gün) ya da 'all' (bütün tekrarlar)
  function edit(entry, scope) {
    setSheet({ mode: entry.isStudy ? 'study' : 'event', entry, scope, reset: menuReset });
  }

  return (
    <div className="card" ref={cardRef} {...panel}>
      <div className="card-head">
        <h2 className="sumh" ref={headingRef} tabIndex={-1}>{freeSummary(items)}</h2>
      </div>

      <Timeline events={items} isToday={isToday} myId={myId} onCycle={e => study.cycle(e)}
        onOpen={(ev, el) => { openerRef.current = el; setMenu({ entry: ev, reset: menuReset }); }}
        onGap={(start, end, el) => {
          openerRef.current = el;
          setSheet({ mode: 'add', start, end, reset: menuReset });
        }} />

      {menuEntry && (
        <EntryMenu kind={menuEntry.isStudy ? 'study' : 'event'} entry={menuEntry} myId={myId} returnFocusRef={openerRef}
          onClose={() => setMenu(null)} onEdit={() => edit(menuEntry, isOccurrence(menuEntry) ? 'one' : undefined)}
          onEditAll={() => edit(menuEntry, 'all')} onDelete={() => remove(menuEntry)} onDeleteAll={() => remove(menuEntry, true)} />
      )}
      {openSheet && (
        <AgendaSheet sheet={openSheet} date={date} items={items} subjects={subjects} study={study} events={events} dateLabel={dateLabel}
          returnFocusRef={openerRef} onClose={() => setSheet(null)} onDone={onDone} />
      )}
    </div>
  );
}

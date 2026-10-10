import { useEffect, useMemo, useState } from 'react';
import { eventLabel } from '../utils/events';
import { creatorMark, formatDuration } from '../utils/format';
import { useAuditSettings } from '../context/AuditContext';
import AuditTag from './AuditTag';
import {
  ariaEvent, classify, durationLong, hm, iconOf, kindClass, layoutDay, rangeText, timeText, WE, WS,
} from '../utils/timeline';

const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// Bugün için dakikada bir güncellenen "şu an" (dakika); başka günlerde null
function useNow(active) {
  const [now, setNow] = useState(nowMinutes);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : null;
}

const BREAK = (
  <path d="M2 5l4-3 4 3 4-3M2 12l4-3 4 3 4-3" />
);

// Günün aktiviteleri saat çizelgesi olarak (Görev 09): üstte "Saati yok" şeridi ve 07:00 öncesi satırları, ortada
// 07:00–22:00 çizelgesi (kümeler + boşluklar üst üste; uzun boşluk sıkıştırılır), altta 22:00 sonrası satırları.
// Her kayıt bir düğmedir: onOpen(entry, button) ⋯ menüsünü açar. Boşluk düğmesi onGap(start, end) ile ekleme formunu açar.
// editingId: düzenlenen kayıt (bloğu çerçevelenir).
export default function Timeline({ events, isToday, myId, editingId, onOpen, onGap }) {
  const { hideInitials } = useAuditSettings();
  const rawNow = useNow(isToday);
  const nowMin = rawNow != null && rawNow >= WS && rawNow < WE ? rawNow : null;
  const { untimed, before, after, inw } = useMemo(() => classify(events), [events]);
  const lay = useMemo(() => layoutDay(inw, nowMin), [inw, nowMin]);

  // Erişilebilir ada "kim ekledi" eklenir (görünen baş harf düğmenin aria-label'ı altında okunmaz)
  const who = (ev) => {
    const m = hideInitials ? null : creatorMark(ev, myId);
    return m ? `, ${m.text}` : '';
  };
  const open = (ev) => (e) => onOpen(ev, e.currentTarget);
  const common = (ev) => ({
    type: 'button', 'data-id': ev.id, 'aria-haspopup': 'dialog', onClick: open(ev),
  });

  const outRow = (r, dir) => (
    <button key={r.ev.id} {...common(r.ev)} className="tl-row two"
      aria-label={`${ariaEvent(r)}, ${dir === 'b' ? '07:00 öncesi' : '22:00 sonrası'}${who(r.ev)}: seçenekler`}>
      <span className="ic" aria-hidden="true">{iconOf(r.ev)}</span>
      <span className="nm">
        <span className="t1">{eventLabel(r.ev)}<AuditTag entry={r.ev} myId={myId} /></span>
        <span className="t2"><span className="tm">{r.noEnd ? r.start : rangeText(r)}</span> · {dir === 'b' ? '↑ 07:00 öncesi' : '↓ 22:00 sonrası'}</span>
      </span>
      <span className="mo" aria-hidden="true">⋯</span>
    </button>
  );

  return (
    <>
      {untimed.length > 0 && (
        <div className="tl-untimed">
          <span className="lb" aria-hidden="true">Saati yok</span>
          {untimed.map(ev => (
            <button key={ev.id} {...common(ev)} className={`tl-row${editingId === ev.id ? ' edit' : ''}`}
              aria-label={`${eventLabel(ev)}, saati yok${who(ev)}: seçenekler`}>
              <span className="ic" aria-hidden="true">{iconOf(ev)}</span>
              <span className="nm">{eventLabel(ev)}<AuditTag entry={ev} myId={myId} /></span>
              <span className="mo" aria-hidden="true">⋯</span>
            </button>
          ))}
        </div>
      )}

      {before.length > 0 && <div className="tl-out">{before.map(r => outRow(r, 'b'))}</div>}

      {inw.length === 0 ? (
        <div className="tl-empty">{isToday ? 'Bugün' : 'Bu gün'} saatli aktivite yok · <b>tüm gün boş</b></div>
      ) : (
        <div className="tl" style={{ height: lay.height + 8 }}>
          <div aria-hidden="true">
            {lay.labels.map(l => (
              <span key={`${l.text}${l.now ? 'n' : ''}`} className={`tl-ax${l.now ? ' now' : ''}`} style={{ top: Math.round(l.y) }}>{l.text}</span>
            ))}
            {lay.breaks.map(y => (
              <svg key={y} className="tl-brk" style={{ top: Math.round(y) }} viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">{BREAK}</svg>
            ))}
          </div>
          <div className="tl-track" style={{ height: lay.height }}>
            <ol className="tl-list" aria-label="Saat çizelgesi, 07:00–22:00">
              {lay.items.map(it => {
                const pos = { top: Math.round(it.top), height: Math.round(it.height) };
                if (it.type === 'gap') return (
                  <li key={it.key} style={pos}>
                    <button type="button" className="tl-gap" onClick={() => onGap(hm(it.a), hm(it.b))}
                      aria-label={`${hm(it.a)}–${hm(it.b)} boş, ${durationLong(it.d)}. Bu aralığa aktivite ekle`}>
                      <span className="gt"><b>{hm(it.a)}–{hm(it.b)}</b> boş · {formatDuration(it.d)}</span>
                      <span className="pl" aria-hidden="true">+ Ekle</span>
                    </button>
                  </li>
                );
                if (it.type === 'list') return (
                  <li key={it.key} style={pos}>
                    <div className="tl-many">
                      <span className="hd">{hm(it.a)}–{hm(it.b)} · {it.rows.length} aktivite</span>
                      {it.rows.map(r => (
                        <button key={r.ev.id} {...common(r.ev)} className={`tl-row two${editingId === r.ev.id ? ' edit' : ''}`}
                          aria-label={`${ariaEvent(r)}${who(r.ev)}: seçenekler`}>
                          <span className="ic" aria-hidden="true">{iconOf(r.ev)}</span>
                          <span className="nm">
                            <span className="t1">{eventLabel(r.ev)}<AuditTag entry={r.ev} myId={myId} /></span>
                            <span className="t2 tm">{timeText(r, 1)}</span>
                          </span>
                          <span className="mo" aria-hidden="true">⋯</span>
                        </button>
                      ))}
                    </div>
                  </li>
                );
                const { r, n, lane } = it;
                const level = n === 1 ? 1 : n === 2 ? 2 : 3;
                const cls = `tl-blk ${kindClass(r.ev)} n${n}${r.noEnd ? ' noend' : ''}${r.cutTop ? ' cut-top' : ''}${r.cutBot ? ' cut-bot' : ''}${editingId === r.ev.id ? ' edit' : ''}`;
                const style = { ...pos, left: `calc(${lane} * (100% + 4px) / ${n})`, width: `calc((100% - ${(n - 1) * 4}px) / ${n})` };
                return (
                  <li key={it.key} style={style}>
                    <button {...common(r.ev)} className={cls} aria-label={`${ariaEvent(r)}${r.cutTop ? ', 07:00 öncesinden başlar' : ''}${who(r.ev)}: seçenekler`}>
                      <span className="ic" aria-hidden="true">{iconOf(r.ev)}</span>
                      <span className="tx">
                        <span className="nm">{eventLabel(r.ev)}{n === 1 && <AuditTag entry={r.ev} myId={myId} />}</span>
                        <span className="tm">{timeText(r, level)}</span>
                      </span>
                      {n === 1 && <span className="mo" aria-hidden="true">⋯</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
            {lay.nowY != null && <div className="tl-now" style={{ top: Math.round(lay.nowY) }} aria-hidden="true" />}
          </div>
        </div>
      )}

      {after.length > 0 && <div className="tl-out after">{after.map(r => outRow(r, 'a'))}</div>}
    </>
  );
}

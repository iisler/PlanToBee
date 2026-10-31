import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const SLOP = 10;     // px: bundan kısa hareket dokunuş sayılır
const COMMIT = 0.22; // kart genişliğine oran: bu kadar çekilince gün değişir
const FLICK = 0.45;  // px/ms: hızlı fiskede kısa çekme (en az 30 px) de yeter

// Tanıtım: kaydırma bu cihazda hiç kullanılmadıysa içerik açılışta bir kez kısaca sola zıplayıp yerine döner.
// Uygulama her açılışında en çok bir kez, toplam en çok 3 kez; ilk gerçek kaydırmadan sonra bir daha gösterilmez.
const NUDGE_KEY = 'plantobee:swipe-hint'; // gösterim sayısı ('1'–'3') ya da 'done'
const NUDGES = 3;
let nudged = false;
const readNudge = () => { try { return localStorage.getItem(NUDGE_KEY); } catch { return 'done'; } };
const writeNudge = (v) => { try { localStorage.setItem(NUDGE_KEY, v); } catch { /* depolama kapalı */ } };

const still = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const touch = () => !!window.matchMedia?.('(pointer: coarse)').matches;
const fade = (x, w) => 1 - Math.min(Math.abs(x) / w, 1) * 0.5;
const frame = (x, opacity) => ({ transform: x ? `translateX(${x}px)` : 'none', opacity });

// Bee (Ajanda) kartında parmakla gün değiştirme: içerik sola çekilince ertesi gün, sağa çekilince önceki gün gelir;
// art arda kaydırarak hafta sınırı da geçilir. Yalnızca dokunmatikte; dikey hareket sayfayı kaydırır (CSS touch-action: pan-y).
// İçerik parmağı izler, açılan kenarda gidilecek gün yazar. Kart genişliğinin %22'si kadar çekilmez ya da hızlı
// fiskelenmezse bırakınca yerine döner. Kaydırmanın sonundaki dokunuş alttaki düğmeye (kayıt, boşluk) gitmez.
// onStep(+1 | -1): gün değiştirir. dayKey: gösterilen gün; değişince yeni gün kaydırma yönünden girer.
// Dönüş: bind (kartın olayları), bodyRef (kayan içerik), hint: null | { dir, ready, y } (y: kartın üstünden px).
export default function useDaySwipe(onStep, dayKey) {
  const bodyRef = useRef(null);
  const drag = useRef(null);
  const busy = useRef(false); // çıkış animasyonu sürerken yeni kaydırma başlamaz
  const entering = useRef(0); // yeni günün geleceği yön
  const swipedAt = useRef(-Infinity);
  const [hint, setHint] = useState(null);

  useLayoutEffect(() => {
    const dir = entering.current;
    entering.current = 0;
    busy.current = false;
    const el = bodyRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.opacity = '';
    if (dir && !still() && el.animate) el.animate([frame(dir * 48, 0), frame(0, 1)], { duration: 180, easing: 'ease-out' });
  }, [dayKey]);

  useEffect(() => {
    const seen = readNudge();
    if (nudged || seen === 'done' || Number(seen) >= NUDGES || still() || !touch()) return undefined;
    const t = setTimeout(() => {
      const el = bodyRef.current;
      if (!el?.animate || drag.current || busy.current) return;
      nudged = true;
      writeNudge(String(Number(seen) + 1));
      el.animate([frame(0, 1), frame(-24, 1), frame(4, 1), frame(0, 1)], { duration: 420, easing: 'ease-in-out' });
    }, 600);
    return () => clearTimeout(t);
  }, []);

  function end(e, released) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.on) return;
    swipedAt.current = e.timeStamp;
    setHint(null);
    const el = bodyRef.current;
    const v = e.timeStamp - d.t > 80 ? 0 : d.v; // parmak durup bırakıldıysa fiske sayılmaz
    const go = released && (Math.abs(d.dx) >= d.w * COMMIT
      || (Math.abs(d.dx) >= 30 && Math.abs(v) >= FLICK && Math.sign(v) === Math.sign(d.dx)));
    const motion = !still() && el.animate;
    if (!go) {
      el.style.transform = '';
      el.style.opacity = '';
      if (motion) el.animate([frame(d.dx, fade(d.dx, d.w)), frame(0, 1)], { duration: 160, easing: 'ease-out' });
      return;
    }
    const dir = d.dx < 0 ? 1 : -1;
    const step = () => { entering.current = dir; writeNudge('done'); onStep(dir); };
    if (!motion) { step(); return; }
    busy.current = true;
    el.style.transform = `translateX(${-dir * d.w}px)`;
    el.style.opacity = '0';
    el.animate([frame(d.dx, fade(d.dx, d.w)), frame(-dir * d.w, 0)], { duration: 140, easing: 'ease-in' })
      .finished.then(step, () => { busy.current = false; });
  }

  const bind = {
    onPointerDown(e) {
      // Alt sayfa ve menü portal ile body'ye çizilir; onların olayları da React'te karta ulaşır
      if (e.pointerType !== 'touch' || !e.currentTarget.contains(e.target)) return;
      if (drag.current) {
        // İkinci parmak (yakınlaştırma): kaydırma bırakılır
        if (drag.current.id !== e.pointerId) end({ pointerId: drag.current.id, timeStamp: e.timeStamp }, false);
        return;
      }
      if (busy.current) return;
      const box = e.currentTarget.getBoundingClientRect();
      const y = Math.min(Math.max(8, e.clientY - box.top - 16), box.height - 40);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, top: y, on: false, dx: 0, v: 0, t: e.timeStamp };
    },
    onPointerMove(e) {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      if (!d.on) {
        const ax = Math.abs(e.clientX - d.x), ay = Math.abs(e.clientY - d.y);
        if (ax < SLOP && ay < SLOP) return;
        if (ay >= ax) { drag.current = null; return; } // dikey: sayfa kayar
        d.on = true;
        d.x = e.clientX; // eşik kadar sıçramasın
        d.w = bodyRef.current.offsetWidth;
        bodyRef.current.getAnimations?.().forEach(a => a.cancel()); // önceki günün giriş animasyonu
      }
      const x = e.clientX - d.x;
      const dt = e.timeStamp - d.t;
      if (dt > 0) d.v = 0.6 * ((x - d.dx) / dt) + 0.4 * d.v;
      d.dx = x;
      d.t = e.timeStamp;
      const el = bodyRef.current;
      el.style.transform = `translateX(${x}px)`;
      el.style.opacity = String(fade(x, d.w));
      if (x === 0) return;
      const dir = x < 0 ? 1 : -1;
      const ready = Math.abs(x) >= d.w * COMMIT;
      setHint(h => (h && h.dir === dir && h.ready === ready ? h : { dir, ready, y: d.top }));
    },
    onPointerUp(e) { end(e, true); },
    onPointerCancel(e) { end(e, false); },
    onClickCapture(e) {
      if (e.timeStamp - swipedAt.current < 400) { e.preventDefault(); e.stopPropagation(); }
    },
  };

  return { bind, bodyRef, hint };
}

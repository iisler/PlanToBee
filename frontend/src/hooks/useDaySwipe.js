import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const SLOP = 8;     // px: yön bu kadar hareketten sonra belirlenir (tarayıcı sayfayı kaydırmaya başlamadan önce)
const COMMIT = 0.2; // kart genişliğine oran: bu kadar çekilince gün değişir
const FLICK = 0.3;  // px/ms: hızlı fiskede kısa çekme (en az 20 px) de yeter

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
// art arda kaydırarak hafta sınırı da geçilir. İçerik parmağı izler, açılan kenarda gidilecek gün yazar. Kart
// genişliğinin %20'si kadar çekilmez ya da hızlı fiskelenmezse bırakınca yerine döner. Kaydırmanın sonundaki dokunuş
// alttaki düğmeye (kayıt, boşluk) gitmez.
// Dokunma olayları karta doğrudan bağlanır (React'in touchmove'u pasiftir): yön ilk 8 px'te belirlenir; yatay ağır
// basarsa touchmove preventDefault ile sayfanın kaymasını durdurur, dikey ağır basarsa sayfa kayar. (Pointer olayları
// iPhone Safari'de, sayfa dikey kayabildiği için yatay harekette de pointercancel ile kesilebiliyor.)
// cardRef: kart. onStep(+1 | -1): gün değiştirir. dayKey: gösterilen gün; değişince yeni gün kaydırma yönünden girer.
// Dönüş: bodyRef (kayan içerik), hint: null | { dir, ready, y } (y: kartın üstünden px).
export default function useDaySwipe(cardRef, onStep, dayKey) {
  const bodyRef = useRef(null);
  const drag = useRef(null);
  const entering = useRef(0); // yeni günün geleceği yön
  const stepRef = useRef(onStep);
  const [hint, setHint] = useState(null);
  useEffect(() => { stepRef.current = onStep; });

  useLayoutEffect(() => {
    const dir = entering.current;
    entering.current = 0;
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
      if (!el?.animate || drag.current) return;
      nudged = true;
      writeNudge(String(Number(seen) + 1));
      el.animate([frame(0, 1), frame(-24, 1), frame(4, 1), frame(0, 1)], { duration: 420, easing: 'ease-in-out' });
    }, 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    const el = bodyRef.current;
    if (!card || !el) return undefined;
    let swipedAt = -Infinity;

    function finish(released) {
      const d = drag.current;
      drag.current = null;
      if (!d?.on) return;
      swipedAt = performance.now();
      setHint(null);
      const v = performance.now() - d.t > 80 ? 0 : d.v; // parmak durup bırakıldıysa fiske sayılmaz
      const go = released && (Math.abs(d.dx) >= d.w * COMMIT
        || (Math.abs(d.dx) >= 20 && Math.abs(v) >= FLICK && Math.sign(v) === Math.sign(d.dx)));
      if (go) {
        const dir = d.dx < 0 ? 1 : -1;
        entering.current = dir;
        writeNudge('done');
        stepRef.current(dir);
        return;
      }
      el.style.transform = '';
      el.style.opacity = '';
      if (!still() && el.animate) el.animate([frame(d.dx, fade(d.dx, d.w)), frame(0, 1)], { duration: 160, easing: 'ease-out' });
    }

    function onStart(e) {
      swipedAt = -Infinity;
      if (e.touches.length !== 1) { finish(false); return; } // ikinci parmak (yakınlaştırma): kaydırma bırakılır
      const p = e.touches[0];
      const box = card.getBoundingClientRect();
      const top = Math.min(Math.max(8, p.clientY - box.top - 16), box.height - 40);
      drag.current = { x: p.clientX, y: p.clientY, top, on: false, dx: 0, v: 0, t: performance.now() };
    }

    function onMove(e) {
      const d = drag.current;
      if (!d) return;
      const p = e.touches[0];
      const x = p.clientX - d.x;
      if (!d.on) {
        const ay = Math.abs(p.clientY - d.y);
        if (Math.abs(x) < SLOP && ay < SLOP) return;
        // Dikey ağır basıyor ya da tarayıcı sayfayı kaydırmaya başlamış: sayfa kayar
        if (ay >= Math.abs(x) || !e.cancelable) { drag.current = null; return; }
        d.on = true;
        d.w = el.offsetWidth;
        el.getAnimations?.().forEach(a => a.cancel()); // önceki günün giriş animasyonu ya da tanıtım
      }
      e.preventDefault();
      const now = performance.now();
      if (now > d.t) d.v = 0.6 * ((x - d.dx) / (now - d.t)) + 0.4 * d.v;
      d.dx = x;
      d.t = now;
      el.style.transform = `translateX(${x}px)`;
      el.style.opacity = String(fade(x, d.w));
      const dir = x < 0 ? 1 : -1;
      const ready = Math.abs(x) >= d.w * COMMIT;
      setHint(h => (h && h.dir === dir && h.ready === ready ? h : { dir, ready, y: d.top }));
    }

    const onEnd = (e) => finish(e.type === 'touchend');
    // Kaydırmanın ardından gelen tıklama yutulur; yeni dokunuş (touchstart) bunu sıfırlar
    function onClick(e) {
      if (performance.now() - swipedAt < 400) { e.preventDefault(); e.stopPropagation(); }
    }

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: false });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('touchcancel', onEnd);
    card.addEventListener('click', onClick, true);
    return () => {
      card.removeEventListener('touchstart', onStart);
      card.removeEventListener('touchmove', onMove);
      card.removeEventListener('touchend', onEnd);
      card.removeEventListener('touchcancel', onEnd);
      card.removeEventListener('click', onClick, true);
    };
  }, [cardRef]);

  return { bodyRef, hint };
}

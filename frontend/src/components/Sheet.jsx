import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Ortak alt sayfa (Hafta paneli ve ⋯ menüsü). React Native'de Modal (animationType="slide") karşılığıdır.
// - Açılınca odak başlığa (h2/h3, tabIndex=-1) ya da ilk düğmeye gider; Tab içeride döner.
// - Esc, katmana dokunmak ve içerideki Kapat/Vazgeç (onClose) kapatır.
// - Açıkken arka plan kaymaz ve uygulama kökü etkisizdir (inert); kapanınca odak açan düğmeye döner.
//   iPhone Safari dokunulan düğmeye odak vermediği için açan düğme returnFocusRef ile verilir.
export default function Sheet({ labelledBy, onClose, returnFocusRef, className = '', children }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prev = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (root) root.inert = true;
    const opener = returnFocusRef?.current ?? null;
    const panel = ref.current;
    (panel.querySelector('h2, h3') ?? panel.querySelector(FOCUSABLE) ?? panel).focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = prev.html;
      document.body.style.overflow = prev.body;
      if (root) root.inert = false;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // Yalnızca açılış ve kapanışta çalışır (açan düğme açılış anında alınır; ref nesnesi değişmez)
  }, [returnFocusRef]);

  // Odak tuzağı: Tab ve Shift+Tab sayfanın içinde döner
  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !ref.current.contains(active) || active === ref.current.querySelector('h2, h3'))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !ref.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="sheet-layer" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
        <div className="sheet-grab" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

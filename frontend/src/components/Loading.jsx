import { useEffect, useRef, useState } from 'react';
import useSlow, { SLOW_TEXT } from '../hooks/useSlow';
import HoneycombSpinner from './HoneycombSpinner';

// Kısa yüklemelerde (ör. gün değiştirme) katman yanıp sönmesin diye kısa bir gecikmeyle görünür.
const SHOW_AFTER_MS = 300;

// Yükleniyor göstergesi: ekranın tamamını kaplayan katman. Arka plan karartılır ve tıklanamaz,
// ortada büyük dönen petek ve "Yükleniyor, lütfen bekleyiniz" yazar. Birkaç saniyeden uzun sürerse
// sunucunun uyanıyor olabileceğini açıklar (Render ücretsiz planında ilk açılış 30-60 sn sürebilir).
export default function Loading({ text = 'Yükleniyor, lütfen bekleyiniz…' }) {
  const [visible, setVisible] = useState(false);
  const slow = useSlow(true);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  // Klavye odağı arkadaki öğelerde kalmasın: katman görünür olunca odağı alır.
  useEffect(() => {
    if (visible) ref.current?.focus();
  }, [visible]);

  if (!visible) return <div className="loading-placeholder" aria-hidden="true" />;
  return (
    <div className="loading-overlay" ref={ref} tabIndex={-1} role="status" aria-live="polite" aria-busy="true">
      <div className="loading-card">
        <HoneycombSpinner size={112} />
        <div className="loading-text">{text}</div>
        {slow && <div className="loading-slow">{SLOW_TEXT}</div>}
      </div>
    </div>
  );
}

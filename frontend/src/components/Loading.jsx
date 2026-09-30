import useSlow, { SLOW_TEXT } from '../hooks/useSlow';

// Yükleniyor göstergesi. Birkaç saniyeden uzun sürerse sunucunun uyanıyor olabileceğini açıklar.
export default function Loading({ text = 'Yükleniyor…' }) {
  const slow = useSlow(true);
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div>{text}</div>
      {slow && <div className="loading-slow">{SLOW_TEXT}</div>}
    </div>
  );
}

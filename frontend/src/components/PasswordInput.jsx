import { useState } from 'react';

// Şifre alanı + göz düğmesi: basılı tutunca şifre görünür, bırakınca yeniden gizlenir. Klavyede Boşluk/Enter
// basılıyken gösterir. Düğme odak almaz; yazmaya devam ederken klavye kapanmaz.
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  const show = (e) => { e.preventDefault(); setVisible(true); };
  const hide = () => setVisible(false);

  return (
    <div className={`pw-field ${className}`.trim()}>
      <input {...props} type={visible ? 'text' : 'password'} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="pw-eye"
        tabIndex={-1}
        aria-label="Şifreyi göster (basılı tut)"
        aria-pressed={visible}
        onPointerDown={show}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') show(e); }}
        onKeyUp={hide}
        onBlur={hide}
        onContextMenu={(e) => e.preventDefault()}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18M10.6 5.6A9.9 9.9 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3.1 3.9M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.4-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        )}
      </button>
    </div>
  );
}

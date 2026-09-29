import { useEffect, useState } from 'react';
import { initial } from '../utils/format';

// Sağ üstteki ad etiketi: dokununca Ailem ve Çıkış seçenekleri açılır.
export default function UserMenu({ name, onFamily, onLogout }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  return (
    <div className="usermenu">
      <button className="tag usermenu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="av">{initial(name)}</span>{name}<span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="usermenu-backdrop" onClick={() => setOpen(false)} />
          <ul className="usermenu-list" role="menu">
            <li><button role="menuitem" onClick={() => choose(onFamily)}>Ailem</button></li>
            <li><button role="menuitem" className="danger" onClick={() => choose(onLogout)}>Çıkış yap</button></li>
          </ul>
        </>
      )}
    </div>
  );
}

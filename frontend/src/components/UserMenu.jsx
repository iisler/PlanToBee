import { useEffect, useRef, useState } from 'react';
import { initial } from '../utils/format';

// Sağ üstteki profil adı: dokununca Profil değiştir (ailede birden fazla profil varsa), Ailem, Bildirimler ve Çıkış seçenekleri açılır.
export default function UserMenu({ name, onSwitchProfile, onFamily, onNotifications, onLogout }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Klavyeyle açılınca odak ilk seçeneğe gider; Esc menüyü kapatıp odağı ad düğmesine geri verir
    listRef.current?.querySelector('button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(listRef.current?.querySelectorAll('button') ?? [])];
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  return (
    // Odak menünün dışındaki bir öğeye geçince (ör. Tab ile) menü kapanır. relatedTarget boşsa kapanmaz: iPhone
    // Safari dokunulan düğmeye odak vermez, menü dokunuş işlenmeden kapanırdı. Dışarı dokunuşu arka katman kapatır.
    <div className="usermenu" onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button ref={btnRef} className="tag usermenu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${name}: profil menüsü (Profil değiştir, Ailem, Bildirimler, Çıkış yap)`} onClick={() => setOpen(o => !o)}>
        <span className="av" aria-hidden="true">{initial(name)}</span><span className="uname">{name}</span><span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="usermenu-backdrop" onClick={() => setOpen(false)} />
          <ul className="usermenu-list" role="menu" ref={listRef}>
            {onSwitchProfile && <li role="none"><button role="menuitem" onClick={() => choose(onSwitchProfile)}>Profil değiştir</button></li>}
            <li role="none"><button role="menuitem" onClick={() => choose(onFamily)}>Ailem</button></li>
            {onNotifications && <li role="none"><button role="menuitem" onClick={() => choose(onNotifications)}>Bildirimler</button></li>}
            <li role="none"><button role="menuitem" className="danger" onClick={() => choose(onLogout)}>Çıkış yap</button></li>
          </ul>
        </>
      )}
    </div>
  );
}

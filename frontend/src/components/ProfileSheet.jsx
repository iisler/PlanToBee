import { useId } from 'react';
import Sheet from './Sheet';
import { initial, ROLE_LABEL } from '../utils/format';

// Profil paneli (Görev 14; Görev 17'den beri sağ üstteki baş harf düğmesinden açılır).
// Profil değiştir (ailede birden fazla profil varsa), Bildirimler (ailede başka profil varsa) ve Çıkış yap.
// Aile alt menüde ayrı düğmedir.
export default function ProfileSheet({ name, role, familyName, onSwitchProfile, onNotifications, onLogout, onClose, returnFocusRef }) {
  const titleId = useId();
  const pick = (fn) => () => { onClose(); fn(); };
  const sub = [ROLE_LABEL[role], familyName && `${familyName} ailesi`].filter(Boolean).join(' · ');
  return (
    <Sheet className="menusheet profsheet" labelledBy={titleId} onClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="profhead">
        <span className={`av big role-${role}`} aria-hidden="true">{initial(name)}</span>
        <span className="profhead-tx">
          <h3 id={titleId} tabIndex={-1}>{name}</h3>
          {sub && <small>{sub}</small>}
        </span>
      </div>
      {onSwitchProfile && <button type="button" className="menu-item" onClick={pick(onSwitchProfile)}>Profil değiştir</button>}
      {onNotifications && <button type="button" className="menu-item" onClick={pick(onNotifications)}>Bildirimler</button>}
      <button type="button" className="menu-item danger" onClick={pick(onLogout)}>Çıkış yap</button>
      <button type="button" className="menu-item soft" onClick={onClose}>Vazgeç</button>
    </Sheet>
  );
}

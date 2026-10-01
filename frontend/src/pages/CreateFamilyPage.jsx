import { useState } from 'react';
import client, { REFRESH_KEY } from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import PinInput from '../components/PinInput';

// E-posta doğrulandıktan sonra ailesi olmayan hesap: aileyi ve hesap sahibinin (ebeveyn) profilini kurar.
// Diğer aile üyeleri sonra "Ailem" ekranından profil olarak eklenir; e-posta gerekmez.
// "Daha sonra": tek başına kullanım. Arka planda tek profilli aile kurulur, PIN sorulmaz; ilk profil
// eklenirken PIN istenir.
export default function CreateFamilyPage() {
  const { user, logout, refreshMe, applyAuth } = useAuth();
  const [name, setName] = useState(user.displayName ? `${user.displayName} Ailesi` : '');
  const [profileName, setProfileName] = useState(user.displayName || '');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function create(body) {
    setLoading(true);
    try {
      const res = await client.post('/family', { ...body, refreshToken: localStorage.getItem(REFRESH_KEY) });
      applyAuth(res.data); // oturum hesap sahibinin profiliyle açılır
    } catch (err) {
      if (errorCode(err) === 'already_in_family') { refreshMe().catch(() => {}); return; }
      setError(errorText(err));
      setLoading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) return setError('PIN 4 rakamdan oluşmalı.');
    if (pin !== pin2) return setError('PIN\'ler aynı değil.');
    create({ name: name.trim(), profileName: profileName.trim(), pin });
  }

  // Aile adı ve profil adı hesabın adından türetilir; ikisi de sonra Ailem ekranından değiştirilebilir.
  function later() {
    setError('');
    const own = (profileName.trim() || user.displayName || 'Ben').slice(0, 50);
    create({ name: (name.trim() || `${own} Ailesi`).slice(0, 100), profileName: own, pin: null });
  }

  return (
    <AuthLayout
      subtitle="Aileni oluştur"
      footer={(
        <div className="auth-links">
          <button className="auth-link" onClick={logout}>Çıkış yap</button>
        </div>
      )}
    >
      <form onSubmit={submit}>
        <p className="auth-text">
          Ailen bu hesapla giriş yapacak. Aile üyelerini sonra "Ailem" ekranından profil olarak eklersin;
          her cihazda girişten sonra kişi kendi profilini seçer.
        </p>
        <input aria-label="Aile adı" placeholder="Aile adı (ör. İşler Ailesi)" maxLength={100} value={name} onChange={e => setName(e.target.value)} required />
        <input aria-label="Profil adın" placeholder="Senin adın (ör. Ilker)" maxLength={50} value={profileName} onChange={e => setProfileName(e.target.value)} required />
        <p className="auth-text">
          Profilin için 4 haneli bir PIN belirle. Ebeveyn profilleri PIN ile korunur; aile şifresini bilen çocuklar
          ebeveyn olarak işlem yapamaz.
        </p>
        <label className="pin-label">PIN
          <PinInput value={pin} onChange={setPin} label="PIN" disabled={loading} />
        </label>
        <label className="pin-label">PIN (tekrar)
          <PinInput value={pin2} onChange={setPin2} label="PIN tekrar" disabled={loading} />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Oluşturuluyor…' : 'Aileyi oluştur'}</button>
      </form>
      <div className="later-box">
        <button type="button" className="btn-ghost later-btn" onClick={later} disabled={loading}>Daha sonra, şimdilik tek başıma kullanacağım</button>
        <div className="auth-hint">PIN gerekmez. Aileni istediğin zaman ad menüsündeki "Ailem" ekranından profil ekleyerek kurabilirsin.</div>
      </div>
    </AuthLayout>
  );
}

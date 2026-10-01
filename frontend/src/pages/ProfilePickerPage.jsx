import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Loading from '../components/Loading';
import PinInput from '../components/PinInput';
import { initial, ROLE_LABEL } from '../utils/format';

// "Kim kullanıyor?": aile hesabıyla giriş yapıldıktan sonra bu cihazda kullanılacak profil seçilir.
// - PIN'li profil: 4 haneli PIN sorulur.
// - PIN'i olmayan ebeveyn profili (eski kayıtlar): hesap şifresi + yeni PIN istenir.
// - PIN'siz çocuk profili: doğrudan açılır.
export default function ProfilePickerPage() {
  const { user, logout, selectProfile, switching, cancelSwitch } = useAuth();
  const [profiles, setProfiles] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [chosen, setChosen] = useState(null); // { profile, mode: 'pin' | 'setup' }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await client.get('/profiles');
      setProfiles(r.data);
      setLoadError('');
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(profile, body) {
    setBusy(true);
    setError('');
    try {
      await selectProfile(profile.id, body);
      return true;
    } catch (err) {
      const code = errorCode(err);
      if (code === 'pin_setup_required') setChosen({ profile, mode: 'setup' });
      else setError(errorText(err));
      if (code === 'pin_locked') load();
      setBusy(false);
      return false;
    }
  }

  function choose(profile) {
    setError('');
    if (profile.hasPin) setChosen({ profile, mode: 'pin' });
    else if (profile.role === 'Parent') setChosen({ profile, mode: 'setup' });
    else submit(profile, {});
  }

  const canCancel = switching && user.profile;

  return (
    <AuthLayout
      subtitle={user.family?.name}
      footer={(
        <div className="auth-links">
          {canCancel && <button className="auth-link" onClick={cancelSwitch}>Vazgeç</button>}
          <button className="auth-link" onClick={logout}>Aile hesabından çık</button>
        </div>
      )}
    >
      {loadError ? (
        <>
          <div className="auth-error" role="alert">{loadError}</div>
          <button className="auth-submit" onClick={load}>Tekrar dene</button>
        </>
      ) : !profiles ? <Loading /> : chosen ? (
        <ChosenProfile key={`${chosen.profile.id}-${chosen.mode}`} chosen={chosen} busy={busy} error={error}
          onSubmit={(body) => submit(chosen.profile, body)}
          onBack={() => { setChosen(null); setError(''); }} />
      ) : (
        <>
          <h2 className="picker-title">Kim kullanıyor?</h2>
          <ul className="profile-grid">
            {profiles.map(p => (
              <li key={p.id}>
                <button className={`profile-tile${p.isCurrent ? ' current' : ''}`} onClick={() => choose(p)} disabled={busy}
                  aria-label={`${p.displayName}, ${ROLE_LABEL[p.role]}${p.hasPin ? ', PIN ile korunuyor' : ''}`}>
                  <span className={`av huge role-${p.role}`} aria-hidden="true">{initial(p.displayName)}</span>
                  <span className="profile-name">{p.displayName}</span>
                  <span className="profile-role">
                    {ROLE_LABEL[p.role]}{p.hasPin && <span className="lock" aria-hidden="true"> · 🔒</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <div className="auth-hint">Bu cihazda seçtiğin profil hatırlanır. Değiştirmek için adına dokunup "Profil değiştir"i seç.</div>
        </>
      )}
    </AuthLayout>
  );
}

function ChosenProfile({ chosen, busy, error, onSubmit, onBack }) {
  const { profile, mode } = chosen;
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [localError, setLocalError] = useState('');
  const pinRef = useRef(null);

  // Hatalı PIN'den sonra alan temizlenir ve yeniden odaklanır.
  async function sendPin(value) {
    if (await onSubmit({ pin: value })) return;
    setPin('');
    setTimeout(() => pinRef.current?.focus(), 0);
  }

  function submitSetup(e) {
    e.preventDefault();
    setLocalError('');
    if (!/^\d{4}$/.test(pin)) return setLocalError('PIN 4 rakamdan oluşmalı.');
    if (pin !== pin2) return setLocalError('PIN\'ler aynı değil.');
    onSubmit({ password, newPin: pin });
  }

  return (
    <div className="chosen-profile">
      <span className={`av huge role-${profile.role}`} aria-hidden="true">{initial(profile.displayName)}</span>
      <h2 className="picker-title">{profile.displayName}</h2>
      {mode === 'pin' ? (
        <form onSubmit={e => { e.preventDefault(); if (pin.length === 4) sendPin(pin); }}>
          <p className="auth-text">PIN'ini gir</p>
          <PinInput ref={pinRef} value={pin} onChange={setPin} autoFocus disabled={busy}
            onComplete={sendPin} label={`${profile.displayName} PIN`} />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy || pin.length !== 4}>{busy ? 'Bekle…' : 'Devam'}</button>
        </form>
      ) : (
        <form onSubmit={submitSetup}>
          <p className="auth-text">
            Ebeveyn profilleri PIN ile korunur; böylece aile şifresini bilen çocuklar ebeveyn olarak işlem yapamaz.
            Bu profil için bir PIN belirle. Onaylamak için aile hesabının şifresini de gir.
          </p>
          <input type="password" aria-label="Aile hesabının şifresi" placeholder="Aile hesabının şifresi" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
          <label className="pin-label">Yeni PIN
            <PinInput value={pin} onChange={setPin} disabled={busy} label="Yeni PIN" />
          </label>
          <label className="pin-label">Yeni PIN (tekrar)
            <PinInput value={pin2} onChange={setPin2} disabled={busy} label="Yeni PIN tekrar" />
          </label>
          {(localError || error) && <div className="auth-error" role="alert">{localError || error}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Bekle…' : 'PIN\'i kaydet ve devam et'}</button>
        </form>
      )}
      <button className="auth-link" onClick={onBack} disabled={busy}>‹ Başka profil seç</button>
    </div>
  );
}

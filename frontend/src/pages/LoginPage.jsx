import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCOUNT_DELETED_KEY, useAuth } from '../context/AuthContext';
import client from '../api/client';
import { errorText } from '../api/errors';
import AuthLayout from '../components/AuthLayout';
import useSlow from '../hooks/useSlow';
import Loading from '../components/Loading';
import BusyLabel from '../components/BusyLabel';
import PasswordInput from '../components/PasswordInput';

// Giriş ve kayıt. Girişten sonra yönlendirmeyi App (hesap durumu) yapar:
// doğrulanmamış e-posta → doğrulama ekranı, ailesiz → aile kurma, ikisi de tamamsa uygulama.
// Kayıt oturum açmaz; "e-postana bağlantı gönderdik" ekranı gösterilir (hesap varlığı belli olmasın diye).
export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Kayıttan sonra: { email, message }. Hesap zaten var olsa da aynı ekran gösterilir.
  const [registered, setRegistered] = useState(null);
  const [resendInfo, setResendInfo] = useState('');
  // Hesap silindikten sonra gelindiyse kalıcı bilgi; sekme değiştirince ya da yazmaya başlayınca kapanır.
  const [deletedInfo, setDeletedInfo] = useState(() => {
    try {
      const v = sessionStorage.getItem(ACCOUNT_DELETED_KEY);
      sessionStorage.removeItem(ACCOUNT_DELETED_KEY);
      return v === '1';
    } catch {
      return false;
    }
  });
  // Sunucu uyanıyorsa giriş uzun sürer: 2 sn sonra ekranı kaplayan bekleme katmanı gösterilir.
  const slow = useSlow(loading, 2000);

  const set = (k) => (e) => { setDeletedInfo(false); setForm((f) => ({ ...f, [k]: e.target.value })); };

  function switchMode(m) {
    setMode(m);
    setDeletedInfo(false);
    setError('');
    setRegistered(null);
    setResendInfo('');
    setForm((f) => ({ ...f, password: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
      } else {
        const data = await register(form.email.trim(), form.password, form.displayName.trim());
        setRegistered({ email: data.email || form.email.trim(), message: data.message });
        setLoading(false);
      }
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setResendInfo('');
    try {
      const r = await client.post('/auth/resend-verification', { email: registered.email });
      setResendInfo(r.data?.message || 'Doğrulama e-postası gönderildi.');
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (registered) {
    return (
      <AuthLayout subtitle="E-postanı kontrol et">
        <p className="auth-text"><b>{registered.email}</b></p>
        <div className="auth-info" role="status">{registered.message}</div>
        {resendInfo && <div className="auth-info" role="status">{resendInfo}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="auth-actions">
          <button className="auth-submit" onClick={() => switchMode('login')}>Giriş yap</button>
          <button className="btn-ghost" onClick={resend}>E-postayı tekrar gönder</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      subtitle="Haftalık plan ve takip platformu"
      footer={mode === 'login' && (
        <div className="auth-links">
          <Link className="auth-link" to="/forgot-password">Şifremi unuttum</Link>
        </div>
      )}
    >
      {deletedInfo && <div className="auth-info deleted-info" role="status">Hesabın ve tüm verilerin silindi.</div>}
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>Giriş</button>
        <button className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => switchMode('register')}>Kayıt ol</button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <input id="displayName" aria-label="Adın" placeholder="Adın (ör. Ilker)" autoComplete="name" maxLength={50} value={form.displayName} onChange={set('displayName')} required />
        )}
        <input id="email" type="email" aria-label="E-posta" placeholder="E-posta" autoComplete="email" value={form.email} onChange={set('email')} required />
        <PasswordInput
          id="password"
          aria-label="Şifre"
          placeholder={mode === 'login' ? 'Şifre' : 'Şifre (en az 6 karakter)'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'login' ? undefined : 6}
          value={form.password}
          onChange={set('password')}
          required
        />
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="auth-submit" disabled={loading}>
          <BusyLabel busy={loading} text={mode === 'login' ? 'Giriş yap' : 'Kayıt ol'} busyText={mode === 'login' ? 'Giriş yapılıyor…' : 'Kaydediliyor…'} />
        </button>
        {slow && <Loading />}
        {mode === 'register' && <div className="auth-hint">Kayıttan sonra e-posta adresine bir doğrulama bağlantısı gönderilir.</div>}
      </form>
    </AuthLayout>
  );
}

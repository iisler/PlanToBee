import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorText } from '../api/errors';
import AuthLayout from '../components/AuthLayout';
import useSlow, { SLOW_TEXT } from '../hooks/useSlow';

// Giriş ve kayıt. Başarılı olunca yönlendirmeyi App (hesap durumu) yapar:
// doğrulanmamış e-posta → doğrulama ekranı, ailesiz → aile kurma, ikisi de tamamsa uygulama.
export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const slow = useSlow(loading);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function switchMode(m) {
    setMode(m);
    setError('');
    setForm((f) => ({ ...f, password: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(form.email.trim(), form.password);
      else await register(form.email.trim(), form.password, form.displayName.trim());
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      subtitle="Ders & Antrenman Takip"
      footer={mode === 'login' && (
        <div className="auth-links">
          <Link className="auth-link" to="/forgot-password">Şifremi unuttum</Link>
          <Link className="auth-link" to="/invite-code">Davet kodum var</Link>
        </div>
      )}
    >
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>Giriş</button>
        <button className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => switchMode('register')}>Kayıt Ol</button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <input id="displayName" aria-label="Adın" placeholder="Adın (ör. Ilker)" autoComplete="name" maxLength={50} value={form.displayName} onChange={set('displayName')} required />
        )}
        <input id="email" type="email" aria-label="E-posta" placeholder="E-posta" autoComplete="email" value={form.email} onChange={set('email')} required />
        <input
          id="password"
          type="password"
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
          {loading ? 'Yükleniyor…' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
        </button>
        {slow && <div className="auth-hint" role="status">{SLOW_TEXT}</div>}
        {mode === 'register' && <div className="auth-hint">Kayıttan sonra e-posta adresine bir doğrulama bağlantısı gönderilir.</div>}
      </form>
    </AuthLayout>
  );
}

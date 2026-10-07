import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import AuthLayout from '../components/AuthLayout';
import BusyLabel from '../components/BusyLabel';
import PasswordInput from '../components/PasswordInput';

// E-postadaki bağlantıdan açılır: /reset-password?userId=…&token=…
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const token = params.get('token');
  const { user, logout } = useAuth();
  const { notify } = useNotice();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ a: '', b: '' });
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(!userId || !token);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (pw.a !== pw.b) return setError('Şifreler eşleşmiyor.');
    setLoading(true);
    try {
      await client.post('/auth/reset-password', { userId, token, newPassword: pw.a });
      // Otomatik giriş yapılmaz: şifre değişince bütün oturumlar kapanır, kullanıcı yeni şifresiyle giriş yapar.
      if (user) logout();
      notify('Şifren değiştirildi. Yeni şifrenle giriş yapabilirsin.', 'info', { duration: 6000 });
      navigate('/login', { replace: true });
    } catch (err) {
      if (errorCode(err) === 'reset_invalid') setInvalid(true);
      setError(errorText(err));
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Yeni şifre belirle" footer={<Link className="auth-link" to="/login">‹ Girişe dön</Link>}>
      {invalid ? (
        <>
          <div className="auth-error" role="alert">{error || 'Şifre sıfırlama bağlantısı geçersiz, kullanılmış ya da süresi dolmuş. Yeni bir bağlantı iste.'}</div>
          <Link className="auth-submit as-link" to="/forgot-password">Yeni bağlantı iste</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <PasswordInput aria-label="Yeni şifre" placeholder="Yeni şifre (en az 6 karakter)" autoComplete="new-password" minLength={6} value={pw.a} onChange={e => setPw(p => ({ ...p, a: e.target.value }))} required />
          <PasswordInput aria-label="Yeni şifre (tekrar)" placeholder="Yeni şifre (tekrar)" autoComplete="new-password" value={pw.b} onChange={e => setPw(p => ({ ...p, b: e.target.value }))} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}><BusyLabel busy={loading} text="Şifreyi kaydet" busyText="Kaydediliyor…" /></button>
        </form>
      )}
    </AuthLayout>
  );
}

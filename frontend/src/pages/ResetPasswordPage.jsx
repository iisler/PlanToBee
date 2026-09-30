import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

// E-postadaki bağlantıdan açılır: /reset-password?userId=…&token=…
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const token = params.get('token');
  const { applyAuth } = useAuth();
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
      const r = await client.post('/auth/reset-password', { userId, token, newPassword: pw.a });
      applyAuth(r.data); // otomatik giriş
      navigate('/', { replace: true });
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
          <input type="password" aria-label="Yeni şifre" placeholder="Yeni şifre (en az 6 karakter)" autoComplete="new-password" minLength={6} value={pw.a} onChange={e => setPw(p => ({ ...p, a: e.target.value }))} required />
          <input type="password" aria-label="Yeni şifre (tekrar)" placeholder="Yeni şifre (tekrar)" autoComplete="new-password" value={pw.b} onChange={e => setPw(p => ({ ...p, b: e.target.value }))} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Kaydediliyor…' : 'Şifreyi kaydet'}</button>
        </form>
      )}
    </AuthLayout>
  );
}

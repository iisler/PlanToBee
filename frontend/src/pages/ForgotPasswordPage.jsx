import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { errorText } from '../api/errors';
import AuthLayout from '../components/AuthLayout';
import BusyLabel from '../components/BusyLabel';

// Şifre sıfırlama isteği. Hesabın varlığı belli edilmez; sunucu her durumda aynı mesajı döner.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await client.post('/auth/forgot-password', { email: email.trim() });
      setInfo(r.data?.message || 'Kayıtlı bir hesap varsa şifre sıfırlama e-postası gönderildi.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Şifreni sıfırla" footer={<Link className="auth-link" to="/login">‹ Girişe dön</Link>}>
      {info ? (
        <div className="auth-info" role="status">{info} Bağlantı 1 saat geçerlidir.</div>
      ) : (
        <form onSubmit={submit}>
          <p className="auth-text">E-posta adresini gir; sana yeni şifre belirleyebileceğin bir bağlantı gönderelim.</p>
          <input type="email" aria-label="E-posta" placeholder="E-posta" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}><BusyLabel busy={loading} text="Bağlantı gönder" busyText="Gönderiliyor…" /></button>
        </form>
      )}
    </AuthLayout>
  );
}

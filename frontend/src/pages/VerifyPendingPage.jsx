import { useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

// Giriş yapılmış ama e-posta doğrulanmamış: uygulama kullanılamaz.
export default function VerifyPendingPage() {
  const { user, logout, refreshMe } = useAuth();
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function resend() {
    setError(''); setInfo('');
    setLoading(true);
    try {
      const r = await client.post('/auth/resend-verification', {});
      setInfo(r.data?.message || 'Doğrulama e-postası gönderildi.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function check() {
    setError(''); setInfo('');
    setLoading(true);
    try {
      const me = await refreshMe();
      if (!me.emailVerified) setError('E-posta adresin henüz doğrulanmamış. E-postadaki bağlantıya tıkla.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="E-postanı doğrula" footer={<button className="auth-link" onClick={logout}>Çıkış yap</button>}>
      <p className="auth-text">
        <b>{user.email}</b> adresine bir doğrulama bağlantısı gönderdik. Uygulamayı kullanmak için bağlantıya tıklayarak e-postanı doğrula.
      </p>
      {info && <div className="auth-info" role="status">{info}</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="auth-actions">
        <button className="auth-submit" onClick={check} disabled={loading}>Doğruladım, devam et</button>
        <button className="btn-ghost" onClick={resend} disabled={loading}>Doğrulama e-postasını tekrar gönder</button>
      </div>
    </AuthLayout>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Loading from '../components/Loading';

// E-postadaki doğrulama bağlantısından açılır: /verify-email?userId=…&token=…
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const userId = params.get('userId');
  const token = params.get('token');
  const [state, setState] = useState(() => (userId && token
    ? { status: 'loading', message: '' }
    : { status: 'error', message: 'Doğrulama bağlantısı eksik ya da bozuk.' }));
  const started = useRef(false); // StrictMode'da istek iki kez gitmesin

  useEffect(() => {
    if (started.current || !userId || !token) return;
    started.current = true;
    client.post('/auth/verify-email', { userId, token })
      .then(r => {
        setState({ status: 'ok', message: r.data?.message || 'E-posta adresin doğrulandı.' });
        if (localStorage.getItem('token')) refreshMe().catch(() => {});
      })
      .catch(err => setState({ status: 'error', message: errorText(err) }));
  }, [userId, token, refreshMe]);

  return (
    <AuthLayout subtitle="E-posta doğrulama">
      {state.status === 'loading' && <Loading />}
      {state.status === 'ok' && (
        <>
          <div className="auth-info" role="status">{state.message}</div>
          <Link className="auth-submit as-link" to={user ? '/' : '/login'} replace>{user ? 'Devam et' : 'Giriş yap'}</Link>
        </>
      )}
      {state.status === 'error' && (
        <>
          <div className="auth-error" role="alert">{state.message}</div>
          <Link className="auth-link" to={user ? '/' : '/login'} replace>{user ? 'Yeni doğrulama e-postası iste' : 'Girişe dön'}</Link>
        </>
      )}
    </AuthLayout>
  );
}

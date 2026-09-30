import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { ROLE_LABEL } from '../utils/format';
import Loading from '../components/Loading';

// Hatası davetin kendisiyle ilgili olan kodlar: bu durumda davet önizlemesi yerine hata ekranı gösterilir.
const INVITE_FATAL = ['invite_invalid', 'invite_used', 'invite_expired', 'invite_cancelled', 'invite_code_locked'];

// Davet kabulü.
// - Link: /invite?token=…  (belirteç URL'den okunur)
// - Yedek kod: /invite-code  (e-posta + 6 haneli kod)
// Hesap yoksa şifre belirlenir (accept-new); hesap varsa giriş yapılıp katılınır (accept-existing).
export default function InvitePage({ codeMode = false }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, login, logout, applyAuth } = useAuth();
  const linkToken = codeMode ? null : params.get('token');

  const [creds, setCreds] = useState(linkToken ? { token: linkToken } : null);
  const [codeForm, setCodeForm] = useState({ email: '', code: '' });
  const [preview, setPreview] = useState(null);
  const [fatal, setFatal] = useState(!codeMode && !linkToken ? 'Davet bağlantısı eksik ya da bozuk. E-postadaki bağlantıyı yeniden aç ya da yedek kodu kullan.' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState({ a: '', b: '' });
  const started = useRef(false);

  async function resolve(c) {
    setError('');
    setLoading(true);
    try {
      const r = await client.post('/invitations/resolve', c);
      setCreds(c);
      setPreview(r.data);
    } catch (err) {
      const code = errorCode(err);
      if (INVITE_FATAL.includes(code)) setFatal(errorText(err));
      else setError(errorText(err)); // ör. e-posta ve kod eşleşmedi: tekrar denenebilir
    } finally {
      setLoading(false);
    }
  }

  // Link ile açıldıysa daveti hemen çöz (StrictMode'da bir kez)
  useEffect(() => {
    if (!linkToken || started.current) return;
    started.current = true;
    client.post('/invitations/resolve', { token: linkToken })
      .then(r => setPreview(r.data))
      .catch(err => setFatal(errorText(err)));
  }, [linkToken]);

  function handleAcceptError(err) {
    const code = errorCode(err);
    if (code === 'account_exists') {
      setPreview(p => ({ ...p, accountExists: true }));
      setError('Bu e-posta adresiyle zaten bir hesap var. Şifrenle giriş yapıp daveti kabul et.');
    } else if (INVITE_FATAL.includes(code)) {
      setFatal(errorText(err));
    } else {
      setError(errorText(err));
    }
  }

  async function acceptNew(e) {
    e.preventDefault();
    setError('');
    if (pw.a !== pw.b) return setError('Şifreler eşleşmiyor.');
    setLoading(true);
    try {
      const r = await client.post('/invitations/accept-new', { ...creds, password: pw.a });
      applyAuth(r.data);
      navigate('/', { replace: true });
    } catch (err) {
      handleAcceptError(err);
      setLoading(false);
    }
  }

  async function acceptExisting(e) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!user) await login(preview.email, pw.a);
      const r = await client.post('/invitations/accept-existing', creds);
      applyAuth(r.data);
      navigate('/', { replace: true });
    } catch (err) {
      handleAcceptError(err);
      setLoading(false);
    }
  }

  const back = <Link className="auth-link" to={user ? '/' : '/login'}>‹ {user ? 'Uygulamaya dön' : 'Girişe dön'}</Link>;

  if (fatal) {
    return (
      <AuthLayout subtitle="Aile daveti" footer={back}>
        <div className="auth-error" role="alert">{fatal}</div>
        <p className="auth-text">Sorun devam ederse ailenin yöneticisinden yeni bir davet göndermesini iste.</p>
        {!codeMode && <Link className="auth-link" to="/invite-code">Yedek kodla dene</Link>}
      </AuthLayout>
    );
  }

  // 1) Yedek kod: e-posta + 6 haneli kod
  if (!preview) {
    if (!codeMode) return <AuthLayout subtitle="Aile daveti"><Loading text="Davet kontrol ediliyor…" /></AuthLayout>;
    return (
      <AuthLayout subtitle="Davet kodunu gir" footer={back}>
        <form onSubmit={e => { e.preventDefault(); resolve({ email: codeForm.email.trim(), code: codeForm.code.trim() }); }}>
          <p className="auth-text">Davet e-postasındaki 6 haneli yedek kodu ve davetin gönderildiği e-posta adresini gir.</p>
          <input type="email" aria-label="E-posta" placeholder="E-posta" autoComplete="email" value={codeForm.email}
            onChange={e => setCodeForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="code-input" aria-label="6 haneli davet kodu" placeholder="6 haneli kod" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
            value={codeForm.code} onChange={e => setCodeForm(f => ({ ...f, code: e.target.value.replace(/\D/g, '') }))} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Kontrol ediliyor…' : 'Devam et'}</button>
        </form>
      </AuthLayout>
    );
  }

  // 2) Önizleme + katılma
  const sameAccount = user && user.email?.toLowerCase() === preview.email.toLowerCase();
  return (
    <AuthLayout subtitle="Aile daveti" footer={back}>
      <div className="invite-preview">
        <b>{preview.familyName}</b> seni <b>{preview.displayName}</b> olarak davet etti
        <div className="muted">Rol: {ROLE_LABEL[preview.role] || preview.role}{preview.invitedBy && ` · Gönderen: ${preview.invitedBy}`}</div>
      </div>

      {!preview.accountExists ? (
        <form onSubmit={acceptNew}>
          <input type="email" value={preview.email} readOnly aria-label="E-posta" className="readonly" />
          <input type="password" aria-label="Şifre" placeholder="Şifre belirle (en az 6 karakter)" autoComplete="new-password" minLength={6}
            value={pw.a} onChange={e => setPw(p => ({ ...p, a: e.target.value }))} required />
          <input type="password" aria-label="Şifre (tekrar)" placeholder="Şifre (tekrar)" autoComplete="new-password"
            value={pw.b} onChange={e => setPw(p => ({ ...p, b: e.target.value }))} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Katılınıyor…' : 'Şifremi belirle ve katıl'}</button>
        </form>
      ) : user && !sameAccount ? (
        <>
          <div className="auth-error" role="alert">
            Şu an <b>{user.email}</b> hesabıyla girişlisin. Bu davet <b>{preview.email}</b> adresine gönderilmiş.
          </div>
          <button className="auth-submit" onClick={logout}>Çıkış yap ve {preview.email} ile giriş yap</button>
        </>
      ) : user ? (
        <>
          <p className="auth-text">Mevcut hesabınla katılacaksın. Tek kişilik bir ailen varsa planın bu aileye taşınır.</p>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" onClick={acceptExisting} disabled={loading}>{loading ? 'Katılınıyor…' : 'Daveti kabul et'}</button>
        </>
      ) : (
        <form onSubmit={acceptExisting}>
          <p className="auth-text">Bu e-posta adresinin zaten bir PlanToBee hesabı var. Giriş yap ve aileye katıl. Tek kişilik bir ailen varsa planın bu aileye taşınır.</p>
          <input type="email" value={preview.email} readOnly aria-label="E-posta" className="readonly" />
          <input type="password" aria-label="Şifre" placeholder="Şifre" autoComplete="current-password"
            value={pw.a} onChange={e => setPw(p => ({ ...p, a: e.target.value }))} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Katılınıyor…' : 'Giriş yap ve katıl'}</button>
          <Link className="auth-link" to="/forgot-password">Şifremi unuttum</Link>
        </form>
      )}
    </AuthLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import AuthLayout from '../components/AuthLayout';
import BusyLabel from '../components/BusyLabel';
import PasswordInput from '../components/PasswordInput';
import PasswordRules from '../components/PasswordRules';
import { PASSWORD_INVALID_TEXT, PASSWORD_MIN_LENGTH, passwordValid } from '../utils/passwordPolicy';

const RESEND_SECONDS = 60;
const LOCK_INFO = 'Hesap bu adrese kayıtlıysa, kilitlendiği anda e-postana bir kilit açma kodu gönderdik. Süresi dolduysa yenisini iste.';

// Şifre sıfırlama ve kilitli hesabı açma. 1. adım: e-posta → sunucu e-postaya 6 haneli kod (ve bağlantı) gönderir.
// 2. adım: kod + yeni şifre → şifre değişir, kalıcı giriş kilidi açılır. Hesabın varlığı belli edilmez; sunucu
// her durumda aynı mesajı döner. Girişte hesap kilitlenince bu ekrana { email, locked: true } ile gelinir; sunucu kilit
// açma kodunu kilitlendiği anda kendiliğinden e-postayla gönderdiği için ekran doğrudan kod adımıyla açılır.
export default function ForgotPasswordPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notify } = useNotice();
  const locked = state?.locked === true;
  const initialEmail = typeof state?.email === 'string' ? state.email : '';
  const startAtCode = locked && initialEmail.trim() !== '';
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState(startAtCode ? 'code' : 'email');
  const [info, setInfo] = useState(startAtCode ? LOCK_INFO : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState({ a: '', b: '' });
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await client.post('/auth/forgot-password', { email: email.trim() });
      setInfo(r.data?.message || 'Kayıtlı bir hesap varsa e-postana şifre sıfırlama kodu gönderildi.');
      setStep('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    setError('');
    if (!passwordValid(pw.a)) return setError(PASSWORD_INVALID_TEXT);
    if (pw.a !== pw.b) return setError('Şifreler eşleşmiyor.');
    setLoading(true);
    try {
      const r = await client.post('/auth/reset-password/code', { email: email.trim(), code, newPassword: pw.a });
      // Otomatik giriş yapılmaz: şifre değişince bütün oturumlar kapanır, kullanıcı yeni şifresiyle giriş yapar.
      if (user) logout();
      notify(r.data?.message || 'Şifren değiştirildi. Yeni şifrenle giriş yapabilirsin.', 'info', { duration: 6000 });
      navigate('/login', { replace: true });
    } catch (err) {
      if (errorCode(err) === 'reset_code_invalid') setCode('');
      setError(errorText(err));
      setLoading(false);
    }
  }

  function changeEmail() {
    setStep('email');
    setInfo('');
    setError('');
    setCode('');
  }

  return (
    <AuthLayout subtitle={locked ? 'Hesabının kilidini aç' : 'Şifreni sıfırla'} footer={<Link className="auth-link" to="/login">‹ Girişe dön</Link>}>
      {locked && (
        <div className="auth-warn" role="alert">
          Çok fazla hatalı şifre denemesi yapıldığı için hesabın kilitlendi. Kilidi açmak için e-postana gelen kodla yeni bir şifre belirle.
        </div>
      )}
      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <p className="auth-text">E-posta adresini gir; sana yeni şifre belirleyebileceğin 6 haneli bir kod gönderelim.</p>
          <input type="email" aria-label="E-posta" placeholder="E-posta" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}><BusyLabel busy={loading} text="Kod gönder" busyText="Gönderiliyor…" /></button>
        </form>
      ) : (
        <>
          <div className="auth-info" role="status">{info} Kod 15 dakika geçerlidir.</div>
          <p className="auth-text"><b>{email.trim()}</b></p>
          <form onSubmit={submitCode}>
            <input
              id="resetCode"
              className="pin-input"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              aria-label="E-postadaki kod"
              placeholder="••••••"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            <PasswordInput aria-label="Yeni şifre" aria-describedby="reset-pw-rules" placeholder={`Yeni şifre (en az ${PASSWORD_MIN_LENGTH} karakter)`} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={pw.a} onChange={e => setPw(p => ({ ...p, a: e.target.value }))} required />
            <PasswordRules id="reset-pw-rules" password={pw.a} />
            <PasswordInput aria-label="Yeni şifre (tekrar)" placeholder="Yeni şifre (tekrar)" autoComplete="new-password" value={pw.b} onChange={e => setPw(p => ({ ...p, b: e.target.value }))} required />
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading || code.length !== 6}>
              <BusyLabel busy={loading} text={locked ? 'Şifreyi kaydet ve kilidi aç' : 'Şifreyi kaydet'} busyText="Kaydediliyor…" />
            </button>
          </form>
          <div className="auth-actions">
            <button className="btn-ghost" onClick={() => sendCode()} disabled={cooldown > 0 || loading}>
              {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
            </button>
            <button className="btn-ghost" onClick={changeEmail}>Farklı e-posta gir</button>
          </div>
          <div className="auth-hint">E-posta gelmezse gereksiz (spam) klasörüne bak. E-postadaki bağlantıyla da yeni şifre belirleyebilirsin.</div>
        </>
      )}
    </AuthLayout>
  );
}

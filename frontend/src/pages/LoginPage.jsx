import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCOUNT_DELETED_KEY, useAuth } from '../context/AuthContext';
import client from '../api/client';
import { errorText } from '../api/errors';
import AuthLayout from '../components/AuthLayout';
import useSlow from '../hooks/useSlow';
import Loading from '../components/Loading';
import BusyLabel from '../components/BusyLabel';
import PasswordInput from '../components/PasswordInput';

// KVKK ve kullanım koşulları: girişsiz açılan statik sayfalar (public/legal/)
const LEGAL = `${import.meta.env.BASE_URL}legal/`;

// Giriş ve kayıt. Girişten sonra yönlendirmeyi App (hesap durumu) yapar:
// doğrulanmamış e-posta → doğrulama ekranı, ailesiz → aile kurma, ikisi de tamamsa uygulama.
// Kayıt oturum açmaz; "e-postana bağlantı gönderdik" ekranı gösterilir (hesap varlığı belli olmasın diye).
export default function LoginPage() {
  const { login, register, verifyLoginCode, resendLoginCode } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Kayıttan sonra: { email, message }. Hesap zaten var olsa da aynı ekran gösterilir.
  const [registered, setRegistered] = useState(null);
  const [resendInfo, setResendInfo] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  // Giriş kodu adımı: { challengeId, emailHint, resendAfter }. Şifre doğru girilince e-postaya 6 haneli kod gider.
  const [codeStep, setCodeStep] = useState(null);
  const [code, setCode] = useState('');
  const [codeInfo, setCodeInfo] = useState('');
  // "Kodu tekrar gönder" için bekleme (saniye); sunucu da dakikada 1 gönderime izin verir.
  const [cooldown, setCooldown] = useState(0);
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

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (k) => (e) => { setDeletedInfo(false); setForm((f) => ({ ...f, [k]: e.target.value })); };

  function switchMode(m) {
    setMode(m);
    setDeletedInfo(false);
    setAcceptTerms(false);
    setAcceptKvkk(false);
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
        const data = await login(form.email.trim(), form.password);
        if (data.twoFactorRequired) {
          setCodeStep({ challengeId: data.challengeId, emailHint: data.emailHint, resendAfter: data.resendAfter });
          setCode('');
          setCodeInfo('');
          setCooldown(data.resendAfter ?? 60);
          setLoading(false);
        }
      } else {
        if (!acceptKvkk || !acceptTerms) {
          setError('Kayıt olmak için Aydınlatma Metni\'ni okuduğunu onaylamalı ve Kullanım Koşulları\'nı kabul etmelisin.');
          setLoading(false);
          return;
        }
        const data = await register(form.email.trim(), form.password, form.displayName.trim(), { acceptKvkk, acceptTerms });
        setRegistered({ email: data.email || form.email.trim(), message: data.message });
        setLoading(false);
      }
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  function backToPassword() {
    setCodeStep(null);
    setCode('');
    setCodeInfo('');
    setError('');
    setForm((f) => ({ ...f, password: '' }));
  }

  async function submitCode(e) {
    e.preventDefault();
    setError('');
    setCodeInfo('');
    setLoading(true);
    try {
      await verifyLoginCode(codeStep.challengeId, code);
    } catch (err) {
      // Süresi dolan ya da hakkı biten kodda baştan giriş gerekir.
      if (err?.response?.data?.code === 'login_code_expired') backToPassword();
      setError(errorText(err));
      setLoading(false);
    }
  }

  async function resendCode() {
    setError('');
    setCodeInfo('');
    try {
      const r = await resendLoginCode(codeStep.challengeId);
      setCodeInfo(r?.message || 'Yeni kod gönderildi.');
      setCode('');
      setCooldown(codeStep.resendAfter ?? 60);
    } catch (err) {
      if (err?.response?.data?.code === 'login_code_expired') backToPassword();
      setError(errorText(err));
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

  if (codeStep) {
    return (
      <AuthLayout subtitle="Giriş kodunu gir">
        <p className="auth-text"><b>{codeStep.emailHint}</b> adresine 6 haneli bir kod gönderdik. Kod 10 dakika geçerlidir.</p>
        <form onSubmit={submitCode}>
          <input
            id="loginCode"
            className="pin-input"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            aria-label="Giriş kodu"
            placeholder="••••••"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {codeInfo && <div className="auth-info" role="status">{codeInfo}</div>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading || code.length !== 6}>
            <BusyLabel busy={loading} text="Doğrula" busyText="Doğrulanıyor…" />
          </button>
        </form>
        <div className="auth-actions">
          <button className="btn-ghost" onClick={resendCode} disabled={cooldown > 0}>
            {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
          </button>
          <button className="btn-ghost" onClick={backToPassword}>Geri dön</button>
        </div>
        <div className="auth-hint">E-posta gelmezse gereksiz (spam) klasörüne bak.</div>
      </AuthLayout>
    );
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
      footer={(
        <>
          {mode === 'login' && (
            <div className="auth-links">
              <Link className="auth-link" to="/forgot-password">Şifremi unuttum</Link>
            </div>
          )}
          <div className="legal-links">
            <a href={`${LEGAL}aydinlatma.html`}>Aydınlatma Metni ve Gizlilik</a>
            <a href={`${LEGAL}kosullar.html`}>Kullanım Koşulları</a>
          </div>
        </>
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
        {mode === 'register' && (
          <>
            {/* Aydınlatma bir bilgilendirmedir, açık rıza değildir (KVKK m.10): kutu yalnızca okunduğunu kaydeder. */}
            <label className="terms-check">
              <input type="checkbox" checked={acceptKvkk} onChange={(e) => { setAcceptKvkk(e.target.checked); setError(''); }} required />
              <span>Kişisel verilerimin işlenmesine ilişkin <a href={`${LEGAL}aydinlatma.html`} target="_blank" rel="noopener">Aydınlatma Metni</a>'ni okudum.</span>
            </label>
            <label className="terms-check">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => { setAcceptTerms(e.target.checked); setError(''); }} required />
              <span>18 yaşını doldurdum ve <a href={`${LEGAL}kosullar.html`} target="_blank" rel="noopener">Kullanım Koşulları</a>'nı kabul ediyorum.</span>
            </label>
          </>
        )}
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

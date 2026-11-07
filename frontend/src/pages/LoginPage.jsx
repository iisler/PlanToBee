import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ACCOUNT_DELETED_KEY, useAuth } from '../context/AuthContext';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import AuthLayout from '../components/AuthLayout';
import useSlow from '../hooks/useSlow';
import Loading from '../components/Loading';
import BusyLabel from '../components/BusyLabel';
import PasswordInput from '../components/PasswordInput';
import LegalSheet from '../components/LegalSheet';
import PasswordRules from '../components/PasswordRules';
import { PASSWORD_INVALID_TEXT, PASSWORD_MIN_LENGTH, passwordValid } from '../utils/passwordPolicy';

// Giriş ve kayıt. Girişten sonra yönlendirmeyi App (hesap durumu) yapar:
// doğrulanmamış e-posta → doğrulama ekranı, ailesiz → aile kurma, ikisi de tamamsa uygulama.
// Kayıt oturum açmaz; "e-postana bağlantı gönderdik" ekranı gösterilir (hesap varlığı belli olmasın diye).
export default function LoginPage() {
  const { login, register, verifyLoginCode, resendLoginCode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Kayıttan sonra: { email, message }. Hesap zaten var olsa da aynı ekran gösterilir.
  const [registered, setRegistered] = useState(null);
  const [resendInfo, setResendInfo] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  // Açık yasal metin: 'kvkk' | 'terms' | null. Kutular yalnızca metnin sonundaki düğmeyle işaretlenir.
  const [legalDoc, setLegalDoc] = useState(null);
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

  // İşaretlemek için metin açılır; işareti kaldırmak doğrudan olur.
  function onConsentChange(doc, checked) {
    setError('');
    if (checked) setLegalDoc(doc);
    else (doc === 'kvkk' ? setAcceptKvkk : setAcceptTerms)(false);
  }

  function openLegal(e, doc) {
    e.preventDefault();  // etiketin kutuyu değiştirmesini engeller
    setLegalDoc(doc);
  }

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

  // 5 hatalı denemede hesap kalıcı olarak kilitlenir; kilit "Şifremi unuttum" akışıyla (e-postaya gelen kod) açılır.
  function goUnlock() {
    navigate('/forgot-password', { state: { email: form.email.trim(), locked: true } });
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
        if (!passwordValid(form.password)) {
          setError(PASSWORD_INVALID_TEXT);
          setLoading(false);
          return;
        }
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
      setLoading(false);
      if (mode === 'login' && errorCode(err) === 'locked_out') return goUnlock();
      setError(errorText(err));
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
      if (errorCode(err) === 'locked_out') return goUnlock();
      // Süresi dolan ya da hakkı biten kodda baştan giriş gerekir.
      if (errorCode(err) === 'login_code_expired') backToPassword();
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
          <input id="displayName" aria-label="Kullanıcı adı" placeholder="Kullanıcı adı" autoComplete="nickname" maxLength={50} value={form.displayName} onChange={set('displayName')} required />
        )}
        <input id="email" type="email" aria-label="E-posta" placeholder="E-posta" autoComplete="email" value={form.email} onChange={set('email')} required />
        <PasswordInput
          id="password"
          aria-label="Şifre"
          aria-describedby={mode === 'register' ? 'register-pw-rules' : undefined}
          placeholder={mode === 'login' ? 'Şifre' : `Şifre (en az ${PASSWORD_MIN_LENGTH} karakter)`}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'login' ? undefined : PASSWORD_MIN_LENGTH}
          value={form.password}
          onChange={set('password')}
          required
        />
        {mode === 'register' && <PasswordRules id="register-pw-rules" password={form.password} />}
        {mode === 'register' && (
          <>
            {/* Aydınlatma bir bilgilendirmedir, açık rıza değildir (KVKK m.10): kutu yalnızca okunduğunu kaydeder.
                İşaretsiz kutuya dokunmak metni açar; kutu metnin sonundaki düğmeyle işaretlenir. İşaretliyken dokunmak kaldırır. */}
            <label className="terms-check">
              <input type="checkbox" checked={acceptKvkk} onChange={(e) => onConsentChange('kvkk', e.target.checked)} required />
              <span>Kişisel verilerimin işlenmesine ilişkin <button type="button" className="link-btn" onClick={(e) => openLegal(e, 'kvkk')}>Aydınlatma Metni</button>'ni okudum.</span>
            </label>
            <label className="terms-check">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => onConsentChange('terms', e.target.checked)} required />
              <span><button type="button" className="link-btn" onClick={(e) => openLegal(e, 'terms')}>Kullanım Koşulları</button>'nı kabul ediyorum.</span>
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
      {legalDoc && (
        <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)}
          onAccept={() => { (legalDoc === 'kvkk' ? setAcceptKvkk : setAcceptTerms)(true); setError(''); }} />
      )}
    </AuthLayout>
  );
}

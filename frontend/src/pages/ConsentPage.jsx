import { useRef, useState } from 'react';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import BusyLabel from '../components/BusyLabel';
import ConsentChecks from '../components/ConsentChecks';
import DeleteAccountForm from '../components/DeleteAccountForm';
import { consentVersion, requiredDocs } from '../utils/legal';

const DOC_NAMES = { kvkk: 'Aydınlatma Metni', terms: 'Kullanım Koşulları' };

// Yasal metin güncellendi ve hesap yeni sürümü henüz okumadı / kabul etmedi (Görev 18). Uygulama açılmaz.
// Hesap sahibi (ya da ailesi olmayan hesap): değişen metinleri açıp "Okudum" (aydınlatma, açık rıza değildir) /
// "Onaylıyorum" (koşullar) der ve devam eder; kabul etmek istemezse hesabını silebilir ya da çıkış yapabilir.
// other: başka bir profil seçili; onayı yalnızca hesap sahibi verebilir.
export default function ConsentPage({ other = false }) {
  const { user, acceptConsents, refreshMe, logout, accountDeleted, startSwitch } = useAuth();
  const docs = requiredDocs(user.legal);
  const [consent, setConsent] = useState({ kvkk: null, terms: null });
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const names = docs.map((d) => DOC_NAMES[d]).join(' ve ');
  const ready = docs.every((d) => consent[d] != null);

  async function submit(e) {
    e.preventDefault();
    if (!ready || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const { legal } = user;
    try {
      // Başarıda legal güncellenir ve uygulama açılır (bu sayfa kapanır).
      await acceptConsents({
        kvkkVersion: docs.includes('kvkk') ? consentVersion(consent.kvkk, legal.kvkkVersion) : undefined,
        termsVersion: docs.includes('terms') ? consentVersion(consent.terms, legal.termsVersion) : undefined,
      });
    } catch (err) {
      sending.current = false;
      setBusy(false);
      setError(errorText(err));
      // Metin bu sayfa açıkken yeniden güncellendi: kutular boşalır, güncel sürüm sunucudan okunur.
      if (errorCode(err) === 'consent_outdated') {
        setConsent({ kvkk: null, terms: null });
        refreshMe().catch(() => {});
      }
    }
  }

  if (other) return (
    <AuthLayout subtitle="Güncellenen metinler" footer={(
      <div className="auth-links">
        <button className="auth-link" onClick={logout}>Çıkış yap</button>
      </div>
    )}>
      <p className="auth-text">
        {names} güncellendi. Uygulamayı kullanmaya devam etmek için hesap sahibinin kendi profilinden yeni
        {docs.length > 1 ? ' metinleri' : ' metni'} okuyup onaylaması gerekiyor.
      </p>
      <div className="auth-actions">
        <button className="auth-submit" onClick={startSwitch}>Profil değiştir</button>
      </div>
    </AuthLayout>
  );

  if (deleting) return (
    <AuthLayout subtitle="Hesabı sil">
      <DeleteAccountForm short={!user.family} email={user.email} onCancel={() => setDeleting(false)} onDeleted={accountDeleted} />
    </AuthLayout>
  );

  return (
    <AuthLayout subtitle="Güncellenen metinler" footer={(
      <div className="auth-links">
        <button className="auth-link" onClick={logout}>Çıkış yap</button>
        <button className="auth-link danger" onClick={() => setDeleting(true)}>Hesabı sil</button>
      </div>
    )}>
      <p className="auth-text">
        {names} güncellendi. Devam etmek için yeni {docs.length > 1 ? 'metinleri' : 'metni'} aç ve sonuna kadar oku.
      </p>
      <form onSubmit={submit} noValidate>
        <ConsentChecks docs={docs} value={consent} onChange={(v) => { setConsent(v); setError(''); }} />
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="auth-submit" disabled={!ready || busy}>
          <BusyLabel busy={busy} text="Devam et" busyText="Kaydediliyor…" />
        </button>
      </form>
      <p className="auth-hint">
        Kabul etmek istemiyorsan uygulamayı kullanmaya devam edemezsin. Dilersen hesabını ve tüm verilerini
        silebilirsin.
      </p>
    </AuthLayout>
  );
}

import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import BusyLabel from './BusyLabel';
import PasswordInput from './PasswordInput';

const CONFIRM = 'SİL';

// "SIL", "sil", "Sil" gibi yazımlar: anlam doğru ama birebir değil (noktalı İ ve büyük harf gerekir).
const nearlyConfirm = (v) => {
  const t = v.trim();
  return t !== CONFIRM && t.length > 0 && t.toLocaleUpperCase('tr').replace(/I/g, 'İ') === CONFIRM;
};

// Hesabı ve tüm verileri silme formu (POST /account/delete). Ailem'deki silme sayfasında ve ailesi olmayan /
// e-postası doğrulanmamış hesaplarda kullanılır. short: aile verisi yoksa kısa liste.
// Başarıda onDeleted çağrılır; oturum ve yerel veri orada temizlenir.
export default function DeleteAccountForm({ email, profileCount, short = false, onCancel, onDeleted }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  // Yanlış şifreden sonra odak şifre alanına: alan istek sürerken kilitliydi, kilit kalktıktan sonra odaklanır.
  const [refocus, setRefocus] = useState(false);
  useEffect(() => {
    if (!refocus || busy) return;
    document.getElementById('delete-password')?.focus();
    setRefocus(false);
  }, [refocus, busy]);
  const ready = password.length > 0 && confirm.trim() === CONFIRM;
  const hint = nearlyConfirm(confirm);

  async function submit(e) {
    e.preventDefault();
    if (!ready || sending.current) return; // çift dokunuşta ikinci istek gitmez
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await client.post('/account/delete', { password, confirm: confirm.trim() });
      onDeleted();
    } catch (err) {
      sending.current = false;
      setBusy(false);
      setError(errorText(err));
      if (errorCode(err) === 'password_invalid') {
        setPassword('');
        setRefocus(true);
      }
    }
  }

  return (
    <div className="card delete-card">
      <p className="delete-lead">Şunlar kalıcı olarak silinir:</p>
      <ul className="delete-list">
        <li>Hesabın ve e-posta adresin (<b>{email}</b>)</li>
        {!short && (
          <>
            <li>Ailedeki tüm profiller{profileCount ? ` (${profileCount} profil)` : ''} ve PIN'leri</li>
            <li>Tüm dersler, aktiviteler, notlar ve ders listesi</li>
            <li>Bildirim abonelikleri ve ayarları</li>
          </>
        )}
        <li>Tüm cihazlardaki açık oturumlar</li>
      </ul>
      <p className="delete-warn">Bu işlem geri alınamaz.</p>
      <div className="small-note muted">Yedeklerden de en geç 30 gün içinde silinir. Aynı e-postayla yeniden kayıt olabilirsin.</div>

      <form className="stack-form delete-form" onSubmit={submit} noValidate>
        <label className="pin-label" htmlFor="delete-password">Hesap şifren</label>
        <PasswordInput id="delete-password" placeholder="Şifre" autoComplete="current-password" value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }} disabled={busy} />

        <label className="pin-label" htmlFor="delete-confirm">Onaylamak için {CONFIRM} yaz</label>
        <input id="delete-confirm" placeholder={CONFIRM} value={confirm} autoCapitalize="characters" autoCorrect="off"
          spellCheck={false} autoComplete="off" disabled={busy} aria-describedby={hint ? 'delete-confirm-hint' : undefined}
          onChange={(e) => { setConfirm(e.target.value); setError(''); }} />
        {hint && <div id="delete-confirm-hint" className="field-hint">Büyük harflerle, noktalı İ ile yaz: {CONFIRM}</div>}

        {error && <div className="auth-error" role="alert">{error}</div>}

        <div className="delete-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Vazgeç</button>
          <button type="submit" className="btn-danger" disabled={!ready || busy}>
            <BusyLabel busy={busy} text="Hesabı sil" busyText="Siliniyor…" />
          </button>
        </div>
      </form>
    </div>
  );
}

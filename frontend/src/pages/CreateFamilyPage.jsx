import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

// E-posta doğrulandıktan sonra ailesi olmayan kullanıcı: aile kurar ya da davet koduyla katılır.
export default function CreateFamilyPage() {
  const { user, logout, refreshMe } = useAuth();
  const [name, setName] = useState(user.displayName ? `${user.displayName} Ailesi` : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await client.post('/family', { name: name.trim() });
      await refreshMe(); // aile bilgisi gelince ana ekrana geçilir
    } catch (err) {
      if (errorCode(err) === 'already_in_family') { refreshMe().catch(() => {}); return; }
      setError(errorText(err));
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      subtitle="Aileni oluştur"
      footer={(
        <div className="auth-links">
          <Link className="auth-link" to="/invite-code">Davet kodum var</Link>
          <button className="auth-link" onClick={logout}>Çıkış yap</button>
        </div>
      )}
    >
      <form onSubmit={submit}>
        <p className="auth-text">Aileni kur; ailenin yöneticisi sen olursun. Sonra eşini ve çocuklarını davet edebilirsin.</p>
        <input aria-label="Aile adı" placeholder="Aile adı (ör. İşler Ailesi)" maxLength={100} value={name} onChange={e => setName(e.target.value)} required />
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Oluşturuluyor…' : 'Aileyi oluştur'}</button>
        <div className="auth-hint">Bir aileye davet edildiysen e-postadaki bağlantıyı aç ya da "Davet kodum var" seçeneğini kullan.</div>
      </form>
    </AuthLayout>
  );
}

import { useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Loading from '../components/Loading';
import PinInput from '../components/PinInput';
import { initial, ROLE_LABEL } from '../utils/format';

const ROLES = ['Child', 'Parent'];

// "Ailem": aile adı ve profiller. Profil ekleme, düzenleme ve silme yalnızca ebeveyn profilinden yapılır;
// çocuk profili yalnızca kendi PIN'ini değiştirebilir. Ebeveyn profillerinde PIN zorunludur.
export default function FamilyPage({ family, reloadFamily, onProfileChanged }) {
  const { user } = useAuth();
  const { notify } = useNotice();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, kind: 'edit' | 'pin' }
  const [removing, setRemoving] = useState(null);

  if (!family) return <Loading />;
  const isParent = family.iAmParent;

  // Ortak akış: istek → aileyi tazele → bilgi mesajı. Hata olursa mesaj gösterilir, form açık kalır.
  async function run(request, successText) {
    setBusy(true);
    try {
      await request();
      await reloadFamily();
      onProfileChanged?.();
      if (successText) notify(successText, 'info');
      return true;
    } catch (err) {
      notify(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rename(e) {
    e.preventDefault();
    if (await run(() => client.put('/family', { name: name.trim() }), 'Aile adı güncellendi.')) setRenaming(false);
  }

  return (
    <div className="family-page">
      <div className="card">
        {renaming ? (
          <form className="inline-form" onSubmit={rename}>
            <input aria-label="Aile adı" maxLength={100} value={name} onChange={e => setName(e.target.value)} required autoFocus />
            <button type="submit" className="btn" disabled={busy}>Kaydet</button>
            <button type="button" className="btn-ghost" onClick={() => setRenaming(false)}>İptal</button>
          </form>
        ) : (
          <div className="card-head">
            <h2>{family.name}</h2>
            {isParent && <button className="btn-ghost small" onClick={() => { setName(family.name); setRenaming(true); }}>Adı değiştir</button>}
          </div>
        )}
        <div className="muted">
          Aile hesabı: <b>{user.email}</b> · {family.profiles.length} profil
        </div>
        <div className="muted small-note">
          Ailen bu hesapla giriş yapar; her cihazda girişten sonra kişi kendi profilini seçer.
          Ebeveyn profilleri PIN ile korunur.
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Profiller</h2></div>
        {family.profiles.map(p => {
          const canManage = isParent;
          const canPin = isParent || p.isCurrent;
          const open = editing?.id === p.id ? editing.kind : null;
          return (
            <div key={p.id} className="member">
              <span className={`av big role-${p.role}`} aria-hidden="true">{initial(p.displayName)}</span>
              <div className="member-info">
                <div className="member-name">
                  {p.displayName}{p.isCurrent && <small> (sen)</small>}
                  {p.isOwner && <span className="badge admin">Hesap sahibi</span>}
                </div>
                <div className="member-meta">
                  {ROLE_LABEL[p.role]} · {p.hasPin ? 'PIN var' : 'PIN yok'}
                  {p.lockedSeconds > 0 && <span className="locked"> · {Math.ceil(p.lockedSeconds / 60)} dk kilitli</span>}
                </div>

                {!open && (
                  <div className="member-actions">
                    {canManage && <button className="link" onClick={() => setEditing({ id: p.id, kind: 'edit' })}>Düzenle</button>}
                    {canPin && (
                      <button className="link" onClick={() => setEditing({ id: p.id, kind: 'pin' })}>
                        {p.hasPin ? 'PIN değiştir' : 'PIN koy'}
                      </button>
                    )}
                    {canManage && !p.isOwner && !p.isCurrent && (
                      <button className="link danger" onClick={() => setRemoving(p)}>Sil</button>
                    )}
                  </div>
                )}
                {open === 'edit' && (
                  <EditProfileForm profile={p} busy={busy} onCancel={() => setEditing(null)}
                    onSave={async (body) => {
                      if (await run(() => client.put(`/profiles/${p.id}`, body), 'Profil güncellendi.')) setEditing(null);
                    }} />
                )}
                {open === 'pin' && (
                  <PinForm profile={p} busy={busy} onCancel={() => setEditing(null)}
                    onSave={async (pin) => {
                      const text = pin == null ? 'PIN kaldırıldı.' : 'PIN kaydedildi.';
                      if (await run(() => client.put(`/profiles/${p.id}/pin`, { pin }), text)) setEditing(null);
                    }} />
                )}
              </div>
            </div>
          );
        })}
        {!isParent && <div className="muted small-note">Profilleri yalnızca ebeveyn profilleri ekleyip değiştirebilir.</div>}
      </div>

      {isParent && (
        <AddProfileCard busy={busy}
          onAdd={(body) => run(() => client.post('/profiles', body), `${body.displayName} eklendi.`)} />
      )}

      {removing && (
        <ConfirmDialog danger title="Profili sil" confirmLabel="Profili sil" busy={busy}
          message={`${removing.displayName} profili silinecek. Eklediği kayıtlar ortak planda kalır ve "Eski üye" olarak görünür. Bu profili kullanan cihazlar profil seçme ekranına döner.`}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            if (await run(() => client.delete(`/profiles/${removing.id}`), `${removing.displayName} silindi.`)) setRemoving(null);
          }} />
      )}
    </div>
  );
}

function RoleSeg({ value, onChange, disabled }) {
  return (
    <div className="seg" role="group" aria-label="Rol">
      {ROLES.map(r => (
        <button key={r} type="button" className={value === r ? 'active' : ''} aria-pressed={value === r}
          disabled={disabled} onClick={() => onChange(r)}>{ROLE_LABEL[r]}</button>
      ))}
    </div>
  );
}

function AddProfileCard({ busy, onAdd }) {
  const [form, setForm] = useState({ displayName: '', role: 'Child', pin: '' });
  const [error, setError] = useState('');
  const parent = form.role === 'Parent';

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (parent && form.pin.length !== 4) return setError('Ebeveyn profilleri için 4 haneli PIN zorunlu.');
    if (form.pin && form.pin.length !== 4) return setError('PIN 4 rakamdan oluşmalı.');
    const ok = await onAdd({ displayName: form.displayName.trim(), role: form.role, pin: form.pin || null });
    if (ok) setForm({ displayName: '', role: 'Child', pin: '' });
  }

  return (
    <div className="card">
      <div className="card-head"><h2>Profil ekle</h2></div>
      <form className="stack-form" onSubmit={submit}>
        <input aria-label="Ad" placeholder="Ad (ör. Ela)" maxLength={50} value={form.displayName}
          onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required />
        <RoleSeg value={form.role} onChange={role => setForm(f => ({ ...f, role }))} />
        <label className="pin-label">{parent ? 'PIN (zorunlu)' : 'PIN (isteğe bağlı)'}
          <PinInput value={form.pin} onChange={pin => setForm(f => ({ ...f, pin }))} label="PIN" />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="btn" disabled={busy}>Profili ekle</button>
        <div className="muted small-note">
          E-posta gerekmez. Kişi, aile hesabıyla giriş yaptıktan sonra bu profili seçer.
          {parent ? ' Ebeveyn profili tüm kayıtları düzenleyip silebilir ve profilleri yönetebilir.' : ' Çocuk profili kayıt ekler ama yalnızca kendi kayıtlarını değiştirebilir.'}
        </div>
      </form>
    </div>
  );
}

function EditProfileForm({ profile, busy, onSave, onCancel }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [role, setRole] = useState(profile.role);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  // Çocuk -> Ebeveyn: profilin PIN'i yoksa yeni PIN gerekir.
  const needsPin = role === 'Parent' && !profile.hasPin;

  function submit(e) {
    e.preventDefault();
    setError('');
    if (needsPin && pin.length !== 4) return setError('Ebeveyn profilleri için 4 haneli PIN zorunlu.');
    onSave({ displayName: displayName.trim(), role, pin: needsPin ? pin : null });
  }

  return (
    <form className="stack-form profile-edit" onSubmit={submit}>
      <input aria-label="Ad" maxLength={50} value={displayName} onChange={e => setDisplayName(e.target.value)} required autoFocus />
      {profile.isOwner || profile.isCurrent
        ? <div className="muted small-note">{profile.isOwner ? 'Hesap sahibinin profili Ebeveyn kalır.' : 'Kendi profilinin rolünü başka bir ebeveyn profilinden değiştirebilirsin.'}</div>
        : <RoleSeg value={role} onChange={setRole} />}
      {needsPin && (
        <label className="pin-label">Yeni PIN (ebeveyn için zorunlu)
          <PinInput value={pin} onChange={setPin} label="Yeni PIN" />
        </label>
      )}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="inline-form">
        <button type="submit" className="btn" disabled={busy}>Kaydet</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>İptal</button>
      </div>
    </form>
  );
}

function PinForm({ profile, busy, onSave, onCancel }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    if (pin.length !== 4) return setError('PIN 4 rakamdan oluşmalı.');
    if (pin !== pin2) return setError('PIN\'ler aynı değil.');
    onSave(pin);
  }

  return (
    <form className="stack-form profile-edit" onSubmit={submit}>
      <label className="pin-label">Yeni PIN
        <PinInput value={pin} onChange={setPin} label="Yeni PIN" autoFocus />
      </label>
      <label className="pin-label">Yeni PIN (tekrar)
        <PinInput value={pin2} onChange={setPin2} label="Yeni PIN tekrar" />
      </label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="inline-form">
        <button type="submit" className="btn" disabled={busy}>PIN'i kaydet</button>
        {profile.role === 'Child' && profile.hasPin && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => onSave(null)}>PIN'i kaldır</button>
        )}
        <button type="button" className="btn-ghost" onClick={onCancel}>İptal</button>
      </div>
    </form>
  );
}

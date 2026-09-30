import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatRemaining, formatStamp, initial, INVITE_STATUS_LABEL, MEMBER_STATUS_LABEL, possessive, ROLE_LABEL } from '../utils/format';
import Loading from '../components/Loading';

// "Ailem" ekranı: üyeler, roller, hesap ve davet durumları. Değişiklikler yalnızca yöneticiye açıktır.
export default function FamilyPage({ family, reloadFamily }) {
  const { refreshMe } = useAuth();
  const { notify } = useNotice();
  const [dialog, setDialog] = useState(null); // { kind, member, role? }
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState({ displayName: '', role: 'Child', email: '' });
  const [profileName, setProfileName] = useState('');
  const [profileInvite, setProfileInvite] = useState({ id: null, email: '' });
  const [history, setHistory] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isAdmin = !!family?.iAmAdmin;

  const loadHistory = useCallback(async () => {
    try {
      const r = await client.get('/family/invitations');
      setHistory(r.data);
    } catch (err) {
      notify(`Davet geçmişi yüklenemedi: ${errorText(err)}`);
    }
  }, [notify]);

  useEffect(() => { if (historyOpen && isAdmin) loadHistory(); }, [historyOpen, isAdmin, loadHistory]);

  if (!family) return <Loading />;

  // Ortak akış: istek → aileyi tazele → bilgi mesajı. Hata olursa mesaj gösterilir, form korunur.
  async function run(request, successText) {
    setBusy(true);
    try {
      const res = await request();
      await reloadFamily();
      if (historyOpen) loadHistory();
      if (successText) notify(typeof successText === 'function' ? successText(res) : successText, 'info');
      return res ?? true;
    } catch (err) {
      notify(errorText(err));
      await reloadFamily();
      return null;
    } finally {
      setBusy(false);
    }
  }

  const sentText = (res) => (res.data.emailSent
    ? 'Davet e-postası gönderildi.'
    : 'Davet oluşturuldu ama e-posta gönderilemedi. "Yeniden gönder" ile tekrar dene.');

  async function saveName(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => client.put('/family', { name: name.trim() }), 'Aile adı güncellendi.')) {
      setRenaming(false);
      refreshMe().catch(() => {});
    }
  }

  async function sendInvite(e) {
    e.preventDefault();
    const body = { displayName: invite.displayName.trim(), role: invite.role, email: invite.email.trim() };
    if (!body.displayName || !body.email) return;
    if (await run(() => client.post('/family/invitations', body), sentText)) setInvite({ displayName: '', role: 'Child', email: '' });
  }

  async function addProfile(e) {
    e.preventDefault();
    if (!profileName.trim()) return;
    if (await run(() => client.post('/family/members/profiles', { displayName: profileName.trim() }), 'Çocuk profili oluşturuldu.')) setProfileName('');
  }

  async function inviteProfile(e) {
    e.preventDefault();
    const email = profileInvite.email.trim();
    if (!email) return;
    if (await run(() => client.post(`/family/members/${profileInvite.id}/invite`, { email }), sentText)) setProfileInvite({ id: null, email: '' });
  }

  const resend = (inv) => run(() => client.post(`/family/invitations/${inv.id}/resend`), sentText);
  const cancelInvite = (inv) => run(() => client.post(`/family/invitations/${inv.id}/cancel`), 'Davet iptal edildi.');

  async function confirmDialog() {
    const { kind, member, role } = dialog;
    let ok;
    if (kind === 'role') {
      ok = await run(() => client.put(`/family/members/${member.id}/role`, { role }), `${member.displayName} artık ${ROLE_LABEL[role]}.`);
    } else if (kind === 'remove') {
      ok = await run(() => client.delete(`/family/members/${member.id}`),
        `${member.displayName} aileden çıkarıldı.`);
    } else if (kind === 'transfer') {
      ok = await run(() => client.post('/family/transfer-admin', { memberId: member.id }), `Yöneticilik ${member.displayName} kişisine devredildi.`);
      if (ok) refreshMe().catch(() => {});
    } else if (kind === 'leave') {
      setBusy(true);
      try {
        await client.post('/family/leave');
        setDialog(null);
        notify('Aileden ayrıldın. Artık yeni, tek kişilik ailendesin.', 'info');
        await refreshMe(); // yeni aile bilgisiyle ana ekran yeniden kurulur
      } catch (err) {
        notify(errorText(err));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (ok) setDialog(null);
  }

  const admin = family.members.find(m => m.isAdmin);
  const me = family.members.find(m => m.isMe);

  return (
    <>
      <div className="card family-head">
        {renaming ? (
          <form className="inline-form" onSubmit={saveName}>
            <input aria-label="Aile adı" value={name} maxLength={100} onChange={e => setName(e.target.value)} autoFocus />
            <button type="submit" className="btn" disabled={busy}>Kaydet</button>
            <button type="button" className="btn-ghost" onClick={() => setRenaming(false)}>İptal</button>
          </form>
        ) : (
          <div className="card-head">
            <h2>{family.name}</h2>
            {isAdmin && <button className="btn-ghost small" onClick={() => { setName(family.name); setRenaming(true); }}>Adı değiştir</button>}
          </div>
        )}
        <div className="muted">
          Yönetici: <b>{admin?.displayName}</b>{admin?.isMe && ' (sen)'} · {family.members.length} üye
          {!isAdmin && ' · Aileyi yalnızca yönetici değiştirebilir.'}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Üyeler</h2></div>
        {family.members.map(m => (
          <div key={m.id} className="member">
            <span className="av big" aria-hidden="true">{initial(m.displayName)}</span>
            <div className="member-info">
              <div className="member-name">
                {m.displayName}{m.isMe && <small> (sen)</small>}
                {m.isAdmin && <span className="badge admin">Yönetici</span>}
              </div>
              <div className="member-meta">
                {ROLE_LABEL[m.role]} · <span className={`status-${m.status}`}>{MEMBER_STATUS_LABEL[m.status] || m.status}</span>
                {m.email && <> · {m.email}</>}
              </div>
              {m.invitation && m.status !== 'Joined' && <InviteLine inv={m.invitation} />}

              <div className="member-actions">
                {isAdmin && m.invitation && (m.invitation.status === 'Pending' || m.invitation.status === 'Expired') && (
                  <button className="link" disabled={busy} onClick={() => resend(m.invitation)}>Yeniden gönder</button>
                )}
                {isAdmin && m.invitation?.status === 'Pending' && (
                  <button className="link" disabled={busy} onClick={() => cancelInvite(m.invitation)}>Daveti iptal et</button>
                )}
                {isAdmin && m.status === 'NoAccount' && profileInvite.id !== m.id && (
                  <button className="link" onClick={() => setProfileInvite({ id: m.id, email: '' })}>Davet gönder</button>
                )}
                {isAdmin && !m.isAdmin && (
                  <button className="link" onClick={() => setDialog({ kind: 'role', member: m, role: m.role === 'Parent' ? 'Child' : 'Parent' })}>
                    {m.role === 'Parent' ? 'Çocuk yap' : 'Ebeveyn yap'}
                  </button>
                )}
                {isAdmin && !m.isMe && m.role === 'Parent' && m.status === 'Joined' && (
                  <button className="link" onClick={() => setDialog({ kind: 'transfer', member: m })}>Yöneticiliği devret</button>
                )}
                {isAdmin && !m.isMe && (
                  <button className="link danger" onClick={() => setDialog({ kind: 'remove', member: m })}>Aileden çıkar</button>
                )}
              </div>

              {isAdmin && profileInvite.id === m.id && (
                <form className="inline-form" onSubmit={inviteProfile}>
                  <input type="email" required placeholder={`${possessive(m.displayName)} e-postası`} aria-label="E-posta"
                    value={profileInvite.email} onChange={e => setProfileInvite(p => ({ ...p, email: e.target.value }))} autoFocus />
                  <button type="submit" className="btn" disabled={busy}>Gönder</button>
                  <button type="button" className="btn-ghost" onClick={() => setProfileInvite({ id: null, email: '' })}>İptal</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <>
          <div className="card">
            <div className="card-head"><h2>Aileye davet et</h2></div>
            <form className="stack-form" onSubmit={sendInvite}>
              <input placeholder="Görünen ad (ör. Ela)" aria-label="Görünen ad" maxLength={50} required
                value={invite.displayName} onChange={e => setInvite(f => ({ ...f, displayName: e.target.value }))} />
              <div className="seg" role="group" aria-label="Rol">
                {['Child', 'Parent'].map(r => (
                  <button key={r} type="button" className={invite.role === r ? 'active' : ''} aria-pressed={invite.role === r} onClick={() => setInvite(f => ({ ...f, role: r }))}>{ROLE_LABEL[r]}</button>
                ))}
              </div>
              <input type="email" placeholder="E-posta adresi" aria-label="E-posta" required
                value={invite.email} onChange={e => setInvite(f => ({ ...f, email: e.target.value }))} />
              <button type="submit" className="btn" disabled={busy}>Davet gönder</button>
              <div className="muted small-note">Davet e-postası tek kullanımlık bir bağlantı ve 6 haneli yedek kod içerir, 7 gün geçerlidir.</div>
            </form>
          </div>

          <div className="card">
            <div className="card-head"><h2>E-postası olmayan çocuk ekle</h2></div>
            <form className="inline-form" onSubmit={addProfile}>
              <input placeholder="Çocuğun adı" aria-label="Çocuğun adı" maxLength={50} required value={profileName} onChange={e => setProfileName(e.target.value)} />
              <button type="submit" className="btn" disabled={busy}>Ekle</button>
            </form>
            <div className="muted small-note">Hesabı olmayan bir profil oluşur. İleride e-posta ile davet edebilirsin; katılınca ailenin ortak planını kendi hesabıyla kullanır.</div>
          </div>

          <div className="card">
            <button className="manage-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(o => !o)}>
              {historyOpen ? '▲ Davet geçmişini kapat' : '▼ Davet geçmişi'}
            </button>
            {historyOpen && (history == null ? <Loading />
              : history.length === 0 ? <div className="empty-note">Henüz davet gönderilmedi.</div>
                : history.map(inv => (
                  <div key={inv.id} className="history-row">
                    <div><b>{inv.memberName}</b> · {inv.email}</div>
                    <InviteLine inv={inv} />
                  </div>
                )))}
          </div>
        </>
      )}

      <div className="card">
        {isAdmin ? (
          <div className="muted">Aileden ayrılmak için önce yöneticiliği katılmış bir ebeveyne devretmelisin.</div>
        ) : me && (
          <button className="btn-danger" onClick={() => setDialog({ kind: 'leave', member: me })}>Aileden ayrıl</button>
        )}
      </div>

      {dialog && <FamilyDialog dialog={dialog} familyName={family.name} busy={busy} onConfirm={confirmDialog} onCancel={() => setDialog(null)} />}
    </>
  );
}

function InviteLine({ inv }) {
  return (
    <div className={`invite-line inv-${inv.status}`}>
      Davet: <b>{INVITE_STATUS_LABEL[inv.status] || inv.status}</b>
      {inv.status === 'Pending' && inv.remainingSeconds != null && <> · {formatRemaining(inv.remainingSeconds)}</>}
      {inv.lastSentAt && <> · son gönderim {formatStamp(inv.lastSentAt)}</>}
      {inv.invitedBy && <> · gönderen {inv.invitedBy}</>}
    </div>
  );
}

function FamilyDialog({ dialog, familyName, busy, onConfirm, onCancel }) {
  const { kind, member: m, role } = dialog;
  const props = { busy, onConfirm, onCancel };
  if (kind === 'role') {
    return (
      <ConfirmDialog {...props} title="Rolü değiştir" confirmLabel={`${ROLE_LABEL[role]} yap`}
        message={role === 'Parent'
          ? `${m.displayName} Ebeveyn olacak ve ortak plandaki tüm kayıtları düzenleyip silebilecek.`
          : `${m.displayName} Çocuk olacak; ortak plana kayıt ekleyebilecek ama yalnızca kendi eklediği kayıtları düzenleyip silebilecek.`} />
    );
  }
  if (kind === 'transfer') {
    return (
      <ConfirmDialog {...props} title="Yöneticiliği devret" confirmLabel="Devret"
        message={`${m.displayName} ailenin yöneticisi olacak. Sen Ebeveyn rolünde normal üye olarak kalacaksın ve aile yönetimi işlemlerini artık yapamayacaksın.`} />
    );
  }
  if (kind === 'remove') {
    const noAccount = m.status !== 'Joined';
    return (
      <ConfirmDialog {...props} danger title="Aileden çıkar" confirmLabel={noAccount ? 'Profili sil' : 'Aileden çıkar'}
        message={noAccount
          ? `${m.displayName} için hesap yok (ya da davet henüz kabul edilmedi). Çıkarırsan profil kalıcı olarak silinir. Ortak plandaki kayıtlar silinmez.`
          : `${m.displayName} aileden çıkarılacak ve ailenin planına erişimi hemen sona erecek. Eklediği kayıtlar ortak planda kalır ve "Eski üye" olarak görünür.`} />
    );
  }
  return (
    <ConfirmDialog {...props} danger title="Aileden ayrıl" confirmLabel="Ayrıl"
      message={`"${familyName}" adlı aileden ayrılacaksın ve bu ailenin planına erişimin sona erecek. Eklediğin kayıtlar ailenin planında kalır. Sana yeni, tek kişilik bir aile açılır.`} />
  );
}

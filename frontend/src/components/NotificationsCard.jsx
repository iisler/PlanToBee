import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { errorText } from '../api/errors';
import { useNotice } from '../context/NoticeContext';
import { currentSubscription, disablePush, permission, pushConfig, pushSupported, requestPermission, subscribeDevice, thisDeviceId } from '../utils/push';

const TYPES = [
  { key: 'studyAdded', label: 'Ders eklenince' },
  { key: 'activityAdded', label: 'Aktivite eklenince' },
  { key: 'changes', label: 'Değişiklik ve silme', hint: 'Saat değişti, kayıt silindi' },
  { key: 'studyDone', label: 'Ders tamamlanınca', hint: '"Ela Matematik\'i bitirdi"' },
];

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)} />
  );
}

// Ailem > Bildirimler: bu cihaz aç/kapa, kimin girişleri, türler, sessiz saatler ve bildirim alan cihazlar.
// Ayarlar seçili profile aittir ve her değişiklikte kaydedilir.
export default function NotificationsCard() {
  const { notify } = useNotice();
  const [enabled, setEnabled] = useState(null);     // sunucuda bildirimler açık mı
  const [data, setData] = useState(null);           // { settings, members, devices }
  const [deviceOn, setDeviceOn] = useState(false);
  const [perm, setPerm] = useState(permission());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const config = await pushConfig();
      setEnabled(config.enabled);
      if (!config.enabled) return;
      const [res, sub] = await Promise.all([client.get('/push/settings'), currentSubscription()]);
      setData(res.data);
      const myDevice = thisDeviceId();
      setDeviceOn(!!sub && permission() === 'granted' && res.data.devices.some((d) => d.id === myDevice));
    } catch (err) {
      notify(errorText(err));
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  if (enabled === false) return null;
  if (!data) return null;

  const s = data.settings;

  async function save(patch) {
    const next = { ...s, ...patch };
    setData((d) => ({ ...d, settings: next }));
    try {
      const res = await client.put('/push/settings', next);
      setData((d) => ({ ...d, settings: res.data }));
    } catch (err) {
      setData((d) => ({ ...d, settings: s }));
      notify(errorText(err));
    }
  }

  // Açarken izin, dokunuşun hemen içinde istenir (iPhone şartı); abonelik ardından tamamlanır.
  function toggleDevice(on) {
    setBusy(true);
    const work = on
      ? requestPermission().then((result) => {
        setPerm(permission());
        if (result === 'denied') notify('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsin.', 'info');
        return result === 'granted' ? subscribeDevice() : null;
      })
      : disablePush();
    work.then(load)
      .catch((err) => notify(`Bildirimler açılamadı (${err?.message || 'bilinmeyen hata'}).`))
      .finally(() => setBusy(false));
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await client.post('/push/test');
      notify(res.data.sent > 0 ? 'Deneme bildirimi gönderildi.' : 'Bu profile kayıtlı cihaz bulunamadı.', 'info');
    } catch (err) {
      notify(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(device) {
    try {
      await client.delete(`/push/devices/${device.id}`);
      if (device.id === thisDeviceId()) await disablePush();
      await load();
    } catch (err) {
      notify(errorText(err));
    }
  }

  const muted = new Set(s.mutedMemberIds);
  const toggleMember = (id) => save({ mutedMemberIds: muted.has(id) ? s.mutedMemberIds.filter((x) => x !== id) : [...s.mutedMemberIds, id] });
  const allOn = data.members.every((m) => !muted.has(m.id));
  const myDevice = thisDeviceId();

  return (
    <div className="card notif-card">
      <div className="card-head"><h2>🔔 Bildirimler</h2></div>

      {!pushSupported() ? (
        <div className="muted small-note">
          Bu tarayıcı bildirim desteklemiyor. iPhone'da bildirimler, PlanToBee Safari'den ana ekrana eklenip oradan açılınca çalışır.
        </div>
      ) : perm === 'denied' ? (
        <div className="muted small-note">
          Bildirimler bu tarayıcıda engellenmiş. Tarayıcının ya da telefonun ayarlarından PlanToBee için bildirim iznini açabilirsin.
        </div>
      ) : (
        <div className="set-row">
          <div className="set-text">Bu cihazda bildirimler<small>{deviceOn ? 'Açık' : 'Kapalı'}</small></div>
          <Switch checked={deviceOn} onChange={toggleDevice} label="Bu cihazda bildirimler" disabled={busy} />
        </div>
      )}

      {data.members.length > 0 && (
        <>
          <div className="set-sub">Kimin girişleri?</div>
          <div className="who-chips" role="group" aria-label="Kimin girişleri">
            {data.members.map((m) => (
              <button key={m.id} type="button" className={muted.has(m.id) ? '' : 'on'} aria-pressed={!muted.has(m.id)} onClick={() => toggleMember(m.id)}>{m.displayName}</button>
            ))}
            {!allOn && <button type="button" className="all" onClick={() => save({ mutedMemberIds: [] })}>Hepsi</button>}
          </div>
        </>
      )}

      <div className="set-sub">Neler?</div>
      {TYPES.map((t) => (
        <div key={t.key} className="set-row">
          <div className="set-text">{t.label}{t.hint && <small>{t.hint}</small>}</div>
          <Switch checked={s[t.key]} onChange={(v) => save({ [t.key]: v })} label={t.label} />
        </div>
      ))}

      <div className="set-sub">Sessiz saatler</div>
      <div className="set-row">
        <div className="set-text">
          {s.quietEnabled ? (
            <span className="quiet-times">
              <input type="time" aria-label="Sessiz saat başlangıcı" value={s.quietStart} onChange={(e) => e.target.value && save({ quietStart: e.target.value })} />
              <span>–</span>
              <input type="time" aria-label="Sessiz saat bitişi" value={s.quietEnd} onChange={(e) => e.target.value && save({ quietEnd: e.target.value })} />
            </span>
          ) : 'Kapalı'}
          <small>Bu saatlerde oluşanlar sessiz saat bitince tek özet olarak gelir</small>
        </div>
        <Switch checked={s.quietEnabled} onChange={(v) => save({ quietEnabled: v })} label="Sessiz saatler" />
      </div>

      {data.devices.length > 0 && (
        <>
          <div className="set-sub">Bildirim alan cihazlar</div>
          <ul className="device-list">
            {data.devices.map((d) => (
              <li key={d.id}>
                <span>📱 {d.memberName} – {d.label}{d.id === myDevice && <b> (bu cihaz)</b>}</span>
                {d.canRemove && <button type="button" className="link danger" onClick={() => removeDevice(d)}>Kaldır</button>}
              </li>
            ))}
          </ul>
        </>
      )}

      {deviceOn && <button type="button" className="btn-ghost small test-push" onClick={sendTest} disabled={busy}>Deneme bildirimi gönder</button>}
    </div>
  );
}

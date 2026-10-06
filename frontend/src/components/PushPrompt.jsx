import { useEffect, useState } from 'react';
import { useNotice } from '../context/NoticeContext';
import { decidePrompt, enablePush, permission, promptDecided, pushConfig } from '../utils/push';

// "Aileden haberdar ol": bildirim izni bu cihazda bir kez önerilir. "Şimdi değil" denirse bir daha gösterilmez;
// bildirimler sonra Ailem > Bildirimler'den açılabilir. Desteklenmeyen ortamda hiç görünmez.
export default function PushPrompt() {
  const { notify } = useNotice();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (promptDecided() || permission() !== 'default') return;
    let alive = true;
    pushConfig().then((c) => { if (alive && c.enabled) setShow(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!show) return null;

  async function enable() {
    setBusy(true);
    try {
      const result = await enablePush();
      decidePrompt('done');
      setShow(false);
      if (result === 'granted') notify('Bildirimler açıldı. Ayarları Ailem › Bildirimler\'den değiştirebilirsin.', 'info');
      else if (result === 'denied') notify('Bildirim izni verilmedi. İstersen tarayıcı ayarlarından açabilirsin.', 'info');
    } catch {
      notify('Bildirimler açılamadı. Biraz sonra Ailem › Bildirimler\'den tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  function later() {
    decidePrompt('later');
    setShow(false);
  }

  return (
    <div className="push-prompt" role="region" aria-label="Bildirimler">
      <span className="pp-icon" aria-hidden="true">🔔</span>
      <div>
        <b>Aileden haberdar ol</b>
        <p>Biri ders ya da aktivite eklediğinde bu cihaza bildirim gelsin mi?</p>
        <div className="pp-actions">
          <button className="pp-yes" onClick={enable} disabled={busy}>Bildirimleri aç</button>
          <button className="pp-no" onClick={later} disabled={busy}>Şimdi değil</button>
        </div>
      </div>
    </div>
  );
}

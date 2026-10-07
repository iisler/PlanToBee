import { useEffect, useState } from 'react';
import { useNotice } from '../context/NoticeContext';
import { decidePrompt, permission, promptDecided, pushConfig, requestPermission, subscribeDevice } from '../utils/push';

// "Aileden haberdar ol": bildirim izni bu cihazda bir kez önerilir. "Şimdi değil" denirse bir daha gösterilmez;
// bildirimler sonra ad menüsündeki Bildirimler sayfasından açılabilir. Desteklenmeyen ortamda hiç görünmez.
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

  // İzin penceresi dokunuşun hemen içinde açılır (iPhone şartı). Kart izin cevabı gelince kapanır;
  // abonelik arka planda tamamlanır ve sonucu bildirim mesajıyla söylenir.
  function enable() {
    setBusy(true);
    const asked = requestPermission();
    asked.then(async (result) => {
      decidePrompt('done');
      setShow(false);
      if (result === 'denied') return notify('Bildirim izni verilmedi. İstersen tarayıcı ayarlarından açabilirsin.', 'info');
      if (result !== 'granted') return undefined;
      await subscribeDevice();
      notify('Bildirimler açıldı. Ayarları ad menüsündeki Bildirimler\'den değiştirebilirsin.', 'info');
      return undefined;
    }).catch((err) => {
      decidePrompt('done');
      setShow(false);
      notify(`Bildirimler açılamadı (${err?.message || 'bilinmeyen hata'}). ad menüsündeki Bildirimler'den tekrar deneyebilirsin.`);
    });
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

// Geri alınabilir işlem (silme): istek hemen değil, kısa bir bekleme süresinden sonra gönderilir.
// Bu sürede kullanıcı "Geri al" diyebilir. Tek bir bekleyen işlem tutulur ve şu durumlarda hemen gönderilir:
// - süre dolunca,
// - yeni bir geri alınabilir işlem başlayınca,
// - sunucuya başka bir istek gitmeden önce (api/client.js): sonraki okuma silinmiş kaydı geri getirmesin,
// - uygulama arka plana alınınca / sekme gizlenince.

let pending = null; // { run, timer, onSettled }

// run: isteği gönderen ve kendi hatasını kendisi işleyen fonksiyon (reddetmemeli).
// onSettled: gönderildiğinde ya da geri alındığında çağrılır (ör. "Geri al" bildirimini kapatmak için).
export function defer(run, { delay = 5000, onSettled } = {}) {
  flushDeferred();
  const entry = { run, onSettled };
  entry.timer = setTimeout(flushDeferred, delay);
  pending = entry;
}

export function hasDeferred() {
  return pending !== null;
}

export async function flushDeferred() {
  const entry = pending;
  if (!entry) return;
  pending = null;
  clearTimeout(entry.timer);
  entry.onSettled?.();
  try {
    await entry.run();
  } catch {
    /* run kendi hatasını gösterir */
  }
}

// Geri al: istek hiç gönderilmez. İşlem zaten gönderildiyse false döner.
export function cancelDeferred(run) {
  if (!pending || pending.run !== run) return false;
  const entry = pending;
  pending = null;
  clearTimeout(entry.timer);
  entry.onSettled?.();
  return true;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDeferred();
  });
  window.addEventListener('pagehide', () => flushDeferred());
}

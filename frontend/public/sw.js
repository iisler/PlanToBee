// PlanToBee service worker: yalnızca bildirim gösterir. Sayfaları ya da verileri önbelleğe almaz
// (uygulama her zaman güncel sürümle açılır). Dış kütüphane yok.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Sunucudan gelen şifreli bildirimi tarayıcı çözer; burada yalnızca gösterilir.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'PlanToBee', {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'badge-72.png',
    lang: 'tr',
    data: { url: data.url || self.registration.scope },
  }));
});

// Bildirime dokununca: uygulama açıksa öne getirilir ve ilgili güne geçer, değilse o günle açılır.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Uygulama adresi "…/app" (sondaki / olmadan) da olabilir
    const base = self.registration.scope.replace(/\/$/, '');
    const open = windows.find((w) => w.url === base || w.url.startsWith(self.registration.scope));
    if (open) {
      await open.focus();
      open.postMessage({ type: 'plantobee:open', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

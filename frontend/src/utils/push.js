import client, { TOKEN_KEY } from '../api/client';

// Bildirimler (Web Push). Tarayıcının kendi bildirim altyapısı kullanılır; dış kütüphane yoktur.
// Cihaz, seçili profil adına abone olur. Sunucu bildirim içeriğini şifreler; yalnızca bu tarayıcı çözebilir.

const DECISION_KEY = 'plantobee:push-decision'; // 'later' | 'done': izin kartı bu cihazda bir daha gösterilmez
const SUB_ID_KEY = 'plantobee:push-sub-id';     // cihaz listesinde "Bu cihaz"ı işaretlemek için
const SERVER_KEY = 'plantobee:push-key';        // abone olunan sunucu anahtarı (değişirse yeniden abone olunur)

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* depolama kapalı */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* depolama kapalı */ } },
};

// iPhone'da yalnızca ana ekrana eklenmiş uygulamada desteklenir; desteklenmeyen ortamda hiçbir şey yapılmaz.
export const pushSupported = () =>
  typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator
  && 'PushManager' in window && 'Notification' in window;

export const permission = () => (pushSupported() ? Notification.permission : 'unsupported');

let configPromise = null;
export function pushConfig() {
  configPromise ??= client.get('/push/config').then((r) => r.data).catch((err) => { configPromise = null; throw err; });
  return configPromise;
}

export const promptDecided = () => !!store.get(DECISION_KEY);
export const decidePrompt = (value) => store.set(DECISION_KEY, value);
export const thisDeviceId = () => Number(store.get(SUB_ID_KEY)) || null;

// Cihaz listesinde görünen ad: "iPhone · Safari", "Windows · Chrome". Kişisel bilgi içermez.
export function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Cihaz';
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return browser ? `${os} · ${browser}` : os;
}

function keyBytes(base64url) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

async function sendToServer(sub, config) {
  const json = sub.toJSON();
  const res = await client.put('/push/subscription', {
    endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, deviceLabel: deviceLabel(),
  });
  store.set(SUB_ID_KEY, String(res.data.id));
  store.set(SERVER_KEY, config.publicKey);
  return res.data.id;
}

// Sunucu anahtarı değiştiyse eski abonelik bırakılıp yenisi alınır.
async function ensureSubscription(config) {
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && store.get(SERVER_KEY) && store.get(SERVER_KEY) !== config.publicKey) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
  return sub;
}

// İzin ister ve abone olur. Dönüş: 'granted' | 'denied' | 'default' | 'unsupported' | 'disabled'.
export async function enablePush() {
  if (!pushSupported()) return 'unsupported';
  const config = await pushConfig();
  if (!config.enabled) return 'disabled';
  const result = await Notification.requestPermission();
  if (result !== 'granted') return result;
  const sub = await ensureSubscription(config);
  await sendToServer(sub, config);
  return 'granted';
}

// "Bu cihaz" kapatılınca: sunucudan ve tarayıcıdan aboneliği kaldırır.
export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await client.delete('/push/subscription', { data: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  store.del(SUB_ID_KEY);
}

// Uygulama açılınca ve profil değişince: izin verilmiş ve abonelik varsa, abonelik seçili profile bağlanır.
export async function syncPush() {
  if (permission() !== 'granted') return;
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    const config = await pushConfig();
    if (!config.enabled) return;
    await sendToServer(await ensureSubscription(config), config);
  } catch { /* bildirim eşitlemesi uygulamayı etkilemez */ }
}

// Çıkış: bu cihaza artık bildirim gitmesin. Tarayıcı aboneliği durur; yeniden girişte syncPush tekrar bağlar.
// Belirteç çıkışta silindiği için çağrı anında alınır.
export function detachForLogout() {
  const token = store.get(TOKEN_KEY);
  if (!token || !pushSupported()) return;
  currentSubscription().then((sub) => {
    if (!sub) return;
    return client.delete('/push/subscription', { data: { endpoint: sub.endpoint }, headers: { Authorization: `Bearer ${token}` } });
  }).catch(() => {});
  store.del(SUB_ID_KEY);
}

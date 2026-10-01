import axios from 'axios';
import { flushDeferred, hasDeferred } from './deferred';

export const TOKEN_KEY = 'token';
// Yenileme belirteci: kısa ömürlü erişim belirtecinin (TOKEN_KEY, ~15 dk) süresi dolunca yenisini almak için.
export const REFRESH_KEY = 'plantobee:refresh';
export const USER_KEY = 'plantobee:user';
// 'email' ve 'username' eski sürümden kalan anahtarlar; çıkışta onlar da temizlenir.
export const AUTH_KEYS = [TOKEN_KEY, REFRESH_KEY, USER_KEY, 'email', 'username'];
export const AUTH_EXPIRED_EVENT = 'plantobee:auth-expired';
// 403 email_not_verified / family_required / profile_required geldiğinde AuthContext durumu tazeler ve doğru ekrana yönlendirir.
export const ACCOUNT_STATE_EVENT = 'plantobee:account-state';

// localhost varsayılanı yalnızca geliştirmede (npm run dev) kullanılır. Üretim derlemesinde VITE_API_URL
// zorunludur (vite.config.js yoksa build'i durdurur); yine de boş kalırsa istek localhost'a değil,
// sitenin kendi /api yoluna gider ve hata olarak görünür. Baştaki/sondaki boşluk ve sondaki "/" temizlenir.
const API_URL = (
  import.meta.env.VITE_API_URL?.trim() || (import.meta.env.DEV ? 'http://localhost:5002/api' : '/api')
).replace(/\/+$/, '');

const client = axios.create({
  baseURL: API_URL,
});

client.interceptors.request.use(async (config) => {
  // Bekleyen geri alınabilir silme önce gönderilir; ardından gelen okuma silinen kaydı geri getirmesin.
  if (!config._deferred && hasDeferred()) await flushDeferred();
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Oturumsuz uç noktalar: buradaki 401 "oturum bitti" değil, işin kendi hatasıdır (ör. yanlış şifre).
const ANONYMOUS = [
  '/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/verify-email',
  '/auth/reset-password', '/auth/forgot-password', '/auth/resend-verification',
];

export function saveTokens(data) {
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yenileme belirteciyle yeni erişim belirteci alır. Aynı anda birden çok istek 401 alırsa tek yenileme yapılır.
let refreshing = null;
async function refreshSession() {
  const current = localStorage.getItem(REFRESH_KEY);
  if (!current) throw new Error('no_refresh_token');
  try {
    const r = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: current });
    saveTokens(r.data);
    return r.data.token;
  } catch (err) {
    // Başka bir sekme aynı belirteci az önce yeniledi: onun kaydedeceği yeni belirteci bekle.
    if (err.response?.data?.code === 'refresh_retry') {
      for (let i = 0; i < 20; i += 1) {
        await sleep(150);
        if (localStorage.getItem(REFRESH_KEY) !== current) return localStorage.getItem(TOKEN_KEY);
      }
    }
    throw err;
  }
}

function expireSession() {
  AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config ?? {};
    const url = config.url ?? '';
    const status = err.response?.status;
    const code = err.response?.data?.code;
    // Erişim belirtecinin süresi doldu (401): bir kez yenileyip isteği tekrarla; olmazsa oturumu kapat.
    // Kodu olan 401 cevapları (ör. yanlış şifre) işin kendi hatasıdır, oturum sonu sayılmaz.
    if (status === 401 && !code && !ANONYMOUS.includes(url) && localStorage.getItem(TOKEN_KEY)) {
      if (!config._retried && localStorage.getItem(REFRESH_KEY)) {
        try {
          refreshing ??= refreshSession().finally(() => { refreshing = null; });
          await refreshing;
          return client({ ...config, _retried: true });
        } catch {
          /* aşağıda oturum kapanır */
        }
      }
      expireSession();
    }
    if (status === 403 && (code === 'email_not_verified' || code === 'family_required' || code === 'profile_required')) {
      window.dispatchEvent(new CustomEvent(ACCOUNT_STATE_EVENT, { detail: code }));
    }
    return Promise.reject(err);
  },
);

export default client;

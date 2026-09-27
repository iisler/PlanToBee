import axios from 'axios';

export const TOKEN_KEY = 'token';
export const USER_KEY = 'plantobee:user';
// 'email' ve 'username' eski sürümden kalan anahtarlar; çıkışta onlar da temizlenir.
export const AUTH_KEYS = [TOKEN_KEY, USER_KEY, 'email', 'username'];
export const AUTH_EXPIRED_EVENT = 'plantobee:auth-expired';
// 403 email_not_verified / family_required geldiğinde AuthContext durumu tazeler ve doğru ekrana yönlendirir.
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

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url ?? '';
    const status = err.response?.status;
    const code = err.response?.data?.code;
    // Token geçersiz/süresi dolmuşsa (401) oturumu kapat; giriş ekranına dönülür.
    if (status === 401 && !url.startsWith('/auth/') && !url.startsWith('/invitations/')) {
      AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    if (status === 403 && (code === 'email_not_verified' || code === 'family_required')) {
      window.dispatchEvent(new CustomEvent(ACCOUNT_STATE_EVENT, { detail: code }));
    }
    return Promise.reject(err);
  },
);

export default client;

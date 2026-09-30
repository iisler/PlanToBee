import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import client, { ACCOUNT_STATE_EVENT, AUTH_EXPIRED_EVENT, AUTH_KEYS, REFRESH_KEY, TOKEN_KEY, USER_KEY, saveTokens } from '../api/client';
import { errorText } from '../api/errors';

const AuthContext = createContext(null);

// Kullanıcı nesnesi: { email, displayName, emailVerified, family: FamilySummary|null }
// emailVerified === undefined ise durum henüz sunucudan okunmadı demektir.
// Belirteçler kullanıcı nesnesinde değil, yalnızca localStorage'da tutulur (api/client.js onları yeniler).
function readStoredUser() {
  if (!localStorage.getItem(TOKEN_KEY)) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (cached) {
      delete cached.token; // eski sürümün önbelleğinde token da vardı
      return cached;
    }
  } catch { /* bozuk önbellek: sunucudan okunur */ }
  return { email: localStorage.getItem('email') || '', displayName: localStorage.getItem('username') || '' };
}

function storeUser(u) {
  if (!u) {
    AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);
  const [meError, setMeError] = useState('');

  const setUser = useCallback((next) => {
    setUserState((prev) => {
      const u = typeof next === 'function' ? next(prev) : next;
      storeUser(u);
      return u;
    });
  }, []);

  // AuthResponse (giriş, şifre sıfırlama, davet kabulü) ile oturumu açar.
  const applyAuth = useCallback((data) => {
    saveTokens(data);
    setUser({
      email: data.email,
      displayName: data.displayName ?? data.username,
      emailVerified: !!data.emailVerified,
      family: data.family ?? null,
    });
  }, [setUser]);

  const refreshMe = useCallback(async () => {
    try {
      const r = await client.get('/auth/me');
      setMeError('');
      setUser((u) => u && {
        ...u,
        email: r.data.email,
        displayName: r.data.displayName,
        emailVerified: !!r.data.emailVerified,
        family: r.data.family ?? null,
      });
      return r.data;
    } catch (err) {
      if (err?.response?.status === 401) setUser(null);
      else setMeError(errorText(err));
      throw err;
    }
  }, [setUser]);

  async function login(email, password) {
    const res = await client.post('/auth/login', { email, password });
    applyAuth(res.data);
    return res.data;
  }

  // Kayıt oturum açmaz: cevap, hesap zaten var olsa da aynıdır ("e-postana bağlantı gönderdik").
  async function register(email, password, displayName) {
    const res = await client.post('/auth/register', { email, password, displayName });
    return res.data;
  }

  // Bu cihazın yenileme belirteci sunucuda da iptal edilir; istek başarısız olsa da yerel oturum kapanır.
  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) client.post('/auth/logout', { refreshToken }).catch(() => {});
    setUser(null);
  }, [setUser]);

  // Açılışta doğrulama ve aile durumunu sunucudan tazele.
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) refreshMe().catch(() => { /* meError gösterilir */ });
  }, [refreshMe]);

  useEffect(() => {
    const onExpired = () => setUserState(null);
    const onState = (e) => {
      // Önce yerel durumu düzelt (yönlendirme hemen olsun), sonra sunucudan doğrula.
      if (e.detail === 'email_not_verified') setUser((u) => u && { ...u, emailVerified: false });
      if (e.detail === 'family_required') setUser((u) => u && { ...u, family: null });
      refreshMe().catch(() => {});
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener(ACCOUNT_STATE_EVENT, onState);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener(ACCOUNT_STATE_EVENT, onState);
    };
  }, [refreshMe, setUser]);

  return (
    <AuthContext.Provider value={{ user, meError, login, register, logout, applyAuth, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

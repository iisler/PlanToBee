import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import client, { ACCOUNT_STATE_EVENT, AUTH_EXPIRED_EVENT, AUTH_KEYS, TOKEN_KEY, USER_KEY } from '../api/client';
import { errorText } from '../api/errors';

const AuthContext = createContext(null);

// Kullanıcı nesnesi: { token, email, displayName, emailVerified, family: FamilySummary|null }
// emailVerified === undefined ise durum henüz sunucudan okunmadı demektir.
function readStoredUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (cached) return { ...cached, token };
  } catch { /* bozuk önbellek: sunucudan okunur */ }
  return { token, email: localStorage.getItem('email') || '', displayName: localStorage.getItem('username') || '' };
}

function storeUser(u) {
  if (!u) {
    AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
    return;
  }
  localStorage.setItem(TOKEN_KEY, u.token);
  const rest = { ...u };
  delete rest.token; // token ayrı anahtarda tutulur
  localStorage.setItem(USER_KEY, JSON.stringify(rest));
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

  // AuthResponse (giriş, kayıt, şifre sıfırlama, davet kabulü) ile oturumu açar.
  const applyAuth = useCallback((data) => {
    setUser({
      token: data.token,
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

  async function register(email, password, displayName) {
    const res = await client.post('/auth/register', { email, password, displayName });
    applyAuth(res.data);
    return res.data;
  }

  const logout = useCallback(() => setUser(null), [setUser]);

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

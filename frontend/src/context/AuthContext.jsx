import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import client, { ACCOUNT_STATE_EVENT, AUTH_EXPIRED_EVENT, AUTH_KEYS, REFRESH_KEY, TOKEN_KEY, USER_KEY, saveTokens } from '../api/client';
import { errorText } from '../api/errors';
import { detachForLogout, forgetDevice } from '../utils/push';

// Hesap silindikten sonra giriş ekranında bir kez gösterilen bilgi (sayfa yenilenince de kalır, okununca silinir).
export const ACCOUNT_DELETED_KEY = 'plantobee:account-deleted';

const AuthContext = createContext(null);

// Kullanıcı nesnesi: { email, displayName, emailVerified, family: { id, name }|null, profile: { id, displayName, role, isOwner }|null }
// emailVerified === undefined ise durum henüz sunucudan okunmadı demektir. profile, bu cihazda seçili profildir.
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
  // "Profil değiştir": seçili profil korunur, profil seçme ekranı açılır (Vazgeç ile geri dönülür).
  const [switching, setSwitching] = useState(false);

  const setUser = useCallback((next) => {
    setUserState((prev) => {
      const u = typeof next === 'function' ? next(prev) : next;
      storeUser(u);
      return u;
    });
  }, []);

  // AuthResponse (giriş, şifre sıfırlama, aile kurma, profil seçimi) ile oturumu açar.
  const applyAuth = useCallback((data) => {
    saveTokens(data);
    setSwitching(false);
    setUser({
      email: data.email,
      displayName: data.displayName ?? data.username,
      emailVerified: !!data.emailVerified,
      family: data.family ?? null,
      profile: data.profile ?? null,
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
        profile: r.data.profile ?? null,
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

  const startSwitch = useCallback(() => setSwitching(true), []);
  const cancelSwitch = useCallback(() => setSwitching(false), []);

  // Profil seçimi: PIN (ya da PIN'i olmayan ebeveyn için hesap şifresi + yeni PIN) ile. Yeni belirteçler bu profile
  // bağlıdır; uygulama yeniden açılınca aynı profille açılır.
  const selectProfile = useCallback(async (id, body = {}) => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const res = await client.post(`/profiles/${id}/select`, { ...body, refreshToken });
    applyAuth(res.data);
    return res.data;
  }, [applyAuth]);

  // Bu cihazın yenileme belirteci sunucuda da iptal edilir; istek başarısız olsa da yerel oturum kapanır.
  const logout = useCallback(() => {
    detachForLogout(); // bu cihaza artık bildirim gitmesin
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) client.post('/auth/logout', { refreshToken }).catch(() => {});
    setSwitching(false);
    setUser(null);
  }, [setUser]);

  // Hesap silindi (POST /account/delete 204): sunucuda oturumlar zaten yok; yalnızca bu cihaz temizlenir ve
  // giriş ekranında "Hesabın silindi" bilgisi gösterilir.
  const accountDeleted = useCallback(() => {
    forgetDevice();
    try { sessionStorage.setItem(ACCOUNT_DELETED_KEY, '1'); } catch { /* depolama kapalı: bilgi gösterilmez */ }
    setSwitching(false);
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
      if (e.detail === 'family_required') setUser((u) => u && { ...u, family: null, profile: null });
      if (e.detail === 'profile_required') setUser((u) => u && { ...u, profile: null });
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
    <AuthContext.Provider value={{
      user, meError, login, register, logout, accountDeleted, applyAuth, refreshMe, selectProfile,
      switching, startSwitch, cancelSwitch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

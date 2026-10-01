import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { accountStatus } from './context/accountStatus';
import { NoticeProvider } from './context/NoticeContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import VerifyPendingPage from './pages/VerifyPendingPage';
import CreateFamilyPage from './pages/CreateFamilyPage';
import ProfilePickerPage from './pages/ProfilePickerPage';
import PlanShell from './pages/PlanShell';
import AuthLayout from './components/AuthLayout';
import Loading from './components/Loading';

// Hesap durumuna göre doğru ekranı seçer: oturum yok → giriş, e-posta doğrulanmamış → doğrulama,
// aile yok → aile kurma, profil seçilmemiş (ya da "Profil değiştir") → "Kim kullanıyor?", aksi halde uygulama.
function Gate() {
  const { user, meError, refreshMe, logout, switching } = useAuth();
  const status = accountStatus(user);

  if (status === 'anon') return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  if (status === 'loading') return (
    <AuthLayout subtitle="Hesap bilgileri">
      {meError ? (
        <>
          <div className="auth-error" role="alert">{meError}</div>
          <button className="auth-submit" onClick={() => refreshMe().catch(() => {})}>Tekrar dene</button>
          <button className="auth-link" onClick={logout}>Çıkış yap</button>
        </>
      ) : <Loading />}
    </AuthLayout>
  );

  const screen = status === 'unverified' ? <VerifyPendingPage />
    : status === 'nofamily' ? <CreateFamilyPage />
    : status === 'noprofile' || switching ? <ProfilePickerPage />
    // Profil değişince ana ekran baştan kurulur (kayıt izleri ve yetkiler profile göre)
    : <PlanShell key={user.profile.id} />;

  return (
    <Routes>
      <Route path="/" element={screen} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* E-postadaki bağlantılar oturum durumundan bağımsız açılır */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="*" element={<Gate />} />
    </Routes>
  );
}

// Site bir alt yolda yayınlanıyorsa (GitHub Pages: /PlanToBee/app/) rotalar o yolun altında çözülür.
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <NoticeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </NoticeProvider>
    </BrowserRouter>
  );
}

import type { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ModulesPage from '../pages/ModulesPage';
import SettingsPage from '../pages/settings/SettingsPage';
import ProtectedRoute from './ProtectedRoute';
import { isAuthenticated } from '@/features/auth/hooks/useAuth';
import { MODULE_ORDER } from '../config/modules';

function LoginRoute() {
  const navigate = useNavigate();
  return (
    <LoginPage
      onRegister={() => navigate('/register')}
      onLoggedIn={() => navigate('/')}
    />
  );
}

function RegisterRoute() {
  const navigate = useNavigate();
  return <RegisterPage onLogin={() => navigate('/login')} />;
}

function AppRoute() {
  const navigate = useNavigate();
  return <ModulesPage onLogout={() => navigate('/login')} />;
}

/** Toàn bộ path của ứng dụng khai báo tại đây. Thêm route mới -> thêm <Route> vào trong <App />. */
export default function AppRouter(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route
            index
            element={
              <Navigate
                to={isAuthenticated() ? `/${MODULE_ORDER[0].slug}` : '/login'}
                replace
              />
            }
          />
          <Route path="login" element={<LoginRoute />} />
          <Route path="register" element={<RegisterRoute />} />
          <Route
            path="app"
            element={<Navigate to={`/${MODULE_ORDER[0].slug}`} replace />}
          />
          <Route
            path=":moduleSlug"
            element={
              <ProtectedRoute>
                <AppRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* Bắt mọi path không khớp, tránh màn hình trắng khi gõ sai URL */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

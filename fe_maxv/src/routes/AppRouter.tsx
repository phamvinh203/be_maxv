import type { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ModulesPage from '../pages/ModulesPage';
import SettingsPage from '../pages/settings/SettingsPage';
import SetupCompanyPage from '../pages/SetupCompanyPage';
import HangHoaPage from '../pages/ton_kho/HangHoaPage';
import DvtPage from '../pages/ton_kho/DvtPage';
import PhanNhomPage from '../pages/ton_kho/PhanNhomPage';
import MaGdPage from '../pages/ton_kho/MaGdPage';
import ProtectedRoute from './ProtectedRoute';
import RequireTenant from './RequireTenant';
import { isAuthenticated, getCurrentCompany } from '@/features/auth/hooks/useAuth';
import { MODULE_ORDER } from '../config/modules';

/** Chưa login -> /login; login nhưng chưa có công ty -> /setup-company; có công ty -> /:slug/:moduleSlug đầu tiên. */
function homePath(): string {
  if (!isAuthenticated()) return '/login';
  const company = getCurrentCompany();
  if (!company) return '/setup-company';
  return `/${company.slug}/${MODULE_ORDER[0].slug}`;
}

function LoginRoute() {
  const navigate = useNavigate();
  return (
    <LoginPage
      onRegister={() => navigate('/register')}
      onLoggedIn={() => navigate(homePath())}
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
          <Route index element={<Navigate to={homePath()} replace />} />
          <Route path="login" element={<LoginRoute />} />
          <Route path="register" element={<RegisterRoute />} />
          <Route
            path="setup-company"
            element={
              <ProtectedRoute>
                <SetupCompanyPage />
              </ProtectedRoute>
            }
          />
          {/* Trang danh mục hàng hóa (khai báo trước :moduleSlug để khớp path sâu hơn) */}
          <Route
            path=":slug/ton_kho/danh_muc/hang_hoa"
            element={
              <RequireTenant>
                <HangHoaPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ton_kho/danh_muc/dvt"
            element={
              <RequireTenant>
                <DvtPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ton_kho/danh_muc/phan_nhom"
            element={
              <RequireTenant>
                <PhanNhomPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ton_kho/danh_muc/ma_gd"
            element={
              <RequireTenant>
                <MaGdPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/:moduleSlug"
            element={
              <RequireTenant>
                <AppRoute />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/settings"
            element={
              <RequireTenant>
                <SettingsPage />
              </RequireTenant>
            }
          />
          {/* Bắt mọi path không khớp, tránh màn hình trắng khi gõ sai URL */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

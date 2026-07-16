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
import KhoPage from '../pages/ton_kho/KhoPage';
import NhomKhoPage from '../pages/ton_kho/NhomKhoPage';
import ViTriKhoPage from '../pages/ton_kho/ViTriKhoPage';
import LoaiVtPage from '../pages/ton_kho/LoaiVtPage';
import TienTePage from '../pages/tong_hop/TienTePage';
import TaiKhoanPage from '../pages/tong_hop/TaiKhoanPage';
import PhongBanPage from '../pages/tong_hop/PhongBanPage';
import DanhMucKHPage from '../pages/ban_hang/DanhMucKHPage';
import HoaDonBanHangPage from '../pages/ban_hang/HoaDonBanHangPage';
import ProtectedRoute from './ProtectedRoute';
import RequireTenant from './RequireTenant';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { defaultModulePath } from '../config/modules';

/** Đích khi đã đăng nhập: chưa có công ty -> /setup-company; có -> module đầu của MST đang chọn. */
function useHomePath(): string {
  const { company } = useAuth();
  return company ? defaultModulePath(company.slug) : '/setup-company';
}

/** Route "/" — ProtectedRoute lo phần chờ /auth/me và trường hợp chưa đăng nhập. */
function HomeRedirect() {
  const home = useHomePath();
  return (
    <ProtectedRoute>
      <Navigate to={home} replace />
    </ProtectedRoute>
  );
}

function LoginRoute() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const home = useHomePath();

  // KHÔNG chờ hydrating: form đăng nhập là tĩnh, không cần phiên. Khách chưa đăng nhập —
  // phần lớn người vào /login — thấy form ngay thay vì ngồi nhìn spinner hết 2 lượt gọi API.
  // Điều hướng khai báo: login xong -> AuthProvider set phiên -> render lại -> vào thẳng app.
  // (Không navigate() trong callback onSuccess: lúc đó state phiên mới chưa kịp flush.)
  if (isAuthenticated) return <Navigate to={home} replace />;
  return <LoginPage onRegister={() => navigate('/register')} />;
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
          <Route index element={<HomeRedirect />} />
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
            path=":slug/ton_kho/danh_muc/kho"
            element={
              <RequireTenant>
                <KhoPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ton_kho/danh_muc/nhom_kho"
            element={
              <RequireTenant>
                <NhomKhoPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ton_kho/danh_muc/vi_tri_kho"
            element={
              <RequireTenant>
                <ViTriKhoPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ton_kho/danh_muc/loai_vt"
            element={
              <RequireTenant>
                <LoaiVtPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/tong_hop/danh_muc/tai-khoan"
            element={
              <RequireTenant>
                <TaiKhoanPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/tong_hop/danh_muc/tien-te"
            element={
              <RequireTenant>
                <TienTePage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/tong_hop/danh_muc/phong-ban"
            element={
              <RequireTenant>
                <PhongBanPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ban-hang/dm/khach-hang"
            element={
              <RequireTenant>
                <DanhMucKHPage />
              </RequireTenant>
            }
          />
          <Route
            path=":slug/ban-hang/chung_tu/hoa-don-ban-hang"
            element={
              <RequireTenant>
                <HoaDonBanHangPage />
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

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "../App";
import AuthPage from "../pages/AuthPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import HomePage from "../pages/HomePage";
import SettingsPage from "../pages/settings/SettingsPage";
import HrmPage from "../pages/hrm/HrmPage";
import DashboardPage from "../pages/hrm/DashboardPage";
import DanhMucPage from "../pages/hrm/DanhMucPage";
import PhongBanPage from "../pages/hrm/PhongBanPage";
import NhanVienPage from "../pages/hrm/NhanVienPage";
import NguoiPhuThuocPage from "../pages/hrm/NguoiPhuThuocPage";
import CauHinhPage from "../pages/hrm/CauHinhPage";
import ThietLapChungPage from "../pages/hrm/ThietLapChungPage";
import LichNgayLePage from "../pages/hrm/LichNgayLePage";
import CaiDatLuongPage from "../pages/hrm/CaiDatLuongPage";
import DanhMucKhoanLuongPage from "../pages/hrm/DanhMucKhoanLuongPage";
import SetLuongPage from "../pages/hrm/SetLuongPage";
import DuLieuLuongPage from "../pages/hrm/DuLieuLuongPage";
import ChamCongPage from "../pages/hrm/ChamCongPage";
import DuLieuLuongChuaDungPage from "../pages/hrm/DuLieuLuongChuaDungPage";
import ProtectedRoute from "./ProtectedRoute";
import ModuleRoute from "./ModuleRoute";
import FullScreenLoader from "../components/FullScreenLoader";
import { useAuth } from "../features/auth/useAuth";
import type { ReactNode } from "react";

/** Route chỉ dành cho khách (login/register) — đã đăng nhập thì tự chuyển về trang chính. */
function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, hydrating } = useAuth();
  // Chờ khôi phục phiên xong rồi mới quyết — tránh lộ form đăng nhập khi thực ra đã đăng nhập.
  if (hydrating) return <FullScreenLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Toàn bộ path của ứng dụng khai báo tại đây. */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route
            path="login"
            element={
              <GuestOnlyRoute>
                <AuthPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="register"
            element={
              <GuestOnlyRoute>
                <RegisterPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="forgot-password"
            element={
              <GuestOnlyRoute>
                <ForgotPasswordPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            index
            element={
              <ProtectedRoute>
                <HomePage />
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

          {/*
            Khu HRM dùng route con thay vì tab state như SettingsPage: đây là
            cụm màn hình, cần gửi link tới đúng màn hình và F5 giữ nguyên vị trí.
          */}
          <Route
            path="hrm"
            element={
              <ProtectedRoute>
                <ModuleRoute module="hrm">
                  <HrmPage />
                </ModuleRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="danh-muc" element={<DanhMucPage />}>
              <Route index element={<Navigate to="phong-ban" replace />} />
              <Route path="phong-ban" element={<PhongBanPage />} />
              <Route path="nhan-vien" element={<NhanVienPage />} />
              <Route path="nguoi-phu-thuoc" element={<NguoiPhuThuocPage />} />
            </Route>
            <Route path="cau-hinh" element={<CauHinhPage />}>
              <Route index element={<Navigate to="thiet-lap-chung" replace />} />
              <Route path="thiet-lap-chung" element={<ThietLapChungPage />} />
              <Route path="lich-ngay-le" element={<LichNgayLePage />} />
            </Route>
            <Route path="cai-dat-luong" element={<CaiDatLuongPage />}>
              <Route index element={<Navigate to="danh-muc-khoan" replace />} />
              <Route path="danh-muc-khoan" element={<DanhMucKhoanLuongPage />} />
              <Route path="set-luong" element={<SetLuongPage />} />
            </Route>
            <Route path="du-lieu-luong" element={<DuLieuLuongPage />}>
              <Route index element={<Navigate to="cham-cong" replace />} />
              <Route path="cham-cong" element={<ChamCongPage />} />
              {/* Bảy màn hình còn lại chưa có mô tả nội dung — dùng chung chỗ giữ. */}
              <Route path="tang-ca" element={<DuLieuLuongChuaDungPage />} />
              <Route path="kpi" element={<DuLieuLuongChuaDungPage />} />
              <Route path="thuong" element={<DuLieuLuongChuaDungPage />} />
              <Route path="luong-san-pham" element={<DuLieuLuongChuaDungPage />} />
              <Route path="luong-phan-tram" element={<DuLieuLuongChuaDungPage />} />
              <Route path="luong-chuyen-can" element={<DuLieuLuongChuaDungPage />} />
              <Route path="ung-bu-tru" element={<DuLieuLuongChuaDungPage />} />
            </Route>
          </Route>
          {/* Bắt mọi path không khớp, tránh màn hình trắng khi gõ sai URL */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

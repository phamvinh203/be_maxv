import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "../App";
import AuthPage from "../pages/AuthPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import HomePage from "../pages/HomePage";
import SettingsPage from "../pages/settings/SettingsPage";
import DvcPage from "../pages/dich_vu_cong/DvcPage";
import ToKhai from "../pages/to_khai/ToKhai";
import AccountingModulesPage from "../pages/accounting/ModulesPage";
import { defaultModulePath as defaultAccountingPath } from "../features/accounting/_shared/config";
import KeToanDanhMucKHPage from "../pages/accounting/ban_hang/DanhMucKHPage";
import KeToanHoaDonBanHangPage from "../pages/accounting/ban_hang/HoaDonBanHangPage";
import KeToanPhongBanPage from "../pages/accounting/tong_hop/PhongBanPage";
import KeToanTaiKhoanPage from "../pages/accounting/tong_hop/TaiKhoanPage";
import KeToanTienTePage from "../pages/accounting/tong_hop/TienTePage";
import KeToanDvtPage from "../pages/accounting/ton_kho/DvtPage";
import KeToanHangHoaPage from "../pages/accounting/ton_kho/HangHoaPage";
import KeToanKhoPage from "../pages/accounting/ton_kho/KhoPage";
import KeToanLoaiVtPage from "../pages/accounting/ton_kho/LoaiVtPage";
import KeToanMaGdPage from "../pages/accounting/ton_kho/MaGdPage";
import KeToanNhomKhoPage from "../pages/accounting/ton_kho/NhomKhoPage";
import KeToanPhanNhomPage from "../pages/accounting/ton_kho/PhanNhomPage";
import KeToanViTriKhoPage from "../pages/accounting/ton_kho/ViTriKhoPage";
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
import TangCaPage from "../pages/hrm/TangCaPage";
import KpiPage from "../pages/hrm/KpiPage";
import ThuongPage from "../pages/hrm/ThuongPage";
import LuongSanPhamPage from "../pages/hrm/LuongSanPhamPage";
import LuongPhanTramPage from "../pages/hrm/LuongPhanTramPage";
import LuongChuyenCanPage from "../pages/hrm/LuongChuyenCanPage";
import UngBuTruPage from "../pages/hrm/UngBuTruPage";
import BangLuongPage from "../pages/hrm/BangLuongPage";
import BangLuongKyPage from "../pages/hrm/BangLuongKyPage";
import LuongHoTroPage from "../pages/hrm/LuongHoTroPage";
import ToKhaiThuePage from "../pages/hrm/ToKhaiThuePage";
import ToKhaiThueChuaDungPage from "../pages/hrm/ToKhaiThueChuaDungPage";
import HoSoLuongPage from "../pages/hrm/HoSoLuongPage";
import HoSoLuongChuaDungPage from "../pages/hrm/HoSoLuongChuaDungPage";
import { MAN_HINH_HO_SO_LUONG } from "../features/hrm/components/ho_so_luong/tabs";
import ProtectedRoute from "./ProtectedRoute";
import ModuleRoute from "./ModuleRoute";
import FullScreenLoader from "../components/FullScreenLoader";
import { useAuth } from "../features/auth/useAuth";
import type { ComponentType, ReactNode } from "react";

/**
 * Trang danh mục/chứng từ Kế toán đã dựng — path khớp đúng `path` khai báo
 * trong `_shared/config/*.tsx` (bỏ dấu `/` đầu). Sinh route từ bảng thay vì
 * chép tay từng khối gần giống nhau, cùng cách khu HRM làm với `ho-so-luong`.
 */
const ACCOUNTING_BUILT_ROUTES: { path: string; Page: ComponentType }[] = [
  { path: "ban-hang/dm/khach-hang", Page: KeToanDanhMucKHPage },
  { path: "ban-hang/chung_tu/hoa-don-ban-hang", Page: KeToanHoaDonBanHangPage },
  { path: "tong_hop/danh_muc/phong-ban", Page: KeToanPhongBanPage },
  { path: "tong_hop/danh_muc/tai-khoan", Page: KeToanTaiKhoanPage },
  { path: "tong_hop/danh_muc/tien-te", Page: KeToanTienTePage },
  { path: "ton_kho/danh_muc/hang_hoa", Page: KeToanHangHoaPage },
  { path: "ton_kho/danh_muc/dvt", Page: KeToanDvtPage },
  { path: "ton_kho/danh_muc/kho", Page: KeToanKhoPage },
  { path: "ton_kho/danh_muc/nhom_kho", Page: KeToanNhomKhoPage },
  { path: "ton_kho/danh_muc/vi_tri_kho", Page: KeToanViTriKhoPage },
  { path: "ton_kho/danh_muc/ma_gd", Page: KeToanMaGdPage },
  { path: "ton_kho/danh_muc/loai_vt", Page: KeToanLoaiVtPage },
  { path: "ton_kho/danh_muc/phan_nhom", Page: KeToanPhanNhomPage },
];

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
          {/* Giữ `/` làm lối vào — mọi chỗ Navigate to="/" sẵn có vẫn chạy. */}
          <Route index element={<Navigate to="/hoa-don-dien-tu" replace />} />
          <Route
            path="hoa-don-dien-tu"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="to-khai"
            element={
              <ProtectedRoute>
                <ModuleRoute module="tokhai">
                  <ToKhai />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="dich-vu-cong"
            element={
              <ProtectedRoute>
                <ModuleRoute module="dvc">
                  <DvcPage />
                </ModuleRoute>
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
          <Route
            path="accounting"
            element={
              <ProtectedRoute>
                <ModuleRoute module="accounting">
                  <Navigate to={defaultAccountingPath()} replace />
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          {/* Trang danh mục/chứng từ đã dựng (khai báo trước :moduleSlug để khớp path sâu hơn) */}
          {ACCOUNTING_BUILT_ROUTES.map(({ path, Page }) => (
            <Route
              key={path}
              path={`accounting/${path}`}
              element={
                <ProtectedRoute>
                  <ModuleRoute module="accounting">
                    <Page />
                  </ModuleRoute>
                </ProtectedRoute>
              }
            />
          ))}
          <Route
            path="accounting/:moduleSlug"
            element={
              <ProtectedRoute>
                <ModuleRoute module="accounting">
                  <AccountingModulesPage />
                </ModuleRoute>
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
              <Route
                index
                element={<Navigate to="thiet-lap-chung" replace />}
              />
              <Route path="thiet-lap-chung" element={<ThietLapChungPage />} />
              <Route path="lich-ngay-le" element={<LichNgayLePage />} />
            </Route>
            <Route path="cai-dat-luong" element={<CaiDatLuongPage />}>
              <Route index element={<Navigate to="danh-muc-khoan" replace />} />
              <Route
                path="danh-muc-khoan"
                element={<DanhMucKhoanLuongPage />}
              />
              <Route path="set-luong" element={<SetLuongPage />} />
            </Route>
            <Route path="du-lieu-luong" element={<DuLieuLuongPage />}>
              <Route index element={<Navigate to="cham-cong" replace />} />
              <Route path="cham-cong" element={<ChamCongPage />} />
              <Route path="tang-ca" element={<TangCaPage />} />
              <Route path="kpi" element={<KpiPage />} />
              <Route path="thuong" element={<ThuongPage />} />
              <Route path="luong-san-pham" element={<LuongSanPhamPage />} />
              <Route path="luong-phan-tram" element={<LuongPhanTramPage />} />
              <Route path="luong-chuyen-can" element={<LuongChuyenCanPage />} />
              <Route path="ung-bu-tru" element={<UngBuTruPage />} />
            </Route>
            <Route path="bang-luong" element={<BangLuongPage />}>
              <Route index element={<Navigate to="bang-luong" replace />} />
              <Route path="bang-luong" element={<BangLuongKyPage />} />
              <Route path="luong-ho-tro" element={<LuongHoTroPage />} />
            </Route>
            {/* Năm màn hình chưa dựng — dùng chung chỗ giữ, xem `to_khai_thue/tabs.ts`. */}
            <Route path="to-khai-thue" element={<ToKhaiThuePage />}>
              <Route
                index
                element={<Navigate to="thu-nhap-ngoai-luong" replace />}
              />
              <Route
                path="thu-nhap-ngoai-luong"
                element={<ToKhaiThueChuaDungPage />}
              />
              <Route
                path="bang-tinh-thue"
                element={<ToKhaiThueChuaDungPage />}
              />
              <Route path="to-khai-tncn" element={<ToKhaiThueChuaDungPage />} />
              <Route
                path="to-khai-quyet-toan"
                element={<ToKhaiThueChuaDungPage />}
              />
              <Route
                path="doi-soat-cong-thuc"
                element={<ToKhaiThueChuaDungPage />}
              />
            </Route>
            {/*
              Mười bốn màn hình chưa dựng, sinh route thẳng từ bảng tab thay vì
              liệt kê tay: chép mười bốn dòng gần giống nhau thì kiểu gì cũng có
              một path gõ sai, mà sai path nghĩa là tab bấm vào ra trang trắng.
            */}
            <Route path="ho-so-luong" element={<HoSoLuongPage />}>
              <Route
                index
                element={
                  <Navigate to={MAN_HINH_HO_SO_LUONG[0]!.path} replace />
                }
              />
              {MAN_HINH_HO_SO_LUONG.map((mh) => (
                <Route
                  key={mh.path}
                  path={mh.path}
                  element={<HoSoLuongChuaDungPage />}
                />
              ))}
            </Route>
          </Route>
          {/* Bắt mọi path không khớp, tránh màn hình trắng khi gõ sai URL */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "../App";
import { AccountingErrorBoundary } from "../components/Accounting/AccountingErrorBoundary";
import { defaultModulePath as defaultAccountingPath } from "../features/accounting/_shared/config";
import { MAN_HINH_HO_SO_LUONG } from "../features/hrm/components/ho_so_luong/tabs";
import { MAN_HINH_TO_KHAI_THUE } from "../features/hrm/components/to_khai_thue/tabs";
import ProtectedRoute from "./ProtectedRoute";
import ModuleRoute from "./ModuleRoute";
import FullScreenLoader from "../components/FullScreenLoader";
import { useAuth } from "../features/auth/useAuth";
import type { ComponentType, ReactNode } from "react";

/**
 * RVW-C03 / NB-2: mọi page cấp route nạp theo yêu cầu (`React.lazy`) thay vì import tĩnh — trước
 * đây 55 import tĩnh gộp hết vào 1 bundle 2,68 MB (đo trên `dist/`), riêng cây HRM (192
 * file/34.465 dòng) đã chiếm phần lớn. `<Suspense>` quanh `<Routes>` bên dưới hiện
 * `FullScreenLoader` trong lúc chờ chunk của route đang vào tải xong.
 */
const AuthPage = lazy(() => import("../pages/AuthPage"));
const RegisterPage = lazy(() => import("../pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const HomePage = lazy(() => import("../pages/HomePage"));
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage"));
const DvcPage = lazy(() => import("../pages/dich_vu_cong/DvcPage"));
const ToKhai = lazy(() => import("../pages/to_khai/ToKhai"));
const AccountingModulesPage = lazy(() => import("../pages/accounting/ModulesPage"));
const KeToanDanhMucKHPage = lazy(() => import("../pages/accounting/ban_hang/DanhMucKHPage"));
const KeToanHoaDonBanHangPage = lazy(() => import("../pages/accounting/ban_hang/HoaDonBanHangPage"));
const KeToanPhongBanPage = lazy(() => import("../pages/accounting/tong_hop/PhongBanPage"));
const KeToanTaiKhoanPage = lazy(() => import("../pages/accounting/tong_hop/TaiKhoanPage"));
const KeToanTienTePage = lazy(() => import("../pages/accounting/tong_hop/TienTePage"));
const KeToanDvtPage = lazy(() => import("../pages/accounting/ton_kho/DvtPage"));
const KeToanHangHoaPage = lazy(() => import("../pages/accounting/ton_kho/HangHoaPage"));
const KeToanKhoPage = lazy(() => import("../pages/accounting/ton_kho/KhoPage"));
const KeToanLoaiVtPage = lazy(() => import("../pages/accounting/ton_kho/LoaiVtPage"));
const KeToanMaGdPage = lazy(() => import("../pages/accounting/ton_kho/MaGdPage"));
const KeToanNhomKhoPage = lazy(() => import("../pages/accounting/ton_kho/NhomKhoPage"));
const KeToanPhanNhomPage = lazy(() => import("../pages/accounting/ton_kho/PhanNhomPage"));
const KeToanViTriKhoPage = lazy(() => import("../pages/accounting/ton_kho/ViTriKhoPage"));
const HrmPage = lazy(() => import("../pages/hrm/HrmPage"));
const DashboardPage = lazy(() => import("../pages/hrm/DashboardPage"));
const DanhMucPage = lazy(() => import("../pages/hrm/du_lieu_nhan_vien/DanhMucPage"));
const PhongBanPage = lazy(() => import("../pages/hrm/du_lieu_nhan_vien/PhongBanPage"));
const NhanVienPage = lazy(() => import("../pages/hrm/du_lieu_nhan_vien/NhanVienPage"));
const NguoiPhuThuocPage = lazy(() => import("../pages/hrm/du_lieu_nhan_vien/NguoiPhuThuocPage"));
const CauHinhPage = lazy(() => import("../pages/hrm/cau_hinh_mac_dinh/CauHinhPage"));
const ThietLapChungPage = lazy(() => import("../pages/hrm/cau_hinh_mac_dinh/ThietLapChungPage"));
const LichNgayLePage = lazy(() => import("../pages/hrm/cau_hinh_mac_dinh/LichNgayLePage"));
const CaiDatLuongPage = lazy(() => import("../pages/hrm/cai_dat_luong/CaiDatLuongPage"));
const DanhMucKhoanLuongPage = lazy(() => import("../pages/hrm/cai_dat_luong/DanhMucKhoanLuongPage"));
const SetLuongPage = lazy(() => import("../pages/hrm/cai_dat_luong/SetLuongPage"));
const DuLieuLuongPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/DuLieuLuongPage"));
const ChamCongPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/ChamCongPage"));
const TangCaPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/TangCaPage"));
const KpiPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/KpiPage"));
const ThuongPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/ThuongPage"));
const LuongSanPhamPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/LuongSanPhamPage"));
const LuongPhanTramPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/LuongPhanTramPage"));
const LuongChuyenCanPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/LuongChuyenCanPage"));
const UngBuTruPage = lazy(() => import("../pages/hrm/du_lieu_tinh_luong/UngBuTruPage"));
const BangLuongPage = lazy(() => import("../pages/hrm/bang_luong/BangLuongPage"));
const BangLuongKyPage = lazy(() => import("../pages/hrm/bang_luong/BangLuongKyPage"));
const LuongHoTroPage = lazy(() => import("../pages/hrm/bang_luong/LuongHoTroPage"));
const ChotKyLuongPage = lazy(() => import("../pages/hrm/chot_ky_luong/ChotKyLuongPage"));
const ToKhaiThuePage = lazy(() => import("../pages/hrm/to_khai_thue/ToKhaiThuePage"));
const ToKhaiThueChuaDungPage = lazy(() => import("../pages/hrm/to_khai_thue/ToKhaiThueChuaDungPage"));
const HoSoLuongPage = lazy(() => import("../pages/hrm/ho_so_luong/HoSoLuongPage"));
const HoSoLuongChuaDungPage = lazy(() => import("../pages/hrm/ho_so_luong/HoSoLuongChuaDungPage"));

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

/**
 * RVW-N11: path của module Kế toán khai ở 2 nơi (`ACCOUNTING_BUILT_ROUTES` trên vs
 * `_shared/config/*.tsx`) — lệch 1 ký tự giữa 2 bảng là menu đang bấm bỗng im lặng bắn
 * về trang chủ qua route "*" dưới đây. Gộp `ModuleConfig` thành nguồn path DUY NHẤT (sinh
 * route từ `MODULES` thay vì mảng tay) là fix triệt để nhưng đụng cả cách `ACCOUNTING_BUILT_ROUTES`
 * lẫn cấu trúc `ModuleConfig` hiện tại — rủi ro/lan rộng hơn mức 1 finding non-blocking. Hạ
 * mức xử lý: log rõ path lệch (dev-only) ngay khi catch-all bắt được, để phát hiện sớm
 * thay vì chỉ thấy "bỗng dưng về trang chủ" không rõ vì sao.
 */
function NotFoundRedirect() {
  if (import.meta.env.DEV) {
    console.warn(
      `[AppRouter] Không khớp route nào: "${window.location.pathname}" — kiểm tra path có đúng ` +
        'với ACCOUNTING_BUILT_ROUTES (AppRouter.tsx) và _shared/config/*.tsx không (RVW-N11).',
    );
  }
  return <Navigate to="/" replace />;
}

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
      <Suspense fallback={<FullScreenLoader />}>
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
                    <AccountingErrorBoundary>
                      <Page />
                    </AccountingErrorBoundary>
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
                  <AccountingErrorBoundary>
                    <AccountingModulesPage />
                  </AccountingErrorBoundary>
                </ModuleRoute>
              </ProtectedRoute>
            }
          />
          /*
            Khu HRM dùng route con thay vì tab state như SettingsPage: đây là
            cụm màn hình, cần gửi link tới đúng màn hình và F5 giữ nguyên vị trí.
          */
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
            {/* Không phải tab của thanh HRM — mở từ nút "Chốt kỳ lương" ở góc phải thanh đó. */}
            <Route path="chot-ky-luong" element={<ChotKyLuongPage />} />
            {/* NB-4: route sinh từ MAN_HINH_TO_KHAI_THUE (cùng cách khu `ho-so-luong` làm) thay
                vì khai tay từng dòng — trước đây nav (đọc từ bảng) và route (khai tay) là 2 nguồn
                riêng, thêm/sửa 1 tab ở bảng mà quên sửa route là tab hiện ra nhưng bấm vào bị đá
                khỏi HRM (catch-all "*" -> Navigate "/"). */}
            <Route path="to-khai-thue" element={<ToKhaiThuePage />}>
              <Route
                index
                element={
                  <Navigate to={MAN_HINH_TO_KHAI_THUE[0]!.path} replace />
                }
              />
              {MAN_HINH_TO_KHAI_THUE.map((mh) => (
                <Route
                  key={mh.path}
                  path={mh.path}
                  element={
                    <ToKhaiThueChuaDungPage ten={mh.label} moTa={mh.moTa} />
                  }
                />
              ))}
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
                  element={
                    <HoSoLuongChuaDungPage ten={mh.label} moTa={mh.moTa} />
                  }
                />
              ))}
            </Route>
          </Route>
          {/* Bắt mọi path không khớp, tránh màn hình trắng khi gõ sai URL */}
          <Route path="*" element={<NotFoundRedirect />} />
        </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

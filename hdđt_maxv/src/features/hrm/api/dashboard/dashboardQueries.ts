/**
 * Hook dữ liệu của tab Dashboard — CHỈ ĐỌC, chạy trên API thật (thay `mock/hooks/tongQuan.ts`).
 *
 * Không có endpoint tổng hợp riêng: Dashboard ghép lại đúng các truy vấn mà các màn khác đang dùng
 * (cùng `queryKey` + cùng hàm tải), nên mở Dashboard sau khi đã xem Bảng lương / Nhân viên không
 * tốn thêm request, và sửa dữ liệu ở màn kia thì số ở đây đổi theo khi cache được làm mới.
 *
 * QUYỀN XEM LƯƠNG: cả nhóm `/payroll-*` trả 403 cho người không được cấp (`dbCoQuyenLuongPayroll`,
 * BR-hrm-059). Phần nhân sự (sinh nhật, hợp đồng, cơ cấu) không dính lương nên ai cũng xem được;
 * phần lương đợi `useQuyenXemLuong` kết luận rồi mới gọi — xem `useKyLuongDashboard`.
 */

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";
import { getErrorMessage } from "@/lib/errors";
import {
  chiPhiTheoPhongBan,
  chonKyTheoDoi,
  hopDongSapKetThuc,
  khungSauThang,
  kyChoPheDuyet,
  kyNenTrinh,
  sinhNhatTrongThang,
  tinhTinhHinhNhanSu,
  tongHopTangCa,
  tongKyLuong,
  type DongChiPhiPhongBan,
  type DongHopDongSapHet,
  type DongSinhNhat,
  type TinhHinhNhanSu,
  type TongHopTangCa,
  type TongKyLuong,
} from "../../calculations/dashboard/tongQuan";
import {
  kyCuaThang,
  luiThang,
  thangCua,
  thangCuaKy,
  type ThangNam,
} from "../../_shared/thangKyLuong";
import { useDanhSachNhanVien } from "../du_lieu_nhan_vien/nhanVienQueries";
import {
  payrollSheetLinesOptions,
  usePayrollSheetLinesQuery,
} from "../du_lieu_tinh_luong/payrollCalculationQueries";
import { useOvertimeList } from "../du_lieu_tinh_luong/payrollInputsQueries";
import {
  useDanhSachKyLuongTheoQuyen,
  type PayrollPeriodApiItem,
} from "../du_lieu_tinh_luong/payrollPeriodsQueries";

// Lỗi đọc thẳng `message` của BE: 403 thiếu quyền lương đã mang đúng câu E-hrm-058
// (`LOI_KHONG_CO_QUYEN_LUONG`), không cần — và không được — tự đổi mọi 403 thành câu đó.

// ─────────────────────────────── Nhân sự ───────────────────────────────

export interface NhanSuDashboard {
  isLoading: boolean;
  loi: string | null;
  tinhHinh: TinhHinhNhanSu;
  sinhNhat: DongSinhNhat[];
  hopDongSapHet: DongHopDongSapHet[];
}

export function useNhanSuDashboard(homNay: string): NhanSuDashboard {
  const { data, isLoading, isError, error } = useDanhSachNhanVien();

  return useMemo(() => {
    const rows = data ?? [];
    return {
      isLoading,
      loi: isError ? getErrorMessage(error, "Không tải được danh sách nhân viên.") : null,
      tinhHinh: tinhTinhHinhNhanSu(rows, homNay),
      sinhNhat: sinhNhatTrongThang(rows, homNay),
      hopDongSapHet: hopDongSapKetThuc(rows, homNay),
    };
  }, [data, isLoading, isError, error, homNay]);
}

// ─────────────────────────────── Kỳ lương ───────────────────────────────

export interface KyLuongDashboard {
  /** Chắc chắn KHÔNG có quyền xem lương — ẩn mọi khối lương, không gọi API nào của nhóm lương. */
  biTuChoi: boolean;
  isLoading: boolean;
  loi: string | null;
  periods: PayrollPeriodApiItem[];
  /** Kỳ của tháng này — `null` khi chưa tạo. */
  kyThangNay: PayrollPeriodApiItem | null;
  /** Kỳ dùng cho chi phí phòng ban và tăng ca: kỳ tháng này, chưa có thì kỳ mới nhất. */
  kyTheoDoi: PayrollPeriodApiItem | null;
  /** Kỳ liền trước `kyTheoDoi` — mốc so sánh. */
  kyTruoc: PayrollPeriodApiItem | null;
  kyNenTrinh: PayrollPeriodApiItem | null;
  choPheDuyet: PayrollPeriodApiItem[];
  khungXuHuong: ThangNam[];
}

export function useKyLuongDashboard(homNay: string): KyLuongDashboard {
  // Cùng hook (cùng cổng quyền, cùng khóa cache) với góc chọn kỳ trên thanh HRM.
  const { periods, isLoading, isError, error, biTuChoi } = useDanhSachKyLuongTheoQuyen();

  return useMemo(() => {
    const kyTheoDoi = chonKyTheoDoi(periods, homNay);
    return {
      biTuChoi,
      isLoading,
      loi: isError ? getErrorMessage(error, "Không tải được danh sách kỳ lương.") : null,
      periods,
      kyThangNay: kyCuaThang(periods, thangCua(homNay)),
      kyTheoDoi,
      kyTruoc: kyTheoDoi ? kyCuaThang(periods, luiThang(thangCuaKy(kyTheoDoi))) : null,
      kyNenTrinh: kyNenTrinh(periods, homNay),
      choPheDuyet: kyChoPheDuyet(periods),
      khungXuHuong: khungSauThang(periods, homNay),
    };
  }, [periods, isLoading, isError, error, homNay, biTuChoi]);
}

// ─────────────────────────────── Bảng lương ───────────────────────────────

export interface DiemXuHuongLuong extends ThangNam {
  ky: PayrollPeriodApiItem | null;
  /** `null` khi tháng này chưa có kỳ, hoặc đang tải / tải hỏng. */
  tong: TongKyLuong | null;
  loi: string | null;
}

/**
 * Tổng bảng lương của từng tháng trong khung 6 tháng — một `GET /payroll/sheet-lines` cho mỗi kỳ
 * đang có (kỳ đã khóa đọc snapshot, kỳ nháp tính live — đúng như màn Bảng lương hiển thị).
 *
 * Dùng CHUNG `payrollSheetLinesOptions` với `usePayrollSheetLinesQuery` nên chung mục cache với màn
 * Bảng lương; `useQueries` vì số kỳ thay đổi, không gọi hook kia trong vòng lặp được.
 */
export function useXuHuongLuong(
  periods: PayrollPeriodApiItem[],
  khung: ThangNam[],
): { diem: DiemXuHuongLuong[]; isLoading: boolean } {
  const { currentCompanyId, isAuthenticated } = useAuth();
  const kyTheoThang = khung.map((t) => kyCuaThang(periods, t));
  const coKy = kyTheoThang.filter((ky): ky is PayrollPeriodApiItem => ky !== null);

  const ketQua = useQueries({
    queries: coKy.map((ky) => payrollSheetLinesOptions(currentCompanyId, ky.id, isAuthenticated)),
  });

  const theoId = new Map(coKy.map((ky, i) => [ky.id, ketQua[i]]));
  const diem = khung.map((t, i) => {
    const ky = kyTheoThang[i] ?? null;
    const kq = ky ? theoId.get(ky.id) : undefined;
    return {
      ...t,
      ky,
      tong: kq?.data ? tongKyLuong(kq.data) : null,
      loi: kq?.isError ? getErrorMessage(kq.error, "Không tính được bảng lương.") : null,
    };
  });

  return { diem, isLoading: ketQua.some((kq) => kq.isLoading) };
}

export interface ChiPhiPhongBanDashboard {
  rows: DongChiPhiPhongBan[];
  tong: TongKyLuong;
  isLoading: boolean;
  loi: string | null;
}

export function useChiPhiPhongBan(ky: PayrollPeriodApiItem | null): ChiPhiPhongBanDashboard {
  const { data, isLoading, isError, error } = usePayrollSheetLinesQuery(ky?.id ?? null);
  return useMemo(
    () => ({
      rows: chiPhiTheoPhongBan(data ?? []),
      tong: tongKyLuong(data ?? []),
      isLoading,
      loi: isError ? getErrorMessage(error, "Không tải được bảng lương của kỳ.") : null,
    }),
    [data, isLoading, isError, error],
  );
}

// ─────────────────────────────── Tăng ca ───────────────────────────────

export interface TangCaDashboard {
  hienTai: TongHopTangCa;
  /** Tổng giờ của kỳ liền trước — `null` khi không có kỳ đó hoặc chưa tải xong. */
  tongGioKyTruoc: number | null;
  isLoading: boolean;
  loi: string | null;
}

export function useTangCaDashboard(
  ky: PayrollPeriodApiItem | null,
  kyTruoc: PayrollPeriodApiItem | null,
): TangCaDashboard {
  const hienTai = useOvertimeList({ periodId: ky?.id ?? "" });
  const truoc = useOvertimeList({ periodId: kyTruoc?.id ?? "" });

  return useMemo(
    () => ({
      hienTai: tongHopTangCa(hienTai.data ?? []),
      tongGioKyTruoc: truoc.data ? tongHopTangCa(truoc.data).tongGio : null,
      isLoading: hienTai.isLoading,
      loi: hienTai.isError
        ? getErrorMessage(hienTai.error, "Không tải được dữ liệu tăng ca.")
        : null,
    }),
    [hienTai.data, hienTai.isLoading, hienTai.isError, hienTai.error, truoc.data],
  );
}

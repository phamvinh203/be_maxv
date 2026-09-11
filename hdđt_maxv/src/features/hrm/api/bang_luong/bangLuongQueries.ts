/**
 * Adapter API thật cho khu "Bảng lương" (`components/bang_luong/*`, `pages/hrm/bang_luong/*`) —
 * thay hẳn `mock/hooks/bangLuong.ts` (đã xóa 2026-09-10). Mọi phép tính lương/thuế/bảo hiểm giờ
 * nằm ở `be_maxv` (`payrollCalculation.service.ts`, xem ADR-010) — file này CHỈ gom dữ liệu +
 * đổi tên trường, KHÔNG tính lại bất kỳ con số nào.
 *
 * Nguồn: `api/du_lieu_tinh_luong/payrollCalculationQueries.ts` — tab "Bảng lương" đọc
 * `GET /payroll/sheet-lines` (tự chuyển live/snapshot theo trạng thái kỳ, ĐÚNG nguyên tắc "khóa sổ
 * = snapshot bất biến"), tab "Lương hỗ trợ" đọc `GET /payroll/support-allowances` (LUÔN tính live,
 * chưa có snapshot — xem cảnh báo ở `useLuongHoTroRows`). Kỳ lương lấy từ `PayrollPeriodContext`
 * (`components/du_lieu_tinh_luong/PayrollPeriodContext.tsx`) — MỘT provider bọc cả khu HRM ở
 * `HrmPage`, chọn qua ô tháng ở góc phải thanh HRM — KHÔNG dựng cơ chế chọn kỳ riêng cho "Bảng lương".
 *
 * HAI CẠM BẪY khi map field — api-contract-du-lieu-tinh-luong.md Mục 8.1.1 (đánh dấu ⭐):
 * 1. `gio_tang_ca` <- `otRawHours` (giờ GỐC). TUYỆT ĐỐI KHÔNG dùng `otConvertedHours` (đã nhân hệ
 *    số) — nhầm là sai số giờ hiển thị dù tiền tăng ca (`tien_tang_ca` <- `otAmount`) vẫn đúng.
 * 2. `thu_nhap_chiu_thue` suy từ 4 số hạng (`grossIncome` trừ 3 khoản miễn thuế). TUYỆT ĐỐI
 *    KHÔNG dùng thẳng `taxableIncome` — trường đó ĐỔI Ý NGHĨA theo `withholdingTaxApplied`
 *    (api-contract 8.1.2: nhánh lũy tiến đã trừ giảm trừ gia cảnh + bảo hiểm, nhánh khấu trừ 10%
 *    thì chưa trừ giảm trừ).
 *
 * Bộ lọc theo phòng ban (`filters.ma_pb`) cần MÃ phòng ban, nhưng cả hai endpoint chỉ trả TÊN
 * (`departmentName`) — không có mã. Phải tra chéo qua `useNhanVienRows()` (cache dùng chung với
 * màn "Nhân viên") để có `Map<ma_nv, ma_pb>`, xem `useMaPbTheoNv()`.
 */

import { useMemo } from "react";
import type { QueryObserverResult } from "@tanstack/react-query";
import { getApiError } from "@/lib/apiClient";
import { useCurrentPayrollPeriod } from "../../components/du_lieu_tinh_luong/useCurrentPayrollPeriod";
import { useNhanVienRows } from "../du_lieu_nhan_vien/nhanVienQueries";
import {
  usePayrollSheetLinesQuery,
  useSupportAllowancesQuery,
} from "../du_lieu_tinh_luong/payrollCalculationQueries";
import type {
  PayrollCalculationLineApi,
  SupportAllowanceColumnApi,
  SupportAllowanceItemApi,
  SupportAllowanceResponseApi,
} from "../du_lieu_tinh_luong/payrollCalculationApi";
import type {
  BangLuongFilters,
  DongBangLuong,
  DongLuongHoTro,
  KhoanHoTroCot,
  KieuLuong,
  LoaiHopDong,
} from "../../types";

// ─────────────────────── Quy đổi field dùng chung ───────────────────────

/**
 * BE dùng `gross|net` (chữ thường, đúng giá trị lưu DB), FE dùng `GROSS|NET` — cùng quy ước đã
 * áp cho `GET /hop-dong` thật (`hopDongQueries.ts`). `null` khi không có hợp đồng hiệu lực (B-4).
 */
function veKieuLuong(salaryType: string | null): KieuLuong | null {
  if (!salaryType) return null;
  return salaryType.toLowerCase() === "net" ? "NET" : "GROSS";
}

/** `contractType` là slug ASCII lưu thẳng từ `hrm_hop_dong.loai_hd`, cùng 5 giá trị `LoaiHopDong`. */
function veLoaiHopDong(contractType: string | null): LoaiHopDong | null {
  return (contractType as LoaiHopDong | null) ?? null;
}

function veDongBangLuong(l: PayrollCalculationLineApi): DongBangLuong {
  return {
    ma_nv: l.ma_nv,
    ho_ten: l.fullName,
    ten_pb: l.departmentName,
    ten_cv: l.positionName,
    loai_hd: veLoaiHopDong(l.contractType),
    kieu_luong: veKieuLuong(l.salaryType),
    so_npt: l.dependentCount,

    luong: l.baseSalaryMonthly,
    ngay_cong: l.actualWorkDays,
    ngay_cong_chuan: l.standardWorkDays,
    gio_tang_ca: l.otRawHours, // ⭐ KHÔNG dùng otConvertedHours
    gio_quy_doi: l.otConvertedHours,
    tien_tang_ca: l.otAmount,
    // luong_theo_ngay mock cũ gộp cả phụ cấp; proratedWorkSalary API chỉ là phần hợp đồng
    // (SRS 15.5 giữ nguyên nghĩa) nên phải cộng thêm allowanceInPeriodTotal mới khớp cột UI.
    luong_theo_ngay: l.proratedWorkSalary + l.allowanceInPeriodTotal,
    luong_san_pham: l.pieceworkSalary,
    thuong: l.bonusSalary,
    kpi: l.kpiSalary,
    luong_phan_tram: l.commissionSalary,
    chuyen_can: l.diligenceSalary,

    thu_nhap: l.grossIncome,
    // ⭐ 4 số hạng, KHÔNG dùng taxableIncome — xem cảnh báo đầu file.
    thu_nhap_chiu_thue: Math.max(
      0,
      l.grossIncome -
        l.otTaxExemptAmount -
        l.lunchAllowanceExemptAmount -
        l.otherAllowanceTaxExemptAmount,
    ),
    luong_bhxh: l.insuranceSalaryBase,
    bao_hiem: l.employeeInsuranceDeduction,
    bao_hiem_ct: l.companyInsuranceExpense,
    cong_doan: l.employeeUnionFee,
    kpcd_ct: l.companyUnionExpense,
    bu_tru: l.adjustmentNetAmount,
    thue_tncn: l.personalIncomeTax,
    // Có thể ÂM (tạm ứng vượt lương kỳ này) — giữ nguyên, không kẹp 0 (EC-03).
    thuc_linh: l.netTakeHomeSalary,
    quy_luong: l.totalCompanyCost,
  };
}

function veKhoanHoTroCot(c: SupportAllowanceColumnApi): KhoanHoTroCot {
  return {
    ma_khoan: c.code,
    ten_khoan: c.name,
    chiu_thue_tncn: c.isTaxable,
    la_khoan_an_ca: c.isMealAllowance,
  };
}

function veDongLuongHoTro(it: SupportAllowanceItemApi): DongLuongHoTro {
  return {
    ma_nv: it.ma_nv,
    ho_ten: it.fullName,
    ten_pb: it.departmentName,
    ten_cv: it.positionName,
    loai_hd: veLoaiHopDong(it.contractType),
    kieu_luong: veKieuLuong(it.salaryType),
    ngay_cong: it.actualWorkDays,
    ngay_cong_chuan: it.standardWorkDays,
    khoan: it.amounts,
    tong_muc_thang: it.monthlyTotal,
    tong: it.total,
  };
}

/** `Map<ma_nv, ma_pb>` — cả hai endpoint payroll chỉ trả TÊN phòng ban, không trả mã. */
function useMaPbTheoNv(): Map<string, string | null> {
  const { rows } = useNhanVienRows({ q: "", ma_pb: "", status: "1" });
  return useMemo(() => new Map(rows.map((nv) => [nv.ma_nv, nv.ma_pb])), [rows]);
}

/** Lọc + sắp xếp dùng chung cho cả hai tab — cùng bốn tiêu chí, cùng thứ tự áp dụng như bản mock cũ. */
function apDungBoLoc<
  T extends { ma_nv: string; ho_ten: string; loai_hd: LoaiHopDong | null; kieu_luong: KieuLuong | null },
>(rows: T[], filters: BangLuongFilters, maPbTheoNv: Map<string, string | null>): T[] {
  const tuKhoa = filters.q.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (filters.ma_pb && maPbTheoNv.get(row.ma_nv) !== filters.ma_pb) return false;
      if (filters.loai_hd && row.loai_hd !== filters.loai_hd) return false;
      if (filters.kieu_luong && row.kieu_luong !== filters.kieu_luong) return false;
      if (!tuKhoa) return true;
      return [row.ma_nv, row.ho_ten].some((truong) => truong.toLowerCase().includes(tuKhoa));
    })
    .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
}

// ─────────────────────── Hook xuất ra cho component ───────────────────────

export interface KetQuaBangLuong {
  rows: DongBangLuong[];
  isLoading: boolean;
  /** `true` khi đang tải lại (nút "Tính lại lương") — khác `isLoading` (lần tải đầu). */
  isFetching: boolean;
  isError: boolean;
  errorMessage: string | null;
  /** Trả nguyên `Promise` của `useQuery().refetch()` — bên gọi tự đọc `data`/`isError` sau khi tải lại. */
  refetch: () => Promise<QueryObserverResult<PayrollCalculationLineApi[]>>;
}

/**
 * Bảng lương chính của kỳ đang chọn — thay `useBangLuongRows` bản mock.
 *
 * Nguồn là `GET /payroll/sheet-lines` (KHÔNG phải `/payroll/calculate`) — kỳ DRAFT/PENDING_REVIEW
 * trả tính live y hệt `/payroll/calculate`, kỳ đã khóa (LOCKED/APPROVED/PAID/ARCHIVED) trả snapshot
 * đóng băng lúc khóa sổ, đúng nguyên tắc "khóa sổ = snapshot bất biến"
 * (`docs/hrm/CONTEXT_SUMMARY.md` Mục 1). Đổi từ `usePayrollCalculateQuery` sang
 * `usePayrollSheetLinesQuery` ngày 2026-09-10 — trước đó màn này LUÔN tính live kể cả kỳ đã khóa,
 * có thể lệch số đã chốt nếu dữ liệu nguồn (chấm công/tăng ca/khoản lương…) đổi SAU khi khóa sổ.
 */
export function useBangLuongRows(filters: BangLuongFilters): KetQuaBangLuong {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { data, isLoading, isFetching, isError, error, refetch } =
    usePayrollSheetLinesQuery(selectedPeriodId);
  const maPbTheoNv = useMaPbTheoNv();

  const tatCa = useMemo(() => (data ?? []).map(veDongBangLuong), [data]);
  const rows = useMemo(
    () => apDungBoLoc(tatCa, filters, maPbTheoNv),
    [tatCa, filters, maPbTheoNv],
  );

  return {
    rows,
    isLoading,
    isFetching,
    isError,
    errorMessage: isError ? getApiError(error, "Không tải được bảng lương.") : null,
    refetch,
  };
}

/** Kỳ lương đang hiển thị — hiện ở tiêu đề màn hình. `periodId=null` khi chưa chọn/chưa có kỳ nào. */
export function useKyBangLuong(): {
  nam: number;
  thang: number;
  nhan: string;
  periodId: string | null;
} {
  const { selectedPeriod } = useCurrentPayrollPeriod();
  return useMemo(() => {
    if (!selectedPeriod) {
      return { nam: 0, thang: 0, nhan: "Chưa chọn kỳ lương", periodId: null };
    }
    return {
      nam: selectedPeriod.year,
      thang: selectedPeriod.month,
      nhan: selectedPeriod.name,
      periodId: selectedPeriod.id,
    };
  }, [selectedPeriod]);
}

export interface KetQuaLuongHoTro {
  rows: DongLuongHoTro[];
  /** Cột động của bảng — mỗi phần tử là một khoản `BENEFIT_ALLOWANCE` đang `ACTIVE`. */
  columns: KhoanHoTroCot[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => Promise<QueryObserverResult<SupportAllowanceResponseApi>>;
}

/**
 * Bóc tách phần lương hỗ trợ của kỳ đang chọn — thay `useLuongHoTroRows` bản mock.
 *
 * 🔴 Bất biến bắt buộc (api-contract 8.2): `tong` của mỗi dòng ở đây phải bằng đúng phần
 * `BENEFIT_ALLOWANCE` mà `/payroll/calculate` đã cộng vào `allowanceInPeriodTotal` (cột "Thu
 * nhập" của tab Bảng lương) — máy chủ bảo đảm bằng cách dùng CHUNG `tinhKhoanPhuCapTheoKy()` cho
 * cả hai endpoint, FE không tự cộng lại để so sánh.
 *
 * ⚠️ KHÁC `useBangLuongRows`: `/payroll/support-allowances` KHÔNG có nhánh snapshot (RVW-020,
 * `getSupportAllowanceBreakdown()` be_maxv — `PayrollSheetLine` chỉ lưu tổng gộp, không lưu bóc
 * tách theo từng khoản) — LUÔN tính live kể cả kỳ đã khóa sổ. `LuongHoTroPanel` tự cảnh báo qua
 * `useCurrentPayrollPeriod().isLocked`, xem component.
 */
export function useLuongHoTroRows(filters: BangLuongFilters): KetQuaLuongHoTro {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { data, isLoading, isFetching, isError, error, refetch } =
    useSupportAllowancesQuery(selectedPeriodId);
  const maPbTheoNv = useMaPbTheoNv();

  const tatCa = useMemo(() => (data?.items ?? []).map(veDongLuongHoTro), [data]);
  const rows = useMemo(
    () => apDungBoLoc(tatCa, filters, maPbTheoNv),
    [tatCa, filters, maPbTheoNv],
  );
  const columns = useMemo(() => (data?.columns ?? []).map(veKhoanHoTroCot), [data]);

  return {
    rows,
    columns,
    isLoading,
    isFetching,
    isError,
    errorMessage: isError ? getApiError(error, "Không tải được lương hỗ trợ.") : null,
    refetch,
  };
}

/**
 * Số nhân viên đang làm của kỳ đang chọn — mẫu số của chip "Tổng ... nhân viên" ở cả hai tab.
 *
 * Cùng nguồn `usePayrollSheetLinesQuery` với `useBangLuongRows`: React Query dùng chung cache
 * theo `queryKey` nên gọi hook này ở tab "Lương hỗ trợ" (chưa từng mở tab "Bảng lương") vẫn chỉ
 * tốn đúng một request, không nhân đôi.
 */
export function useSoNhanVienDangLam(): number {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { data } = usePayrollSheetLinesQuery(selectedPeriodId);
  return data?.length ?? 0;
}

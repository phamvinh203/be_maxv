/**
 * Hook TanStack Query THÔ cho "Bảng lương tổng hợp" — chỉ bọc `useQuery` quanh
 * `payrollCalculationApi.ts`, KHÔNG đổi kiểu sang FE. Lớp đổi kiểu + adapter cho khu "Bảng lương"
 * nằm ở `api/bang_luong/bangLuongQueries.ts`.
 *
 * `periodId` là `string | null`: truyền `null` khi chưa chọn kỳ lương (vd công ty chưa tạo kỳ
 * nào) — cả ba hook tự tắt query (`enabled: false`) thay vì bắn request với `periodId=""`.
 */

import { queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollCalculationKeys } from "../hrmKeys";
import {
  getPayrollCalculate,
  getPayrollSheetLines,
  getSupportAllowances,
} from "./payrollCalculationApi";

export type {
  PayrollCalculationLineApi,
  SupportAllowanceColumnApi,
  SupportAllowanceItemApi,
  SupportAllowanceResponseApi,
} from "./payrollCalculationApi";

/** `GET /payroll/calculate` — luôn tính LIVE, dùng làm nguồn chính của khu "Bảng lương". */
export function usePayrollCalculateQuery(periodId: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollCalculationKeys.calculate(currentCompanyId, periodId ?? ""),
    queryFn: () => getPayrollCalculate(periodId as string),
    enabled: isAuthenticated && !!currentCompanyId && !!periodId,
  });
}

/** `GET /payroll/support-allowances` — nguồn của tab "Lương hỗ trợ". */
export function useSupportAllowancesQuery(periodId: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollCalculationKeys.supportAllowances(currentCompanyId, periodId ?? ""),
    queryFn: () => getSupportAllowances(periodId as string),
    enabled: isAuthenticated && !!currentCompanyId && !!periodId,
  });
}

/**
 * `GET /payroll/sheet-lines` — nguồn chính của khu "Bảng lương" (`useBangLuongRows`,
 * `api/bang_luong/bangLuongQueries.ts`): tự chuyển live/snapshot theo trạng thái kỳ, ĐÚNG bất
 * biến "khóa sổ = snapshot bất biến" (`CONTEXT_SUMMARY.md` Mục 1). Không dùng
 * `usePayrollCalculateQuery` cho màn hiển thị chính — hàm đó LUÔN tính live kể cả kỳ đã khóa,
 * chỉ còn dùng cho các nơi cố ý cần xem số tính lại tức thời (hiện chưa có nơi nào gọi trực tiếp).
 */
export function usePayrollSheetLinesQuery(periodId: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery(payrollSheetLinesOptions(currentCompanyId, periodId, isAuthenticated));
}

/**
 * Cấu hình truy vấn sheet-lines — MỘT chỗ khai `queryKey`/`queryFn`/`enabled`, dùng cho cả hook ở
 * trên lẫn `useQueries` nhiều kỳ của Dashboard (`api/dashboard/dashboardQueries.ts`). Hai nơi tự
 * khai riêng là hai mục cache có thể lệch nhau mà không lỗi kiểu nào báo.
 */
export function payrollSheetLinesOptions(
  companyId: string | null,
  periodId: string | null,
  isAuthenticated: boolean,
) {
  return queryOptions({
    queryKey: hrmPayrollCalculationKeys.sheetLines(companyId, periodId ?? ""),
    queryFn: () => getPayrollSheetLines(periodId as string),
    enabled: isAuthenticated && !!companyId && !!periodId,
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollPeriodKeys, hrmPayrollCalculationKeys } from "../hrmKeys";
import { useQuyenXemLuong } from "../du_lieu_nhan_vien/quyenLuongQueries";
import {
  approvePayrollPeriod,
  archivePayrollPeriod,
  createPayrollPeriod,
  deletePayrollPeriod,
  getPayrollPeriod,
  listPayrollPeriods,
  lockPayrollPeriod,
  markPaidPayrollPeriod,
  rejectPayrollPeriod,
  reopenPayrollPeriod,
  submitPayrollPeriod,
  updatePayrollPeriod,
  type CreatePayrollPeriodBody,
  type ListPayrollPeriodsParams,
  type PayrollPeriodApiItem,
  type ReopenPayrollPeriodBody,
  type UpdatePayrollPeriodBody,
} from "./payrollPeriodsApi";

export type { PayrollPeriodApiItem, PayrollPeriodStatusApi } from "./payrollPeriodsApi";

/**
 * `options.enabled = false` để hoãn gọi khi CHƯA chắc phiên có quyền xem lương — cả nhóm
 * `/payroll-*` trả 403 cho người không có quyền (`dbCoQuyenLuongPayroll`). Dashboard dùng để
 * không bắn request chắc chắn hỏng.
 */
export function usePayrollPeriodList(
  params?: ListPayrollPeriodsParams,
  options?: { enabled?: boolean },
) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...hrmPayrollPeriodKeys.list(currentCompanyId), params],
    queryFn: () => listPayrollPeriods(params),
    enabled: isAuthenticated && !!currentCompanyId && (options?.enabled ?? true),
  });
}

const KHONG_CO_KY: PayrollPeriodApiItem[] = [];

/**
 * Danh sách kỳ lương, CHỈ gọi khi đã biết phiên có quyền lương. Lúc danh sách nhân viên còn đang
 * tải, `useQuyenXemLuong` báo "chua_ro" và coi là ĐƯỢC — bắn ngay thì người không có quyền ăn một
 * 403 (thêm một lần retry) vô ích. Tải xong mà vẫn "chua_ro" (công ty chưa có nhân viên nào) thì để
 * máy chủ chốt. Dùng chung cho góc chọn kỳ trên thanh HRM (`PayrollPeriodProvider`) và Dashboard —
 * cùng khóa cache nên hai nơi không bắn hai lượt.
 */
export function useDanhSachKyLuongTheoQuyen() {
  const quyen = useQuyenXemLuong();
  const duocGoi = quyen.daXacDinh && !quyen.biTuChoi;
  const { data, isLoading, isError, error } = usePayrollPeriodList(undefined, { enabled: duocGoi });
  return {
    periods: data ?? KHONG_CO_KY,
    // Chưa biết quyền cũng là đang tải — query bị hoãn nên `isLoading` của nó báo false.
    isLoading: !quyen.biTuChoi && (!duocGoi || isLoading),
    isError,
    error,
    biTuChoi: quyen.biTuChoi,
  };
}

export function usePayrollPeriodDetail(id: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollPeriodKeys.detail(currentCompanyId, id ?? ""),
    queryFn: () => (id ? getPayrollPeriod(id) : Promise.reject("Thiếu ID kỳ lương")),
    enabled: isAuthenticated && !!currentCompanyId && !!id,
  });
}

/**
 * Trả về promise chờ nhóm `hrm-payroll-periods` (danh sách kỳ, màn Chốt kỳ lương) nạp lại xong —
 * TanStack đợi promise của `onSuccess` rồi mới cho `mutateAsync` về, nên nơi gọi đọc được ngay kỳ vừa
 * tạo/đổi (không có khoảnh khắc "tháng này chưa có kỳ" mà nút "Tạo kỳ lương" lại bấm được). Nhóm
 * tính lương chỉ đánh dấu cũ, không chờ — tính lại lương toàn công ty có thể lâu.
 */
function useInvalidatePayroll() {
  const qc = useQueryClient();
  return useCallback(async () => {
    void qc.invalidateQueries({ queryKey: hrmPayrollCalculationKeys.all });
    await qc.invalidateQueries({ queryKey: hrmPayrollPeriodKeys.all });
  }, [qc]);
}

export function useCreatePayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (body: CreatePayrollPeriodBody) => createPayrollPeriod(body),
    onSuccess: invalidate,
  });
}

export function useUpdatePayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePayrollPeriodBody }) =>
      updatePayrollPeriod(id, body),
    onSuccess: invalidate,
  });
}

export function useDeletePayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => deletePayrollPeriod(id),
    onSuccess: invalidate,
  });
}

export function useSubmitPayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => submitPayrollPeriod(id),
    onSuccess: invalidate,
  });
}

export function useRejectPayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => rejectPayrollPeriod(id),
    onSuccess: invalidate,
  });
}

export function useLockPayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => lockPayrollPeriod(id),
    onSuccess: invalidate,
  });
}

export function useReopenPayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReopenPayrollPeriodBody }) =>
      reopenPayrollPeriod(id, body),
    onSuccess: invalidate,
  });
}

export function useApprovePayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => approvePayrollPeriod(id),
    onSuccess: invalidate,
  });
}

export function useMarkPaidPayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => markPaidPayrollPeriod(id),
    onSuccess: invalidate,
  });
}

export function useArchivePayrollPeriod() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: (id: string) => archivePayrollPeriod(id),
    onSuccess: invalidate,
  });
}

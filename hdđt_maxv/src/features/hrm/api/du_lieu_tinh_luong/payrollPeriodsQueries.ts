import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollPeriodKeys, hrmPayrollCalculationKeys } from "../hrmKeys";
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

export function usePayrollPeriodDetail(id: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollPeriodKeys.detail(currentCompanyId, id ?? ""),
    queryFn: () => (id ? getPayrollPeriod(id) : Promise.reject("Thiếu ID kỳ lương")),
    enabled: isAuthenticated && !!currentCompanyId && !!id,
  });
}

function useInvalidatePayroll() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: hrmPayrollPeriodKeys.all });
    void qc.invalidateQueries({ queryKey: hrmPayrollCalculationKeys.all });
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

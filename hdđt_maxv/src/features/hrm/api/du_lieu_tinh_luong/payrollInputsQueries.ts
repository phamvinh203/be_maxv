import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollCalculationKeys, hrmPayrollDataKeys } from "../hrmKeys";
import {
  applyAdjustmentData,
  applyBonusData,
  applyCommissionData,
  applyKpiData,
  applyOvertimeData,
  applyPieceworkData,
  deleteDiligenceRecord,
  deleteOvertimeData,
  getAdjustmentData,
  getAttendanceMatrix,
  getBonusData,
  getCommissionData,
  getDiligenceData,
  getKpiData,
  getOvertimeData,
  getPieceworkData,
  overrideAttendanceCell,
  recordDiligence,
  type ApplyAdjustmentsBody,
  type ApplyBonusBody,
  type ApplyCommissionBody,
  type ApplyKpiBody,
  type ApplyOvertimeBody,
  type ApplyPieceworkBody,
  type AttendanceCellOverrideBody,
  type ListModuleParams,
  type RecordDiligenceBody,
} from "./payrollInputsApi";

/**
 * Helper hook để invalidate dữ liệu sau khi ghi — CHỈ invalidate đúng danh sách của module vừa
 * ghi (qua `moduleKeyFn`) + bảng lương tính toán của kỳ, KHÔNG đụng `hrmPayrollDataKeys.all`
 * (trước đây invalidate "all" khiến MỌI module × MỌI kỳ lương khác trong cache đều bị đánh dấu
 * stale/refetch dù không hề thay đổi — vd sửa 1 ô chấm công làm luôn cả danh sách KPI/thưởng/kỳ
 * lương tháng khác phải gọi lại API).
 */
function useInvalidateInputs(
  periodId: string,
  moduleKeyFn: (companyId: string | null, periodId: string) => readonly unknown[],
) {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: moduleKeyFn(currentCompanyId, periodId) });
    void qc.invalidateQueries({
      queryKey: hrmPayrollCalculationKeys.calculate(currentCompanyId, periodId),
    });
  }, [qc, currentCompanyId, periodId, moduleKeyFn]);
}

// 1. Chấm công
export function useAttendanceMatrix(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.attendanceMatrix(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getAttendanceMatrix(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useOverrideAttendanceCell(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.attendanceMatrix);
  return useMutation({
    mutationFn: (body: AttendanceCellOverrideBody) => overrideAttendanceCell(body),
    onSuccess: invalidate,
  });
}

// 2. Tăng ca
export function useOvertimeList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.overtimeList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getOvertimeData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useApplyOvertime(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.overtimeList);
  return useMutation({
    mutationFn: (body: ApplyOvertimeBody) => applyOvertimeData(body),
    onSuccess: invalidate,
  });
}

export function useDeleteOvertime(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.overtimeList);
  return useMutation({
    mutationFn: (maNv: string) => deleteOvertimeData(maNv, periodId),
    onSuccess: invalidate,
  });
}

// 3. KPI
export function useKpiDataList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.kpiList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getKpiData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useApplyKpi(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.kpiList);
  return useMutation({
    mutationFn: (body: ApplyKpiBody) => applyKpiData(body),
    onSuccess: invalidate,
  });
}

// 4. Thưởng
export function useBonusDataList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.bonusList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getBonusData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useApplyBonus(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.bonusList);
  return useMutation({
    mutationFn: (body: ApplyBonusBody) => applyBonusData(body),
    onSuccess: invalidate,
  });
}

// 5. Lương sản phẩm
export function usePieceworkDataList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.pieceworkList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getPieceworkData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useApplyPiecework(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.pieceworkList);
  return useMutation({
    mutationFn: (body: ApplyPieceworkBody) => applyPieceworkData(body),
    onSuccess: invalidate,
  });
}

// 6. Lương phần trăm
export function useCommissionDataList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.commissionList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getCommissionData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useApplyCommission(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.commissionList);
  return useMutation({
    mutationFn: (body: ApplyCommissionBody) => applyCommissionData(body),
    onSuccess: invalidate,
  });
}

// 7. Lương chuyên cần
export function useDiligenceDataList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.diligenceList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getDiligenceData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useRecordDiligence(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.diligenceList);
  return useMutation({
    mutationFn: (body: RecordDiligenceBody) => recordDiligence(body),
    onSuccess: invalidate,
  });
}

export function useDeleteDiligenceRecord(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.diligenceList);
  return useMutation({
    mutationFn: (id: string) => deleteDiligenceRecord(id),
    onSuccess: invalidate,
  });
}

// 8. Ứng - Bù trừ
export function useAdjustmentDataList(params: ListModuleParams) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollDataKeys.adjustmentList(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getAdjustmentData(params),
    enabled: isAuthenticated && !!currentCompanyId && !!params.periodId,
  });
}

export function useApplyAdjustments(periodId: string) {
  const invalidate = useInvalidateInputs(periodId, hrmPayrollDataKeys.adjustmentList);
  return useMutation({
    mutationFn: (body: ApplyAdjustmentsBody) => applyAdjustmentData(body),
    onSuccess: invalidate,
  });
}

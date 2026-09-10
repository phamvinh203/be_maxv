import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollCalculationKeys } from "../hrmKeys";
import {
  calculatePayrollPreview,
  getPayrollSheetLines,
  type PayrollCalculationParams,
} from "./payrollCalculationApi";

export function usePayrollCalculate(
  params: PayrollCalculationParams,
  options?: { enabled?: boolean },
) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollCalculationKeys.calculate(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => calculatePayrollPreview(params),
    enabled:
      isAuthenticated &&
      !!currentCompanyId &&
      !!params.periodId &&
      (options?.enabled ?? true),
  });
}

export function usePayrollSheetLines(
  params: PayrollCalculationParams,
  options?: { enabled?: boolean },
) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [
      ...hrmPayrollCalculationKeys.sheetLines(currentCompanyId, params.periodId),
      params,
    ],
    queryFn: () => getPayrollSheetLines(params),
    enabled:
      isAuthenticated &&
      !!currentCompanyId &&
      !!params.periodId &&
      (options?.enabled ?? true),
  });
}

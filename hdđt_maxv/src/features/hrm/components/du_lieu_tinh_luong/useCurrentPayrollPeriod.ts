import { createContext, useContext } from "react";
import type { PayrollPeriodApiItem } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";

export interface PayrollPeriodContextValue {
  selectedPeriodId: string | null;
  setSelectedPeriodId: (id: string) => void;
  selectedPeriod: PayrollPeriodApiItem | null;
  periods: PayrollPeriodApiItem[];
  isLoading: boolean;
  isLocked: boolean;
  isReadOnly: boolean;
}

export const PayrollPeriodContext = createContext<PayrollPeriodContextValue | null>(null);

export function useCurrentPayrollPeriod(): PayrollPeriodContextValue {
  const ctx = useContext(PayrollPeriodContext);
  if (!ctx) {
    throw new Error("useCurrentPayrollPeriod must be used within PayrollPeriodProvider");
  }
  return ctx;
}

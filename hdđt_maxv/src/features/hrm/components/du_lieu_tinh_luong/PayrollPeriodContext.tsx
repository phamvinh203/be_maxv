import { useState, useMemo, type ReactNode } from "react";
import { usePayrollPeriodList } from "../../api/payrollPeriodsQueries";
import { PayrollPeriodContext } from "./useCurrentPayrollPeriod";

const STORAGE_KEY = "hrm_selected_payroll_period_id";

export function PayrollPeriodProvider({ children }: { children: ReactNode }) {
  const { data: periods = [], isLoading } = usePayrollPeriodList();
  const [overrideId, setOverrideId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  const selectedPeriodId = useMemo(() => {
    if (periods.length === 0) return null;
    if (overrideId && periods.some((p) => p.id === overrideId)) {
      return overrideId;
    }
    return periods[0]?.id ?? null;
  }, [periods, overrideId]);

  const handleSelect = (id: string) => {
    setOverrideId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const selectedPeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId) ?? null;
  }, [periods, selectedPeriodId]);

  const isLocked =
    selectedPeriod?.status === "LOCKED" ||
    selectedPeriod?.status === "APPROVED" ||
    selectedPeriod?.status === "PAID" ||
    selectedPeriod?.status === "ARCHIVED";

  const isReadOnly = isLocked || selectedPeriod?.status === "PENDING_REVIEW";

  const value = useMemo(
    () => ({
      selectedPeriodId,
      setSelectedPeriodId: handleSelect,
      selectedPeriod,
      periods,
      isLoading,
      isLocked,
      isReadOnly,
    }),
    [selectedPeriodId, selectedPeriod, periods, isLoading, isLocked, isReadOnly],
  );

  return (
    <PayrollPeriodContext.Provider value={value}>
      {children}
    </PayrollPeriodContext.Provider>
  );
}

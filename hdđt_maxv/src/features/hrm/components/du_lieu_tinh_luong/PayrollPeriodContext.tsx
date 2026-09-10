import { useState, useMemo, type ReactNode } from "react";
import { usePayrollPeriodList } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { kyDaKhoaSo } from "../../_shared/constants";
import {
  docKyLuongDaChon,
  luuKyLuongDaChon,
  PayrollPeriodContext,
} from "./useCurrentPayrollPeriod";

export function PayrollPeriodProvider({ children }: { children: ReactNode }) {
  const { data: periods = [], isLoading } = usePayrollPeriodList();
  const [overrideId, setOverrideId] = useState<string | null>(docKyLuongDaChon);

  const selectedPeriodId = useMemo(() => {
    if (periods.length === 0) return null;
    if (overrideId && periods.some((p) => p.id === overrideId)) {
      return overrideId;
    }
    return periods[0]?.id ?? null;
  }, [periods, overrideId]);

  const handleSelect = (id: string) => {
    setOverrideId(id);
    luuKyLuongDaChon(id);
  };

  const selectedPeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId) ?? null;
  }, [periods, selectedPeriodId]);

  const isLocked = selectedPeriod ? kyDaKhoaSo(selectedPeriod.status) : false;

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

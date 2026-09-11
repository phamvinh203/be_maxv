import { createContext, useContext } from "react";
import type { PayrollPeriodApiItem } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import type { ThangNam } from "../../_shared/thangKyLuong";

export interface PayrollPeriodContextValue {
  selectedPeriodId: string | null;
  /** `null` khi tháng đang xem CHƯA có kỳ lương (ô tháng ở góc thanh HRM vẫn trỏ tới tháng đó). */
  selectedPeriod: PayrollPeriodApiItem | null;
  /** Tháng/năm đang xem ở góc thanh HRM — luôn có giá trị, kể cả khi tháng đó chưa có kỳ. */
  thangChon: ThangNam;
  /** Cách chọn kỳ DUY NHẤT — theo tháng (ô tháng, lối tắt Dashboard, vừa tạo kỳ mới đều qua đây). */
  chonThang: (thang: ThangNam) => void;
  periods: PayrollPeriodApiItem[];
  isLoading: boolean;
  isLocked: boolean;
  isReadOnly: boolean;
  /** Chắc chắn không có quyền xem lương — góc chọn kỳ ẩn đi, màn lương hiện thông báo. */
  biTuChoi: boolean;
}

export const PayrollPeriodContext = createContext<PayrollPeriodContextValue | null>(null);

export function useCurrentPayrollPeriod(): PayrollPeriodContextValue {
  const ctx = useContext(PayrollPeriodContext);
  if (!ctx) {
    throw new Error("useCurrentPayrollPeriod must be used within PayrollPeriodProvider");
  }
  return ctx;
}

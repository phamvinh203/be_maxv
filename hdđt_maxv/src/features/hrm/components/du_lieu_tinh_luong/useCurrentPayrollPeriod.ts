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

/** Khóa `localStorage` nhớ kỳ lương đang chọn — dùng CHUNG cho mọi `PayrollPeriodProvider`. */
const KHOA_KY_LUONG_DA_CHON = "hrm_selected_payroll_period_id";

/** Kỳ đã chọn lần trước. Trình duyệt chặn lưu trữ thì coi như chưa chọn — rơi về kỳ mới nhất. */
export function docKyLuongDaChon(): string | null {
  try {
    return localStorage.getItem(KHOA_KY_LUONG_DA_CHON);
  } catch {
    return null;
  }
}

/**
 * Nhớ kỳ đang chọn. Provider chỉ ĐỌC lúc mount, nên nơi muốn mở sẵn một kỳ ở màn khác (vd Dashboard
 * bấm "Chấm công tháng này") phải gọi hàm này TRƯỚC khi điều hướng.
 */
export function luuKyLuongDaChon(id: string): void {
  try {
    localStorage.setItem(KHOA_KY_LUONG_DA_CHON, id);
  } catch {
    // Trình duyệt chặn lưu trữ: lần mở sau rơi về kỳ mới nhất — vẫn dùng được.
  }
}

export function useCurrentPayrollPeriod(): PayrollPeriodContextValue {
  const ctx = useContext(PayrollPeriodContext);
  if (!ctx) {
    throw new Error("useCurrentPayrollPeriod must be used within PayrollPeriodProvider");
  }
  return ctx;
}

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useDanhSachKyLuongTheoQuyen } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { useAuth } from "@/features/auth/useAuth";
import { kyDaKhoaSo } from "../../_shared/constants";
import { homNay } from "../../_shared/format";
import {
  kyCuaThang,
  kyMoiNhat,
  thangCua,
  thangCuaKy,
  type ThangNam,
} from "../../_shared/thangKyLuong";
import { PayrollPeriodContext } from "./useCurrentPayrollPeriod";

/** Khóa `localStorage` nhớ THÁNG đang xem (`YYYY-MM`) — KHÓA RIÊNG TỪNG công ty. */
const KHOA_THANG_DA_CHON = (companyId: string) => `hrm_thang_ky_luong_da_chon:${companyId}`;

/** Trình duyệt chặn lưu trữ, hoặc giá trị lạ, thì coi như chưa chọn — rơi về kỳ mới nhất. */
function docThangDaChon(companyId: string | null): ThangNam | null {
  if (!companyId) return null;
  try {
    const khop = /^(\d{4})-(\d{2})$/.exec(localStorage.getItem(KHOA_THANG_DA_CHON(companyId)) ?? "");
    return khop ? { nam: Number(khop[1]), thang: Number(khop[2]) } : null;
  } catch {
    return null;
  }
}

function luuThangDaChon(companyId: string, { nam, thang }: ThangNam): void {
  try {
    localStorage.setItem(KHOA_THANG_DA_CHON(companyId), `${nam}-${String(thang).padStart(2, "0")}`);
  } catch {
    // Trình duyệt chặn lưu trữ: lần mở sau rơi về kỳ mới nhất — vẫn dùng được.
  }
}

/**
 * Kỳ lương đang chọn cho TOÀN khu HRM — bọc một lần ở `HrmPage`, ô tháng ở góc thanh HRM đổi là mọi
 * khu (Dữ liệu tính lương, Bảng lương, Chốt kỳ lương) đổi theo.
 *
 * Trạng thái DUY NHẤT là THÁNG đang xem; kỳ lương suy ra từ tháng. Tháng chưa có kỳ thì
 * `selectedPeriod` là `null` (các màn hiện "chưa có kỳ"), không lặng lẽ giữ kỳ cũ — nhìn ô tháng 10
 * mà số liệu là của tháng 9 là sai nguy hiểm hơn một màn trống. Vừa tạo kỳ mới cũng không cần cơ
 * chế riêng: tháng đã đúng, danh sách nạp lại xong (`useCreatePayrollPeriod` chờ việc đó) là khớp.
 */
export function PayrollPeriodProvider({ children }: { children: ReactNode }) {
  const { currentCompanyId } = useAuth();
  const { periods, isLoading, biTuChoi } = useDanhSachKyLuongTheoQuyen();
  const [thangVuaChon, setThangVuaChon] = useState<{ mst: string | null; thang: ThangNam } | null>(
    null,
  );

  // Provider không mount lại khi đổi công ty, nên suy theo công ty ngay lúc render: không khớp là
  // đọc lại tháng đã lưu của công ty mới (chưa có thì rơi về kỳ mới nhất).
  const thangDaChon = useMemo(
    () =>
      thangVuaChon?.mst === currentCompanyId
        ? thangVuaChon.thang
        : docThangDaChon(currentCompanyId),
    [thangVuaChon, currentCompanyId],
  );

  // Chưa chọn lần nào: tháng của kỳ mới nhất -> tháng hiện tại.
  const thangChon = useMemo<ThangNam>(() => {
    if (thangDaChon) return thangDaChon;
    const moiNhat = kyMoiNhat(periods);
    return moiNhat ? thangCuaKy(moiNhat) : thangCua(homNay());
  }, [thangDaChon, periods]);

  const selectedPeriod = useMemo(() => kyCuaThang(periods, thangChon), [periods, thangChon]);

  const chonThang = useCallback((thang: ThangNam) => {
    setThangVuaChon({ mst: currentCompanyId, thang });
    if (currentCompanyId) luuThangDaChon(currentCompanyId, thang);
  }, [currentCompanyId]);

  const isLocked = selectedPeriod ? kyDaKhoaSo(selectedPeriod.status) : false;
  const isReadOnly = isLocked || selectedPeriod?.status === "PENDING_REVIEW";

  const value = useMemo(
    () => ({
      selectedPeriodId: selectedPeriod?.id ?? null,
      selectedPeriod,
      thangChon,
      chonThang,
      periods,
      isLoading,
      isLocked,
      isReadOnly,
      biTuChoi,
    }),
    [selectedPeriod, thangChon, chonThang, periods, isLoading, isLocked, isReadOnly, biTuChoi],
  );

  return <PayrollPeriodContext.Provider value={value}>{children}</PayrollPeriodContext.Provider>;
}

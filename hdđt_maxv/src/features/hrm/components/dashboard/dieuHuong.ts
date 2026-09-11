import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { PayrollPeriodApiItem } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { thangCuaKy } from "../../_shared/thangKyLuong";
import { useCurrentPayrollPeriod } from "../du_lieu_tinh_luong/useCurrentPayrollPeriod";

/** Màn đích của các lối tắt trên Dashboard — khớp route ở `routes/AppRouter.tsx`. */
export const DUONG_DAN = {
  nhanVien: "/hrm/danh-muc/nhan-vien",
  chamCong: "/hrm/du-lieu-luong/cham-cong",
  tangCa: "/hrm/du-lieu-luong/tang-ca",
  bangLuong: "/hrm/bang-luong/bang-luong",
} as const;

/**
 * Mở một màn thuộc khu kỳ lương, ĐÃ chọn sẵn đúng kỳ — không để người dùng tới nơi rồi phải
 * tự đổi ô tháng ở góc thanh HRM từ kỳ đã chọn lần trước sang kỳ họ vừa bấm.
 *
 * Kỳ đang chọn sống ở `PayrollPeriodProvider` bọc cả khu HRM (đã mount sẵn) và chọn theo THÁNG,
 * nên truyền cả kỳ (không chỉ id) — kỳ vừa tạo chưa kịp về danh sách vẫn chọn đúng tháng của nó.
 */
export function useMoManKyLuong() {
  const navigate = useNavigate();
  const { chonThang } = useCurrentPayrollPeriod();
  return useCallback(
    (duongDan: string, ky?: PayrollPeriodApiItem | null) => {
      if (ky) chonThang(thangCuaKy(ky));
      navigate(duongDan);
    },
    [navigate, chonThang],
  );
}

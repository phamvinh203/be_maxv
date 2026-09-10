import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { luuKyLuongDaChon } from "../du_lieu_tinh_luong/useCurrentPayrollPeriod";

/** Màn đích của các lối tắt trên Dashboard — khớp route ở `routes/AppRouter.tsx`. */
export const DUONG_DAN = {
  nhanVien: "/hrm/danh-muc/nhan-vien",
  chamCong: "/hrm/du-lieu-luong/cham-cong",
  tangCa: "/hrm/du-lieu-luong/tang-ca",
  bangLuong: "/hrm/bang-luong/bang-luong",
} as const;

/**
 * Mở một màn thuộc khu kỳ lương, ĐÃ chọn sẵn đúng kỳ — không để người dùng tới nơi rồi phải
 * tự đổi ô "Kỳ lương" từ kỳ đã chọn lần trước sang kỳ họ vừa bấm.
 */
export function useMoManKyLuong() {
  const navigate = useNavigate();
  return useCallback(
    (duongDan: string, kyId?: string | null) => {
      if (kyId) luuKyLuongDaChon(kyId);
      navigate(duongDan);
    },
    [navigate],
  );
}

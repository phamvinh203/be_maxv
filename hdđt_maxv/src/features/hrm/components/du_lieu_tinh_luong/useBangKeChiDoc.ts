import { useChotKyLuong, type MaBangKe } from "../../api/chot_ky_luong/chotKyLuongQueries";
import { useCurrentPayrollPeriod } from "./useCurrentPayrollPeriod";

/**
 * Màn nhập liệu của một bảng kê có đang CHỈ ĐỌC không — gộp hai nguồn:
 *   1. trạng thái kỳ (khóa sổ / chờ duyệt) — như trước;
 *   2. bảng kê đã chốt số trên màn "Chốt kỳ lương" (BR-dltl-030).
 *
 * Máy chủ mới là bên chặn thật (403 `E-dltl-027`); cờ này chỉ để khóa nút sớm, khỏi bấm rồi mới lỗi.
 * Kỳ đã chỉ đọc thì không hỏi trạng thái chốt nữa (không đổi được kết quả) — `bangKeDaChot` chỉ bật khi
 * lý do là chốt số lúc kỳ còn mở, câu cảnh báo về kỳ đúng hơn khi kỳ đã khóa sổ.
 */
export function useBangKeChiDoc(bangKe: MaBangKe) {
  const { selectedPeriodId, isReadOnly: kyChiDoc } = useCurrentPayrollPeriod();
  const { data } = useChotKyLuong(kyChiDoc ? null : selectedPeriodId);
  const bangKeDaChot =
    !kyChiDoc && data?.modules.find((m) => m.module === bangKe)?.lockSource === "MODULE";
  return { isReadOnly: kyChiDoc || bangKeDaChot, bangKeDaChot };
}

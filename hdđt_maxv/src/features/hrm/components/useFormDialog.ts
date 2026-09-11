import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/lib/errors";

interface UseFormDialogOpts<T> {
  open: boolean;
  onClose: () => void;
  /** Giá trị nạp mỗi lần dialog MỞ — đọc closure prop hiện tại (`khoan`, `ca`, `ngayLe`...). */
  khoiTao: () => T;
  luu: (values: T) => Promise<void>;
  /** Trả về câu lỗi ĐẦU TIÊN chặn được, hợp lệ thì `undefined`. Không truyền = không soát
   * client (giữ nguyên hành vi những dialog chưa cần validate riêng). */
  soat?: (values: T) => string | undefined;
  thongBaoThanhCong: string;
  thongBaoLoiMacDinh: string;
}

/**
 * Khung dùng chung cho dialog CRUD một-đối-tượng của khu HRM: mở lại là nạp giá trị mới, Lưu là
 * soát rồi gọi API, thành công thì toast + đóng, lỗi thì toast câu của máy chủ.
 *
 * Trước đây mỗi dialog (Người phụ thuộc, Khoản lương, Phòng ban, Ca làm việc, Ngày lễ...) chép
 * tay đúng khung này — khiến việc thêm validate bắt buộc (RVW-A08) chỗ có chỗ không, phải mở
 * từng file mới biết (RVW-A10, `docs/hrm/review-findings.md`).
 *
 * KHÔNG dùng cho: `HopDongFormDialog` (đã có validate lỗi-theo-từng-ô riêng, dùng hook sẽ mất độ
 * chi tiết đó), `TaiLieuFormDialog` (luồng tải file tuần tự có retry, không phải một lượt lưu),
 * `SetLuongNhanVienDialog` (giá trị khởi tạo phụ thuộc dữ liệu async tới SAU khi dialog đã mở,
 * không chỉ phụ thuộc lúc `open` bật) — ba dialog này giữ nguyên logic riêng, xem review-findings.
 */
export function useFormDialog<T>({
  open,
  onClose,
  khoiTao,
  luu,
  soat,
  thongBaoThanhCong,
  thongBaoLoiMacDinh,
}: UseFormDialogOpts<T>) {
  const [values, setValues] = useState<T>(khoiTao);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp lại form mỗi lần mở, cố ý reset theo state ngoài
    setValues(khoiTao());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ nạp lại khi MỞ, không nạp lại khi prop nguồn đổi giữa lúc đang mở
  }, [open]);

  const dat = <K extends keyof T>(khoa: K, giaTri: T[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    const loi = soat?.(values);
    if (loi) {
      toast.error(loi);
      return;
    }
    setDangLuu(true);
    try {
      await luu(values);
      toast.success(thongBaoThanhCong);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, thongBaoLoiMacDinh));
    } finally {
      setDangLuu(false);
    }
  };

  return { values, setValues, dat, dangLuu, handleSubmit };
}

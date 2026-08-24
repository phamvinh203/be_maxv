import { toast, type Id as ToastId, type ToastContent } from "react-toastify";

/**
 * Hạ tầng toast cho các LƯỢT CHẠY NỀN (đồng bộ hóa đơn, tải chi tiết, đồng bộ Dịch vụ công).
 *
 * QUY TẮC CỦA APP: thông báo của lượt chạy nền nằm góc DƯỚI PHẢI, mọi thông báo tức thời giữ nguyên
 * góc trên phải (mặc định của `ToastContainer`). Lý do tách hai góc: toast lượt nền sống hàng phút,
 * còn thông báo thường tự tắt sau 3 giây — để chung một góc thì cái đang chạy bị đám kia đẩy lên
 * đẩy xuống, hoặc tệ hơn là che mất đúng lúc người dùng đang nhìn tiến độ.
 *
 * Đặt `position` trên TỪNG toast chứ không đổi `ToastContainer`: đổi ở container là kéo cả những
 * thông báo tức thời xuống theo, mất luôn chỗ tách.
 *
 * XUẤT RA HÀM, KHÔNG XUẤT OBJECT TÙY CHỌN. Bản đầu chỉ xuất hằng và trông cậy vào việc mỗi nơi nhớ
 * truyền — quy ước đó hỏng ngay trong lượt viết ra nó: hằng `closeButton: false` được áp cho toast
 * đang chạy, nhưng hai chỗ gọi cũ không khôi phục nút X ở lượt cập nhật cuối, nên toast KẾT QUẢ của
 * luồng hóa đơn thành không đóng được. Có `batDau`/`ketThuc` thì hai nửa của hợp đồng đó nằm cùng
 * một chỗ và không quên được nữa.
 */

/** Mở toast tiến độ cho một lượt nền. Trả `ToastId` để cập nhật dần rồi `ketThuc`. */
export function batDauToastNen(noiDung: ToastContent): ToastId {
  return toast.loading(noiDung, {
    position: "bottom-right",
    autoClose: false,
    // Bấm nhầm là react-toastify bỏ hẳn toast -> mọi `toast.update` sau đó, KỂ CẢ kết quả cuối,
    // thành no-op. Khóa lại trong lúc chạy; `ketThuc` mở lại.
    closeOnClick: false,
    draggable: false,
    closeButton: false,
  });
}

/** Cập nhật nội dung toast đang chạy (giữ nguyên trạng thái loading). */
export function capNhatToastNen(id: ToastId, noiDung: ToastContent): void {
  toast.update(id, { render: noiDung });
}

/**
 * Đóng lượt: thay bằng thông báo kết quả và MỞ LẠI nút X + click-để-đóng.
 *
 * Mở lại là bắt buộc — react-toastify trộn tùy chọn của `update` đè lên tùy chọn lúc tạo, nên bỏ
 * qua bước này là toast kết quả nằm đó không đóng được cho tới hết `autoClose`.
 */
export function ketThucToastNen(
  id: ToastId,
  ket: { render: ToastContent; type: "success" | "warning" | "error"; autoClose?: number },
): void {
  toast.update(id, {
    render: ket.render,
    type: ket.type,
    isLoading: false,
    autoClose: ket.autoClose ?? 5000,
    closeOnClick: true,
    draggable: true,
    closeButton: true,
  });
}

/** Thông báo một lần của một lượt nền (tóm tắt kết quả, xác nhận thao tác) — cùng góc với tiến độ
 * để đi liền mạch, nhưng tự đóng như thông báo thường. */
export const TOAST_KET_QUA_NEN = { position: "bottom-right" } as const;

// ---------------- Nhịp poll dùng chung ----------------

/** Nhịp poll tiến độ — 2s đủ mượt mà không dội BE (lượt có thể kéo hàng chục phút). */
export const POLL_NEN_MS = 2000;

/**
 * Số nhịp poll LỖI LIÊN TIẾP tối đa trước khi bỏ cuộc (~10s). Chập mạng 1-2 nhịp là chuyện thường
 * nên phải bỏ qua, nhưng mất kết nối hẳn mà cứ `continue` thì toast quay vĩnh viễn và FE poll mãi.
 */
export const MAX_POLL_NEN_HONG = 5;

/** Câu báo mất kết nối — một bản duy nhất; trước đây ba nơi tự chép và trôi thành ba câu khác nhau
 * ("mở lại tab" / "mở lại trang" / "mở lại cửa sổ này") cho cùng một tình huống. */
export const LOI_MAT_KET_NOI_NEN =
  "Mất kết nối khi theo dõi tiến độ — lượt vẫn chạy ở máy chủ, mở lại trang để xem tiếp.";

export const nghiMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

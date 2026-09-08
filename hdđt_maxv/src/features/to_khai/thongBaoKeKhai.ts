import { toast } from "react-toastify";
import type { KetQuaKeKhai } from "./api/toKhai";

/**
 * Các thông báo kèm quả của MỘT lượt "Kê khai" — dùng chung cho mọi chỗ chạy kê khai (dialog "Kê
 * khai" bên màn Hóa đơn điện tử, nút "Lập tờ khai" bên khối chọn kỳ) để cùng một sự kiện luôn nói
 * cùng một câu. Thành công không báo ở đây: mỗi nơi tự nói theo đúng việc nó đang làm.
 */
export function baoKetQuaKeKhai(kq: KetQuaKeKhai): void {
  if (kq.giuKyChot > 0) {
    // Kỳ mới THIẾU số vì mấy tờ này ở lại kỳ đã nộp. Đây là điều duy nhất trong lượt kê khai mà
    // người dùng phải xử lý bằng tay, nên nêu đích danh kỳ đang giữ thay vì nói chung chung.
    const ten = kq.kyChotDangGiu.join(", ");
    toast.warning(
      `${kq.giuKyChot} hóa đơn thuộc kỳ ${kq.nhanKy} nhưng đang nằm ở kỳ đã chốt ` +
        `(${ten}) nên được giữ nguyên ở đó — bảng kê kỳ này thiếu ngần ấy tờ. ` +
        `Muốn chuyển sang thì mở khóa tờ khai kỳ ${ten} rồi kê khai lại.`,
      // Câu dài và có việc phải làm — 3s mặc định của ToastContainer không kịp đọc.
      { autoClose: 12000 },
    );
  }
  if (kq.khongRoKyGoc > 0) {
    // Không có ngày hóa đơn gốc thì không thể gán kỳ đúng. Chặn tờ đó thay vì tự lấy ngày
    // lập của hóa đơn điều chỉnh/thay thế, vì cách cũ có thể làm sai tờ khai.
    toast.warning(
      `${kq.khongRoKyGoc} hóa đơn thay thế/điều chỉnh chưa tra được hóa đơn gốc nên chưa được ` +
        `đưa vào bảng kê. Đồng bộ hoặc bổ sung hóa đơn gốc rồi kê khai lại.`,
    );
  }
  if (kq.daGo > 0) {
    // Gỡ khỏi kỳ là mất luôn cột "Kê khai"/"Ghi chú" của tờ đó ở kỳ này — không nói ra thì
    // kế toán tưởng mình chưa từng chỉnh.
    toast.info(
      `${kq.daGo} hóa đơn không còn thuộc kỳ ${kq.nhanKy} nên đã được gỡ khỏi bảng kê.`,
    );
  }
  if (kq.daGoKhongRoKyGoc > 0) {
    toast.info(
      `Đã gỡ ${kq.daGoKhongRoKyGoc} hóa đơn thay thế/điều chỉnh khỏi bảng kê cũ vì chưa ` +
        `xác định được hóa đơn gốc.`,
    );
  }
}

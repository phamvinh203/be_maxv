import { toast } from "react-toastify";
import { getApiError } from "@/lib/apiClient";

/**
 * Chạy một thao tác ghi của màn Chốt kỳ lương: thành công → toast xanh (câu cố định, hoặc dựng từ kết
 * quả), lỗi → toast đỏ đúng câu máy chủ trả. Không ném tiếp — lỗi đã báo cho người dùng; trả `true`
 * khi thành công để nơi gọi biết có nên đóng hộp thoại hay không.
 */
export async function chayVoiThongBao<T>(
  viec: () => Promise<T>,
  thanhCong: string | ((ketQua: T) => string),
): Promise<boolean> {
  try {
    const ketQua = await viec();
    toast.success(typeof thanhCong === "function" ? thanhCong(ketQua) : thanhCong);
    return true;
  } catch (err) {
    toast.error(getApiError(err));
    return false;
  }
}

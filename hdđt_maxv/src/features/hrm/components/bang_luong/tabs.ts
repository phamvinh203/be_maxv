/**
 * Hai màn hình con của khu "Bảng lương".
 *
 * Để ở file riêng (không nằm trong component) vì cả thanh điều hướng lẫn màn
 * hình "đang phát triển" đều đọc bảng này — thêm hay đổi tên một tab chỉ phải
 * sửa ở đây.
 */

import type { SvgIconComponent } from "@mui/icons-material";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import VolunteerActivismRounded from "@mui/icons-material/VolunteerActivismRounded";

export interface ManHinhBangLuong {
  path: string;
  label: string;
  /** Icon đứng trước nhãn tab. Giữ component, xem ghi chú ở `du_lieu_tinh_luong/tabs.ts`. */
  icon: SvgIconComponent;
  /** Một câu mô tả, hiện ở màn hình "đang phát triển" cho tới khi dựng xong. */
  moTa: string;
}

export const MAN_HINH_BANG_LUONG: ManHinhBangLuong[] = [
  {
    path: "bang-luong",
    label: "Bảng lương",
    icon: ReceiptLongRounded,
    moTa: "Bảng lương của kỳ: gộp dữ liệu từ khu Dữ liệu tính lương, tính ra lương thực nhận, bảo hiểm và thuế thu nhập cá nhân của từng nhân viên.",
  },
  {
    path: "luong-ho-tro",
    label: "Lương hỗ trợ",
    icon: VolunteerActivismRounded,
    moTa: "Các khoản hỗ trợ chi ngoài bảng lương chính — ăn ca, xăng xe, điện thoại, nhà ở.",
  },
];

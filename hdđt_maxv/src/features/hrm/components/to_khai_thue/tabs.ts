/**
 * Năm màn hình con của khu "Tờ khai thuế".
 *
 * Để ở file riêng (không nằm trong component) vì cả thanh điều hướng lẫn màn
 * hình "đang phát triển" đều đọc bảng này — thêm hay đổi tên một tab chỉ phải
 * sửa ở đây.
 */

import type { SvgIconComponent } from "@mui/icons-material";
import AddCardRounded from "@mui/icons-material/AddCardRounded";
import CalculateRounded from "@mui/icons-material/CalculateRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import RuleRounded from "@mui/icons-material/RuleRounded";

export interface ManHinhToKhaiThue {
  path: string;
  label: string;
  /** Icon đứng trước nhãn tab. Giữ component, xem ghi chú ở `du_lieu_luong/tabs.ts`. */
  icon: SvgIconComponent;
  /** Một câu mô tả, hiện ở màn hình "đang phát triển" cho tới khi dựng xong. */
  moTa: string;
}

export const MAN_HINH_TO_KHAI_THUE: ManHinhToKhaiThue[] = [
  {
    path: "thu-nhap-ngoai-luong",
    label: "Thu nhập ngoài lương",
    icon: AddCardRounded,
    moTa: "Các khoản chi trả không đi qua bảng lương — thù lao, hoa hồng đại lý, thuê khoán — vẫn phải khấu trừ và kê khai thuế TNCN.",
  },
  {
    path: "bang-tinh-thue",
    label: "Bảng tính thuế",
    icon: CalculateRounded,
    moTa: "Bảng chi tiết cách ra số thuế của từng người: thu nhập chịu thuế, các khoản giảm trừ, thu nhập tính thuế và số thuế theo từng bậc.",
  },
  {
    path: "to-khai-tncn",
    label: "Tờ khai thuế TNCN",
    icon: DescriptionRounded,
    moTa: "Tờ khai khấu trừ thuế TNCN theo tháng hoặc quý, kết xuất đúng mẫu để nộp qua cổng thuế điện tử.",
  },
  {
    path: "to-khai-quyet-toan",
    label: "Tờ khai quyết toán thuế",
    icon: AssignmentTurnedInRounded,
    moTa: "Quyết toán thuế TNCN cả năm: tổng hợp 12 kỳ, xác định số nộp thừa hay còn phải nộp của từng người.",
  },
  {
    path: "doi-soat-cong-thuc",
    label: "Đối soát - Công thức Thuế TNCN",
    icon: RuleRounded,
    moTa: "Đối chiếu số thuế phần mềm tính với số tự tính tay, và xem công thức từng bước đang áp dụng — dùng khi số liệu lệch mà chưa rõ lệch ở đâu.",
  },
];

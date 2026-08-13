/**
 * Tám màn hình con của khu "Dữ liệu tính lương".
 *
 * Để ở file riêng (không nằm trong component) vì thêm hay đổi tên một tab chỉ
 * phải sửa ở đây; thanh điều hướng chỉ việc đọc bảng này ra.
 */

import type { SvgIconComponent } from "@mui/icons-material";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import MoreTimeRounded from "@mui/icons-material/MoreTimeRounded";
import TrackChangesRounded from "@mui/icons-material/TrackChangesRounded";
import CardGiftcardRounded from "@mui/icons-material/CardGiftcardRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import PercentRounded from "@mui/icons-material/PercentRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";

export interface ManHinhDuLieuLuong {
  path: string;
  label: string;
  /**
   * Icon đứng trước nhãn tab.
   *
   * Giữ **component** chứ không phải phần tử JSX: file này là `.ts` thuần dữ
   * liệu, và để component thì mỗi chỗ dùng tự chọn cỡ icon của mình.
   */
  icon: SvgIconComponent;
}

export const MAN_HINH_DU_LIEU_LUONG: ManHinhDuLieuLuong[] = [
  { path: "cham-cong", label: "Chấm công", icon: EventAvailableRounded },
  { path: "tang-ca", label: "Tăng ca", icon: MoreTimeRounded },
  { path: "kpi", label: "KPI", icon: TrackChangesRounded },
  { path: "thuong", label: "Thưởng", icon: CardGiftcardRounded },
  { path: "luong-san-pham", label: "Lương sản phẩm", icon: Inventory2Rounded },
  { path: "luong-phan-tram", label: "Lương phần trăm", icon: PercentRounded },
  { path: "luong-chuyen-can", label: "Lương chuyên cần", icon: WorkspacePremiumRounded },
  {
    path: "ung-bu-tru",
    label: "Các khoản ứng - bù trừ lương",
    icon: SwapHorizRounded,
  },
];

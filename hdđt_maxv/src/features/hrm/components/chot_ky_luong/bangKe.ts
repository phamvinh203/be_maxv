/**
 * 12 bảng kê của màn "Chốt kỳ lương" — icon, màu nhấn và màn "Xem chi tiết" (phần trình bày thuần).
 *
 * Thứ tự và nhãn gốc do máy chủ trả (`GET .../closing`), nên mã lạ (máy chủ thêm bảng kê trước FE)
 * vẫn vẽ được bằng `BANG_KE_MAC_DINH`.
 */

import type { SvgIconComponent } from "@mui/icons-material";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import StarBorderRounded from "@mui/icons-material/StarBorderRounded";
import RemoveCircleOutlineRounded from "@mui/icons-material/RemoveCircleOutlineRounded";
import ViewInArRounded from "@mui/icons-material/ViewInArRounded";
import PercentRounded from "@mui/icons-material/PercentRounded";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import FamilyRestroomRounded from "@mui/icons-material/FamilyRestroomRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import type { MaBangKe } from "../../api/chot_ky_luong/chotKyLuongApi";

export const DUONG_DAN_CHOT_KY_LUONG = "/hrm/chot-ky-luong";

interface HienThiBangKe {
  icon: SvgIconComponent;
  /** Màu viền + icon của thẻ khi bảng kê đang mở. Đã chốt thì thẻ chuyển sang tông đỏ chung. */
  mau: string;
  /** Màn nhập/xem dữ liệu của bảng kê — `null` = chưa có màn. */
  duongDan: string | null;
}

const BANG_KE_MAC_DINH: HienThiBangKe = {
  icon: InsertDriveFileOutlined,
  mau: "#757575",
  duongDan: null,
};

const HIEN_THI_BANG_KE: Record<MaBangKe, HienThiBangKe> = {
  ATTENDANCE: { icon: EventAvailableRounded, mau: "#1e88e5", duongDan: "/hrm/du-lieu-luong/cham-cong" },
  OVERTIME: { icon: ScheduleRounded, mau: "#00897b", duongDan: "/hrm/du-lieu-luong/tang-ca" },
  KPI: { icon: BarChartRounded, mau: "#5e35b1", duongDan: "/hrm/du-lieu-luong/kpi" },
  BONUS: { icon: StarBorderRounded, mau: "#f9a825", duongDan: "/hrm/du-lieu-luong/thuong" },
  ADJUSTMENT: {
    icon: RemoveCircleOutlineRounded,
    mau: "#e53935",
    duongDan: "/hrm/du-lieu-luong/ung-bu-tru",
  },
  PIECEWORK: { icon: ViewInArRounded, mau: "#00897b", duongDan: "/hrm/du-lieu-luong/luong-san-pham" },
  COMMISSION: { icon: PercentRounded, mau: "#3949ab", duongDan: "/hrm/du-lieu-luong/luong-phan-tram" },
  OTHER_INCOME: {
    icon: AccountBalanceWalletOutlined,
    mau: "#8e24aa",
    duongDan: "/hrm/to-khai-thue/thu-nhap-ngoai-luong",
  },
  DILIGENCE: {
    icon: RadioButtonUncheckedRounded,
    mau: "#757575",
    duongDan: "/hrm/du-lieu-luong/luong-chuyen-can",
  },
  TAX_DEDUCTION: {
    icon: FamilyRestroomRounded,
    mau: "#757575",
    duongDan: "/hrm/danh-muc/nguoi-phu-thuoc",
  },
  SALARY_PROFILE: { icon: SettingsRounded, mau: "#5e35b1", duongDan: "/hrm/cai-dat-luong/set-luong" },
  SUPPORT_ALLOWANCE: {
    icon: FavoriteBorderRounded,
    mau: "#d81b60",
    duongDan: "/hrm/bang-luong/luong-ho-tro",
  },
};

export function hienThiBangKe(ma: string): HienThiBangKe {
  return HIEN_THI_BANG_KE[ma as MaBangKe] ?? BANG_KE_MAC_DINH;
}

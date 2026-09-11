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

interface DinhNghiaBangKe {
  icon: SvgIconComponent;
  /** Màu viền + icon của thẻ khi bảng kê đang mở, cặp [sáng, tối]. Đã chốt thì thẻ chuyển sang
   * tông đỏ chung (`theme.palette.error.main`, xem `TheBangKe.tsx`). */
  mau: readonly [string, string];
  /** Màn nhập/xem dữ liệu của bảng kê — `null` = chưa có màn. */
  duongDan: string | null;
}

export interface HienThiBangKe {
  icon: SvgIconComponent;
  mau: string;
  duongDan: string | null;
}

// 12 màu ĐỊNH DANH phân biệt từng loại bảng kê (không quy về vài token theme được) — cặp [sáng,
// tối] cùng họ Material (600 ở nền sáng, 300-400 ở nền tối) để vẫn đủ tương phản trên nền tối
// #121212, theo đúng cách `dashboard/charts/mauBieuDo.ts` đã làm cho biểu đồ (RVW-A14).
const MAC_DINH: DinhNghiaBangKe = {
  icon: InsertDriveFileOutlined,
  mau: ["#757575", "#bdbdbd"],
  duongDan: null,
};

const DINH_NGHIA_BANG_KE: Record<MaBangKe, DinhNghiaBangKe> = {
  ATTENDANCE: {
    icon: EventAvailableRounded,
    mau: ["#1e88e5", "#42a5f5"],
    duongDan: "/hrm/du-lieu-luong/cham-cong",
  },
  OVERTIME: {
    icon: ScheduleRounded,
    mau: ["#00897b", "#26a69a"],
    duongDan: "/hrm/du-lieu-luong/tang-ca",
  },
  KPI: { icon: BarChartRounded, mau: ["#5e35b1", "#7e57c2"], duongDan: "/hrm/du-lieu-luong/kpi" },
  BONUS: {
    icon: StarBorderRounded,
    mau: ["#f9a825", "#ffca28"],
    duongDan: "/hrm/du-lieu-luong/thuong",
  },
  ADJUSTMENT: {
    icon: RemoveCircleOutlineRounded,
    mau: ["#e53935", "#ef5350"],
    duongDan: "/hrm/du-lieu-luong/ung-bu-tru",
  },
  PIECEWORK: {
    icon: ViewInArRounded,
    mau: ["#00897b", "#26a69a"],
    duongDan: "/hrm/du-lieu-luong/luong-san-pham",
  },
  COMMISSION: {
    icon: PercentRounded,
    mau: ["#3949ab", "#5c6bc0"],
    duongDan: "/hrm/du-lieu-luong/luong-phan-tram",
  },
  OTHER_INCOME: {
    icon: AccountBalanceWalletOutlined,
    mau: ["#8e24aa", "#ba68c8"],
    duongDan: "/hrm/to-khai-thue/thu-nhap-ngoai-luong",
  },
  DILIGENCE: {
    icon: RadioButtonUncheckedRounded,
    mau: ["#757575", "#bdbdbd"],
    duongDan: "/hrm/du-lieu-luong/luong-chuyen-can",
  },
  TAX_DEDUCTION: {
    icon: FamilyRestroomRounded,
    mau: ["#757575", "#bdbdbd"],
    duongDan: "/hrm/danh-muc/nguoi-phu-thuoc",
  },
  SALARY_PROFILE: {
    icon: SettingsRounded,
    mau: ["#5e35b1", "#7e57c2"],
    duongDan: "/hrm/cai-dat-luong/set-luong",
  },
  SUPPORT_ALLOWANCE: {
    icon: FavoriteBorderRounded,
    mau: ["#d81b60", "#f06292"],
    duongDan: "/hrm/bang-luong/luong-ho-tro",
  },
};

/** `toi` = `theme.palette.mode === "dark"` của lúc gọi — component tự đọc theme rồi truyền vào,
 * hàm này KHÔNG dùng hook để giữ thuần (test được không cần render). */
export function hienThiBangKe(ma: string, toi: boolean): HienThiBangKe {
  const dn = DINH_NGHIA_BANG_KE[ma as MaBangKe] ?? MAC_DINH;
  return { icon: dn.icon, mau: toi ? dn.mau[1] : dn.mau[0], duongDan: dn.duongDan };
}

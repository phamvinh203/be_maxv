import { useTheme } from "@mui/material/styles";

/*
 * Ba ô đầu của bảng màu categorical tham chiếu, đã chạy validate_palette trên ĐÚNG nền Paper
 * của app (sáng #ffffff, tối #121212): PASS dải sáng, độ bão hòa, tách màu cho người mù màu
 * (ΔE 9.2 / 9.4) và sàn thị giác thường. Riêng aqua ở nền sáng dưới 3:1 → nơi nào dùng ô thứ
 * ba phải có nhãn chữ hiển thị kèm số (legend của `ThanhTyLe` làm việc đó).
 *
 * Màu dữ liệu tách khỏi màu nhấn (accent) người dùng chọn trong Cài đặt: đổi accent sang tím
 * không được làm biểu đồ mất khả năng phân biệt chuỗi.
 */
const CHUOI_SANG = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
const CHUOI_TOI = ["#3987e5", "#d95926", "#199e70"] as const;

export interface MauBieuDo {
  /** Thứ tự CỐ ĐỊNH — chuỗi thứ n luôn là ô thứ n, không xoay vòng, không đổi theo thứ hạng. */
  chuoi: readonly [string, string, string];
  /** Hạng mục "chưa có"/"khác" — xám trung tính, không chiếm một màu chuỗi. */
  trungTinh: string;
  luoi: string;
  truc: string;
  /** Màu nền biểu đồ — dùng cho khe 2px giữa các mảng và vòng quanh điểm đánh dấu. */
  nen: string;
  /** Lớp phủ nhạt của cột/băng đang rê chuột. */
  nenChon: string;
  chu: string;
  chuPhu: string;
}

export function useMauBieuDo(): MauBieuDo {
  const theme = useTheme();
  const toi = theme.palette.mode === "dark";
  return {
    chuoi: toi ? CHUOI_TOI : CHUOI_SANG,
    trungTinh: toi ? "#5f5e5a" : "#c3c2b7",
    luoi: toi ? "#2c2c2a" : "#ebeae6",
    truc: toi ? "#4a4946" : "#c3c2b7",
    nen: theme.palette.background.paper,
    nenChon: theme.palette.action.hover,
    chu: theme.palette.text.primary,
    chuPhu: theme.palette.text.secondary,
  };
}

/** Ẩn khỏi mắt nhưng trình đọc màn hình vẫn đọc được — bảng số liệu song song với biểu đồ. */
export const AN_TREN_MAN_HINH = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
} as const;

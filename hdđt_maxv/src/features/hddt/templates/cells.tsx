/**
 * Ô render riêng cho BẢNG TRÊN WEB (có màu, có icon…) — dùng ở thuộc tính `cell` của cột.
 * Tách khỏi `dauVao`/`dauRa` để hai file khai báo cột thuần dữ liệu (.ts, không JSX).
 */
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { ttTaiLabel } from "../format";
import { NO_DATA_YET } from "./types";

// Hằng ngoài hàm: object `sx` mới mỗi ô sẽ bắt emotion serialize lại cho từng dòng của bảng.
const TT_TAI_OK_SX = { color: "success.main", fontWeight: 600 };
const TT_TAI_ERR_SX = { color: "error.main", fontWeight: 600 };

/** Ô "T. thái tải": OK (xanh) / Lỗi (đỏ) theo `tt_tai`; chưa tải -> "—". */
export function ttTaiCell(v?: string): ReactNode {
  const label = ttTaiLabel(v);
  if (!label) return NO_DATA_YET;
  return (
    <Box component="span" sx={v === "OK" ? TT_TAI_OK_SX : TT_TAI_ERR_SX}>
      {label}
    </Box>
  );
}

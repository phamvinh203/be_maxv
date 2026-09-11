/**
 * Hằng số + tiện ích dùng chung cho các file Excel của khu Bảng lương —
 * `bangLuongExcel.ts` và `luongHoTroExcel.ts`. Trước đây mỗi file tự chép tay
 * `taiVe`/`toTieuDe` (xem `docs/hrm/review-findings.md` RVW-A05); `lib/downloadFile.ts`
 * đã có `luuVeMay` dùng chung toàn app nên chỗ này chỉ còn phần đặc thù của Excel.
 */

import type { Worksheet } from "exceljs";
import { luuVeMay } from "@/lib/downloadFile";

export const HEADER_FILL = "FFDDE6F2";
export const TONG_FILL = "FFF3E8D2";
export const TIEN_FMT = "#,##0";

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Đẩy buffer `.xlsx` xuống máy qua `luuVeMay` dùng chung toàn app. */
export function taiVeExcel(buffer: ArrayBuffer, filename: string): void {
  luuVeMay(new Blob([buffer], { type: MIME_XLSX }), filename);
}

/** Tô nền + in đậm 1 hàng (tiêu đề cột hoặc dòng tổng). */
export function toTieuDe(ws: Worksheet, hang: number, soCot: number, mau: string): void {
  const row = ws.getRow(hang);
  for (let i = 1; i <= soCot; i += 1) {
    row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mau } };
  }
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 32;
}

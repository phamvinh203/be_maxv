/**
 * Tiện ích dùng chung cho 7 file `*Excel.ts` của "Dữ liệu tính lương" (KPI,
 * Thưởng, Bù trừ, Lương sản phẩm, Lương phần trăm, Tăng ca, Chuyên cần) — đọc
 * ô số, tải file, tô tiêu đề bảng (RVW-706 + RVW-713).
 *
 * Trước đây mỗi module tự chép một hàm `soO()` xử lý cả cột TIỀN (dấu chấm là
 * phân cách nghìn kiểu Việt) lẫn cột SỐ THẬP PHÂN (dấu chấm là dấu thập phân)
 * bằng CÙNG một quy tắc "bỏ hết dấu chấm" — đúng cho tiền nhưng sai cho thập
 * phân: ô ghi `1.5` (vd Mục tiêu KPI, Số lượng sản phẩm) bị đọc thành `15`
 * (RVW-706). Tách rõ 2 hàm, mỗi cột trong từng `*Excel.ts` gọi đúng loại.
 *
 * `chuoiO`/`taiXlsx`/`toTieuDe`/`HEADER_FILL`/`TIEN_FMT` gom về đây vì y hệt
 * nhau ở 6/7 file (RVW-713) — RIÊNG `chuyenCanExcel.ts` giữ `chuoiO` RIÊNG vì
 * có thêm nhánh đọc `Date` (ô "Ngày") mà 6 file kia không cần, KHÔNG dùng bản
 * `chuoiO` chung ở đây cho việc đó.
 */

import type { CellValue, Worksheet } from "exceljs";
import { luuVeMay } from "../../../../../lib/downloadFile";

/** Ô Excel có thể là số, chuỗi, công thức hoặc rich text — ép về chuỗi đã trim. */
export function chuoiO(giaTri: CellValue): string {
  if (giaTri === null || giaTri === undefined) return "";
  if (typeof giaTri === "object") {
    if ("richText" in giaTri) return giaTri.richText.map((p) => p.text).join("").trim();
    if ("text" in giaTri) return String(giaTri.text).trim();
    if ("result" in giaTri) return String(giaTri.result ?? "").trim();
    return "";
  }
  return String(giaTri).trim();
}

/** Bỏ ký hiệu đơn vị hay gặp (₫, đ, %, h) trước khi parse số. */
function boKyHieuDonVi(text: string): string {
  return text.replace(/[₫đ%h]/gi, "");
}

/**
 * Ô TIỀN của file người dùng sửa tay: chấp nhận cả `1.234.567` (dấu chấm phân
 * cách nghìn kiểu Việt) lẫn `1234567`. KHÔNG dùng cho cột có phần thập phân —
 * dấu chấm bị bỏ hoàn toàn nên `1.5` sẽ thành `15`.
 */
export function soTien(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = boKyHieuDonVi(chuoiO(giaTri).replace(/\s/g, ""))
    .replace(/\./g, "")
    .replace(",", ".");
  if (!text) return 0;
  const so = Number(text);
  return Number.isFinite(so) ? so : 0;
}

/**
 * Ô SỐ THẬP PHÂN (số lượng, giờ, tỉ lệ %, trọng số...): giữ nguyên dấu chấm là
 * dấu thập phân, chỉ đổi dấu phẩy kiểu Excel tiếng Việt (`1,5`) thành `.`.
 */
export function soThapPhan(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = boKyHieuDonVi(chuoiO(giaTri).replace(/\s/g, "")).replace(",", ".");
  if (!text) return 0;
  const so = Number(text);
  return Number.isFinite(so) ? so : 0;
}

/** Màu nền tiêu đề bảng — dùng trong `toTieuDe`. */
export const HEADER_FILL = "FFDDE6F2";

/** Định dạng số nguyên có dấu chấm phân cách nghìn — áp cho mọi cột tiền. */
export const TIEN_FMT = "#,##0";

/** Tiêu đề in đậm, nền nhạt — dùng cho mọi sheet của "Dữ liệu tính lương". */
export function toTieuDe(ws: Worksheet, soCot: number): void {
  const row = ws.getRow(1);
  for (let i = 1; i <= soCot; i += 1) {
    row.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
  }
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

/**
 * Tải file .xlsx đã dựng trong bộ nhớ xuống máy — bọc `luuVeMay` (dùng chung
 * TOÀN APP, `@/lib/downloadFile`) với đúng MIME type Excel, thay 7 bản `taiVe`
 * trùng byte-for-byte trước đây (RVW-713).
 */
export function taiXlsx(buffer: ArrayBuffer, filename: string): void {
  luuVeMay(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

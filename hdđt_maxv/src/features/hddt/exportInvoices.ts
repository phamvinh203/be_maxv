import { backupColumns, fileColumns } from "./templates";
import type { DisplayRow } from "./types";

/**
 * Bọc 1 ô CSV: escape dấu nháy kép và bọc trong "" nếu chứa ký tự đặc biệt.
 * Dùng: nội bộ file này — `exportSavedBackupCsv` (cho cả header lẫn từng ô).
 */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Ghi mảng dòng CSV ra file + kích hoạt tải về. Có BOM UTF-8 để Excel hiển thị đúng tiếng Việt.
 * Dùng: nội bộ file này — `exportSavedBackupCsv`.
 */
function downloadCsv(lines: string[], filename: string): void {
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sao lưu TOÀN BỘ hóa đơn đã lưu (cả 2 chiều) ra 1 file CSV, có cột "Chiều" phân biệt.
 * Cột lấy từ `templates/backupColumns` (danh sách cố ý hẹp hơn bảng "Tổng quát").
 * Dùng: `SystemDataTab` — nút "Xuất / Sao lưu dữ liệu".
 */
export function exportSavedBackupCsv(purchase: DisplayRow[], sold: DisplayRow[]): void {
  // Qua `fileColumns` như mọi kênh ghi file: luật "cột webOnly không bao giờ ra file" phải thuộc
  // về kênh, không phụ thuộc việc danh sách cột hiện tại tình cờ chưa có cột webOnly nào.
  const cols = fileColumns(backupColumns());
  const tagged = [
    ...purchase.map((r) => ({ chieu: "Mua vào", r })),
    ...sold.map((r) => ({ chieu: "Bán ra", r })),
  ];
  const header = ["Chiều", ...cols.map((c) => c.header)].map(csvCell).join(",");
  const body = tagged.map(({ chieu, r }, i) =>
    // `?? ""` vì cột không có dữ liệu trả `undefined` — ô CSV phải trống, không phải chữ "undefined".
    [csvCell(chieu), ...cols.map((c) => csvCell(c.value(r, i + 1) ?? ""))].join(","),
  );
  downloadCsv([header, ...body], "sao-luu-hoa-don.csv");
}

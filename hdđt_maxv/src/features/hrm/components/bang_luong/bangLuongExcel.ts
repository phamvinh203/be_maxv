/**
 * Xuất bảng lương ra Excel.
 *
 * Khác các màn của khu Dữ liệu tính lương, ở đây **không có** tải mẫu và nhập
 * Excel: bảng lương là số tính ra, nhập ngược vào chỉ tạo ra một bản số liệu
 * không khớp với nguồn. Muốn đổi số thì sửa ở màn nguồn rồi tính lại.
 */

import type { Workbook, Worksheet } from "exceljs";
import { COT_BANG_LUONG, tongTheoCot } from "./cotBangLuong";
import type { DongBangLuong } from "../../types";

const HEADER_FILL = "FFDDE6F2";
const TONG_FILL = "FFF3E8D2";
const TIEN_FMT = "#,##0";

function taiVe(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toTieuDe(ws: Worksheet, hang: number, soCot: number, mau: string): void {
  const row = ws.getRow(hang);
  for (let i = 1; i <= soCot; i += 1) {
    row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mau } };
  }
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 32;
}

/** Sheet giải thích các khoản không có cột riêng — xem ghi chú ở `BangLuongTable`. */
function themSheetChiTiet(wb: Workbook, rows: DongBangLuong[]): void {
  const ws = wb.addWorksheet("Chi tiết thu nhập");
  ws.columns = [
    { header: "Mã", width: 12 },
    { header: "Họ và tên", width: 26 },
    { header: "Lương theo ngày", width: 16 },
    { header: "Tiền tăng ca", width: 16 },
    { header: "Lương sản phẩm", width: 16 },
    { header: "Thưởng", width: 14 },
    { header: "KPI", width: 14 },
    { header: "Lương phần trăm", width: 16 },
    { header: "Chuyên cần", width: 14 },
    { header: "Thu nhập", width: 16 },
  ];
  for (let i = 3; i <= 10; i += 1) ws.getColumn(i).numFmt = TIEN_FMT;
  toTieuDe(ws, 1, 10, HEADER_FILL);
  for (const row of rows) {
    ws.addRow([
      row.ma_nv,
      row.ho_ten,
      row.luong_theo_ngay,
      row.tien_tang_ca,
      row.luong_san_pham,
      row.thuong,
      row.kpi,
      row.luong_phan_tram,
      row.chuyen_can,
      row.thu_nhap,
    ]);
  }
}

/**
 * Xuất bảng lương của kỳ.
 *
 * Luôn xuất **đủ 18 cột** và luôn theo **đồng**, bất kể màn hình đang để "Rút
 * gọn" hay đang xem theo nghìn/triệu: file này đi kèm chứng từ chi lương, thiếu
 * cột hay làm tròn về triệu là không đối chiếu được với phiếu chi.
 */
export async function xuatBangLuongExcel(
  rows: DongBangLuong[],
  nhanKy: string,
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Bảng lương");

  const soCot = COT_BANG_LUONG.length;
  ws.columns = COT_BANG_LUONG.map((c) => ({ width: c.text ? 26 : 16 }));
  for (let i = 1; i <= soCot; i += 1) {
    if (COT_BANG_LUONG[i - 1]?.tien) ws.getColumn(i).numFmt = TIEN_FMT;
  }

  // Dòng 1: tên bảng + kỳ, gộp hết bề ngang — file rời khỏi máy vẫn tự nói được
  // nó là bảng lương của tháng nào.
  ws.mergeCells(1, 1, 1, soCot);
  const tieuDe = ws.getCell(1, 1);
  tieuDe.value = `BẢNG LƯƠNG ${nhanKy.toUpperCase()}`;
  tieuDe.font = { bold: true, size: 14 };
  tieuDe.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 26;

  const hangTieuDe = 3;
  const rowTieuDe = ws.getRow(hangTieuDe);
  COT_BANG_LUONG.forEach((c, i) => {
    rowTieuDe.getCell(i + 1).value = c.header;
  });
  toTieuDe(ws, hangTieuDe, soCot, HEADER_FILL);

  rows.forEach((row, i) => {
    const r = ws.getRow(hangTieuDe + 1 + i);
    COT_BANG_LUONG.forEach((c, ci) => {
      r.getCell(ci + 1).value = c.text ? c.text(row) : c.value(row);
    });
  });

  // Dòng tổng ngay dưới vùng dữ liệu, tô khác màu.
  const tong = tongTheoCot(COT_BANG_LUONG, rows);
  const hangTong = hangTieuDe + 1 + rows.length;
  const rowTong = ws.getRow(hangTong);
  COT_BANG_LUONG.forEach((c, i) => {
    const cell = rowTong.getCell(i + 1);
    if (i === 0) cell.value = "TỔNG CỘNG";
    else if (c.cong) cell.value = tong.get(c.key) ?? 0;
  });
  toTieuDe(ws, hangTong, soCot, TONG_FILL);
  rowTong.alignment = { vertical: "middle" };

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: hangTieuDe }];

  themSheetChiTiet(wb, rows);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, `Bang-luong-${nhanKy.replace(/\W+/g, "-")}.xlsx`);
}

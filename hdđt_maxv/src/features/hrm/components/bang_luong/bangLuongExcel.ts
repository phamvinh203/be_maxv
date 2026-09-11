/**
 * Xuất bảng lương ra Excel.
 *
 * Khác các màn của khu Dữ liệu tính lương, ở đây **không có** tải mẫu và nhập
 * Excel: bảng lương là số tính ra, nhập ngược vào chỉ tạo ra một bản số liệu
 * không khớp với nguồn. Muốn đổi số thì sửa ở màn nguồn rồi tính lại.
 */

import type { Workbook } from "exceljs";
import { COT_BANG_LUONG, tongTheoCot } from "./cotBangLuong";
import { HEADER_FILL, TIEN_FMT, TONG_FILL, taiVeExcel, toTieuDe } from "./excelChung";
import type { DongBangLuong } from "../../types";

/** Định dạng riêng cột "Các khoản bù trừ": ghi giá trị đảo dấu (xem `dauNguoc`) nên
 * số dương hiện có tiền tố "+", số âm hiện tiền tố "-" — cùng quy ước "+"/"−" với bảng
 * trên màn hình thay vì để Excel tự hiểu theo dấu gốc trong DB (RVW-A02). */
const BU_TRU_FMT = `"+"${TIEN_FMT};"-"${TIEN_FMT};0`;

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
 * Luôn xuất **đủ 19 cột** và luôn theo **đồng**, bất kể màn hình đang để "Rút
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
    const c = COT_BANG_LUONG[i - 1];
    if (!c?.tien) continue;
    ws.getColumn(i).numFmt = c.dauNguoc ? BU_TRU_FMT : TIEN_FMT;
  }

  // Dòng 1: tên bảng + kỳ, gộp hết bề ngang — file rời khỏi máy vẫn tự nói được
  // nó là bảng lương của tháng nào.
  ws.mergeCells(1, 1, 1, soCot);
  const tieuDe = ws.getCell(1, 1);
  tieuDe.value = `BẢNG LƯƠNG ${nhanKy.toUpperCase()}`;
  tieuDe.font = { bold: true, size: 14 };
  tieuDe.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 26;

  // Dòng 2: sheet chính chỉ 5/7 cột cấu thành "Thu nhập" (thiếu Lương % và Chuyên
  // cần) — không có dòng này, người nhận cộng lệch số rồi tưởng sai (RVW-A03).
  ws.mergeCells(2, 1, 2, soCot);
  const ghiChu = ws.getCell(2, 1);
  ghiChu.value =
    "Cột \"Thu nhập\" gồm cả Lương % và Chuyên cần (không có cột riêng ở sheet này) — xem đủ 7 khoản cấu thành ở sheet \"Chi tiết thu nhập\".";
  ghiChu.font = { italic: true, size: 10, color: { argb: "FF6B6B6B" } };
  ghiChu.alignment = { vertical: "middle", horizontal: "center" };

  const hangTieuDe = 4;
  const rowTieuDe = ws.getRow(hangTieuDe);
  COT_BANG_LUONG.forEach((c, i) => {
    rowTieuDe.getCell(i + 1).value = c.header;
  });
  toTieuDe(ws, hangTieuDe, soCot, HEADER_FILL);

  rows.forEach((row, i) => {
    const r = ws.getRow(hangTieuDe + 1 + i);
    COT_BANG_LUONG.forEach((c, ci) => {
      if (c.text) {
        r.getCell(ci + 1).value = c.text(row);
        return;
      }
      const so = c.value(row);
      r.getCell(ci + 1).value = c.dauNguoc ? -so : so;
    });
  });

  // Dòng tổng ngay dưới vùng dữ liệu, tô khác màu.
  const tong = tongTheoCot(COT_BANG_LUONG, rows);
  const hangTong = hangTieuDe + 1 + rows.length;
  const rowTong = ws.getRow(hangTong);
  COT_BANG_LUONG.forEach((c, i) => {
    const cell = rowTong.getCell(i + 1);
    if (i === 0) cell.value = "TỔNG CỘNG";
    else if (c.cong) {
      const t = tong.get(c.key) ?? 0;
      cell.value = c.dauNguoc ? -t : t;
    }
  });
  toTieuDe(ws, hangTong, soCot, TONG_FILL);
  rowTong.alignment = { vertical: "middle" };

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: hangTieuDe }];

  themSheetChiTiet(wb, rows);
  taiVeExcel(
    (await wb.xlsx.writeBuffer()) as ArrayBuffer,
    `Bang-luong-${nhanKy.replace(/\W+/g, "-")}.xlsx`,
  );
}

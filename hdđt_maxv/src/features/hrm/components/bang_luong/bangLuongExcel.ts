/**
 * Xuất bảng lương ra Excel.
 *
 * Khác các màn của khu Dữ liệu tính lương, ở đây **không có** tải mẫu và nhập
 * Excel: bảng lương là số tính ra, nhập ngược vào chỉ tạo ra một bản số liệu
 * không khớp với nguồn. Muốn đổi số thì sửa ở màn nguồn rồi tính lại.
 */

import { COT_BANG_LUONG, tongTheoCot } from "./cotBangLuong";
import { HEADER_FILL, TIEN_FMT, TONG_FILL, taiVeExcel, toTieuDe } from "./excelChung";
import type { DongBangLuong } from "../../types";

/** Định dạng riêng cột "Các khoản bù trừ": ghi giá trị đảo dấu (xem `dauNguoc`) nên
 * số dương hiện có tiền tố "+", số âm hiện tiền tố "-" — cùng quy ước "+"/"−" với bảng
 * trên màn hình thay vì để Excel tự hiểu theo dấu gốc trong DB (RVW-A02). */
const BU_TRU_FMT = `"+"${TIEN_FMT};"-"${TIEN_FMT};0`;

/**
 * Xuất bảng lương của kỳ.
 *
 * Luôn xuất **đủ 21 cột** và luôn theo **đồng**, bất kể màn hình đang để "Rút
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

  const hangTieuDe = 2;
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

  taiVeExcel(
    (await wb.xlsx.writeBuffer()) as ArrayBuffer,
    `Bang-luong-${nhanKy.replace(/\W+/g, "-")}.xlsx`,
  );
}

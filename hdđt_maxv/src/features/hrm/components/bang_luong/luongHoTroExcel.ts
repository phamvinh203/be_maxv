/**
 * Xuất bảng lương hỗ trợ.
 *
 * Cột động theo danh mục khoản hỗ trợ đang dùng, đúng như bảng trên màn hình —
 * thêm một khoản hỗ trợ ở Cài đặt lương là cả hai chỗ cùng có thêm cột.
 */

import type { Worksheet } from "exceljs";
import type { DongLuongHoTro, KhoanLuong } from "../../types";

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

function toHang(ws: Worksheet, hang: number, soCot: number, mau: string): void {
  const row = ws.getRow(hang);
  for (let i = 1; i <= soCot; i += 1) {
    row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mau } };
  }
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 32;
}

/**
 * Xuất bảng lương hỗ trợ của kỳ.
 *
 * Số ghi ra là mức **đã quy theo ngày công**, đúng con số nằm trong bảng lương —
 * xuất mức tháng thì cộng lại không khớp cột "Thu nhập" bên tab Bảng lương. Mức
 * tháng vẫn có, ở cột riêng cuối bảng để đối chiếu.
 */
export async function xuatLuongHoTroExcel(
  rows: DongLuongHoTro[],
  khoanHoTro: KhoanLuong[],
  nhanKy: string,
): Promise<void> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet("Lương hỗ trợ");

  const coDinh = ["Mã", "Họ và tên", "Bộ phận", "Chức vụ", "Ngày công"];
  const tieuDeCot = [
    ...coDinh,
    ...khoanHoTro.map((kl) => kl.ten_khoan),
    "Tổng hỗ trợ",
    "Mức tháng",
  ];
  const soCot = tieuDeCot.length;

  ws.columns = tieuDeCot.map((_, i) => ({ width: i === 1 || i === 2 ? 26 : 16 }));
  for (let i = coDinh.length + 1; i <= soCot; i += 1) ws.getColumn(i).numFmt = TIEN_FMT;

  ws.mergeCells(1, 1, 1, soCot);
  const tieuDe = ws.getCell(1, 1);
  tieuDe.value = `LƯƠNG HỖ TRỢ ${nhanKy.toUpperCase()}`;
  tieuDe.font = { bold: true, size: 14 };
  tieuDe.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 26;

  const hangTieuDe = 3;
  const rowTieuDe = ws.getRow(hangTieuDe);
  tieuDeCot.forEach((text, i) => {
    rowTieuDe.getCell(i + 1).value = text;
  });
  toHang(ws, hangTieuDe, soCot, HEADER_FILL);

  rows.forEach((row, i) => {
    const r = ws.getRow(hangTieuDe + 1 + i);
    const gia: (string | number)[] = [
      row.ma_nv,
      row.ho_ten,
      row.ten_pb,
      row.ten_cv,
      `${row.ngay_cong}/${row.ngay_cong_chuan}`,
      ...khoanHoTro.map((kl) => row.khoan[kl.ma_khoan] ?? 0),
      row.tong,
      row.tong_muc_thang,
    ];
    gia.forEach((v, ci) => {
      r.getCell(ci + 1).value = v;
    });
  });

  const hangTong = hangTieuDe + 1 + rows.length;
  const rowTong = ws.getRow(hangTong);
  rowTong.getCell(1).value = "TỔNG CỘNG";
  khoanHoTro.forEach((kl, i) => {
    rowTong.getCell(coDinh.length + 1 + i).value = rows.reduce(
      (tong, row) => tong + (row.khoan[kl.ma_khoan] ?? 0),
      0,
    );
  });
  rowTong.getCell(coDinh.length + khoanHoTro.length + 1).value = rows.reduce(
    (tong, row) => tong + row.tong,
    0,
  );
  rowTong.getCell(soCot).value = rows.reduce((tong, row) => tong + row.tong_muc_thang, 0);
  toHang(ws, hangTong, soCot, TONG_FILL);
  rowTong.alignment = { vertical: "middle" };

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: hangTieuDe }];

  taiVe(
    (await wb.xlsx.writeBuffer()) as ArrayBuffer,
    `Luong-ho-tro-${nhanKy.replace(/\W+/g, "-")}.xlsx`,
  );
}

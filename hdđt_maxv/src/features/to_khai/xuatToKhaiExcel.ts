import ExcelJS from "exceljs";
import { CELL_BORDER, HEADER_FILL, HEADER_HEIGHT } from "../hddt/xlsxStyle";
import { HANG_GTGT01, maChiTieu } from "../_shared/to_khai/gtgt01Layout";
import type { BanToKhai } from "./api/gtgt01";
import { nhanKy, type Ky } from "./ky";
import { luuVeMay } from "../../lib/downloadFile";

/**
 * Xuất tờ khai đang xem ra Excel — bố cục bám mẫu in: STT, chỉ tiêu (thụt lề theo cấp), giá trị,
 * thuế, kèm cột đánh dấu ô nào kế toán đã sửa tay.
 *
 * Cột "Ghi chú" tồn tại vì file này đi ra ngoài cho người khác soát: nhìn con số không biết máy
 * tính ra hay người sửa, mà đó đúng là câu hỏi đầu tiên người soát sẽ hỏi.
 *
 * Dùng lại ba hằng định dạng của `hddt/exportXlsx.ts`, không khai bản riêng.
 */

/** Thụt lề cột "Chỉ tiêu" theo cấp — Excel không có padding nên chèn khoảng trắng. */
const THUT_LE = "    ";

/**
 * numFmt cho mọi cột tiền của file — số âm hiện trong NGOẶC, khớp `fmtSoTien` trên màn hình
 * (`(1.446.670)`), không phải dấu trừ Excel mặc định (`-1.446.670`). Ô âm là chuyện bình thường
 * (kỳ trả hàng nhiều hơn bán — xem `tienVnd.ts`); người đối chiếu màn hình với file không nên thấy
 * hai cách viết cho cùng một số.
 */
const NUM_FMT_TIEN = "#,##0;(#,##0)";

function tenFile(ky: Ky): string {
  return `ToKhai01GTGT_${nhanKy(ky).replace("/", "-")}.xlsx`;
}

/**
 * Sheet thứ hai — phụ lục giảm thuế NQ 204/2025, chỉ thêm khi kỳ CÓ hàng 8%.
 *
 * Tách sheet riêng chứ không nối xuống dưới tờ khai chính: đây là hai biểu mẫu khác nhau, cơ quan
 * thuế nhận hai tờ, và người soát cũng đọc từng tờ một.
 */
function themSheetPhuLuc(wb: ExcelJS.Workbook, ky: Ky, pl: NonNullable<BanToKhai["phuLuc"]>): void {
  const ws = wb.addWorksheet("PL 204-2025");
  const tieuDe = (cells: (string | number | null)[]) => {
    const row = ws.addRow(cells);
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.border = CELL_BORDER;
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    row.height = HEADER_HEIGHT;
  };
  const duLieu = (cells: (string | number | null)[], cotSo: number[]) => {
    const row = ws.addRow(cells);
    // `includeEmpty: true`: thiếu cờ này, exceljs bỏ qua ô có giá trị `null` (`Row.eachCell` mặc
    // định lướt qua ô rỗng) — ô nào trong `cells` là `null` thì mất viền, bảng in ra hở góc.
    row.eachCell({ includeEmpty: true }, (cell) => (cell.border = CELL_BORDER));
    for (const i of cotSo) row.getCell(i).numFmt = NUM_FMT_TIEN;
  };

  ws.addRow([`GIẢM THUẾ GIÁ TRỊ GIA TĂNG THEO NGHỊ QUYẾT SỐ 204/2025/QH15`]);
  ws.addRow([`(Kèm theo Tờ khai thuế GTGT kỳ tính thuế ${nhanKy(ky)})`]);
  ws.addRow([]);

  ws.addRow(["I. Hàng hóa, dịch vụ mua vào trong kỳ được áp dụng thuế suất 8%"]).font = {
    bold: true,
  };
  tieuDe(["Tên hàng hóa, dịch vụ", "Giá trị chưa thuế", "Thuế GTGT được khấu trừ"]);
  duLieu([pl.muaVao.tenHang, pl.muaVao.giaTri, pl.muaVao.thue], [2, 3]);
  ws.addRow([]);

  ws.addRow(["II. Hàng hóa, dịch vụ bán ra trong kỳ"]).font = { bold: true };
  tieuDe([
    "Tên hàng hóa, dịch vụ",
    "Giá trị chưa thuế",
    "Thuế suất theo quy định",
    "Thuế suất sau giảm",
    "Thuế GTGT được giảm",
  ]);
  duLieu(
    [
      pl.banRa.tenHang,
      pl.banRa.giaTri,
      `${pl.banRa.thueSuatQuyDinh}%`,
      `${pl.banRa.thueSuatSauGiam}%`,
      pl.banRa.thueDuocGiam,
    ],
    [2, 5],
  );
  ws.addRow([]);

  const dongIII = ws.addRow([
    "III. Chênh lệch thuế GTGT của hàng hóa, dịch vụ bán ra và mua vào [09] = [08] - [06]",
    pl.chenhLech,
  ]);
  dongIII.getCell(2).numFmt = NUM_FMT_TIEN;
  dongIII.font = { bold: true };

  ws.getColumn(1).width = 60;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 22;
}

export async function xuatToKhaiGtgt01(
  ky: Ky,
  ban: BanToKhai,
  donVi: { mst: string; tenCongTy: string },
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("01-GTGT");

  // Hai dòng đầu để file rời khỏi máy vẫn tự nói được của công ty nào — cùng quy ước với
  // `hddt/exportXlsx.ts`. Thiếu chúng thì hai file cùng tên `ToKhai01GTGT_T7-2026.xlsx` của hai
  // MST khác nhau (đổi công ty trong cùng buổi làm việc) không còn cách nào phân biệt.
  ws.addRow([`MST: ${donVi.mst}`]);
  ws.addRow([`Công ty: ${donVi.tenCongTy}`]);
  ws.addRow([`TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT) — Kỳ ${nhanKy(ky)}`]);
  ws.addRow([`Trạng thái: ${ban.trangThai === "chot" ? "Đã chốt" : "Bản nháp"}`]);
  ws.addRow([
    `Nguồn: ${ban.soHdBan} hóa đơn bán ra, ${ban.soHdMua} hóa đơn mua vào` +
      (ban.soHdKhongKeKhai > 0 ? `, ${ban.soHdKhongKeKhai} hóa đơn không kê khai` : ""),
  ]);
  ws.addRow([]);

  const dongTieuDe = ws.addRow(["STT", "Chỉ tiêu", "Giá trị HHDV", "Thuế GTGT", "Ghi chú"]);
  dongTieuDe.height = HEADER_HEIGHT;
  dongTieuDe.eachCell((cell) => {
    // HEADER_FILL là chuỗi ARGB, phải bọc trong object fill — đúng cách `exportXlsx.ts:155` và
    // `xuatChiTieuExcel.ts:45` đang dùng.
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = CELL_BORDER;
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (const h of HANG_GTGT01) {
    const soGiaTri = h.giaTri ? (ban.ct[h.giaTri] ?? null) : null;
    const soThue = h.thue ? (ban.ct[h.thue] ?? null) : null;
    const daSua = [h.giaTri, h.thue].filter((t): t is string => !!t && !!ban.ghiDe[t]);

    const row = ws.addRow([
      h.stt,
      `${THUT_LE.repeat(h.indent ?? 0)}${h.nhan}`,
      soGiaTri,
      soThue,
      daSua.length > 0
        ? `Sửa tay: ${daSua.map((t) => `[${maChiTieu(t)}]`).join(", ")}`
        : "",
    ]);
    // `includeEmpty: true` — xem ghi chú ở `duLieu` trên: hàng nào không có "Sửa tay" thì cột 5 là
    // `""` (không `null`), nhưng cột 3/4 là `null` khi chỉ tiêu đó không có giá trị/thuế.
    row.eachCell({ includeEmpty: true }, (cell) => (cell.border = CELL_BORDER));
    if (h.header) row.font = { bold: true };
    row.getCell(3).numFmt = NUM_FMT_TIEN;
    row.getCell(4).numFmt = NUM_FMT_TIEN;
  }

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 78;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 30;

  if (ban.phuLuc) themSheetPhuLuc(wb, ky, ban.phuLuc);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  luuVeMay(blob, tenFile(ky));
}

import type { BangTinhThueTongHopDto } from "../../../types/toKhaiThue";
import { HEADER_FILL, TIEN_FMT, TONG_FILL, taiVeExcel, toTieuDe } from "../../bang_luong/excelChung";
import { COT, HEADER_TREN, oExcel } from "./cotBangTinhThue";

/**
 * File Excel dùng CHUNG danh sách cột với bảng trên màn hình (`cotBangTinhThue.ts`) — kể cả header
 * hai tầng. Trước đây file này chép lại danh sách cột ba lần (tiêu đề, dòng dữ liệu, dòng tổng), nên
 * thêm một cột vào giữa bảng là file lệch cột mà không có gì báo.
 */

/**
 * @param moTaLoc Câu mô tả bộ lọc đang áp, ghi vào dòng phụ đề của file (RVW-746). File chứa đúng
 * những dòng máy chủ trả về theo bộ lọc, nên không nói ra là kế toán dễ dùng một file thiếu người
 * để đối chiếu tờ khai quý.
 */
export async function xuatExcelBangTinhThue(
  bang: BangTinhThueTongHopDto,
  moTaLoc: string,
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet(`Thue T${bang.month}-${bang.year}`);

  ws.columns = COT.map((c) => ({ width: c.rong }));
  ws.addRow([`BẢNG TÍNH THUẾ TNCN THÁNG ${bang.month}/${bang.year}`]);
  toTieuDe(ws, 1, COT.length, "FF1F3864");
  const bt = bang.bieuThueApDung;
  ws.addRow([
    `Biểu thuế hiệu lực từ ${bt.effectiveFrom.slice(0, 10)} · giảm trừ bản thân ${bt.personalDeduction.toLocaleString("vi-VN")}đ · mỗi người phụ thuộc ${bt.dependentDeduction.toLocaleString("vi-VN")}đ · trạng thái ${bang.trangThai === "DA_CHOT" ? "đã chốt" : "nháp"} · ${moTaLoc}`,
  ]);
  toTieuDe(ws, 2, COT.length, "FF555555");
  ws.addRow([
    "Cột [4], [14]–[16] chưa có nguồn số; [10]–[12] luôn bằng 0. Bộ phận, Chức vụ, Số HĐ theo hồ sơ hiện tại.",
  ]);
  toTieuDe(ws, 3, COT.length, "FF555555");
  ws.addRow([]);

  // ── Header hai tầng ──
  const DONG_CHA = 5;
  const DONG_CON = 6;
  const hangCha = ws.getRow(DONG_CHA);
  const hangCon = ws.getRow(DONG_CON);

  let cot = 1;
  for (const g of HEADER_TREN) {
    if (g.nhom) {
      hangCha.getCell(cot).value = g.nhom;
      ws.mergeCells(DONG_CHA, cot, DONG_CHA, cot + g.cot.length - 1);
      g.cot.forEach((c, i) => {
        hangCon.getCell(cot + i).value = c.nhan;
      });
      cot += g.cot.length;
    } else {
      // Cột đơn chiếm cả hai dòng header, đúng như `rowSpan={2}` trên màn hình.
      hangCha.getCell(cot).value = g.cot[0].nhan;
      ws.mergeCells(DONG_CHA, cot, DONG_CON, cot);
      cot += 1;
    }
  }

  for (const hang of [hangCha, hangCon]) {
    hang.font = { bold: true };
    hang.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    for (let i = 1; i <= COT.length; i += 1) {
      hang.getCell(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL },
      };
    }
    hang.commit();
  }

  // ── Dữ liệu ──
  bang.danhSach.forEach((d, i) => {
    ws.addRow(COT.map((c) => oExcel(c, d, i)));
  });

  const hangTong = ws.addRow(
    COT.map((c) => {
      if (c.khoa === "stt") return "TỔNG";
      if (c.khoa === "ma_nv") return `${bang.danhSach.length} người`;
      if (c.kieu !== "tien" || !c.lay) return "";
      const lay = c.lay;
      return bang.danhSach.reduce((t, d) => t + lay(d), 0);
    }),
  );
  hangTong.font = { bold: true };
  hangTong.eachCell((o) => {
    o.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONG_FILL } };
  });

  COT.forEach((c, i) => {
    if (c.kieu === "tien") ws.getColumn(i + 1).numFmt = TIEN_FMT;
  });

  taiVeExcel(
    await wb.xlsx.writeBuffer(),
    `Bang-tinh-thue-TNCN_T${bang.month}-${bang.year}.xlsx`,
  );
}

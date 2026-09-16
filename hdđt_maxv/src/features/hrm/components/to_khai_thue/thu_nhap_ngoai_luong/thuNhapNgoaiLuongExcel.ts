import type { OtherIncomeRecordDto } from "../../../types/toKhaiThue";
import { HEADER_FILL, TIEN_FMT, TONG_FILL, taiVeExcel, toTieuDe } from "../../bang_luong/excelChung";
import { NHAN_CACH_KHAU_TRU, NHAN_NHOM_XU_LY } from "../nhan";

/** Xuất danh sách khoản thu nhập ngoài lương của MỘT kỳ ra Excel (đúng những dòng đang xem). */
const COT: Array<{ nhan: string; rong: number; tien?: boolean }> = [
  { nhan: "Mã NV", rong: 12 },
  { nhan: "Họ tên", rong: 26 },
  { nhan: "Loại thu nhập", rong: 30 },
  { nhan: "Nhóm xử lý thuế", rong: 22 },
  { nhan: "Ngày chi trả", rong: 14 },
  { nhan: "Trước thuế", rong: 16, tien: true },
  { nhan: "Miễn thuế", rong: 14, tien: true },
  { nhan: "Chịu thuế", rong: 16, tien: true },
  { nhan: "Cách khấu trừ", rong: 24 },
  { nhan: "Thuế khấu trừ", rong: 16, tien: true },
  { nhan: "Thực nhận", rong: 16, tien: true },
  { nhan: "Ghi chú", rong: 30 },
];

export async function xuatExcelThuNhapNgoaiLuong(
  danhSach: OtherIncomeRecordDto[],
  thang: number,
  nam: number,
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Thu nhập ngoài lương");

  ws.columns = COT.map((c) => ({ width: c.rong }));
  ws.addRow([`THU NHẬP NGOÀI LƯƠNG THÁNG ${thang}/${nam}`]);
  toTieuDe(ws, 1, COT.length, "FF1F3864");
  ws.addRow([]);

  const hangTieuDe = ws.addRow(COT.map((c) => c.nhan));
  hangTieuDe.font = { bold: true };
  hangTieuDe.eachCell((o) => {
    o.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  for (const k of danhSach) {
    ws.addRow([
      k.ma_nv ?? "",
      k.fullName,
      `${k.category.code} — ${k.category.name}`,
      NHAN_NHOM_XU_LY[k.taxTreatmentGroup],
      k.paymentDate.slice(0, 10),
      k.grossAmount,
      k.exemptAmount,
      k.taxableAmount,
      NHAN_CACH_KHAU_TRU[k.taxDeductionType],
      k.taxDeducted,
      k.netAmount,
      k.note ?? "",
    ]);
  }

  const cong = (lay: (k: OtherIncomeRecordDto) => number) =>
    danhSach.reduce((t, k) => t + lay(k), 0);
  const hangTong = ws.addRow([
    "",
    `TỔNG CỘNG (${danhSach.length} khoản)`,
    "",
    "",
    "",
    cong((k) => k.grossAmount),
    cong((k) => k.exemptAmount),
    cong((k) => k.taxableAmount),
    "",
    cong((k) => k.taxDeducted),
    cong((k) => k.netAmount),
    "",
  ]);
  hangTong.font = { bold: true };
  hangTong.eachCell((o) => {
    o.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONG_FILL } };
  });

  COT.forEach((c, i) => {
    if (c.tien) ws.getColumn(i + 1).numFmt = TIEN_FMT;
  });

  taiVeExcel(await wb.xlsx.writeBuffer(), `Thu-nhap-ngoai-luong_T${thang}-${nam}.xlsx`);
}

import type { BangTinhThueTongHopDto } from "../../../types/toKhaiThue";
import { HEADER_FILL, TIEN_FMT, TONG_FILL, taiVeExcel, toTieuDe } from "../../bang_luong/excelChung";
import { NHAN_LOAI_LAO_DONG, NHAN_PHUONG_PHAP_TINH } from "../nhan";

/** Cột của file Excel Bảng tính thuế — cùng thứ tự với bảng trên màn hình. */
const COT: Array<{ nhan: string; rong: number; tien?: boolean }> = [
  { nhan: "Mã NV", rong: 12 },
  { nhan: "Họ tên", rong: 26 },
  { nhan: "MST cá nhân", rong: 16 },
  { nhan: "Loại lao động", rong: 22 },
  { nhan: "Số NPT", rong: 10 },
  { nhan: "Thu nhập lương", rong: 16, tien: true },
  { nhan: "Thu nhập ngoài", rong: 16, tien: true },
  { nhan: "Khấu trừ riêng", rong: 16, tien: true },
  { nhan: "Tổng thu nhập", rong: 16, tien: true },
  { nhan: "Miễn thuế", rong: 14, tien: true },
  { nhan: "Chịu thuế", rong: 16, tien: true },
  { nhan: "Giảm trừ bản thân", rong: 16, tien: true },
  { nhan: "Giảm trừ NPT", rong: 14, tien: true },
  { nhan: "Bảo hiểm", rong: 14, tien: true },
  { nhan: "Tổng giảm trừ", rong: 16, tien: true },
  { nhan: "Thu nhập tính thuế", rong: 18, tien: true },
  { nhan: "Phương pháp", rong: 20 },
  { nhan: "Thuế lũy tiến", rong: 14, tien: true },
  { nhan: "Thuế toàn phần", rong: 14, tien: true },
  { nhan: "Tổng thuế TNCN", rong: 16, tien: true },
  { nhan: "Thực nhận", rong: 16, tien: true },
];

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
  ws.addRow([]);

  const hangTieuDe = ws.addRow(COT.map((c) => c.nhan));
  hangTieuDe.font = { bold: true };
  hangTieuDe.eachCell((o) => {
    o.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  for (const d of bang.danhSach) {
    ws.addRow([
      d.ma_nv ?? "",
      d.ho_ten,
      d.mst_ca_nhan ?? "",
      NHAN_LOAI_LAO_DONG[d.loai_lao_dong],
      d.so_nguoi_phu_thuoc,
      d.thu_nhap_luong,
      d.thu_nhap_ngoai,
      d.thu_nhap_khau_tru_rieng,
      d.tong_thu_nhap,
      d.thu_nhap_mien_thue,
      d.thu_nhap_chiu_thue,
      d.giam_tru_ban_than,
      d.giam_tru_phu_thuoc,
      d.giam_tru_bao_hiem,
      d.tong_giam_tru,
      d.thu_nhap_tinh_thue,
      NHAN_PHUONG_PHAP_TINH[d.phuong_phap_tinh],
      d.thue_luy_tien,
      d.thue_toan_phan,
      d.tong_thue_tncn,
      d.thuc_nhan,
    ]);
  }

  const cong = (lay: (d: BangTinhThueTongHopDto["danhSach"][number]) => number) =>
    bang.danhSach.reduce((t, d) => t + lay(d), 0);
  const hangTong = ws.addRow([
    "",
    `TỔNG CỘNG (${bang.danhSach.length} người)`,
    "",
    "",
    "",
    cong((d) => d.thu_nhap_luong),
    cong((d) => d.thu_nhap_ngoai),
    cong((d) => d.thu_nhap_khau_tru_rieng),
    cong((d) => d.tong_thu_nhap),
    cong((d) => d.thu_nhap_mien_thue),
    cong((d) => d.thu_nhap_chiu_thue),
    cong((d) => d.giam_tru_ban_than),
    cong((d) => d.giam_tru_phu_thuoc),
    cong((d) => d.giam_tru_bao_hiem),
    cong((d) => d.tong_giam_tru),
    cong((d) => d.thu_nhap_tinh_thue),
    "",
    cong((d) => d.thue_luy_tien),
    cong((d) => d.thue_toan_phan),
    cong((d) => d.tong_thue_tncn),
    cong((d) => d.thuc_nhan),
  ]);
  hangTong.font = { bold: true };
  hangTong.eachCell((o) => {
    o.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONG_FILL } };
  });

  COT.forEach((c, i) => {
    if (c.tien) ws.getColumn(i + 1).numFmt = TIEN_FMT;
  });

  taiVeExcel(
    await wb.xlsx.writeBuffer(),
    `Bang-tinh-thue-TNCN_T${bang.month}-${bang.year}.xlsx`,
  );
}

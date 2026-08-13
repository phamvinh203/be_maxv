/**
 * Ba nút file của màn Lương chuyên cần — cùng cách làm với `kpi/kpiExcel.ts`:
 * một bố cục cột dùng chung cho tải mẫu, xuất và nhập, để file xuất ra nhập lại
 * được ngay.
 */

import type { CellValue, Workbook, Worksheet } from "exceljs";
import { moTaCachTru } from "../../../constants";
import { sinhIdDongChuyenCan } from "../../../chuyenCan";
import { homNay } from "../../../format";
import type { ChuyenCanNhanVienRow, DongChuyenCan, LoaiChuyenCan } from "../../../types";

/** Cột của sheet "Bảng chuyên cần" — thứ tự này là hợp đồng giữa xuất và nhập. */
const COT_BANG = [
  { header: "Mã loại", width: 12 },
  { header: "Loại chuyên cần", width: 30 },
  { header: "Số giờ trễ/nghỉ", width: 16 },
  { header: "Ngày (yyyy-mm-dd)", width: 20 },
];

const HEADER_FILL = "FFDDE6F2";
const TIEN_FMT = "#,##0";
const NGAY_FMT = "@";

/** Ô Excel có thể là số, chuỗi, công thức hoặc rich text — ép về chuỗi đã trim. */
function chuoiO(giaTri: CellValue): string {
  if (giaTri === null || giaTri === undefined) return "";
  if (giaTri instanceof Date) return isoNgay(giaTri);
  if (typeof giaTri === "object") {
    if ("richText" in giaTri) return giaTri.richText.map((p) => p.text).join("").trim();
    if ("text" in giaTri) return String(giaTri.text).trim();
    if ("result" in giaTri) return String(giaTri.result ?? "").trim();
    return "";
  }
  return String(giaTri).trim();
}

/** `Date` → `YYYY-MM-DD` theo giờ máy — Excel hay trả ô ngày về dạng `Date`. */
function isoNgay(d: Date): string {
  const thang = String(d.getMonth() + 1).padStart(2, "0");
  const ngay = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${thang}-${ngay}`;
}

/** Chấp nhận cả `2,5` lẫn `2.5` — xem ghi chú ở `kpiExcel.soO`. */
function soO(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = chuoiO(giaTri).replace(/\s/g, "").replace(/h$/i, "").replace(",", ".");
  if (!text) return 0;
  const so = Number(text);
  return Number.isFinite(so) ? so : 0;
}

/**
 * Ô ngày về `YYYY-MM-DD`.
 *
 * Excel trả ô ngày thật về dạng `Date`, còn ô người dùng gõ tay thì là chuỗi —
 * nhận cả hai, và chấp cả `dd/MM/yyyy` vì đó là cách kế toán quen gõ.
 */
function ngayO(giaTri: CellValue): string {
  if (giaTri instanceof Date) return isoNgay(giaTri);
  const text = chuoiO(giaTri);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const vn = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (vn) {
    const [, ngay, thang, nam] = vn;
    return `${nam}-${thang!.padStart(2, "0")}-${ngay!.padStart(2, "0")}`;
  }
  return "";
}

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

function toTieuDe(ws: Worksheet, soCot: number): void {
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

/** Sheet tra cứu mã ↔ tên ↔ cách trừ, để người điền file biết gõ mã nào vào cột đầu. */
function themSheetDanhMuc(wb: Workbook, danhMuc: LoaiChuyenCan[]): void {
  const ws = wb.addWorksheet("Loại chuyên cần");
  ws.columns = [
    { header: "Mã loại", width: 12 },
    { header: "Tên loại", width: 30 },
    { header: "Cách trừ", width: 24 },
    { header: "Mức trừ", width: 16 },
    { header: "Trạng thái", width: 14 },
  ];
  ws.getColumn(4).numFmt = TIEN_FMT;
  toTieuDe(ws, 5);
  for (const cc of danhMuc) {
    const moTa = moTaCachTru(cc.cach_tru);
    ws.addRow([
      cc.ma_cc,
      cc.ten_cc,
      moTa.label,
      cc.cach_tru === "mat_toan_bo" ? "Toàn bộ" : cc.muc_tru,
      cc.status === "1" ? "Đang dùng" : "Ngừng",
    ]);
  }
}

/** File mẫu để nhập chuyên cần: các loại đang dùng, cột giờ và ngày để trống. */
export async function taiFileMauChuyenCan(danhMuc: LoaiChuyenCan[]): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Bảng chuyên cần");
  ws.columns = COT_BANG;
  ws.getColumn(4).numFmt = NGAY_FMT;
  toTieuDe(ws, COT_BANG.length);

  for (const cc of danhMuc.filter((item) => item.status === "1")) {
    ws.addRow([cc.ma_cc, cc.ten_cc, null, null]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Mau-nhap-chuyen-can.xlsx");
}

/** Xuất bảng đang soạn + danh sách nhân viên đang lọc. */
export async function xuatChuyenCanExcel(
  dong: DongChuyenCan[],
  danhMuc: LoaiChuyenCan[],
  rows: ChuyenCanNhanVienRow[],
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const tenTheoMa = new Map(danhMuc.map((cc) => [cc.ma_cc, cc.ten_cc]));
  const wb = new LopWorkbook();

  const wsBang = wb.addWorksheet("Bảng chuyên cần");
  wsBang.columns = COT_BANG;
  wsBang.getColumn(4).numFmt = NGAY_FMT;
  toTieuDe(wsBang, COT_BANG.length);
  for (const d of dong) {
    wsBang.addRow([d.ma_cc, tenTheoMa.get(d.ma_cc) ?? d.ma_cc, d.so_gio, d.ngay]);
  }

  const wsNv = wb.addWorksheet("Nhân viên");
  wsNv.columns = [
    { header: "Mã", width: 12 },
    { header: "Họ và tên", width: 26 },
    { header: "Phòng ban", width: 26 },
    { header: "Đơn giá", width: 16 },
    { header: "Tổng trừ", width: 16 },
    { header: "Thành tiền", width: 16 },
  ];
  for (const cot of [4, 5, 6]) wsNv.getColumn(cot).numFmt = TIEN_FMT;
  toTieuDe(wsNv, 6);
  for (const row of rows) {
    wsNv.addRow([
      row.ma_nv,
      row.ho_ten,
      row.ten_pb,
      row.don_gia,
      row.tong_tru,
      row.thanh_tien,
    ]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Bang-chuyen-can.xlsx");
}

/**
 * Đọc sheet đầu của file người dùng chọn thành các dòng chuyên cần.
 *
 * Khớp loại theo **mã** trước, không có mã mới dò theo tên. Dòng không tra ra
 * loại thì báo đích danh số dòng.
 *
 * Dòng để trống **cả** giờ lẫn ngày bị bỏ qua — file mẫu liệt kê sẵn mọi loại
 * đang dùng, người dùng chỉ điền vào những lỗi thực sự xảy ra. Ngược lại, có giờ
 * mà thiếu ngày thì báo lỗi: dòng vi phạm không có ngày thì không đối chiếu lại
 * được với bảng chấm công.
 */
export async function docFileChuyenCan(
  file: File,
  danhMuc: LoaiChuyenCan[],
): Promise<DongChuyenCan[]> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào đọc được.");

  const theoMa = new Map(danhMuc.map((cc) => [cc.ma_cc.toLowerCase(), cc]));
  const theoTen = new Map(danhMuc.map((cc) => [cc.ten_cc.trim().toLowerCase(), cc]));

  const dong: DongChuyenCan[] = [];
  const dongLoi: number[] = [];
  const dongThieuNgay: number[] = [];

  ws.eachRow((row, soDong) => {
    if (soDong === 1) return; // hàng tiêu đề
    const ma = chuoiO(row.getCell(1).value);
    const ten = chuoiO(row.getCell(2).value);
    if (!ma && !ten) return; // dòng trống

    const loai = theoMa.get(ma.toLowerCase()) ?? theoTen.get(ten.toLowerCase());
    if (!loai) {
      dongLoi.push(soDong);
      return;
    }
    const soGio = soO(row.getCell(3).value);
    const ngay = ngayO(row.getCell(4).value);
    // Chưa điền gì thì loại này kỳ đó không phát sinh — bỏ qua, không phải lỗi.
    if (soGio <= 0 && !ngay) return;
    if (!ngay) {
      dongThieuNgay.push(soDong);
      return;
    }

    dong.push({ id: sinhIdDongChuyenCan(), ma_cc: loai.ma_cc, so_gio: soGio, ngay });
  });

  if (dongLoi.length > 0) {
    throw new Error(
      `Không tra được loại chuyên cần ở dòng ${dongLoi.join(", ")}. Hãy dùng mã hoặc tên đúng như sheet "Loại chuyên cần".`,
    );
  }
  if (dongThieuNgay.length > 0) {
    throw new Error(
      `Thiếu ngày vi phạm ở dòng ${dongThieuNgay.join(", ")}. Ghi theo dạng ${homNay()} hoặc dd/MM/yyyy.`,
    );
  }
  if (dong.length === 0) throw new Error("File không có dòng vi phạm nào.");
  return dong;
}

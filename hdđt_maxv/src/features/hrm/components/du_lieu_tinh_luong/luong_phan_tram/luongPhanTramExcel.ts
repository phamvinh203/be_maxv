/**
 * Ba nút file của màn Lương phần trăm — cùng cách làm với `kpi/kpiExcel.ts`: một
 * bố cục cột dùng chung cho tải mẫu, xuất và nhập, để file xuất ra nhập lại
 * được ngay.
 */

import type { CellValue, Workbook, Worksheet } from "exceljs";
import {
  sinhIdDongPhanTram,
  thanhTienPhanTram,
  tongCoSoPhanTram,
  tongTienPhanTram,
} from "../../../luongPhanTram";
import type {
  DongLuongPhanTram,
  KhoanLuong,
  LuongPhanTramNhanVienRow,
} from "../../../types";

/** Cột của sheet "Lương phần trăm" — thứ tự này là hợp đồng giữa xuất và nhập. */
const COT_BANG = [
  { header: "Mã khoản", width: 14 },
  { header: "Loại %", width: 30 },
  { header: "Tỉ lệ %", width: 12 },
  { header: "Số tiền cơ sở", width: 20 },
  { header: "Thành tiền", width: 18 },
];

const HEADER_FILL = "FFDDE6F2";
const TIEN_FMT = "#,##0";

/** Ô Excel có thể là số, chuỗi, công thức hoặc rich text — ép về chuỗi đã trim. */
function chuoiO(giaTri: CellValue): string {
  if (giaTri === null || giaTri === undefined) return "";
  if (typeof giaTri === "object") {
    if ("richText" in giaTri) return giaTri.richText.map((p) => p.text).join("").trim();
    if ("text" in giaTri) return String(giaTri.text).trim();
    if ("result" in giaTri) return String(giaTri.result ?? "").trim();
    return "";
  }
  return String(giaTri).trim();
}

/** Chấp nhận cả `450.000.000` lẫn `2,5` — xem ghi chú ở `kpiExcel.soO`. */
function soO(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = chuoiO(giaTri)
    .replace(/\s/g, "")
    .replace(/[₫đ%]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!text) return 0;
  const so = Number(text);
  return Number.isFinite(so) ? so : 0;
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

/** Sheet tra cứu mã ↔ tên ↔ tỷ lệ mặc định. */
function themSheetDanhMuc(wb: Workbook, danhMuc: KhoanLuong[]): void {
  const ws = wb.addWorksheet("Danh mục loại %");
  ws.columns = [
    { header: "Mã khoản", width: 14 },
    { header: "Loại %", width: 30 },
    { header: "Tỷ lệ mặc định", width: 16 },
    { header: "Ghi chú", width: 40 },
    { header: "Trạng thái", width: 14 },
  ];
  toTieuDe(ws, 5);
  for (const kl of danhMuc) {
    ws.addRow([
      kl.ma_khoan,
      kl.ten_khoan,
      kl.ty_le,
      kl.ghi_chu,
      kl.status === "1" ? "Đang dùng" : "Ngừng",
    ]);
  }
}

/**
 * File mẫu để nhập hoa hồng: các loại % đang dùng đã điền sẵn tỷ lệ mặc định,
 * cột số tiền cơ sở để trống cho người dùng điền.
 */
export async function taiFileMauPhanTram(danhMuc: KhoanLuong[]): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Lương phần trăm");
  ws.columns = COT_BANG;
  ws.getColumn(4).numFmt = TIEN_FMT;
  ws.getColumn(5).numFmt = TIEN_FMT;
  toTieuDe(ws, COT_BANG.length);

  for (const kl of danhMuc.filter((item) => item.status === "1")) {
    ws.addRow([kl.ma_khoan, kl.ten_khoan, kl.ty_le, null, null]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Mau-nhap-luong-phan-tram.xlsx");
}

/** Xuất bảng đang soạn + danh sách nhân viên đang lọc. */
export async function xuatPhanTramExcel(
  dong: DongLuongPhanTram[],
  danhMuc: KhoanLuong[],
  rows: LuongPhanTramNhanVienRow[],
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const tenTheoMa = new Map(danhMuc.map((kl) => [kl.ma_khoan, kl.ten_khoan]));
  const wb = new LopWorkbook();

  const wsBang = wb.addWorksheet("Lương phần trăm");
  wsBang.columns = COT_BANG;
  wsBang.getColumn(4).numFmt = TIEN_FMT;
  wsBang.getColumn(5).numFmt = TIEN_FMT;
  toTieuDe(wsBang, COT_BANG.length);
  for (const d of dong) {
    wsBang.addRow([
      d.ma_khoan,
      tenTheoMa.get(d.ma_khoan) ?? d.ma_khoan,
      d.ty_le,
      d.so_tien_co_so,
      thanhTienPhanTram(d),
    ]);
  }
  // Cách một dòng rồi mới tới tổng: dòng này KHÔNG phải một loại %, dính liền
  // bảng thì lượt nhập lại sẽ tưởng nó là dòng dữ liệu.
  wsBang.addRow([]);
  wsBang.addRow([
    "",
    "Tổng cộng",
    null,
    tongCoSoPhanTram(dong),
    tongTienPhanTram(dong),
  ]);

  const wsNv = wb.addWorksheet("Nhân viên");
  wsNv.columns = [
    { header: "Mã", width: 12 },
    { header: "Họ và tên", width: 26 },
    { header: "Phòng ban", width: 26 },
    { header: "Tiền lương", width: 18 },
  ];
  wsNv.getColumn(4).numFmt = TIEN_FMT;
  toTieuDe(wsNv, 4);
  for (const row of rows) {
    wsNv.addRow([row.ma_nv, row.ho_ten, row.ten_pb, row.tien_luong]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Bang-luong-phan-tram.xlsx");
}

/**
 * Đọc sheet đầu của file người dùng chọn thành các dòng lương phần trăm.
 *
 * Khớp khoản theo **mã** trước, không có mã mới dò theo tên. Dòng không tra ra
 * khoản thì báo đích danh số dòng — nhập sót một loại % là hoa hồng của cả danh
 * sách bị hụt.
 *
 * Tỷ lệ lấy từ file; ô trống thì rơi về tỷ lệ mặc định của danh mục. Dòng để
 * trống cột "Số tiền cơ sở" bị bỏ qua: file mẫu liệt kê sẵn **mọi** loại đang
 * dùng, người dùng chỉ điền vào những loại kỳ này thực sự phát sinh.
 */
export async function docFilePhanTram(
  file: File,
  danhMuc: KhoanLuong[],
): Promise<DongLuongPhanTram[]> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào đọc được.");

  const theoMa = new Map(danhMuc.map((kl) => [kl.ma_khoan.toLowerCase(), kl]));
  const theoTen = new Map(danhMuc.map((kl) => [kl.ten_khoan.trim().toLowerCase(), kl]));

  const dong: DongLuongPhanTram[] = [];
  const dongLoi: number[] = [];
  const daGap = new Set<string>();

  ws.eachRow((row, soDong) => {
    if (soDong === 1) return; // hàng tiêu đề
    const ma = chuoiO(row.getCell(1).value);
    const ten = chuoiO(row.getCell(2).value);
    if (!ma && !ten) return; // dòng trống
    // Dòng tổng do chính "Xuất Excel" ghi ra, không phải một loại %.
    if (!ma && ten.toLowerCase().startsWith("tổng cộng")) return;

    const khoan = theoMa.get(ma.toLowerCase()) ?? theoTen.get(ten.toLowerCase());
    if (!khoan) {
      dongLoi.push(soDong);
      return;
    }
    const coSo = soO(row.getCell(4).value);
    if (coSo <= 0) return;
    // Cùng một loại hai lần thì hoa hồng cộng đôi — lấy lần đầu, bỏ các lần sau.
    if (daGap.has(khoan.ma_khoan)) return;
    daGap.add(khoan.ma_khoan);

    const tyLe = soO(row.getCell(3).value);
    dong.push({
      id: sinhIdDongPhanTram(),
      ma_khoan: khoan.ma_khoan,
      ty_le: tyLe > 0 ? tyLe : khoan.ty_le,
      so_tien_co_so: coSo,
    });
  });

  if (dongLoi.length > 0) {
    throw new Error(
      `Không tra được loại % ở dòng ${dongLoi.join(", ")}. Hãy dùng mã hoặc tên đúng như sheet "Danh mục loại %".`,
    );
  }
  if (dong.length === 0) {
    throw new Error("File không có dòng nào có số tiền cơ sở lớn hơn 0.");
  }
  return dong;
}

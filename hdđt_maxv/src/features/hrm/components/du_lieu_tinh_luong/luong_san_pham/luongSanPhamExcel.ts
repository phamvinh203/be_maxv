/**
 * Ba nút file của màn Lương sản phẩm — cùng cách làm với `kpi/kpiExcel.ts`: một
 * bố cục cột dùng chung cho tải mẫu, xuất và nhập, để file xuất ra nhập lại
 * được ngay.
 */

import type { CellValue, Workbook, Worksheet } from "exceljs";
import { sinhIdDongSanPham, thanhTienSanPham, tongTienSanPham } from "../../../luongSanPham";
import type { DongLuongSanPham, LuongSanPhamNhanVienRow, SanPham } from "../../../types";

/** Cột của sheet "Lương sản phẩm" — thứ tự này là hợp đồng giữa xuất và nhập. */
const COT_BANG = [
  { header: "Mã SP", width: 12 },
  { header: "Sản phẩm", width: 30 },
  { header: "Đơn vị", width: 12 },
  { header: "Đơn giá", width: 16 },
  { header: "Số lượng", width: 14 },
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

/** Chấp nhận cả `25.000` lẫn `2,5` — xem ghi chú ở `kpiExcel.soO`. */
function soO(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = chuoiO(giaTri)
    .replace(/\s/g, "")
    .replace(/[₫đ]/gi, "")
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

/** Sheet tra cứu mã ↔ tên ↔ bảng giá, để người điền file biết gõ mã nào vào cột đầu. */
function themSheetDanhMuc(wb: Workbook, danhMuc: SanPham[]): void {
  const ws = wb.addWorksheet("Danh mục sản phẩm");
  ws.columns = [
    { header: "Mã SP", width: 12 },
    { header: "Sản phẩm", width: 30 },
    { header: "Đơn vị", width: 12 },
    { header: "Đơn giá", width: 16 },
    { header: "Trạng thái", width: 14 },
  ];
  ws.getColumn(4).numFmt = TIEN_FMT;
  toTieuDe(ws, 5);
  for (const sp of danhMuc) {
    ws.addRow([
      sp.ma_sp,
      sp.ten_sp,
      sp.don_vi,
      sp.don_gia,
      sp.status === "1" ? "Đang dùng" : "Ngừng",
    ]);
  }
}

/**
 * File mẫu để nhập sản lượng: các sản phẩm đang dùng đã điền sẵn đơn giá theo
 * bảng giá, cột số lượng để trống cho người dùng điền.
 */
export async function taiFileMauSanPham(danhMuc: SanPham[]): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Lương sản phẩm");
  ws.columns = COT_BANG;
  ws.getColumn(4).numFmt = TIEN_FMT;
  ws.getColumn(6).numFmt = TIEN_FMT;
  toTieuDe(ws, COT_BANG.length);

  for (const sp of danhMuc.filter((item) => item.status === "1")) {
    ws.addRow([sp.ma_sp, sp.ten_sp, sp.don_vi, sp.don_gia, null, null]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Mau-nhap-luong-san-pham.xlsx");
}

/** Xuất bảng đang soạn + danh sách nhân viên đang lọc. */
export async function xuatSanPhamExcel(
  dong: DongLuongSanPham[],
  danhMuc: SanPham[],
  rows: LuongSanPhamNhanVienRow[],
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const spTheoMa = new Map(danhMuc.map((sp) => [sp.ma_sp, sp]));
  const wb = new LopWorkbook();

  const wsBang = wb.addWorksheet("Lương sản phẩm");
  wsBang.columns = COT_BANG;
  wsBang.getColumn(4).numFmt = TIEN_FMT;
  wsBang.getColumn(6).numFmt = TIEN_FMT;
  toTieuDe(wsBang, COT_BANG.length);
  for (const d of dong) {
    const sp = spTheoMa.get(d.ma_sp);
    wsBang.addRow([
      d.ma_sp,
      sp?.ten_sp ?? d.ma_sp,
      sp?.don_vi ?? "",
      d.don_gia,
      d.so_luong,
      thanhTienSanPham(d),
    ]);
  }
  // Cách một dòng rồi mới tới tổng: dòng này KHÔNG phải một sản phẩm, dính liền
  // bảng thì lượt nhập lại sẽ tưởng nó là dòng dữ liệu.
  wsBang.addRow([]);
  wsBang.addRow(["", "Tổng cộng", null, null, null, tongTienSanPham(dong)]);

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
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Bang-luong-san-pham.xlsx");
}

/**
 * Đọc sheet đầu của file người dùng chọn thành các dòng lương sản phẩm.
 *
 * Khớp sản phẩm theo **mã** trước, không có mã mới dò theo tên. Dòng không tra
 * ra sản phẩm thì báo đích danh số dòng — nhập sót một sản phẩm là tiền nghiệm
 * thu của cả danh sách bị hụt.
 *
 * Đơn giá lấy từ file; ô trống thì rơi về bảng giá của danh mục. Dòng để trống
 * cột "Số lượng" bị bỏ qua: file mẫu liệt kê sẵn **mọi** sản phẩm đang dùng,
 * người dùng chỉ điền vào những thứ kỳ này thực sự nghiệm thu.
 */
export async function docFileSanPham(
  file: File,
  danhMuc: SanPham[],
): Promise<DongLuongSanPham[]> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào đọc được.");

  const theoMa = new Map(danhMuc.map((sp) => [sp.ma_sp.toLowerCase(), sp]));
  const theoTen = new Map(danhMuc.map((sp) => [sp.ten_sp.trim().toLowerCase(), sp]));

  const dong: DongLuongSanPham[] = [];
  const dongLoi: number[] = [];
  const daGap = new Set<string>();

  ws.eachRow((row, soDong) => {
    if (soDong === 1) return; // hàng tiêu đề
    const ma = chuoiO(row.getCell(1).value);
    const ten = chuoiO(row.getCell(2).value);
    if (!ma && !ten) return; // dòng trống
    // Dòng tổng do chính "Xuất Excel" ghi ra, không phải một sản phẩm.
    if (!ma && ten.toLowerCase().startsWith("tổng cộng")) return;

    const sp = theoMa.get(ma.toLowerCase()) ?? theoTen.get(ten.toLowerCase());
    if (!sp) {
      dongLoi.push(soDong);
      return;
    }
    const soLuong = soO(row.getCell(5).value);
    if (soLuong <= 0) return;
    // Cùng một sản phẩm hai lần thì tiền cộng đôi — lấy lần đầu, bỏ các lần sau.
    if (daGap.has(sp.ma_sp)) return;
    daGap.add(sp.ma_sp);

    const donGia = soO(row.getCell(4).value);
    dong.push({
      id: sinhIdDongSanPham(),
      ma_sp: sp.ma_sp,
      don_gia: donGia > 0 ? donGia : sp.don_gia,
      so_luong: soLuong,
    });
  });

  if (dongLoi.length > 0) {
    throw new Error(
      `Không tra được sản phẩm ở dòng ${dongLoi.join(", ")}. Hãy dùng mã hoặc tên đúng như sheet "Danh mục sản phẩm".`,
    );
  }
  if (dong.length === 0) {
    throw new Error("File không có dòng nào có số lượng lớn hơn 0.");
  }
  return dong;
}

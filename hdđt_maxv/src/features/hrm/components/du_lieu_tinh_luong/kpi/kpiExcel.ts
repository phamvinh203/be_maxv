/**
 * Ba nút file của màn KPI: tải mẫu, nhập Excel, xuất Excel.
 *
 * Dùng chung một bố cục cột cho cả ba — file tải về từ "Tải mẫu" hoặc "Xuất
 * Excel" phải nhập lại được ngay bằng "Nhập Excel", nếu không thì vòng
 * xuất → sửa trong Excel → nhập lại (cách nhanh nhất để lấy số thực thi của cả
 * phòng) sẽ đứt ở bước cuối.
 *
 * `exceljs` nặng ~1MB nên nạp trễ đúng lúc bấm nút, giống `hddt/exportXlsx.ts`.
 */

import type { CellValue, Workbook, Worksheet } from "exceljs";
import { hieuSuat, sinhIdDongKpi, tyLeHt } from "../../../kpi";
import type { ChiTieuKpi, DongKpi, KpiNhanVienRow } from "../../../types";

/** Cột của sheet "Bảng KPI" — thứ tự này là hợp đồng giữa xuất và nhập. */
const COT_BANG = [
  { header: "Mã chỉ tiêu", width: 14 },
  { header: "Tên chỉ tiêu", width: 32 },
  { header: "Trọng số", width: 12 },
  { header: "Mục tiêu", width: 18 },
  { header: "Thực thi", width: 18 },
  { header: "Tỉ lệ HT (%)", width: 14 },
];

const HEADER_FILL = "FFDDE6F2";

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

/**
 * Ô số của file người dùng sửa tay: chấp nhận cả `1.234.567` lẫn `1,5`.
 *
 * Bỏ dấu chấm (phân cách nghìn kiểu Việt) rồi đổi dấu phẩy thành dấu chấm thập
 * phân — Excel tiếng Việt xuất số theo lối đó, để nguyên thì `Number()` trả NaN
 * và cả cột mục tiêu về 0 mà không ai biết.
 */
function soO(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = chuoiO(giaTri).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
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

/** Tiêu đề in đậm, nền nhạt — dùng cho mọi sheet của màn KPI. */
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

/** Sheet tra cứu mã ↔ tên, để người điền file biết gõ mã nào vào cột đầu. */
function themSheetDanhMuc(wb: Workbook, danhMuc: ChiTieuKpi[]): void {
  const ws = wb.addWorksheet("Danh mục chỉ tiêu");
  ws.columns = [
    { header: "Mã chỉ tiêu", width: 14 },
    { header: "Tên chỉ tiêu", width: 32 },
    { header: "Đơn vị", width: 12 },
    { header: "Trọng số mặc định", width: 18 },
    { header: "Trạng thái", width: 14 },
  ];
  toTieuDe(ws, 5);
  for (const ct of danhMuc) {
    ws.addRow([
      ct.ma_kpi,
      ct.ten_kpi,
      ct.don_vi,
      ct.trong_so_mac_dinh,
      ct.status === "1" ? "Đang dùng" : "Ngừng",
    ]);
  }
}

/**
 * File mẫu để nhập KPI: sheet "Bảng KPI" có sẵn ba chỉ tiêu đang dùng làm ví dụ
 * (mục tiêu và thực thi để trống cho người dùng điền), kèm sheet danh mục.
 */
export async function taiFileMauKpi(danhMuc: ChiTieuKpi[]): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Bảng KPI");
  ws.columns = COT_BANG;
  toTieuDe(ws, COT_BANG.length);

  for (const ct of danhMuc.filter((item) => item.status === "1").slice(0, 3)) {
    ws.addRow([ct.ma_kpi, ct.ten_kpi, ct.trong_so_mac_dinh, null, null, null]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Mau-nhap-KPI.xlsx");
}

/**
 * Xuất bảng KPI đang soạn + danh sách nhân viên đang lọc.
 *
 * Hai sheet chứ không phải hai file: người dùng thường xuất ra để trưởng phòng
 * điền số thực thi rồi nhập lại, cầm một file thì không lạc mất sheet nào.
 */
export async function xuatKpiExcel(
  dong: DongKpi[],
  danhMuc: ChiTieuKpi[],
  rows: KpiNhanVienRow[],
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const tenTheoMa = new Map(danhMuc.map((ct) => [ct.ma_kpi, ct.ten_kpi]));
  const wb = new LopWorkbook();

  const wsBang = wb.addWorksheet("Bảng KPI");
  wsBang.columns = COT_BANG;
  toTieuDe(wsBang, COT_BANG.length);
  for (const d of dong) {
    wsBang.addRow([
      d.ma_kpi,
      tenTheoMa.get(d.ma_kpi) ?? d.ma_kpi,
      d.trong_so,
      d.muc_tieu,
      d.thuc_thi,
      tyLeHt(d),
    ]);
  }
  // Cách một dòng rồi mới tới hiệu suất chung: dòng này KHÔNG phải một chỉ tiêu,
  // dính liền bảng thì lượt nhập lại sẽ tưởng nó là dòng dữ liệu.
  wsBang.addRow([]);
  wsBang.addRow(["", "Hiệu suất chung (%)", null, null, null, hieuSuat(dong)]);

  const wsNv = wb.addWorksheet("Nhân viên");
  wsNv.columns = [
    { header: "Mã", width: 12 },
    { header: "Họ và tên", width: 26 },
    { header: "Phòng ban", width: 26 },
    { header: "Lần lương", width: 12 },
    { header: "Hiệu suất (%)", width: 14 },
  ];
  toTieuDe(wsNv, 5);
  for (const row of rows) {
    wsNv.addRow([row.ma_nv, row.ho_ten, row.ten_pb, row.lan_luong, row.hieu_suat]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Bang-KPI.xlsx");
}

/**
 * Đọc sheet đầu của file người dùng chọn thành các dòng KPI.
 *
 * Khớp chỉ tiêu theo **mã** trước, không có mã mới dò theo tên — người điền file
 * hay xóa cột mã đi cho gọn, mà chặn hẳn thì họ phải mở sheet danh mục chép lại
 * từng mã. Dòng nào không tra ra chỉ tiêu thì báo đích danh số dòng chứ không
 * lặng lẽ bỏ qua: nhập thiếu một chỉ tiêu là hiệu suất cả phòng sai.
 */
export async function docFileKpi(file: File, danhMuc: ChiTieuKpi[]): Promise<DongKpi[]> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào đọc được.");

  const theoMa = new Map(danhMuc.map((ct) => [ct.ma_kpi.toLowerCase(), ct]));
  const theoTen = new Map(danhMuc.map((ct) => [ct.ten_kpi.trim().toLowerCase(), ct]));

  const dong: DongKpi[] = [];
  const dongLoi: number[] = [];
  const daGap = new Set<string>();

  ws.eachRow((row, soDong) => {
    if (soDong === 1) return; // hàng tiêu đề
    const ma = chuoiO(row.getCell(1).value);
    const ten = chuoiO(row.getCell(2).value);
    if (!ma && !ten) return; // dòng trống — người dùng hay để cách quãng
    // Dòng tổng do chính "Xuất Excel" ghi ra, không phải chỉ tiêu.
    if (!ma && ten.toLowerCase().startsWith("hiệu suất chung")) return;

    const chiTieu = theoMa.get(ma.toLowerCase()) ?? theoTen.get(ten.toLowerCase());
    if (!chiTieu) {
      dongLoi.push(soDong);
      return;
    }
    // Cùng một chỉ tiêu hai lần thì hiệu suất tính hai lần cho một việc — lấy
    // lần đầu, bỏ các lần sau.
    if (daGap.has(chiTieu.ma_kpi)) return;
    daGap.add(chiTieu.ma_kpi);

    const trongSo = soO(row.getCell(3).value);
    dong.push({
      id: sinhIdDongKpi(),
      ma_kpi: chiTieu.ma_kpi,
      trong_so: trongSo > 0 ? trongSo : chiTieu.trong_so_mac_dinh,
      muc_tieu: soO(row.getCell(4).value),
      thuc_thi: soO(row.getCell(5).value),
    });
  });

  if (dongLoi.length > 0) {
    throw new Error(
      `Không tra được chỉ tiêu ở dòng ${dongLoi.join(", ")}. Hãy dùng mã hoặc tên đúng như sheet "Danh mục chỉ tiêu".`,
    );
  }
  if (dong.length === 0) throw new Error("File không có dòng KPI nào.");
  return dong;
}

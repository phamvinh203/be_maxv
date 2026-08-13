/**
 * Ba nút file của màn Tăng ca — cùng cách làm với `kpi/kpiExcel.ts`: một bố cục
 * cột dùng chung cho tải mẫu, xuất và nhập, để file xuất ra nhập lại được ngay.
 */

import type { CellValue, Workbook, Worksheet } from "exceljs";
import { LOAI_TANG_CA, moTaLoaiTangCa } from "../../../constants";
import { gioQuyDoi, sinhIdDongTangCa, tongGioOt, tongGioQuyDoi } from "../../../tangCa";
import type {
  CauHinhMacDinh,
  DongTangCa,
  LoaiTangCa,
  TangCaNhanVienRow,
} from "../../../types";

/** Cột của sheet "Bảng tăng ca" — thứ tự này là hợp đồng giữa xuất và nhập. */
const COT_BANG = [
  { header: "Mã loại", width: 20 },
  { header: "Loại tăng ca", width: 30 },
  { header: "Số giờ OT", width: 14 },
  { header: "Quy đổi", width: 14 },
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

/** Chấp nhận cả `12,5` lẫn `12.5` — xem ghi chú ở `kpiExcel.soO`. */
function soO(giaTri: CellValue): number {
  if (typeof giaTri === "number") return giaTri;
  const text = chuoiO(giaTri).replace(/\s/g, "").replace(/h$/i, "").replace(",", ".");
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

/** Sheet tra cứu mã ↔ tên ↔ hệ số, để người điền file biết gõ mã nào vào cột đầu. */
function themSheetDanhMuc(wb: Workbook, cauHinh: CauHinhMacDinh): void {
  const ws = wb.addWorksheet("Loại tăng ca");
  ws.columns = [
    { header: "Mã loại", width: 20 },
    { header: "Loại tăng ca", width: 30 },
    { header: "Hệ số (%)", width: 14 },
  ];
  toTieuDe(ws, 3);
  for (const item of LOAI_TANG_CA) {
    ws.addRow([item.value, item.label, cauHinh[item.truong]]);
  }
}

/** File mẫu để nhập tăng ca: đủ sáu loại, cột số giờ để trống cho người dùng điền. */
export async function taiFileMauTangCa(cauHinh: CauHinhMacDinh): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Bảng tăng ca");
  ws.columns = COT_BANG;
  toTieuDe(ws, COT_BANG.length);

  for (const item of LOAI_TANG_CA) {
    ws.addRow([item.value, item.label, null, null]);
  }

  themSheetDanhMuc(wb, cauHinh);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Mau-nhap-tang-ca.xlsx");
}

/** Xuất bảng tăng ca đang soạn + danh sách nhân viên đang lọc. */
export async function xuatTangCaExcel(
  dong: DongTangCa[],
  cauHinh: CauHinhMacDinh,
  rows: TangCaNhanVienRow[],
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();

  const wsBang = wb.addWorksheet("Bảng tăng ca");
  wsBang.columns = COT_BANG;
  toTieuDe(wsBang, COT_BANG.length);
  for (const d of dong) {
    wsBang.addRow([
      d.loai,
      d.loai ? moTaLoaiTangCa(d.loai).label : "",
      d.so_gio,
      gioQuyDoi(d, cauHinh),
    ]);
  }
  // Cách một dòng rồi mới tới tổng: dòng này KHÔNG phải một loại giờ, dính liền
  // bảng thì lượt nhập lại sẽ tưởng nó là dòng dữ liệu.
  wsBang.addRow([]);
  wsBang.addRow(["", "Tổng cộng", tongGioOt(dong), tongGioQuyDoi(dong, cauHinh)]);

  const wsNv = wb.addWorksheet("Nhân viên");
  wsNv.columns = [
    { header: "Mã", width: 12 },
    { header: "Họ và tên", width: 26 },
    { header: "Phòng ban", width: 26 },
    { header: "Tổng giờ theo tháng", width: 20 },
    { header: "Tổng giờ năm", width: 16 },
    { header: "Quy đổi", width: 14 },
  ];
  toTieuDe(wsNv, 6);
  for (const row of rows) {
    wsNv.addRow([
      row.ma_nv,
      row.ho_ten,
      row.ten_pb,
      row.gio_thang,
      row.gio_nam,
      row.gio_thang === null ? null : row.gio_quy_doi,
    ]);
  }

  themSheetDanhMuc(wb, cauHinh);
  taiVe((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Bang-tang-ca.xlsx");
}

/**
 * Đọc sheet đầu của file người dùng chọn thành các dòng tăng ca.
 *
 * Khớp loại theo **mã** trước, không có mã mới dò theo tên. Dòng không tra ra
 * loại thì báo đích danh số dòng — nhập sót một loại giờ là lương làm thêm của
 * cả danh sách bị hụt.
 *
 * Dòng để trống cột "Số giờ OT" bị bỏ qua: file mẫu liệt kê sẵn **cả sáu** loại,
 * người dùng chỉ điền vào những loại kỳ này thực sự có.
 */
export async function docFileTangCa(file: File): Promise<DongTangCa[]> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào đọc được.");

  const theoMa = new Map(LOAI_TANG_CA.map((item) => [item.value.toLowerCase(), item.value]));
  const theoTen = new Map(
    LOAI_TANG_CA.map((item) => [item.label.trim().toLowerCase(), item.value]),
  );

  const dong: DongTangCa[] = [];
  const dongLoi: number[] = [];
  const daGap = new Set<LoaiTangCa>();

  ws.eachRow((row, soDong) => {
    if (soDong === 1) return; // hàng tiêu đề
    const ma = chuoiO(row.getCell(1).value);
    const ten = chuoiO(row.getCell(2).value);
    if (!ma && !ten) return; // dòng trống
    // Dòng tổng do chính "Xuất Excel" ghi ra, không phải một loại giờ.
    if (!ma && ten.toLowerCase().startsWith("tổng cộng")) return;

    const loai = theoMa.get(ma.toLowerCase()) ?? theoTen.get(ten.toLowerCase());
    if (!loai) {
      dongLoi.push(soDong);
      return;
    }
    const soGio = soO(row.getCell(3).value);
    if (soGio <= 0) return;
    // Cùng một loại hai lần thì giờ cộng đôi — lấy lần đầu, bỏ các lần sau.
    if (daGap.has(loai)) return;
    daGap.add(loai);

    dong.push({ id: sinhIdDongTangCa(), loai, so_gio: soGio });
  });

  if (dongLoi.length > 0) {
    throw new Error(
      `Không tra được loại tăng ca ở dòng ${dongLoi.join(", ")}. Hãy dùng mã hoặc tên đúng như sheet "Loại tăng ca".`,
    );
  }
  if (dong.length === 0) {
    throw new Error("File không có dòng tăng ca nào có số giờ lớn hơn 0.");
  }
  return dong;
}

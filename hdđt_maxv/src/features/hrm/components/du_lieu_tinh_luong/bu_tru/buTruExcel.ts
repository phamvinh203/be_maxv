/**
 * Ba nút file của màn Các khoản ứng - bù trừ — cùng cách làm với
 * `kpi/kpiExcel.ts`: một bố cục cột dùng chung cho tải mẫu, xuất và nhập, để
 * file xuất ra nhập lại được ngay.
 */

import type { Workbook } from "exceljs";
import { moTaChieuBuTru } from "../../../_shared/constants";
import { sinhIdDongBuTru, tongBiTru } from "../../../calculations/du_lieu_tinh_luong/buTru";
import { chuoiO, soTien, taiXlsx, TIEN_FMT, toTieuDe } from "../_shared/excel";
import type { BuTruNhanVienRow, DongBuTru, KhoanBuTru } from "../../../types";

/** Cột của sheet "Ứng - bù trừ" — thứ tự này là hợp đồng giữa xuất và nhập. */
const COT_BANG = [
  { header: "Mã khoản", width: 14 },
  { header: "Khoản bù trừ", width: 34 },
  { header: "Chiều", width: 20 },
  { header: "Số tiền", width: 18 },
];

/** Sheet tra cứu mã ↔ tên ↔ chiều, để người điền file biết gõ mã nào vào cột đầu. */
function themSheetDanhMuc(wb: Workbook, danhMuc: KhoanBuTru[]): void {
  const ws = wb.addWorksheet("Danh mục bù trừ");
  ws.columns = [
    { header: "Mã khoản", width: 14 },
    { header: "Tên khoản", width: 34 },
    { header: "Chiều", width: 20 },
    { header: "Ghi chú", width: 40 },
    { header: "Trạng thái", width: 14 },
  ];
  toTieuDe(ws, 5);
  for (const bt of danhMuc) {
    ws.addRow([
      bt.ma_bt,
      bt.ten_bt,
      moTaChieuBuTru(bt.chieu).label,
      bt.ghi_chu,
      bt.status === "1" ? "Đang dùng" : "Ngừng",
    ]);
  }
}

/**
 * File mẫu để nhập ứng - bù trừ: các khoản đang dùng, cột số tiền để trống.
 *
 * Cột "Chiều" điền sẵn và **chỉ để đọc** — lượt nhập lại bỏ qua cột này, chiều
 * luôn lấy theo danh mục. Sửa chữ trong ô đó không đổi được dấu của khoản.
 */
export async function taiFileMauBuTru(danhMuc: KhoanBuTru[]): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  const ws = wb.addWorksheet("Ứng - bù trừ");
  ws.columns = COT_BANG;
  ws.getColumn(4).numFmt = TIEN_FMT;
  toTieuDe(ws, COT_BANG.length);

  for (const bt of danhMuc.filter((item) => item.status === "1")) {
    ws.addRow([bt.ma_bt, bt.ten_bt, moTaChieuBuTru(bt.chieu).label, null]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Mau-nhap-ung-bu-tru.xlsx");
}

/** Xuất bảng đang soạn + danh sách nhân viên đang lọc. */
export async function xuatBuTruExcel(
  dong: DongBuTru[],
  danhMuc: KhoanBuTru[],
  rows: BuTruNhanVienRow[],
): Promise<void> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const khoanTheoMa = new Map(danhMuc.map((bt) => [bt.ma_bt, bt]));
  const wb = new LopWorkbook();

  const wsBang = wb.addWorksheet("Ứng - bù trừ");
  wsBang.columns = COT_BANG;
  wsBang.getColumn(4).numFmt = TIEN_FMT;
  toTieuDe(wsBang, COT_BANG.length);
  for (const d of dong) {
    const khoan = khoanTheoMa.get(d.ma_bt);
    wsBang.addRow([
      d.ma_bt,
      khoan?.ten_bt ?? d.ma_bt,
      khoan ? moTaChieuBuTru(khoan.chieu).label : "",
      d.so_tien,
    ]);
  }
  // Cách một dòng rồi mới tới tổng: dòng này KHÔNG phải một khoản, dính liền
  // bảng thì lượt nhập lại sẽ tưởng nó là dòng dữ liệu.
  wsBang.addRow([]);
  wsBang.addRow(["", "Tổng bị trừ", "", tongBiTru(dong, khoanTheoMa)]);

  const wsNv = wb.addWorksheet("Nhân viên");
  wsNv.columns = [
    { header: "Mã", width: 12 },
    { header: "Họ và tên", width: 26 },
    { header: "Phòng ban", width: 26 },
    { header: "Tổng bị trừ", width: 18 },
  ];
  wsNv.getColumn(4).numFmt = TIEN_FMT;
  toTieuDe(wsNv, 4);
  for (const row of rows) {
    wsNv.addRow([row.ma_nv, row.ho_ten, row.ten_pb, row.tong_bi_tru]);
  }

  themSheetDanhMuc(wb, danhMuc);
  taiXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer, "Bang-ung-bu-tru.xlsx");
}

/**
 * Đọc sheet đầu của file người dùng chọn thành các dòng ứng - bù trừ.
 *
 * Khớp khoản theo **mã** trước, không có mã mới dò theo tên. Dòng không tra ra
 * khoản thì báo đích danh số dòng — nhập sót một khoản ứng là kỳ này quên thu
 * hồi tiền đã đưa.
 *
 * Số tiền âm trong file bị coi là lỗi chứ không tự đảo dấu: chiều đã khai ở danh
 * mục, một dấu trừ lọt vào sẽ biến khoản khấu trừ thành khoản cộng thêm.
 */
export async function docFileBuTru(
  file: File,
  danhMuc: KhoanBuTru[],
): Promise<DongBuTru[]> {
  const { Workbook: LopWorkbook } = await import("exceljs");
  const wb = new LopWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có sheet nào đọc được.");

  const theoMa = new Map(danhMuc.map((bt) => [bt.ma_bt.toLowerCase(), bt]));
  const theoTen = new Map(danhMuc.map((bt) => [bt.ten_bt.trim().toLowerCase(), bt]));

  const dong: DongBuTru[] = [];
  const dongLoi: number[] = [];
  const dongAm: number[] = [];
  const daGap = new Set<string>();

  ws.eachRow((row, soDong) => {
    if (soDong === 1) return; // hàng tiêu đề
    const ma = chuoiO(row.getCell(1).value);
    const ten = chuoiO(row.getCell(2).value);
    if (!ma && !ten) return; // dòng trống
    // Dòng tổng do chính "Xuất Excel" ghi ra, không phải một khoản.
    if (!ma && ten.toLowerCase().startsWith("tổng bị trừ")) return;

    const khoan = theoMa.get(ma.toLowerCase()) ?? theoTen.get(ten.toLowerCase());
    if (!khoan) {
      dongLoi.push(soDong);
      return;
    }
    const tien = soTien(row.getCell(4).value);
    if (tien < 0) {
      dongAm.push(soDong);
      return;
    }
    if (tien === 0) return; // khoản kỳ này không phát sinh
    // Cùng một khoản hai lần thì tiền cộng đôi — lấy lần đầu, bỏ các lần sau.
    if (daGap.has(khoan.ma_bt)) return;
    daGap.add(khoan.ma_bt);

    dong.push({ id: sinhIdDongBuTru(), ma_bt: khoan.ma_bt, so_tien: tien });
  });

  if (dongLoi.length > 0) {
    throw new Error(
      `Không tra được khoản bù trừ ở dòng ${dongLoi.join(", ")}. Hãy dùng mã hoặc tên đúng như sheet "Danh mục bù trừ".`,
    );
  }
  if (dongAm.length > 0) {
    throw new Error(
      `Số tiền âm ở dòng ${dongAm.join(", ")}. Nhập số dương — khoản là trừ hay bù đã khai ở danh mục.`,
    );
  }
  if (dong.length === 0) {
    throw new Error("File không có dòng nào có số tiền lớn hơn 0.");
  }
  return dong;
}

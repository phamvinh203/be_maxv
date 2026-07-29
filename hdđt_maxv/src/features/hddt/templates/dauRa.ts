/**
 * ===== CỘT HÓA ĐƠN ĐẦU RA (bán ra) =====
 *
 * Toàn bộ cột của chiều bán ra nằm TRỌN trong file này: bảng "Tổng quát" và bảng "Chi tiết" trên
 * web, đồng thời là 2 sheet của `Tong-hop-dau-ra-<khoảng>.xlsx`. Sửa cột đầu ra chỉ mở file này.
 *
 * Chiều đầu vào có file riêng `dauVao.ts` — cố ý KHÔNG dùng chung để hai chiều tiến hóa độc lập.
 * Đổi lại, cột dùng chung cả hai chiều (các cột tiền, trạng thái…) phải sửa ở CẢ HAI file.
 */
import { trangThaiHdLabel, ketQuaKiemTraLabel } from "../api/gdt";
import { formatDateVN } from "../dateUtils";
import { ttTaiLabel } from "../format";
import type { DetailRow, DisplayRow } from "../types";
import { ttTaiCell } from "./cells";
import { MONEY_FMT, NUM_FMT, type InvoiceColumn } from "./types";

/**
 * Bảng "Tổng quát" đầu ra — 23 cột trên web, 22 cột trong file Excel (cột "Chọn" là `webOnly`).
 * Thứ tự theo mẫu lưới của phần mềm kế toán.
 * Khối MST / Tên công ty / Địa chỉ ở chiều này là BÊN MUA (khách hàng) — bên bán vốn đã là công ty
 * đang chọn nên lặp y hệt ở mọi dòng, không mang thông tin gì.
 * Cột "Chọn" là `webOnly`: checkbox cần state nên `InvoiceListTabs` tự render, file xuất bỏ qua.
 */
export function overviewDauRa(): InvoiceColumn<DisplayRow>[] {
  return [
    { key: "stt", header: "STT", width: 6, value: (_r, stt) => stt },
    { key: "chon", header: "Chọn", width: 6, align: "center", webOnly: true, value: () => undefined },
    {
      key: "ttTai",
      header: "T. thái tải",
      width: 11,
      align: "center",
      value: (r) => ttTaiLabel(r.ttTai),
      cell: (r) => ttTaiCell(r.ttTai),
    },
    { key: "mauHd", header: "Ký hiệu mẫu số", width: 14, value: (r) => r.mauHd },
    { key: "soSeri", header: "Ký hiệu hóa đơn", width: 16, value: (r) => r.soSeri },
    { key: "soHd", header: "Số hóa đơn", width: 12, value: (r) => r.soHd },
    { key: "ngayLap", header: "Ngày lập", width: 12, value: (r) => formatDateVN(r.ngayLap) },
    // `|| undefined` để ô rỗng đi theo quy ước chung: file xuất ghi ô trống, web hiện "—".
    { key: "ngayKy", header: "Ngày ký", width: 12, value: (r) => formatDateVN(r.ngayKy) || undefined },
    { key: "buyerMst", header: "MST người mua", width: 15, value: (r) => r.buyerMst },
    { key: "buyerTen", header: "Tên công ty người mua", width: 34, value: (r) => r.buyerTen },
    { key: "buyerDiaChi", header: "Địa chỉ người mua", width: 40, value: (r) => r.buyerDiaChi },
    {
      key: "tienChuaThue",
      header: "Tổng tiền chưa thuế",
      width: 17,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tienChuaThue,
    },
    {
      key: "tienThue",
      header: "Tổng tiền thuế",
      width: 15,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tienThue,
    },
    {
      key: "cktm",
      header: "Tổng CKTM",
      width: 14,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.cktm,
    },
    {
      key: "phi",
      header: "Tổng phí",
      width: 12,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.phi,
    },
    {
      key: "tongTt",
      header: "Tổng tiền thanh toán",
      width: 18,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tongTt,
    },
    { key: "maNt", header: "Mã nt", width: 8, value: (r) => r.maNt },
    {
      key: "tyGia",
      header: "Tỷ giá",
      width: 10,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.tyGia,
    },
    {
      key: "trangThaiHd",
      header: "Trạng thái hóa đơn",
      width: 18,
      align: "center",
      value: (r) => trangThaiHdLabel(r.trangThaiHd),
    },
    {
      key: "ketQuaKt",
      header: "Kết quả kiểm tra",
      width: 16,
      align: "center",
      value: (r) => ketQuaKiemTraLabel(r.ketQuaKt),
    },
    // Ba cột dưới chưa có nguồn dữ liệu: `undefined` -> web hiện "—", file xuất để ô trống.
    { key: "maCtHachToan", header: "Mã ct hạch toán", width: 14, value: () => undefined },
    { key: "tenCtHachToan", header: "Tên chứng từ hạch toán", width: 22, value: () => undefined },
    {
      key: "hoaDonRuiRo",
      header: "Hóa đơn rủi ro",
      width: 13,
      align: "center",
      value: () => undefined,
    },
  ];
}

/**
 * Bảng "Chi tiết hóa đơn" đầu ra — 28 cột. 1 dòng = 1 dòng hàng hóa; thông tin hóa đơn lặp lại
 * ở mỗi dòng hàng của cùng một hóa đơn. Có thêm cột "Địa chỉ người mua" so với chiều đầu vào.
 */
export function detailDauRa(): InvoiceColumn<DetailRow>[] {
  return [
    { key: "stt", header: "STT", width: 6, value: (_r, stt) => stt },
    { key: "mauHd", header: "Mẫu số", width: 12, value: (r) => r.mauHd },
    { key: "kyHieu", header: "Ký hiệu", width: 14, value: (r) => r.kyHieu },
    { key: "soHd", header: "Số hóa đơn", width: 12, value: (r) => r.soHd },
    { key: "ngayHd", header: "Ngày hóa đơn", width: 13, value: (r) => formatDateVN(r.ngayHd) },
    { key: "buyerMst", header: "MST người mua", width: 15, value: (r) => r.buyerMst },
    { key: "buyerTen", header: "Tên công ty người mua", width: 32, value: (r) => r.buyerTen },
    { key: "buyerDiaChi", header: "Địa chỉ người mua", width: 40, value: (r) => r.buyerDiaChi },
    { key: "tenHang", header: "Tên hàng hóa", width: 36, value: (r) => r.tenHang },
    { key: "dvt", header: "Đvt", width: 8, value: (r) => r.dvt },
    {
      key: "soLuong",
      header: "Số lượng",
      width: 11,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.soLuong,
    },
    { key: "gia", header: "Giá", width: 14, align: "right", numFmt: NUM_FMT, value: (r) => r.gia },
    {
      key: "tienCk",
      header: "Tiền CK",
      width: 12,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tienCk,
    },
    {
      key: "tienChuaThue",
      header: "Tiền chưa thuế",
      width: 15,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tienChuaThue,
    },
    {
      key: "thue",
      header: "Thuế",
      width: 13,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.thue,
    },
    {
      key: "tienSauThue",
      header: "Tiền sau thuế",
      width: 15,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tienSauThue,
    },
    {
      key: "tlCktm",
      header: "TL CKTM",
      width: 10,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.tlCktm,
    },
    { key: "thueSuat", header: "Thuế suất", width: 10, align: "center", value: (r) => r.thueSuat },
    { key: "maNt", header: "Mã nt", width: 8, value: (r) => r.maNt },
    {
      key: "tyGia",
      header: "Tỷ giá",
      width: 10,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.tyGia,
    },
    {
      key: "tongTienHang",
      header: "Tổng tiền hàng",
      width: 16,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tongTienHang,
    },
    {
      key: "tongThue",
      header: "Tổng tiền thuế",
      width: 15,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tongThue,
    },
    {
      key: "tongCk",
      header: "Tổng CK",
      width: 13,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tongCk,
    },
    {
      key: "tongPhi",
      header: "Tổng phí",
      width: 12,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tongPhi,
    },
    {
      key: "tongTt",
      header: "Tổng thanh toán",
      width: 17,
      align: "right",
      numFmt: MONEY_FMT,
      value: (r) => r.tongTt,
    },
    { key: "hinhThucTt", header: "Hình thức thanh toán", width: 18, value: (r) => r.hinhThucTt },
    {
      key: "trangThaiHd",
      header: "Trạng thái hóa đơn",
      width: 18,
      align: "center",
      value: (r) => trangThaiHdLabel(r.trangThaiHd),
    },
    {
      key: "ketQuaKt",
      header: "Kết quả kiểm tra",
      width: 16,
      align: "center",
      value: (r) => ketQuaKiemTraLabel(r.ketQuaKt),
    },
  ];
}

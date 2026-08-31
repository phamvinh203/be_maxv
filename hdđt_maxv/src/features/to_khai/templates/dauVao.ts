/**
 * ===== CỘT HÓA ĐƠN MUA VÀO — BẢN RIÊNG CỦA MÔ-ĐUN "TỜ KHAI" =====
 *
 * Cùng 26 cột và cùng thứ tự với `dauRa.ts` (mẫu bảng kê lập tờ khai), khác đúng ba cột đối tác:
 * MST / Tên / Địa chỉ ở đây là bên BÁN (mình là người mua), bên kia là bên MUA.
 *
 * Sửa cột màn Tờ khai: sửa ở đây. Sửa cột màn Hóa đơn điện tử: sửa bên `hddt/templates/dauVao.ts`.
 * Hai bên đã tách hẳn — đừng "đồng bộ lại cho giống" trừ khi có lý do nghiệp vụ.
 *
 * Import trỏ sang `hddt/` là phần HẠ TẦNG dùng chung (kiểu `InvoiceColumn`, định dạng số, nhãn
 * trạng thái) — thứ không có lý do để hai mô-đun khác nhau.
 */
import { trangThaiHdLabel, ketQuaKiemTraLabel } from "../../hddt/api/gdt";
import { formatDateVN } from "../../hddt/dateUtils";
import { numericText } from "../../hddt/format";
import { invoiceFileBase } from "../../hddt/invoiceFileName";
import type { ToKhaiRow } from "../ky";
import { oChiTieuTangGiamCell, oKeKhaiCell } from "./quyetDinhCell";
import {
  MONEY2_FMT,
  RATE_FMT,
  TOTAL_COL_WIDTH,
  ghiChuDacBiet,
  type InvoiceColumn,
} from "../../hddt/templates/types";


export function overviewDauVao(): InvoiceColumn<ToKhaiRow>[] {
  return [
    { key: "stt", header: "STT", width: 8, webWidth: 56, value: (_r, stt) => stt },
    {
      key: "mauHd",
      header: "Ký hiệu mẫu số",
      width: 14,
      webWidth: 100,
      value: (r) => numericText(r.mauHd),
    },
    {
      key: "soSeri",
      header: "Ký hiệu hóa đơn",
      width: 16,
      webWidth: 110,
      value: (r) => r.soSeri,
    },
    {
      key: "soHd",
      header: "Số hóa đơn",
      width: 12,
      webWidth: 85,
      value: (r) => numericText(r.soHd),
    },
    {
      key: "ngayLap",
      header: "Ngày lập",
      width: 16,
      webWidth: 112,
      excelText: true,
      value: (r) => formatDateVN(r.ngayLap),
    },
    {
      // `excelText`: giữ nguyên `dd-MM-yyyy`, không cho Excel diễn giải thành số ngày tháng.
      key: "ngayLienQuan",
      header: "Ngày hóa đơn bị điều chỉnh/thay thế",
      width: 16,
      webWidth: 180,
      excelText: true,
      value: (r) => r.ngayLienQuan || undefined,
    },
    {
      key: "nam",
      header: "Năm",
      width: 8,
      webWidth: 70,
      excelText: true,
      value: (r) => r.nam,
    },
    {
      key: "kyKeKhai",
      header: "Kỳ kê khai",
      width: 18,
      webWidth: 145,
      value: (r) => r.kyKeKhai,
    },
    {
      // Hai cột nghiệp vụ đọc từ bảng đánh dấu `tokhai_ky_hoa_don` — lượt "Kê khai" ghi vào đó.
      // Sửa được ngay tại dòng qua `cell` (xem `components/OQuyetDinh.tsx`); `value` vẫn giữ để
      // file Excel xuất ra có chữ thay vì ô trống.
      key: "chiTieuTangGiam",
      header: "Chỉ tiêu tăng giảm",
      width: 18,
      webWidth: 140,
      value: (r) => r.chiTieuTangGiam,
      cell: (r) => oChiTieuTangGiamCell(r),
    },
    {
      key: "keKhai",
      header: "Kê khai/không kê khai",
      width: 20,
      webWidth: 155,
      value: (r) => (r.keKhai ? "Kê khai" : "Không kê khai"),
      cell: (r) => oKeKhaiCell(r),
    },
    {
      key: "sellerMst",
      header: "MST người bán/MST người xuất hàng",
      width: 28,
      webWidth: 180,
      value: (r) => r.sellerMst,
    },
    {
      key: "sellerTen",
      header: "Tên người bán/Tên người xuất hàng",
      width: 34,
      webWidth: 180,
      value: (r) => r.sellerTen,
    },
    {
      key: "tenHang",
      header: "Tên hàng hóa, dịch vụ",
      width: 34,
      webWidth: 238,
      value: (r) => r.tenHang || undefined,
    },
    {
      key: "tienChuaThue",
      total: true,
      header: "Tổng tiền chưa thuế",
      width: TOTAL_COL_WIDTH,
      webWidth: 150,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienChuaThue,
    },
    {
      key: "tienThue",
      total: true,
      header: "Tổng tiền thuế",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienThue,
    },
    {
      key: "cktm",
      header: "Tổng tiền chiết khấu thương mại",
      width: 24,
      webWidth: 170,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.cktm,
    },
    {
      key: "phi",
      header: "Tổng tiền phí",
      width: 16,
      webWidth: 112,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.phi,
    },
    {
      key: "tongTt",
      total: true,
      header: "Tổng tiền thanh toán",
      width: TOTAL_COL_WIDTH,
      webWidth: 140,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tongTt,
    },
    { key: "maNt", header: "Đơn vị tiền tệ", width: 14, webWidth: 95, value: (r) => r.maNt },
    {
      key: "tyGia",
      header: "Tỷ giá",
      width: 10,
      webWidth: 95,
      align: "right",
      numFmt: RATE_FMT,
      value: (r) => r.tyGia,
    },
    {
      key: "ghiChuLienQuan",
      header: "Ghi chú bị điều chỉnh, thay thế",
      width: 30,
      webWidth: 270,
      value: (r) => r.ghiChuLienQuan || undefined,
    },
    {
      key: "ghiChuDacBiet",
      header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
      width: 30,
      webWidth: 250,
      value: (r) => ghiChuDacBiet(r),
    },
    {
      key: "trangThaiHd",
      header: "Trạng thái hóa đơn",
      width: 18,
      webWidth: 140,
      value: (r) => trangThaiHdLabel(r.trangThaiHd),
    },
    {
      key: "ketQuaKt",
      header: "Kết quả kiểm tra hóa đơn",
      width: 52,
      webWidth: 165,
      value: (r) => ketQuaKiemTraLabel(r.ketQuaKt),
    },
    {
      key: "tenFile",
      header: "Tên file xuất hóa đơn (XML/HTML/PDF)",
      width: 36,
      webWidth: 290,
      value: (r, stt) => invoiceFileBase(stt, r.ngayLap, r.soHd, r.sellerMst),
    },
    {
      key: "sellerDiaChi",
      header: "Địa chỉ người bán",
      width: 34,
      webWidth: 265,
      value: (r) => r.sellerDiaChi,
    },
  ];
}

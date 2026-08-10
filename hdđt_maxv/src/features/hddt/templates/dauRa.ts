/**
 * ===== CỘT HÓA ĐƠN ĐẦU RA (bán ra) =====
 *
 * Toàn bộ cột của chiều bán ra nằm TRỌN trong file này: bảng "Tổng quát" và bảng "Chi tiết" trên
 * web, đồng thời là 2 sheet của `Tong-hop-dau-ra-<khoảng>.xlsx`. Sửa cột đầu ra chỉ mở file này.
 *
 * Chiều đầu vào có file riêng `dauVao.ts` — cố ý KHÔNG dùng chung để hai chiều tiến hóa độc lập.
 * Đổi lại, cột dùng chung cả hai chiều (các cột tiền, trạng thái…) phải sửa ở CẢ HAI file.
 *
 * TIÊU ĐỀ, THỨ TỰ, ĐỘ RỘNG và ĐỊNH DẠNG Ô ở đây bám theo mẫu Excel kế toán đang dùng
 * (`0111142786_HDCTBanRa …xlsx` + `Chi_tiet_HD_ban_ra_theo_tung_san_pham…xlsx`) — đổi thì file
 * xuất ra sẽ lệch mẫu, cân nhắc trước khi sửa.
 */
import { trangThaiHdLabel, ketQuaKiemTraLabel } from "../api/gdt";
import { formatDateVN } from "../dateUtils";
import { numericText, toVnd, ttTaiLabel } from "../format";
import { invoiceFileBase } from "../invoiceFileName";
import { tinhChatLabel } from "../invoiceView";
import type { DetailRow, DisplayRow } from "../types";
import { ttTaiCell } from "./cells";
import {
  MONEY2_FMT,
  NUM_FMT,
  NO_DATA_YET,
  RATE_FMT,
  chiDongDau,
  khongLap,
  type InvoiceColumn,
} from "./types";

/**
 * Nội dung cột "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn" — cảnh báo TỰ SINH từ chính
 * dữ liệu hóa đơn (mẫu Excel của kế toán ghi kiểu "Thiếu địa chỉ người mua").
 *
 * Dùng CHUNG cho bảng Tổng quát và bảng Chi tiết: hai bảng nói về cùng một hóa đơn nên không được
 * cảnh báo khác nhau. Không có cảnh báo nào -> `undefined` (web hiện "—", file xuất để ô trống).
 */
function ghiChuDacBiet(r: { buyerDiaChi: string; trangThaiHd: string }): string | undefined {
  const warnings: string[] = [];
  if (!r.buyerDiaChi) warnings.push("Thiếu địa chỉ người mua");
  if (r.trangThaiHd === "4") warnings.push("Hóa đơn này không được kê khai");
  return warnings.length > 0 ? warnings.join(". ") : undefined;
}

/**
 * Bảng "Tổng quát" đầu ra — 25 cột trên web, 23 cột trong file Excel.
 * Bên đối tác ở chiều này là NGƯỜI MUA (khách hàng) — bên bán vốn đã là công ty đang chọn nên lặp
 * y hệt ở mọi dòng; vẫn giữ hai cột người bán vì mẫu Excel của kế toán có.
 *
 * HAI CỘT ĐẦU LÀ `webOnly` (không ra file Excel) vì chúng là công cụ của màn hình chứ không phải
 * dữ liệu hóa đơn — nhờ vậy sheet Excel khớp đúng danh sách cột nghiệp vụ:
 *  - "Chọn": checkbox cần state nên `InvoiceListTabs` tự render; bỏ cột này là mất luôn nút
 *    "Xem hóa đơn" (nút bật/tắt theo dòng đang chọn).
 *  - "T. thái tải": đèn báo tiến độ tải chi tiết, điền dần trong lúc lượt "Cập nhật"/"Tải chi tiết"
 *    chạy nền — người dùng nhìn cột này để biết hóa đơn nào đã có chi tiết.
 */
export function overviewDauRa(): InvoiceColumn<DisplayRow>[] {
  return [
    { key: "stt", header: "STT", width: 8, value: (_r, stt) => stt },
    { key: "chon", header: "Chọn", width: 6, align: "center", webOnly: true, value: () => undefined },
    {
      key: "ttTai",
      header: "T. thái tải",
      width: 11,
      align: "center",
      webOnly: true,
      value: (r) => ttTaiLabel(r.ttTai),
      cell: (r) => ttTaiCell(r.ttTai),
    },
    { key: "mauHd", header: "Ký hiệu mẫu số", width: 14, value: (r) => numericText(r.mauHd) },
    { key: "soSeri", header: "Ký hiệu hóa đơn", width: 16, value: (r) => r.soSeri },
    { key: "soHd", header: "Số hóa đơn", width: 12, value: (r) => numericText(r.soHd) },
    {
      key: "ngayLap",
      header: "Ngày lập",
      width: 16,
      excelText: true,
      value: (r) => formatDateVN(r.ngayLap),
    },
    {
      key: "sellerMst",
      header: "MST người bán/MST người xuất hàng",
      width: 28,
      value: (r) => r.sellerMst,
    },
    {
      key: "sellerTen",
      header: "Tên người bán/Tên người xuất hàng",
      width: 34,
      value: (r) => r.sellerTen,
    },
    {
      key: "buyerMst",
      header: "MST người mua/MST người nhận hàng",
      width: 22,
      value: (r) => r.buyerMst,
    },
    {
      key: "buyerTen",
      header: "Tên người mua/Tên người nhận hàng",
      width: 44,
      value: (r) => r.buyerTen,
    },
    { key: "buyerDiaChi", header: "Địa chỉ người mua", width: 34, value: (r) => r.buyerDiaChi },
    {
      // Mỗi dòng ở bảng này là MỘT HÓA ĐƠN, nên chỉ hiện được mặt hàng ĐẦU TIÊN của hóa đơn — hóa
      // đơn nhiều dòng hàng phải xem bảng "Chi tiết hóa đơn" mới đủ. Hóa đơn chưa tải chi tiết
      // (nguồn của cột này) để trống.
      key: "tenHang",
      header: "Tên hàng hóa, dịch vụ",
      width: 34,
      value: (r) => r.tenHang || undefined,
    },
    {
      key: "tienChuaThue",
      header: "Tổng tiền chưa thuế",
      width: 18,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienChuaThue,
    },
    {
      key: "tienThue",
      header: "Tổng tiền thuế",
      width: 16,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienThue,
    },
    {
      key: "cktm",
      header: "Tổng tiền chiết khấu thương mại",
      width: 24,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.cktm,
    },
    {
      key: "phi",
      header: "Tổng tiền phí",
      width: 16,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.phi,
    },
    {
      key: "tongTt",
      header: "Tổng tiền thanh toán",
      width: 20,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tongTt,
    },
    { key: "maNt", header: "Đơn vị tiền tệ", width: 14, value: (r) => r.maNt },
    {
      key: "tyGia",
      header: "Tỷ giá",
      width: 10,
      align: "right",
      numFmt: RATE_FMT,
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
      header: "Kết quả kiểm tra hóa đơn",
      width: 52,
      align: "center",
      value: (r) => ketQuaKiemTraLabel(r.ketQuaKt),
    },
    {
      // Tên CHUNG của 3 file (.xml/.html/.pdf) mà nút "Xuất file tổng hợp và hóa đơn" ghi ra —
      // suy từ chính hàm đặt tên của lượt xuất nên luôn khớp tên file thật trên đĩa.
      // `stt` truyền vào chính là vị trí dòng trong bảng này — cũng là số mở đầu tên file.
      key: "tenFile",
      header: "Tên file xuất hóa đơn (XML/HTML/PDF)",
      width: 36,
      value: (r, stt) => invoiceFileBase(stt, r.ngayLap, r.soHd, r.sellerMst),
    },
    // Hai cột ghi chú khép lại bảng, ĐÚNG THỨ TỰ và cùng nội dung với bảng "Chi tiết hóa đơn".
    {
      key: "ghiChuLienQuan",
      header: "Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh",
      width: 30,
      value: (r) => r.ghiChuLienQuan || undefined,
    },
    {
      key: "ghiChuDacBiet",
      header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
      width: 30,
      value: (r) => ghiChuDacBiet(r),
    },
  ];
}

export function detailDauRa(): InvoiceColumn<DetailRow>[] {
  return [
    { key: "mauHd", header: "Mẫu số HD", width: 6, value: (r) => numericText(r.mauHd) },
    { key: "kyHieu", header: "Ký hiệu hóa đơn", width: 10, value: (r) => r.kyHieu },
    { key: "soHd", header: "Số hóa đơn", width: 10, value: (r) => numericText(r.soHd) },
    {
      key: "ngayHd",
      header: "Ngày lập hóa đơn",
      width: 12,
      excelText: true,
      value: (r) => formatDateVN(r.ngayHd),
    },
    {
      key: "ngayKy",
      header: "Ngày người bán ký số",
      width: 12,
      excelText: true,
      value: (r) => formatDateVN(r.ngayKy) || undefined,
    },
    { key: "sellerTen", header: "Tên người bán", width: 30, value: (r) => r.sellerTen },
    { key: "sellerMst", header: "MST người bán", width: 16, value: (r) => r.sellerMst },
    { key: "sellerDiaChi", header: "Địa chỉ người bán", width: 30, value: (r) => r.sellerDiaChi },
    { key: "buyerTen", header: "Tên người mua", width: 30, value: (r) => r.buyerTen },
    { key: "buyerMst", header: "MST người mua", width: 16, value: (r) => r.buyerMst },
    { key: "buyerDiaChi", header: "Địa chỉ người mua", width: 30, value: (r) => r.buyerDiaChi },
    { key: "maVt", header: "Mã VT", width: 12, value: (r) => r.maVt },
    { key: "tenHang", header: "Tên hàng hóa, dịch vụ", width: 30, value: (r) => r.tenHang },
    { key: "dvt", header: "Đơn vị tính", width: 12, value: (r) => r.dvt },
    {
      key: "soLuong",
      header: "Số lượng",
      width: 12,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.soLuong,
    },
    {
      key: "gia",
      header: "Đơn giá",
      width: 12,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.gia,
    },
    {
      // TỶ LỆ chiết khấu (%) của dòng hàng — số tiền chiết khấu nằm ở cột "Số tiền chiết khấu".
      key: "tlCktm",
      header: "Chiết khấu",
      width: 12,
      align: "right",
      numFmt: NUM_FMT,
      value: (r) => r.tlCktm,
    },
    { key: "thueSuat", header: "Thuế suất", width: 14, align: "center", value: (r) => r.thueSuat },
    {
      key: "tienChuaThue",
      header: "Tiền chưa thuế nguyên tệ",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienChuaThue,
    },
    {
      key: "thueDong",
      header: "Tiền thuế nguyên tệ",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.thueDong,
    },
    {
      key: "tienSauThueDong",
      header: "Tiền sau thuế nguyên tệ",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienSauThueDong,
    },
    {
      key: "tienChuaThueVnd",
      header: "Tiền chưa thuế (VND)",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => toVnd(r.tienChuaThue, r.tyGia),
    },
    {
      // `?? 0`: nhóm cột thuế/sau thuế luôn hiện số (xem `DetailRow.thueDong`) — `toVnd` chỉ trả
      // `undefined` khi không có số tiền, mà hai field nguồn dưới đây thì luôn có.
      key: "thueVnd",
      header: "Tiền thuế (VND)",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => toVnd(r.thueDong, r.tyGia) ?? 0,
    },
    {
      key: "tienSauThueVnd",
      header: "Tiền sau thuế (VND)",
      width: 12,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => toVnd(r.tienSauThueDong, r.tyGia) ?? 0,
    },
    {
      key: "tienCk",
      header: "Số tiền chiết khấu",
      width: 12,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienCk,
    },
    {
      key: "tongCk",
      header: "Tổng tiền chiết khấu thương mại",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => (r.isFirstRow ? r.tongCk : undefined),
    },
    {
      key: "tongPhi",
      header: "Tổng tiền phí",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => (r.isFirstRow ? r.tongPhi : undefined),
    },
    {
      key: "tongTt",
      header: "Tổng tiền thanh toán",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => (r.isFirstRow ? r.tongTt : undefined),
    },
    {
      key: "tongTtVnd",
      header: "Tổng tiền thanh toán (VND)",
      width: 14,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => (r.isFirstRow ? toVnd(r.tongTt, r.tyGia) : undefined),
    },
    {
      // Cùng hàm đặt tên với lượt xuất file -> tên ở đây là tên file có thật trên đĩa.
      // Dùng `r.stt` (số thứ tự HÓA ĐƠN) chứ KHÔNG dùng `stt` truyền vào: ở bảng này `stt` là số
      // thứ tự DÒNG HÀNG, một hóa đơn nhiều dòng sẽ ra nhiều tên file khác nhau.
      key: "tenFile",
      header: "Tên file hóa đơn (XML/HTML/PDF)",
      width: 30,
      value: (r) => invoiceFileBase(r.stt, r.ngayHd, r.soHd, r.sellerMst),
    },
    {
      key: "ghiChuLienQuan",
      header: "Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh",
      width: 30,
      value: (r) => r.ghiChuLienQuan || undefined,
    },
    {
      key: "ghiChuDacBiet",
      header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
      width: 30,
      value: (r) => ghiChuDacBiet(r),
    },
    { key: "ghiChu1", header: "Ghi chú 1", width: 12, value: (r) => r.ghiChu },
    { key: "hinhThucTt", header: "Hình thức thanh toán", width: 12, value: (r) => r.hinhThucTt },
    {
      key: "tinhChat",
      header: "Tính chất",
      width: 12,
      value: (r) => tinhChatLabel(r.tinhChat) || undefined,
    },
    {
      key: "trangThaiHd",
      header: "Trạng thái hóa đơn",
      width: 12,
      align: "center",
      value: (r) => trangThaiHdLabel(r.trangThaiHd),
    },
    {
      key: "ketQuaKt",
      header: "Kết quả kiểm tra hóa đơn",
      width: 12,
      align: "center",
      value: (r) => ketQuaKiemTraLabel(r.ketQuaKt),
    },
    { key: "bienSoXe", header: "Biển số xe", width: 12, value: (r) => r.bienSoXe },
    { key: "websiteNb", header: "Website người bán", width: 12, value: (r) => r.websiteNb },
    { key: "msttcgp", header: "Nhà cung cấp hóa đơn gốc", width: 20, value: (r) => r.msttcgp },
    {
      key: "urlTraCuu",
      header: "URL tra cứu hóa đơn gốc",
      width: 30,
      value: (r) => r.urlTraCuu,
      cell: (r) => chiDongDau(r, r.urlTraCuu || NO_DATA_YET),
    },
    {
      key: "dliu",
      header: "Mã tra cứu hóa đơn gốc",
      width: 30,
      value: (r) => r.dliu,
      cell: (r) => chiDongDau(r, khongLap(r.dliu, r.urlTraCuu)),
    },
    {
      key: "timGoogle",
      header: "Copy dòng này lên google để tìm link tra cứu hóa đơn gốc",
      width: 30,
      value: (r) =>
        r.tvan
          ? `Tra cứu hóa đơn điện tử ${r.tvan}`
          : r.sellerTen
            ? `${r.sellerTen} tra cứu hóa đơn điện tử`
            : undefined,
    },
    { key: "maNt", header: "Đơn vị tiền tệ", width: 12, value: (r) => r.maNt },
    {
      key: "tyGia",
      header: "Tỷ giá",
      width: 12,
      align: "right",
      numFmt: RATE_FMT,
      value: (r) => r.tyGia,
    },
    {
      // Trùng "Mã tra cứu hóa đơn gốc"/"URL tra cứu" -> web hiện "—", mã đã có ở cột trước.
      // Sheet Excel vẫn ghi đủ (`value`): kế toán lọc/đối chiếu theo từng cột.
      key: "mccqt",
      header: "MCCQT",
      width: 12,
      value: (r) => r.mccqt,
      cell: (r) => chiDongDau(r, khongLap(r.mccqt, r.urlTraCuu, r.dliu)),
    },
    {
      // Chỉ hóa đơn CÓ MÃ (`ttxly=5`) mới có khối chữ ký của Cục Thuế -> hóa đơn không mã để trống.
      key: "ngayCqtKy",
      header: "Ngày CQT ký số",
      width: 12,
      excelText: true,
      value: (r) => formatDateVN(r.ngayCqtKy) || undefined,
    },
  ];
}

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
  TOTAL_COL_WIDTH,
  chiDongDau,
  ghiChuDacBiet,
  khongLap,
  type InvoiceColumn,
} from "./types";

export function overviewDauRa(): InvoiceColumn<DisplayRow>[] {
  return [
    { key: "stt", header: "STT", width: 8, value: (_r, stt) => stt },
    {
      key: "chon",
      header: "Chọn",
      width: 6,
      align: "center",
      webOnly: true,
      value: () => undefined,
    },
    {
      key: "ttTai",
      header: "T. thái tải",
      width: 11,
      align: "center",
      webOnly: true,
      value: (r) => ttTaiLabel(r.ttTai),
      cell: (r) => ttTaiCell(r.ttTai),
    },
    {
      key: "mauHd",
      header: "Ký hiệu mẫu số",
      width: 14,
      value: (r) => numericText(r.mauHd),
    },
    {
      key: "soSeri",
      header: "Ký hiệu hóa đơn",
      width: 16,
      value: (r) => r.soSeri,
    },
    {
      key: "soHd",
      header: "Số hóa đơn",
      width: 12,
      value: (r) => numericText(r.soHd),
    },
    {
      key: "ngayLap",
      header: "Ngày lập",
      width: 16,
      excelText: true,
      value: (r) => formatDateVN(r.ngayLap),
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
    {
      key: "tenHang",
      header: "Tên hàng hóa, dịch vụ",
      width: 34,
      value: (r) => r.tenHang || undefined,
    },
    {
      key: "tienChuaThue",
      total: true,
      header: "Tổng tiền chưa thuế",
      width: TOTAL_COL_WIDTH,
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
      total: true,
      header: "Tổng tiền thanh toán",
      width: TOTAL_COL_WIDTH,
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

    // Hai cột ghi chú khép lại bảng, ĐÚNG THỨ TỰ và cùng nội dung với bảng "Chi tiết hóa đơn".
    {
      key: "ghiChuLienQuan",
      header:
        "Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh",
      width: 30,
      value: (r) => r.ghiChuLienQuan || undefined,
    },
    {
      // Đúng cái ngày đang nằm trong cột ghi chú ngay bên trái — đứng riêng để lọc/sắp xếp được.
      // `excelText`: giữ nguyên `dd-MM-yyyy`, không cho Excel diễn giải thành số ngày tháng.
      key: "ngayLienQuan",
      header: "Ngày hóa đơn bị điều chỉnh, thay thế",
      width: 16,
      excelText: true,
      value: (r) => r.ngayLienQuan || undefined,
    },
    {
      key: "ghiChuDacBiet",
      header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
      width: 30,
      value: (r) => ghiChuDacBiet(r),
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
      // CỤM CỘT THAO TÁC theo hàng, xếp liền trước "Tên file xuất hóa đơn" — cột cuối cụm cho biết
      // ba nút trên nó sinh ra file tên gì. Cùng kiểu với cột "Chọn": template chỉ khai chỗ đứng,
      // nút bấm do `InvoiceListTabs` render vì cần state của bảng. `webOnly` — nút không có nghĩa
      // trong file Excel.
      key: "xemHoaDon",
      header: "Xem hóa đơn",
      width: 12,
      align: "center",
      webOnly: true,
      value: () => undefined,
    },
    {
      key: "taiFile",
      header: "Tải file",
      width: 10,
      align: "center",
      webOnly: true,
      value: () => undefined,
    },
    {
      key: "taiGoc",
      header: "Tải hóa đơn gốc",
      width: 14,
      align: "center",
      webOnly: true,
      value: () => undefined,
    },
    {
      key: "tenFile",
      header: "Tên file xuất hóa đơn (XML/HTML/PDF)",
      width: 36,
      value: (r, stt) => invoiceFileBase(stt, r.ngayLap, r.soHd, r.sellerMst),
    },
    {
      key: "buyerDiaChi",
      header: "Địa chỉ người mua",
      width: 34,
      value: (r) => r.buyerDiaChi,
    },
  ];
}

export function detailDauRa(): InvoiceColumn<DetailRow>[] {
  return [
    {
      key: "mauHd",
      header: "Mẫu số HD",
      width: 6,
      value: (r) => numericText(r.mauHd),
    },
    {
      key: "kyHieu",
      header: "Ký hiệu hóa đơn",
      width: 10,
      value: (r) => r.kyHieu,
    },
    {
      key: "soHd",
      header: "Số hóa đơn",
      width: 10,
      value: (r) => numericText(r.soHd),
    },
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
    {
      key: "buyerMst",
      header: "MST người mua",
      width: 16,
      value: (r) => r.buyerMst,
    },
    {
      key: "buyerTen",
      header: "Tên người mua",
      width: 30,
      value: (r) => r.buyerTen,
    },
    { key: "maVt", header: "Mã VT", width: 12, value: (r) => r.maVt },
    {
      key: "tenHang",
      header: "Tên hàng hóa, dịch vụ",
      width: 30,
      value: (r) => r.tenHang,
    },
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
    {
      key: "thueSuat",
      header: "Thuế suất",
      width: 14,
      align: "center",
      value: (r) => r.thueSuat,
    },
    {
      key: "tienChuaThue",
      total: true,
      header: "Tiền chưa thuế nguyên tệ",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienChuaThue,
    },
    {
      key: "thueDong",
      total: true,
      header: "Tiền thuế nguyên tệ",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.thueDong,
    },
    {
      key: "tienSauThueDong",
      total: true,
      header: "Tiền sau thuế nguyên tệ",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => r.tienSauThueDong,
    },
    {
      key: "tienChuaThueVnd",
      total: true,
      header: "Tiền chưa thuế (VND)",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => toVnd(r.tienChuaThue, r.tyGia),
    },
    {
      // `?? 0`: nhóm cột thuế/sau thuế luôn hiện số (xem `DetailRow.thueDong`) — `toVnd` chỉ trả
      // `undefined` khi không có số tiền, mà hai field nguồn dưới đây thì luôn có.
      key: "thueVnd",
      total: true,
      header: "Tiền thuế (VND)",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => toVnd(r.thueDong, r.tyGia) ?? 0,
    },
    {
      key: "tienSauThueVnd",
      total: true,
      header: "Tiền sau thuế (VND)",
      width: TOTAL_COL_WIDTH,
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
      total: true,
      header: "Tổng tiền thanh toán",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => (r.isFirstRow ? r.tongTt : undefined),
    },
    {
      key: "tongTtVnd",
      total: true,
      header: "Tổng tiền thanh toán (VND)",
      width: TOTAL_COL_WIDTH,
      align: "right",
      numFmt: MONEY2_FMT,
      value: (r) => (r.isFirstRow ? toVnd(r.tongTt, r.tyGia) : undefined),
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
      key: "ghiChuLienQuan",
      header:
        "Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh",
      width: 30,
      value: (r) => r.ghiChuLienQuan || undefined,
    },
    {
      // Đúng cái ngày đang nằm trong cột ghi chú ngay bên trái — đứng riêng để lọc/sắp xếp được.
      // `excelText`: giữ nguyên `dd-MM-yyyy`, không cho Excel diễn giải thành số ngày tháng.
      key: "ngayLienQuan",
      header: "Ngày hóa đơn bị điều chỉnh, thay thế",
      width: 16,
      excelText: true,
      value: (r) => r.ngayLienQuan || undefined,
    },
    {
      key: "ghiChuDacBiet",
      header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
      width: 30,
      value: (r) => ghiChuDacBiet(r),
    },
    { key: "ghiChu1", header: "Ghi chú 1", width: 12, value: (r) => r.ghiChu },
    {
      key: "hinhThucTt",
      header: "Hình thức thanh toán",
      width: 12,
      value: (r) => r.hinhThucTt,
    },
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
    {
      key: "bienSoXe",
      header: "Biển số xe",
      width: 12,
      value: (r) => r.bienSoXe,
    },
    {
      key: "websiteNb",
      header: "Website người bán",
      width: 12,
      value: (r) => r.websiteNb,
    },
    {
      key: "msttcgp",
      header: "Nhà cung cấp hóa đơn gốc",
      width: 20,
      value: (r) => r.msttcgp,
    },
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
    {
      key: "buyerDiaChi",
      header: "Địa chỉ người mua",
      width: 30,
      value: (r) => r.buyerDiaChi,
    },

    {
      key: "tenFile",
      header: "Tên file hóa đơn (XML/HTML/PDF)",
      width: 30,
      value: (r) => invoiceFileBase(r.stt, r.ngayHd, r.soHd, r.sellerMst),
    },
  ];
}

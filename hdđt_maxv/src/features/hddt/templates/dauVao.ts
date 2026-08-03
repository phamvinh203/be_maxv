/**
 * ===== CỘT HÓA ĐƠN ĐẦU VÀO (mua vào) =====
 *
 * Toàn bộ cột của chiều mua vào nằm TRỌN trong file này: bảng "Tổng quát" và bảng "Chi tiết" trên
 * web, đồng thời là 2 sheet của `Tong-hop-dau-vao-<khoảng>.xlsx`. Sửa cột đầu vào chỉ mở file này.
 *
 * Chiều đầu ra có file riêng `dauRa.ts` — cố ý KHÔNG dùng chung để hai chiều tiến hóa độc lập. Đổi
 * lại, cột dùng chung cả hai chiều (các cột tiền, trạng thái…) phải sửa ở CẢ HAI file.
 *
 * Cột chưa có nguồn dữ liệu trả `undefined` -> web hiện "—", file xuất để ô trống. Danh sách các
 * cột đang ở trạng thái đó (cần API/nghiệp vụ riêng, chưa xây) ghi ngay tại chỗ khai báo bên dưới.
 *
 * TIÊU ĐỀ, THỨ TỰ, ĐỘ RỘNG và ĐỊNH DẠNG Ô ở đây bám theo mẫu Excel kế toán đang dùng
 * (`0111142786_HDCTMuaVao …xlsx` + `Chi_tiet_HD_mua_vao_theo_tung_san_pham…xlsx`) — đổi thì file
 * xuất ra sẽ lệch mẫu, cân nhắc trước khi sửa.
 */
import { trangThaiHdLabel, ketQuaKiemTraLabel } from "../api/gdt";
import { formatDateVN } from "../dateUtils";
import { numericText, toVnd, ttTaiLabel } from "../format";
import { invoiceFileBase } from "../invoiceFileName";
import { tinhChatLabel } from "../invoiceView";
import type { DetailRow, DisplayRow } from "../types";
import { ttTaiCell } from "./cells";
import { MONEY2_FMT, NUM_FMT, RATE_FMT, type InvoiceColumn } from "./types";

/**
 * Bảng "Tổng quát" đầu vào — 22 cột trên web, 20 cột trong file Excel.
 * Bên đối tác ở chiều này là NGƯỜI BÁN (nhà cung cấp) — mỗi hóa đơn một nhà cung cấp khác nhau.
 *
 * HAI CỘT ĐẦU LÀ `webOnly` (không ra file Excel) vì chúng là công cụ của màn hình chứ không phải
 * dữ liệu hóa đơn — nhờ vậy sheet Excel khớp đúng danh sách cột nghiệp vụ:
 *  - "Chọn": checkbox cần state nên `InvoiceListTabs` tự render; bỏ cột này là mất luôn nút
 *    "Xem hóa đơn" (nút bật/tắt theo dòng đang chọn).
 *  - "T. thái tải": đèn báo tiến độ tải chi tiết, điền dần trong lúc lượt "Cập nhật"/"Tải chi tiết"
 *    chạy nền — người dùng nhìn cột này để biết hóa đơn nào đã có chi tiết.
 */
export function overviewDauVao(): InvoiceColumn<DisplayRow>[] {
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
    { key: "sellerDiaChi", header: "Địa chỉ người bán", width: 44, value: (r) => r.sellerDiaChi },
    {
      key: "buyerMst",
      header: "MST người mua/MST người nhận hàng",
      width: 22,
      value: (r) => r.buyerMst,
    },
    {
      key: "buyerTen",
      header: "Tên người mua/Tên người nhận hàng",
      width: 34,
      value: (r) => r.buyerTen,
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
  ];
}

/**
 * Bảng "Chi tiết hóa đơn" đầu vào — 46 cột. 1 dòng = 1 dòng hàng hóa; thông tin hóa đơn lặp lại
 * ở mỗi dòng hàng của cùng một hóa đơn.
 *
 * BA NHÓM CỘT TIỀN, đọc kỹ kẻo lẫn:
 *  - "…nguyên tệ": theo TỪNG DÒNG HÀNG, đơn vị là `maNt` của hóa đơn;
 *  - "…(VND)": chính cột nguyên tệ nhân `tyGia` (hóa đơn VND có tỷ giá 1 nên bằng nhau);
 *  - "Tổng…": của CẢ HÓA ĐƠN, nên lặp y hệt ở mọi dòng hàng — đừng cộng cả cột.
 *
 * CÒN ĐÚNG MỘT CỘT CHƯA CÓ NGUỒN DỮ LIỆU: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ
 * hơn" — cột này là CẢNH BÁO TỰ SINH (mẫu Excel ghi kiểu "Thiếu địa chỉ người mua"), phải chốt bộ
 * quy tắc nghiệp vụ trước mới làm được, không phải chỉ map thêm field.
 *
 * Các cột còn lại đều đọc từ payload chi tiết GDT — xem `detailRow.ts` để biết field nguồn. Nhiều
 * cột chỉ có giá trị ở một số loại hóa đơn (vd "Ngày CQT ký số" chỉ hóa đơn CÓ MÃ mới có, "Biển số
 * xe" chỉ hóa đơn xăng dầu/vận tải), ô trống ở đây là ĐÚNG chứ không phải thiếu mapping.
 */
export function detailDauVao(): InvoiceColumn<DetailRow>[] {
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
    // `|| undefined` để ô rỗng đi theo quy ước chung: file xuất ghi ô trống, web hiện "—".
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
      // Cột nghiệp vụ do kế toán tự đánh dấu — chưa có chỗ nhập.
      key: "ghiChuDacBiet",
      header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
      width: 30,
      value: () => undefined,
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
    { key: "urlTraCuu", header: "url tra cứu hóa đơn gốc", width: 12, value: (r) => r.urlTraCuu },
    { key: "maTraCuu", header: "Mã tra cứu hóa đơn gốc", width: 30, value: (r) => r.maTraCuu },
    {
      // Chuỗi copy thẳng sang Google để tìm trang tra cứu, khi hóa đơn không kèm sẵn link:
      // tên nhà cung cấp hóa đơn (TVAN) cho ra đúng trang tra cứu hơn là tên người bán.
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
    { key: "mccqt", header: "MCCQT", width: 12, value: (r) => r.mccqt },
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

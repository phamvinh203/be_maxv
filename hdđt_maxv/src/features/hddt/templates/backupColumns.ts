/**
 * Cột file CSV sao lưu (Cài đặt › Dữ liệu hệ thống › "Xuất / Sao lưu dữ liệu").
 *
 * Cố ý HẸP HƠN bảng "Tổng quát": chỉ giữ nhóm thông tin cần để đối chiếu/khôi phục. Tiêu đề trung
 * tính (luôn ghi cả người bán lẫn người mua) vì file gộp cả hai chiều vào một bảng, phân biệt bằng
 * cột "Chiều" mà `exportSavedBackupCsv` tự thêm ở đầu.
 *
 * Không khai `width`/`numFmt`: CSV không có khái niệm độ rộng hay định dạng số.
 */
import { trangThaiHdLabel } from "../api/gdt";
import { formatDateVN } from "../dateUtils";
import type { DisplayRow } from "../types";
import type { InvoiceColumn } from "./types";

export function backupColumns(): InvoiceColumn<DisplayRow>[] {
  return [
    { key: "stt", header: "STT", value: (_r, stt) => stt },
    { key: "mauHd", header: "Ký hiệu mẫu số", value: (r) => r.mauHd },
    { key: "soSeri", header: "Ký hiệu hóa đơn", value: (r) => r.soSeri },
    { key: "soHd", header: "Số hóa đơn", value: (r) => r.soHd },
    { key: "ngayLap", header: "Ngày lập", value: (r) => formatDateVN(r.ngayLap) },
    { key: "sellerMst", header: "MST người bán", value: (r) => r.sellerMst },
    { key: "sellerTen", header: "Tên người bán", value: (r) => r.sellerTen },
    { key: "buyerMst", header: "MST người mua", value: (r) => r.buyerMst },
    { key: "buyerTen", header: "Tên người mua", value: (r) => r.buyerTen },
    { key: "tienChuaThue", header: "Tổng tiền chưa thuế", value: (r) => r.tienChuaThue },
    { key: "tienThue", header: "Tổng tiền thuế", value: (r) => r.tienThue },
    { key: "tongTt", header: "Tổng tiền thanh toán", value: (r) => r.tongTt },
    { key: "maNt", header: "Đơn vị tiền tệ", value: (r) => r.maNt },
    { key: "trangThaiHd", header: "Trạng thái hóa đơn", value: (r) => trangThaiHdLabel(r.trangThaiHd) },
  ];
}

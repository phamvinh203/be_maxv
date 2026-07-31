/**
 * Tên file của MỘT tờ hóa đơn khi xuất ra đĩa — NGUỒN DUY NHẤT cho cả hai phía:
 *  - `exportBundle` đặt tên file `.xml` / `.html` / `.pdf` thật sự ghi xuống thư mục;
 *  - cột "Tên file hóa đơn (XML/HTML/PDF)" trên bảng Tổng quát / Chi tiết + sheet Excel.
 *
 * Hai phía BẮT BUỘC gọi chung hàm này: tách ra mỗi nơi tự ghép chuỗi thì cột trên bảng sẽ chỉ tên
 * một file không tồn tại — kiểu sai im lặng chỉ lộ ra khi kế toán đi tìm file theo tên trong Excel.
 */

import { formatDateIso } from "./dateUtils";

/** Bỏ ký tự không hợp lệ trong tên file (Windows/khác), gộp khoảng trắng. */
export function safeName(raw: string): string {
  return (raw || "hoa-don").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
}

/**
 * Tên file (KHÔNG kèm phần mở rộng) của 1 tờ hóa đơn:
 * `<STT>.<ngày lập yyyy-MM-dd>_<số HĐ>_<MST người bán>` — ví dụ `1.2026-01-02_9918847_0100109106`.
 *
 * Phần sau dấu chấm theo đúng mẫu file Excel kế toán đang dùng, để dùng lẫn được giữa hai phần mềm.
 *
 * SỐ THỨ TỰ ĐỨNG ĐẦU làm hai việc:
 *  1. cho file xếp trong thư mục đúng thứ tự bảng Tổng quát, thay vì xếp theo ngày rồi số hóa đơn;
 *  2. đảm bảo KHÔNG TRÙNG TÊN. `<ngày>_<số>_<MST bán>` thiếu ký hiệu hóa đơn (khóa unique của cổng
 *     thuế là mẫu số + ký hiệu + số + MST bán), nên hai hóa đơn cùng người bán, cùng ngày, cùng số
 *     mà khác ký hiệu sẽ ĐÈ MẤT FILE của nhau. STT là duy nhất trong lượt xuất nên chặn hẳn ca đó.
 *
 * `stt` phải là số thứ tự của hóa đơn trong BẢNG TỔNG QUÁT — xem `invoiceSttMap`.
 */
export function invoiceFileBase(
  stt: number,
  ngayLap: string,
  soHd: string,
  sellerMst: string,
): string {
  return safeName(`${stt}.${formatDateIso(ngayLap) || "khong-ro-ngay"}_${soHd}_${sellerMst}`);
}

/**
 * Khóa định danh 1 hóa đơn = đúng khóa unique của cổng thuế (mẫu số + ký hiệu + số + MST người bán),
 * cũng là `@@unique` của `vct50view`/`vct60view`. Dùng để nối bảng Tổng quát với bảng Chi tiết và với
 * danh sách file đang ghi ra đĩa.
 */
export function invoiceKey(
  mauSo: string,
  kyHieu: string,
  soHd: string,
  sellerMst: string,
): string {
  return `${mauSo}|${kyHieu}|${soHd}|${sellerMst}`;
}

/**
 * Bảng tra "hóa đơn -> số thứ tự trong bảng Tổng quát" (1-based).
 *
 * VÌ SAO PHẢI TRA THEO KHÓA, KHÔNG DÙNG VỊ TRÍ: bảng Tổng quát và bảng Chi tiết là HAI truy vấn
 * riêng, cùng `ORDER BY tdlap DESC` — mà `tdlap` trùng nhau hàng loạt (mọi hóa đơn cùng một ngày).
 * Postgres không đảm bảo thứ tự giữa các dòng bằng nhau ở khóa sắp xếp, nên hai truy vấn có thể trả
 * về thứ tự khác nhau trong cùng một ngày. Ghép theo vị trí sẽ cho ra thứ "Excel ghi file số 7 mà
 * trên đĩa là file số 9" — sai âm thầm, chỉ lộ khi kế toán đi tìm file theo tên.
 */
export function invoiceSttMap(
  rows: { mauHd: string; soSeri: string; soHd: string; sellerMst: string }[],
): Map<string, number> {
  return new Map(
    rows.map((r, i) => [invoiceKey(r.mauHd, r.soSeri, r.soHd, r.sellerMst), i + 1]),
  );
}

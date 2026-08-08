import { apiFetchBlob } from "../../../lib/http";

export interface TaiHoaDonGocParams {
  /** MST NCC phát hành (khóa registry `TRA_CUU_NCC`, vd MISA = "0101243150", Viettel = "0100109106"). */
  msttcgp: string;
  /** Mã tra cứu hóa đơn (MISA = TransactionID, Viettel = reservationCode); từ `traCuuNcc(detail).maTraCuu`. */
  code: string;
  /** MST người bán (nbmst) — NCC cần thì dùng (Viettel); MISA bỏ qua. */
  sellerMst?: string;
  /**
   * Signal HỦY của cả lượt tải (nút Hủy trong dialog). Được GỘP với timeout 60s, nên request dừng khi
   * cái nào tới trước. Không truyền -> chỉ có timeout như cũ.
   */
  signal?: AbortSignal;
}

/**
 * GET /gdt/tra-cuu-goc → tải FILE PDF GỐC 1 hóa đơn từ trang tra cứu của NCC phát hành, qua BE proxy
 * (cổng NCC không có CORS nên không gọi thẳng từ trình duyệt). Trả `Blob` để lưu vào thư mục người
 * dùng chọn. BE trả 422 nếu mã sai, 501 nếu NCC chưa hỗ trợ — `apiFetchBlob` ném `ApiError` kèm
 * message để nơi gọi đếm lỗi từng hóa đơn.
 *
 * Dùng: `DownloadOriginalDialog` (nút "Tải xuống").
 */
export function taiHoaDonGoc({
  msttcgp,
  code,
  sellerMst,
  signal,
}: TaiHoaDonGocParams): Promise<Blob> {
  const params = new URLSearchParams({ msttcgp, code });
  if (sellerMst) params.set("sellerMst", sellerMst);
  // Timeout 60s chặn 1 request treo làm kẹt cả lượt tải. Phải LỚN HƠN ngân sách retry captcha của BE
  // (mặc định 30s + phần dôi của lượt đang chạy dở) — nhỏ hơn thì FE bỏ cuộc trong khi BE vẫn chạy,
  // để lại một luồng mồ côi giành worker OCR với request kế tiếp. Nâng `*_RETRY_DEADLINE_MS` ở BE thì
  // phải nâng cả con số này.
  //
  // `AbortSignal.any` cần Chrome 116+. Chấp nhận được: dialog gọi hàm này chỉ chạy khi có File System
  // Access API (`showDirectoryPicker`), tức đã là Chromium, và `AbortSignal.timeout` ngay dưới cũng
  // đã đòi Chrome 103+.
  const timeout = AbortSignal.timeout(60_000);
  return apiFetchBlob(`/gdt/tra-cuu-goc?${params.toString()}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
}

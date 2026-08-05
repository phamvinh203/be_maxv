import { apiFetchBlob } from "../../../lib/http";

export interface TaiHoaDonGocParams {
  /** MST NCC phát hành (khóa registry `TRA_CUU_NCC`, vd MISA = "0101243150", Viettel = "0100109106"). */
  msttcgp: string;
  /** Mã tra cứu hóa đơn (MISA = TransactionID, Viettel = reservationCode); từ `traCuuNcc(detail).maTraCuu`. */
  code: string;
  /** MST người bán (nbmst) — NCC cần thì dùng (Viettel); MISA bỏ qua. */
  sellerMst?: string;
}

/**
 * GET /gdt/tra-cuu-goc → tải FILE PDF GỐC 1 hóa đơn từ trang tra cứu của NCC phát hành, qua BE proxy
 * (cổng NCC không có CORS nên không gọi thẳng từ trình duyệt). Trả `Blob` để lưu vào thư mục người
 * dùng chọn. BE trả 422 nếu mã sai, 501 nếu NCC chưa hỗ trợ — `apiFetchBlob` ném `ApiError` kèm
 * message để nơi gọi đếm lỗi từng hóa đơn.
 *
 * Dùng: `DownloadOriginalDialog` (nút "Tải xuống").
 */
export function taiHoaDonGoc({ msttcgp, code, sellerMst }: TaiHoaDonGocParams): Promise<Blob> {
  const params = new URLSearchParams({ msttcgp, code });
  if (sellerMst) params.set("sellerMst", sellerMst);
  return apiFetchBlob(`/gdt/tra-cuu-goc?${params.toString()}`, {
    // Chặn 1 request treo làm kẹt cả lượt tải nhiều hóa đơn (BE tự timeout 30s/request tới NCC).
    signal: AbortSignal.timeout(60_000),
  });
}

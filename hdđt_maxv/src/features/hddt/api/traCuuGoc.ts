import { apiFetch, apiFetchBlob } from "../../../lib/http";

/** 1 NCC có bộ tải tự động ở BE. Hình dạng khớp `NhaCungCapTraCuu` bên `traCuuGoc/index.ts`. */
export interface NhaCungCapTraCuu {
  /** MST NCC phát hành — khóa ghép với `msttcgp` của hóa đơn. */
  msttcgp: string;
  ten: string;
  /** URL trang tra cứu thủ công; `{mst}` = chỗ điền MST người bán. */
  urlTraCuu: string;
}

export interface DanhMucTraCuuGoc {
  nccs: NhaCungCapTraCuu[];
  /**
   * MST người bán -> URL tra cứu ĐÃ DÒ được, ghi đè `urlTraCuu` của NCC tương ứng. Chỉ có với NCC
   * phục vụ trên nhiều domain (EasyInvoice); BE học được sau mỗi lượt tải thành công nên map này
   * rỗng cho tới lúc đó và rỗng lại sau khi BE restart. Luôn phải có đường lùi về `urlTraCuu`.
   */
  urlDaDo: Record<string, string>;
}

/**
 * GET /gdt/tra-cuu-goc/nha-cung-cap → danh mục NCC tải tự động được + URL tra cứu của từng NCC.
 *
 * NGUỒN DUY NHẤT cho hai thứ FE từng tự giữ: cờ "NCC này tải tự động được" và chuỗi URL cổng NCC.
 * Giữ bản sao ở FE nghĩa là mỗi lần deploy lệch phiên bản là FE gọi BE cho NCC chưa đăng ký (501),
 * hoặc mở link tới domain NCC vừa đổi.
 */
export function getDanhMucTraCuuGoc(): Promise<DanhMucTraCuuGoc> {
  return apiFetch<DanhMucTraCuuGoc>("/gdt/tra-cuu-goc/nha-cung-cap");
}

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
 * Dùng: `DownloadOriginalDialog` (nút "Tải xuống") và `taiMotHoaDon` (cột "Tải hóa đơn gốc").
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
  // `AbortSignal.any` cần Chrome 116+, và CHỈ chạy khi nơi gọi truyền `signal` — đó là dialog tải
  // theo lô (nút Hủy), vốn đã đòi File System Access API để chọn thư mục nên chắc chắn là Chromium.
  // Cột "Tải hóa đơn gốc" tải lẻ 1 hóa đơn không có nút Hủy, không truyền `signal`, nên chỉ đụng
  // `AbortSignal.timeout` (Chrome 103+ / Firefox 100+ / Safari 16+).
  const timeout = AbortSignal.timeout(60_000);
  return apiFetchBlob(`/gdt/tra-cuu-goc?${params.toString()}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
}

/**
 * Kiểu dùng chung cho nhóm "tải hóa đơn GỐC theo NCC phát hành" (MISA, và sau này Viettel/VETC/FPT…).
 *
 * Tách riêng file types để bộ tải từng NCC (`misa.ts`…), helper dùng chung (`shared.ts`) và dispatcher
 * (`index.ts`) cùng import mà không tạo phụ thuộc vòng.
 */

/** Kết quả tải 1 file gốc (PDF): bytes + tên file gợi ý + content-type để controller trả nguyên về FE. */
export interface FileHoaDonGoc {
  buffer: Buffer;
  /** Tên file gợi ý (từ Content-Disposition của NCC, hoặc dựng từ mã). FE có thể tự đặt tên khác. */
  filename: string;
  contentType: string;
}

/**
 * Dữ liệu 1 hóa đơn cần để tải file gốc. NCC đơn giản (MISA) chỉ dùng `code`; NCC khác dùng thêm:
 *  - `sellerMst`: MST người bán (nbmst) — Viettel cần cho `supplierTaxCode`/`taxCode`.
 * (Viettel có captcha nhưng BE TỰ giải bên trong provider — xem `vinvoice_viettel.ts` — nên captcha
 *  không phải là input ở đây.)
 */
export interface DownloadRequest {
  /** Mã tra cứu hóa đơn (MISA = TransactionID; Viettel = reservationCode). */
  code: string;
  /** MST người bán (nbmst). Bắt buộc với NCC cần (Viettel); MISA bỏ qua. */
  sellerMst?: string;
}

/**
 * Bộ tải hóa đơn gốc (PDF) của MỘT NCC. Thêm NCC mới = viết 1 object thế này (thường chỉ khác URL +
 * cách lấy token + header) rồi đăng ký 1 dòng trong `index.ts`. Boilerplate (fetch, timeout, body
 * rỗng, parse tên file…) nằm ở `shared.ts` nên `download` của mỗi NCC rất ngắn.
 */
export interface ProviderDownloader {
  /** MST NCC phát hành — khóa dispatcher (khớp khóa registry `TRA_CUU_NCC` bên FE). */
  mst: string;
  /** Tên NCC (dùng trong thông báo lỗi). */
  ten: string;
  /** Tải file PDF gốc 1 hóa đơn. */
  download(req: DownloadRequest): Promise<FileHoaDonGoc>;
}

/** Mã lỗi ngữ nghĩa — controller tự map sang HTTP status (xem `traCuuGoc.controller.ts`). */
export type TraCuuGocErrorCode =
  /** Mã tra cứu sai / hóa đơn không tồn tại -> NCC trả rỗng, không có file. */
  | "INVALID_CODE"
  /** NCC (meinvoice…) trả lỗi hoặc không phản hồi. */
  | "UPSTREAM"
  /** Chưa có bộ tải cho NCC này (msttcgp chưa đăng ký). */
  | "UNSUPPORTED";

/**
 * Lỗi có chủ đích của luồng tải hóa đơn gốc. Chỉ mang `code` ngữ nghĩa — KHÔNG mang HTTP status: việc
 * map code -> status là của controller, để bộ tải NCC mới chỉ cần chọn code, không phải nhớ số HTTP.
 */
export class TraCuuGocError extends Error {
  readonly code: TraCuuGocErrorCode;

  /**
   * HINT retry: `true` khi lỗi do nguyên nhân TẠM THỜI có thể khỏi khi thử lại (vd captcha OCR nhầm) —
   * caller được phép thử tiếp. Mặc định `false` = lỗi DỨT KHOÁT (vd mã tra cứu sai), retry chỉ tốn
   * thời gian. Hiện chỉ VNPT đặt (nó phân biệt được captcha sai vs fkey sai); NCC khác bỏ qua.
   */
  readonly retryable: boolean;

  constructor(code: TraCuuGocErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "TraCuuGocError";
    this.code = code;
    this.retryable = retryable;
  }
}

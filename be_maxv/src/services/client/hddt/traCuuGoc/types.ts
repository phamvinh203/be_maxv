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
 *
 * Captcha KHÔNG phải input ở đây: NCC nào có captcha (Viettel, VNPT, CyberLotus) đều tự xử lý gọn
 * bên trong provider của mình, caller không phải biết.
 */
export interface DownloadRequest {
  /** Mã tra cứu hóa đơn (MISA = TransactionID; Viettel = reservationCode; CyberLotus = maSoBiMat). */
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
  /**
   * `true` khi NCC BẮT BUỘC có `sellerMst` (dựng origin portal tenant, hoặc gửi làm `supplierTaxCode`).
   * Dispatcher chặn ngay ở `taiHoaDonGoc` nên `download` được phép coi `sellerMst` là đã có.
   *
   * KHAI BÁO chứ không tự kiểm trong `download`: ba provider trước đây mỗi cái tự viết một guard với
   * một câu thông báo khác nhau, và NCC thứ tư quên guard thì lỗi chui xuống tận `assertMst` — hoặc
   * tệ hơn, dựng ra `https://undefinedhd.easyinvoice.com.vn` rồi mới hỏng.
   */
  canSellerMst?: boolean;
  /**
   * URL trang tra cứu THỦ CÔNG của NCC — thứ kế toán bấm khi muốn tự vào cổng xem/tải. `{mst}` là chỗ
   * điền MST người bán (NCC nào có portal riêng theo tenant mới cần).
   *
   * Ở ĐÂY chứ không phải bên FE: cổng NCC đổi domain thì thứ hỏng trước tiên là bộ tải tự động trong
   * chính file này, nên link thủ công phải nằm cạnh nó để sửa một lần. Trước đây chuỗi domain bị chép
   * sang cả registry FE, và một lần Softdreams đổi domain đã phải sửa 3 file ở 2 tầng.
   */
  urlTraCuu: string;
  /**
   * NCC phục vụ trên NHIỀU domain mà không có cách suy ra: URL tra cứu ĐÃ DÒ ĐƯỢC, theo MST người bán.
   * Ghi đè `urlTraCuu` cho đúng những MST có trong map. Chỉ EasyInvoice cần (xem `EASY_DOMAINS`).
   */
  urlTraCuuTheoMst?(): Record<string, string>;
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
   * thời gian. Đặt bởi các NCC phân biệt được "captcha đọc nhầm" với "mã tra cứu sai" (VNPT,
   * CyberLotus); NCC khác bỏ qua.
   */
  readonly retryable: boolean;

  constructor(code: TraCuuGocErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "TraCuuGocError";
    this.code = code;
    this.retryable = retryable;
  }
}

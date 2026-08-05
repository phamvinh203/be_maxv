/**
 * ===== TẢI HÓA ĐƠN GỐC — VIETTEL (vttel) =====
 *
 * Cổng tra cứu Viettel chặn tải file bằng một captcha "kéo mảnh ghép" (slide puzzle) do CHÍNH hệ thống
 * này phát hành (backend jhipster, endpoint `/api/captcha/*`). Vì captcha là của mình nên tự giải được:
 * API `generate` trả sẵn `offsetX` (vị trí đúng của mảnh ghép), nên không cần xử lý ảnh — chỉ việc đọc
 * `offsetX` rồi POST thẳng lên `verify` để lấy token đã-xác-thực.
 *
 * LUỒNG 3 BƯỚC:
 *
 *   1) GET  {vttelUrl}/api/captcha/generate
 *        -> { token, offsetX, offsetY, ... }   (lấy ra token + offsetX)
 *
 *   2) POST {vttelUrl}/api/captcha/verify   (body { token, offsetX })
 *        -> { success: true, token: "<recaptcha>", message: "Verification successful" }
 *        `token` TRẢ VỀ là token MỚI (đã xác thực) — dùng cho bước tải, KHÔNG phải token của generate.
 *
 *   3) POST {vttelUrl}/.../downloadPDF?taxCode=<mst>   (body { supplierTaxCode, reservationCode, recaptcha })
 *        recaptcha = token đã xác thực ở bước 2.
 *
 * ⚠️ CHƯA CHỐT: tên field payload của `verify` và tham số/đường dẫn của `downloadPDF` đang là PHỎNG ĐOÁN
 *    theo mẫu bạn đưa. Chỗ nào cần đối chiếu với backend thật đã đánh dấu `TODO(vttel)`.
 */

import { describeErrorChain } from "../../../../config/gdt-client";
import { fetchUpstream, pdfFromResponse } from "./shared";
import { ProviderDownloader, TraCuuGocError } from "./types";

/** Base URL cổng Viettel. Đổi qua env `vttelUrl`; mặc định localhost khi dev. */
const VINVOICE_VIETTEL_Url = "http://localhost:3003/api/services";

/** Timeout mỗi request — chặn socket treo làm kẹt cả lượt tải. */
const TIMEOUT_MS = 30_000;

/** Hình dạng response của `/api/captcha/generate` (chỉ khai phần mình dùng). */
interface CaptchaGenerate {
  token: string;
  offsetX: number;
  offsetY?: number;
}

/** Hình dạng response của `/api/captcha/verify`. */
interface CaptchaVerify {
  success: boolean;
  token: string;
  message?: string;
}

/**
 * Tự giải captcha kéo mảnh ghép của Viettel: generate -> lấy token + offsetX -> verify.
 * Trả về `token` ĐÃ XÁC THỰC (dùng làm `recaptcha` cho bước tải file).
 */
export async function solveCaptcha(): Promise<string> {
  // --- Bước 1: generate, lấy token + offsetX ---
  let gen: CaptchaGenerate;
  try {
    const res = await fetch(`${VINVOICE_VIETTEL_Url}/einvoiceuaa/api/captcha/generate`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new TraCuuGocError("UPSTREAM", `Viettel không cấp captcha (HTTP ${res.status})`);
    }
    gen = (await res.json()) as CaptchaGenerate;
  } catch (err) {
    if (err instanceof TraCuuGocError) throw err;
    throw new TraCuuGocError("UPSTREAM", `Không gọi được captcha/generate: ${describeErrorChain(err)}`);
  }

  if (!gen?.token || typeof gen.offsetX !== "number") {
    throw new TraCuuGocError("UPSTREAM", "captcha/generate không trả token hoặc offsetX");
  }

  // Jitter ±1px cho giống thao tác người (offsetX server chấp nhận sai số slideCaptchaOffsetMargin).
  const offsetX = gen.offsetX + (Math.floor(Math.random() * 3) - 1);

  // --- Bước 2: verify (POST — dùng GET sẽ bị 405) ---
  let verify: CaptchaVerify;
  try {
    const res = await fetch(`${VINVOICE_VIETTEL_Url}/einvoiceuaa/api/captcha/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      // TODO(vttel): chốt tên field payload đúng với backend (có thể cần offsetY / tên khác).
      body: JSON.stringify({ token: gen.token, offsetX }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new TraCuuGocError("UPSTREAM", `captcha/verify trả lỗi (HTTP ${res.status})`);
    }
    verify = (await res.json()) as CaptchaVerify;
  } catch (err) {
    if (err instanceof TraCuuGocError) throw err;
    throw new TraCuuGocError("UPSTREAM", `Không gọi được captcha/verify: ${describeErrorChain(err)}`);
  }

  if (!verify?.success || !verify.token) {
    throw new TraCuuGocError("UPSTREAM", `Xác thực captcha thất bại: ${verify?.message ?? "không rõ"}`);
  }

  return verify.token;
}

// ============================================================
//  BỘ TẢI PDF (provider) — nhận recaptcha token từ nơi gọi (KHÔNG tự giải captcha)
// ============================================================

const VINVOICE_VIETTEL_ORIGIN = "http://localhost:3003";
const VINVOICE_VIETTEL_DOWNLOAD_PDF = `${VINVOICE_VIETTEL_ORIGIN}/api/services/einvoicequery/sync/utility/downloadPDF`;
const VINVOICE_VIETTEL_REFERER = `${VINVOICE_VIETTEL_ORIGIN}/utilities/invoice-search`;

export const viettel: ProviderDownloader = {
  mst: "0100109106",
  ten: "Viettel",
  async download({ code, sellerMst, recaptcha }) {
    if (!sellerMst) {
      throw new TraCuuGocError("INVALID_CODE", "Thiếu MST người bán (supplierTaxCode) cho hóa đơn Viettel");
    }
    // Captcha "kéo mảnh ghép" của Viettel là TỰ-PHÁT-HÀNH (generate trả sẵn offsetX) nên BE tự giải:
    // ưu tiên token do nơi gọi truyền vào (nếu có), thiếu thì tự `solveCaptcha()`. Dialog tải hàng loạt
    // (kiểu MISA) KHÔNG truyền recaptcha -> tự giải mỗi hóa đơn.
    const token = recaptcha || (await solveCaptcha());

    const res = await fetchUpstream(
      `${VINVOICE_VIETTEL_DOWNLOAD_PDF}?taxCode=${encodeURIComponent(sellerMst)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
          origin: VINVOICE_VIETTEL_ORIGIN,
          referer: VINVOICE_VIETTEL_REFERER,
        },
        body: JSON.stringify({ supplierTaxCode: sellerMst, reservationCode: code, recaptcha: token }),
      },
      "Viettel",
    );

    // Lỗi nghiệp vụ trả JSON (vd 400 INVOICE_NOT_FOUND); PDF trả octet-stream.
    if ((res.headers.get("content-type") || "").includes("application/json")) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new TraCuuGocError(
        "INVALID_CODE",
        `Viettel: ${body?.message || "không tìm thấy hóa đơn"} (mã "${code}")`,
      );
    }
    if (!res.ok) {
      throw new TraCuuGocError("UPSTREAM", `Viettel trả lỗi khi tải file (HTTP ${res.status})`);
    }
    return pdfFromResponse(res, code, "Viettel");
  },
};

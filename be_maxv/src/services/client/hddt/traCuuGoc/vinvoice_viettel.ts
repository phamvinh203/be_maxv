import { fetchUpstream, pdfFromResponse } from "./shared";
import { ProviderDownloader, TraCuuGocError } from "./types";


const VINVOICE_VIETTEL_ORIGIN = "https://vinvoice.viettel.vn";
const VINVOICE_VIETTEL_URL = `${VINVOICE_VIETTEL_ORIGIN}/api/services`;
const VINVOICE_VIETTEL_DOWNLOAD_PDF = `${VINVOICE_VIETTEL_URL}/einvoicequery/sync/utility/downloadPDF`;
const VINVOICE_VIETTEL_REFERER = `${VINVOICE_VIETTEL_ORIGIN}/utilities/invoice-search`;

/** Hình dạng response của `/api/captcha/generate` (chỉ khai phần mình dùng). */
interface CaptchaGenerate {
  token: string;
  offsetX: number;
}

/** Hình dạng response của `/api/captcha/verify`. */
interface CaptchaVerify {
  success: boolean;
  token: string;
  message?: string;
}

/**
 * Tự giải captcha kéo mảnh ghép của Viettel: generate -> lấy token + offsetX -> verify.
 * Trả về `token` ĐÃ XÁC THỰC (dùng làm `recaptcha` cho bước tải file). Dùng `fetchUpstream` (timeout +
 * User-Agent + bọc lỗi `UPSTREAM`) như mọi request tới cổng NCC.
 */
async function solveCaptcha(): Promise<string> {
  // --- Bước 1: generate, lấy token + offsetX ---
  const genRes = await fetchUpstream(
    `${VINVOICE_VIETTEL_URL}/einvoiceuaa/api/captcha/generate`,
    { headers: { accept: "application/json" } },
    "Viettel",
  );
  if (!genRes.ok) {
    throw new TraCuuGocError("UPSTREAM", `Viettel không cấp captcha (HTTP ${genRes.status})`);
  }
  const gen = (await genRes.json()) as CaptchaGenerate;
  if (!gen?.token || typeof gen.offsetX !== "number") {
    throw new TraCuuGocError("UPSTREAM", "captcha/generate không trả token hoặc offsetX");
  }

  // Jitter ±1px cho giống thao tác người (offsetX server chấp nhận sai số slideCaptchaOffsetMargin).
  const offsetX = gen.offsetX + (Math.floor(Math.random() * 3) - 1);

  // --- Bước 2: verify (POST — dùng GET sẽ bị 405) ---
  // TODO(viettel): chốt tên field payload đúng với backend (có thể cần offsetY / tên khác).
  const verifyRes = await fetchUpstream(
    `${VINVOICE_VIETTEL_URL}/einvoiceuaa/api/captcha/verify`,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ token: gen.token, offsetX }),
    },
    "Viettel",
  );
  if (!verifyRes.ok) {
    throw new TraCuuGocError("UPSTREAM", `captcha/verify trả lỗi (HTTP ${verifyRes.status})`);
  }
  const verify = (await verifyRes.json()) as CaptchaVerify;
  if (!verify?.success || !verify.token) {
    throw new TraCuuGocError("UPSTREAM", `Xác thực captcha thất bại: ${verify?.message ?? "không rõ"}`);
  }

  return verify.token;
}

// ============================================================
//  BỘ TẢI PDF (provider) — BE TỰ GIẢI captcha (`solveCaptcha`) rồi tải; người dùng không thao tác captcha.
// ============================================================

export const viettel: ProviderDownloader = {
  mst: "0100109106",
  ten: "Viettel",
  canSellerMst: true,
  // Cùng URL với `referer` của bước tải — đây đúng là trang mà luồng tự động đang giả lập.
  urlTraCuu: VINVOICE_VIETTEL_REFERER,
  async download({ code, sellerMst }) {
    // Captcha "kéo mảnh ghép" của Viettel là TỰ-PHÁT-HÀNH (generate trả sẵn offsetX) nên BE tự giải.
    const token = await solveCaptcha();

    const res = await fetchUpstream(
      // `sellerMst!`: `canSellerMst` ở trên đã bắt dispatcher chặn ca thiếu trước khi vào đây.
      `${VINVOICE_VIETTEL_DOWNLOAD_PDF}?taxCode=${encodeURIComponent(sellerMst!)}`,
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

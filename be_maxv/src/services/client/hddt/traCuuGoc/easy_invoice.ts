/**
 * ===== TẢI HÓA ĐƠN GỐC — SOFTDREAMS / EasyInvoice (easyinvoice.com.vn) =====
 *
 * Cổng ASP.NET MVC cổ điển: cookie session + form POST + scrape HTML. Gần giống VNPT nhưng ĐƠN GIẢN
 * HƠN MỘT BẬC — form KHÔNG có `__RequestVerificationToken` (đã kiểm chứng bằng cách đọc HTML
 * `/Search/Index`: các input là `ListInv`, `InvData`, `msg`, `typeSearch`, `FKey`, `Capcha`), nên
 * không phải extract token nào cả.
 *
 * ORIGIN THEO MST NGƯỜI BÁN: mỗi công ty phát hành qua Softdreams có portal riêng
 * `https://<nbmst>hd.easyinvoice.com.vn` (vd `0108787907` -> `0108787907hd.easyinvoice.com.vn`). Caller phải
 * truyền `sellerMst` — xem `buildEasyOrigin`.
 *
 * LUỒNG 3 REQUEST:
 *   1) GET  `/Captcha/Show`  -> ảnh PNG + Set-Cookie `ASP.NET_SessionId`.
 *      ⚠️ CHÍNH REQUEST NÀY MINT SESSION, không phải `/Search/Index`. Đã đo: GET `/Search/Index` trả
 *      200 mà KHÔNG set cookie nào (ASP.NET chỉ tạo session khi có code chạm vào Session — ở đây là
 *      captcha handler). Vì vậy KHÔNG cần tải trang search; bắt đầu thẳng từ đây.
 *   2) POST `/Search/Search` form `typeSearch=&FKey=<fkey>&Capcha=<captcha>` (kèm cookie bước 1)
 *      -> HTML chứa `invToken` trong lời gọi inline `showInv(…, '<token>')`.
 *      ⚠️ Tên field là `Capcha` — THIẾU chữ 't', do backend Softdreams đặt (cùng kiểu lỗi chính tả với
 *      `captch` của VNPT). Gõ đúng `Captcha` là server bỏ qua và luôn báo sai mã.
 *      3 field `ListInv`/`InvData`/`msg` có trong form nhưng bỏ đi vẫn chạy (curl thật đã xác nhận).
 *      ⚠️ TRANG KẾT QUẢ KHÔNG CÓ LINK TẢI — kết quả render CLIENT-SIDE, xem `rutInvToken`.
 *   3) GET  `/Invoice/DownloadPdfAndFileAttach?token=<invToken>` -> bytes zip (có thể qua 302 sang
 *      `/Invoice/Download?fileGuid=…`; cứ để fetch đi theo redirect).
 *
 * THẤT BẠI THÌ LÝ DO Ở ĐÂU: cổng KHÔNG in ra chỗ người đọc, nó nhét vào `<input id="msg">` rồi sweetalert
 * pop lên. Captcha sai -> `msg` = "Nhập đúng mã capcha" (đã bắt được từ response thật). Xem `rutMsg`.
 *
 * ⚠️ FILE TRẢ VỀ LÀ **ZIP** (vd `HOADON_0108787907_1C26TML_35.zip`), khác mọi NCC hiện có. `taiFile`
 * giải nén và CHỈ TRẢ PDF bên trong, nên ra khỏi module này hợp đồng vẫn là "1 file PDF" như các NCC
 * khác — xem docblock `taiFile`.
 *
 * KHÁC VNPT MỘT ĐIỂM QUAN TRỌNG: EasyInvoice gắn session với ĐÚNG 1 ảnh — `layCaptcha` mint session
 * VÀ lấy ảnh trong cùng một request, server không cho xin ảnh khác trên session cũ. Vòng retry của
 * provider `easyInvoice` vì vậy chỉ có 1 cấp: mỗi lượt = session + ảnh mới hoàn toàn (không có vòng
 * "đổi ảnh trong session" như VNPT).
 */

import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import type { Worker } from "tesseract.js";
import { describeErrorChain } from "../../../../config/gdt-client";
import { listZipEntryNames, readZipEntryByExtension } from "../../../../helpers/zip";
import {
  NAVIGATE_HEADERS,
  TESSERACT_QUIET,
  assertMst,
  decodeHtmlEntities,
  fetchUpstream,
  htmlToText,
  khopCum,
  laPdf,
  loiHetLuotThuLai,
  makeDbg,
  makeDeadline,
  mergeSetCookie,
  pdfFromResponse,
} from "./shared";
import { FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

// ============================================================
//  CONSTANTS
// ============================================================

const TEN = "EasyInvoice";

/** MST NCC phát hành — khớp entry `0105987432` trong registry FE `TRA_CUU_NCC`. */
export const EASY_INVOICE_MST = "0105987432";

const CAPTCHA_PATH = "/Captcha/Show";
const SEARCH_PATH = "/Search/Search";
const SEARCH_PAGE_PATH = "/Search/Index";
/** Đổi `invToken` lấy file zip (PDF + đính kèm) — đúng endpoint sau nút "Tải PDF & đính kèm". */
const DOWNLOAD_PDF_ATTACH_PATH = "/Invoice/DownloadPdfAndFileAttach";

/**
 * Build origin portal tenant EasyInvoice từ `nbmst` (MST người bán): `https://<nbmst>hd.easyinvoice.com.vn`.
 *
 * GIỮ NGUYÊN MST kể cả đuôi chi nhánh `-001` — chưa gặp mẫu hóa đơn chi nhánh nào để biết Softdreams
 * tách portal theo chi nhánh (như VNPT) hay dùng chung portal MST mẹ. Đừng tự strip đuôi vì đoán:
 * strip sai thì mọi hóa đơn chi nhánh lặng lẽ tra vào portal của công ty khác.
 */
export function buildEasyOrigin(nbmst: string): string {
  return `https://${assertMst(nbmst, TEN)}hd.easyinvoice.com.vn`;
}

/** Debug logger — bật bằng `DEBUG_EASYINVOICE=1` khi luồng hỏng (NCC đổi template HTML). */
const dbg = makeDbg("EASYINVOICE-DBG", "DEBUG_EASYINVOICE");

// ============================================================
//  OCR CONSTANTS — cùng bộ tham số đã tinh chỉnh cho `vnpt.ts`, chỉnh lại nếu captcha khác kiểu
// ============================================================

/** Charset whitelist — captcha Softdreams là chữ+số, loại trừ ký tự lạ Tesseract hay hallucinate. */
const CAPTCHA_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Upscale ~3x trước khi OCR: LSTM đọc chữ to chính xác hơn hẳn chữ cao ~30px của captcha gốc. */
const OCR_WIDTH = 360;

/**
 * Ngưỡng binarize của từng biến thể OCR trên CÙNG 1 ảnh: có ngưỡng = binarize + median despeckle (cắt
 * đường nhiễu chéo + đốm nhiễu), `undefined` = chỉ grayscale (binarize quá tay làm mất nét chữ mảnh).
 * Chạy cả hai rồi chọn lần đọc confidence cao nhất — mỗi phép hỏng một kiểu nhiễu khác nhau.
 */
const PREPROCESS_THRESHOLDS: (number | undefined)[] = [180, undefined];

/** Cả 2 PSM chạy trên mỗi biến thể — captcha đôi khi chỉ là 1 "từ" gọn, đôi khi có khoảng hở lẻ. */
const CAPTCHA_PSMS = [PSM.SINGLE_LINE, PSM.SINGLE_WORD] as const;

/** Ngưỡng confidence tối thiểu — dưới ngưỡng này coi như đọc hỏng, trả `null` để lấy ảnh mới thử lại. */
const MIN_OCR_CONFIDENCE = 35;

/** Captcha thường 4–6 ký tự — lần đọc ngoài khoảng rộng này là dính chữ / mất chữ -> bỏ. */
const OCR_LEN_MIN = 3;
const OCR_LEN_MAX = 7;

/**
 * Số lượt thử captcha tối đa — MỖI LƯỢT LÀ 1 SESSION MỚI (ảnh gắn chặt session, xem docblock đầu file)
 * nên cũng là giới hạn số session. Mỗi lượt chỉ tốn 1 GET ảnh + OCR ~200–400ms nên thử dày được.
 */
const MAX_CAPTCHA_RETRIES = 20;

/** Ngân sách thời gian cho 1 lần tải; override bằng env khi cần chờ lâu hơn. */
const retryDeadlineMs = makeDeadline("EASYINVOICE_RETRY_DEADLINE_MS");

// ============================================================
//  SESSION
// ============================================================

/** Session EasyInvoice — chỉ có origin theo tenant + cookie. Không token anti-forgery. */
export interface EasySession {
  /** MST người bán đầy đủ (= nbmst) — để log/debug. */
  nbmst: string;
  /** Origin `https://<nbmst>hd.easyinvoice.com.vn`. */
  origin: string;
  /** Raw Cookie header value (`ASP.NET_SessionId=…`), cập nhật sau mỗi response. */
  cookie: string;
}

/** Một lượt captcha: session đã mint + bytes ảnh PNG để nơi gọi tự đọc. */
export interface EasyCaptcha {
  session: EasySession;
  /** Bytes ảnh captcha (PNG) — server cấp gắn với cookie trong `session`, không dùng chéo được. */
  image: Buffer;
}

/**
 * Bước 1: GET `/Captcha/Show` — vừa mint `ASP.NET_SessionId` vừa lấy ảnh captcha trong MỘT request.
 *
 * Gộp hai việc vì chúng không tách được: ảnh chỉ khớp với session cấp cùng lúc, và session cũng chỉ
 * sinh ra ở đây. Lấy ảnh mới = phải dựng session mới, không có chuyện xin ảnh khác trên session cũ.
 */
export async function layCaptcha(sellerMst: string): Promise<EasyCaptcha> {
  const origin = buildEasyOrigin(sellerMst);
  const res = await fetchUpstream(
    `${origin}${CAPTCHA_PATH}`,
    {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: `${origin}${SEARCH_PAGE_PATH}`,
      },
    },
    TEN,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} không trả captcha (HTTP ${res.status})`);
  }

  const image = Buffer.from(await res.arrayBuffer());
  if (image.length === 0) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} trả ảnh captcha rỗng`);
  }

  const cookie = mergeSetCookie("", res.headers.getSetCookie());
  if (!cookie) {
    // Không có cookie thì bước search chắc chắn hỏng — báo ngay ở đây cho dễ chẩn đoán, đừng để lỗi
    // hiện ra dưới dạng "captcha sai" ở bước sau.
    throw new TraCuuGocError(
      "UPSTREAM",
      `${TEN} không cấp ASP.NET_SessionId ở ${CAPTCHA_PATH} (đổi cách mint session?)`,
    );
  }
  return { session: { nbmst: sellerMst, origin, cookie }, image };
}

// ============================================================
//  OCR — preprocess sharp + Tesseract, đa biến thể, confidence gate
// ============================================================

// Tesseract tạo Worker khá nặng (load WASM + traineddata ~10–15MB lần đầu). Cache 1 worker toàn cục,
// khởi tạo lazy — các lần solve sau chỉ mất ~50–100ms. Giữ worker sống cả lifetime process.
let workerPromise: Promise<Worker> | null = null;

/**
 * Lazy-init Tesseract worker duy nhất cho EasyInvoice: load eng + whitelist alphanumeric. PSM KHÔNG
 * đặt ở đây — `solveCaptcha` đổi PSM theo từng biến thể nên đặt lúc init cũng bị ghi đè ngay.
 */
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", 1, { logger: () => {} });
      await worker.setParameters({
        tessedit_char_whitelist: CAPTCHA_CHARSET,
        // Chặn Leptonica xả debug ra stdout — xem `TESSERACT_QUIET`.
        ...TESSERACT_QUIET,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Giải phóng worker Tesseract — chỉ gọi khi shutdown process / không dùng EasyInvoice nữa. Tránh leak
 * worker trong test runner hoặc hot-reload (tsx watch).
 */
export async function shutdownEasyInvoiceWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}

/**
 * Preprocess ảnh captcha thành các biến thể PNG để OCR: upscale + grayscale + normalize, biến thể có
 * ngưỡng thì thêm binarize + median despeckle. sharp hỏng (ảnh không phải raster…) -> trả ảnh gốc để
 * OCR vẫn chạy như bản Tesseract thuần.
 *
 * KHÔNG gộp phần chung (`resize`+`grayscale`+`normalize`) ra chạy một lần rồi threshold trên pixel
 * đó: libvips áp các phép theo THỨ TỰ NỘI BỘ của nó, không theo thứ tự gọi, nên tách ra làm 2 pipeline
 * cho ra pixel KHÁC — đã đo, ảnh vào OCR đổi luôn. Chạy lại resize cho mỗi biến thể là giá phải trả.
 */
async function preprocessCaptcha(image: Buffer): Promise<Buffer[]> {
  try {
    return await Promise.all(
      PREPROCESS_THRESHOLDS.map((threshold) => {
        const pipeline = sharp(image)
          .resize({ width: OCR_WIDTH, kernel: "lanczos3" })
          .grayscale()
          .normalize();
        return (threshold === undefined ? pipeline : pipeline.threshold(threshold).median(3))
          .png()
          .toBuffer();
      }),
    );
  } catch (err) {
    dbg("preprocessCaptcha lỗi — OCR ảnh gốc", describeErrorChain(err));
    return [image];
  }
}

/**
 * Giải captcha từ `EasyCaptcha` đã lấy bằng `layCaptcha` — preprocess thành 2 biến thể (binarize cắt
 * nhiễu / chỉ grayscale giữ chi tiết) -> OCR mỗi biến thể với cả 2 PSM -> chọn lần đọc confidence cao
 * nhất trong số các lần đọc có độ dài hợp lý. Trả text CHỮ+SỐ đã sạch, hoặc `null` khi không đọc được.
 *
 * Ba lớp tăng tỉ lệ tự giải (giống `vnpt.ts`): preprocess cắt đường nhiễu, đa biến thể × đa PSM lấy
 * kết quả TỐT NHẤT, gate độ dài + confidence để text rác không tốn 1 POST search vô ích.
 *
 * `null` CHỨ KHÔNG ném lỗi: ảnh nhiễu quá là chuyện thường, caller chỉ cần lấy session + ảnh mới thử
 * lại. Lỗi THẬT (không GET được ảnh, ảnh 0 byte) vẫn ném `UPSTREAM` từ `layCaptcha`.
 */
export async function solveCaptcha(captcha: EasyCaptcha): Promise<string | null> {
  const worker = await getWorker();
  const variants = await preprocessCaptcha(captcha.image);

  // 4 lần đọc (~400–800ms với worker đã warm) — đắt nhưng đổi lại xác suất đúng tăng đáng kể. PSM ở
  // vòng NGOÀI để `setParameters` chỉ chạy 1 lần mỗi PSM thay vì trước từng lần đọc.
  const reads: { text: string; confidence: number }[] = [];
  for (const psm of CAPTCHA_PSMS) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    for (const variant of variants) {
      const { data } = await worker.recognize(variant);
      // Tesseract có thể dính space/newline/dấu câu — captcha chỉ alphanumeric nên lọc sạch.
      const text = (data.text || "").replace(/[^A-Za-z0-9]/g, "");
      if (text.length >= OCR_LEN_MIN && text.length <= OCR_LEN_MAX) {
        reads.push({ text, confidence: data.confidence });
      }
    }
  }

  const best = reads.sort((a, b) => b.confidence - a.confidence)[0];
  dbg("solveCaptcha reads", reads);
  // Confidence gate: đọc ra text dài hợp lý nhưng tự tin quá thấp thì vẫn là đoán bừa -> coi như hỏng.
  return best && best.confidence >= MIN_OCR_CONFIDENCE ? best.text : null;
}

// ============================================================
//  BƯỚC 2 — SEARCH
// ============================================================

/**
 * Rút `invToken` — vé định danh hóa đơn — từ HTML kết quả search.
 *
 * TRANG KẾT QUẢ KHÔNG CHỨA LINK TẢI. Đã đọc JS của cổng để chắc: server chỉ nhét payload vào
 * `<input id="InvData">` rồi gọi inline
 *   `showInv(str, cusType, clientNotSign, idInvoice, pattern, fKey, attachFile, status, rowPerPage, data, token)`
 * `showInv` (inline trong trang) dựng thanh nút bằng `getToolbarHtml` (`/Content/js/BrowserDetectShare.js`),
 * và nút "Tải PDF & đính kèm" chỉ là `document.location.href = "/Invoice/DownloadPdfAndFileAttach?token=" + invToken`.
 * URL `/Invoice/Download?fileGuid=…` mà DevTools bắt được là do JS/redirect sinh ra Ở BƯỚC SAU, KHÔNG
 * nằm trong HTML — nên dò `fileGuid` trong HTML là dò thứ không bao giờ có ở đó.
 *
 * Token là ĐỐI SỐ CUỐI của `showInv(...)`. Trang lỗi cũng gọi `showInv` nhưng token là chuỗi rỗng,
 * nên "không rút được token" và "search thất bại" trùng nhau — đúng ý.
 */
function rutInvToken(html: string): string {
  // `[^)]*` tham lam -> bắt chuỗi nháy đơn CUỐI CÙNG trước dấu `)`, tức đúng đối số `token`.
  const m = /showInv\([^)]*,\s*'([^']*)'\s*\)/i.exec(html);
  return m ? m[1].trim() : "";
}

/**
 * Rút thông báo lỗi của EasyInvoice từ hidden input `msg`.
 *
 * Trang search KHÔNG in lý do ra chỗ người đọc: server render lại view rồi nhét câu thông báo vào
 * `<input id="msg" name="msg" value="…">`, JS dùng sweetalert pop nó lên. Vì vậy bóc tag rồi đọc text
 * chỉ ra được phần khung trang (tên công ty, hotline, menu) — đúng triệu chứng đã gặp thật:
 *   `trang báo: C&#212;NG TY TNHH … - Cổng thông tin hóa đơn điện tử … Hotline … TRA CỨU HÓA ĐƠN |`
 * Nhìn vào đó tưởng cổng không báo gì, thực ra thông báo nằm trong attribute.
 *
 * Giải entity vì value được HTML-escape (`&#212;` = "Ô").
 */
function rutMsg(html: string): string {
  // Thử cả 2 thứ tự attribute (id trước value, hoặc ngược lại) để chịu được thay đổi template.
  const m =
    /<input[^>]*\bid=["']msg["'][^>]*\bvalue=["']([^"']*)["']/i.exec(html) ??
    /<input[^>]*\bvalue=["']([^"']*)["'][^>]*\bid=["']msg["']/i.exec(html);
  return m ? decodeHtmlEntities(m[1]).trim() : "";
}

/**
 * Thông báo có phải "không tìm thấy hóa đơn" không — tức FKey sai/hết hạn, thử lại vô ích.
 *
 * CHỈ dò phía "không tìm thấy", KHÔNG dò phía "captcha sai": mặc định của `timHoaDon` đã là retryable
 * nên chỉ cần nhận ra ca DỨT KHOÁT. Dò cả hai phía là nhân đôi số chuỗi phải đoán đúng, mà đoán trượt
 * phía captcha thì hỏng nặng hơn (bỏ oan hóa đơn tra được).
 *
 * ĐÃ KIỂM CHỨNG một mẫu: POST với captcha sai cố ý -> `msg` = "Nhập đúng mã capcha" (đúng, cổng cũng
 * viết sai chính tả "capcha" như tên field). Chuỗi đó KHÔNG khớp danh sách dưới đây nên được xếp
 * retryable — đúng ý.
 *
 * Còn phía "không tìm thấy hóa đơn" thì các chuỗi dưới đây vẫn là PHỎNG ĐOÁN — chưa có FKey sai nào
 * đi kèm captcha ĐÚNG để thấy câu thật. Bắt được thì thay bằng nguyên văn.
 */
const KHONG_TIM_THAY_HINTS = ["không tìm thấy", "không tồn tại", "không có hóa đơn", "hết hạn"];

/**
 * Bước 2: POST `/Search/Search` với `FKey` + captcha đã đọc. Trả ĐƯỜNG DẪN TẢI (path trên cùng origin),
 * sẵn sàng cho `taiFile`.
 *
 * @param captcha Chuỗi đọc được từ `EasyCaptcha.image`.
 *
 * Thất bại -> ném `INVALID_CODE` kèm NGUYÊN VĂN thông báo của cổng. `retryable` phân biệt "captcha đọc
 * nhầm" (ảnh mới là qua) với "FKey sai" (thử mấy cũng vô ích) cho vòng lặp bên ngoài.
 */
export async function timHoaDon(
  session: EasySession,
  fkey: string,
  captcha: string,
): Promise<string> {
  const body = new URLSearchParams({ typeSearch: "", FKey: fkey, Capcha: captcha }).toString();

  const res = await fetchUpstream(
    `${session.origin}${SEARCH_PATH}`,
    {
      method: "POST",
      headers: {
        ...NAVIGATE_HEADERS,
        "content-type": "application/x-www-form-urlencoded",
        origin: session.origin,
        referer: `${session.origin}${SEARCH_PAGE_PATH}`,
        cookie: session.cookie,
      },
      body,
    },
    TEN,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} search trả lỗi (HTTP ${res.status})`);
  }

  const html = await res.text();
  session.cookie = mergeSetCookie(session.cookie, res.headers.getSetCookie());

  // Log để đối chiếu: captcha vừa POST lên + kết quả server trả — đọc đúng mà không ra link là vấn đề
  // field/endpoint, đọc sai (khác captcha trong ảnh) là vấn đề OCR.
  dbg("timHoaDon POST kết quả", { fkey, captcha, status: res.status, html });

  const invToken = rutInvToken(html);
  dbg("timHoaDon kết quả", { invToken: invToken || "(rỗng)" });
  if (invToken) return `${DOWNLOAD_PDF_ATTACH_PATH}?token=${encodeURIComponent(invToken)}`;

  // Lý do thất bại nằm ở hidden input `msg`, KHÔNG nằm trong text hiển thị — xem `rutMsg`.
  const msg = rutMsg(html);
  // Payload dạng HÀM: `htmlToText` quét cả trang vài chục KB, chỉ nên chạy khi debug thật sự bật.
  dbg("timHoaDon thất bại", () => ({ msg, text: htmlToText(html).slice(0, 400) }));

  // `retryable` mặc định TRUE: captcha đọc nhầm là nguyên nhân áp đảo, và đoán sai theo hướng này chỉ
  // tốn thêm vài lượt thử, còn đoán sai theo hướng ngược lại thì bỏ oan một hóa đơn vốn tra được.
  // Dò `KHONG_TIM_THAY_HINTS` để cắt bớt ca FKey sai, khỏi đốt hết deadline một cách vô ích.
  throw new TraCuuGocError(
    "INVALID_CODE",
    msg
      ? `${TEN}: ${msg}`
      : `${TEN} không trả link tải cho FKey "${fkey}" và cổng không kèm thông báo nào` +
        " — bật DEBUG_EASYINVOICE=1 rồi xem log `timHoaDon thất bại`",
    !khopCum(msg, KHONG_TIM_THAY_HINTS),
  );
}

// ============================================================
//  BƯỚC 3 — TẢI FILE
// ============================================================

/**
 * Bước 3: GET đường dẫn tải mà `timHoaDon` trả về -> **PDF**.
 *
 * `duongDan` là path tương đối trên cùng origin (thường là `/Invoice/DownloadPdfAndFileAttach?token=…`).
 * KHÔNG đặt `redirect: "manual"`: endpoint token có thể 302 sang `/Invoice/Download?fileGuid=…`, cứ để
 * fetch đi theo — ta chỉ quan tâm bytes cuối cùng.
 *
 * Cổng trả file `.zip` (PDF + XML ký số) chứ không phải PDF trần như mọi NCC khác. BE GIẢI NÉN ngay
 * tại đây và chỉ trả PDF ra ngoài, để hợp đồng `FileHoaDonGoc` giữ nguyên nghĩa "1 file PDF" và FE
 * không phải biết NCC nào đóng gói kiểu gì — `DownloadOriginalDialog` tự đặt tên file `.pdf` và bỏ qua
 * `filename` của BE, nên trả zip ra là kế toán nhận zip mang đuôi `.pdf`.
 *
 * Nhận cả PDF trần phòng khi Softdreams đổi kiểu đóng gói: phân nhánh theo MAGIC BYTES thật chứ không
 * theo đuôi tên file do NCC đặt.
 *
 * MẤT XML: bản XML ký số trong zip bị bỏ. Luồng "tải hóa đơn gốc" chỉ hứa PDF; XML ký số có đường
 * riêng qua cổng thuế (`/invoices/:direction/export-xml`).
 */
export async function taiFile(
  session: EasySession,
  duongDan: string,
  fkey: string,
): Promise<FileHoaDonGoc> {
  const res = await fetchUpstream(
    `${session.origin}${duongDan}`,
    {
      headers: {
        ...NAVIGATE_HEADERS,
        referer: `${session.origin}${SEARCH_PATH}`,
        cookie: session.cookie,
      },
    },
    TEN,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} tải file trả lỗi (HTTP ${res.status})`);
  }

  // Mượn `pdfFromResponse` cho phần dùng chung: body rỗng -> INVALID_CODE, tên file từ
  // Content-Disposition. `contentType` nó gắn sẵn "application/pdf" — đúng với thứ hàm này trả ra.
  // `maDaXacThuc: true` — đã rút được `invToken` ở bước 2 nên FKey chắc chắn đúng; body rỗng ở đây là
  // lỗi tạm thời của cổng, không phải mã sai.
  const file = await pdfFromResponse(res, fkey, TEN, true);
  if (laPdf(file.buffer)) return file;

  const laZip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b; // "PK"
  if (!laZip) {
    // 200 + HTML báo lỗi là ca hay gặp khi token hết hạn; đừng giao file rác cho kế toán.
    throw new TraCuuGocError(
      "UPSTREAM",
      `${TEN} trả file không phải ZIP/PDF cho FKey "${fkey}" (token hết hạn?)`,
    );
  }

  let pdf: { name: string; data: Buffer } | null;
  try {
    pdf = readZipEntryByExtension(file.buffer, ".pdf");
  } catch (err) {
    // Zip hỏng/định dạng lạ -> lỗi hạ tầng, không phải "mã tra cứu sai".
    throw new TraCuuGocError("UPSTREAM", `${TEN}: không giải nén được ZIP — ${describeErrorChain(err)}`);
  }

  if (!pdf) {
    // Liệt kê tên file bên trong để chẩn đoán ngay, khỏi phải tự tải zip về mở tay.
    const ten = listZipEntryNames(file.buffer).join(", ");
    throw new TraCuuGocError(
      "UPSTREAM",
      `${TEN}: ZIP của FKey "${fkey}" không chứa PDF nào (bên trong: ${ten || "rỗng"})`,
    );
  }

  dbg("taiFile lấy PDF khỏi zip", { fkey, pdf: pdf.name, bytes: pdf.data.length });
  return {
    buffer: pdf.data,
    // Tên trong zip có thể kèm đường dẫn -> lấy phần cuối. FE tự đặt tên khác, đây chỉ là gợi ý.
    filename: pdf.name.split("/").pop() || `${fkey}.pdf`,
    contentType: "application/pdf",
  };
}

// ============================================================
//  GHÉP LUỒNG (bước 2 + 3)
// ============================================================

// ============================================================
//  PROVIDER — wrapper đầy đủ, tự OCR + retry captcha
// ============================================================

/**
 * Bộ tải EasyInvoice đầy đủ — tự đọc captcha và retry TỚI KHI THÀNH CÔNG. Origin portal tenant build
 * từ `sellerMst` (MST của công ty phát hành — tab đang hiển thị) nên BẮT BUỘC truyền `sellerMst`.
 *
 * Retry 1 cấp (KHÁC VNPT — EasyInvoice gắn session với ĐÚNG 1 ảnh nên không có vòng "đổi ảnh trong
 * session"): mỗi lượt = `layCaptcha` (session + ảnh mới) -> OCR -> POST search. Lặp tới khi lấy được
 * PDF, giới hạn bởi `retryDeadlineMs()` (30s, env `EASYINVOICE_RETRY_DEADLINE_MS`) và
 * `MAX_CAPTCHA_RETRIES` (20 lượt). Ảnh random mỗi lượt, xác suất đúng độc lập, nên càng thử nhiều càng
 * gần chắc chắn đúng.
 *
 * Lỗi `retryable=false` (fkey SAI, UPSTREAM, lỗi khác) -> throw NGAY — session mới không làm fkey đúng
 * hơn, thử tiếp chỉ phí thời gian. `timHoaDon` đã đánh `retryable=true` mặc định khi không thấy link
 * tải (nguyên nhân áp đảo là captcha đọc nhầm) nên vòng retry hoạt động đúng.
 */
export const easyInvoice: ProviderDownloader = {
  mst: EASY_INVOICE_MST,
  ten: TEN,
  async download({ code, sellerMst }) {
    if (!sellerMst) {
      throw new TraCuuGocError(
        "INVALID_CODE",
        "Thiếu sellerMst — EasyInvoice build origin portal tenant `<mst>hd.easyinvoice.com.vn` từ MST này",
      );
    }

    const budgetMs = retryDeadlineMs();
    const deadline = Date.now() + budgetMs;
    // `null` khi mọi lượt OCR đều ra rỗng (chưa lượt nào tới được POST search) — `loiHetLuotThuLai`
    // xử lý ca đó, khỏi phải dựng sẵn một lỗi mồi chỉ để rồi bọc lại.
    let lastErr: unknown = null;
    for (let i = 0; i < MAX_CAPTCHA_RETRIES && Date.now() < deadline; i++) {
      // Mỗi lượt là session + ảnh mới hoàn toàn (ảnh gắn session, xem docblock đầu file).
      const captcha = await layCaptcha(sellerMst);
      // PHẢI nằm TRONG vòng lặp và KHÔNG được ném khi OCR hỏng — đây là nhánh hay gặp nhất, session +
      // ảnh mới thử lại thường qua. Đọc hỏng -> bỏ lượt luôn, chưa tốn POST search.
      const captchaText = await solveCaptcha(captcha);
      if (!captchaText) continue;
      try {
        const duongDanTai = await timHoaDon(captcha.session, code, captchaText);
        return await taiFile(captcha.session, duongDanTai, code);
      } catch (err) {
        lastErr = err;
        // Chỉ captcha sai mới đáng thử tiếp (session + ảnh mới ở lượt sau). Fkey sai / UPSTREAM / lỗi
        // khác -> throw ngay, thử tiếp chỉ phí thời gian.
        if (err instanceof TraCuuGocError && err.retryable) continue;
        throw err;
      }
    }

    throw loiHetLuotThuLai(TEN, budgetMs, lastErr);
  },
};

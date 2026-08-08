/**
 * ===== TẢI HÓA ĐƠN GỐC — VNPT (vnpt-invoice.com.vn) =====
 *
 * Cổng VNPT dùng CAPTCHA ẢNH (text distortion + đường nhiễu) tại `/Captcha/Show` + form POST search
 * chuẩn ASP.NET MVC (anti-forgery token + cookie session). Để BE tự tải phải giả lập đủ bước như
 * trình duyệt: GET trang search (lấy cookie + form token) -> OCR captcha -> POST search -> GET PDF.
 *
 * ORIGIN THEO MST TENANT: mỗi công ty phát hành hóa đơn qua VNPT có 1 portal tenant riêng với subdomain
 * `https://<mst>-tt78.vnpt-invoice.com.vn`. MST dùng làm subdomain là `nbmst` ĐẦY ĐỦ — GIỮ CẢ đuôi chi
 * nhánh `-001`/`-002` nếu có (vd `0900887803-001` -> subdomain `0900887803-001-tt78...`) vì chi nhánh có
 * portal riêng. Caller truyền `sellerMst` (= nbmst đầy đủ) vào `initSession` -> `buildVptOrigin`.
 *
 * LUỒNG 4 BƯỚC (bắt buộc theo thứ tự — token + cookie có thời hạn ngắn):
 *   1) `initSession(sellerMst)` — GET `/HomeNoLogin/SearchByFkey` trên portal tenant `<mst>-tt78`:
 *      - server set-cookie (ASP.NET_SessionId, __RequestVerificationToken, SESSIONID)
 *      - HTML chứa <input name="__RequestVerificationToken" value="..."> (form token, KHÁC cookie token)
 *   2) `solveCaptcha(session)` — GET `/Captcha/Show` (dùng cookie bước 1, server cấp captcha khớp
 *      session) -> Tesseract.js -> text alphanumeric (4–6 ký tự).
 *   3) `searchByFkey(session, fkey, captcha)` — POST form `/HomeNoLogin/SearchByFkey`:
 *      Payload: `__RequestVerificationToken=<formToken>&strFkey=<fkey>&captch=<captcha>&submit=`
 *      ⚠️ Tên field captcha LÀ `captch` (KHÔNG có chữ 'a' cuối) — đặt bởi backend VNPT.
 *      Response: redirect 303 tới `/HomeNoLogin/downloadPDF?checkCode=<code>` HOẶC HTML chứa link.
 *   4) `downloadPdf(session, checkCode)` — GET `/HomeNoLogin/downloadPDF?checkCode=<code>` -> PDF bytes.
 *
 * OCR không hoàn hảo nên có 2 lớp bù: `solveCaptcha` đọc nhiều biến thể ảnh × nhiều PSM rồi chọn kết
 * quả tốt nhất, và provider `vpt` ở cuối file retry tới khi thành công. Chi tiết ở docblock của từng
 * hàm; chỉnh tham số ở section PREPROCESSING + OCR.
 *
 * HEADER NAVIGATION: cả POST search và GET downloadPDF BẮT BUỘC gửi Sec-Fetch-Mode=navigate +
 * Upgrade-Insecure-Requests=1 — thiếu server trả lỗi hoặc body rỗng (giống DownloadHandler của MISA).
 */

import { createWorker, PSM } from "tesseract.js";
import type { Worker } from "tesseract.js";
import sharp from "sharp";
import { describeErrorChain } from "../../../../config/gdt-client";
import { fetchUpstream, pdfFromResponse } from "./shared";
import { FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

// ============================================================
//  CONSTANTS — endpoint + header navigation (origin build động từ sellerMst)
// ============================================================

/**
 * Build origin portal tenant VNPT từ `nbmst` (MST người bán đầy đủ): ghép nguyên MST — GIỮ CẢ đuôi chi
 * nhánh `-001`/`-002` nếu có — thành `https://<nbmst>-tt78.vnpt-invoice.com.vn` (vd `0900887803-001` ->
 * `https://0900887803-001-tt78.vnpt-invoice.com.vn`). Chi nhánh có portal tenant RIÊNG, không dùng chung
 * portal của MST chính, nên KHÔNG được strip đuôi. Version `tt78` cố định — NCC nâng version thì sửa đây.
 */
export function buildVptOrigin(nbmst: string): string {
  return `https://${nbmst.trim()}-tt78.vnpt-invoice.com.vn`;
}

const VPT_SEARCH_PATH = "/HomeNoLogin/SearchByFkey";
const VPT_CAPTCHA_PATH = "/Captcha/Show";
const VPT_DOWNLOAD_PATH = "/HomeNoLogin/downloadPDF";

/** Charset whitelist — captcha VNPT là chữ+số, loại trừ ký tự lạ mà Tesseract có thể hallucinate. */
const CAPTCHA_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Header "navigation" — VNPT kiểm tra Sec-Fetch-Mode=navigate cho POST search và GET downloadPDF.
 * Thiếu -> server trả lỗi hoặc body rỗng. accept text/html vì đây là browser navigation, không phải XHR.
 */
const NAVIGATE_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

/** Số lần thử captcha trong MỘT session (mỗi lần GET ảnh mới -> text khác). Mỗi lượt chỉ tốn 1 GET ảnh
 * + OCR ~200–400ms — rẻ hơn nhiều so với init session lại, nên thử dày trong cùng session. */
const MAX_CAPTCHA_RETRIES = 8;

/**
 * Thời gian tối đa (ms) cho 1 lần tải: vòng retry session chạy TỚI KHI LẤY ĐƯỢC hóa đơn, chỉ dừng khi
 * hết deadline này (hoặc fkey sai). Mỗi lượt (1 ảnh + OCR + POST) ~250–400ms, 30s ≈ 10+ session × 8
 * lượt. Override bằng env `VPT_RETRY_DEADLINE_MS` khi cần chờ lâu hơn / VNPT rate-limit mạnh.
 *
 * Đọc LÚC GỌI chứ không lúc import: `server.ts` import `./app` TRƯỚC `./config/env` nên biến môi
 * trường từ `.env.local` chưa chắc đã có ở thời điểm module này được nạp (xem cảnh báo cùng kiểu ở
 * `gdt.service.ts`) — đọc lúc import thì knob có thể im lặng không ăn.
 */
function retryDeadlineMs(): number {
  return Number(process.env.VPT_RETRY_DEADLINE_MS) || 30_000;
}

/** Cứu cánh cuối: kể cả deadline còn dư, không quá ngần này session — chống vòng lặp vô hạn nếu env
 * `VPT_RETRY_DEADLINE_MS` đặt sai (vd quá lớn). 12 session = 96 lượt, xác suất thành công ~100%. */
const MAX_SESSION_HARD_CAP = 12;

// ============================================================
//  PREPROCESSING + OCR — sharp pipeline, đa biến thể, confidence gate
// ============================================================

/** Upscale ~3x trước khi OCR: LSTM đọc chữ to chính xác hơn hẳn chữ cao ~30px của captcha gốc. */
const OCR_WIDTH = 360;

/**
 * Ngưỡng binarize của từng biến thể OCR trên CÙNG 1 ảnh: có ngưỡng = binarize + median despeckle (cắt
 * đường nhiễu chéo + đốm nhiễu của captcha VNPT), `undefined` = chỉ grayscale (binarize quá tay làm
 * mất nét chữ mảnh). Mỗi phép xử lý hỏng một kiểu nhiễu khác nhau nên chạy cả hai rồi chọn lần đọc
 * confidence cao nhất — xác suất ít nhất 1 biến thể ra text đúng cao hơn hẳn 1 biến thể duy nhất.
 */
const PREPROCESS_THRESHOLDS: (number | undefined)[] = [180, undefined];

/** Cả 2 PSM chạy trên mỗi biến thể — captcha đôi khi chỉ là 1 "từ" gọn, đôi khi có khoảng hở lẻ. */
const CAPTCHA_PSMS = [PSM.SINGLE_LINE, PSM.SINGLE_WORD] as const;

/** Ngưỡng confidence tối thiểu — dưới ngưỡng này coi như đọc hỏng, trả `null` để caller lấy ảnh mới
 * thử lại thay vì POST text rác lên VNPT. Tesseract trên ảnh captcha nhiễu thường 40–70%, ngưỡng 35
 * lọc được đọc bừa mà không loại bỏ lần đọc đúng nhưng tự tin thấp. */
const MIN_OCR_CONFIDENCE = 35;

/** Captcha VNPT thường 4–6 ký tự — lần đọc ra ngoài khoảng rộng này là dính chữ / mất chữ -> bỏ. */
const OCR_LEN_MIN = 3;
const OCR_LEN_MAX = 7;

/**
 * Preprocess ảnh captcha thành các biến thể PNG để OCR: upscale + grayscale + normalize, biến thể có
 * ngưỡng thì thêm binarize + median despeckle. sharp tự decode PNG/JPEG nên không cần thư viện riêng.
 * sharp hỏng (ảnh không phải raster…) -> trả ảnh gốc để OCR vẫn chạy như bản Tesseract thuần.
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

// ============================================================
//  TESSERACT WORKER — cache toàn cục, init lazy
// ============================================================

// Tesseract tạo Worker khá nặng (load WASM + traineddata ~10–15MB lần đầu). Cache 1 worker toàn cục,
// khởi tạo lazy — các lần solve sau chỉ mất ~50–100ms. Giữ worker sống cả lifetime process.
let workerPromise: Promise<Worker> | null = null;

/**
 * Lazy-init Tesseract worker duy nhất cho VNPT: load eng + whitelist alphanumeric. PSM KHÔNG đặt ở
 * đây — `solveCaptcha` đổi PSM theo từng biến thể nên đặt lúc init cũng bị ghi đè ngay.
 * Logger bị tắt (mặc định Tesseract spam progress ra stdout).
 */
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", 1, { logger: () => {} });
      await worker.setParameters({ tessedit_char_whitelist: CAPTCHA_CHARSET });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Giải phóng worker Tesseract — chỉ gọi khi shutdown process / không dùng VNPT nữa. Tránh leak worker
 * trong test runner hoặc hot-reload (tsx watch).
 */
export async function shutdownVptWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}

// ============================================================
//  SESSION + HELPERS — cookie merge, token extraction
// ============================================================

/**
 * Session VNPT — mang đủ state qua 4 bước: origin build từ `nbmst` (portal tenant), cookie cập nhật
 * sau mỗi response, formToken extract từ HTML bước init (form anti-forgery token, khác cookie token).
 */
export interface VptSession {
  /** MST người bán đầy đủ (vd `0900887803-001`, có thể có đuôi chi nhánh) — để log/debug. */
  nbmst: string;
  /** Origin đầy đủ `https://<nbmst>-tt78.vnpt-invoice.com.vn` — build từ MST đầy đủ (còn đuôi chi nhánh). */
  origin: string;
  /** Raw Cookie header value, cập nhật qua `mergeSetCookie` sau mỗi response. */
  cookie: string;
  /** Form anti-forgery token (extract từ input[name=__RequestVerificationToken] trong HTML). */
  formToken: string;
}

/**
 * Merge Set-Cookie headers của response vào cookie string hiện tại —同名 overwrite, name mới thêm vào.
 * ASP.NET set-cookie nhiều lần qua lifecycle (session init, captcha, search) — không merge sẽ bị reject.
 */
function mergeSetCookie(currentCookie: string, setCookieHeaders: string[]): string {
  const map = new Map<string, string>();
  for (const part of currentCookie.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) map.set(k, v);
    }
  }
  for (const sc of setCookieHeaders) {
    // Set-Cookie: name=value; Path=/; HttpOnly; ...  -> chỉ lấy phần "name=value" đầu.
    const nv = sc.split(";")[0];
    const idx = nv.indexOf("=");
    if (idx > 0) {
      const k = nv.slice(0, idx).trim();
      const v = nv.slice(idx + 1).trim();
      if (k) map.set(k, v);
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** Cập nhật cookie session từ Set-Cookie headers của response. Trả về cookie string mới (merge). */
function absorbSetCookie(session: VptSession, res: Response): string {
  const merged = mergeSetCookie(session.cookie, res.headers.getSetCookie());
  session.cookie = merged;
  return merged;
}

/**
 * Debug logger tạm thời — bật bằng `DEBUG_VNPT=1` khi chạy BE. In ra thông tin chiến lược ở từng bước
 * (form token, status, HTML response, captcha text) để chẩn đoán khi provider fail. Để lại trong code
 * (không xóa) vì hay cần debug khi NCC đổi template — chỉ tắt khi DEBUG_VNPT không set.
 */
function dbg(label: string, payload: unknown): void {
  if (process.env.DEBUG_VNPT !== "1") return;
  if (typeof payload === "string") {
    // Cắt HTML dài > 2000 ký tự để log không bị tràn — phần đầu đủ để xem cấu trúc template.
    const trimmed = payload.length > 2000 ? `${payload.slice(0, 2000)}… (+${payload.length - 2000} chars)` : payload;
    // eslint-disable-next-line no-console
    console.log(`[VNPT-DBG] ${label}:`, trimmed);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[VNPT-DBG] ${label}:`, payload);
  }
}

/**
 * Extract form anti-forgery token từ HTML trang search. ASP.NET MVC render:
 *   <input name="__RequestVerificationToken" type="hidden" value="..." />
 * Token này khác cookie __RequestVerificationToken — cả hai đều cần khi POST.
 */
function extractFormToken(html: string): string | null {
  // Thử cả 2 thứ tự attribute (name trước value, hoặc value trước name) để chịu được thay đổi template.
  const m1 = /name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i.exec(html);
  if (m1) return m1[1];
  const m2 = /value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i.exec(html);
  return m2 ? m2[1] : null;
}

/**
 * Extract `checkCode` từ response search: có thể trong Location header (nếu server redirect 303 tới
 * downloadPDF) hoặc trong HTML body (link <a href="/HomeNoLogin/downloadPDF?checkCode=...">).
 * checkCode là base64-like — có thể chứa `/`, `+`, `=` nên regex không restrict charset.
 */
function extractCheckCode(res: Response, html: string): string | null {
  const loc = res.headers.get("location") || "";
  const locMatch = /checkCode=([^&\s]+)/i.exec(loc);
  if (locMatch) return decodeURIComponent(locMatch[1]);
  const htmlMatch = /downloadPDF\?checkCode=([^"&'\s]+)/i.exec(html);
  return htmlMatch ? decodeURIComponent(htmlMatch[1]) : null;
}

// ============================================================
//  PUBLIC API — 4 bước của luồng tải VNPT
// ============================================================

/**
 * Bước 1: Khởi tạo session — GET `/HomeNoLogin/SearchByFkey` trên portal tenant `<sellerMst>-tt78` để
 * nhận set-cookie (ASP.NET_SessionId, __RequestVerificationToken cookie, SESSIONID) và extract form
 * anti-forgery token từ HTML.
 *
 * @param sellerMst MST người bán đầy đủ (= nbmst, giữ nguyên đuôi chi nhánh `-001` nếu có) — build origin portal tenant VNPT.
 */
export async function initSession(sellerMst: string): Promise<VptSession> {
  const origin = buildVptOrigin(sellerMst);
  const res = await fetchUpstream(
    `${origin}${VPT_SEARCH_PATH}`,
    {
      headers: {
        ...NAVIGATE_HEADERS,
        referer: `${origin}/`,
      },
    },
    "VNPT",
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `VNPT không mở trang search (HTTP ${res.status})`);
  }
  const html = await res.text();
  const formToken = extractFormToken(html);
  dbg("initSession formToken", formToken ?? "(không tìm thấy)");
  dbg("initSession HTML (đầu)", html);
  if (!formToken) {
    throw new TraCuuGocError(
      "UPSTREAM",
      "VNPT không trả form __RequestVerificationToken (đổi template HTML?)",
    );
  }
  const cookie = mergeSetCookie("", res.headers.getSetCookie());
  return { nbmst: sellerMst, origin, cookie, formToken };
}

/**
 * Bước 2a: GET ảnh captcha VNPT bằng cookie session (bắt buộc — server cấp captcha khớp session).
 * Trả Buffer ảnh (PNG/JPEG). Non-ok hoặc body rỗng -> `UPSTREAM`. Tự absorb Set-Cookie mới vào session.
 */
export async function fetchCaptchaImage(session: VptSession): Promise<Buffer> {
  const res = await fetchUpstream(
    `${session.origin}${VPT_CAPTCHA_PATH}`,
    {
      headers: {
        accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: `${session.origin}${VPT_SEARCH_PATH}`,
        cookie: session.cookie,
      },
    },
    "VNPT",
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `VNPT không trả captcha (HTTP ${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new TraCuuGocError("UPSTREAM", "VNPT trả ảnh captcha rỗng (kiểm tra cookie session)");
  }
  absorbSetCookie(session, res);
  return buffer;
}

/**
 * Bước 2b: Tự giải captcha VNPT — fetch ảnh -> preprocess thành 2 biến thể (binarize cắt nhiễu / chỉ
 * grayscale giữ chi tiết) -> OCR mỗi biến thể với cả 2 PSM -> chọn lần đọc confidence cao nhất trong
 * số các lần đọc có độ dài hợp lý. Trả text CHỮ+SỐ đã sạch (thường 4–6 ký tự), hoặc `null` khi không
 * đọc được.
 *
 * Ba lớp tăng tỉ lệ tự giải so với Tesseract thuần (chỉ ~10–30% với captcha ASP.NET):
 *   1) Preprocess (`preprocessCaptcha`) — cắt đường nhiễu chéo mà Tesseract hay nhầm thành ký tự.
 *   2) Đa biến thể × đa PSM: 4 lần đọc cho 1 ảnh, lấy kết quả TỐT NHẤT thay vì tin 1 lần đọc duy nhất.
 *   3) Gate độ dài + confidence: text rác bị loại ngay đây -> caller lấy ảnh mới, khỏi tốn 1 POST
 *      search với text chắc chắn sai.
 *
 * `null` CHỨ KHÔNG ném lỗi: ảnh nhiễu quá là chuyện thường, caller chỉ cần lấy ảnh mới thử lại. Ném
 * ở đây thì lỗi thoát ra ngoài vòng retry của `vpt` và giết luôn cả 8 lượt. Lỗi THẬT (không GET được
 * ảnh, ảnh 0 byte) vẫn ném `UPSTREAM` từ `fetchCaptchaImage`.
 */
export async function solveCaptcha(session: VptSession): Promise<string | null> {
  const image = await fetchCaptchaImage(session);
  const worker = await getWorker();
  const variants = await preprocessCaptcha(image);

  // 4 lần đọc (~400–800ms với worker đã warm) — đắt nhưng đổi lại xác suất đúng tăng đáng kể. PSM ở
  // vòng NGOÀI để `setParameters` chỉ chạy 1 lần mỗi PSM thay vì trước từng lần đọc.
  const reads: { text: string; confidence: number }[] = [];
  for (const psm of CAPTCHA_PSMS) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    for (const variant of variants) {
      const { data } = await worker.recognize(variant);
      // Tesseract có thể dính space/newline/dấu câu — captcha VNPT chỉ alphanumeric nên lọc sạch.
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

/**
 * Câu VNPT trả về khi captcha sai — LẤY TỪ RESPONSE THẬT, không phải đoán:
 *   "… Website: https://vnpt.com.vn Mã xác thực không chính xác"
 *
 * BẮT BUỘC test trên TEXT đã bóc tag (`htmlToText`), KHÔNG test trên HTML thô. Trang search luôn
 * nhúng sẵn ô captcha (`<img src="/Captcha/Show">`, `name="captch"`) nên bất kỳ pattern nào chứa chữ
 * "captcha" cũng khớp 100% số lần trên HTML thô — biến phép kiểm tra thành hằng `true` và làm nhánh
 * "fkey sai" không bao giờ chạy được. Bản cũ `/captcha|mã (xác nhận|bảo mật)|không đúng/` dính đúng
 * bẫy đó, đồng thời cả 3 alternative đều SAI chữ ("xác thực" chứ không phải "xác nhận", "không chính
 * xác" chứ không phải "không đúng").
 */
const CAPTCHA_ERR_TEXT = "mã xác thực không chính xác".normalize("NFC");

/**
 * So khớp "captcha sai" trên text đã bóc tag. Chuẩn hóa NFC + lowercase trước khi so: tiếng Việt có
 * thể về ở dạng TỔ HỢP (NFD — "a" + dấu rời), lúc đó so trực tiếp với literal NFC trong file này sẽ
 * TRƯỢT dù chữ hiện ra y hệt nhau. Trượt ở đây rất tai hại: mọi lượt captcha sai sẽ bị gán nhãn
 * "mã tra cứu sai", báo cho kế toán một nguyên nhân hoàn toàn bịa.
 */
function laLoiCaptcha(text: string): boolean {
  return text.normalize("NFC").toLowerCase().includes(CAPTCHA_ERR_TEXT);
}

/**
 * Bóc script/style + tag -> text người đọc được, gộp khoảng trắng.
 *
 * Trang search của VNPT nặng ~67KB HTML nhưng phần chữ chỉ vài KB. `dbg` cắt 2000 ký tự ĐẦU của HTML
 * thô nên chỉ thấy `<head>` với đống <link>/<script> — thông báo lỗi nằm sâu dưới body, chưa lần nào
 * lọt vào log. Bóc tag trước rồi mới cắt thì câu thông báo mới hiện ra.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bước 3: POST `/HomeNoLogin/SearchByFkey` với strFkey + captcha đã solve. Trả về `checkCode` để
 * GET downloadPDF. Captcha sai / fkey không tồn tại -> server trả HTML không có checkCode -> `INVALID_CODE`.
 *
 * Payload dùng field `captch` (KHÔNG có chữ 'a' cuối — đặt bởi backend VNPT, đã verify từ curl thật).
 */
export async function searchByFkey(
  session: VptSession,
  fkey: string,
  captcha: string,
): Promise<string> {
  const body = new URLSearchParams({
    __RequestVerificationToken: session.formToken,
    strFkey: fkey,
    captch: captcha,
    submit: "",
  }).toString();

  // redirect: "manual" để bắt 303/302 tới downloadPDF nếu server dùng Post/Redirect/Get pattern.
  const res = await fetchUpstream(
    `${session.origin}${VPT_SEARCH_PATH}`,
    {
      method: "POST",
      headers: {
        ...NAVIGATE_HEADERS,
        "content-type": "application/x-www-form-urlencoded",
        origin: session.origin,
        referer: `${session.origin}${VPT_SEARCH_PATH}`,
        cookie: session.cookie,
      },
      body,
      redirect: "manual",
    },
    "VNPT",
  );
  absorbSetCookie(session, res);

  // 303/302 -> Location chứa checkCode trực tiếp (Post/Redirect/Get tới downloadPDF).
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") || "";
    dbg("searchByFkey redirect", { status: res.status, location: loc });
    const m = /checkCode=([^&\s]+)/i.exec(loc);
    if (m) return decodeURIComponent(m[1]);
    throw new TraCuuGocError("UPSTREAM", `VNPT redirect sau search không có checkCode: ${loc}`);
  }
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `VNPT search trả lỗi (HTTP ${res.status})`);
  }

  // 200 -> HTML chứa link downloadPDF (có thể kèm thông báo lỗi nếu captcha sai).
  const html = await res.text();
  dbg("searchByFkey HTML (đầu)", html);
  const checkCode = extractCheckCode(res, html);
  dbg("searchByFkey checkCode", checkCode ?? "(không tìm thấy)");
  if (!checkCode) {
    // Phân biệt: captcha sai ("Mã xác thực không chính xác") vs fkey không tồn tại.
    const text = htmlToText(html);
    const loiCaptcha = laLoiCaptcha(text);
    // Ca "không phải captcha sai" đến giờ CHƯA có mẫu thật nào — mọi response quan sát được đều là
    // captcha sai. Log text trang khi gặp, để bắt câu VNPT dùng cho fkey sai/hết hạn (hiện chỉ suy đoán).
    if (!loiCaptcha) dbg("searchByFkey text trang (không khớp mẫu captcha sai)", text);
    throw new TraCuuGocError(
      "INVALID_CODE",
      loiCaptcha
        ? `VNPT: captcha sai (OCR nhận "${captcha}") — nên retry`
        : `VNPT không trả checkCode cho fkey "${fkey}" (mã sai hoặc đã hết hạn tra cứu)`,
      // Hint cho vòng retry của `vpt.download`: captcha sai là TẠM THỜI (thử ảnh/session mới có ích),
      // fkey sai là DỨT KHOÁT (session mới không làm fkey đúng hơn) -> throw ngay không phí 96 lượt.
      loiCaptcha,
    );
  }
  return checkCode;
}

/**
 * Bước 4: GET `/HomeNoLogin/downloadPDF?checkCode=<code>` -> PDF bytes. Body rỗng -> `INVALID_CODE`
 * (một số cổng vẫn trả 200 khi checkCode hết hạn). Tên file lấy từ Content-Disposition.
 */
export async function downloadPdf(
  session: VptSession,
  checkCode: string,
): Promise<FileHoaDonGoc> {
  const url = `${session.origin}${VPT_DOWNLOAD_PATH}?checkCode=${encodeURIComponent(checkCode)}`;
  const res = await fetchUpstream(
    url,
    {
      headers: {
        ...NAVIGATE_HEADERS,
        referer: `${session.origin}${VPT_SEARCH_PATH}`,
        cookie: session.cookie,
      },
    },
    "VNPT",
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `VNPT downloadPDF trả lỗi (HTTP ${res.status})`);
  }
  return pdfFromResponse(res, checkCode, "VNPT");
}

// ============================================================
//  PROVIDER — wrapper đầy đủ, tự retry captcha
// ============================================================

/**
 * Bộ tải VNPT đầy đủ — orchestrate 4 bước + retry TỚI KHI THÀNH CÔNG. Origin portal tenant build từ
 * `sellerMst` (MST của công ty phát hành — tab đang hiển thị) nên BẮT BUỘC truyền `sellerMst`.
 *
 * Retry 2 cấp, chạy tới khi lấy được PDF (captcha sai = nguyên nhân TẠM THỜI nên không bỏ cuộc sớm):
 *  - vòng TRONG: `MAX_CAPTCHA_RETRIES` (8) lần GET ảnh mới + OCR + POST trong CÙNG session — ảnh mới
 *    mỗi lần GET nên 8 lần này là 8 ảnh khác nhau.
 *  - vòng NGOÀI: hết 8 lượt trong session mà vẫn captcha sai -> init session MỚI (form token + cookie
 *    mới) -> 8 ảnh mới tiếp theo. Lặp cho tới khi thành công, giới hạn bởi `retryDeadlineMs()` (30s,
 *    env `VPT_RETRY_DEADLINE_MS`) và `MAX_SESSION_HARD_CAP` (12 session) — ảnh random mỗi lượt, xác
 *    suất đúng độc lập, nên càng thử nhiều càng gần chắc chắn đúng.
 *  - Lỗi `retryable=false` (fkey SAI, không phải captcha sai) -> throw NGAY — session mới không làm
 *    fkey đúng hơn, thử tiếp chỉ phí thời gian.
 */
export const vpt: ProviderDownloader = {
  mst: "0100684378",
  ten: "VNPT",
  async download({ code, sellerMst }) {
    if (!sellerMst) {
      throw new TraCuuGocError(
        "INVALID_CODE",
        "Thiếu sellerMst — VNPT build origin portal tenant `<mst>-tt78.vnpt-invoice.com.vn` từ MST này",
      );
    }

    // Khởi tạo sẵn: nếu toàn bộ lượt OCR ra rỗng (hoặc captcha sai đến hết deadline) thì không có err
    // nào từ `catch` để ném — cần 1 lỗi mặc định thông báo rõ giới hạn đã thử.
    const budgetMs = retryDeadlineMs();
    const deadline = Date.now() + budgetMs;
    let lastErr: unknown = new TraCuuGocError(
      "UPSTREAM",
      `VNPT: không tải được hóa đơn trong ${budgetMs / 1000}s retry captcha` +
        ` (${MAX_CAPTCHA_RETRIES} ảnh/session, tối đa ${MAX_SESSION_HARD_CAP} session) — thử tải lại`,
    );
    let sessions = 0;
    while (Date.now() < deadline && sessions < MAX_SESSION_HARD_CAP) {
      sessions++;
      const session = await initSession(sellerMst);
      for (let i = 0; i < MAX_CAPTCHA_RETRIES; i++) {
        // Deadline giữa chừng cũng dừng — không bắt đầu lượt mới khi sắp hết thời gian.
        if (Date.now() >= deadline) break;
        // PHẢI nằm TRONG vòng lặp và KHÔNG được ném khi OCR hỏng — đây là nhánh hay gặp nhất, lấy ảnh
        // mới thử lại thường qua. Đọc hỏng -> bỏ lượt luôn, chưa tốn POST search.
        const captcha = await solveCaptcha(session);
        if (!captcha) continue;
        try {
          const checkCode = await searchByFkey(session, code, captcha);
          return await downloadPdf(session, checkCode);
        } catch (err) {
          lastErr = err;
          // Chỉ captcha sai mới đáng thử tiếp (ảnh mới ở vòng trong, session mới ở vòng ngoài).
          // Fkey sai / UPSTREAM / lỗi khác -> throw ngay, thử tiếp chỉ phí thời gian.
          if (err instanceof TraCuuGocError && err.retryable) continue;
          throw err;
        }
      }
    }
    throw lastErr;
  },
};

// ============================================================
//  NOTES
//  - ACCURACY thấp đi (VNPT đổi kiểu captcha): chạy `DEBUG_VNPT=1`, xem log `solveCaptcha reads` để
//    biết biến thể nào đọc đúng, rồi chỉnh `PREPROCESS_THRESHOLDS` / `OCR_WIDTH` hoặc thêm biến thể.
//  - RETRY nhiều = gửi nhiều request tới VNPT. Bị rate-limit thì GIẢM `VPT_RETRY_DEADLINE_MS` chứ
//    đừng tăng; xác suất tổng của n lượt là 1-(1-p)^n nên vài lượt đầu đã ăn phần lớn lợi ích.
//  - PROD: `buildVptOrigin` hardcode version `tt78` — nếu NCC nâng version portal, sửa tại đó.
// ============================================================

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

import { docTotNhat, taoBoDocCaptcha } from "./captchaOcr";
import {
  NAVIGATE_HEADERS,
  assertMst,
  chayThuLai,
  fetchUpstream,
  htmlToText,
  khopCum,
  makeDbg,
  makeDeadline,
  mergeSetCookie,
  pdfFromResponse,
} from "./shared";
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
const VPT_DOMAIN = "tt78.vnpt-invoice.com.vn";

export function buildVptOrigin(nbmst: string): string {
  return `https://${assertMst(nbmst, "VNPT")}-${VPT_DOMAIN}`;
}

const VPT_SEARCH_PATH = "/HomeNoLogin/SearchByFkey";
const VPT_CAPTCHA_PATH = "/Captcha/Show";
const VPT_DOWNLOAD_PATH = "/HomeNoLogin/downloadPDF";

/**
 * Debug logger — bật bằng `DEBUG_VNPT=1` khi chạy BE. In thông tin từng bước (form token, status, HTML
 * response, captcha text) để chẩn đoán khi provider fail. Để lại trong code (không xóa) vì hay cần
 * debug khi NCC đổi template.
 */
const dbg = makeDbg("VNPT-DBG", "DEBUG_VNPT");

/** Số lần thử captcha trong MỘT session (mỗi lần GET ảnh mới -> text khác). Mỗi lượt chỉ tốn 1 GET ảnh
 * + OCR ~200–400ms — rẻ hơn nhiều so với init session lại, nên thử dày trong cùng session. */
const MAX_CAPTCHA_RETRIES = 8;

/**
 * Ngân sách thời gian cho 1 lần tải: vòng retry session chạy tới khi lấy được hóa đơn, chỉ dừng khi
 * hết ngân sách (hoặc fkey sai). Mỗi lượt (1 ảnh + OCR + POST) ~250–400ms, 30s ≈ 10+ session × 8 lượt.
 * Override bằng env khi cần chờ lâu hơn / VNPT rate-limit mạnh.
 */
const retryDeadlineMs = makeDeadline("VPT_RETRY_DEADLINE_MS");

/** Cứu cánh cuối: kể cả deadline còn dư, không quá ngần này session — chống vòng lặp vô hạn nếu env
 * `VPT_RETRY_DEADLINE_MS` đặt sai (vd quá lớn). 12 session = 96 lượt, xác suất thành công ~100%. */
const MAX_SESSION_HARD_CAP = 12;

// ============================================================
//  OCR — tham số riêng của captcha VNPT (cơ chế đọc ở `captchaOcr.ts`)
// ============================================================

/** Ngưỡng confidence tối thiểu — dưới ngưỡng này coi như đọc hỏng, lấy ảnh mới thay vì POST text rác. */
const MIN_OCR_CONFIDENCE = 35;

/**
 * Captcha VNPT là chữ+số, thường 4–6 ký tự. Hai biến thể ảnh: binarize cắt đường nhiễu chéo /
 * chỉ grayscale giữ nét chữ mảnh. Chỉnh bảng này khi VNPT đổi kiểu captcha.
 */
const boDocCaptcha = taoBoDocCaptcha({
  charset: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  thresholds: [180, undefined],
  lenMin: 3,
  lenMax: 7,
  dbg,
});

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


/** Cập nhật cookie session từ Set-Cookie headers của response. Trả về cookie string mới (merge). */
function absorbSetCookie(session: VptSession, res: Response): string {
  const merged = mergeSetCookie(session.cookie, res.headers.getSetCookie());
  session.cookie = merged;
  return merged;
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
 * Extract `checkCode` từ HTML body của trang search (link <a href="/HomeNoLogin/downloadPDF?checkCode=...">).
 * checkCode là base64-like — có thể chứa `/`, `+`, `=` nên regex không restrict charset.
 *
 * Ca REDIRECT (Location header) KHÔNG xử lý ở đây mà ngay tại `searchByFkey`: tới lúc gọi hàm này thì
 * nhánh 3xx đã return/throw xong nên response chắc chắn 2xx, một bản chép regex thứ hai ở đây chỉ là
 * chỗ để luật trích tách đôi rồi lệch nhau.
 */
function extractCheckCode(html: string): string | null {
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
  return docTotNhat(await boDocCaptcha.doc(image), MIN_OCR_CONFIDENCE);
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
const CAPTCHA_ERR_TEXT = ["mã xác thực không chính xác"];



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
  const checkCode = extractCheckCode(html);
  dbg("searchByFkey checkCode", checkCode ?? "(không tìm thấy)");
  if (!checkCode) {
    // Phân biệt: captcha sai ("Mã xác thực không chính xác") vs fkey không tồn tại.
    const text = htmlToText(html);
    const loiCaptcha = khopCum(text, CAPTCHA_ERR_TEXT);
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
  // `maDaXacThuc: true` — có `checkCode` nghĩa là fkey đã qua bước search; body rỗng ở đây là
  // checkCode hết hạn / cổng trục trặc, đáng thử lại chứ không phải "mã tra cứu sai".
  return pdfFromResponse(res, checkCode, "VNPT", true);
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
  canSellerMst: true,
  // Cùng hằng `VPT_DOMAIN` với `buildVptOrigin` — nâng version portal là sửa một chỗ.
  urlTraCuu: `https://{mst}-${VPT_DOMAIN}/`,
  async download({ code, sellerMst }) {
    // Vòng NGOÀI (ngân sách thời gian + trần số session + phân loại lỗi) do `chayThuLai` lo.
    return chayThuLai({
      ten: "VNPT",
      budgetMs: retryDeadlineMs(),
      maxLuot: MAX_SESSION_HARD_CAP,
      async luot(conHan) {
        const session = await initSession(sellerMst!);
        // Lỗi captcha của lượt cuối trong session: giữ lại để ném ra cho `chayThuLai` ghi nhận (nó
        // đi vào thông báo "lỗi lượt cuối"), thay vì nuốt mất khi hết 8 ảnh.
        let loiCaptcha: unknown = null;
        for (let i = 0; i < MAX_CAPTCHA_RETRIES && conHan(); i++) {
          // PHẢI nằm TRONG vòng lặp và KHÔNG được ném khi OCR hỏng — đây là nhánh hay gặp nhất, lấy
          // ảnh mới thử lại thường qua. Đọc hỏng -> bỏ lượt luôn, chưa tốn POST search.
          const captcha = await solveCaptcha(session);
          if (!captcha) continue;
          try {
            const checkCode = await searchByFkey(session, code, captcha);
            return await downloadPdf(session, checkCode);
          } catch (err) {
            // Ảnh MỚI trong CÙNG session là cách rẻ nhất để sửa captcha đọc nhầm, nên bắt ở đây chứ
            // không để `chayThuLai` bắt — nó sẽ dựng hẳn session mới cho mỗi lần đọc nhầm.
            if (err instanceof TraCuuGocError && err.retryable) {
              loiCaptcha = err;
              continue;
            }
            throw err;
          }
        }
        if (loiCaptcha) throw loiCaptcha;
        return null;
      },
    });
  },
};

// ============================================================
//  NOTES
//  - ACCURACY thấp đi (VNPT đổi kiểu captcha): chạy `DEBUG_VNPT=1`, xem log `solveCaptcha reads` để
//    biết biến thể nào đọc đúng, rồi chỉnh bảng tham số `boDocCaptcha` (thresholds/widths/psms).
//  - RETRY nhiều = gửi nhiều request tới VNPT. Bị rate-limit thì GIẢM `VPT_RETRY_DEADLINE_MS` chứ
//    đừng tăng; xác suất tổng của n lượt là 1-(1-p)^n nên vài lượt đầu đã ăn phần lớn lợi ích.
//  - PROD: `buildVptOrigin` hardcode version `tt78` — nếu NCC nâng version portal, sửa tại đó.
// ============================================================

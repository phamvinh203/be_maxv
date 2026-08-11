/**
 * Helper DÙNG CHUNG cho mọi bộ tải hóa đơn gốc (MISA, Viettel…). Gom hết boilerplate ở đây để mỗi NCC
 * chỉ khai báo phần KHÁC NHAU (URL, cách lấy token, header, kiểu request). Thêm NCC mới ít lặp code.
 */

import { rootCertificates } from "node:tls";
import { Agent, type Dispatcher } from "undici";
import { describeErrorChain } from "../../../../config/gdt-client";
import { listZipEntryNames, readZipEntryByExtension } from "../../../../helpers/zip";
import { MST_REGEX } from "../../../../utils/dbName";
import { FileHoaDonGoc, TraCuuGocError } from "./types";

/** UA trình duyệt thật — các cổng NCC sau Cloudflare thường chặn UA "lạ". */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

/** Timeout mỗi request tới cổng NCC — chặn 1 socket treo làm kẹt cả lượt tải nhiều hóa đơn. */
const TIMEOUT_MS = 30_000;

/**
 * `init` của `fetchUpstream`. `dispatcher` KHÔNG có trong `RequestInit` chuẩn nhưng `fetch` của Node
 * đọc nó (fetch của Node chạy trên undici) — cần để vá chuỗi chứng chỉ, xem `dispatcherThemCa`.
 */
export type UpstreamInit = RequestInit & { dispatcher?: Dispatcher };

/**
 * Dispatcher tin thêm MỘT chứng chỉ CA ngoài kho mặc định của Node.
 *
 * Dùng khi cổng NCC CẤU HÌNH SAI chuỗi chứng chỉ: gửi kèm một CA trung gian không phải CA đã ký cho
 * chứng chỉ của chính nó, nên chuỗi bị đứt và Node từ chối bắt tay
 * (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Trình duyệt và curl trên Windows không lộ ra lỗi này vì chúng
 * tự đi tải CA còn thiếu theo phần mở rộng AIA của chứng chỉ; Node/OpenSSL KHÔNG làm vậy.
 *
 * VẪN XÁC MINH ĐẦY ĐỦ, không phải tắt kiểm tra: kho gốc mặc định (`rootCertificates`) được giữ
 * nguyên và chỉ THÊM đúng CA trung gian còn thiếu — thứ vốn đã chuỗi được về một root công khai.
 * Tuyệt đối không thay bằng `rejectUnauthorized: false`: BE trả thẳng bytes về cho client nên tắt
 * xác minh là mở đường cho người đứng giữa tráo nội dung hóa đơn.
 */
export function dispatcherThemCa(pem: string): Dispatcher {
  return new Agent({ connect: { ca: [...rootCertificates, pem] } });
}

/**
 * `fetch` tới cổng NCC với timeout, tự bọc lỗi mạng/timeout thành `UPSTREAM` (undici giấu lý do thật
 * ở `cause` -> dùng `describeErrorChain`). Trả `Response` thô để nơi gọi tự đọc (binary/JSON). Tự thêm
 * `user-agent` trình duyệt (ghi đè được qua `init.headers`).
 */
export async function fetchUpstream(url: string, init: UpstreamInit, ten: string): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: { "user-agent": BROWSER_UA, ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new TraCuuGocError("UPSTREAM", `Không gọi được ${ten}: ${describeErrorChain(err)}`);
  }
}

/**
 * Header "điều hướng" — nhiều cổng NCC (VNPT, EasyInvoice) kiểm tra `Sec-Fetch-Mode: navigate` cho
 * POST form search và GET tải file. Thiếu -> server trả lỗi hoặc body rỗng. `accept: text/html` vì đây
 * là browser navigation chứ không phải XHR.
 */
export const NAVIGATE_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

/**
 * Merge Set-Cookie của response vào cookie string hiện tại — cùng tên thì ghi đè, tên mới thì thêm.
 * Cổng ASP.NET set-cookie nhiều lần qua vòng đời (mint session, captcha, search); không merge thì
 * request sau bị coi là phiên khác và server từ chối.
 */
export function mergeSetCookie(currentCookie: string, setCookieHeaders: string[]): string {
  const map = new Map<string, string>();
  const nhet = (nv: string) => {
    const idx = nv.indexOf("=");
    if (idx <= 0) return;
    const k = nv.slice(0, idx).trim();
    if (k) map.set(k, nv.slice(idx + 1).trim());
  };
  for (const part of currentCookie.split(";")) nhet(part);
  // "Set-Cookie: name=value; Path=/; HttpOnly; …" -> chỉ lấy cặp "name=value" đầu tiên.
  for (const sc of setCookieHeaders) nhet(sc.split(";")[0]);
  return Array.from(map, ([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * Bóc script/style + tag -> text người đọc được, gộp khoảng trắng.
 *
 * BẮT BUỘC dùng trước khi dò thông báo lỗi của NCC: trang search luôn nhúng sẵn ô captcha và đủ thứ
 * markup, nên mọi pattern dò trên HTML THÔ đều dễ khớp nhầm và biến phép kiểm tra thành hằng `true`
 * (bẫy mà `vnpt.ts` từng dính). Bóc tag rồi mới so chữ thì mới đúng.
 */
export function htmlToText(html: string): string {
  // Giải entity SAU khi bóc tag: entity đã giải không thể tự biến thành thẻ mới.
  return decodeHtmlEntities(
    html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Đổi code point về ký tự; giá trị vô lý thì trả nguyên entity gốc thay vì ném lỗi. */
function tuCodePoint(n: number, goc: string): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : goc;
}

/** Bảng entity dạng TÊN. Khóa viết thường; nơi tra tự hạ chữ trước khi tìm. */
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&apos;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
};

/**
 * Giải HTML entity: dạng SỐ (`&#212;`, `&#xD4;`) và các named phổ biến.
 *
 * DẠNG SỐ LÀ BẮT BUỘC, không phải cho đẹp: cổng NCC render tiếng Việt bằng entity thập phân
 * (`C&#212;NG TY` = "CÔNG TY"). Không giải thì thông báo lỗi đưa cho kế toán đọc ra ký tự lạ, và mọi
 * phép so chuỗi tiếng Việt trên đó (dò "mã xác thực không đúng"…) đều trượt im lặng.
 *
 * MỘT LƯỢT DUY NHẤT, không nối chuỗi `.replace`: nối thì kết quả của bước trước bị bước sau quét lại,
 * nên `&#38;lt;` -> `&lt;` -> `<` — dựng lại được thẻ từ dữ liệu ĐÃ escape. Bản một lượt không bao giờ
 * đọc lại phần vừa thay, nên `&#38;lt;` dừng ở `&lt;` đúng như phải thế.
 */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|[a-z]+);/gi, (goc, hex, dec) => {
    if (hex !== undefined) return tuCodePoint(parseInt(hex, 16), goc);
    if (dec !== undefined) return tuCodePoint(Number(dec), goc);
    // Entity tên lạ (`&copy;`…) -> trả nguyên, đừng nuốt mất ký tự.
    return HTML_ENTITIES[goc.toLowerCase()] ?? goc;
  });
}

/**
 * Kiểm `nbmst` trước khi ghép vào URL cổng NCC. Ném `INVALID_CODE` nếu sai định dạng.
 *
 * BẮT BUỘC vì `sellerMst` đi thẳng từ query-string của client vào template string dựng origin
 * (`https://<mst>hd.easyinvoice.com.vn`, `https://<mst>-tt78.vnpt-invoice.com.vn`). Không kiểm thì
 * `?sellerMst=evil.com/` cho ra `https://evil.com/hd.easyinvoice.com.vn` — host thật là `evil.com`, và
 * bytes ở bước tải file được trả NGUYÊN về client. Tức BE thành proxy có sẵn xác thực, và trỏ được
 * vào host nội bộ (`10.0.0.5:8443/`) để dò mạng trong.
 *
 * Định dạng MST Việt Nam: 10 chữ số, chi nhánh thêm `-` + 3 chữ số. Không có ký tự nào khác lọt qua.
 */
export function assertMst(nbmst: string, ten: string): string {
  const mst = nbmst.trim();
  // Dùng LUẬT MST DÙNG CHUNG của dự án (`utils/dbName`), không chép regex riêng: đây là chốt chặn
  // SSRF, quy tắc đổi mà bản chép ở đây không đổi theo là lệch đúng hướng đắt nhất.
  if (!MST_REGEX.test(mst)) {
    throw new TraCuuGocError("INVALID_CODE", `${ten}: MST người bán không hợp lệ ("${nbmst}")`);
  }
  return mst;
}

/** `true` nếu buffer mở đầu bằng magic `%PDF-`. Dùng để không giao trang HTML lỗi cho kế toán dưới
 * đuôi `.pdf` — cổng NCC hay trả 200 + HTML khi token/mã hết hạn. */
export function laPdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/**
 * Dò xem thông báo của NCC có chứa cụm nào trong `cums` không.
 *
 * CHUẨN HÓA NFC + lowercase CẢ HAI VẾ: tiếng Việt có thể về ở dạng TỔ HỢP (NFD — "a" + dấu rời), lúc
 * đó so trực tiếp với literal NFC trong file nguồn sẽ TRƯỢT dù chữ hiện ra y hệt. Trượt ở đây rất tai
 * hại vì nó quyết định lỗi là "tạm thời, thử lại" hay "hóa đơn hỏng, bỏ qua".
 *
 * Dò theo CỤM NGẮN chứ không so nguyên câu: cùng một tình huống mà mỗi NCC viết một kiểu — VNPT
 * "Mã xác thực không chính xác", CyberLotus "Mã xác thực không hợp lệ".
 */
export function khopCum(text: string, cums: string[]): boolean {
  if (!text) return false;
  const t = text.normalize("NFC").toLowerCase();
  return cums.some((c) => t.includes(c.normalize("NFC").toLowerCase()));
}

/**
 * Tạo hàm đọc ngân sách thời gian (ms) cho vòng thử lại của 1 NCC, override được bằng biến môi trường.
 *
 * Trả về HÀM chứ không phải số: phải đọc env LÚC GỌI, không phải lúc import — `server.ts` import
 * `./app` TRƯỚC `./config/env` nên biến từ `.env.local` chưa chắc đã có ở thời điểm module provider
 * được nạp, đọc sớm thì knob im lặng không ăn.
 */
export function makeDeadline(envVar: string, macDinh = 30_000): () => number {
  return () => Number(process.env[envVar]) || macDinh;
}

/**
 * Lỗi ném ra khi vòng thử lại HẾT NGÂN SÁCH mà chưa tải được — dùng chung cho mọi NCC có vòng thử lại.
 *
 * PHẢI bọc lại chứ không ném thẳng `lastErr`: `lastErr` là lỗi của lượt CUỐI, thường là `INVALID_CODE`
 * "captcha sai" -> controller map thành 422, kế toán đọc ra "mã tra cứu sai/hết hạn" — một nguyên nhân
 * hoàn toàn bịa. Tệ hơn: `DownloadOriginalDialog` coi 422 là DỨT KHOÁT nên KHÔNG quét lại, mà đúng
 * những hóa đơn này lại thường qua ở lượt sau. `UPSTREAM` (502) + `retryable` mới là sự thật.
 *
 * Đến được đây thì luôn là lỗi TẠM THỜI: mọi nguyên nhân DỨT KHOÁT đã `throw` ngay trong vòng lặp.
 */
export function loiHetLuotThuLai(ten: string, budgetMs: number, lastErr: unknown): TraCuuGocError {
  const chiTiet = lastErr instanceof Error ? lastErr.message : lastErr == null ? "" : String(lastErr);
  return new TraCuuGocError(
    "UPSTREAM",
    `${ten}: hết ${budgetMs / 1000}s thử captcha mà chưa tải được hóa đơn — thử lại` +
      (chiTiet ? ` (lỗi lượt cuối: ${chiTiet})` : ""),
    true,
  );
}

/**
 * Vòng THỬ LẠI TRONG NGÂN SÁCH — chính sách retry dùng chung của mọi NCC có captcha.
 *
 * Gom ở đây vì phần tinh tế nhất của luồng này không phải bản thân vòng lặp mà là HỢP ĐỒNG quanh nó,
 * và trước đây mỗi provider tự khẳng định lại hợp đồng đó bằng tay:
 *  - dừng theo NGÂN SÁCH THỜI GIAN, đồng thời có trần số lượt chống env đặt sai (`maxLuot`);
 *  - chỉ `TraCuuGocError.retryable` mới đáng thử tiếp; lỗi DỨT KHOÁT (mã tra cứu sai) ném ngay, vì
 *    lượt mới không làm mã đúng hơn;
 *  - hết ngân sách thì ném `loiHetLuotThuLai` chứ KHÔNG ném thẳng lỗi lượt cuối — xem docblock hàm đó.
 *
 * `luot` trả `null` = "lượt này không đi tới đâu nhưng chưa có lỗi" (OCR đọc hỏng, chưa kịp gọi NCC),
 * trả giá trị = xong. Nhận `conHan()` để vòng lặp CON bên trong 1 lượt (VNPT thử nhiều ảnh trong cùng
 * session) cũng dừng được giữa chừng khi sắp hết giờ.
 */
export async function chayThuLai<T>(opts: {
  ten: string;
  budgetMs: number;
  maxLuot: number;
  luot: (conHan: () => boolean) => Promise<T | null>;
}): Promise<T> {
  const { ten, budgetMs, maxLuot, luot } = opts;
  const deadline = Date.now() + budgetMs;
  const conHan = () => Date.now() < deadline;
  // `null` khi mọi lượt OCR đều ra rỗng (chưa lượt nào gọi tới NCC) — `loiHetLuotThuLai` lo ca đó,
  // khỏi dựng sẵn một lỗi mồi chỉ để rồi bọc lại.
  let lastErr: unknown = null;

  for (let i = 0; i < maxLuot && conHan(); i++) {
    try {
      const ketQua = await luot(conHan);
      if (ketQua !== null) return ketQua;
    } catch (err) {
      lastErr = err;
      if (err instanceof TraCuuGocError && err.retryable) continue;
      throw err;
    }
  }

  throw loiHetLuotThuLai(ten, budgetMs, lastErr);
}

/**
 * Tham số Tesseract để CHẶN debug xả ra stdout.
 *
 * Tesseract/Leptonica in ra những khối như:
 *   Bottom=0, top=75, base=0, x=0 / Total count=0 / Min=0.00 Really=0 / Median=0.00, ile(0.5)=0.00 …
 * Chúng phát ra từ tầng C/WASM nên KHÔNG đi qua `logger` của tesseract.js — `logger: () => {}` dập
 * không nổi. Không set thì log pino của prod bị ngập.
 *
 * ĐÃ ĐO (2 PSM, 1 ảnh 360×90, cùng worker):
 *   ảnh TRẮNG trơn  -> 20 dòng rác, set `debug_file` còn 0
 *   ảnh ĐEN trơn    -> 20 dòng rác, set `debug_file` còn 0
 *   ảnh CÓ CHỮ thật ->  0 dòng rác dù set hay không
 * Tức rác CHỈ sinh ra khi Tesseract nhận ảnh SUY BIẾN (không có gì để tìm dòng chữ). Hệ quả thực tế:
 * provider nào có bảng threshold rộng sẽ tạo ra biến thể trắng/đen trơn và spam log — `xcyber.ts`
 * (threshold 100–220 × 4 width) bị, `easy_invoice.ts` (`[180, undefined]`) không.
 *
 * Những biến thể suy biến đó vừa spam log vừa là công toi: mỗi cái tốn 1 pipeline sharp + 2 lần
 * `recognize` mà không bao giờ đọc ra được gì. Tham số này chỉ dập phần LOG; muốn khỏi tốn công thì
 * phải thu hẹp bảng threshold — quyết định đó thuộc phần OCR của từng provider.
 *
 * `/dev/null` ở đây là đường dẫn trong FS ẢO của WASM (emscripten MEMFS), KHÔNG phải của OS — nên trên
 * Windows vẫn đúng, không cần đổi sang `NUL`.
 *
 * Được spread sẵn khi init worker trong `captchaOcr.ts`, provider không phải nhớ tới nó nữa.
 */
export const TESSERACT_QUIET = { debug_file: "/dev/null" };

/**
 * Tạo debug logger cho 1 NCC — chỉ in khi biến môi trường `envVar` = "1". Mỗi bộ tải reverse-engineer
 * từ trang NCC đều cần một cái để chẩn đoán khi NCC đổi template/DTO, và trước giờ mỗi file tự chép
 * lại một bản y hệt.
 *
 * Payload không phải string thì `JSON.stringify`; dài quá `maxLen` thì cắt — HTML trang tra cứu hoặc
 * base64 file của NCC có thể hàng chục KB, log nguyên là ngập terminal.
 *
 * Đọc env LÚC GỌI chứ không lúc tạo logger: `server.ts` import `./app` TRƯỚC `./config/env` nên biến
 * từ `.env.local` chưa chắc đã có ở thời điểm module provider được nạp.
 */
export function makeDbg(prefix: string, envVar: string, maxLen = 2000) {
  return (label: string, payload: unknown | (() => unknown)): void => {
    if (process.env[envVar] !== "1") return;
    // Payload dạng HÀM chỉ được gọi SAU khi qua guard env. Cần thiết vì đối số thường được đánh giá
    // trước khi vào hàm: `dbg("x", htmlToText(html))` sẽ quét cả trang HTML vài chục KB ngay cả khi
    // debug đang tắt — mà đó lại là hot path (mỗi lượt captcha đọc sai đều đi qua).
    const value = typeof payload === "function" ? (payload as () => unknown)() : payload;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const trimmed =
      text && text.length > maxLen
        ? `${text.slice(0, maxLen)}… (+${text.length - maxLen} chars)`
        : text;
    // eslint-disable-next-line no-console
    console.log(`[${prefix}] ${label}:`, trimmed);
  };
}

/** Rút `filename` từ header Content-Disposition (vd `attachment; filename=abc.pdf`, có/không nháy). */
export function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return m ? decodeURIComponent(m[1].trim()) : "";
}

/**
 * Bước "mint token": POST form-urlencoded, parse JSON, rút token qua `pick`. Ném `UPSTREAM` nếu NCC
 * không phản hồi / trả lỗi / không có token. `pick` nhận JSON đã parse (unknown) và trả token | undefined.
 */
export async function mintTokenForm(opts: {
  url: string;
  body: string;
  headers?: Record<string, string>;
  pick: (json: unknown) => string | undefined;
  ten: string;
}): Promise<string> {
  const { url, body, headers = {}, pick, ten } = opts;
  const res = await fetchUpstream(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        accept: "application/json, text/javascript, */*; q=0.01",
        ...headers,
      },
      body,
    },
    ten,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${ten} từ chối cấp token (HTTP ${res.status})`);
  }
  const token = pick((await res.json().catch(() => null)) as unknown);
  if (!token) {
    throw new TraCuuGocError("UPSTREAM", `${ten} không trả token tải hóa đơn`);
  }
  return token;
}

/**
 * Đọc body PDF từ `Response` đã fetch xong. Tên file lấy từ Content-Disposition, thiếu thì `<code>.pdf`.
 *
 * BODY RỖNG (0 byte) nghĩa là gì thì TÙY NCC, nên `maDaXacThuc` quyết định:
 *  - `false` (mặc định — MISA, Viettel): mã tra cứu đi THẲNG vào URL tải, nên body rỗng = mã sai/hết
 *    hạn -> `INVALID_CODE` (422), thử lại vô ích.
 *  - `true` (VNPT, CyberLotus, EasyInvoice): trước bước này đã đổi được mã lấy một token/checkCode, tức
 *    mã CHẮC CHẮN ĐÚNG. Body rỗng lúc này chỉ có thể là token hết hạn vài giây hoặc cổng trục trặc ->
 *    `UPSTREAM` + `retryable` (502) để FE quét lại. Gán nhầm thành 422 ở đây thì FE bỏ hẳn hóa đơn với
 *    lý do "mã sai" hoàn toàn bịa — đúng lớp lỗi mà cả luồng này đang tránh.
 */
export async function pdfFromResponse(
  res: Response,
  code: string,
  ten: string,
  maDaXacThuc = false,
): Promise<FileHoaDonGoc> {
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw maDaXacThuc
      ? new TraCuuGocError("UPSTREAM", `${ten} trả file rỗng cho mã "${code}" — thử lại`, true)
      : new TraCuuGocError(
          "INVALID_CODE",
          `Không tìm thấy hóa đơn gốc ${ten} cho mã "${code}" (mã sai hoặc đã hết hạn tra cứu)`,
        );
  }
  const filename = filenameFromDisposition(res.headers.get("content-disposition")) || `${code}.pdf`;
  return { buffer, filename, contentType: "application/pdf" };
}


export function pdfTuGoi(file: FileHoaDonGoc, code: string, ten: string): FileHoaDonGoc {
  if (laPdf(file.buffer)) return file;

  const laZip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b; // "PK"
  if (!laZip) {
    throw new TraCuuGocError(
      "UPSTREAM",
      `${ten} trả file không phải ZIP/PDF cho mã "${code}" (token/mã hết hạn?)`,
    );
  }

  let pdf: { name: string; data: Buffer } | null;
  try {
    pdf = readZipEntryByExtension(file.buffer, ".pdf");
  } catch (err) {
    // Zip hỏng/định dạng lạ -> lỗi hạ tầng, không phải "mã tra cứu sai".
    throw new TraCuuGocError(
      "UPSTREAM",
      `${ten}: không giải nén được ZIP — ${describeErrorChain(err)}`,
    );
  }
  if (!pdf) {
    // Liệt kê tên file bên trong để chẩn đoán ngay, khỏi phải tự tải zip về mở tay.
    const trongGoi = listZipEntryNames(file.buffer).join(", ");
    throw new TraCuuGocError(
      "UPSTREAM",
      `${ten}: ZIP của mã "${code}" không chứa PDF nào (bên trong: ${trongGoi || "rỗng"})`,
    );
  }

  return {
    buffer: pdf.data,
    // Tên trong zip có thể kèm đường dẫn -> lấy phần cuối. FE tự đặt tên khác, đây chỉ là gợi ý.
    filename: pdf.name.split("/").pop() || `${code}.pdf`,
    contentType: "application/pdf",
  };
}

/**
 * Bước "tải file PDF bằng GET" (MISA): GET với header của NCC, non-ok -> `UPSTREAM`, còn lại giao cho
 * `pdfFromResponse`. `maDaXacThuc` xem docblock của hàm đó.
 */
export async function fetchFileGoc(opts: {
  url: string;
  headers: Record<string, string>;
  code: string;
  ten: string;
  maDaXacThuc?: boolean;
}): Promise<FileHoaDonGoc> {
  const { url, headers, code, ten, maDaXacThuc } = opts;
  const res = await fetchUpstream(url, { headers }, ten);
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${ten} trả lỗi khi tải file (HTTP ${res.status})`);
  }
  return pdfFromResponse(res, code, ten, maDaXacThuc);
}

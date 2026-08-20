import { randomUUID } from "crypto";
import { describeErrorChain } from "../../../config/gdt-client";
import { readZipEntryByExtension } from "../../../helpers/zip";
import { filenameFromDisposition } from "../hddt/traCuuGoc/shared";
import { docDvcCaptcha } from "./captcha-ocr";
import {
  laLoiCaptcha,
  parseBangHoSo,
  parseDanhSachThongBao,
  type BangHoSoDaBoc,
  type ThongBaoDaBoc,
} from "./hoSoHtml";

/**
 * Proxy cổng Dịch vụ công thuế (https://dichvucong.gdt.gov.vn/tthc).
 *
 * VÌ SAO PHẢI PROXY, KHÔNG ĐỂ FE GỌI THẲNG:
 *  1. Cổng không mở CORS cho origin khác.
 *  2. Phiên phải giữ xuyên suốt: `JSESSIONID` cổng set ở bước lấy captcha phải quay lại
 *     trong POST đăng nhập. Cookie đó `HttpOnly` + khác origin nên JS trình duyệt
 *     không đọc cũng không gửi kèm được.
 *  3. Token CSRF không nằm trong cookie mà trong `<meta name="csrf-token">` của trang
 *     login — phải tải trang HTML đó về mới moi ra được.
 *
 * BA BƯỚC CỦA MỘT LƯỢT ĐĂNG NHẬP (cả ba dùng CHUNG một phiên):
 *    GET  /tthc/login                  -> cookie phiên + token CSRF trong thẻ meta
 *    GET  /tthc/login/getCaptcha?<ts>  -> ảnh PNG 150x38
 *    POST /tthc/loginLDAP              -> form tenDN/matKhau/doiTuong/captcha
 *                                         kèm header X-XSRF-TOKEN
 *
 * Khác cổng Hóa đơn điện tử (`config/gdt-client.ts`): bên kia xác thực bằng cookie rồi
 * đổi sang bearer token, trả JSON và captcha là SVG. Bên này thuần cookie phiên +
 * CSRF của Spring Security, trả HTML/PNG. Đủ khác để không dùng chung tầng client.
 */

const DVC_BASE_URL = "https://dichvucong.gdt.gov.vn/tthc";

/** Luồng này chỉ đăng nhập doanh nghiệp — cổng còn đối tượng khác nhưng chưa dùng tới. */
const DVC_DOI_TUONG = "DN";

/** Timeout mỗi request — một socket treo không được chặn vô hạn. */
const DVC_TIMEOUT_MS = 30_000;

/** Phiên lấy captcha rồi bỏ dở (CHƯA đăng nhập) tự hết hạn sau ngần này. */
const SESSION_TTL_MS = 5 * 60 * 1000;

/**
 * Phiên ĐÃ đăng nhập — hạn dài hơn và còn được trượt lại mỗi lần dùng (xem `getSession`).
 *
 * Trước đây phiên nào cũng dùng `SESSION_TTL_MS` tính từ lúc lấy captcha và không chỗ nào gia
 * hạn: đăng nhập xong ngồi xem bảng quá 5 phút rồi bấm Tìm kiếm là đã phải đăng nhập lại, dù
 * cookie phiên bên cổng vẫn còn sống.
 */
const SESSION_DANG_NHAP_TTL_MS = 30 * 60 * 1000;

/** Cổng chặn tần suất khá gắt — gọi liên tiếp vài lần là dính `429 Too Many Requests`. */
const RATE_LIMITED_MESSAGE =
  "Cổng Dịch vụ công đang chặn do gọi quá nhanh. Vui lòng thử lại sau ít phút.";

const SESSION_EXPIRED_MESSAGE =
  "Phiên captcha đã hết hạn. Vui lòng lấy mã captcha mới rồi đăng nhập lại.";

/** Trình duyệt giả lập — cổng từ chối request không có UA thật. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

/** Lỗi do cổng DVC TRẢ VỀ (có HTTP status) — phân biệt với lỗi tầng fetch (mạng/timeout). */
export class DvcHttpError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string, detail: string) {
    super(`DVC API Error: ${status} ${statusText} ${detail}`.trim());
    this.name = "DvcHttpError";
    this.status = status;
  }
}

/**
 * Phiên trong RAM đã hết hạn hoặc không tồn tại — khác lỗi do cổng trả về (`DvcHttpError`).
 *
 * Có lớp riêng thay vì `new Error(SESSION_EXPIRED_MESSAGE)` để nơi khác nhận diện bằng
 * `instanceof` chứ không phải so chuỗi thông báo (xem `khongNenThuLai`). `message` giữ nguyên
 * nên `toUserMessage` và mọi caller cũ không đổi gì.
 */
export class DvcSessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = "DvcSessionExpiredError";
  }
}

interface DvcSession {
  /**
   * Cookie của phiên, khóa theo TÊN cookie -> chuỗi `ten=gia_tri`.
   *
   * Dùng Map thay vì mảng như `gdt-client.ts`: cổng này set cookie rải qua cả ba bước và
   * ĐỔI GIÁ TRỊ của cùng một tên (`TS01b15635`, `TS5d8132da027`… đổi sau mỗi lượt). Gộp
   * theo tên thì bước sau luôn gửi bản mới nhất; nối mảng thì gửi cả bản cũ lẫn mới và
   * cổng lấy nhầm bản cũ.
   */
  cookies: Map<string, string>;
  /** Token CSRF moi từ `<meta name="csrf-token">`, gửi lại ở header khi POST đăng nhập. */
  csrfToken: string;
  /** Tên header gửi token CSRF, đọc từ `<meta name="csrf-header">` (thường `X-XSRF-TOKEN`). */
  csrfHeader: string;
  /** Đã đăng nhập xong -> phiên đổi sang `SESSION_DANG_NHAP_TTL_MS` thay cho TTL captcha. */
  daDangNhap: boolean;
  /** Mốc hết hạn — TRƯỢT lại mỗi lần `getSession` chạm tới, xem hàm đó. */
  expiresAt: number;
}

/**
 * Kho phiên trong RAM, khóa là `key` trả về cho FE ở bước lấy captcha.
 *
 * Không share giữa process/instance, restart là mất — giống hệt cookie-jar của cổng HĐĐT.
 * Khi chạy nhiều instance thì phải chuyển sang Redis (TTL ~5 phút).
 */
const sessions = new Map<string, DvcSession>();

function sweepExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(key);
  }
}

/** Hạn áp cho phiên — tùy đã đăng nhập hay mới chỉ lấy captcha. */
function ttlCuaPhien(session: DvcSession): number {
  return session.daDangNhap ? SESSION_DANG_NHAP_TTL_MS : SESSION_TTL_MS;
}

/**
 * Lấy phiên còn hạn, `null` nếu không có hoặc đã quá hạn.
 *
 * TRƯỢT hạn mỗi lần chạm tới: hạn phải đếm từ lần DÙNG cuối chứ không phải từ lúc mở phiên —
 * đếm từ lúc mở thì đang thao tác liên tục phiên vẫn chết đúng lúc TTL trôi hết.
 */
function getSession(key: string): DvcSession | null {
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  session.expiresAt = Date.now() + ttlCuaPhien(session);
  return session;
}

/** Xóa phiên — gọi khi đăng nhập hỏng, để lần sau buộc lấy captcha mới. */
export function clearSession(key: string) {
  sessions.delete(key);
}

/**
 * `sweepExpiredSessions` + `getSession` + ném `DvcSessionExpiredError` nếu không còn — 3 dòng
 * lặp lại giống hệt nhau ở đầu mọi hàm cần phiên sống (captcha trang tra cứu, login, tra cứu hồ
 * sơ, tải file/tài liệu/thông báo...). Gộp một chỗ để đổi cách báo hết hạn chỉ phải sửa ở đây.
 */
function requireSession(key: string): DvcSession {
  sweepExpiredSessions();
  const session = getSession(key);
  if (!session) throw new DvcSessionExpiredError();
  return session;
}

/** Gộp `Set-Cookie` của response vào phiên (ghi đè theo tên, xem chú thích ở `DvcSession`). */
function mergeSetCookie(session: DvcSession, response: Response) {
  const setCookie =
    (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];

  for (const raw of setCookie) {
    const pair = raw.split(";")[0]?.trim();
    if (!pair) continue;
    const name = pair.split("=")[0];
    if (name) session.cookies.set(name, pair);
  }
}

function cookieHeader(session: DvcSession): string {
  return [...session.cookies.values()].join("; ");
}

/**
 * Gửi 1 request tới cổng DVC bằng cookie của `session`, thu `Set-Cookie` vào lại phiên,
 * và ném `DvcHttpError` nếu status không 2xx. Trả `Response` CHƯA đọc body.
 */
async function dvcSend(
  path: string,
  session: DvcSession,
  init: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Referer: `${DVC_BASE_URL}/login`,
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const cookies = cookieHeader(session);
  if (cookies) headers.Cookie = cookies;

  const shortPath = path.split("?")[0];
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(`${DVC_BASE_URL}${path}`, {
      ...init,
      headers,
      // Cổng trả 302 về trang login khi phiên hỏng — muốn thấy status thật, không đi theo.
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(DVC_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(
      `[DEBUG-DVC] ${shortPath} NÉM LỖI TẦNG FETCH sau ${Date.now() - startedAt}ms: ` +
        // Lỗi fetch của undici có `message` trơ ("terminated"/"fetch failed"), lý do thật
        // nằm trong chuỗi `cause` — in mỗi tầng ngoài thì log không nói lên điều gì.
        describeErrorChain(err),
    );
    throw err;
  }

  // Thu cookie TRƯỚC khi xét lỗi: cả response lỗi cũng có thể xoay vòng cookie chống bot.
  mergeSetCookie(session, response);

  if (!response.ok) {
    console.warn(
      `[DEBUG-DVC] ${shortPath} -> ${response.status} ${response.statusText} ` +
        `(${Date.now() - startedAt}ms) <- LỖI DO CỔNG DVC TRẢ VỀ, không phải BE của mình`,
    );
    // Chỉ giữ phần đầu: body lỗi của cổng có khi là nguyên trang HTML, mà `toUserMessage`
    // không đọc tới `message` — phần dư chỉ đi kèm Error khắp stack rồi vào log.
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new DvcHttpError(response.status, response.statusText, detail);
  }

  return response;
}

const CSRF_TOKEN_RE = /<meta\s+name="csrf-token"\s+content="([^"]+)"/i;
const CSRF_HEADER_RE = /<meta\s+name="csrf-header"\s+content="([^"]+)"/i;

/**
 * Bước 1: mở phiên mới — tải trang login để lấy cookie phiên và token CSRF.
 *
 * Token CSRF nằm trong thẻ meta của HTML chứ không phải cookie `XSRF-TOKEN` (hai giá trị
 * đó KHÁC nhau: cookie là UUID, token là chuỗi base64 dài). Gửi nhầm giá trị cookie lên
 * header thì cổng từ chối POST đăng nhập.
 */
async function openSession(): Promise<{ key: string; session: DvcSession }> {
  sweepExpiredSessions();

  const session: DvcSession = {
    cookies: new Map(),
    csrfToken: "",
    csrfHeader: "X-XSRF-TOKEN",
    daDangNhap: false,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  const response = await dvcSend("/login", session, {
    headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  // Hai thẻ meta luôn nằm trong <head> — quét mỗi phần đó thay vì cả trang vài trăm KB.
  const html = await response.text();
  const head = html.slice(0, html.indexOf("</head>") + 1 || 8192);

  const token = head.match(CSRF_TOKEN_RE)?.[1];
  if (!token) {
    // Cổng đổi trang login -> không moi được token. Báo rõ thay vì để POST hỏng khó hiểu.
    throw new Error(
      "Không đọc được token CSRF của cổng Dịch vụ công (trang đăng nhập có thể đã đổi).",
    );
  }
  session.csrfToken = token;
  session.csrfHeader = head.match(CSRF_HEADER_RE)?.[1] || session.csrfHeader;

  const key = randomUUID();
  sessions.set(key, session);
  return { key, session };
}

export interface DvcCaptchaResult {
  /** Khóa phiên — FE giữ rồi gửi lại khi đăng nhập. Tương đương `captcha.key` bên HĐĐT. */
  key: string;
  /** Ảnh captcha dạng data-URL (`data:image/png;base64,...`) để gắn thẳng vào `<img src>`. */
  image: string;
  /** Chuỗi captcha được giải tự động (nếu đọc thành công). */
  answer?: string | null;
}

/**
 * GET một ảnh captcha, giải OCR ngầm, đóng gói thành `DvcCaptchaResult`. Dùng chung cho bước 2
 * (`getCaptcha`, mở phiên mới) và captcha trang tra cứu hồ sơ (`getTchsCaptcha`, phiên đã có) —
 * khác nhau đúng path + header `Referer`, còn lại đọc response giống hệt nhau.
 *
 * Trả data-URL thay vì bytes thô: FE chỉ cần gắn vào `<img src>`, khỏi phải quản blob URL
 * và khỏi thêm một endpoint nhị phân riêng. Ảnh 150x38 nên base64 chỉ ~5KB.
 */
async function fetchCaptchaImage(
  path: string,
  key: string,
  session: DvcSession,
  extraHeaders?: Record<string, string>,
): Promise<DvcCaptchaResult> {
  const response = await dvcSend(path, session, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      ...extraHeaders,
    },
  });

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const answer = await docDvcCaptcha(bytes);

  return {
    key,
    image: `data:${contentType};base64,${bytes.toString("base64")}`,
    answer,
  };
}

/**
 * Bước 2: lấy ảnh captcha của một phiên mới.
 *
 * Tham số `?<timestamp>` là để phá cache, giữ đúng như trình duyệt thật gửi.
 */
export async function getCaptcha(): Promise<DvcCaptchaResult> {
  const { key, session } = await openSession();
  return fetchCaptchaImage(`/login/getCaptcha?${Date.now()}`, key, session);
}

/**
 * Lấy ảnh và tự động giải OCR captcha của trang Tra cứu hồ sơ (`/tthc/getCaptcha`).
 *
 * Dùng cho các lượt tra cứu hồ sơ sau khi đã mở phiên / đăng nhập.
 * Gửi header `Referer: https://dichvucong.gdt.gov.vn/tthc/tchs` đúng như trình duyệt thật.
 */
export async function getTchsCaptcha(key: string): Promise<DvcCaptchaResult> {
  const session = requireSession(key);
  return fetchCaptchaImage(`/getCaptcha?${Date.now()}`, key, session, {
    Referer: `${DVC_BASE_URL}/tchs`,
  });
}

export interface DvcLoginRequest {
  /** Khóa phiên nhận từ `getCaptcha`. */
  key: string;
  /** Tên đăng nhập cổng DVC — thường dạng `<MST>-ql`. */
  tenDN: string;
  /** Mật khẩu THÔ. Service tự mã hóa base64 theo đúng dạng cổng nhận. */
  matKhau: string;
  captcha: string;
}

export interface DvcLoginResult {
  /** Khóa phiên — GIỮ NGUYÊN sau khi đăng nhập, các API tra cứu sau dùng lại nó. */
  key: string;
  /** Body cổng trả về, đã parse JSON nếu parse được; không thì là chuỗi thô. */
  data: unknown;
}

/**
 * Bước 3: đăng nhập bằng phiên đã lấy captcha.
 *
 * `matKhau` gửi lên cổng dưới dạng base64 — đó là ĐỊNH DẠNG cổng quy định, KHÔNG phải mã
 * hóa: ai bắt được gói tin đều giải ngược được. Mã hóa base64 ở đây thay vì để FE làm, để
 * mọi thứ thuộc về giao thức của cổng nằm gọn trong tầng adapter này.
 *
 * Phiên KHÔNG đổi khóa sau khi đăng nhập (khác cổng HĐĐT re-key sang bearer token): cổng
 * DVC xác thực bằng chính cookie phiên đó, nên `key` cũ vẫn là thứ định danh phiên đã
 * đăng nhập cho các lượt tra cứu sau.
 *
 * CHƯA CHỐT: dạng body khi đăng nhập ĐÚNG và khi SAI captcha/mật khẩu. Cổng trả 200 cho cả
 * hai (Spring hay trả JSON `{...}` kèm cờ lỗi), nên hàm này forward nguyên body cho caller
 * tự quyết thay vì đoán bừa một trường `success`. Có một lượt đăng nhập thật để đối chiếu
 * là siết lại được ngay tại đây.
 */
export async function login(body: DvcLoginRequest): Promise<DvcLoginResult> {
  const session = requireSession(body.key);

  const form = new URLSearchParams({
    tenDN: body.tenDN,
    matKhau: Buffer.from(body.matKhau, "utf8").toString("base64"),
    doiTuong: DVC_DOI_TUONG,
    captcha: body.captcha,
  });

  let raw: string;
  try {
    const response = await dvcSend("/loginLDAP", session, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://dichvucong.gdt.gov.vn",
        [session.csrfHeader]: session.csrfToken,
      },
      body: form.toString(),
    });
    raw = await response.text();
  } catch (err) {
    // Captcha đã bị tiêu ở lượt hỏng này -> phiên vô dụng, buộc lấy mã mới.
    // Giữ nguyên `DvcHttpError` (còn `status`) — việc đổi thành câu tiếng Việt dồn hết
    // về `toUserMessage`, ném lại `Error` trơn ở đây là vứt mất status.
    clearSession(body.key);
    throw err;
  }

  let data: unknown = raw;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    // Không phải JSON (cổng trả HTML/chuỗi trơ) — giữ nguyên chuỗi cho caller đọc.
  }

  // Kiểm tra nếu cổng trả về trạng thái lỗi trong JSON
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (
      obj.status === "FAIL" ||
      obj.status === "ERROR" ||
      obj.success === false ||
      (typeof obj.code === "number" && obj.code !== 0 && obj.code !== 200)
    ) {
      clearSession(body.key);
      const msg = typeof obj.message === "string" && obj.message.trim() ? obj.message.trim() : null;
      throw new Error(msg || "Đăng nhập cổng Dịch vụ công không thành công (thông tin không chính xác).");
    }
  }

  // Kiểm tra nếu cổng trả về chuỗi thông báo lỗi
  if (typeof data === "string") {
    if (data.includes("Sai tên đăng nhập") || data.includes("Mật khẩu không đúng") || laLoiCaptcha(data)) {
      clearSession(body.key);
      throw new Error(
        data.length < 200
          ? data.trim()
          : "Đăng nhập cổng Dịch vụ công thất bại do thông tin không chính xác.",
      );
    }
  }

  // Qua hết các nhánh chê ở trên -> coi như đã đăng nhập. Đổi phiên sang TTL dài ngay tại đây,
  // các lượt tra cứu sau tự trượt hạn tiếp qua `getSession`.
  //
  // Lưu ý: "coi như" đúng nghĩa đen — dạng body khi đăng nhập ĐÚNG vẫn chưa chốt (xem doc của
  // hàm này), nên phiên sai cũng được kéo dài hạn. Không hại: nó chỉ nằm trong RAM tới khi hết
  // hạn, còn cổng vẫn từ chối mọi request của phiên chưa xác thực.
  session.daDangNhap = true;
  session.expiresAt = Date.now() + ttlCuaPhien(session);

  return { key: body.key, data };
}

/** Đổi lỗi bất kỳ thành câu tiếng Việt hiển thị được. Dùng: controller. */
export function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof DvcHttpError && err.status === 429) return RATE_LIMITED_MESSAGE;
  if (err instanceof DvcHttpError && err.status === 302) {
    return "Phiên đăng nhập Dịch vụ công đã hết hạn hoặc chưa đăng nhập thành công. Vui lòng đăng nhập lại.";
  }
  if (err instanceof DvcHttpError && err.status === 401) {
    return "Tài khoản hoặc mật khẩu Dịch vụ công không chính xác.";
  }
  if (err instanceof DvcHttpError) return fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}

/** `yyyy-mm-dd` (input type=date của FE) -> `dd/MM/yyyy` (dạng cổng DVC nhận). */
function toDvcDate(isoDate?: string): string {
  if (!isoDate || !isoDate.includes("-")) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export interface DvcTraCuuHoSoQuery {
  /** Khóa phiên ĐÃ ĐĂNG NHẬP. */
  key: string;
  /** `yyyy-mm-dd`; service tự đổi sang dạng cổng nhận. */
  tuNgay?: string;
  denNgay?: string;
  /** Mã captcha tra cứu. Nếu bỏ trống, service sẽ tự động lấy và giải OCR ngầm. */
  captcha?: string;
  maNghiepVu?: string;
  maTTHC?: string;
  maToKhai?: string;
  maHoSo?: string;
  /** `SELF` = hồ sơ của chính đơn vị. Cổng còn giá trị khác cho luồng ủy quyền. */
  scope?: string;
  mstUyQuyen?: string;
}

async function guiTraCuuHoSo(
  session: DvcSession,
  q: DvcTraCuuHoSoQuery,
  captcha: string,
): Promise<string> {
  const params = new URLSearchParams({
    maNghiepVu: q.maNghiepVu ?? "",
    maTTHC: q.maTTHC ?? "",
    maToKhai: q.maToKhai ?? "",
    maHoSo: q.maHoSo ?? "",
    tuNgay: toDvcDate(q.tuNgay),
    denNgay: toDvcDate(q.denNgay),
    scope_tdt1: q.scope ?? "SELF",
    mstUyQuyen_tdt1: q.mstUyQuyen ?? "",
    captcha,
  });

  const response = await dvcSend(`/ho-so/search?${params.toString()}`, session, {
    headers: {
      Accept: "text/html-partial",
      Referer: `${DVC_BASE_URL}/tchs`,
      "HX-Request": "true",
      "HX-Current-URL": `${DVC_BASE_URL}/tchs`,
      "HX-Target": "table-container",
      "HX-Trigger": "form-search-advanced",
    },
  });

  return response.text();
}

/** Số lần thử tự giải captcha trang tra cứu trước khi chịu thua. */
const SO_LAN_THU_CAPTCHA = 3;

/**
 * Lỗi mà thử lại chắc chắn vô ích — bỏ vòng lặp ngay thay vì đốt thêm lượt gọi cổng:
 *  - `429`: đang bị chặn tần suất, gọi tiếp chỉ làm bị chặn lâu hơn (đúng thứ `RATE_LIMITED_MESSAGE`
 *    dặn người dùng chờ), mà mỗi lần thử lại là THÊM 2 request (lấy captcha + tra cứu).
 *  - `302`/`401`: cổng đá về trang đăng nhập / từ chối xác thực = phiên bên cổng đã chết, lượt
 *    sau vẫn dùng đúng cookie đó nên kết quả không thể khác.
 *  - `DvcSessionExpiredError`: phiên trong RAM hết hạn, thử lại vẫn không có phiên.
 *
 * Còn lại (OCR đọc sai mã, timeout, mạng chập chờn) mới đáng thử lại.
 */
function khongNenThuLai(err: unknown): boolean {
  if (err instanceof DvcSessionExpiredError) return true;
  if (err instanceof DvcHttpError) {
    return err.status === 429 || err.status === 302 || err.status === 401;
  }
  return false;
}

/**
 * Chạy lượt tra cứu, trả HTML thô. Tự động chạy ngầm: Nếu `q.captcha` không được truyền lên,
 * hàm sẽ tự động lấy captcha từ `/tthc/getCaptcha`, giải mã OCR qua `docDvcCaptcha` và gửi tra
 * cứu, thử lại tối đa `SO_LAN_THU_CAPTCHA` lần nếu đọc sai mã.
 *
 * Hết số lần thử là NÉM LỖI, không trả HTML báo sai mã ra ngoài. Gặp lỗi thuộc nhóm
 * `khongNenThuLai` thì ném ra ngay, không dùng hết số lần thử.
 */
async function traCuuHoSoHtml(q: DvcTraCuuHoSoQuery): Promise<string> {
  const session = requireSession(q.key);

  if (q.captcha) {
    return guiTraCuuHoSo(session, q, q.captcha);
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= SO_LAN_THU_CAPTCHA; attempt++) {
    try {
      const cap = await getTchsCaptcha(q.key);
      if (!cap.answer) {
        throw new Error("Không thể tự động giải mã captcha trang tra cứu hồ sơ.");
      }

      const html = await guiTraCuuHoSo(session, q, cap.answer);
      // Cổng trả 200 kèm mảnh HTML báo sai mã — vẫn là hỏng, phải thử lại. Ném lỗi thay vì
      // `continue` rồi rơi xuống `return html` như trước: mảnh đó qua `parseBangHoSo` ra bảng
      // rỗng, người dùng đọc thành "không tìm thấy hồ sơ nào" trong khi thật ra chưa tra được.
      if (laLoiCaptcha(html)) {
        throw new Error("Mã captcha trang tra cứu hồ sơ không đúng.");
      }
      return html;
    } catch (err) {
      lastError = err;
      if (khongNenThuLai(err)) throw err;
    }
  }

  // Tới đây là đã thử đủ số lần mà lần nào cũng hỏng — `lastError` luôn có giá trị, nhánh
  // `new Error` chỉ để TypeScript yên tâm là hàm không rơi xuống `undefined`.
  throw lastError instanceof Error
    ? lastError
    : new Error("Tra cứu hồ sơ thất bại do không giải được mã captcha hợp lệ.");
}

/**
 * Tra cứu hồ sơ đã nộp (`GET /tthc/ho-so/search`), trả bảng ĐÃ BÓC sẵn — khớp cách
 * `taiXmlHoSo`/`layTaiLieuDinhKem` trả dữ liệu đã xử lý, controller không còn phải biết tới
 * `parseBangHoSo`/hình dạng HTML của cổng nữa.
 */
export async function traCuuHoSo(q: DvcTraCuuHoSoQuery): Promise<BangHoSoDaBoc> {
  return parseBangHoSo(await traCuuHoSoHtml(q));
}

/** Referer XHR của trang chi tiết hồ sơ — cả `downloadhoso` lẫn `data-tai-lieu-dkem` đều gọi từ đây. */
function chiTietHoSoUrl(maHoSo: string): string {
  return `${DVC_BASE_URL}/tchs/files/detail/${encodeURIComponent(maHoSo)}?loai=`;
}

export interface DvcTepTaiVe {
  bytes: Buffer;
  contentType: string;
  fileName: string;
}

interface DvcBocTep {
  fileName?: string;
  fileType?: string;
  /** Nội dung file, mã hóa base64. */
  content?: string;
}

/**
 * `downloadhoso` không trả bytes thô mà bọc trong JSON `{fileName, fileType, content}` với
 * `content` là base64 — dò bằng cách THỬ parse JSON (không tin content-type cổng gửi) thay vì
 * giả định luôn là bytes thô. Không phải dạng này (JSON không có `content` string, hoặc parse
 * lỗi) thì trả `null` để caller dùng thẳng `bodyBytes`.
 */
function docGoiTepJson(bodyBytes: Buffer): DvcBocTep | null {
  try {
    const parsed: unknown = JSON.parse(bodyBytes.toString("utf8"));
    if (parsed && typeof parsed === "object" && typeof (parsed as DvcBocTep).content === "string") {
      return parsed as DvcBocTep;
    }
  } catch {
    // Không phải JSON -> đúng là bytes thô, không phải lỗi.
  }
  return null;
}

/**
 * Đọc một `Response` tải file của cổng thành `DvcTepTaiVe` — dùng chung cho `taiXmlHoSo` và
 * `taiThongBao`: cả hai endpoint (`downloadhoso`/`downloadthongbao`) cùng dạng response
 * JSON-bọc-base64 (`docGoiTepJson`) hoặc bytes thô kèm header content-type/content-disposition,
 * chỉ khác đuôi/tên file mặc định khi cổng không gửi header.
 */
async function docTepTuResponse(
  response: Response,
  tenFileMacDinh: string,
  contentTypeMacDinh = "application/octet-stream",
): Promise<DvcTepTaiVe> {
  const bodyBytes = Buffer.from(await response.arrayBuffer());
  let bytes: Buffer = bodyBytes;
  let contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || contentTypeMacDinh;
  const tenTuHeader = filenameFromDisposition(response.headers.get("content-disposition"));
  let fileName = tenTuHeader || tenFileMacDinh;

  const goiTep = docGoiTepJson(bodyBytes);
  if (goiTep?.content) {
    bytes = Buffer.from(goiTep.content, "base64");
    contentType = goiTep.fileType || contentType;
    fileName = goiTep.fileName || fileName;
  }

  return { bytes, contentType, fileName };
}

/**
 * Tải file XML của một hồ sơ (`POST /tthc/tchs/downloadhoso`) — cột "Tải file".
 *
 * KHÔNG phải trang `/tchs/files/detail/{maHoSo}` (đó là trang xem chi tiết, trả HTML) — đây
 * mới là request XHR thật sự trả file, trang kia gọi nó khi người dùng bấm nút tải trên đó.
 */
export async function taiXmlHoSo(key: string, maHoSo: string): Promise<DvcTepTaiVe> {
  const session = requireSession(key);

  const response = await dvcSend("/tchs/downloadhoso", session, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: chiTietHoSoUrl(maHoSo),
      [session.csrfHeader]: session.csrfToken,
    },
    body: JSON.stringify({ maHoSo }),
  });

  const tep = await docTepTuResponse(response, `${maHoSo}.xml`);

  // Cổng nén sẵn tờ khai vào ZIP — bóc ra để trả thẳng XML, người dùng khỏi tự giải nén.
  // `readZipEntryByExtension` ném lỗi nếu `bytes` không phải ZIP hợp lệ — bắt lại vì không phải
  // lúc nào response cũng là ZIP (header/`fileType` cổng gửi không đáng tin hoàn toàn).
  try {
    const xml = readZipEntryByExtension(tep.bytes, ".xml");
    if (xml) {
      return {
        bytes: xml.data,
        contentType: "application/xml",
        fileName: xml.name.split("/").pop() || tep.fileName,
      };
    }
  } catch {
    // Không phải ZIP hợp lệ -> dùng nguyên `tep` đã có.
  }

  return tep;
}

/**
 * Danh sách tài liệu đính kèm của một hồ sơ (`POST /tthc/tchs/data-tai-lieu-dkem`) — cột
 * "Tệp đính kèm".
 *
 * Body dùng đúng khóa `maHso` (KHÔNG phải `maHoSo` như `downloadhoso`) — hai endpoint của
 * cổng đặt tên tham số khác nhau, giữ nguyên chứ không "sửa lỗi chính tả" kẻo cổng không
 * nhận ra tham số và trả rỗng/lỗi.
 *
 * Trả JSON THÔ: hình dạng thật của cổng chưa xác nhận (chưa có mẫu response), nên để nguyên
 * cho caller tự đọc thay vì đoán và ép kiểu sai — xem `TaiLieuDinhKemDialog` bên FE.
 */
export async function layTaiLieuDinhKem(key: string, maHoSo: string): Promise<unknown> {
  const session = requireSession(key);

  const response = await dvcSend("/tchs/data-tai-lieu-dkem", session, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: chiTietHoSoUrl(maHoSo),
      [session.csrfHeader]: session.csrfToken,
    },
    body: JSON.stringify({ maHso: maHoSo }),
  });

  return response.json();
}

/**
 * Tải file của một thông báo (`POST /tthc/tchs/downloadthongbao`) — cột "Thông báo", tham số
 * `idTbao` lấy từ dòng đang bấm trong danh sách thông báo (xem `layChiTietHoSoHtml`).
 *
 * `loaiTBao` cổng đòi trong body nhưng luôn rỗng ở hai request thật đã đối chiếu (danh sách
 * thông báo bóc được — `ThongBaoDaBoc` — không có trường này để truyền lên) nên hardcode thay
 * vì nhận tham số không ai từng truyền giá trị khác rỗng.
 */
export async function taiThongBao(key: string, maHoSo: string, idTbao: string): Promise<DvcTepTaiVe> {
  const session = requireSession(key);

  const response = await dvcSend("/tchs/downloadthongbao", session, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: chiTietHoSoUrl(maHoSo),
      [session.csrfHeader]: session.csrfToken,
    },
    // `idTbao` dài tới 17 chữ số, VƯỢT `Number.MAX_SAFE_INTEGER` (2^53 ~ 16 chữ số) — từng ép
    // `Number(idTbao)` ở đây và làm tròn sai chữ số cuối (vd ...687 -> ...688) khiến cổng nhận
    // nhầm ID và báo "Tải file thất bại." (đối chiếu request thật của cổng: chấp nhận idTbao
    // dạng CHUỖI). Gửi thẳng chuỗi, không ép số, để giữ nguyên từng chữ số.
    body: JSON.stringify({ idTbao, loaiTBao: "" }),
  });

  return docTepTuResponse(response, `thong-bao-${idTbao}.xml`, "application/xml");
}

/**
 * Trang chi tiết hồ sơ (`GET /tchs/files/detail/{maHoSo}`) — chứa "Danh sách thông báo" dưới
 * dạng HTML. Cổng vốn chỉ dùng URL này làm Referer cho `taiXmlHoSo`/`layTaiLieuDinhKem`/
 * `taiThongBao` (`chiTietHoSoUrl`) — hàm này lần đầu THỰC SỰ tải trang đó về.
 */
async function layChiTietHoSoHtml(key: string, maHoSo: string): Promise<string> {
  const session = requireSession(key);

  const response = await dvcSend(
    `/tchs/files/detail/${encodeURIComponent(maHoSo)}?loai=`,
    session,
    {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        Referer: `${DVC_BASE_URL}/tchs`,
      },
    },
  );

  return response.text();
}

/**
 * Danh sách thông báo của một hồ sơ (bóc từ modal `#modalThongBao` trong trang chi tiết hồ sơ,
 * xem `parseDanhSachThongBao`) — cột "Thông báo".
 */
export async function layDanhSachThongBao(key: string, maHoSo: string): Promise<ThongBaoDaBoc[]> {
  return parseDanhSachThongBao(await layChiTietHoSoHtml(key, maHoSo));
}

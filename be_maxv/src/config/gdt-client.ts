const GDT_BASE_URL = "https://hoadondientu.gdt.gov.vn/api";

/** Timeout mặc định mỗi request GDT — 1 socket treo không được chặn vô hạn (pacer concurrency=1). */
const GDT_TIMEOUT_MS = 30_000;

/**
 * Timeout riêng cho call DANH SÁCH hóa đơn (`/query|/sco-query .../purchase|sold`).
 *
 * Nhánh `sco-query` (hóa đơn máy tính tiền) của GDT hay "nuốt" request: không trả gì cho tới khi hết
 * timeout. Đo thực tế: call THÀNH CÔNG luôn dưới ~1.1s, còn call bị nuốt thì treo tới hết timeout.
 * Vậy chờ lâu là đốt thời gian vô ích — cắt sớm rồi retry (pacer sẽ giãn nhịp) nhanh hơn hẳn mà
 * không bỏ sót trang nào: cursor giữ nguyên nên trang đó được lấy lại y hệt.
 *
 * 30s -> 12s -> 3s. Với mốc đo 1.1s thì 3s còn dư ~2,7 lần biên (đủ cho cả bắt tay TLS của call đầu
 * lượt). Mỗi lần bị nuốt giờ tốn 3s thay vì 12s, trong khi phần lãng phí này vốn chiếm gấp 2-3 lần
 * phần chạy có ích của cả pha danh sách.
 *
 * NẾU NỚI LẠI: dấu hiệu đặt quá ngắn là số dòng `[DEBUG-LIST] ... lỗi TẠM THỜI` tăng vọt kèm
 * `[DEBUG-GDT] ... NÉM LỖI TẦNG FETCH sau ~3000ms` — nghĩa là call hợp lệ đang bị mình cắt oan, và
 * mỗi lần cắt oan lại gọi `reportRateLimited` làm nhịp làn list ×2. Lúc đó nâng dần lên 5-6s.
 *
 * Riêng tải CHI TIẾT vẫn dùng `GDT_TIMEOUT_MS` (payload nặng hơn, không có hiện tượng bị nuốt).
 */
export const GDT_LIST_TIMEOUT_MS = 3_000;

/**
 * Lỗi do GDT TRẢ VỀ (có HTTP status), phân biệt với lỗi tầng fetch (mạng/timeout/abort — không có
 * status). Giữ nguyên định dạng `message` cũ để mọi chỗ đang log/hiển thị không đổi hành vi, nhưng
 * bổ sung `status` + `elapsedMs` dưới dạng field để `classifyGdtError` khỏi phải dò chuỗi.
 *
 * `elapsedMs` là thứ phân biệt được hai loại 500 rất khác nhau của GDT — xem `classifyGdtError`.
 */
export class GdtHttpError extends Error {
  readonly status: number;
  /** Thời gian từ lúc gửi request tới lúc nhận đủ status (ms). */
  readonly elapsedMs: number;

  constructor(status: number, statusText: string, detail: string, elapsedMs: number) {
    super(`GDT API Error: ${status} ${statusText} ${detail}`.trim());
    this.name = "GdtHttpError";
    this.status = status;
    this.elapsedMs = elapsedMs;
  }
}

/** Số tầng `cause` tối đa chịu lần — đủ sâu cho undici (2 tầng), có trần phòng cause vòng lặp. */
const MAX_CAUSE_DEPTH = 5;

/**
 * Mô tả lỗi kèm TOÀN BỘ chuỗi `cause` (`name: message (CODE)` nối bằng ` <- `). Lỗi fetch của Node
 * (undici) thường có `message` trơ như `"terminated"`, lý do thật nằm ở `cause` (vd
 * `SocketError: other side closed`, `UND_ERR_SOCKET`) — chỉ đọc tầng ngoài thì vừa không hiểu log,
 * vừa phân loại nhầm một lỗi mạng hiển nhiên thành "permanent".
 *
 * Dùng cho CẢ HAI việc: in log (ở đây) và dò chuỗi để phân loại lỗi (`classifyGdtError`,
 * `isBodyTerminated` ở gdt.service.ts) — cùng một cách đọc lỗi thì hai bên không thể lệch nhau.
 */
export function describeErrorChain(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;

  for (let depth = 0; cur instanceof Error && depth < MAX_CAUSE_DEPTH; depth += 1) {
    const code = (cur as { code?: unknown }).code;
    parts.push(`${cur.name}: ${cur.message}${typeof code === "string" ? ` (${code})` : ""}`);
    cur = (cur as { cause?: unknown }).cause;
  }

  return parts.length > 0 ? parts.join(" <- ") : String(err);
}

/**
 * Bật log từng call GDT thành công (`DEBUG_GDT=1`). Mặc định TẮT: một lượt vài chục nghìn hóa đơn
 * sinh ngần ấy dòng log cho thứ đã có tiến độ theo trang ở tầng service. Lỗi thì luôn log.
 */
const DEBUG_GDT = process.env.DEBUG_GDT === "1";

/** Phiên bỏ dở (lấy captcha nhưng không login) tự hết hạn sau ngần này. */
const COOKIE_TTL_MS = 5 * 60 * 1000;

/**
 * Cookie-jar tạm thời, keyed theo captcha `key` (sau login re-key sang token).
 *
 * Cookie session do /captcha set phải được gửi kèm khi gọi
 * /security-taxpayer/authenticate thì GDT mới nhận diện được session
 * (tương đương 1 RestfulClient dùng chung CookieContainer ở bản C# gốc).
 *
 * Lưu ý: Map trong RAM — không share giữa các process/instance,
 * restart sẽ mất. Khi multi-tenant scale, chuyển sang Redis (TTL ~5p).
 */
const cookieJar = new Map<string, { cookies: string[]; expiresAt: number }>();

/** Dọn các entry đã hết hạn (phiên lấy captcha rồi bỏ dở, không login). */
function sweepExpiredCookies() {
  const now = Date.now();
  for (const [key, entry] of cookieJar) {
    if (entry.expiresAt <= now) cookieJar.delete(key);
  }
}

export function saveCookies(key: string, cookies: string[]) {
  if (!cookies.length) return;
  sweepExpiredCookies();
  cookieJar.set(key, { cookies, expiresAt: Date.now() + COOKIE_TTL_MS });
}

export function getCookies(key: string): string[] | undefined {
  return cookieJar.get(key)?.cookies;
}

export function clearCookies(key: string) {
  cookieJar.delete(key);
}

/** Chuyển cookie từ `from` sang `to` (dùng khi captcha.key/login token thay thế key tạm). */
export function renameCookies(from: string, to: string) {
  const entry = cookieJar.get(from);
  cookieJar.delete(from);
  if (entry?.cookies.length) cookieJar.set(to, entry);
}

type GdtFetchInit = RequestInit & {
  /** Khóa trong cookie-jar để gửi/lưu cookie cho request này */
  cookieKey?: string;
  /** Có thu thập Set-Cookie từ response vào jar không */
  captureCookies?: boolean;
  /**
   * Token đăng nhập GDT, gửi dưới dạng `Authorization: Bearer <token>`.
   * Các API tra cứu (query/invoices/...) xác thực bằng header này,
   * khác với /captcha và /security-taxpayer/authenticate (xác thực qua cookie).
   */
  bearerToken?: string;
};

export async function gdtFetch<T>(
  path: string,
  init?: GdtFetchInit
): Promise<T> {
  const { cookieKey, captureCookies, bearerToken, ...rest } = init ?? {};

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  // gửi lại cookie session (nếu có) cho request này
  if (cookieKey) {
    const cookies = getCookies(cookieKey);
    if (cookies?.length) {
      headers.Cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    }
  }

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  if (rest.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const startedAt = Date.now();
  const shortPath = path.split("?")[0];

  let response: Response;
  try {
    response = await fetch(`${GDT_BASE_URL}${path}`, {
      ...rest,
      headers,
      // Tôn trọng signal caller truyền; nếu không có -> timeout mặc định để tránh treo vô hạn.
      signal: rest.signal ?? AbortSignal.timeout(GDT_TIMEOUT_MS),
    });
  } catch (err) {
    // Lỗi tầng fetch (mạng/timeout/abort) LUÔN log: hiếm, và là thứ phân biệt "GDT nuốt call" với
    // "GDT trả lỗi" — engine ở trên chỉ thấy exception đã bị phân loại lại.
    console.error(
      `[DEBUG-GDT] ${shortPath} NÉM LỖI TẦNG FETCH sau ${Date.now() - startedAt}ms (mạng/timeout/abort):`,
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    throw err;
  }

  const elapsed = Date.now() - startedAt;
  if (!response.ok) {
    // Lỗi do GDT trả về: luôn log, số lượng ít và đây là bằng chứng "không phải BE/proxy mình lỗi".
    console.warn(
      `[DEBUG-GDT] ${shortPath} -> ${response.status} ${response.statusText} (${elapsed}ms) ` +
        `<- LỖI NÀY DO GDT TRẢ VỀ, không phải BE/proxy của mình`,
    );
  } else if (DEBUG_GDT) {
    // Call THÀNH CÔNG chỉ log khi bật cờ: lượt 60k hóa đơn sinh 60k dòng, mà `console.log` trên
    // Windows ghi ĐỒNG BỘ (chặn event loop từng lần). Tiến độ từng trang đã có [DEBUG-CAPNHAT]/
    // [DEBUG-SYNC] ở tầng service; dòng này chỉ cần khi soi từng call một.
    console.log(`[DEBUG-GDT] ${shortPath} -> ${response.status} (${elapsed}ms)`);
  }

  if (captureCookies && cookieKey) {
    const setCookie =
      (response.headers as Headers & { getSetCookie?: () => string[] })
        .getSetCookie?.() ?? [];
    saveCookies(cookieKey, setCookie);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GdtHttpError(response.status, response.statusText, detail, elapsed);
  }

  try {
    return (await response.json()) as T;
  } catch (err) {
    // Header đã về 200 nhưng ĐỌC BODY hỏng — GDT đóng socket giữa chừng, hoặc body không phải JSON.
    // Phải log riêng: trước đây `response.json()` nằm ngoài mọi try/catch nên lỗi này KHÔNG sinh ra
    // dòng log nào, chỉ hiện ở tầng service dưới dạng chuỗi trơ "terminated" — không đủ để biết vì sao.
    // In cả chuỗi `cause` vì undici giấu lý do thật ở đó (vd SocketError: other side closed).
    console.error(
      `[DEBUG-GDT] ${shortPath} -> ${response.status} nhưng ĐỌC BODY HỎNG sau ` +
        `${Date.now() - startedAt}ms: ${describeErrorChain(err)}`,
    );
    throw err;
  }
}

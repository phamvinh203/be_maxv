const GDT_BASE_URL = "https://hoadondientu.gdt.gov.vn/api";

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
};

export async function gdtFetch<T>(
  path: string,
  init?: GdtFetchInit
): Promise<T> {
  const { cookieKey, captureCookies, ...rest } = init ?? {};

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

  if (rest.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${GDT_BASE_URL}${path}`, { ...rest, headers });

  if (captureCookies && cookieKey) {
    const setCookie =
      (response.headers as Headers & { getSetCookie?: () => string[] })
        .getSetCookie?.() ?? [];
    saveCookies(cookieKey, setCookie);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `GDT API Error: ${response.status} ${response.statusText} ${detail}`.trim()
    );
  }

  return response.json() as Promise<T>;
}

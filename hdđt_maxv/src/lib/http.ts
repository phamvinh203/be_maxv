import { API_BASE } from "../config/api";

interface ApiErrorBody {
  message?: string;
}

export type ApiFetchOptions = RequestInit;

/**
 * Callback do AuthContext đăng ký — gọi khi phiên hết hạn hẳn (access lẫn refresh đều 401).
 * Reset state auth ở đó là đủ: ProtectedRoute tự đẩy về /login khi isAuthenticated=false.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/**
 * Lời gọi /auth/refresh đang chạy (nếu có) — dùng chung cho mọi request cùng dính 401 một lúc,
 * để chỉ refresh MỘT lần thay vì mỗi request tự gọi (chống "refresh storm").
 */
let refreshPromise: Promise<boolean> | null = null;

/** Refresh không áp dụng cho chính các route auth này (tránh đệ quy / vô nghĩa). */
function canRefresh(path: string): boolean {
  return !(
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/logout")
  );
}

/** Gọi POST /auth/refresh 1 lần (single-flight); trả true nếu cấp lại token thành công. */
function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * fetch tới be_maxv (`${API_BASE}${path}`) — tự set Content-Type khi có body, parse JSON,
 * và ném Error kèm `message` của server khi response không ok. Luôn gửi kèm cookie (`credentials:
 * include`): access token nằm ở cookie httpOnly nên không truyền qua header nữa.
 *
 * Access token hết hạn (15m) -> 401: tự gọi /auth/refresh (dùng refresh cookie 7 ngày) rồi thử lại
 * request ĐÚNG 1 lần. Retry an toàn kể cả với POST vì 401 do `authenticate` chặn TRƯỚC khi handler
 * chạy (thao tác chưa hề thực thi). Refresh hỏng -> onSessionExpired() để đăng xuất.
 * Dùng chung cho mọi API client trong app thay vì mỗi hàm tự lặp lại đoạn này.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };

  let res = await fetch(`${API_BASE}${path}`, init);

  // Access token hết hạn: thử refresh 1 lần rồi lặp lại request; hết cửa thì báo hết phiên.
  if (res.status === 401 && canRefresh(path)) {
    if (await tryRefresh()) {
      res = await fetch(`${API_BASE}${path}`, init);
    } else {
      onSessionExpired?.();
    }
  }

  const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) {
    throw new Error(body.message || `Yêu cầu thất bại (${res.status})`);
  }
  return body;
}

/** Envelope chuẩn `{success, data, message}` mà be_maxv trả cho mọi response (sendOk/sendCreated). */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * `apiFetch` rồi tự bóc `data` khỏi envelope — ném Error nếu thiếu (kể cả khi res.ok).
 * Dùng cho mọi API client thay vì mỗi file tự khai báo `ApiEnvelope`/hàm unwrap riêng.
 */
export async function apiFetchData<T>(
  path: string,
  options: ApiFetchOptions = {},
  fallbackMessage = "Yêu cầu thất bại",
): Promise<T> {
  const body = await apiFetch<ApiEnvelope<T>>(path, options);
  if (!body.data) throw new Error(body.message || fallbackMessage);
  return body.data;
}

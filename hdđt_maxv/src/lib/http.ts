import { API_BASE } from "../config/api";

interface ApiErrorBody {
  message?: string;
  /** Mã lỗi máy đọc được, BE gắn cho vài trường hợp FE cần rẽ nhánh (vd `DVC_AUTO_LOGIN_FAILED`). */
  code?: string;
}

/**
 * Lỗi API kèm HTTP status — để caller phân biệt được loại lỗi (vd 409 email trùng ->
 * gắn lỗi vào đúng ô nhập thay vì Alert chung). Vẫn `extends Error` nên mọi chỗ đang
 * bắt bằng `instanceof Error` / đọc `.message` không phải sửa.
 * Dùng: RegisterForm (409), và bất kỳ chỗ nào cần rẽ nhánh theo status.
 */
export class ApiError extends Error {
  readonly status: number;
  /** `code` BE gửi kèm (nếu có) — rẽ nhánh theo mã thay vì dò câu chữ thông báo tiếng Việt. */
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
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

/**
 * Gọi POST /auth/refresh 1 lần (single-flight).
 * - true  -> server đã đặt access cookie mới.
 * - false -> refresh cookie hết hạn/bị thu hồi (401/403) = hết phiên thật.
 * - ném lỗi -> sự cố TẠM THỜI (mạng chập, 502 lúc Node recycle sau IIS). KHÔNG phải hết
 *   phiên: nuốt thành false ở đây sẽ đá user về /login oan dù refresh cookie còn hạn.
 *
 * Lưu ý: fetch KHÔNG reject khi HTTP lỗi, nên `r.ok === false` gộp cả 401 lẫn 502 —
 * phải tự tách theo status, không được rút gọn thành `.then((r) => r.ok)`.
 */
function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => {
        if (r.ok) return true;
        if (r.status === 401 || r.status === 403) return false;
        throw new Error(`Refresh lỗi tạm (${r.status})`);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Lõi dùng chung: dựng `init` (luôn gửi cookie `credentials: include`; tự set Content-Type khi có body),
 * fetch tới `${API_BASE}${path}`, và xử lý 401 = access token hết hạn -> gọi /auth/refresh (dùng refresh
 * cookie 7 ngày) rồi lặp lại request ĐÚNG 1 lần (an toàn kể cả POST vì 401 do `authenticate` chặn TRƯỚC
 * khi handler chạy). Refresh trả 401/403 = hết phiên -> onSessionExpired(); refresh lỗi tạm -> giữ phiên.
 * Trả `Response` thô để caller tự parse (JSON/blob).
 */
async function apiFetchRaw(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      // FormData phải để fetch tự đặt `multipart/form-data; boundary=...` — ép JSON vào là
      // server không tách được các phần và upload hỏng.
      ...(rest.body && !(rest.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
  };

  const res = await fetch(`${API_BASE}${path}`, init);
  if (res.status !== 401 || !canRefresh(path)) return res;

  let refreshed: boolean;
  try {
    refreshed = await tryRefresh();
  } catch {
    // Refresh lỗi tạm -> trả về đúng response 401 gốc, GIỮ NGUYÊN phiên để user thử lại.
    return res;
  }

  if (!refreshed) {
    onSessionExpired?.();
    return res;
  }
  return fetch(`${API_BASE}${path}`, init);
}

/**
 * Ném `ApiError` kèm `message` của server nếu response không ok. Dùng chung cho cả 3 kiểu đọc body
 * (JSON/blob/text) để định dạng thông báo lỗi không lệch nhau giữa các lối gọi.
 */
async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
  throw new ApiError(body.message || `Yêu cầu thất bại (${res.status})`, res.status, body.code);
}

/**
 * `apiFetchRaw` rồi parse JSON + ném Error kèm `message` của server khi response không ok.
 * Dùng chung cho mọi API client trong app thay vì mỗi hàm tự lặp lại đoạn này.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetchRaw(path, options);
  // Đọc body TRƯỚC khi kiểm ok: nhánh thành công cần chính body này, mà body chỉ đọc được 1 lần.
  const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) {
    throw new ApiError(body.message || `Yêu cầu thất bại (${res.status})`, res.status, body.code);
  }
  return body;
}

/**
 * Như `apiFetch` nhưng trả BLOB nhị phân (vd PDF từ `/gdt/render-pdf`) thay vì parse JSON.
 * Lỗi (response không ok) -> đọc `message` JSON nếu có rồi ném Error.
 */
export async function apiFetchBlob(path: string, options: ApiFetchOptions = {}): Promise<Blob> {
  const res = await apiFetchRaw(path, options);
  await throwIfNotOk(res);
  return res.blob();
}

/**
 * Như `apiFetch` nhưng trả VĂN BẢN THÔ (vd XML gốc từ `/gdt/invoices/export-xml`) thay vì parse JSON.
 * Lỗi (response không ok) -> đọc `message` JSON nếu có rồi ném `ApiError` kèm status, để caller phân
 * biệt được 401 (token GDT hết hạn, phải dừng cả lượt) với lỗi lẻ của 1 hóa đơn.
 */
export async function apiFetchText(path: string, options: ApiFetchOptions = {}): Promise<string> {
  const res = await apiFetchRaw(path, options);
  await throwIfNotOk(res);
  return res.text();
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

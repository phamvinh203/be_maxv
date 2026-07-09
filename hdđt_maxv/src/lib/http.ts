import { API_BASE } from "../config/api";

interface ApiErrorBody {
  message?: string;
}

export interface ApiFetchOptions extends RequestInit {
  /** Đính kèm `Authorization: Bearer <token>` */
  token?: string;
}

/**
 * fetch tới be_maxv (`${API_BASE}${path}`) — tự set Content-Type khi có body,
 * parse JSON, và ném Error kèm `message` của server khi response không ok.
 * Dùng chung cho mọi API client trong app thay vì mỗi hàm tự lặp lại đoạn này.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

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

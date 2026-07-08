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

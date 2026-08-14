import { apiFetchData } from "./http";
import { getErrorMessage } from "./errors";

/**
 * Lớp tương thích cho code port từ fe_maxv (dùng `import { api } from '@/lib/apiClient'` với
 * chữ ký kiểu axios: `api.get/post/put/patch/del`). hdđt_maxv dùng client kiểu fetch
 * (`apiFetchData` ở `./http`) — shim này chỉ đổi hình dạng gọi, vẫn cùng 1 cookie phiên,
 * cùng 1 backend, cùng envelope `{success,data}`.
 */
export interface ApiRequestConfig {
  // `object` (không phải `Record<string, unknown>`) — nhận thẳng các interface *ListParams cụ thể
  // không khai index signature, khỏi phải ép kiểu ở từng nơi gọi.
  params?: object;
}

function buildQuery(params?: object): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  get: <T>(url: string, config?: ApiRequestConfig): Promise<T> =>
    apiFetchData<T>(`${url}${buildQuery(config?.params)}`),
  post: <T>(url: string, body?: unknown): Promise<T> =>
    apiFetchData<T>(url, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(url: string, body?: unknown): Promise<T> =>
    apiFetchData<T>(url, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(url: string, body?: unknown): Promise<T> =>
    apiFetchData<T>(url, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  del: <T>(url: string): Promise<T> =>
    apiFetchData<T>(url, { method: "DELETE" }),
};

/** Alias `getErrorMessage` — giữ tên gọi quen thuộc từ code port fe_maxv. */
export function getApiError(
  err: unknown,
  fallback = "Đã có lỗi xảy ra, vui lòng thử lại.",
): string {
  return getErrorMessage(err, fallback);
}

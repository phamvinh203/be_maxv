import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import type { ApiErrorBody, ApiResponse } from '@/types/api';

// withCredentials: access + refresh token đều nằm ở cookie httpOnly (JS không đọc được),
// nên mọi request chỉ cần gửi cookie kèm — không có header Authorization nào cả.
const clientConfig = { baseURL: env.apiUrl, withCredentials: true };

export const apiClient = axios.create(clientConfig);

/**
 * Client cho CHÍNH các lời gọi quản lý phiên (login/logout/refresh). Cố tình KHÔNG gắn
 * interceptor: 401 ở đây là kết quả thật (sai mật khẩu, refresh cookie hết hạn), không
 * phải "access token hết hạn" nên tự refresh là vô nghĩa — và refresh mà đi qua chính
 * interceptor refresh thì thành đệ quy. Tách instance khiến điều đó không xảy ra được,
 * thay vì phải nhớ liệt kê path ngoại lệ.
 */
const authClient = axios.create(clientConfig);

/**
 * Bọc 1 axios instance cho backend envelope { success, data }: tự bóc `.data.data`.
 * Dùng ở mọi feature API thay vì lặp lại unwrap ở từng hàm.
 */
function makeApi(instance: AxiosInstance) {
  return {
    get: <T>(url: string, config?: AxiosRequestConfig) =>
      instance.get<ApiResponse<T>>(url, config).then((r) => r.data.data),
    post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
      instance.post<ApiResponse<T>>(url, body, config).then((r) => r.data.data),
    put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
      instance.put<ApiResponse<T>>(url, body, config).then((r) => r.data.data),
    patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
      instance.patch<ApiResponse<T>>(url, body, config).then((r) => r.data.data),
    del: <T>(url: string, config?: AxiosRequestConfig) =>
      instance.delete<ApiResponse<T>>(url, config).then((r) => r.data.data),
  };
}

/** API thường: 401 -> tự refresh rồi thử lại. Dùng cho mọi endpoint, kể cả /auth/me. */
export const api = makeApi(apiClient);

/** API cho login/logout/refresh — xem `authClient`. KHÔNG dùng cho endpoint khác. */
export const authApi = makeApi(authClient);

export interface AuthEvents {
  /**
   * Refresh thành công. activeDonViId có thể ĐÃ ĐỔI so với phiên FE đang giữ: backend
   * hạ về null nếu user không còn quyền vào MST cũ (loadUserForRefresh) — phải đồng bộ,
   * nếu không FE vẫn tưởng đang ở MST đó còn token thì không, trang hỏng câm.
   */
  onRefreshed: (activeDonViId: string | null) => void;
  /**
   * Refresh trả 401/403 = hết phiên hẳn. Reset state auth là đủ: ProtectedRoute tự đá
   * về /login khi isAuthenticated=false.
   */
  onExpired: () => void;
}

// Do AuthProvider đăng ký (apiClient nằm ngoài React nên không tự setState được).
let authEvents: AuthEvents | null = null;

export function setAuthEventHandlers(handlers: AuthEvents | null): void {
  authEvents = handlers;
}

// Lời gọi /auth/refresh đang chạy (nếu có) — dùng chung cho mọi request cùng dính 401 một
// lúc, để chỉ refresh MỘT lần thay vì mỗi request tự gọi (chống "refresh storm").
let refreshPromise: Promise<boolean> | null = null;

/**
 * Gọi POST /auth/refresh 1 lần (single-flight).
 * - true  -> backend đã đặt access cookie mới.
 * - false -> refresh cookie hết hạn/bị thu hồi (401/403) = hết phiên thật.
 * - ném lỗi -> sự cố TẠM THỜI (mạng chập, 502 lúc Node recycle sau IIS). KHÔNG phải hết
 *   phiên: nuốt thành false ở đây sẽ đá user về /login oan dù refresh cookie còn hạn.
 */
function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = authApi
      .post<{ activeDonViId: string | null }>('/auth/refresh')
      .then((data) => {
        authEvents?.onRefreshed(data.activeDonViId);
        return true;
      })
      .catch((err: unknown) => {
        const status = (err as AxiosError).response?.status;
        if (status === 401 || status === 403) return false;
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * 401 = access token hết hạn -> gọi /auth/refresh (refresh cookie còn hạn) rồi lặp lại
 * request ĐÚNG 1 lần. An toàn kể cả với POST: 401 do preHandler `authenticate` chặn TRƯỚC
 * khi handler chạy, nên request đầu chưa gây tác dụng phụ nào.
 */
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    let refreshed: boolean;
    try {
      refreshed = await tryRefresh();
    } catch {
      // Refresh lỗi tạm -> trả về đúng lỗi 401 gốc, GIỮ NGUYÊN phiên để user thử lại.
      return Promise.reject(error);
    }

    if (refreshed) return apiClient(original);

    authEvents?.onExpired();
    return Promise.reject(error);
  },
);

/** Rút message dễ đọc từ lỗi axios để hiển thị cho người dùng. */
export function getApiError(
  err: unknown,
  fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.',
): string {
  const body = (err as AxiosError<ApiErrorBody>).response?.data;
  if (!body) return fallback;
  if (body.message) return body.message;
  if (body.errors?.length) {
    const msg = body.errors.map((e) => e.message).filter(Boolean).join(', ');
    if (msg) return msg;
  }
  return fallback;
}

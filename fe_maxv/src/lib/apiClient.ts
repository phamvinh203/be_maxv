import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import type { ApiErrorBody, ApiResponse } from '@/types/api';
import { getToken, setToken, clearSession } from '@/features/auth/token';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true, // gửi cookie refresh token httpOnly
});

/**
 * Client gọn cho backend envelope { success, data }: tự bóc `.data.data`.
 * Dùng ở mọi feature API thay vì lặp lại unwrap ở từng hàm.
 */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<ApiResponse<T>>(url, config).then((r) => r.data.data),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    apiClient.post<ApiResponse<T>>(url, body, config).then((r) => r.data.data),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    apiClient.patch<ApiResponse<T>>(url, body, config).then((r) => r.data.data),
};

// Gắn Bearer access token vào mọi request.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 -> thử refresh access token 1 lần (gộp các request đồng thời), rồi retry.
let refreshing: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing ??= refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      }
      clearSession();
    }
    return Promise.reject(error);
  },
);

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<{ data: { accessToken: string } }>(
      `${env.apiUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    setToken(token);
    return token;
  } catch {
    return null;
  }
}

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

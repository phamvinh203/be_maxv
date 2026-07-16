import { api, authApi } from '@/lib/apiClient';
import type {
  LoginInput,
  RegisterInput,
  RegisterResult,
  SessionData,
} from '@/features/auth/types/auth';

/** POST /auth/login — backend đặt access + refresh vào cookie httpOnly, body chỉ có phiên. */
export function login(input: LoginInput): Promise<SessionData> {
  return authApi.post<SessionData>('/auth/login', input);
}

/**
 * GET /auth/me — khôi phục phiên từ access cookie khi tải trang (401 nếu chưa đăng nhập).
 * Cố ý dùng `api` (có auto-refresh): access token hết hạn mà refresh cookie còn thì phiên
 * vẫn phải khôi phục được, không bắt đăng nhập lại.
 */
export function getMe(): Promise<SessionData> {
  return api.get<SessionData>('/auth/me');
}

export function register(input: RegisterInput): Promise<RegisterResult> {
  return api.post<RegisterResult>('/auth/register', input);
}

/** POST /auth/logout — backend xóa cả access lẫn refresh cookie. */
export function logout(): Promise<void> {
  return authApi.post<void>('/auth/logout');
}

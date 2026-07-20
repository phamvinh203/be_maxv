import { apiFetch, apiFetchData } from "../../../lib/http";
import type { RegisterPayload, RegisterResult, SessionData } from "../types";

/**
 * POST /api/v1/auth/register → tài khoản mới (201). Server KHÔNG đặt cookie phiên ở bước này,
 * nên đăng ký xong người dùng vẫn chưa đăng nhập — FE tự điều hướng về /login.
 * Ném ApiError (có `status`) khi thất bại: 409 = email đã tồn tại.
 */
export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  return apiFetchData<RegisterResult>(
    "/auth/register",
    { method: "POST", body: JSON.stringify(payload) },
    "Đăng ký thất bại",
  );
}

/**
 * POST /api/v1/auth/login → phiên (user + công ty). Access & refresh token do server đặt vào
 * cookie httpOnly (không trả qua body, JS không đọc được). Ném error kèm message nếu thất bại.
 */
export async function login(email: string, password: string): Promise<SessionData> {
  return apiFetchData<SessionData>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    "Đăng nhập thất bại",
  );
}

/** GET /api/v1/auth/me → phiên hiện tại từ cookie access (ném lỗi nếu chưa đăng nhập / 401). */
export async function getMe(): Promise<SessionData> {
  return apiFetchData<SessionData>("/auth/me");
}

/** POST /api/v1/auth/logout — server xóa cả cookie access lẫn refresh. */
export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
}

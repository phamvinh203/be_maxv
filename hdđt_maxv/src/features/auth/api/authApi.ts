import { apiFetch, apiFetchData } from "../../../lib/http";
import type { SessionData } from "../types";

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

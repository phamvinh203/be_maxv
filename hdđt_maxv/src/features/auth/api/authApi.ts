import { API_BASE } from "../../../config/api";

export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
}

interface LoginResponseData {
  accessToken: string;
  user: AuthUser;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** POST /api/v1/auth/login → { accessToken, user } (ném error kèm message nếu thất bại) */
export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<LoginResponseData>;
  if (!res.ok || !body.data) {
    throw new Error(body.message || "Đăng nhập thất bại");
  }
  return body.data;
}

/** POST /api/v1/auth/logout — xóa refresh cookie phía server. */
export async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
}

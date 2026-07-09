import { apiFetch, apiFetchData } from "../../../lib/http";
import type { LoginResponseData } from "../types";

/** POST /api/v1/auth/login → { accessToken, user } (ném error kèm message nếu thất bại) */
export async function login(email: string, password: string) {
  return apiFetchData<LoginResponseData>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    "Đăng nhập thất bại",
  );
}

/** POST /api/v1/auth/logout — xóa refresh cookie phía server. */
export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
}

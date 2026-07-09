import { apiFetch } from "../../../lib/http";

export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
}

/** Bản tóm tắt công ty/MST trả về lúc login (chi tiết đầy đủ hơn xem `features/company/api/companyApi.ts`). */
export interface AuthCompany {
  id: string;
  maSoThue: string;
  slug: string;
  tenDonVi: string;
  status: string;
}

interface LoginResponseData {
  accessToken: string;
  user: AuthUser;
  /** Toàn bộ công ty/MST user được phép thao tác (owner thấy hết của mình; nhân viên thấy MST được cấp). */
  companies: AuthCompany[];
  /** Công ty đang active nhúng trong JWT; null nếu user có nhiều công ty và chưa xác định rõ. */
  activeDonViId: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** POST /api/v1/auth/login → { accessToken, user } (ném error kèm message nếu thất bại) */
export async function login(email: string, password: string) {
  const body = await apiFetch<ApiEnvelope<LoginResponseData>>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!body.data) {
    throw new Error(body.message || "Đăng nhập thất bại");
  }
  return body.data;
}

/** POST /api/v1/auth/logout — xóa refresh cookie phía server. */
export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
}

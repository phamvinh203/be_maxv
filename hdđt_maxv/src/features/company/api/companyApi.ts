import { apiFetch } from "../../../lib/http";
import type { AuthCompany } from "../../auth/api/authApi";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Chi tiết công ty dùng cho tab "Quản lý công ty/Hộ kinh doanh". */
export interface CompanyDetail extends AuthCompany {
  diaChi: string | null;
  sdt: string | null;
  loaiHinhKinhDoanh: string | null;
}

export interface CreateCompanyPayload {
  tenCongTy: string;
  maSoThue: string;
  diaChi: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}

/** MST không nằm trong đây — không sửa được sau khi tạo (đã gắn tenant DB). */
export interface UpdateCompanyPayload {
  tenCongTy?: string;
  diaChi?: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>): Promise<T> {
  const body = await promise;
  if (!body.data) throw new Error(body.message || "Yêu cầu thất bại");
  return body.data;
}

/** GET /companies — danh sách công ty/MST user được phép (owner thấy hết của mình). */
export function listCompanies(token: string): Promise<CompanyDetail[]> {
  return unwrap(apiFetch<ApiEnvelope<CompanyDetail[]>>("/companies", { token }));
}

/**
 * POST /companies — tạo công ty/MST mới. `activate: false` vì đang thêm từ màn Cài đặt
 * (owner có thể đang làm việc ở MST khác) — không đụng tới token/phiên hiện tại.
 */
export function createCompany(
  token: string,
  payload: CreateCompanyPayload,
): Promise<{ company: CompanyDetail }> {
  return unwrap(
    apiFetch<ApiEnvelope<{ company: CompanyDetail }>>("/companies", {
      method: "POST",
      token,
      body: JSON.stringify({ ...payload, activate: false }),
    }),
  );
}

/** PUT /companies/:id — sửa thông tin công ty (không sửa được `maSoThue`). */
export function updateCompany(
  token: string,
  id: string,
  payload: UpdateCompanyPayload,
): Promise<CompanyDetail> {
  return unwrap(
    apiFetch<ApiEnvelope<CompanyDetail>>(`/companies/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(payload),
    }),
  );
}

/** POST /companies/:id/switch — đổi công ty đang làm việc, cấp lại token nhúng donViId mới. */
export function switchCompany(
  token: string,
  id: string,
): Promise<{ accessToken: string; activeDonViId: string }> {
  return unwrap(
    apiFetch<ApiEnvelope<{ accessToken: string; activeDonViId: string }>>(
      `/companies/${id}/switch`,
      { method: "POST", token },
    ),
  );
}

/** DELETE /companies/:id — "xóa" (lưu trữ) công ty, không xóa dữ liệu thật. */
export function deleteCompany(
  token: string,
  id: string,
): Promise<{ id: string; status: string }> {
  return unwrap(
    apiFetch<ApiEnvelope<{ id: string; status: string }>>(`/companies/${id}`, {
      method: "DELETE",
      token,
    }),
  );
}

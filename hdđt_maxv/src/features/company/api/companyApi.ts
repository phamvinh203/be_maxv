import { apiFetchData } from "../../../lib/http";
import type {
  CompanyDetail,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from "../types";

/** GET /companies — danh sách công ty/MST user được phép (owner thấy hết của mình). */
export function listCompanies(token: string): Promise<CompanyDetail[]> {
  return apiFetchData<CompanyDetail[]>("/companies", { token });
}

/**
 * POST /companies — tạo công ty/MST mới. `activate: false` vì đang thêm từ màn Cài đặt
 * (owner có thể đang làm việc ở MST khác) — không đụng tới token/phiên hiện tại.
 */
export function createCompany(
  token: string,
  payload: CreateCompanyPayload,
): Promise<{ company: CompanyDetail }> {
  return apiFetchData<{ company: CompanyDetail }>("/companies", {
    method: "POST",
    token,
    body: JSON.stringify({ ...payload, activate: false }),
  });
}

/** PUT /companies/:id — sửa thông tin công ty (không sửa được `maSoThue`). */
export function updateCompany(
  token: string,
  id: string,
  payload: UpdateCompanyPayload,
): Promise<CompanyDetail> {
  return apiFetchData<CompanyDetail>(`/companies/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

/** POST /companies/:id/switch — đổi công ty đang làm việc, cấp lại token nhúng donViId mới. */
export function switchCompany(
  token: string,
  id: string,
): Promise<{ accessToken: string; activeDonViId: string }> {
  return apiFetchData<{ accessToken: string; activeDonViId: string }>(
    `/companies/${id}/switch`,
    { method: "POST", token },
  );
}

/** DELETE /companies/:id — "xóa" (lưu trữ) công ty, không xóa dữ liệu thật. */
export function deleteCompany(
  token: string,
  id: string,
): Promise<{ id: string; status: string }> {
  return apiFetchData<{ id: string; status: string }>(`/companies/${id}`, {
    method: "DELETE",
    token,
  });
}

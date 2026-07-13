import { apiFetchData } from "../../../lib/http";
import type {
  CompanyDetail,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from "../types";

// Auth qua cookie httpOnly (apiFetch tự gửi kèm) — không truyền token qua tham số nữa.

/** GET /companies — danh sách công ty/MST user được phép (owner thấy hết của mình). */
export function listCompanies(): Promise<CompanyDetail[]> {
  return apiFetchData<CompanyDetail[]>("/companies");
}

/**
 * POST /companies — tạo công ty/MST mới. `activate: false` vì đang thêm từ màn Cài đặt
 * (owner có thể đang làm việc ở MST khác) — không đổi công ty đang chọn.
 */
export function createCompany(
  payload: CreateCompanyPayload,
): Promise<{ company: CompanyDetail }> {
  return apiFetchData<{ company: CompanyDetail }>("/companies", {
    method: "POST",
    body: JSON.stringify({ ...payload, activate: false }),
  });
}

/** PUT /companies/:id — sửa thông tin công ty (không sửa được `maSoThue`). */
export function updateCompany(
  id: string,
  payload: UpdateCompanyPayload,
): Promise<CompanyDetail> {
  return apiFetchData<CompanyDetail>(`/companies/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** POST /companies/:id/switch — đổi công ty đang làm việc; server đặt cookie access mới nhúng donViId. */
export function switchCompany(id: string): Promise<{ activeDonViId: string }> {
  return apiFetchData<{ activeDonViId: string }>(`/companies/${id}/switch`, {
    method: "POST",
  });
}

/** DELETE /companies/:id — "xóa" (lưu trữ) công ty, không xóa dữ liệu thật. */
export function deleteCompany(id: string): Promise<{ id: string; status: string }> {
  return apiFetchData<{ id: string; status: string }>(`/companies/${id}`, {
    method: "DELETE",
  });
}

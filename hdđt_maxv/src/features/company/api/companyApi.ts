import { apiFetchData } from "../../../lib/http";
import type {
  CompanyDetail,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from "../types";

// Auth qua cookie httpOnly (apiFetch tự gửi kèm) — không truyền token qua tham số nữa.

/**
 * Key cache danh sách công ty. Đặt cạnh API (không nằm trong `companyQueries`) vì `AuthContext`
 * cũng phải dựng đúng key này — cả header lẫn tab Quản lý công ty dùng CHUNG một entry cache,
 * nên mỗi lần ghi chỉ tốn một `GET /companies`.
 */
export const companyKeys = {
  /** Gắn userId để danh sách không rò giữa các phiên đăng nhập khác nhau. */
  list: (userId: string | undefined) => ["companies", userId] as const,
};

/** GET /companies — danh sách công ty/MST user được phép (owner thấy hết của mình). */
export function listCompanies(): Promise<CompanyDetail[]> {
  return apiFetchData<CompanyDetail[]>("/companies");
}

/**
 * POST /companies — tạo công ty/MST mới.
 *
 * `activate: true` (công ty ĐẦU TIÊN): server đặt cookie access mới nhúng `donViId` và trả
 * `activeDonViId`. Bắt buộc phải có, vì `resolveTenantDb` bên BE đọc `donViId` từ token —
 * thiếu nó thì mọi endpoint theo tenant (hóa đơn, đồng bộ...) trả 403.
 *
 * `activate: false` (thêm MST từ màn Cài đặt, owner đang làm việc ở MST khác): KHÔNG đụng
 * token/refresh cookie hiện tại — tránh cửa sổ đua khi FE phải switch-back thủ công.
 */
export function createCompany(
  payload: CreateCompanyPayload,
  activate: boolean,
): Promise<{ company: CompanyDetail; activeDonViId?: string }> {
  return apiFetchData<{ company: CompanyDetail; activeDonViId?: string }>("/companies", {
    method: "POST",
    body: JSON.stringify({ ...payload, activate }),
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

/**
 * DELETE /companies/:id — XÓA VĨNH VIỄN công ty: server DROP luôn database tenant `maxv_<mst>_app`
 * rồi xóa hẳn bản ghi. Không hoàn tác được. `maSoThue` là chuỗi người dùng gõ để xác nhận (server
 * so lại, nên dialog chỉ là lớp UX). Hệ quả của `activeDonViId`: xem `useDeleteCompanyMutation`.
 */
export function deleteCompany(
  id: string,
  maSoThue: string,
): Promise<{ id: string; activeDonViId: string | null }> {
  return apiFetchData<{ id: string; activeDonViId: string | null }>(`/companies/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ maSoThue }),
  });
}

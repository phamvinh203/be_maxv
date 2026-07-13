import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import {
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "./companyApi";
import type {
  CompanyDetail,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from "../types";

export const companyKeys = {
  /** Prefix cho invalidate; query thực tế gắn thêm userId (danh sách theo từng user). */
  all: ["companies"] as const,
};

/** Danh sách công ty chi tiết (tab "Quản lý công ty") — gắn userId để không rò giữa các user. */
export function useCompaniesQuery() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: [...companyKeys.all, user?.id],
    queryFn: () => listCompanies(),
    enabled: isAuthenticated,
  });
}

/**
 * Sau khi tạo/sửa/xóa công ty: vừa invalidate danh sách của tab này, vừa gọi
 * `refreshCompanies` để đồng bộ danh sách gọn ở AuthContext (header/menu chuyển công ty).
 * `refreshCompanies` được nuốt lỗi để không làm hỏng `onSuccess` sau khi ghi đã thành công.
 */
function useInvalidateCompanies() {
  const qc = useQueryClient();
  const { refreshCompanies } = useAuth();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: companyKeys.all }),
      refreshCompanies().catch(() => {}),
    ]);
}

export function useCreateCompanyMutation() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => createCompany(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCompanyMutation() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (vars: { id: string; payload: UpdateCompanyPayload }) =>
      updateCompany(vars.id, vars.payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCompanyMutation() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (company: CompanyDetail) => deleteCompany(company.id),
    onSuccess: invalidate,
  });
}

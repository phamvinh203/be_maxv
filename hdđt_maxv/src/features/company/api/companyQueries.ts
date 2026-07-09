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
  const { accessToken, user } = useAuth();
  return useQuery({
    queryKey: [...companyKeys.all, user?.id],
    queryFn: () => listCompanies(accessToken as string),
    enabled: !!accessToken,
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
  const { accessToken } = useAuth();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => createCompany(accessToken as string, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCompanyMutation() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (vars: { id: string; payload: UpdateCompanyPayload }) =>
      updateCompany(accessToken as string, vars.id, vars.payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCompanyMutation() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (company: CompanyDetail) => deleteCompany(accessToken as string, company.id),
    onSuccess: invalidate,
  });
}

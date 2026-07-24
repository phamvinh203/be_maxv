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

/**
 * Tạo công ty. Công ty ĐẦU TIÊN thì `activate: true` để server nhúng `donViId` vào cookie
 * access — thiếu bước này thì tên công ty không hiện trên header và mọi endpoint theo tenant
 * trả 403 cho tới khi user tự bấm chọn công ty. Thêm MST tiếp theo (từ Cài đặt) giữ
 * `activate: false` để không đá owner khỏi MST đang làm việc.
 */
export function useCreateCompanyMutation() {
  const qc = useQueryClient();
  const { companies, refreshCompanies, setActiveCompany } = useAuth();
  const invalidate = useInvalidateCompanies();
  const isFirstCompany = companies.length === 0;

  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => createCompany(payload, isFirstCompany),
    onSuccess: async (data) => {
      if (!data.activeDonViId) {
        await invalidate();
        return;
      }
      setActiveCompany(data.activeDonViId);
      // Nuốt lỗi như `useInvalidateCompanies`: ghi đã thành công rồi, đừng để bước đồng bộ
      // danh sách làm `onSuccess` reject và biến mutation thành lỗi.
      await refreshCompanies().catch(() => {});
      // Cache cũ sinh ra lúc chưa có công ty (query theo tenant đều 403) — làm mới TẤT CẢ để
      // mọi màn nạp lại dưới tenant mới, thay cho việc phải tải lại cả trang.
      // Không dùng `qc.clear()`: nó xóa luôn mutation cache nên `onSuccess` mà nơi gọi truyền
      // vào `mutate()` (đóng dialog) có thể không chạy. Không await để dialog đóng ngay.
      qc.invalidateQueries().catch(() => {});
    },
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

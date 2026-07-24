import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import {
  companyKeys,
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

/**
 * Danh sách công ty chi tiết (tab "Quản lý công ty") — gắn userId để không rò giữa các user.
 * `AuthContext.refreshCompanies` ghi vào ĐÚNG key này, nên bảng ở đây và menu chuyển công ty
 * trên header là hai người quan sát cùng một entry cache.
 */
export function useCompaniesQuery() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: companyKeys.list(user?.id),
    queryFn: () => listCompanies(),
    enabled: isAuthenticated,
  });
}

/**
 * Sau khi tạo/sửa/xóa công ty: gọi `refreshCompanies` để nạp lại danh sách. Vì nó fetch qua cache
 * dùng chung nên MỘT lượt `GET /companies` cập nhật cả AuthContext lẫn `useCompaniesQuery` —
 * trước đây invalidate + refresh chạy song song làm gọi endpoint này hai lần mỗi lần ghi.
 * Nuốt lỗi để không làm hỏng `onSuccess` sau khi ghi đã thành công.
 */
function useInvalidateCompanies() {
  const { refreshCompanies } = useAuth();
  return () => refreshCompanies().catch(() => {});
}

/**
 * Tạo công ty. Công ty ĐẦU TIÊN thì `activate: true` để server nhúng `donViId` vào cookie
 * access — thiếu bước này thì tên công ty không hiện trên header và mọi endpoint theo tenant
 * trả 403 cho tới khi user tự bấm chọn công ty. Thêm MST tiếp theo (từ Cài đặt) giữ
 * `activate: false` để không đá owner khỏi MST đang làm việc.
 */
export function useCreateCompanyMutation() {
  const { companies, setActiveCompany } = useAuth();
  const invalidate = useInvalidateCompanies();
  const isFirstCompany = companies.length === 0;

  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => createCompany(payload, isFirstCompany),
    onSuccess: async (data) => {
      // Đặt TRƯỚC `invalidate()`: mọi query theo tenant đều gắn `currentCompanyId` vào queryKey và
      // `enabled: !!currentCompanyId` (xem invoiceQueries/statsQueries/syncQueries), nên đổi id là
      // chúng tự đổi key và nạp lần đầu — không cần dọn cache thủ công.
      if (data.activeDonViId) setActiveCompany(data.activeDonViId);
      await invalidate();
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

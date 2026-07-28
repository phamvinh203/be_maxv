import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { useGdtSession } from "../../hddt/gdtSession/useGdtSession";
import {
  companyKeys,
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "./companyApi";
import type { CreateCompanyPayload, UpdateCompanyPayload } from "../types";

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

/**
 * Xóa VĨNH VIỄN công ty (server DROP luôn database tenant — xem `deleteCompany` ở companyApi).
 * `maSoThue` vừa là chuỗi xác nhận gửi lên, vừa là khóa để dọn token GDT của MST đó.
 *
 * `activeDonViId` trong response là công ty đang làm việc SAU khi xóa: nếu vừa xóa đúng công ty
 * đang dùng thì server đã đặt cookie access mới, ở đây chỉ đồng bộ state cho khớp. Thiếu bước này
 * thì `currentCompanyId` còn trỏ công ty đã biến mất và mọi endpoint theo tenant trả 403 — mà 403
 * thì `apiFetch` không refresh cũng không đăng xuất, user kẹt tới khi access token hết hạn.
 */
export function useDeleteCompanyMutation() {
  const { setActiveCompany } = useAuth();
  const { removeGdtToken } = useGdtSession();
  const invalidate = useInvalidateCompanies();

  return useMutation({
    mutationFn: (vars: { id: string; maSoThue: string }) =>
      deleteCompany(vars.id, vars.maSoThue),
    onSuccess: async (data, vars) => {
      // Đặt TRƯỚC `invalidate()`, cùng lý do như `useCreateCompanyMutation`: query theo tenant gắn
      // `currentCompanyId` vào queryKey nên đổi id là chúng tự đổi key, không cần dọn cache tay.
      setActiveCompany(data.activeDonViId);
      removeGdtToken(vars.maSoThue);
      await invalidate();
    },
  });
}

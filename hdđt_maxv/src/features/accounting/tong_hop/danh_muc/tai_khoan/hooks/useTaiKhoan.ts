import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createTaiKhoan,
  deleteTaiKhoan,
  listTaiKhoan,
  updateTaiKhoan,
} from '@/features/accounting/tong_hop/danh_muc/tai_khoan/api/taiKhoanApi';
import type { TaiKhoanForm } from '@/features/accounting/tong_hop/danh_muc/tai_khoan/types';
import { useAuth } from '@/features/auth/useAuth';

export const taiKhoanKeys = {
  all: ['tai-khoan'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['tai-khoan', companyId, 'list'] as const,
};

export function useTaiKhoanList(options?: { enabled?: boolean }) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: taiKhoanKeys.list(currentCompanyId),
    queryFn: () => listTaiKhoan(),
    placeholderData: (prev) => prev,
    enabled: (options?.enabled ?? true) && isAuthenticated && !!currentCompanyId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: taiKhoanKeys.all });
}

export function useCreateTaiKhoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: TaiKhoanForm) => createTaiKhoan(body),
    onSuccess: invalidate,
  });
}

export function useUpdateTaiKhoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ tk, body }: { tk: string; body: TaiKhoanForm }) =>
      updateTaiKhoan(tk, body),
    onSuccess: invalidate,
  });
}

export function useDeleteTaiKhoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (tk: string) => deleteTaiKhoan(tk),
    onSuccess: invalidate,
  });
}

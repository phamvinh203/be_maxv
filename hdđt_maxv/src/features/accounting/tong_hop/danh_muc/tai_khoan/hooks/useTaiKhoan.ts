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

export const taiKhoanKeys = {
  all: ['tai-khoan'] as const,
  list: ['tai-khoan', 'list'] as const,
};

export function useTaiKhoanList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taiKhoanKeys.list,
    queryFn: () => listTaiKhoan(),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
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

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createKhachHang,
  deleteKhachHang,
  listKhachHang,
  updateKhachHang,
} from '@/features/accounting/ban_hang/danh_muc/dm_KH/api/khachHangApi';
import type { KhachHangForm } from '@/features/accounting/ban_hang/danh_muc/dm_KH/types';
import { useAuth } from '@/features/auth/useAuth';

export const khachHangKeys = {
  all: ['khach-hang'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['khach-hang', companyId, 'list'] as const,
};

export function useKhachHangList(options?: { enabled?: boolean }) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: khachHangKeys.list(currentCompanyId),
    queryFn: () => listKhachHang(),
    placeholderData: (prev) => prev,
    enabled: (options?.enabled ?? true) && isAuthenticated && !!currentCompanyId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: khachHangKeys.all });
}

export function useCreateKhachHang() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: KhachHangForm) => createKhachHang(body),
    onSuccess: invalidate,
  });
}

export function useUpdateKhachHang() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maKh, body }: { maKh: string; body: KhachHangForm }) =>
      updateKhachHang(maKh, body),
    onSuccess: invalidate,
  });
}

export function useDeleteKhachHang() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (maKh: string) => deleteKhachHang(maKh),
    onSuccess: invalidate,
  });
}

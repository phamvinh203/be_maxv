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
import type {
  KhachHangForm,
  KhachHangListParams,
} from '@/features/accounting/ban_hang/danh_muc/dm_KH/types';
import { useAuth } from '@/features/auth/useAuth';

export const khachHangKeys = {
  all: ['khach-hang'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null, params: KhachHangListParams) =>
    ['khach-hang', companyId, 'list', params] as const,
};

export function useKhachHangList(
  params: KhachHangListParams = {},
  options?: { enabled?: boolean },
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: khachHangKeys.list(currentCompanyId, params),
    queryFn: () => listKhachHang(params),
    // RVW-N07: không giữ placeholder qua lần đổi công ty — tránh hiện data tenant cũ
    // dưới tên công ty mới trong lúc chờ refetch.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === currentCompanyId ? prev : undefined,
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

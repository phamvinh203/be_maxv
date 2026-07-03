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
} from '@/features/ban_hang/danh_muc/dm_KH/api/khachHangApi';
import type { KhachHangForm } from '@/features/ban_hang/danh_muc/dm_KH/types';

export const khachHangKeys = {
  all: ['khach-hang'] as const,
  list: ['khach-hang', 'list'] as const,
};

export function useKhachHangList() {
  return useQuery({
    queryKey: khachHangKeys.list,
    queryFn: () => listKhachHang(),
    placeholderData: (prev) => prev,
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

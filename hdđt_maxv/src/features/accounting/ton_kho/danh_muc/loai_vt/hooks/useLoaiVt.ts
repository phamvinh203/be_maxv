import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createLoaiVt,
  deleteLoaiVt,
  listLoaiVt,
  updateLoaiVt,
} from '@/features/accounting/ton_kho/danh_muc/loai_vt/api/loaiVtApi';
import type { LoaiVtForm } from '@/features/accounting/ton_kho/danh_muc/loai_vt/types';
import { hangHoaKeys } from '@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';

export const loaiVtKeys = {
  all: ['loai-vt'] as const,
  list: ['loai-vt', 'list'] as const,
};

export function useLoaiVtList() {
  return useQuery({
    queryKey: loaiVtKeys.list,
    queryFn: () => listLoaiVt(),
    placeholderData: (prev) => prev,
  });
}

/** Loại VT cũng là lookup cho form hàng hóa -> làm mới cả 2. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: loaiVtKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups });
  };
}

export function useCreateLoaiVt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: LoaiVtForm) => createLoaiVt(body),
    onSuccess: invalidate,
  });
}

export function useUpdateLoaiVt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maLoai, body }: { maLoai: string; body: LoaiVtForm }) =>
      updateLoaiVt(maLoai, body),
    onSuccess: invalidate,
  });
}

export function useDeleteLoaiVt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (maLoai: string) => deleteLoaiVt(maLoai),
    onSuccess: invalidate,
  });
}

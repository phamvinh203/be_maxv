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
import { useAuth } from '@/features/auth/useAuth';

export const loaiVtKeys = {
  all: ['loai-vt'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['loai-vt', companyId, 'list'] as const,
};

export function useLoaiVtList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: loaiVtKeys.list(currentCompanyId),
    queryFn: () => listLoaiVt(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Loại VT cũng là lookup cho form hàng hóa -> làm mới cả 2. */
function useInvalidate() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () => {
    void qc.invalidateQueries({ queryKey: loaiVtKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups(currentCompanyId) });
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

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createPhanNhom,
  deletePhanNhom,
  listPhanNhom,
  updatePhanNhom,
} from '@/features/accounting/ton_kho/danh_muc/phan_nhom/api/phanNhomApi';
import type { PhanNhomForm } from '@/features/accounting/ton_kho/danh_muc/phan_nhom/types';
import { hangHoaKeys } from '@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import { useAuth } from '@/features/auth/useAuth';

export const phanNhomKeys = {
  all: ['phan-nhom'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['phan-nhom', companyId, 'list'] as const,
};

export function usePhanNhomList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: phanNhomKeys.list(currentCompanyId),
    queryFn: () => listPhanNhom(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Phân nhóm cũng là lookup (nhóm 1/2/3) cho form hàng hóa -> làm mới cả 2. */
function useInvalidate() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () => {
    void qc.invalidateQueries({ queryKey: phanNhomKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups(currentCompanyId) });
  };
}

export function useCreatePhanNhom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: PhanNhomForm) => createPhanNhom(body),
    onSuccess: invalidate,
  });
}

export function useUpdatePhanNhom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PhanNhomForm }) =>
      updatePhanNhom(id, body),
    onSuccess: invalidate,
  });
}

export function useDeletePhanNhom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deletePhanNhom(id),
    onSuccess: invalidate,
  });
}

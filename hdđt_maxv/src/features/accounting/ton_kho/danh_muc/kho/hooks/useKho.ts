import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createKho,
  deleteKho,
  listKho,
  updateKho,
} from '@/features/accounting/ton_kho/danh_muc/kho/api/khoApi';
import type { KhoForm } from '@/features/accounting/ton_kho/danh_muc/kho/types';
import { hangHoaKeys } from '@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import { useAuth } from '@/features/auth/useAuth';

export const khoKeys = {
  all: ['kho'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['kho', companyId, 'list'] as const,
};

export function useKhoList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: khoKeys.list(currentCompanyId),
    queryFn: () => listKho(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Kho cũng là lookup cho form hàng hóa -> làm mới cả 2 sau khi đổi. */
function useInvalidate() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () => {
    void qc.invalidateQueries({ queryKey: khoKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups(currentCompanyId) });
  };
}

export function useCreateKho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: KhoForm) => createKho(body),
    onSuccess: invalidate,
  });
}

export function useUpdateKho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maKho, body }: { maKho: string; body: KhoForm }) =>
      updateKho(maKho, body),
    onSuccess: invalidate,
  });
}

export function useDeleteKho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (maKho: string) => deleteKho(maKho),
    onSuccess: invalidate,
  });
}

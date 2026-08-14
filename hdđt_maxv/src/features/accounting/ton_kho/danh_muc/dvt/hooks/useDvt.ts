import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createDvt,
  deleteDvt,
  listDvt,
  updateDvt,
} from '@/features/accounting/ton_kho/danh_muc/dvt/api/dvtApi';
import type { DvtForm } from '@/features/accounting/ton_kho/danh_muc/dvt/types';
import { hangHoaKeys } from '@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import { useAuth } from '@/features/auth/useAuth';

export const dvtKeys = {
  all: ['dvt'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['dvt', companyId, 'list'] as const,
};

export function useDvtList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: dvtKeys.list(currentCompanyId),
    queryFn: () => listDvt(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Đvt cũng là lookup cho form hàng hóa -> làm mới cả 2 sau khi đổi. */
function useInvalidate() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () => {
    void qc.invalidateQueries({ queryKey: dvtKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups(currentCompanyId) });
  };
}

export function useCreateDvt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: DvtForm) => createDvt(body),
    onSuccess: invalidate,
  });
}

export function useUpdateDvt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ dvt, body }: { dvt: string; body: DvtForm }) =>
      updateDvt(dvt, body),
    onSuccess: invalidate,
  });
}

export function useDeleteDvt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (dvt: string) => deleteDvt(dvt),
    onSuccess: invalidate,
  });
}

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

export const dvtKeys = {
  all: ['dvt'] as const,
  list: ['dvt', 'list'] as const,
};

export function useDvtList() {
  return useQuery({
    queryKey: dvtKeys.list,
    queryFn: () => listDvt(),
    placeholderData: (prev) => prev,
  });
}

/** Đvt cũng là lookup cho form hàng hóa -> làm mới cả 2 sau khi đổi. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: dvtKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups });
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

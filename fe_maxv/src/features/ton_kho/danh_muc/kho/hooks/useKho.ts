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
} from '@/features/ton_kho/danh_muc/kho/api/khoApi';
import type { KhoForm } from '@/features/ton_kho/danh_muc/kho/types';
import { hangHoaKeys } from '@/features/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';

export const khoKeys = {
  all: ['kho'] as const,
  list: ['kho', 'list'] as const,
};

export function useKhoList() {
  return useQuery({
    queryKey: khoKeys.list,
    queryFn: () => listKho(),
    placeholderData: (prev) => prev,
  });
}

/** Kho cũng là lookup cho form hàng hóa -> làm mới cả 2 sau khi đổi. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: khoKeys.all });
    void qc.invalidateQueries({ queryKey: hangHoaKeys.lookups });
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

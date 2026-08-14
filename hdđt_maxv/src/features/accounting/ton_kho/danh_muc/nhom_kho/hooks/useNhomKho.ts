import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createNhomKho,
  deleteNhomKho,
  listNhomKho,
  updateNhomKho,
} from '@/features/accounting/ton_kho/danh_muc/nhom_kho/api/nhomKhoApi';
import type { NhomKhoForm } from '@/features/accounting/ton_kho/danh_muc/nhom_kho/types';
import { khoKeys } from '@/features/accounting/ton_kho/danh_muc/kho/hooks/useKho';

export const nhomKhoKeys = {
  all: ['nhom-kho'] as const,
  list: ['nhom-kho', 'list'] as const,
};

export function useNhomKhoList() {
  return useQuery({
    queryKey: nhomKhoKeys.list,
    queryFn: () => listNhomKho(),
    placeholderData: (prev) => prev,
  });
}

/** Đổi nhóm kho -> làm mới cả danh sách kho (cột tên nhóm kho là join). */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: nhomKhoKeys.all });
    void qc.invalidateQueries({ queryKey: khoKeys.all });
  };
}

export function useCreateNhomKho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: NhomKhoForm) => createNhomKho(body),
    onSuccess: invalidate,
  });
}

export function useUpdateNhomKho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maNh, body }: { maNh: string; body: NhomKhoForm }) =>
      updateNhomKho(maNh, body),
    onSuccess: invalidate,
  });
}

export function useDeleteNhomKho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (maNh: string) => deleteNhomKho(maNh),
    onSuccess: invalidate,
  });
}

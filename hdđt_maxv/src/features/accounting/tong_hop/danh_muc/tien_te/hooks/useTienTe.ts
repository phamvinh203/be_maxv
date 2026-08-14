import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createTienTe,
  deleteTienTe,
  listTienTe,
  updateTienTe,
} from '@/features/accounting/tong_hop/danh_muc/tien_te/api/tienTeApi';
import type { TienTeForm } from '@/features/accounting/tong_hop/danh_muc/tien_te/types';

export const tienTeKeys = {
  all: ['tien-te'] as const,
  list: ['tien-te', 'list'] as const,
};

export function useTienTeList() {
  return useQuery({
    queryKey: tienTeKeys.list,
    queryFn: () => listTienTe(),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: tienTeKeys.all });
}

export function useCreateTienTe() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: TienTeForm) => createTienTe(body),
    onSuccess: invalidate,
  });
}

export function useUpdateTienTe() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maNt, body }: { maNt: string; body: TienTeForm }) =>
      updateTienTe(maNt, body),
    onSuccess: invalidate,
  });
}

export function useDeleteTienTe() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (maNt: string) => deleteTienTe(maNt),
    onSuccess: invalidate,
  });
}

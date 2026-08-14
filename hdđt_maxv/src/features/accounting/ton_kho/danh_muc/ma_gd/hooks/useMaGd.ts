import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createMaGd,
  deleteMaGd,
  listMaGd,
  updateMaGd,
} from '@/features/accounting/ton_kho/danh_muc/ma_gd/api/maGdApi';
import type { MaGdForm } from '@/features/accounting/ton_kho/danh_muc/ma_gd/types';

export const maGdKeys = {
  all: ['ma-gd'] as const,
  list: ['ma-gd', 'list'] as const,
};

export function useMaGdList() {
  return useQuery({
    queryKey: maGdKeys.list,
    queryFn: () => listMaGd(),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: maGdKeys.all });
}

export function useCreateMaGd() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: MaGdForm) => createMaGd(body),
    onSuccess: invalidate,
  });
}

export function useUpdateMaGd() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      maCt,
      maGd,
      body,
    }: {
      maCt: string;
      maGd: string;
      body: MaGdForm;
    }) => updateMaGd(maCt, maGd, body),
    onSuccess: invalidate,
  });
}

export function useDeleteMaGd() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maCt, maGd }: { maCt: string; maGd: string }) =>
      deleteMaGd(maCt, maGd),
    onSuccess: invalidate,
  });
}

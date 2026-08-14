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
import { useAuth } from '@/features/auth/useAuth';

export const maGdKeys = {
  all: ['ma-gd'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['ma-gd', companyId, 'list'] as const,
};

export function useMaGdList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: maGdKeys.list(currentCompanyId),
    queryFn: () => listMaGd(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
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

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
import { useAuth } from '@/features/auth/useAuth';

export const tienTeKeys = {
  all: ['tien-te'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['tien-te', companyId, 'list'] as const,
};

export function useTienTeList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: tienTeKeys.list(currentCompanyId),
    queryFn: () => listTienTe(),
    // RVW-N07: không giữ placeholder qua lần đổi công ty — tránh hiện data tenant cũ
    // dưới tên công ty mới trong lúc chờ refetch.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === currentCompanyId ? prev : undefined,
    enabled: isAuthenticated && !!currentCompanyId,
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

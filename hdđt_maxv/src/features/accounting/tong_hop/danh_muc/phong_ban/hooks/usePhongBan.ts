import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createPhongBan,
  deletePhongBan,
  listPhongBan,
  updatePhongBan,
} from '@/features/accounting/tong_hop/danh_muc/phong_ban/api/phongBanApi';
import type { PhongBanForm } from '@/features/accounting/tong_hop/danh_muc/phong_ban/types';
import { useAuth } from '@/features/auth/useAuth';

export const phongBanKeys = {
  all: ['phong-ban'] as const,
  // Gắn companyId — mọi API đều theo tenant qua cookie, không tự đổi khi đổi công ty.
  list: (companyId: string | null) => ['phong-ban', companyId, 'list'] as const,
};

export function usePhongBanList(options?: { enabled?: boolean }) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: phongBanKeys.list(currentCompanyId),
    queryFn: () => listPhongBan(),
    placeholderData: (prev) => prev,
    enabled: (options?.enabled ?? true) && isAuthenticated && !!currentCompanyId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: phongBanKeys.all });
}

export function useCreatePhongBan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: PhongBanForm) => createPhongBan(body),
    onSuccess: invalidate,
  });
}

export function useUpdatePhongBan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ maPb, body }: { maPb: string; body: PhongBanForm }) =>
      updatePhongBan(maPb, body),
    onSuccess: invalidate,
  });
}

export function useDeletePhongBan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (maPb: string) => deletePhongBan(maPb),
    onSuccess: invalidate,
  });
}

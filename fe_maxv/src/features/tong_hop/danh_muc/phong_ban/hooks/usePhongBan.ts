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
} from '@/features/tong_hop/danh_muc/phong_ban/api/phongBanApi';
import type { PhongBanForm } from '@/features/tong_hop/danh_muc/phong_ban/types';

export const phongBanKeys = {
  all: ['phong-ban'] as const,
  list: ['phong-ban', 'list'] as const,
};

export function usePhongBanList() {
  return useQuery({
    queryKey: phongBanKeys.list,
    queryFn: () => listPhongBan(),
    placeholderData: (prev) => prev,
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

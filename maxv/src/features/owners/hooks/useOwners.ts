import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listOwners,
  getOwner,
  setOwnerLimits,
} from '@/features/owners/api/ownersApi';
import type {
  ListOwnersParams,
  OwnerDetail,
  SetOwnerLimitsInput,
} from '@/features/owners/types/owner';

export const ownerKeys = {
  all: ['owners'] as const,
  list: (params: ListOwnersParams) =>
    [...ownerKeys.all, 'list', params] as const,
  detail: (id: string) => [...ownerKeys.all, 'detail', id] as const,
};

export function useOwners(params: ListOwnersParams) {
  return useSuspenseQuery({
    queryKey: ownerKeys.list(params),
    queryFn: () => listOwners(params),
  });
}

export function useOwner(id: string) {
  return useSuspenseQuery({
    queryKey: ownerKeys.detail(id),
    queryFn: () => getOwner(id),
  });
}

export function useSetOwnerLimits(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetOwnerLimitsInput) => setOwnerLimits(id, input),
    onSuccess: (res) => {
      // Cập nhật chi tiết tại chỗ (khỏi refetch); chỉ làm mới danh sách để cột trần đúng.
      qc.setQueryData(ownerKeys.detail(id), (old: OwnerDetail | undefined) =>
        old ? { ...old, override: res.override, gioiHan: res.gioiHan } : old,
      );
      void qc.invalidateQueries({ queryKey: [...ownerKeys.all, 'list'] });
    },
  });
}

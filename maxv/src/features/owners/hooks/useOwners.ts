import { useSuspenseQuery } from '@tanstack/react-query';
import { listOwners, getOwner } from '@/features/owners/api/ownersApi';
import type { ListOwnersParams } from '@/features/owners/types/owner';

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

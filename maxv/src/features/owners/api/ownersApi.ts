import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type {
  Owner,
  OwnerDetail,
  ListOwnersParams,
} from '@/features/owners/types/owner';

export function listOwners(
  params: ListOwnersParams,
): Promise<Paginated<Owner>> {
  return api.get<Paginated<Owner>>('/admin/owners', { params });
}

export function getOwner(id: string): Promise<OwnerDetail> {
  return api.get<OwnerDetail>(`/admin/owners/${id}`);
}

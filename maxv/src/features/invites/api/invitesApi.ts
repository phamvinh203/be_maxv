import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type { AdminInvite, ListInvitesParams } from '@/features/invites/types/invite';

export function listInvites(
  params: ListInvitesParams,
): Promise<Paginated<AdminInvite>> {
  return api.get<Paginated<AdminInvite>>('/admin/companies/invites', { params });
}

export function approveInvite(
  id: string,
): Promise<{ id: string; email: string; hoTen: string; chucVu: string | null }> {
  return api.post(`/admin/companies/invites/${id}/approve`);
}

export function rejectInvite(
  id: string,
  lyDoTuChoi?: string,
): Promise<{ id: string; email: string; lyDoTuChoi: string | null }> {
  return api.post(`/admin/companies/invites/${id}/reject`, { lyDoTuChoi });
}

import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type { AdminInvite, ListInvitesParams } from '@/features/invites/types/invite';

export function listInvites(params: ListInvitesParams): Promise<Paginated<AdminInvite>> {
  return api.get<Paginated<AdminInvite>>('/admin/nhan-vien', { params });
}

export function approveInvite(id: string): Promise<{ email: string; password: string }> {
  return api.post<{ email: string; password: string }>(`/admin/nhan-vien/${id}/approve`);
}

export function rejectInvite(id: string, reason?: string): Promise<AdminInvite> {
  return api.post<AdminInvite>(`/admin/nhan-vien/${id}/reject`, { reason });
}

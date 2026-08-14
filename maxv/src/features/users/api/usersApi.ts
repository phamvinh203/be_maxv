import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type {
  AdminUser,
  DeleteUserResult,
  ListUsersParams,
  Role,
} from '@/features/users/types/user';

export function listUsers(
  params: ListUsersParams,
): Promise<Paginated<AdminUser>> {
  return api.get<Paginated<AdminUser>>('/admin/users', { params });
}

export function activateUser(id: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/admin/users/${id}/activate`);
}

export function deactivateUser(id: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/admin/users/${id}/deactivate`);
}

export function changeUserRole(id: string, role: Role): Promise<AdminUser> {
  return api.patch<AdminUser>(`/admin/users/${id}/role`, { role });
}

export function resetUserPassword(id: string): Promise<{ password: string }> {
  return api.post<{ password: string }>(`/admin/users/${id}/reset-password`);
}

/**
 * Xóa VĨNH VIỄN tài khoản — backend DROP luôn DB tenant của mọi MST họ sở hữu.
 * `email` là email của chính user đó, admin phải gõ lại để xác nhận.
 */
export function deleteUser(
  id: string,
  email: string,
): Promise<DeleteUserResult> {
  return api.delete<DeleteUserResult>(`/admin/users/${id}`, {
    data: { email },
  });
}

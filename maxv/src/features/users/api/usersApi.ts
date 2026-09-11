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

/**
 * Vô hiệu mật khẩu hiện tại + đăng xuất mọi phiên; máy chủ email cho người dùng hướng dẫn tự đặt lại bằng
 * "Quên mật khẩu". KHÔNG trả mật khẩu (admin không được biết mật khẩu người dùng).
 */
export interface KetQuaDatLaiMatKhau {
  email: string;
  /** `false` = không gửi được email — admin tự báo người dùng dùng "Quên mật khẩu". */
  daGuiEmail: boolean;
}

export function resetUserPassword(id: string): Promise<KetQuaDatLaiMatKhau> {
  return api.post<KetQuaDatLaiMatKhau>(`/admin/users/${id}/reset-password`);
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

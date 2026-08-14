export type Role = 'ADMIN' | 'OWNER' | 'OWNER_EMPLOYEE';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

interface OwnerRef {
  id: string;
  hoTen: string;
  email: string;
}

export interface AdminUser {
  id: string;
  email: string;
  sdt: string | null;
  hoTen: string;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  ownerId: string | null; // nhân viên -> chủ tài khoản; owner/admin = null
  createdAt: string;
  owner: OwnerRef | null; // chủ tài khoản (nếu là nhân viên)
  _count: { ownedDonVi: number; donViAccess: number; employees: number };
}

/** Kết quả xóa vĩnh viễn 1 tài khoản — số bản ghi bị cascade kéo theo. */
export interface DeleteUserResult {
  id: string;
  soDonViDaXoa: number;
  soNhanVienDaXoa: number;
}

export interface ListUsersParams {
  role?: Role;
  status?: UserStatus;
  donViId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const ROLES: Role[] = ['ADMIN', 'OWNER', 'OWNER_EMPLOYEE'];

// Vai trò có thể GÁN qua UI — KHÔNG gồm ADMIN (gán/gỡ admin chỉ qua DB).
export const ASSIGNABLE_ROLES: Role[] = ['OWNER', 'OWNER_EMPLOYEE'];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị',
  OWNER: 'Chủ tài khoản',
  OWNER_EMPLOYEE: 'Nhân viên',
};

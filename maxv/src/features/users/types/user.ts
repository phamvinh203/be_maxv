export type Role = 'ADMIN' | 'OWNER' | 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

interface CompanyRef {
  id: string;
  maSoThue: string;
  tenDonVi: string;
}

export interface AdminUser {
  id: string;
  email: string;
  sdt: string | null;
  hoTen: string;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  donViId: string | null;
  createdAt: string;
  donVi: CompanyRef | null;
}

export interface ListUsersParams {
  role?: Role;
  status?: UserStatus;
  donViId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const ROLES: Role[] = [
  'ADMIN',
  'OWNER',
  'KE_TOAN_TRUONG',
  'KE_TOAN',
  'XEM',
];

// Vai trò có thể GÁN qua UI — KHÔNG gồm ADMIN (gán/gỡ admin chỉ qua DB).
export const ASSIGNABLE_ROLES: Role[] = [
  'OWNER',
  'KE_TOAN_TRUONG',
  'KE_TOAN',
  'XEM',
];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị',
  OWNER: 'Chủ đơn vị',
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

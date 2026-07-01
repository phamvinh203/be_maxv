export type EmployeeRole = 'OWNER' | 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';
export type EmployeeStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface Employee {
  id: string;
  email: string;
  hoTen: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  isActive: boolean;
  createdAt: string;
}

export type InviteRole = 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';

export interface InviteEmployeeInput {
  email: string;
  role: InviteRole;
}

export interface InviteResult {
  id: string;
  email: string;
  role: InviteRole;
  status: 'PENDING';
  createdAt: string;
}

export const INVITE_ROLES: InviteRole[] = ['KE_TOAN_TRUONG', 'KE_TOAN', 'XEM'];

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  OWNER: 'Chủ đơn vị',
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  PENDING: 'Chờ duyệt',
  ACTIVE: 'Đang hoạt động',
  REJECTED: 'Từ chối',
};

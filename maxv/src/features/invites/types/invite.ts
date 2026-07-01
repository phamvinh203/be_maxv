export type InviteRole = 'KE_TOAN_TRUONG' | 'KE_TOAN' | 'XEM';
export type InviteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminInvite {
  id: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  lyDoTuChoi: string | null;
  createdAt: string;
  resolvedAt: string | null;
  donVi: { id: string; maSoThue: string; tenDonVi: string };
  requestedBy: { id: string; hoTen: string };
}

export interface ListInvitesParams {
  status?: InviteStatus;
  page?: number;
  pageSize?: number;
}

export const ROLE_LABELS: Record<InviteRole, string> = {
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

export const STATUS_LABELS: Record<InviteStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

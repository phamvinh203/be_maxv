export type InviteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface CompanyRef {
  id: string;
  tenDonVi: string;
  maSoThue: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  hoTen: string;
  chucVu: string;
  status: InviteStatus;
  lyDoTuChoi: string | null;
  createdAt: string;
  resolvedAt: string | null;
  donVi: CompanyRef;
}

export interface ListInvitesParams {
  status?: InviteStatus;
  donViId?: string;
  page?: number;
  pageSize?: number;
}

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

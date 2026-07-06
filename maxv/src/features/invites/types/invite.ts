export type InviteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface OwnerRef {
  hoTen: string;
  email: string;
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
  ownerId: string;
  donViIds: string[]; // các MST sẽ cấp cho nhân viên khi duyệt
  owner: OwnerRef; // chủ tài khoản mời
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

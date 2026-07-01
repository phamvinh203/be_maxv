export interface Employee {
  id: string;
  hoTen: string;
  email: string;
  sdt: string | null;
  chucVu: string | null;
  role: string;
  status: string;
  isActive: boolean;
  createdAt: string;
}

export type InviteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CompanyInvite {
  id: string;
  email: string;
  hoTen: string;
  chucVu: string;
  role: string;
  status: InviteStatus;
  lyDoTuChoi: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface InviteEmployeeInput {
  email: string;
  hoTen: string;
  chucVu: string;
}

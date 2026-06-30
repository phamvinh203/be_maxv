export type TenantStatus = 'PROVISIONING' | 'READY' | 'FAILED' | 'SUSPENDED';

export interface Company {
  id: string;
  maSoThue: string;
  tenDonVi: string;
  status: TenantStatus;
  dbName: string | null;
  provisionedAt: string | null;
  createdAt: string;
}

export interface CompanyUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface CompanyDetail extends Company {
  users: CompanyUser[];
  subscription: {
    status: string;
    ketThuc: string | null;
    plan: { ma: string; ten: string };
  } | null;
}

export interface CompanyOverview {
  company: Pick<Company, 'id' | 'maSoThue' | 'tenDonVi' | 'status' | 'dbName'>;
  thietLap: {
    tenCongTy: string;
    maSoThue: string | null;
    ngayBatDauNTC: string;
  } | null;
  counts: {
    taiKhoan: number;
    doiTuong: number;
    chungTu: number;
    chungTuDong: number;
    butToan: number;
  };
  dbSizeBytes: number;
  dbSize: string;
  lastChungTuAt: string | null;
}

export interface ListCompaniesParams {
  status?: TenantStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

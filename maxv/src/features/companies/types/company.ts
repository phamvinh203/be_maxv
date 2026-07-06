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

/** Chi tiết đơn vị: billing + thành viên giờ ở cấp tài khoản (owner) và DonViAccess. */
export interface CompanyDetail extends Company {
  owner: {
    id: string;
    hoTen: string;
    email: string;
    role: string;
    isActive: boolean;
    subscription: {
      status: string;
      ketThuc: string | null;
      plan: { ma: string; ten: string };
    } | null;
  } | null;
  access: { user: CompanyUser }[]; // nhân viên được cấp quyền vào MST này
}

/** 1 mục trong menu (vd "Danh mục hàng hóa, vật tư"). rows/size null = chưa có bảng. */
export interface OverviewItem {
  label: string;
  path: string | null;
  table: string | null;
  exists: boolean;
  rows: number | null;
  bytes: number | null;
  size: string | null;
}

/** 1 nhóm chức năng (Danh mục / Chứng từ / Báo cáo). */
export interface OverviewSection {
  key: string;
  title: string;
  totalRows: number;
  totalBytes: number;
  totalSize: string;
  items: OverviewItem[];
}

/** 1 module/tab nghiệp vụ (Tồn kho, ...). */
export interface OverviewModule {
  key: string;
  title: string;
  totalRows: number;
  totalBytes: number;
  totalSize: string;
  sections: OverviewSection[];
}

export interface CompanyOverview {
  company: Pick<Company, 'id' | 'maSoThue' | 'tenDonVi' | 'status' | 'dbName'>;
  dbSizeBytes: number;
  dbSize: string;
  modules: OverviewModule[];
}

export interface ListCompaniesParams {
  status?: TenantStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

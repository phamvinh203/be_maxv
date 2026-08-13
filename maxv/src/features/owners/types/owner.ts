import type { TenantStatus } from '@/features/companies/types/company';
import type { UserStatus } from '@/features/users/types/user';
import type { UserModules } from '@/features/owners/modules';

/** Giới hạn theo gói. null = không giới hạn. */
export interface Limits {
  soMstToiDa: number | null;
  soNguoiToiDa: number | null;
}

/** 1 dòng trong danh sách tài khoản. */
export interface Owner {
  id: string;
  hoTen: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  soCongTy: number;
  soNhanVien: number;
  plan: { ma: string; ten: string } | null;
  gioiHan: Limits; // trần theo gói
  /** Module gói của tài khoản cấp — áp cho owner và mọi nhân viên của họ. */
  modules: UserModules;
}

/** 1 MST/DB thuộc tài khoản. */
export interface OwnerCompany {
  id: string;
  maSoThue: string;
  tenDonVi: string;
  status: TenantStatus;
  dbName: string | null;
  provisionedAt: string | null;
  dbSizeBytes: number | null;
  dbExists: boolean;
}

/** 1 nhân viên thuộc tài khoản. */
export interface OwnerEmployee {
  id: string;
  hoTen: string;
  email: string;
  chucVu: string | null;
  status: UserStatus;
  isActive: boolean;
  donViAccess: { donViId: string }[];
}

export interface OwnerDetail {
  id: string;
  hoTen: string;
  email: string;
  sdt: string | null;
  status: UserStatus;
  createdAt: string;
  subscription: {
    status: string;
    batDau: string | null;
    ketThuc: string | null;
    plan: { ma: string; ten: string };
  } | null;
  gioiHan: Limits;
  modules: UserModules;
  soCongTy: number;
  soNhanVien: number;
  tongDbBytes: number;
  congTy: OwnerCompany[];
  nhanVien: OwnerEmployee[];
}

export interface ListOwnersParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

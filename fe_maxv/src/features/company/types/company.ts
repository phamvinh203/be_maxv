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
  donViAccess: { donViId: string }[]; // MST mà nhân viên được cấp (owner rỗng: thấy hết)
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
  donViIds: string[]; // các MST được cấp trong lời mời
}

/** Công ty/MST kèm thông tin chi tiết — cho bảng Cài đặt › Công ty/MST (GET /companies). */
export interface Company {
  id: string;
  maSoThue: string;
  slug: string;
  tenDonVi: string;
  diaChi: string | null;
  sdt: string | null;
  loaiHinhKinhDoanh: string | null;
  status: string;
}

export interface InviteEmployeeInput {
  email: string;
  hoTen: string;
  chucVu: string;
  donViIds: string[]; // các MST (của owner) được cấp cho nhân viên — bắt buộc >= 1
}

export interface RegisterCompanyInput {
  userId: string;
  tenCongTy: string;
  maSoThue: string;
  diaChi: string;
  sdt?: string;
  loaiHinhKinhDoanh?: string;
}

export interface RegisterCompanyResult {
  id: string;
  maSoThue: string;
  slug: string;
  tenDonVi: string;
  diaChi: string;
  sdt?: string | null;
  loaiHinhKinhDoanh?: string | null;
  status: string;
  dbName: string | null;
}

/**
 * Response thật của POST /companies: backend bọc company trong { company, ... } và
 * tự switch sang MST vừa tạo (accessToken đã nhúng donViId mới) để vào làm ngay.
 */
export interface RegisterCompanyResponse {
  company: RegisterCompanyResult;
  accessToken: string;
  activeDonViId: string;
}

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
  /**
   * false khi thêm MST từ Cài đặt (owner đang làm việc ở MST khác): backend KHÔNG
   * đụng tới token/refresh cookie hiện tại. Mặc định true (luồng thiết lập lần đầu).
   */
  activate?: boolean;
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
 * Response thật của POST /companies: backend bọc company trong { company, ... }.
 * accessToken/activeDonViId chỉ có khi activate=true (mặc định) — backend đã tự
 * switch sang MST vừa tạo; khi activate=false thì không có (phiên đứng yên).
 */
export interface RegisterCompanyResponse {
  company: RegisterCompanyResult;
  accessToken?: string;
  activeDonViId?: string;
}

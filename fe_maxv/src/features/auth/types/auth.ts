export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
  donViId: string | null;
}

export interface AuthCompany {
  id: string;
  maSoThue: string;
  slug: string;
  tenDonVi: string;
  status: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
  companies: AuthCompany[];
  // Công ty được backend tự chọn: chỉ set khi tài khoản có đúng 1 MST, còn lại null.
  activeDonViId: string | null;
}

export interface SwitchCompanyResult {
  accessToken: string;
  activeDonViId: string;
}

export interface RegisterInput {
  hoTen: string;
  email: string;
  sdt?: string;
  password: string;
}

export interface RegisterResult {
  id: string;
  hoTen: string;
  email: string;
  sdt?: string | null;
}

export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
  donViId: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
  company: {
    id: string;
    maSoThue: string;
    tenDonVi: string;
    status: string;
  } | null;
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

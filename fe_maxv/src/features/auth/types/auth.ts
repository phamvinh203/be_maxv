export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
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

/**
 * Phiên đăng nhập — shape dùng chung cho POST /auth/login và GET /auth/me (backend trả
 * y hệt nhau). Access/refresh token KHÔNG có ở đây: backend đặt thẳng vào cookie httpOnly.
 */
export interface SessionData {
  user: AuthUser;
  companies: AuthCompany[];
  /** Công ty backend nhúng sẵn vào token (công ty đầu tiên); null khi tài khoản chưa có MST. */
  activeDonViId: string | null;
}

/** POST /companies/:id/switch — backend đặt cookie access mới, body chỉ xác nhận MST đích. */
export interface SwitchCompanyResult {
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

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true khi đang gọi /auth/me lúc mở app — chưa biết đã đăng nhập hay chưa. */
  hydrating: boolean;
  /** Các MST tài khoản được phép — nguồn cho Select đổi MST ở header. */
  companies: AuthCompany[];
  /** Công ty đang làm việc (khớp activeDonViId trong access cookie); null khi chưa có MST. */
  company: AuthCompany | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Đổi MST đang làm việc — backend cấp access cookie mới nhúng donViId đích. */
  switchCompany: (id: string) => Promise<void>;
  /**
   * Thêm MST vừa tạo vào phiên. `activate` khớp tham số cùng tên của POST /companies:
   * true = backend đã tự switch sang MST đó -> đặt luôn làm MST đang làm việc;
   * false (mặc định, thêm MST từ Cài đặt) = chỉ vào danh sách, phiên đứng yên.
   */
  addCompany: (company: AuthCompany, activate?: boolean) => void;
}

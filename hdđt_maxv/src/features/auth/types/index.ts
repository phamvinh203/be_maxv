export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
}

/** Bản tóm tắt công ty/MST trả về lúc login (chi tiết đầy đủ hơn xem `features/company/types`). */
export interface AuthCompany {
  id: string;
  maSoThue: string;
  slug: string;
  tenDonVi: string;
  status: string;
}

/** Dữ liệu phiên trả về từ POST /auth/login và GET /auth/me (access token nằm ở cookie httpOnly). */
export interface SessionData {
  user: AuthUser;
  /** Toàn bộ công ty/MST user được phép thao tác (owner thấy hết của mình; nhân viên thấy MST được cấp). */
  companies: AuthCompany[];
  /** Công ty đang active nhúng trong JWT; null nếu user có nhiều công ty và chưa xác định rõ. */
  activeDonViId: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** Đã đăng nhập (có phiên hợp lệ) — thay cho việc đọc access token (giờ ở cookie httpOnly). */
  isAuthenticated: boolean;
  /** Đang kiểm tra phiên (GET /auth/me) lúc tải trang — chưa biết đăng nhập hay chưa. */
  hydrating: boolean;
  /** Công ty/MST user được phép thao tác — nạp lúc login/me, làm mới qua `refreshCompanies()`. */
  companies: AuthCompany[];
  /** Công ty đang active (nhúng trong cookie access token lúc login/switch). */
  currentCompanyId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Gọi lại GET /companies để đồng bộ sau khi thêm/sửa/xóa công ty. */
  refreshCompanies: () => Promise<void>;
  /** Đổi công ty đang làm việc — server cấp lại cookie access nhúng donViId mới. */
  switchCompany: (id: string) => Promise<void>;
}

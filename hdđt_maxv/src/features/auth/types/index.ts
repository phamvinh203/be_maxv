export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
}

/**
 * Body gửi lên POST /auth/register. Khớp `registerSchema` (zod) bên be_maxv —
 * `xacNhanMatKhau` KHÔNG nằm ở đây vì backend không nhận, đó là validate thuần FE.
 */
export interface RegisterPayload {
  hoTen: string;
  email: string;
  sdt: string;
  password: string;
}

/**
 * Lỗi theo từng ô của form đăng ký. Khóa trùng tên trường trên form; ô nào có giá trị
 * thì ô đó chuyển đỏ kèm `helperText`.
 * Dùng: `RegisterForm`, `validateRegisterForm` (features/auth/validators).
 */
export interface RegisterFieldErrors {
  hoTen?: string;
  email?: string;
  sdt?: string;
  password?: string;
  xacNhanMatKhau?: string;
}

/**
 * Giá trị các ô của form đăng ký — suy ra từ `RegisterFieldErrors` để danh sách trường
 * chỉ khai báo một lần. Khác `RegisterPayload`: có thêm `xacNhanMatKhau` (chỉ FE) và
 * mọi giá trị đều là chuỗi thô chưa `trim()`.
 */
export type RegisterFormValues = Record<keyof RegisterFieldErrors, string>;

/** Body POST /auth/reset-password. `xacNhanMatKhau` không nằm ở đây — backend không nhận. */
export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

/** Lỗi theo từng ô ở bước 2 của luồng quên mật khẩu. */
export interface ResetPasswordFieldErrors {
  otp?: string;
  newPassword?: string;
  xacNhanMatKhau?: string;
}

/** Giá trị các ô ở bước 2 — suy ra từ `ResetPasswordFieldErrors`. */
export type ResetPasswordFormValues = Record<keyof ResetPasswordFieldErrors, string>;

/** Dữ liệu POST /auth/register trả về (201). Không có token — đăng ký xong CHƯA đăng nhập. */
export interface RegisterResult {
  id: string;
  hoTen: string;
  email: string;
  sdt: string | null;
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
  /**
   * Ghi nhận công ty đang chọn khi SERVER ĐÃ cấp cookie mới trong cùng response
   * (tạo công ty đầu tiên với `activate: true`) — không gọi thêm API như `switchCompany`.
   */
  setActiveCompany: (id: string) => void;
}

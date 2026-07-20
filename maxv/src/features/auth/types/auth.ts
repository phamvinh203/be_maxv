export interface AuthUser {
  id: string;
  hoTen: string;
  email: string;
  role: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Phiên đăng nhập — shape dùng chung cho POST /auth/login và GET /auth/me (backend trả
 * y hệt nhau). Access/refresh token KHÔNG có ở đây: backend đặt thẳng vào cookie httpOnly.
 *
 * Backend còn trả kèm `companies` + `activeDonViId` (MST của tài khoản khách hàng); app
 * quản trị không làm việc theo MST nên cố ý không khai báo — thừa thì bỏ qua.
 */
export interface SessionData {
  user: AuthUser;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true khi đang gọi /auth/me lúc mở app — chưa biết đã đăng nhập hay chưa. */
  hydrating: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

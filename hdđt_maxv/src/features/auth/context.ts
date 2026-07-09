import { createContext } from "react";
import type { AuthCompany, AuthUser } from "./api/authApi";

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** Công ty/MST user được phép thao tác — nạp lúc login, làm mới qua `refreshCompanies()`. */
  companies: AuthCompany[];
  /** Công ty đang active (nhúng trong JWT lúc login/switch). */
  currentCompanyId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Gọi lại GET /companies để đồng bộ sau khi thêm/sửa/xóa công ty. */
  refreshCompanies: () => Promise<void>;
  /** Đổi công ty đang làm việc — cấp lại token nhúng donViId mới. */
  switchCompany: (id: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

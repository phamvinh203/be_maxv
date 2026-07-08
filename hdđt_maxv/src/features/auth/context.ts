import { createContext } from "react";
import type { AuthUser } from "./api/authApi";

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Token đăng nhập GDT (hóa đơn điện tử) hiện có, theo từng MST (tenant). */
  getGdtToken: (mst: string) => string | undefined;
  setGdtToken: (mst: string, token: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

import { useState, type ReactNode } from "react";
import { login as loginApi, logout as logoutApi, type AuthUser } from "./api/authApi";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const data = await loginApi(email, password);
    setUser(data.user);
    setAccessToken(data.accessToken);
  };

  const logout = async () => {
    await logoutApi().catch(() => {});
    setUser(null);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

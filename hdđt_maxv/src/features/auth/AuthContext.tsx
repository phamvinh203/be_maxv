import { useCallback, useMemo, useState, type ReactNode } from "react";
import { login as loginApi, logout as logoutApi, type AuthUser } from "./api/authApi";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password);
    setUser(data.user);
    setAccessToken(data.accessToken);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {});
    setUser(null);
    setAccessToken(null);
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, login, logout }),
    [user, accessToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

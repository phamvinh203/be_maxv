import { useState, type ReactNode } from "react";
import { login as loginApi, logout as logoutApi, type AuthUser } from "./api/authApi";
import { AuthContext } from "./context";

// Token GDT sống ngắn (~5p ở backend) nên chỉ cần tồn tại trong tab hiện tại.
const GDT_TOKENS_KEY = "hddt_gdt_tokens";

function loadGdtTokens(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(GDT_TOKENS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [gdtTokens, setGdtTokens] = useState<Record<string, string>>(loadGdtTokens);

  const login = async (email: string, password: string) => {
    const data = await loginApi(email, password);
    setUser(data.user);
    setAccessToken(data.accessToken);
  };

  const logout = async () => {
    await logoutApi().catch(() => {});
    setUser(null);
    setAccessToken(null);
    setGdtTokens({});
    sessionStorage.removeItem(GDT_TOKENS_KEY);
  };

  const getGdtToken = (mst: string) => gdtTokens[mst];

  const setGdtToken = (mst: string, token: string) => {
    setGdtTokens((prev) => {
      const next = { ...prev, [mst]: token };
      sessionStorage.setItem(GDT_TOKENS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, accessToken, login, logout, getGdtToken, setGdtToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as loginApi, logout as logoutApi } from "./api/authApi";
import type { AuthCompany, AuthUser } from "./types";
import { listCompanies, switchCompany as switchCompanyApi } from "../company/api/companyApi";
import { queryClient } from "../../lib/queryClient";
import { AuthContext } from "./context";

// Persist để sống qua F5 (không làm refresh-token/switch-company tự động — xem spec).
const TOKEN_KEY = "hddt_auth_token";
const USER_KEY = "hddt_auth_user";
const COMPANIES_KEY = "hddt_auth_companies";
const CURRENT_COMPANY_KEY = "hddt_auth_current_company";

function isAuthUser(v: unknown): v is AuthUser {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as AuthUser).id === "string" &&
    typeof (v as AuthUser).email === "string"
  );
}

function isAuthCompanyArray(v: unknown): v is AuthCompany[] {
  return (
    Array.isArray(v) &&
    v.every((c) => c && typeof c === "object" && typeof (c as AuthCompany).id === "string")
  );
}

/** Đọc JSON từ localStorage; nếu shape không khớp (storage cũ/hỏng) thì bỏ và xóa key thay vì tin mù. */
function loadJson<T>(key: string, fallback: T, isValid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) {
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Ghi/xóa 1 key localStorage — gộp lại thay vì lặp if/else ở từng effect. */
function persist(key: string, value: string | null) {
  if (value !== null) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    loadJson<AuthUser | null>(USER_KEY, null, (v) => v === null || isAuthUser(v)),
  );
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [companies, setCompanies] = useState<AuthCompany[]>(() =>
    loadJson<AuthCompany[]>(COMPANIES_KEY, [], isAuthCompanyArray),
  );
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(() =>
    localStorage.getItem(CURRENT_COMPANY_KEY),
  );

  useEffect(() => persist(TOKEN_KEY, accessToken), [accessToken]);
  useEffect(() => persist(USER_KEY, user ? JSON.stringify(user) : null), [user]);
  useEffect(() => persist(COMPANIES_KEY, JSON.stringify(companies)), [companies]);
  useEffect(() => persist(CURRENT_COMPANY_KEY, currentCompanyId), [currentCompanyId]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password);
    // Xóa cache Query của phiên trước (nếu có) để không rò dữ liệu sang user mới.
    queryClient.clear();
    setUser(data.user);
    setAccessToken(data.accessToken);
    setCompanies(data.companies);
    setCurrentCompanyId(data.activeDonViId);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {});
    queryClient.clear();
    setUser(null);
    setAccessToken(null);
    setCompanies([]);
    setCurrentCompanyId(null);
  }, []);

  const refreshCompanies = useCallback(async () => {
    if (!accessToken) return;
    const data = await listCompanies(accessToken);
    setCompanies(data);
  }, [accessToken]);

  const switchCompany = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const data = await switchCompanyApi(accessToken, id);
      setAccessToken(data.accessToken);
      setCurrentCompanyId(data.activeDonViId);
    },
    [accessToken],
  );

  const value = useMemo(
    () => ({
      user,
      accessToken,
      companies,
      currentCompanyId,
      login,
      logout,
      refreshCompanies,
      switchCompany,
    }),
    [
      user,
      accessToken,
      companies,
      currentCompanyId,
      login,
      logout,
      refreshCompanies,
      switchCompany,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

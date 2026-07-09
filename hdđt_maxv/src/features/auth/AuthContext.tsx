import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  login as loginApi,
  logout as logoutApi,
  type AuthCompany,
  type AuthUser,
} from "./api/authApi";
import { listCompanies, switchCompany as switchCompanyApi } from "../company/api/companyApi";
import { AuthContext } from "./context";

// Persist để sống qua F5 (không làm refresh-token/switch-company tự động — xem spec).
const TOKEN_KEY = "hddt_auth_token";
const USER_KEY = "hddt_auth_user";
const COMPANIES_KEY = "hddt_auth_companies";
const CURRENT_COMPANY_KEY = "hddt_auth_current_company";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadJson(USER_KEY, null));
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [companies, setCompanies] = useState<AuthCompany[]>(() =>
    loadJson<AuthCompany[]>(COMPANIES_KEY, []),
  );
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(() =>
    localStorage.getItem(CURRENT_COMPANY_KEY),
  );

  useEffect(() => {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    else localStorage.removeItem(TOKEN_KEY);
  }, [accessToken]);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    if (currentCompanyId) localStorage.setItem(CURRENT_COMPANY_KEY, currentCompanyId);
    else localStorage.removeItem(CURRENT_COMPANY_KEY);
  }, [currentCompanyId]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password);
    setUser(data.user);
    setAccessToken(data.accessToken);
    setCompanies(data.companies);
    setCurrentCompanyId(data.activeDonViId);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {});
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

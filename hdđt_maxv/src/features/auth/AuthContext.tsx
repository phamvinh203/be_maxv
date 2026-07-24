import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  login as loginApi,
  logout as logoutApi,
  getMe,
} from "./api/authApi";
import { listCompanies, switchCompany as switchCompanyApi } from "../company/api/companyApi";
import { queryClient } from "../../lib/queryClient";
import { setSessionExpiredHandler } from "../../lib/http";
import { AuthContext } from "./context";
import type { AuthCompany, AuthUser } from "./types";

/**
 * Access/refresh token nằm ở cookie httpOnly (server quản lý) — client KHÔNG lưu token nữa.
 * User/công ty không persist vào localStorage; lúc tải trang gọi GET /auth/me để khôi phục phiên.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companies, setCompanies] = useState<AuthCompany[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  // true khi đang gọi /auth/me lúc mở app — chưa biết đăng nhập hay chưa (tránh nháy về /login).
  const [hydrating, setHydrating] = useState(true);

  // Bootstrap phiên từ cookie khi tải trang: 200 -> khôi phục; lỗi/401 -> coi như chưa đăng nhập.
  useEffect(() => {
    let alive = true;
    getMe()
      .then((data) => {
        if (!alive) return;
        setUser(data.user);
        setCompanies(data.companies);
        setCurrentCompanyId(data.activeDonViId);
      })
      .catch(() => {
        /* chưa đăng nhập — giữ state rỗng */
      })
      .finally(() => {
        if (alive) setHydrating(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password); // server đặt cookie access + refresh
    queryClient.clear(); // xóa cache của phiên trước (nếu có)
    setUser(data.user);
    setCompanies(data.companies);
    setCurrentCompanyId(data.activeDonViId);
  }, []);

  // Xóa sạch phiên phía client (cache + state). Dùng cho cả logout chủ động lẫn hết phiên bị động.
  const resetSession = useCallback(() => {
    queryClient.clear();
    setUser(null);
    setCompanies([]);
    setCurrentCompanyId(null);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {}); // server xóa cookie
    resetSession();
  }, [resetSession]);

  // apiFetch gọi handler này khi refresh cũng 401 (hết phiên hẳn) -> reset để ProtectedRoute về /login.
  useEffect(() => {
    setSessionExpiredHandler(resetSession);
    return () => setSessionExpiredHandler(null);
  }, [resetSession]);

  const refreshCompanies = useCallback(async () => {
    setCompanies(await listCompanies());
  }, []);

  const switchCompany = useCallback(async (id: string) => {
    const data = await switchCompanyApi(id); // server đặt cookie access mới nhúng donViId mới
    setCurrentCompanyId(data.activeDonViId);
  }, []);

  // POST /companies với activate=true đã kèm cookie mới trong response — chỉ cần đồng bộ state.
  const setActiveCompany = useCallback((id: string) => {
    setCurrentCompanyId(id);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      hydrating,
      companies,
      currentCompanyId,
      login,
      logout,
      refreshCompanies,
      switchCompany,
      setActiveCompany,
    }),
    [
      user,
      hydrating,
      companies,
      currentCompanyId,
      login,
      logout,
      refreshCompanies,
      switchCompany,
      setActiveCompany,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

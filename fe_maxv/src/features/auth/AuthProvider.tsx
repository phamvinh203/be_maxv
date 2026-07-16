import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { login as loginApi, logout as logoutApi, getMe } from '@/features/auth/api/authApi';
import { switchCompany as switchCompanyApi } from '@/features/company/api/companyApi';
import { setAuthEventHandlers } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import { AuthContext } from '@/features/auth/context';
import type {
  AuthCompany,
  AuthContextValue,
  LoginInput,
  SessionData,
} from '@/features/auth/types/auth';

/**
 * Nguồn sự thật duy nhất của phiên đăng nhập phía FE.
 *
 * Access + refresh token nằm ở cookie httpOnly do backend đặt — FE không đọc, không lưu,
 * không gửi token thủ công. Phiên cũng KHÔNG persist ở localStorage (dữ liệu ở đó bất kỳ
 * script nào trên origin cũng sửa được, và dễ lệch với cookie thật): tải trang thì gọi
 * GET /auth/me để khôi phục từ chính cookie — cookie hết hạn là hết phiên, không lệch được.
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<SessionData | null>(null);
  // true khi đang gọi /auth/me lúc mở app — chưa biết đăng nhập hay chưa (tránh nháy về /login).
  const [hydrating, setHydrating] = useState(true);

  // Bootstrap phiên từ cookie khi tải trang: 200 -> khôi phục; 401 -> coi như chưa đăng nhập.
  useEffect(() => {
    let alive = true;
    getMe()
      .then((data) => {
        if (alive) setSession(data);
      })
      .catch(() => {
        /* chưa đăng nhập — giữ phiên rỗng */
      })
      .finally(() => {
        if (alive) setHydrating(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const data = await loginApi(input); // backend đặt cookie access + refresh
    queryClient.clear(); // bỏ cache dữ liệu của phiên trước
    setSession(data);
  }, []);

  // Xóa sạch phiên phía client. Dùng cho cả logout chủ động lẫn hết phiên bị động.
  const resetSession = useCallback(() => {
    queryClient.clear();
    setSession(null);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {}); // backend xóa cookie; lỗi mạng cũng vẫn thoát phía client
    resetSession();
  }, [resetSession]);

  // Đồng bộ MST đang chọn theo access cookie mới sau mỗi lần refresh: backend hạ về null
  // nếu quyền vào MST cũ đã bị thu hồi -> company=null -> TenantGuard đá khỏi trang MST đó.
  const syncActiveCompany = useCallback((activeDonViId: string | null) => {
    setSession((s) => (s && s.activeDonViId !== activeDonViId ? { ...s, activeDonViId } : s));
  }, []);

  // apiClient nằm ngoài React nên báo về đây qua callback (refresh xong / hết phiên hẳn).
  useEffect(() => {
    setAuthEventHandlers({ onRefreshed: syncActiveCompany, onExpired: resetSession });
    return () => setAuthEventHandlers(null);
  }, [resetSession, syncActiveCompany]);

  const switchCompany = useCallback(async (id: string) => {
    const { activeDonViId } = await switchCompanyApi(id); // backend đặt access cookie mới
    queryClient.clear(); // dữ liệu đã nạp là của MST cũ — bỏ hết
    setSession((s) => (s ? { ...s, activeDonViId } : s));
  }, []);

  const addCompany = useCallback((company: AuthCompany, activate = false) => {
    setSession((s) => {
      if (!s) return s;
      const companies = s.companies.some((c) => c.id === company.id)
        ? s.companies
        : [...s.companies, company];
      return {
        ...s,
        companies,
        activeDonViId: activate ? company.id : s.activeDonViId,
      };
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const companies = session?.companies ?? [];
    return {
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      hydrating,
      companies,
      company: companies.find((c) => c.id === session?.activeDonViId) ?? null,
      login,
      logout,
      switchCompany,
      addCompany,
    };
  }, [session, hydrating, login, logout, switchCompany, addCompany]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

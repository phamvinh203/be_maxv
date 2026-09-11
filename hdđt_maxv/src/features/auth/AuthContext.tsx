import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  login as loginApi,
  logout as logoutApi,
  getMe,
} from "./api/authApi";
import {
  companyKeys,
  listCompanies,
  switchCompany as switchCompanyApi,
} from "../company/api/companyApi";
import { queryClient } from "../../lib/queryClient";
import { setSessionExpiredHandler } from "../../lib/http";
import { useGdtSession } from "../hddt/gdtSession/useGdtSession";
import { clearDvcKeys } from "../dich_vu_cong/dvcKeyStore";
import { AuthContext } from "./context";
import { MODULE_KEYS } from "./types";
import type { AuthCompany, AuthUser, UserModules } from "./types";

/**
 * Chưa đăng nhập / chưa biết quyền thì coi như không có module nào.
 * Dựng từ `MODULE_KEYS` để thêm module không phải sửa hằng số này.
 */
const KHONG_CO_MODULE = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, false]),
) as UserModules;

/**
 * Access/refresh token nằm ở cookie httpOnly (server quản lý) — client KHÔNG lưu token nữa.
 * User/công ty không persist vào localStorage; lúc tải trang gọi GET /auth/me để khôi phục phiên.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companies, setCompanies] = useState<AuthCompany[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [modules, setModules] = useState<UserModules>(KHONG_CO_MODULE);
  // true khi đang gọi /auth/me lúc mở app — chưa biết đăng nhập hay chưa (tránh nháy về /login).
  const [hydrating, setHydrating] = useState(true);
  // RVW-C02: cần trong resetSession() để dọn phiên GDT/khóa DVC ở CẢ hai đường hết phiên
  // (đăng xuất chủ động lẫn hết-phiên bị động), không chỉ đường đăng xuất chủ động như trước.
  const { clearGdtSession } = useGdtSession();

  // Bootstrap phiên từ cookie khi tải trang: 200 -> khôi phục; lỗi/401 -> coi như chưa đăng nhập.
  useEffect(() => {
    let alive = true;
    getMe()
      .then((data) => {
        if (!alive) return;
        setUser(data.user);
        setCompanies(data.companies);
        setCurrentCompanyId(data.activeDonViId);
        setModules(data.modules ?? KHONG_CO_MODULE);
        // RVW-C07: BE có thể trả `activeDonViId` khác `donViId` đang nhúng trong cookie access
        // (fallback khi quyền công ty trong token đã bị thu hồi — `loadUserSession`,
        // be_maxv/src/services/client/auth.service.ts:386-389) mà KHÔNG cấp lại cookie mới ->
        // mọi request sau đó vẫn đọc `donViId` cũ từ token, 403 hàng loạt dù header hiện công ty
        // khác. Vá tạm ở FE: đồng bộ lại cookie qua switchCompany, chạy nền không chặn hydrate.
        // ponytail: thêm 1 round-trip mỗi lần tải trang cho MỌI phiên (không chỉ ca fallback) vì
        // FE không biết fallback có xảy ra hay không; sửa gốc đúng là BE tự cấp lại cookie ngay
        // trong nhánh fallback của `loadUserSession`.
        if (data.activeDonViId) {
          switchCompanyApi(data.activeDonViId).catch(() => {});
        }
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
    setModules(data.modules ?? KHONG_CO_MODULE);
  }, []);

  // Xóa sạch phiên phía client (cache + state). Dùng cho cả logout chủ động lẫn hết phiên bị động.
  const resetSession = useCallback(() => {
    queryClient.clear();
    // RVW-C02: dọn token GDT (sessionStorage) + khóa phiên DVC (localStorage) ngay tại đây —
    // trước đây chỉ nút "Đăng xuất" dọn, hết phiên bị động (setSessionExpiredHandler) để sót
    // lại token/khóa của người trước trên máy dùng chung.
    clearGdtSession();
    clearDvcKeys();
    setUser(null);
    setCompanies([]);
    setCurrentCompanyId(null);
    setModules(KHONG_CO_MODULE);
  }, [clearGdtSession]);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {}); // server xóa cookie
    resetSession();
  }, [resetSession]);

  // apiFetch gọi handler này khi refresh cũng 401 (hết phiên hẳn) -> reset để ProtectedRoute về /login.
  useEffect(() => {
    setSessionExpiredHandler(resetSession);
    return () => setSessionExpiredHandler(null);
  }, [resetSession]);

  /**
   * Nạp lại danh sách công ty QUA cache của TanStack Query thay vì gọi thẳng `listCompanies`:
   * `useCompaniesQuery` (tab Quản lý công ty) quan sát đúng key này, nên một lượt fetch phục vụ
   * cả header lẫn bảng — trước đây mỗi lần thêm/sửa/xóa gọi `GET /companies` hai lần.
   * `staleTime: 0` để ép lấy mới: mặc định toàn app là 30s, mà đây luôn chạy ngay sau một lượt ghi.
   */
  const refreshCompanies = useCallback(async () => {
    setCompanies(
      await queryClient.fetchQuery({
        queryKey: companyKeys.list(user?.id),
        queryFn: listCompanies,
        staleTime: 0,
      }),
    );
  }, [user?.id]);

  const switchCompany = useCallback(async (id: string) => {
    const data = await switchCompanyApi(id); // server đặt cookie access mới nhúng donViId mới
    // RVW-C01: xóa sạch cache thay vì trông cậy quy ước "mọi queryKey phải có companyId" —
    // quy ước đó đã bị vi phạm thật (vd `dich_vu_cong/api/dvc.ts` QUERY_KEY_LICH_SU_DVC),
    // dọn cache ở nguồn chung này chặn rò dữ liệu công ty cũ bất kể query nào quên gắn id.
    queryClient.clear();
    setCurrentCompanyId(data.activeDonViId);
  }, []);

  // POST /companies với activate=true đã kèm cookie mới trong response — chỉ cần đồng bộ state,
  // không gọi API như `switchCompany`, nên dùng thẳng setter (identity đã ổn định sẵn).
  const setActiveCompany = setCurrentCompanyId;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      hydrating,
      companies,
      currentCompanyId,
      modules,
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
      modules,
      login,
      logout,
      refreshCompanies,
      switchCompany,
      setActiveCompany,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { useMutation } from '@tanstack/react-query';
import { login, register, logout } from '@/features/auth/api/authApi';
import { switchCompany } from '@/features/company/api/companyApi';
import {
  getToken,
  getUser,
  getCompany,
  getCompanies,
  setToken,
  setUser,
  setCompany,
  setCompanies,
  clearSession,
} from '@/features/auth/token';
import type { AuthCompany, AuthUser } from '@/features/auth/types/auth';

export function useLogin() {
  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      setToken(data.accessToken);
      setUser(data.user);
      setCompanies(data.companies);

      // Chọn công ty đang làm việc: ưu tiên cái backend đã tự chọn (activeDonViId),
      // nếu tài khoản có nhiều MST (backend để null) thì mặc định MST đầu tiên.
      const active =
        data.companies.find((c) => c.id === data.activeDonViId) ??
        data.companies[0] ??
        null;
      setCompany(active);

      // Nếu token chưa gắn đúng MST (nhiều MST -> activeDonViId null), switch để
      // token nhúng donViId của MST mặc định, đảm bảo tenant DB resolve đúng.
      if (active && active.id !== data.activeDonViId) {
        const res = await switchCompany(active.id);
        setToken(res.accessToken);
      }
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: register });
}

export function useLogout() {
  return useMutation({
    mutationFn: logout,
    onSettled: () => clearSession(),
  });
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function getCurrentUser(): AuthUser | null {
  return getUser();
}

export function getCurrentCompany(): AuthCompany | null {
  return getCompany();
}

/** Danh sách MST tài khoản được phép — Select đổi MST ở header đọc từ đây. */
export function getCurrentCompanies(): AuthCompany[] {
  return getCompanies();
}

/**
 * Sau khi tạo công ty (registerCompany) thành công: gắn donViId cho user hiện tại,
 * đặt làm company đang chọn, và thêm MST mới vào danh sách để Select thấy ngay.
 */
export function attachCompanyToSession(company: AuthCompany): void {
  const user = getUser();
  if (user) setUser({ ...user, donViId: company.id });
  setCompany(company);

  const companies = getCompanies();
  if (!companies.some((c) => c.id === company.id)) {
    setCompanies([...companies, company]);
  }
}

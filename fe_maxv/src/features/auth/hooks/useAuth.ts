import { useMutation } from '@tanstack/react-query';
import { login, register, logout } from '@/features/auth/api/authApi';
import {
  getToken,
  getUser,
  getCompany,
  setToken,
  setUser,
  setCompany,
  clearSession,
} from '@/features/auth/token';
import type { AuthCompany, AuthUser } from '@/features/auth/types/auth';

export function useLogin() {
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setToken(data.accessToken);
      setUser(data.user);
      setCompany(data.company);
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

/** Sau khi tạo công ty (registerCompany) thành công: gắn donViId cho user hiện tại + lưu company. */
export function attachCompanyToSession(company: AuthCompany): void {
  const user = getUser();
  if (user) setUser({ ...user, donViId: company.id });
  setCompany(company);
}

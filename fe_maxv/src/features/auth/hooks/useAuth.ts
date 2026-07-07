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
    onSuccess: (data) => {
      setToken(data.accessToken);
      setUser(data.user);
      setCompanies(data.companies);
      // Backend luôn gắn activeDonViId = MST mặc định (công ty đầu) khi tài khoản có
      // MST, nên token đã trỏ đúng tenant — chỉ cần lưu công ty đang chọn.
      setCompany(data.companies.find((c) => c.id === data.activeDonViId) ?? null);
    },
  });
}

/** Đổi công ty đang làm việc ở tầng token: switch (backend cấp token mới) + lưu lại. */
export async function switchToCompany(id: string): Promise<void> {
  const res = await switchCompany(id);
  setToken(res.accessToken);
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
 * Thêm 1 MST vào danh sách mà KHÔNG đổi công ty đang chọn (dùng khi tạo thêm MST
 * ở trang Cài đặt — để Select header thấy, còn phiên vẫn ở công ty hiện tại).
 */
export function addCompanyToList(company: AuthCompany): void {
  const companies = getCompanies();
  if (!companies.some((c) => c.id === company.id)) {
    setCompanies([...companies, company]);
  }
}

/**
 * Sau khi tạo công ty (registerCompany) thành công: đặt làm company đang chọn,
 * và thêm MST mới vào danh sách để Select thấy ngay.
 */
export function attachCompanyToSession(company: AuthCompany): void {
  setCompany(company);
  addCompanyToList(company);
}

import { useMutation } from '@tanstack/react-query';
import { login, logout } from '@/features/auth/api/authApi';
import { getToken, getUser, setToken, setUser, clearSession } from '@/features/auth/token';
import type { AuthUser } from '@/features/auth/types/auth';

export function useLogin() {
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setToken(data.accessToken);
      setUser(data.user);
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: logout,
    onSettled: () => clearSession(), // xóa phiên kể cả khi API logout lỗi
  });
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

// Đọc user 1 lần (không reactive) — đặt tên không có tiền tố `use` để khỏi
// ngầm hứa hẹn re-render theo thay đổi. Header re-render theo điều hướng.
export function getCurrentUser(): AuthUser | null {
  return getUser();
}

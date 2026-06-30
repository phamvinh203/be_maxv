import { useMutation } from '@tanstack/react-query';
import { login, register, logout } from '@/features/auth/api/authApi';
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

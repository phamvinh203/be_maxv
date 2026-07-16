import { useContext } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AuthContext } from '@/features/auth/context';
import { register } from '@/features/auth/api/authApi';
import type { AuthContextValue } from '@/features/auth/types/auth';

/** Phiên đăng nhập hiện tại (user, MST đang chọn, login/logout/switch). */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}

/** Đăng nhập — bọc AuthProvider.login trong mutation để form có isPending/onError. */
export function useLogin() {
  const { login } = useAuth();
  return useMutation({ mutationFn: login });
}

/** Đăng xuất — bọc AuthProvider.logout để menu header có trạng thái isPending. */
export function useLogout() {
  const { logout } = useAuth();
  return useMutation({ mutationFn: logout });
}

/** Đăng ký tài khoản — chưa tạo phiên (đăng ký xong vẫn phải đăng nhập). */
export function useRegister() {
  return useMutation({ mutationFn: register });
}

import type { JSX } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { FullPageSpinner } from '@/components/FullPageSpinner';

/**
 * "/" -> điều hướng theo trạng thái đăng nhập. Phải là component (không phải beforeLoad):
 * lúc mở app phiên còn đang khôi phục từ cookie qua /auth/me, chưa kết luận được.
 */
export function IndexRedirect(): JSX.Element {
  const { isAuthenticated, hydrating } = useAuth();

  if (hydrating) return <FullPageSpinner />;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

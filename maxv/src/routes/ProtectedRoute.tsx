import type { JSX, ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { FullPageSpinner } from '@/components/FullPageSpinner';

interface Props {
  children: ReactNode;
}

/**
 * Bọc quanh route cần đăng nhập. Phiên nằm ở cookie httpOnly nên FE không tự biết được —
 * phải chờ /auth/me trả lời xong (hydrating) rồi mới kết luận, nếu không sẽ nháy về /login
 * ở mỗi lần tải trang dù đang có phiên hợp lệ.
 *
 * Cố ý dùng component thay cho `beforeLoad` của router: beforeLoad chỉ chạy lúc điều hướng,
 * còn hết phiên (refresh 401 -> onExpired) xảy ra giữa lúc đang đứng yên trên một trang —
 * component thì tự re-render theo state auth và đá về /login ngay.
 */
export function ProtectedRoute({ children }: Props): JSX.Element {
  const { isAuthenticated, hydrating } = useAuth();

  if (hydrating) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

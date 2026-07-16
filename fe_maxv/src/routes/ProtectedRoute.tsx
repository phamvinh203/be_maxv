import type { JSX, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import FullPageSpinner from '@/components/FullPageSpinner';

interface Props {
  children: ReactNode;
}

/**
 * Bọc quanh route cần đăng nhập. Phiên nằm ở cookie httpOnly nên FE không tự biết được —
 * phải chờ /auth/me trả lời xong (hydrating) rồi mới kết luận, nếu không sẽ nháy về /login
 * ở mỗi lần tải trang dù đang có phiên hợp lệ.
 */
export default function ProtectedRoute({ children }: Props): JSX.Element {
  const { isAuthenticated, hydrating } = useAuth();

  if (hydrating) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

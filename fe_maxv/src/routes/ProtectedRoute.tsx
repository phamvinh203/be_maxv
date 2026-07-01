import type { JSX, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/features/auth/hooks/useAuth';

interface Props {
  children: ReactNode;
}

/** Bọc quanh route cần đăng nhập — chưa có token thì đá về /login. */
export default function ProtectedRoute({ children }: Props): JSX.Element {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

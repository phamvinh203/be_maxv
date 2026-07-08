import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

interface Props {
  children: ReactNode;
}

/** Bọc quanh route cần đăng nhập — chưa có user thì đá về /login. */
export default function ProtectedRoute({ children }: Props) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

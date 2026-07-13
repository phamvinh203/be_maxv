import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import FullScreenLoader from "../components/FullScreenLoader";

interface Props {
  children: ReactNode;
}

/** Bọc quanh route cần đăng nhập — chưa có user thì đá về /login. */
export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, hydrating } = useAuth();
  // Đang khôi phục phiên từ cookie — chờ xong rồi mới quyết, tránh nháy về /login.
  if (hydrating) {
    return <FullScreenLoader />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

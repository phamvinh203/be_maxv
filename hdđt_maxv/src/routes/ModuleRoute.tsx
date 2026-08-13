import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import FullScreenLoader from "../components/FullScreenLoader";
import type { UserModules } from "../features/auth/types";

interface Props {
  module: keyof UserModules;
  children: ReactNode;
}

/**
 * Bọc quanh route của một module admin bật/tắt được — chưa được cấp thì về trang chính.
 *
 * Ẩn nút trên header là chuyện hiển thị; không có guard này thì gõ thẳng
 * `/hrm` vào thanh địa chỉ vẫn vào được. Guard cũng chỉ là lớp thứ hai: khi
 * HRM có API thật, mọi endpoint `/api/v1/hrm/*` vẫn phải tự kiểm tra ở backend.
 */
export default function ModuleRoute({ module, children }: Props) {
  const { modules, hydrating } = useAuth();
  // Chờ /auth/me xong rồi mới quyết — không thì màn hình nháy về trang chính.
  if (hydrating) {
    return <FullScreenLoader />;
  }
  if (!modules[module]) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

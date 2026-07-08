import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "../App";
import AuthPage from "../pages/AuthPage";
import HomePage from "../pages/HomePage";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../features/auth/useAuth";

/** Đã đăng nhập thì /login tự chuyển về trang chính. */
function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

/** Toàn bộ path của ứng dụng khai báo tại đây. */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="login" element={<LoginRoute />} />
          <Route
            index
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          {/* Bắt mọi path không khớp, tránh màn hình trắng khi gõ sai URL */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

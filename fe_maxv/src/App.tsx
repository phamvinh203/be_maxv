import type { JSX } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Root layout của toàn bộ route. Hiện chỉ render Outlet để các route con
 * (login/register/app) tự quyết định UI — đây là nơi gắn thêm ErrorBoundary,
 * Suspense fallback, hoặc provider dùng chung cho mọi trang khi cần.
 */
export default function App(): JSX.Element {
  return <Outlet />;
}

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.route';
import { AdminLayout } from '@/components/AdminLayout';
import { QueryError } from '@/components/QueryError';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Layout route (pathless, id='admin'): bọc mọi trang admin,
 * chặn truy cập nếu chưa đăng nhập, và là error boundary chung.
 */
export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin',
  component: () => (
    <ProtectedRoute>
      <AdminLayout />
    </ProtectedRoute>
  ),
  errorComponent: ({ error }) => <QueryError error={error} />,
});

import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './root.route';
import { AdminLayout } from '@/components/AdminLayout';
import { QueryError } from '@/components/QueryError';
import { isAuthenticated } from '@/features/auth/hooks/useAuth';

/**
 * Layout route (pathless, id='admin'): bọc mọi trang admin,
 * chặn truy cập nếu chưa đăng nhập, và là error boundary chung.
 */
export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin',
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' });
  },
  component: AdminLayout,
  errorComponent: ({ error }) => <QueryError error={error} />,
});

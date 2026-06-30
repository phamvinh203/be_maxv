import { createRoute, createRouter, redirect } from '@tanstack/react-router';
import { rootRoute } from './root.route';
import { loginRoute } from './login.route';
import { adminRoute } from './admin.route';
import { companiesRoute, companyDetailRoute } from './companies.route';
import { logsRoute } from './logs.route';
import { subscriptionsRoute } from './subscriptions.route';
import { usersRoute } from './users.route';
import { dashboardRoute, invitesRoute, opsRoute } from './stubs.route';
import { isAuthenticated } from '@/features/auth/hooks/useAuth';

// "/" -> điều hướng theo trạng thái đăng nhập.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: isAuthenticated() ? '/dashboard' : '/login' });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  adminRoute.addChildren([
    dashboardRoute,
    companiesRoute,
    companyDetailRoute,
    invitesRoute,
    subscriptionsRoute,
    usersRoute,
    logsRoute,
    opsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
  // Metadata gắn trên route (vd tiêu đề hiển thị ở header).
  interface StaticDataRouteOption {
    title?: string;
    description?: string;
  }
}

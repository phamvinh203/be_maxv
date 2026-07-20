import { createRoute, createRouter } from '@tanstack/react-router';
import { rootRoute } from './root.route';
import { loginRoute } from './login.route';
import { adminRoute } from './admin.route';
import { companiesRoute, companyDetailRoute } from './companies.route';
import { ownersRoute, ownerDetailRoute } from './owners.route';
import { logsRoute } from './logs.route';
import { subscriptionsRoute } from './subscriptions.route';
import { usersRoute } from './users.route';
import { invitesRoute } from './invites.route';
import { dashboardRoute, opsRoute } from './stubs.route';
import { IndexRedirect } from './IndexRedirect';

// "/" -> điều hướng theo trạng thái đăng nhập (xem IndexRedirect).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexRedirect,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  adminRoute.addChildren([
    dashboardRoute,
    ownersRoute,
    ownerDetailRoute,
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

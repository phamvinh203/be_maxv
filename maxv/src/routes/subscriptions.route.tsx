import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { SubscriptionsPage } from '@/pages/subscriptions/SubscriptionsPage';

export const subscriptionsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/subscriptions',
  staticData: { title: 'Thuê bao' },
  component: SubscriptionsPage,
});

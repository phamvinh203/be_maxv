import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { UsersPage } from '@/pages/users/UsersPage';

export const usersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/users',
  staticData: { title: 'Người dùng' },
  component: UsersPage,
});

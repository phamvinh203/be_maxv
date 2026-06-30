import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { LogsPage } from '@/pages/logs/LogsPage';

export const logsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/logs',
  staticData: { title: 'Nhật ký hệ thống' },
  component: LogsPage,
});

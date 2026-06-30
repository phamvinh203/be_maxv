import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { StubPage } from '@/components/StubPage';

// Các tab đã có route + điều hướng; nội dung bổ sung sau.
// StubPage đọc title/description từ staticData. Path để literal cho TanStack
// Router suy đúng kiểu route tree.

export const dashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/dashboard',
  staticData: {
    title: 'Tổng quan',
    description:
      'Số liệu tổng hợp: số đơn vị theo trạng thái, thuê bao, trial sắp hết hạn.',
  },
  component: StubPage,
});

export const invitesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/invites',
  staticData: {
    title: 'Nhân viên',
    description: 'Duyệt/từ chối lời mời nhân viên do chủ đơn vị gửi.',
  },
  component: StubPage,
});

export const subscriptionsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/subscriptions',
  staticData: {
    title: 'Thuê bao',
    description: 'Quản lý gói & thuê bao của các đơn vị: đổi gói, gia hạn, hủy.',
  },
  component: StubPage,
});

export const usersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/users',
  staticData: {
    title: 'Người dùng',
    description:
      'Danh sách người dùng toàn hệ thống: kích hoạt, đặt lại mật khẩu.',
  },
  component: StubPage,
});

export const opsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/ops',
  staticData: {
    title: 'Vận hành',
    description: 'Đối soát db_sys ↔ PostgreSQL, dọn DB hết hạn (GC).',
  },
  component: StubPage,
});

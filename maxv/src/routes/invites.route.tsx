import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { InvitePage } from '@/pages/invites/InvitePage';

export const invitesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/invites',
  staticData: {
    title: 'Nhân viên',
    description: 'Duyệt/từ chối lời mời nhân viên do chủ đơn vị gửi.',
  },
  component: InvitePage,
});

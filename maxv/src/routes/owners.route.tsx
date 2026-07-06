import { createRoute } from '@tanstack/react-router';
import { adminRoute } from './admin.route';
import { OwnersPage } from '@/pages/owners/OwnersPage';
import { OwnerDetailPage } from '@/pages/owners/OwnerDetailPage';

export const ownersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/owners',
  staticData: { title: 'Tài khoản' },
  component: OwnersPage,
});

export const ownerDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/owners/$ownerId',
  staticData: { title: 'Chi tiết tài khoản' },
  component: () => {
    const { ownerId } = ownerDetailRoute.useParams();
    return <OwnerDetailPage ownerId={ownerId} />;
  },
});

import type { JSX, ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { getCurrentCompany } from '@/features/auth/hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';

interface Props {
  children: ReactNode;
}

/** Cần đã có công ty (donVi), và :slug trên URL phải khớp slug công ty đang đăng nhập. */
function TenantGuard({ children }: Props): JSX.Element {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();

  const company = getCurrentCompany();
  if (!company) {
    return <Navigate to="/setup-company" replace />;
  }

  if (slug !== company.slug) {
    // Giữ nguyên phần path sau :slug (segment đầu tiên), chỉ thay slug sai bằng slug đúng.
    const rest = location.pathname.split('/').slice(2).join('/');
    return <Navigate to={`/${company.slug}${rest ? `/${rest}` : ''}`} replace />;
  }

  return <>{children}</>;
}

/** Bọc quanh route /:slug/... — cần đăng nhập (ProtectedRoute) và đúng tenant (TenantGuard). */
export default function RequireTenant({ children }: Props): JSX.Element {
  return (
    <ProtectedRoute>
      <TenantGuard>{children}</TenantGuard>
    </ProtectedRoute>
  );
}

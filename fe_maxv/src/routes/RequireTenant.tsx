import type { JSX, ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { isAuthenticated, getCurrentCompany } from '@/features/auth/hooks/useAuth';

interface Props {
  children: ReactNode;
}

/**
 * Bọc quanh route /:slug/... — cần đăng nhập, cần đã có công ty (donVi), và :slug
 * trên URL phải khớp slug công ty đang đăng nhập. Gõ nhầm/sai slug -> tự đưa về
 * đúng slug của mình (giữ nguyên phần path còn lại).
 */
export default function RequireTenant({ children }: Props): JSX.Element {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const company = getCurrentCompany();
  if (!company) {
    return <Navigate to="/setup-company" replace />;
  }

  if (slug !== company.slug) {
    return (
      <Navigate to={location.pathname.replace(`/${slug}`, `/${company.slug}`)} replace />
    );
  }

  return <>{children}</>;
}

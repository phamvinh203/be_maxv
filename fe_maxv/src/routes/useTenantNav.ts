import { useNavigate, useParams } from 'react-router-dom';

/** Điều hướng trong phạm vi tenant hiện tại — giữ nguyên :slug trên URL. */
export function useTenantNav() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const goTo = (path: string) => navigate(`/${slug}/${path}`);

  return { slug, goTo };
}

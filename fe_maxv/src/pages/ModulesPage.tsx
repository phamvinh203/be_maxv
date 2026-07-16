import { type JSX } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ModulePage from '../components/ModulePage';
import { MODULES, defaultModulePath } from '../config/modules';
import { useTenantNav } from '../routes/useTenantNav';

interface Props {
  onLogout: () => void;
}

export default function ModulesPage({ onLogout }: Props): JSX.Element {
  const navigate = useNavigate();
  const { slug, goTo } = useTenantNav();
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const config = moduleSlug ? MODULES[moduleSlug] : undefined;

  // Path trong config có sẵn dạng "/ton_kho/danh_muc/..." -> ghép /:slug ở trước.
  const openPath = (path: string) => navigate(`/${slug}${path}`);

  if (!config) {
    // slug chắc chắn có: ModulesPage chỉ render dưới RequireTenant (đã khớp slug công ty).
    return <Navigate to={defaultModulePath(slug!)} replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={onLogout} onSettings={() => goTo('settings')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active={moduleSlug!} onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ModulePage config={config} onNavigate={openPath} />
        </div>
      </div>
    </div>
  );
}

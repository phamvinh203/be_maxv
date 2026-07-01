import { type JSX } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ModulePage from '../components/ModulePage';
import { MODULES, MODULE_ORDER } from '../config/modules';
import { useTenantNav } from '../routes/useTenantNav';

interface Props {
  onLogout: () => void;
}

export default function ModulesPage({ onLogout }: Props): JSX.Element {
  const { slug, goTo } = useTenantNav();
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const config = moduleSlug ? MODULES[moduleSlug] : undefined;

  if (!config) {
    return <Navigate to={`/${slug}/${MODULE_ORDER[0].slug}`} replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={onLogout} onSettings={() => goTo('settings')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active={moduleSlug!} onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* onNavigate để trống: chỉ hiển thị giao diện, chưa nối điều hướng */}
          <ModulePage config={config} />
        </div>
      </div>
    </div>
  );
}

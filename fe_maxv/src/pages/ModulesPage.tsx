import { type JSX } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ModulePage from '../components/ModulePage';
import { MODULES, MODULE_ORDER } from '../config/modules';

interface Props {
  onLogout: () => void;
}

export default function ModulesPage({ onLogout }: Props): JSX.Element {
  const navigate = useNavigate();
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const config = moduleSlug ? MODULES[moduleSlug] : undefined;

  if (!config) {
    return <Navigate to={`/${MODULE_ORDER[0].slug}`} replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={onLogout} onSettings={() => navigate('/settings')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active={moduleSlug!} onSelect={(slug) => navigate(`/${slug}`)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* onNavigate để trống: chỉ hiển thị giao diện, chưa nối điều hướng */}
          <ModulePage config={config} />
        </div>
      </div>
    </div>
  );
}

import { type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';

import SettingsContent from '@/pages/settings/SettingsContent';
import AppSidebar from '@/components/AppSidebar';
import { useTenantNav } from '@/routes/useTenantNav';

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const { goTo } = useTenantNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={() => navigate('/login')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="settings" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#f0f4f8' }}>
          <SettingsContent />
        </div>
      </div>
    </div>
  );
}

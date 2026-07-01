import { type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';

import EmployeesSettingsPage from '@/pages/settings/EmployeesSettingsPage';
import AppSidebar from '@/components/AppSidebar';

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={() => navigate('/login')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="employees" onSelect={(slug) => navigate(`/${slug}`)} />
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#f0f4f8' }}>
          <EmployeesSettingsPage />
        </div>
      </div>
    </div>
  );
}

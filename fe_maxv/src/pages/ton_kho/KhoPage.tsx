import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/components/AppSidebar';
import { useTenantNav } from '@/routes/useTenantNav';
import { KhoList } from '@/features/ton_kho/danh_muc/kho/components/KhoList';

/** Trang Tồn kho › Danh mục › Kho hàng. */
export default function KhoPage(): JSX.Element {
  const navigate = useNavigate();
  const { goTo } = useTenantNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={() => navigate('/login')} onSettings={() => goTo('settings')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="ton_kho" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <KhoList />
          </div>
        </div>
      </div>
    </div>
  );
}

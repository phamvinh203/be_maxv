import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/components/AppSidebar';
import { useTenantNav } from '@/routes/useTenantNav';
import { DvtList } from '@/features/ton_kho/danh_muc/dvt/components/DvtList';

/** Trang Tồn kho › Danh mục › Đơn vị tính. Giữ nguyên khung header + sidebar. */
export default function DvtPage(): JSX.Element {
  const navigate = useNavigate();
  const { goTo } = useTenantNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={() => navigate('/login')} onSettings={() => goTo('settings')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="ton_kho" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DvtList />
          </div>
        </div>
      </div>
    </div>
  );
}

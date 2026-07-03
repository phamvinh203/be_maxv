import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/components/AppSidebar';
import { useTenantNav } from '@/routes/useTenantNav';
import { PhongBanList } from '@/features/tong_hop/danh_muc/phong_ban/components/PhongBanList';

/** Trang Tổng hợp › Danh mục › Phòng ban. Giữ nguyên khung header + sidebar. */
export default function PhongBanPage(): JSX.Element {
  const navigate = useNavigate();
  const { goTo } = useTenantNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={() => navigate('/login')} onSettings={() => goTo('settings')} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="tong_hop" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PhongBanList />
          </div>
        </div>
      </div>
    </div>
  );
}

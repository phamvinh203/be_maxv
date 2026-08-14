import type { JSX } from 'react';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/features/accounting/_shared/AppSidebar';
import { useKeToanNav } from '@/routes/useKeToanNav';
import { PhongBanList } from '@/features/accounting/tong_hop/danh_muc/phong_ban/components/PhongBanList';

/** Trang Tổng hợp › Danh mục › Phòng ban. Giữ nguyên khung header + sidebar. */
export default function PhongBanPage(): JSX.Element {
  const { goTo } = useKeToanNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
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

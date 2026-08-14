import type { JSX } from 'react';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/features/accounting/_shared/AppSidebar';
import { useKeToanNav } from '@/routes/useKeToanNav';
import { TienTeList } from '@/features/accounting/tong_hop/danh_muc/tien_te/components/TienTeList';

/** Trang Tổng hợp › Danh mục › Tiền tệ. Giữ nguyên khung header + sidebar. */
export default function TienTePage(): JSX.Element {
  const { goTo } = useKeToanNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="tong_hop" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <TienTeList />
          </div>
        </div>
      </div>
    </div>
  );
}

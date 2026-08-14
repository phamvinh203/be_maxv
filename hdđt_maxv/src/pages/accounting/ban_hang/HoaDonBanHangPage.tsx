import type { JSX } from 'react';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/features/accounting/_shared/AppSidebar';
import { useKeToanNav } from '@/routes/useKeToanNav';
import { HoaDonList } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/components/HoaDonList';

/** Trang Bán hàng › Chứng từ › Hóa đơn bán hàng. Giữ nguyên khung header + sidebar. */
export default function HoaDonBanHangPage(): JSX.Element {
  const { goTo } = useKeToanNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="ban_hang" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <HoaDonList />
          </div>
        </div>
      </div>
    </div>
  );
}

import type { JSX } from 'react';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/features/accounting/_shared/AppSidebar';
import { useKeToanNav } from '@/routes/useKeToanNav';
import { HangHoaList } from '@/features/accounting/ton_kho/danh_muc/hang_hoa/components/HangHoaList';

/** Trang Tồn kho › Danh mục › Hàng hóa, vật tư. Giữ nguyên khung header + sidebar. */
export default function HangHoaPage(): JSX.Element {
  const { goTo } = useKeToanNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="ton_kho" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <HangHoaList />
          </div>
        </div>
      </div>
    </div>
  );
}

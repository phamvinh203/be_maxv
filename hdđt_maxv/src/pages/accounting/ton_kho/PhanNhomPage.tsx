import type { JSX } from 'react';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/features/accounting/_shared/AppSidebar';
import { useKeToanNav } from '@/routes/useKeToanNav';
import { PhanNhomList } from '@/features/accounting/ton_kho/danh_muc/phan_nhom/components/PhanNhomList';

/** Trang Tồn kho › Danh mục › Phân nhóm hàng hóa, vật tư. */
export default function PhanNhomPage(): JSX.Element {
  const { goTo } = useKeToanNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="ton_kho" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PhanNhomList />
          </div>
        </div>
      </div>
    </div>
  );
}

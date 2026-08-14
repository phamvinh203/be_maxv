import type { JSX } from 'react';
import AppHeader from '@/components/AppHeader';
import AppSidebar from '@/features/accounting/_shared/AppSidebar';
import { useKeToanNav } from '@/routes/useKeToanNav';
import { LoaiVtList } from '@/features/accounting/ton_kho/danh_muc/loai_vt/components/LoaiVtList';

/** Trang Tồn kho › Danh mục › Loại vật tư. */
export default function LoaiVtPage(): JSX.Element {
  const { goTo } = useKeToanNav();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active="ton_kho" onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LoaiVtList />
          </div>
        </div>
      </div>
    </div>
  );
}

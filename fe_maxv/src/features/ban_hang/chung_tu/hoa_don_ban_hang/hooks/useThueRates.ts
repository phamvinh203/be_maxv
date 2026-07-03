import { useMemo } from 'react';
import { useThueList } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/hooks/useThueList';

/** Map Mã thuế -> thuế suất % (từ danh mục thuế GTGT dmthue). */
export function useThueRates(): Map<string, number> {
  const { data } = useThueList();

  return useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data ?? []) m.set(r.ma_thue, Number(r.ty_le) || 0);
    return m;
  }, [data]);
}

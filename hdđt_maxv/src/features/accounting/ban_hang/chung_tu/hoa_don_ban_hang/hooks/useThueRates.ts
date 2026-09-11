import { useMemo } from 'react';
import { useThueList } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/hooks/useThueList';

/** Map Mã thuế -> thuế suất % (từ danh mục thuế GTGT dmthue) + trạng thái tải. */
export function useThueRates(): { rates: Map<string, number>; isLoading: boolean } {
  const { data, isLoading } = useThueList();

  const rates = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data ?? []) m.set(r.ma_thue, Number(r.ty_le) || 0);
    return m;
  }, [data]);

  return { rates, isLoading };
}

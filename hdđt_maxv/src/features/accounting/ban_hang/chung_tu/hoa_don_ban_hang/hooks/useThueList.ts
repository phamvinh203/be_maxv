import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';

export interface ThueItem {
  ma_thue: string;
  ten_thue: string;
  ty_le: string | number | null;
}

/** Danh mục suất thuế GTGT (dmthue). */
export function useThueList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['thue', 'list'],
    queryFn: () => api.get<ThueItem[]>('/ton-kho/thue'),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

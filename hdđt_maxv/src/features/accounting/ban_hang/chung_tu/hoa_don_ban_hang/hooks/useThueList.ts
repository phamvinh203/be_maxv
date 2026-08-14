import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/useAuth';

export interface ThueItem {
  ma_thue: string;
  ten_thue: string;
  ty_le: string | number | null;
}

/** Danh mục suất thuế GTGT (dmthue). */
export function useThueList(options?: { enabled?: boolean }) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    // Gắn companyId — API theo tenant qua cookie, không tự đổi khi đổi công ty.
    queryKey: ['thue', currentCompanyId, 'list'],
    queryFn: () => api.get<ThueItem[]>('/ton-kho/thue'),
    staleTime: 5 * 60 * 1000,
    enabled: (options?.enabled ?? true) && isAuthenticated && !!currentCompanyId,
  });
}

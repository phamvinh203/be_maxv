import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { listLogs, listLogActions } from '@/features/logs/api/logsApi';
import type { ListLogsParams } from '@/features/logs/types/log';

export const logKeys = {
  all: ['logs'] as const,
  list: (params: ListLogsParams) => [...logKeys.all, 'list', params] as const,
  actions: () => [...logKeys.all, 'actions'] as const,
};

export function useLogs(params: ListLogsParams) {
  return useSuspenseQuery({
    queryKey: logKeys.list(params),
    queryFn: () => listLogs(params),
  });
}

/**
 * Danh sách hành động cho dropdown lọc. Dùng useQuery (không suspense) vì nằm
 * ngoài Suspense boundary của bảng; ít đổi nên cache lâu.
 */
export function useLogActions() {
  return useQuery({
    queryKey: logKeys.actions(),
    queryFn: listLogActions,
    staleTime: 5 * 60_000,
  });
}

import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type { SysLog, ListLogsParams } from '@/features/logs/types/log';

export function listLogs(params: ListLogsParams): Promise<Paginated<SysLog>> {
  return api.get<Paginated<SysLog>>('/admin/logs', { params });
}

/** Danh sách hành động distinct đang có trong syslog (cho dropdown lọc). */
export function listLogActions(): Promise<string[]> {
  return api.get<string[]>('/admin/logs/actions');
}

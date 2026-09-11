import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';

/**
 * Danh mục module bật/tắt được cho từng tài khoản — đọc từ backend
 * (`GET /admin/modules`, nguồn là `be_maxv/src/constants/modules.ts`) nên
 * thêm module mới ở BE là admin tự hiện thêm cột bảng/ô tick gói.
 */
export type ModuleKey = string;

export type UserModules = Record<ModuleKey, boolean>;

export interface ModuleInfo {
  key: string;
  /** Nhãn ngắn cho cột bảng và ô tick trong form gói. */
  nhanNgan: string;
  moTa: string;
}

export const moduleKeys = { all: ['modules'] as const };

export function useModules() {
  return useQuery({
    queryKey: moduleKeys.all,
    queryFn: () => api.get<ModuleInfo[]>('/admin/modules'),
  });
}

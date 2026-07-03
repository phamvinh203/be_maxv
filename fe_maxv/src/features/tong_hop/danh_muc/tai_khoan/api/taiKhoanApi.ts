import { api } from '@/lib/apiClient';
import type {
  TaiKhoan,
  TaiKhoanForm,
  TaiKhoanListParams,
} from '@/features/tong_hop/danh_muc/tai_khoan/types';

const BASE = '/tong-hop/tai-khoan';

export function listTaiKhoan(params?: TaiKhoanListParams): Promise<TaiKhoan[]> {
  return api.get<TaiKhoan[]>(BASE, { params });
}

export function createTaiKhoan(body: TaiKhoanForm): Promise<{ tk: string }> {
  return api.post(BASE, body);
}

export function updateTaiKhoan(
  tk: string,
  body: TaiKhoanForm,
): Promise<{ tk: string }> {
  return api.put(`${BASE}/${encodeURIComponent(tk)}`, body);
}

export function deleteTaiKhoan(tk: string): Promise<{ tk: string }> {
  return api.del(`${BASE}/${encodeURIComponent(tk)}`);
}

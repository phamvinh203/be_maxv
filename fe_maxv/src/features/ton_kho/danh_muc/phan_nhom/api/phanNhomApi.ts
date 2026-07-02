import { api } from '@/lib/apiClient';
import type {
  PhanNhom,
  PhanNhomForm,
  PhanNhomListParams,
} from '@/features/ton_kho/danh_muc/phan_nhom/types';

const BASE = '/ton-kho/phan-nhom';

export function listPhanNhom(params?: PhanNhomListParams): Promise<PhanNhom[]> {
  return api.get<PhanNhom[]>(BASE, { params });
}

export function createPhanNhom(
  body: PhanNhomForm,
): Promise<{ loai_nh: number; ma_nh: string }> {
  return api.post(BASE, body);
}

/** id = "loai_nh-ma_nh" của bản ghi gốc. */
export function updatePhanNhom(
  id: string,
  body: PhanNhomForm,
): Promise<{ loai_nh: number; ma_nh: string }> {
  return api.put(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deletePhanNhom(
  id: string,
): Promise<{ loai_nh: number; ma_nh: string }> {
  return api.del(`${BASE}/${encodeURIComponent(id)}`);
}

import { api } from '@/lib/apiClient';
import type {
  LoaiVt,
  LoaiVtForm,
  LoaiVtListParams,
} from '@/features/accounting/ton_kho/danh_muc/loai_vt/types';

const BASE = '/ton-kho/loai-vt';

export function listLoaiVt(params?: LoaiVtListParams): Promise<LoaiVt[]> {
  return api.get<LoaiVt[]>(BASE, { params });
}

export function createLoaiVt(body: LoaiVtForm): Promise<{ ma_loai_vt: string }> {
  return api.post(BASE, body);
}

export function updateLoaiVt(
  maLoai: string,
  body: LoaiVtForm,
): Promise<{ ma_loai_vt: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maLoai)}`, body);
}

export function deleteLoaiVt(maLoai: string): Promise<{ ma_loai_vt: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maLoai)}`);
}

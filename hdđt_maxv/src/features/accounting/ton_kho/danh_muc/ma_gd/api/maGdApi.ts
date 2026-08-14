import { api } from '@/lib/apiClient';
import type {
  MaGd,
  MaGdForm,
  MaGdListParams,
} from '@/features/accounting/ton_kho/danh_muc/ma_gd/types';

const BASE = '/ton-kho/ma-gd';

const seg = (v: string) => encodeURIComponent(v);

export function listMaGd(params?: MaGdListParams): Promise<MaGd[]> {
  return api.get<MaGd[]>(BASE, { params });
}

export function createMaGd(
  body: MaGdForm,
): Promise<{ ma_ct: string; ma_gd: string }> {
  return api.post(BASE, body);
}

/** Sửa (không đổi khóa) — BE chỉ đọc loai_ct/ten_gd/ten_gd2/status. */
export function updateMaGd(
  maCt: string,
  maGd: string,
  body: MaGdForm,
): Promise<{ ma_ct: string; ma_gd: string }> {
  return api.put(`${BASE}/${seg(maCt)}/${seg(maGd)}`, body);
}

export function deleteMaGd(
  maCt: string,
  maGd: string,
): Promise<{ ma_ct: string; ma_gd: string }> {
  return api.del(`${BASE}/${seg(maCt)}/${seg(maGd)}`);
}

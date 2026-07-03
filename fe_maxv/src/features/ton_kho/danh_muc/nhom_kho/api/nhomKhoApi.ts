import { api } from '@/lib/apiClient';
import type {
  NhomKho,
  NhomKhoForm,
  NhomKhoListParams,
} from '@/features/ton_kho/danh_muc/nhom_kho/types';

const BASE = '/ton-kho/nhom-kho';

export function listNhomKho(params?: NhomKhoListParams): Promise<NhomKho[]> {
  return api.get<NhomKho[]>(BASE, { params });
}

export function createNhomKho(body: NhomKhoForm): Promise<{ ma_nh: string }> {
  return api.post(BASE, body);
}

export function updateNhomKho(
  maNh: string,
  body: NhomKhoForm,
): Promise<{ ma_nh: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maNh)}`, body);
}

export function deleteNhomKho(maNh: string): Promise<{ ma_nh: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maNh)}`);
}

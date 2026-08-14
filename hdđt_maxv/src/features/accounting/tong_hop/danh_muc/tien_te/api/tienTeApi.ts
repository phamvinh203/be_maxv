import { api } from '@/lib/apiClient';
import type {
  TienTe,
  TienTeForm,
  TienTeListParams,
} from '@/features/accounting/tong_hop/danh_muc/tien_te/types';

const BASE = '/tong-hop/tien-te';

export function listTienTe(params?: TienTeListParams): Promise<TienTe[]> {
  return api.get<TienTe[]>(BASE, { params });
}

export function createTienTe(body: TienTeForm): Promise<{ ma_nt: string }> {
  return api.post(BASE, body);
}

export function updateTienTe(
  maNt: string,
  body: TienTeForm,
): Promise<{ ma_nt: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maNt)}`, body);
}

export function deleteTienTe(maNt: string): Promise<{ ma_nt: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maNt)}`);
}

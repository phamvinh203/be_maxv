import { api } from '@/lib/apiClient';
import type {
  Kho,
  KhoForm,
  KhoListParams,
} from '@/features/ton_kho/danh_muc/kho/types';

const BASE = '/ton-kho/kho';

export function listKho(params?: KhoListParams): Promise<Kho[]> {
  return api.get<Kho[]>(BASE, { params });
}

export function createKho(body: KhoForm): Promise<{ ma_kho: string }> {
  return api.post(BASE, body);
}

export function updateKho(
  maKho: string,
  body: KhoForm,
): Promise<{ ma_kho: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maKho)}`, body);
}

export function deleteKho(maKho: string): Promise<{ ma_kho: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maKho)}`);
}

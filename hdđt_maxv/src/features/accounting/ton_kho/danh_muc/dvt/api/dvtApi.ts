import { api } from '@/lib/apiClient';
import type {
  Dvt,
  DvtForm,
  DvtListParams,
} from '@/features/accounting/ton_kho/danh_muc/dvt/types';

const BASE = '/ton-kho/dvt';

export function listDvt(params?: DvtListParams): Promise<Dvt[]> {
  return api.get<Dvt[]>(BASE, { params });
}

export function createDvt(body: DvtForm): Promise<{ dvt: string }> {
  return api.post<{ dvt: string }>(BASE, body);
}

export function updateDvt(dvt: string, body: DvtForm): Promise<{ dvt: string }> {
  return api.put<{ dvt: string }>(`${BASE}/${encodeURIComponent(dvt)}`, body);
}

export function deleteDvt(dvt: string): Promise<{ dvt: string }> {
  return api.del<{ dvt: string }>(`${BASE}/${encodeURIComponent(dvt)}`);
}

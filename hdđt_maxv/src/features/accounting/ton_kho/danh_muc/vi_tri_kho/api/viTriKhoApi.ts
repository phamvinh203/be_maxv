import { api } from '@/lib/apiClient';
import type {
  ViTri,
  ViTriForm,
  ViTriListParams,
} from '@/features/accounting/ton_kho/danh_muc/vi_tri_kho/types';

const BASE = '/ton-kho/vi-tri-kho';
const seg = (v: string) => encodeURIComponent(v);

export function listViTri(params?: ViTriListParams): Promise<ViTri[]> {
  return api.get<ViTri[]>(BASE, { params });
}

export function createViTri(
  body: ViTriForm,
): Promise<{ ma_kho: string; ma_vi_tri: string }> {
  return api.post(BASE, body);
}

export function updateViTri(
  maKho: string,
  maViTri: string,
  body: ViTriForm,
): Promise<{ ma_kho: string; ma_vi_tri: string }> {
  return api.put(`${BASE}/${seg(maKho)}/${seg(maViTri)}`, body);
}

export function deleteViTri(
  maKho: string,
  maViTri: string,
): Promise<{ ma_kho: string; ma_vi_tri: string }> {
  return api.del(`${BASE}/${seg(maKho)}/${seg(maViTri)}`);
}

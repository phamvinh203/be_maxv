import { api } from '@/lib/apiClient';
import type {
  PhongBan,
  PhongBanForm,
  PhongBanListParams,
} from '@/features/tong_hop/danh_muc/phong_ban/types';

const BASE = '/tong-hop/phong-ban';

export function listPhongBan(params?: PhongBanListParams): Promise<PhongBan[]> {
  return api.get<PhongBan[]>(BASE, { params });
}

export function createPhongBan(body: PhongBanForm): Promise<{ ma_pb: string }> {
  return api.post(BASE, body);
}

export function updatePhongBan(
  maPb: string,
  body: PhongBanForm,
): Promise<{ ma_pb: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maPb)}`, body);
}

export function deletePhongBan(maPb: string): Promise<{ ma_pb: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maPb)}`);
}

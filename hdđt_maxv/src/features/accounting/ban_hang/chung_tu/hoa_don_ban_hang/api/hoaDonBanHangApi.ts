import { api } from '@/lib/apiClient';
import type {
  HoaDon,
  HoaDonChiTiet,
  HoaDonListParams,
  HoaDonPayload,
} from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types';

const BASE = '/ban-hang/hoa-don-ban-hang';

export function listHoaDon(params?: HoaDonListParams): Promise<HoaDon[]> {
  return api.get<HoaDon[]>(BASE, { params });
}

export function getChiTiet(sttRec: string): Promise<HoaDonChiTiet[]> {
  return api.get<HoaDonChiTiet[]>(`${BASE}/${encodeURIComponent(sttRec)}/chi-tiet`);
}

export function nextSoCt(): Promise<{ so_ct: string }> {
  return api.get<{ so_ct: string }>(`${BASE}/next-so-ct`);
}

export function createHoaDon(body: HoaDonPayload): Promise<{ stt_rec: string }> {
  return api.post(BASE, body);
}

export function updateHoaDon(
  sttRec: string,
  body: HoaDonPayload,
): Promise<{ stt_rec: string }> {
  return api.put(`${BASE}/${encodeURIComponent(sttRec)}`, body);
}

export function deleteHoaDon(sttRec: string): Promise<{ stt_rec: string }> {
  return api.del(`${BASE}/${encodeURIComponent(sttRec)}`);
}

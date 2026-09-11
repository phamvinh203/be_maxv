import { api } from '@/lib/apiClient';
import type {
  KhachHangForm,
  KhachHangListParams,
  KhachHangPage,
} from '@/features/ban_hang/danh_muc/dm_KH/types';

const BASE = '/ban-hang/khach-hang';

/** Một trang danh sách — server phân trang + lọc (không tải cả bảng dmkh về trình duyệt). */
export function listKhachHang(params?: KhachHangListParams): Promise<KhachHangPage> {
  return api.get<KhachHangPage>(BASE, { params });
}

export function createKhachHang(body: KhachHangForm): Promise<{ ma_kh: string }> {
  return api.post(BASE, body);
}

export function updateKhachHang(
  maKh: string,
  body: KhachHangForm,
): Promise<{ ma_kh: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maKh)}`, body);
}

export function deleteKhachHang(maKh: string): Promise<{ ma_kh: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maKh)}`);
}

import { api } from "@/lib/apiClient";

/** Gọi API lịch sử hợp đồng lao động (`hrm_hop_dong` trong DB tenant). */
const BASE = "/hrm/hop-dong";

/**
 * Dòng BE trả về.
 *
 * `luong_chinh` / `luong_bhxh` là **CHUỖI**, không phải số: cột Decimal của Prisma serialize
 * ra JSON dưới dạng chuỗi để khỏi mất chính xác. Bắt buộc `Number()` ở adapter — quên là mọi
 * phép cộng lương biến thành nối chuỗi ("25000000" + "20000000").
 */
export interface HopDongApiRow {
  id: string;
  ma_nv: string;
  so_hd: string;
  loai_hd: string;
  kieu_luong: "gross" | "net";
  luong_chinh: string;
  luong_bhxh: string;
  ngay_bat_dau: string;
  ngay_ket_thuc: string | null;
  trich_bhxh: boolean;
  tinh_tncn: boolean;
  ghi_chu: string | null;
}

export interface HopDongApiBody {
  so_hd: string;
  loai_hd: string;
  kieu_luong: "gross" | "net";
  luong_chinh: number;
  luong_bhxh: number;
  ngay_bat_dau: string;
  ngay_ket_thuc: string | null;
  trich_bhxh: boolean;
  tinh_tncn: boolean;
  ghi_chu: string | null;
}

export interface HopDongApiCreateBody extends HopDongApiBody {
  ma_nv: string;
}

/** Thân request "đổi hợp đồng": chốt HĐ cũ vào `ngay_chot` rồi ký HĐ mới, trong một lần ghi. */
export interface DoiHopDongApiBody extends HopDongApiCreateBody {
  ngay_chot: string | null;
}

export function listHopDong(params?: {
  ma_nv?: string;
}): Promise<HopDongApiRow[]> {
  return api.get<HopDongApiRow[]>(BASE, { params });
}

export function createHopDong(
  body: HopDongApiCreateBody,
): Promise<{ id: string }> {
  return api.post(BASE, body);
}

export function doiHopDong(
  body: DoiHopDongApiBody,
): Promise<{ id: string; da_chot_hop_dong_cu: boolean }> {
  return api.post(`${BASE}/doi`, body);
}

export function updateHopDong(
  id: string,
  body: HopDongApiBody,
): Promise<{ id: string }> {
  return api.put(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteHopDong(id: string): Promise<{ id: string }> {
  return api.del(`${BASE}/${encodeURIComponent(id)}`);
}

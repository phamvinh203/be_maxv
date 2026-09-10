import { api } from "@/lib/apiClient";

/** Gọi API người phụ thuộc HRM (`hrm_nguoi_phu_thuoc` trong DB tenant). */
const BASE = "/hrm/nguoi-phu-thuoc";

/**
 * Dòng BE trả về. Lưu ý hai chỗ khác kiểu so với FE:
 *   - `ngay_sinh` là CHỮ `dd/MM/yyyy` (FE dùng `<input type="date">` = `YYYY-MM-DD`)
 *   - kỳ giảm trừ tách 4 số nguyên (FE dùng `<input type="month">` = `YYYY-MM`)
 * Việc quy đổi nằm ở `nguoiPhuThuocQueries.ts`.
 */
export interface NguoiPhuThuocApiRow {
  id: string;
  ma_nv: string;
  ho_ten: string;
  quan_he: string | null;
  ngay_sinh: string | null;
  so_cccd: string | null;
  mst: string | null;
  dien_thoai: string | null;
  dia_chi: string | null;
  dk_tu_thang: number | null;
  dk_tu_nam: number | null;
  dk_den_thang: number | null;
  dk_den_nam: number | null;
  /** BE tra sẵn từ hrm_nhan_vien, không lưu trùng trong bảng NPT. */
  ten_nv?: string | null;
}

export interface NguoiPhuThuocApiBody {
  ho_ten: string;
  quan_he: string | null;
  ngay_sinh: string | null;
  so_cccd: string | null;
  mst: string | null;
  dien_thoai: string | null;
  dia_chi: string | null;
  dk_tu_thang: number | null;
  dk_tu_nam: number | null;
  dk_den_thang: number | null;
  dk_den_nam: number | null;
}

export interface NguoiPhuThuocApiCreateBody extends NguoiPhuThuocApiBody {
  ma_nv: string;
}

export interface NguoiPhuThuocListParams {
  ma_nv?: string;
  ho_ten?: string;
}

export function listNguoiPhuThuoc(
  params?: NguoiPhuThuocListParams,
): Promise<NguoiPhuThuocApiRow[]> {
  return api.get<NguoiPhuThuocApiRow[]>(BASE, { params });
}

export function createNguoiPhuThuoc(
  body: NguoiPhuThuocApiCreateBody,
): Promise<{ id: string }> {
  return api.post(BASE, body);
}

export function updateNguoiPhuThuoc(
  id: string,
  body: NguoiPhuThuocApiBody,
): Promise<{ id: string }> {
  return api.put(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteNguoiPhuThuoc(id: string): Promise<{ id: string }> {
  return api.del(`${BASE}/${encodeURIComponent(id)}`);
}

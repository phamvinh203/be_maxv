import { api } from "@/lib/apiClient";

/**
 * Gọi API hồ sơ / tài liệu nhân viên (`hrm_tai_lieu` trong DB tenant).
 *
 * Giai đoạn này CHỈ có thông tin giấy tờ nhập tay — file scan sẽ lên Google Drive của chính
 * công ty ở đợt sau, khi đó thêm `drive_file_id` / `mime_type` / `ten_file` vào đây.
 */
const BASE = "/hrm/tai-lieu";

/** Dòng BE trả về. `ngay_cap` là ISO đầy đủ (`2021-05-20T00:00:00.000Z`), không phải YYYY-MM-DD. */
export interface TaiLieuApiRow {
  id: string;
  ma_nv: string;
  loai: string;
  so_hieu: string | null;
  ngay_cap: string | null;
  noi_cap: string | null;
  ghi_chu: string | null;
  /** BE tra sẵn từ hrm_nhan_vien, không lưu trùng trong bảng tài liệu. */
  ten_nv?: string | null;
}

export interface TaiLieuApiBody {
  loai: string;
  so_hieu: string | null;
  ngay_cap: string | null;
  noi_cap: string | null;
  ghi_chu: string | null;
}

export interface TaiLieuApiCreateBody extends TaiLieuApiBody {
  ma_nv: string;
}

export interface TaiLieuListParams {
  ma_nv?: string;
  loai?: string;
}

export function listTaiLieu(
  params?: TaiLieuListParams,
): Promise<TaiLieuApiRow[]> {
  return api.get<TaiLieuApiRow[]>(BASE, { params });
}

export function createTaiLieu(
  body: TaiLieuApiCreateBody,
): Promise<{ id: string }> {
  return api.post(BASE, body);
}

export function updateTaiLieu(
  id: string,
  body: TaiLieuApiBody,
): Promise<{ id: string }> {
  return api.put(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteTaiLieu(id: string): Promise<{ id: string }> {
  return api.del(`${BASE}/${encodeURIComponent(id)}`);
}

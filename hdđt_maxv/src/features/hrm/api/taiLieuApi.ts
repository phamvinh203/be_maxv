import { api } from "@/lib/apiClient";
import { apiFetch, apiFetchBlob } from "@/lib/http";

/**
 * Gọi API hồ sơ / tài liệu nhân viên (`hrm_tai_lieu` trong DB tenant).
 *
 * Thông tin giấy tờ nằm ở DB tenant; FILE SCAN nằm trên Google Drive của chính công ty, DB chỉ
 * giữ con trỏ (`drive_file_id`). Xem `taiLieuDrive.service.ts` bên backend.
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

  /** File scan trên Drive của công ty. `drive_file_id` null = chưa đính file. */
  drive_file_id: string | null;
  ten_file: string | null;
  mime_type: string | null;
  kich_thuoc: number | null;
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

// ── Google Drive: file scan đính kèm ────────────────────────────────────────

export interface TrangThaiDriveApi {
  /** Máy chủ đã cấu hình GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI chưa. */
  may_chu_san_sang: boolean;
  /** Công ty đang chọn đã nối Drive chưa. */
  da_ket_noi: boolean;
  /** Tài khoản Google đang dùng — cho người dùng biết file nằm ở Drive của ai. */
  email: string | null;
}

export function trangThaiDrive(): Promise<TrangThaiDriveApi> {
  return api.get<TrangThaiDriveApi>(`${BASE}/drive/trang-thai`);
}

export function urlLienKetDrive(): Promise<{ url: string }> {
  return api.get<{ url: string }>(`${BASE}/drive/lien-ket`);
}

export function ngatKetNoiDrive(): Promise<{ da_ngat: boolean }> {
  return api.del(`${BASE}/drive/ket-noi`);
}

export interface FileDaDinhKem {
  id: string;
  ten_file: string;
  mime_type: string;
  kich_thuoc: number;
}

/**
 * Tải file scan lên. Dùng `apiFetch` thẳng chứ không qua `api.post`: shim đó `JSON.stringify`
 * mọi body, còn đây phải gửi `FormData` để fetch tự đặt boundary multipart.
 */
export async function taiFileLen(
  id: string,
  file: File,
): Promise<FileDaDinhKem> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch<{ data: FileDaDinhKem }>(
    `${BASE}/${encodeURIComponent(id)}/file`,
    { method: "POST", body: form },
  );
  return res.data;
}

/**
 * Tải nội dung file về dạng Blob để hiển thị trong app.
 *
 * KHÔNG dùng `<img src="...">` trỏ thẳng vào API: ảnh sẽ là request cross-origin lúc chạy dev
 * (FE 5173, API 4000) và không kèm cookie phiên -> 401. Lấy Blob qua đúng lớp `apiFetch` thì
 * dùng chung cơ chế cookie + tự làm mới token như mọi lời gọi khác.
 */
export function taiFileVe(id: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${encodeURIComponent(id)}/file`);
}

export function xoaFileDinhKem(id: string): Promise<{ id: string }> {
  return api.del(`${BASE}/${encodeURIComponent(id)}/file`);
}

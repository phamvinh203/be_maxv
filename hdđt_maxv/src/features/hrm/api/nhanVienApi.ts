import { api } from "@/lib/apiClient";
import type { TrangThai } from "../types";

/** Gọi API nhân viên HRM (`hrm_nhan_vien` trong DB tenant). */
const BASE = "/hrm/nhan-vien";

export type LoaiHopDongApi = "thu_viec" | "hdld" | "hdvc";
export type KieuLuongApi = "gross" | "net";
export type GioiTinhApi = "nam" | "nu" | "khac";

/** Dòng BE trả về. Ngày là chuỗi ISO đầy đủ (`2026-03-01T00:00:00.000Z`), không phải YYYY-MM-DD. */
export interface NhanVienApiRow {
  ma_nv: string;
  ho_ten: string;
  ngay_sinh: string | null;
  so_cccd: string | null;
  mst_ca_nhan: string | null;
  dien_thoai: string | null;
  email: string | null;
  dia_chi: string | null;
  gioi_tinh: GioiTinhApi | null;
  ma_pb: string | null;
  chuc_vu: string | null;
  cap_bac: string | null;
  ngay_vao_lam: string;

  /**
   * Hợp đồng HIỆN HÀNH — BE TÍNH lúc đọc từ `hrm_hop_dong`, không phải cột lưu sẵn.
   * `null` khi nhân viên chưa có hợp đồng nào. Chỉ đọc: KHÔNG gửi ngược lên trong PUT/POST,
   * muốn đổi thì sửa ở tab Lịch sử hợp đồng.
   */
  so_hop_dong: string | null;
  loai_hop_dong: LoaiHopDongApi | null;
  kieu_luong: KieuLuongApi | null;
  ngay_hieu_luc_toi: string | null;
  bhxh: boolean | null;
  tncn: boolean | null;

  mien_cham_cong: boolean;
  cong_doan: boolean;
  so_tai_khoan: string | null;
  ten_tai_khoan: string | null;
  ngan_hang: string | null;
  ghi_chu: string | null;
  status: TrangThai;
  /** Chỉ có ở GET danh sách (BE tra sẵn), không có ở GET chi tiết. */
  ten_pb?: string | null;
  so_npt?: number;
}

/** Thân request sửa (PUT thay TOÀN BỘ bản ghi, không phải patch từng trường). */
export interface NhanVienApiBody {
  ho_ten: string;
  ngay_sinh: string | null;
  so_cccd: string | null;
  mst_ca_nhan: string | null;
  dien_thoai: string | null;
  email: string | null;
  dia_chi: string | null;
  gioi_tinh: GioiTinhApi | null;
  ma_pb: string | null;
  chuc_vu: string | null;
  cap_bac: string | null;
  ngay_vao_lam: string;
  mien_cham_cong: boolean;
  cong_doan: boolean;
  so_tai_khoan: string | null;
  ten_tai_khoan: string | null;
  ngan_hang: string | null;
  ghi_chu: string | null;
  status: TrangThai;
}

/** Thân request tạo: bỏ trống `ma_nv` thì BE tự sinh (`NV0001`…). */
export interface NhanVienApiCreateBody extends NhanVienApiBody {
  ma_nv?: string | null;
}

export interface NhanVienListParams {
  ma_nv?: string;
  ho_ten?: string;
  ma_pb?: string;
  status?: TrangThai;
}

export function listNhanVien(
  params?: NhanVienListParams,
): Promise<NhanVienApiRow[]> {
  return api.get<NhanVienApiRow[]>(BASE, { params });
}

export function getNhanVien(maNv: string): Promise<NhanVienApiRow> {
  return api.get<NhanVienApiRow>(`${BASE}/${encodeURIComponent(maNv)}`);
}

export function createNhanVien(
  body: NhanVienApiCreateBody,
): Promise<{ ma_nv: string }> {
  return api.post(BASE, body);
}

export function updateNhanVien(
  maNv: string,
  body: NhanVienApiBody,
): Promise<{ ma_nv: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maNv)}`, body);
}

/** Xóa — BE trả kèm số người phụ thuộc đã bị xóa theo (cascade). */
export function deleteNhanVien(
  maNv: string,
): Promise<{ ma_nv: string; so_npt_da_xoa: number }> {
  return api.del(`${BASE}/${encodeURIComponent(maNv)}`);
}

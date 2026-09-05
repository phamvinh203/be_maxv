import { api } from "@/lib/apiClient";
import type { TrangThai } from "../types";

/**
 * Gọi API phòng ban HRM (`hrm_phong_ban` trong DB tenant).
 *
 * KHÁC `/tong-hop/phong-ban` bên kế toán (bảng `dmpb`): hai bảng riêng, hai module bán kèm
 * riêng. Đừng gộp hai lớp api này lại kể cả khi trường dữ liệu trông giống nhau.
 */
const BASE = "/hrm/phong-ban";

/** Dòng BE trả ở GET list — `ghi_chu`/`ten_pb_me` để null, khác type FE (dùng chuỗi rỗng). */
export interface PhongBanApiRow {
  ma_pb: string;
  ten_pb: string;
  ma_pb_me: string | null;
  ghi_chu: string | null;
  status: TrangThai;
  /** Tên phòng ban cha, BE tra sẵn. `null` khi không có cha hoặc cha đã bị xóa. */
  ten_pb_me: string | null;
  /** Số nhân viên THẬT trong `hrm_nhan_vien` — còn 0 tới khi API nhân viên xong. */
  so_nv: number;
}

/** Thân request sửa. */
export interface PhongBanApiBody {
  ten_pb: string;
  ma_pb_me: string | null;
  ghi_chu: string | null;
  status: TrangThai;
}

/** Thân request tạo: bỏ trống `ma_pb` thì BE tự sinh theo cây (`PB01`, `PB01.01`…). */
export interface PhongBanApiCreateBody extends PhongBanApiBody {
  ma_pb?: string | null;
}

export function listPhongBan(): Promise<PhongBanApiRow[]> {
  return api.get<PhongBanApiRow[]>(BASE);
}

export function createPhongBan(
  body: PhongBanApiCreateBody,
): Promise<{ ma_pb: string }> {
  return api.post(BASE, body);
}

export function updatePhongBan(
  maPb: string,
  body: PhongBanApiBody,
): Promise<{ ma_pb: string }> {
  return api.put(`${BASE}/${encodeURIComponent(maPb)}`, body);
}

export function deletePhongBan(maPb: string): Promise<{ ma_pb: string }> {
  return api.del(`${BASE}/${encodeURIComponent(maPb)}`);
}

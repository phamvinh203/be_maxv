import { apiFetch } from "../../../lib/http";
import { kyToQuery, type Ky } from "../ky";

/** Một ô kế toán sửa tay + lý do. */
export interface GhiDeItem {
  gia: number;
  lyDo?: string;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

/** Bản tờ khai của một kỳ — khớp `BanToKhai` bên `toKhaiGtgt01.service.ts`. */
export interface BanToKhai {
  ky: Ky;
  trangThai: "nhap" | "chot";
  /** Bộ chỉ tiêu CUỐI (số đem đi nộp). */
  ct: Record<string, number>;
  /** Số máy tự tính — giữ để đối chiếu với ô đã sửa tay. */
  ctMay: Record<string, number>;
  ghiDe: Record<string, GhiDeItem>;
  nguonCt22: "ky_truoc" | "nhap_tay";
  soHdBan: number;
  soHdMua: number;
  soHdKhongKeKhai: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  tinhLuc: string | null;
}

export interface DongKyDaLap {
  nam: number;
  kyLoai: Ky["kyLoai"];
  kySo: number;
  trangThai: string;
  ct40: number;
  ct43: number;
  tinhLuc: string | null;
}

/** `2026/thang/7` — kỳ nằm trên path của các endpoint thao tác trên một bản. */
function duongDanKy(ky: Ky): string {
  return `${ky.nam}/${ky.kyLoai}/${ky.kySo}`;
}

/** Tính tờ khai từ bảng kê của kỳ rồi ghi bản nháp. */
export async function postTinh(ky: Ky): Promise<BanToKhai> {
  return apiFetch<BanToKhai>("/to-khai/gtgt01/tinh", {
    method: "POST",
    body: JSON.stringify(ky),
  });
}

/** Đọc bản đã lưu; kỳ chưa lập -> BE trả 404 (`code: "chua_co_ban"`). */
export async function getBan(ky: Ky): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}`);
}

/** Lưu ô sửa tay rồi tính lại — trả về bản đã cập nhật. */
export async function putGhiDe(
  ky: Ky,
  ghiDe: Record<string, GhiDeItem>,
): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(`/to-khai/gtgt01/${duongDanKy(ky)}`, {
    method: "PUT",
    body: JSON.stringify({ ghiDe }),
  });
}

export async function postDoiTrangThai(ky: Ky, chot: boolean): Promise<BanToKhai> {
  return apiFetch<BanToKhai>(
    `/to-khai/gtgt01/${duongDanKy(ky)}/${chot ? "chot" : "mo-khoa"}`,
    { method: "POST" },
  );
}

export async function getDanhSachKy(): Promise<DongKyDaLap[]> {
  return apiFetch<DongKyDaLap[]>("/to-khai/gtgt01/danh-sach");
}

/** Kỳ hiện tại dạng query string — dùng khi cần điều hướng kèm kỳ. */
export { kyToQuery };

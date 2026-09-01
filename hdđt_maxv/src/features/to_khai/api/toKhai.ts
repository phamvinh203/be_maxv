import { apiFetch } from "../../../lib/http";
import type { InvoiceDirection, InvoiceRaw, ReplacementRow } from "../../hddt/types";
import { kyToQuery, type Ky } from "../ky";

/** Kết quả lượt "Kê khai" — số hóa đơn đã gán vào kỳ, tách theo chiều. */
export interface KetQuaKeKhai {
  ky: Ky;
  nhanKy: string;
  purchase: number;
  sold: number;
  tong: number;
}

/**
 * Bảng kê của một kỳ. Cùng hình dạng `{ total, datas, thayThe }` với `/gdt/invoices/:direction/
 * saved` để dùng lại `toDisplayRow` + `buildReplacedByMap`, chỉ thêm hai field quyết định của kế
 * toán trên mỗi dòng.
 */
export interface BangKeResult {
  total: number;
  datas: (InvoiceRaw & { keKhai: boolean; chiTieuTangGiam: string })[];
  thayThe: ReplacementRow[];
}

/** Gán mọi hóa đơn có ngày lập trong kỳ vào kỳ đó (cả hai chiều). */
export async function postKeKhai(ky: Ky): Promise<KetQuaKeKhai> {
  return apiFetch<KetQuaKeKhai>("/to-khai/ke-khai", {
    method: "POST",
    body: JSON.stringify(ky),
  });
}

/** Hóa đơn đã được gán vào kỳ, theo chiều. */
export async function getBangKe(ky: Ky, chieu: InvoiceDirection): Promise<BangKeResult> {
  return apiFetch<BangKeResult>(`/to-khai/hoa-don?${kyToQuery(ky)}&chieu=${chieu}`);
}

/** Độ phủ đồng bộ của một chiều trong kỳ. */
export interface PhuChieu {
  daPhu: boolean;
  tuNgayDaCo: string | null;
  denNgayDaCo: string | null;
}

/** Kỳ đã được đồng bộ hóa đơn trọn vẹn chưa — `canhBao` là câu mô tả phần thiếu, BE dựng sẵn. */
export interface KetQuaPhuKy {
  daPhu: boolean;
  purchase: PhuChieu;
  sold: PhuChieu;
  canhBao: string | null;
}

export async function getPhuSongKy(ky: Ky): Promise<KetQuaPhuKy> {
  return apiFetch<KetQuaPhuKy>(`/to-khai/ky/phu-song?${kyToQuery(ky)}`);
}

/** Giá trị cột "Chỉ tiêu tăng giảm"; rỗng = chưa chọn. */
export type ChiTieuTangGiam = "" | "tang" | "giam";

/** Phần quyết định của kế toán cho một hóa đơn — field vắng mặt nghĩa là KHÔNG đổi. */
export interface QuyetDinhKeKhai {
  keKhai?: boolean;
  chiTieuTangGiam?: ChiTieuTangGiam;
  ghiChu?: string;
}

/**
 * Sửa quyết định kê khai của MỘT hóa đơn. Không gửi kỳ: hóa đơn đã thuộc kỳ nào thì quyết định
 * gắn với kỳ đó; đổi kỳ là việc của lượt "Kê khai".
 */
export async function patchQuyetDinh(
  chieu: InvoiceDirection,
  id: string,
  quyetDinh: QuyetDinhKeKhai,
): Promise<void> {
  await apiFetch<{ ok: true }>(`/to-khai/hoa-don/${chieu}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(quyetDinh),
  });
}

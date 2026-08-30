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

/** Tính toán của màn Lương phần trăm — thuần, không phụ thuộc React. */

import type { DongLuongPhanTram } from "./types";

/** Id của một dòng lương phần trăm — chỉ cần duy nhất trong phiên. */
export function sinhIdDongPhanTram(): string {
  return `DP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function dongPhanTramRong(): DongLuongPhanTram {
  return { id: sinhIdDongPhanTram(), ma_khoan: "", ty_le: 0, so_tien_co_so: 0 };
}

/**
 * Thành tiền của một dòng: số tiền cơ sở nhân tỷ lệ.
 *
 * Làm tròn về đồng — tỷ lệ hay lẻ (2,5%) nên tích ra số thập phân, mà phiếu chi
 * thì không trả được nửa đồng.
 */
export function thanhTienPhanTram(dong: DongLuongPhanTram): number {
  return Math.round((dong.so_tien_co_so * dong.ty_le) / 100);
}

/** Tổng thành tiền của cả bảng — đây là con số vào cột "Tiền lương". */
export function tongTienPhanTram(dong: DongLuongPhanTram[]): number {
  return dong.reduce((tong, d) => tong + thanhTienPhanTram(d), 0);
}

/** Tổng số tiền cơ sở — nhìn nhanh doanh số đang làm gốc cho cả bảng. */
export function tongCoSoPhanTram(dong: DongLuongPhanTram[]): number {
  return dong.reduce((tong, d) => tong + d.so_tien_co_so, 0);
}

/** Bản sao của một bảng dòng, id sinh lại. Xem ghi chú ở `kpi.nhanBanDongKpi`. */
export function nhanBanDongPhanTram(dong: DongLuongPhanTram[]): DongLuongPhanTram[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongPhanTram() }));
}

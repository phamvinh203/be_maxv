/** Tính toán của màn Lương sản phẩm — thuần, không phụ thuộc React. */

import type { DongLuongSanPham } from "./types";

/** Id của một dòng lương sản phẩm — chỉ cần duy nhất trong phiên. */
export function sinhIdDongSanPham(): string {
  return `DS${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function dongSanPhamRong(): DongLuongSanPham {
  return { id: sinhIdDongSanPham(), ma_sp: "", don_gia: 0, so_luong: 0 };
}

/**
 * Thành tiền của một dòng.
 *
 * Làm tròn về đồng: số lượng nhận số lẻ (2,5 kiện) nên tích có thể ra số thập
 * phân, mà phiếu chi thì không trả được nửa đồng.
 */
export function thanhTienSanPham(dong: DongLuongSanPham): number {
  return Math.round(dong.don_gia * dong.so_luong);
}

/** Tổng thành tiền của cả bảng — đây là con số vào cột "Tiền lương". */
export function tongTienSanPham(dong: DongLuongSanPham[]): number {
  return dong.reduce((tong, d) => tong + thanhTienSanPham(d), 0);
}

export function tongSoLuong(dong: DongLuongSanPham[]): number {
  return Math.round(dong.reduce((tong, d) => tong + d.so_luong, 0) * 100) / 100;
}

/** Bản sao của một bảng dòng, id sinh lại. Xem ghi chú ở `kpi.nhanBanDongKpi`. */
export function nhanBanDongSanPham(dong: DongLuongSanPham[]): DongLuongSanPham[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongSanPham() }));
}

/** Tính toán của màn Thưởng — thuần, không phụ thuộc React. */

import type { DongThuong } from "./types";

/** Id của một dòng thưởng — chỉ cần duy nhất trong phiên. */
export function sinhIdDongThuong(): string {
  return `DT${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function dongThuongRong(): DongThuong {
  return { id: sinhIdDongThuong(), ma_khoan: "", so_tien: 0 };
}

/** Tổng mức thưởng của **một** nhân viên trong bảng. */
export function tongTienThuong(dong: DongThuong[]): number {
  return dong.reduce((tong, d) => tong + d.so_tien, 0);
}

/**
 * Thành tiền của một dòng: mức thưởng nhân số người sẽ nhận.
 *
 * Cột "Số tiền" là mức của **một** người, còn "Thành tiền" là phần quỹ mà khoản
 * đó tiêu tốn cho cả danh sách đang chọn — hai con số này là thứ người duyệt cần
 * nhìn cùng lúc trước khi bấm áp dụng.
 */
export function thanhTien(dong: DongThuong, soNhanVien: number): number {
  return dong.so_tien * soNhanVien;
}

/**
 * Bản sao của một bảng dòng, id sinh lại.
 *
 * Dùng khi áp bảng sang nhiều nhân viên và khi tái sử dụng bảng của người khác:
 * dùng chung id thì sửa một dòng ở bảng này sẽ khớp nhầm dòng ở bảng kia.
 */
export function nhanBanDongThuong(dong: DongThuong[]): DongThuong[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongThuong() }));
}

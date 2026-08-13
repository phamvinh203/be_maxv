/** Tính toán của màn KPI — thuần, không phụ thuộc React. */

import type { DongKpi } from "./types";

/** Làm tròn tới một chữ số thập phân — đủ để phân biệt 99,5% với 100%. */
function lamTron(so: number): number {
  return Math.round(so * 10) / 10;
}

/**
 * Tỷ lệ hoàn thành một chỉ tiêu (%).
 *
 * Mục tiêu 0 nghĩa là chỉ tiêu chưa khai xong (dòng vừa thêm, hoặc file nhập
 * thiếu ô) — trả 0 thay vì chia cho 0 để bảng vẫn hiện được số.
 */
export function tyLeHt(dong: DongKpi): number {
  if (dong.muc_tieu <= 0) return 0;
  return lamTron((dong.thuc_thi / dong.muc_tieu) * 100);
}

export function tongTrongSo(dong: DongKpi[]): number {
  return dong.reduce((tong, d) => tong + d.trong_so, 0);
}

/**
 * Hiệu suất chung của một bảng KPI (%).
 *
 * Bình quân theo **trọng số**, không phải trung bình cộng: chỉ tiêu trọng số 40
 * mà chỉ đạt 50% phải kéo hiệu suất xuống nhiều hơn chỉ tiêu trọng số 5.
 */
export function hieuSuat(dong: DongKpi[]): number {
  const tong = tongTrongSo(dong);
  if (tong <= 0) return 0;
  const cong = dong.reduce((gop, d) => gop + tyLeHt(d) * d.trong_so, 0);
  return lamTron(cong / tong);
}

/** Id của một dòng KPI — chỉ cần duy nhất trong phiên. */
export function sinhIdDongKpi(): string {
  return `DK${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function dongKpiRong(): DongKpi {
  return { id: sinhIdDongKpi(), ma_kpi: "", trong_so: 0, muc_tieu: 0, thuc_thi: 0 };
}

/**
 * Bản sao của một bảng dòng, id sinh lại.
 *
 * Dùng khi áp bảng đang soạn sang nhiều nhân viên và khi tái sử dụng bảng của
 * người khác: dùng chung id thì sửa một dòng ở bảng này sẽ khớp nhầm dòng ở bảng
 * kia mỗi khi lấy dòng theo id.
 */
export function nhanBanDongKpi(dong: DongKpi[]): DongKpi[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongKpi() }));
}

/** Màu của hiệu suất: đạt / gần đạt / chưa đạt. Dùng chung cho chip và thanh %. */
export function mauHieuSuat(phanTram: number): "success" | "warning" | "error" {
  if (phanTram >= 100) return "success";
  if (phanTram >= 80) return "warning";
  return "error";
}

/**
 * Phụ lục "Giảm thuế giá trị gia tăng theo Nghị quyết 204/2025/QH15" — nộp KÈM tờ khai 01/GTGT khi
 * kỳ có hàng được giảm thuế từ 10% xuống 8%.
 *
 * Cấu trúc bám bản thật (đối chiếu tờ khai Q2/2026 của MST 0106861880):
 *   Mục I   — hàng MUA VÀO nhóm 8%: giá trị, thuế được khấu trừ
 *   Mục II  — hàng BÁN RA nhóm 8%: giá trị, thuế suất quy định (10%), sau giảm (8%),
 *             thuế được giảm = giá trị × (10% − 8%)
 *   Mục III — chênh lệch [09] = thuế bán ra được giảm − thuế mua vào
 *
 * Hàm THUẦN, không đụng DB — test ở `src/__tests__/phuLuc204.test.ts`.
 */

import type { KetQuaBanRa, KetQuaMuaVao } from "./gomHoaDonGtgt";

/** Nhãn nhóm được giảm thuế. Nghị quyết đổi mức thì sửa đúng hằng này. */
export const NHAN_GIAM_THUE = "8%";

/** Thuế suất theo quy định của nhóm được giảm (%) — 10%, giảm còn 8%. */
export const THUE_SUAT_QUY_DINH = 10;
export const THUE_SUAT_SAU_GIAM = 8;

export interface DongPhuLuc {
  /** Mô tả hàng hóa: máy gom từ chi tiết hóa đơn, kế toán sửa được. */
  tenHang: string;
  giaTri: number;
  thue: number;
}

export interface PhuLuc204 {
  /** Mục I — hàng mua vào nhóm 8%. */
  muaVao: DongPhuLuc;
  /** Mục II — hàng bán ra nhóm 8%, kèm hai mức thuế suất và số thuế được giảm. */
  banRa: DongPhuLuc & {
    thueSuatQuyDinh: number;
    thueSuatSauGiam: number;
    /** [08] = giá trị × (thuế suất quy định − thuế suất sau giảm). */
    thueDuocGiam: number;
  };
  /** Mục III — [09] = [08] − [06]. Âm nghĩa là thuế đầu vào được khấu trừ lớn hơn phần giảm đầu ra. */
  chenhLech: number;
  /** Kỳ không có hàng 8% nào ở cả hai chiều -> không phải nộp phụ lục. */
  rong: boolean;
}

/** Gộp tên hàng thành một câu mô tả, cắt bằng "..." khi còn nữa (giống cách bản thật viết). */
function moTaHang(tenHang: string[]): string {
  if (tenHang.length === 0) return "";
  const cau = tenHang.join(", ");
  return tenHang.length >= 12 ? `${cau} ...` : cau;
}

/**
 * Dựng phụ lục từ kết quả gộp của kỳ.
 *
 * Số thuế được giảm tính theo CÔNG THỨC của mẫu (giá trị × 2%), KHÔNG lấy hiệu của thuế thực tế:
 * mẫu in ghi rõ `(6)=(3)x[(4)-(5)]`, và cơ quan thuế đối chiếu đúng công thức đó. Số thuế thực tế
 * trên hóa đơn vẫn dùng cho [33] của tờ khai chính — hai chỗ hai mục đích, đừng lẫn.
 */
export function dungPhuLuc204(banRa: KetQuaBanRa, muaVao: KetQuaMuaVao): PhuLuc204 {
  const nhomBan = banRa.theoNhan[NHAN_GIAM_THUE];
  const nhomMua = muaVao.theoNhan[NHAN_GIAM_THUE];

  const giaTriBan = nhomBan?.giaTri ?? 0;
  const thueDuocGiam = Math.round(
    (giaTriBan * (THUE_SUAT_QUY_DINH - THUE_SUAT_SAU_GIAM)) / 100,
  );
  const thueMua = nhomMua?.thue ?? 0;

  return {
    muaVao: {
      tenHang: moTaHang(nhomMua?.tenHang ?? []),
      giaTri: nhomMua?.giaTri ?? 0,
      thue: thueMua,
    },
    banRa: {
      tenHang: moTaHang(nhomBan?.tenHang ?? []),
      giaTri: giaTriBan,
      thue: nhomBan?.thue ?? 0,
      thueSuatQuyDinh: THUE_SUAT_QUY_DINH,
      thueSuatSauGiam: THUE_SUAT_SAU_GIAM,
      thueDuocGiam,
    },
    chenhLech: thueDuocGiam - thueMua,
    rong: !nhomBan && !nhomMua,
  };
}

/**
 * Phụ lục "Giảm thuế giá trị gia tăng theo Nghị quyết 204/2025/QH15" — nộp KÈM tờ khai 01/GTGT khi
 * kỳ có hàng được giảm thuế từ 10% xuống 8%.
 *
 * Cấu trúc bám bản thật (đối chiếu tờ khai Q2/2026 của MST 0106861880):
 *   Mục I   — hàng MUA VÀO có thuế đầu vào được khấu trừ (xem `gopMuaVaoCoThue`)
 *   Mục II  — hàng BÁN RA nhóm 8%: giá trị, thuế suất quy định (10%), sau giảm (8%),
 *             thuế được giảm = giá trị × (10% − 8%)
 *   Mục III — chênh lệch [09] = thuế bán ra được giảm − thuế mua vào
 *
 * Hàm THUẦN, không đụng DB — test ở `src/__tests__/phuLuc204.test.ts`.
 */

import type { KetQuaBanRa, KetQuaMuaVao, NhomThueSuat } from "./gomHoaDonGtgt";

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
  /** Mục I — hàng mua vào có thuế đầu vào được khấu trừ. */
  muaVao: DongPhuLuc;
  /** Mục II — hàng bán ra nhóm 8%, kèm hai mức thuế suất và số thuế được giảm. */
  banRa: DongPhuLuc & {
    thueSuatQuyDinh: number;
    thueSuatSauGiam: number;
    /** [08] = cắt phần lẻ của `giá trị × (thuế suất quy định − thuế suất sau giảm)`. */
    thueDuocGiam: number;
  };
  /** Mục III — [09] = [08] − [06]. Âm nghĩa là thuế đầu vào được khấu trừ lớn hơn phần giảm đầu ra. */
  chenhLech: number;
  /** Kỳ không có hàng 8% BÁN RA -> không có gì được giảm, không phải nộp phụ lục. */
  rong: boolean;
}

/**
 * Cắt phần lẻ về phía 0, và trả 0 chứ không phải -0.
 *
 * `Math.trunc(-0,5)` cho `-0`, thứ so sánh khác `0` (`Object.is`) và in ra là "-0" ở vài chỗ —
 * không thứ gì trên tờ khai nên mang dấu âm mà giá trị bằng không.
 */
function catPhanLe(n: number): number {
  const v = Math.trunc(n);
  return v === 0 ? 0 : v;
}

/** Gộp tên hàng thành một câu mô tả, cắt bằng "..." khi còn nữa (giống cách bản thật viết). */
function moTaHang(tenHang: string[]): string {
  if (tenHang.length === 0) return "";
  const cau = tenHang.join(", ");
  return tenHang.length >= 12 ? `${cau} ...` : cau;
}

/**
 * Mục I gộp MỌI nhóm mua vào CÓ thuế đầu vào, không chỉ nhóm 8%.
 *
 * Đối chiếu phụ lục thật Q2/2026 của MST 0106861880: bản kế toán đã nộp ghi thuế 5.102.437 =
 * 5.081.437 (nhóm 8%) + 21.000 (nhóm 10%). Tức thực tế mục này được khai là "toàn bộ thuế đầu vào
 * được khấu trừ trong kỳ", dù tiêu đề mẫu chỉ nói 8%. Lấy đúng nhóm 8% thì cột thuế lệch, mà cột
 * thuế mới là số đi vào mục III và bị cơ quan thuế đối chiếu.
 *
 * Nhóm không thuế (KCT/KKKNT, thuế = 0) bị loại — chúng không có gì để khấu trừ.
 */
function gopMuaVaoCoThue(theoNhan: Record<string, NhomThueSuat>): {
  giaTri: number;
  thue: number;
  tenHang: string[];
} {
  const ra = { giaTri: 0, thue: 0, tenHang: [] as string[] };
  for (const nhom of Object.values(theoNhan)) {
    if (nhom.thue <= 0) continue;
    ra.giaTri += nhom.giaTri;
    ra.thue += nhom.thue;
    for (const t of nhom.tenHang) if (!ra.tenHang.includes(t)) ra.tenHang.push(t);
  }
  return ra;
}

/**
 * Dựng phụ lục từ kết quả gộp của kỳ.
 *
 * Số thuế được giảm tính theo CÔNG THỨC của mẫu (giá trị × 2%), KHÔNG lấy hiệu của thuế thực tế:
 * mẫu in ghi rõ `(6)=(3)x[(4)-(5)]`, và cơ quan thuế đối chiếu đúng công thức đó. Số này còn đi
 * TIẾP vào [33] của tờ khai chính (`[33] = làm tròn([32] x 10%) - số này`), nên sai ở đây là sai
 * cả hai nơi.
 */
export function dungPhuLuc204(banRa: KetQuaBanRa, muaVao: KetQuaMuaVao): PhuLuc204 {
  const nhomBan = banRa.theoNhan[NHAN_GIAM_THUE];
  // Mục I gộp mọi nhóm có thuế; mục II chỉ nhóm được giảm (8%) — xem ghi chú `gopMuaVaoCoThue`.
  const mua = gopMuaVaoCoThue(muaVao.theoNhan);

  const giaTriBan = nhomBan?.giaTri ?? 0;
  // CẮT phần lẻ (về phía 0), không phải làm tròn thường. Đối chiếu hai kỳ thật của MST 0106861880:
  //   Q1: 251.896.634 x 2% = 5.037.932,68 -> phải ra 5.037.932 (tròn thường cho 5.037.933)
  //   Q2: 391.249.917 x 2% = 7.824.998,34 -> 7.824.998 (hai cách cho cùng kết quả)
  // Chỉ tròn-xuống khớp CẢ HAI: [33] = làm tròn([32] x 10%) - số này, và [33] của hai kỳ đã nộp
  // lần lượt là 20.151.731 và 31.299.994. Tròn thường làm Q1 lệch một đồng, rồi lệch đó chảy qua
  // [43] sang [22] của kỳ sau.
  //
  // `trunc` chứ không `floor`: hai kỳ đối chứng đều dương nên hai hàm cho kết quả y hệt, nhưng khi
  // hóa đơn điều chỉnh giảm kéo nhóm 8% xuống âm thì `floor(-0,02) = -1` bịa ra một đồng được
  // giảm, còn `trunc(-0,02) = 0` mới đúng nghĩa "cắt phần lẻ".
  const thueDuocGiam = catPhanLe(
    (giaTriBan * (THUE_SUAT_QUY_DINH - THUE_SUAT_SAU_GIAM)) / 100,
  );
  const thueMua = mua.thue;

  return {
    muaVao: {
      tenHang: moTaHang(mua.tenHang),
      giaTri: mua.giaTri,
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
    // Kỳ không có hàng 8% BÁN RA thì không phải nộp phụ lục, dù mua vào có thuế đầu vào.
    rong: !nhomBan,
  };
}

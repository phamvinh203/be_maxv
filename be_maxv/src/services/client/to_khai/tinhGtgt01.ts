/**
 * Công thức mẫu 01/GTGT (Tờ khai thuế GTGT khấu trừ, TT80/2021/TT-BTC) — hàm THUẦN, không DB,
 * không HTTP. Mọi con số đem đi nộp thuế đều đi qua đây, nên đây cũng là chỗ đặt toàn bộ test
 * công thức (`src/__tests__/tinhGtgt01.test.ts`).
 *
 * Công thức lấy đúng theo nhãn in trên mẫu — xem mảng `HANG` trong
 * `hdđt_maxv/src/features/dich_vu_cong/components/ToKhaiGtgt01Form.tsx`, nơi từng dòng chỉ tiêu
 * ghi sẵn công thức của nó.
 */

import type { TongBanRa } from "./gomHoaDonGtgt";

/** Ô người dùng tự nhập — máy không suy được từ hóa đơn. */
export type CtNhapTay =
  | "ct22"
  | "ct23a"
  | "ct24a"
  | "ct25"
  | "ct37"
  | "ct38"
  | "ct39a"
  | "ct40b"
  | "ct42";

export const CT_NHAP_TAY: readonly CtNhapTay[] = [
  "ct22",
  "ct23a",
  "ct24a",
  "ct25",
  "ct37",
  "ct38",
  "ct39a",
  "ct40b",
  "ct42",
];

export interface DauVaoGtgt01 {
  banRa: TongBanRa;
  muaVao: { ct23: number; ct24: number };
  /** Ô đã nhập tay/ghi đè. `ct25` VẮNG MẶT -> lấy mặc định bằng [24]; có mặt (kể cả 0) thì thắng. */
  nhapTay: Partial<Record<CtNhapTay, number>>;
}

export type CtGtgt01 = Record<string, number>;

export function tinhGtgt01(dv: DauVaoGtgt01): CtGtgt01 {
  const tay = (k: CtNhapTay): number => Number(dv.nhapTay[k] ?? 0);

  const ct22 = tay("ct22");
  const ct23 = dv.muaVao.ct23;
  const ct24 = dv.muaVao.ct24;
  // Máy không biết hóa đơn nào không đủ điều kiện khấu trừ, cũng không biết tỷ lệ phân bổ cho hoạt
  // động không chịu thuế -> mặc định khấu trừ hết, kế toán sửa thì `nhapTay.ct25` thắng.
  // Dùng `== null` chứ không `||`: khai "không được khấu trừ đồng nào" (0) là giá trị hợp lệ,
  // `||` sẽ nuốt mất và lặng lẽ quay về [24].
  const ct25 = dv.nhapTay.ct25 == null ? ct24 : Number(dv.nhapTay.ct25);

  const { ct26, ct29, ct30, ct31, ct32, ct32a, ct33 } = dv.banRa;
  const ct27 = ct29 + ct30 + ct32 + ct32a;
  const ct28 = ct31 + ct33;
  const ct34 = ct26 + ct27;
  const ct35 = ct28;
  const ct36 = ct35 - ct25;

  const ct37 = tay("ct37");
  const ct38 = tay("ct38");
  const ct39a = tay("ct39a");
  const ct40b = tay("ct40b");
  const ct42 = tay("ct42");

  // [40a] và [41] LOẠI TRỪ NHAU: cùng một hiệu số, dương thì phải nộp, âm thì còn được khấu trừ.
  // Hỏng chỗ này là sai hẳn nghĩa vụ thuế theo cả hai chiều.
  const hieu = ct36 - ct22 + ct37 - ct38 - ct39a;
  const ct40a = hieu >= 0 ? hieu : 0;
  const ct41 = hieu < 0 ? -hieu : 0;

  const ct40 = ct40a - ct40b;
  const ct43 = ct41 - ct42;

  return {
    ct22,
    ct23,
    ct23a: tay("ct23a"),
    ct24,
    ct24a: tay("ct24a"),
    ct25,
    ct26,
    ct27,
    ct28,
    ct29,
    ct30,
    ct31,
    ct32,
    ct32a,
    ct33,
    ct34,
    ct35,
    ct36,
    ct37,
    ct38,
    ct39a,
    ct40,
    ct40a,
    ct40b,
    ct41,
    ct42,
    ct43,
  };
}

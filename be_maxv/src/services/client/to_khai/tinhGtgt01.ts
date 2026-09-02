/**
 * Công thức mẫu 01/GTGT (Tờ khai thuế GTGT khấu trừ, TT80/2021/TT-BTC) — hàm THUẦN, không DB,
 * không HTTP. Mọi con số đem đi nộp thuế đều đi qua đây, nên đây cũng là chỗ đặt toàn bộ test
 * công thức (`src/__tests__/tinhGtgt01.test.ts`).
 *
 * Công thức lấy đúng theo nhãn in trên mẫu — xem mảng `HANG_GTGT01` trong
 * `hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.ts`, nơi từng dòng chỉ tiêu ghi sẵn công
 * thức của nó (hai màn Tờ khai và Dịch vụ công dùng chung mảng đó).
 */

import type { TongBanRa } from "./gomHoaDonGtgt";

/**
 * Ô kế toán chốt được giá trị. Hai loại, khác nhau ở chỗ máy có suy được hay không:
 *
 *   - máy KHÔNG suy được  ([22] [23a] [24a] [25] [37] [38] [39a] [40b] [42]) — mặc định 0;
 *   - máy suy được từ hóa đơn ([23] [24] [26] [29] [30] [31] [32] [32a] [33]) — ghi đè thì thắng.
 *
 * Ô CÔNG THỨC THUẦN ([27] [28] [34] [35] [36] [40] [40a] [41] [43]) cố tình KHÔNG có mặt: chúng
 * chỉ là tổng của các ô trên, cho sửa tay là mời tờ khai tự mâu thuẫn với chính nó.
 */
export type CtNhapTay =
  | "ct22"
  | "ct23"
  | "ct23a"
  | "ct24"
  | "ct24a"
  | "ct25"
  | "ct26"
  | "ct29"
  | "ct30"
  | "ct31"
  | "ct32"
  | "ct32a"
  | "ct33"
  | "ct37"
  | "ct38"
  | "ct39a"
  | "ct40b"
  | "ct42";

export const CT_NHAP_TAY: readonly CtNhapTay[] = [
  "ct22",
  "ct23",
  "ct23a",
  "ct24",
  "ct24a",
  "ct25",
  "ct26",
  "ct29",
  "ct30",
  "ct31",
  "ct32",
  "ct32a",
  "ct33",
  "ct37",
  "ct38",
  "ct39a",
  "ct40b",
  "ct42",
];

/**
 * Thuế được giảm theo nghị quyết, tách theo THUẾ SUẤT QUY ĐỊNH (không phải suất sau giảm).
 *
 * Vào công thức [31]/[33] đúng như HTKK làm — xem `tinhGtgt01`. Hàng giảm 10%->8% nằm ở `ts10`.
 */
export interface GiamThueTheoSuat {
  ts5: number;
  ts10: number;
}

export interface DauVaoGtgt01 {
  banRa: TongBanRa;
  muaVao: { ct23: number; ct24: number };
  /** Ô đã nhập tay/ghi đè. `ct25` VẮNG MẶT -> lấy mặc định bằng [24]; có mặt (kể cả 0) thì thắng. */
  nhapTay: Partial<Record<CtNhapTay, number>>;
  /** Thiếu -> coi như kỳ không có hàng được giảm thuế. */
  giamThue?: Partial<GiamThueTheoSuat>;
}

export type CtGtgt01 = Record<string, number>;

/**
 * Làm tròn về đồng — mọi ô tiền trên tờ khai là số nguyên.
 *
 * Đối xứng quanh 0, không dùng thẳng `Math.round`: JS làm tròn về phía +∞ nên `Math.round(-1,5)`
 * ra `-1` và `Math.round(-0,5)` ra `-0`, trong khi quy ước làm tròn tiền là "nửa ra xa 0" (-2, -1).
 * Ô âm xuất hiện khi kỳ trả hàng nhiều hơn bán.
 */
function lamTron(n: number): number {
  const v = n < 0 ? -Math.round(-n) : Math.round(n);
  return v === 0 ? 0 : v; // chặn `-0` lọt vào ô tiền
}

export function tinhGtgt01(dv: DauVaoGtgt01): CtGtgt01 {
  const tay = (k: CtNhapTay): number => Number(dv.nhapTay[k] ?? 0);

  // Ô máy suy được: ghi đè thắng, và giá trị đã ghi đè CHẢY TIẾP vào mọi công thức phía dưới.
  // Gán thẳng vào kết quả sau khi tính là cách cũ, và nó để lại tờ khai mâu thuẫn: sửa [26] mà
  // [34] = [26] + [27] vẫn giữ số cũ.
  const may = (k: CtNhapTay, mac: number): number =>
    dv.nhapTay[k] == null ? mac : Number(dv.nhapTay[k]);

  const ct22 = tay("ct22");
  const ct23 = may("ct23", dv.muaVao.ct23);
  const ct24 = may("ct24", dv.muaVao.ct24);
  // Máy không biết hóa đơn nào không đủ điều kiện khấu trừ, cũng không biết tỷ lệ phân bổ cho hoạt
  // động không chịu thuế -> mặc định khấu trừ hết, kế toán sửa thì `nhapTay.ct25` thắng.
  // Dùng `== null` chứ không `||`: khai "không được khấu trừ đồng nào" (0) là giá trị hợp lệ,
  // `||` sẽ nuốt mất và lặng lẽ quay về [24].
  const ct25 = dv.nhapTay.ct25 == null ? ct24 : Number(dv.nhapTay.ct25);

  const ct26 = may("ct26", dv.banRa.ct26);
  const ct29 = may("ct29", dv.banRa.ct29);
  const ct30 = may("ct30", dv.banRa.ct30);
  const ct32 = may("ct32", dv.banRa.ct32);
  const ct32a = may("ct32a", dv.banRa.ct32a);

  // [31]/[33] tính theo CÔNG THỨC của HTKK, không lấy tổng thuế thực tế trên hóa đơn:
  //     [31] = [30] x 5%  - (tổng cột 6 phụ lục, dòng thuế suất 5%)
  //     [33] = [32] x 10% - (tổng cột 6 phụ lục, dòng thuế suất 10%)
  // Quy tắc này in ngay trong bộ kiểm tra của HTKK (sheet `Header` của file tờ khai tải về), và
  // bản Q2/2026 đã nộp khớp đúng nó: làm tròn(391.249.917 x 10%) = 39.124.992, trừ 7.824.998 được
  // giảm, ra [33] = 31.299.994 — trong khi cộng thuế từng hóa đơn chỉ ra 31.299.993. Sai một đồng
  // ở đây chảy tiếp sang [28] [35] [36] [40a] [40], và qua [43] thì sang [22] của kỳ sau.
  // HTKK chỉ CẢNH BÁO khi [33] khác [32]x10% chứ không chặn, nên kế toán vẫn chốt tay được.
  const ct31 = may("ct31", lamTron(ct30 * 0.05) - Number(dv.giamThue?.ts5 ?? 0));
  const ct33 = may("ct33", lamTron(ct32 * 0.1) - Number(dv.giamThue?.ts10 ?? 0));

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

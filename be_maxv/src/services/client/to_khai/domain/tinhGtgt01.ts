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
export const CT_NHAP_TAY = [
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
] as const;

/** Suy TỪ mảng trên — khai hai lần là mời hai bên trôi lệch. */
export type CtNhapTay = (typeof CT_NHAP_TAY)[number];

export interface DauVaoGtgt01 {
  banRa: TongBanRa;
  muaVao: { ct23: number; ct24: number };
  /** Ô đã nhập tay/ghi đè. `ct25` VẮNG MẶT -> lấy mặc định bằng [24]; có mặt (kể cả 0) thì thắng. */
  nhapTay: Partial<Record<CtNhapTay, number>>;
}

export type CtGtgt01 = Record<string, number>;


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

  // [31]/[33] = CỘNG TIỀN THUẾ TỪNG HÓA ĐƠN trên bảng kê.
  //
  // HTKK có một công thức kiểm khác: `[33] = làm tròn([32] x 10%) - (cột 6 phụ lục)`. Hai cách là
  // CÙNG MỘT đại lượng — khai triển ra đều bằng `8% x nền8 + 10% x nền10` — chỉ khác chỗ làm tròn:
  // cộng từng hóa đơn thì làm tròn theo từng tờ, công thức thì làm tròn một lần trên tổng. Chênh
  // nhau vài đồng.
  //
  // Chọn cộng từng hóa đơn vì đó là số thuế THẬT đã ghi trên chứng từ giao cho khách. Đối chiếu hai
  // tờ khai đã nộp của MST 0111142786: Q1/2026 [33] = 408.646.091 và Q2/2026 [33] = 641.712.199 —
  // cộng từng hóa đơn khớp CẢ HAI từng đồng, còn công thức lệch 2 và 14 đồng.
  //
  // HTKK chỉ CẢNH BÁO khi hai số khác nhau chứ không chặn; `soatToKhai` cũng đối chiếu sẵn và nói
  // ra khi chênh vượt mức làm tròn, để kế toán biết trước lúc nạp file.
  const ct31 = may("ct31", dv.banRa.ct31);
  const ct33 = may("ct33", dv.banRa.ct33);

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

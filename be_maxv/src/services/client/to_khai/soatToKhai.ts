/**
 * Soát một bản tờ khai vừa tính và sinh câu cảnh báo cho màn hình.
 *
 * Tách riêng khỏi `toKhaiGtgt01.service.ts` vì đây là chỗ dễ sai ngưỡng nhất mà lại thuần: không
 * DB, không HTTP, test được đầy đủ (`src/__tests__/soatToKhai.test.ts`).
 *
 * Nguyên tắc: KHÔNG tự sửa số. Máy không biết kế toán định làm gì — nó chỉ nói ra chỗ đáng ngờ.
 */

import type { TongBanRa } from "./gomHoaDonGtgt";
import type { CtGtgt01 } from "./tinhGtgt01";
import { nhanKy, type Ky } from "./kySoThue";
import { lamTronDong } from "./tienVnd";

export interface DauVaoSoat {
  /** Bộ chỉ tiêu CUỐI (đã áp ghi đè). */
  ct: CtGtgt01;
  /** Bộ chỉ tiêu máy tính thuần, chưa áp ghi đè. */
  ctMay: CtGtgt01;
  /** Tổng thuế cộng THỰC từ bảng kê — mốc đối chiếu. */
  tongBanRa: TongBanRa;
  soHdBan: number;
  /** Thuế được giảm của nhóm thuế suất quy định 10%, lấy từ phụ lục. */
  giamThue10: number;
  kyNay: Ky;
  /** Kỳ mà [22] nối từ đó; `null` = nhập tay. */
  kyNguonCt22: Ky | null;
}

/** "quý" | "tháng" — để ghép câu tiếng Việt cho gọn. */
function tenLoaiKy(ky: Ky): string {
  return ky.kyLoai === "quy" ? "quý" : "tháng";
}

/**
 * Ngưỡng chênh lệch coi là "chỉ do làm tròn".
 *
 * Thuế của TỪNG hóa đơn được làm tròn riêng, còn công thức làm tròn một lần trên tổng, nên mỗi tờ
 * góp tối đa khoảng 1 đồng sai số. Kỳ 3 hóa đơn lệch 1 đồng là bình thường; kỳ 3 hóa đơn lệch
 * 200.000 thì có tờ ghi sai mức thuế.
 */
export function nguongLamTron(soHd: number): number {
  return Math.max(soHd, 0) + 1;
}

export function soatToKhai(dv: DauVaoSoat): string[] {
  const canhBao: string[] = [];

  // 1) Phụ lục dựng từ hóa đơn, nhưng [32] thì kế toán ghi đè được — hai số khi đó không còn ăn
  //    khớp và [33] có thể ra âm.
  const tranGiam = Math.abs(lamTronDong(dv.ct.ct32 * 0.1));
  if (dv.giamThue10 > tranGiam) {
    canhBao.push(
      `Thuế được giảm ở phụ lục (${dv.giamThue10.toLocaleString("vi")}) lớn hơn [32] × 10% ` +
        `(${tranGiam.toLocaleString("vi")}). Thường là do [32] bị sửa tay mà bảng kê chưa sửa theo.`,
    );
  }
  if (dv.ct.ct33 < 0) {
    canhBao.push(
      `[33] đang âm (${dv.ct.ct33.toLocaleString("vi")}) — kiểm tra lại [32] và phụ lục.`,
    );
  }

  // 2) Đối chiếu công thức với bảng kê. Dùng `ctMay` chứ không `ct`: ô kế toán ghi đè lệch khỏi
  //    hóa đơn là CỐ Ý, không phải lỗi cần báo.
  const nguong = nguongLamTron(dv.soHdBan);
  for (const [nhan, may, thuc] of [
    ["[31]", dv.ctMay.ct31, dv.tongBanRa.ct31],
    ["[33]", dv.ctMay.ct33, dv.tongBanRa.ct33],
  ] as const) {
    const lech = may - thuc;
    if (Math.abs(lech) <= nguong) continue;
    canhBao.push(
      `${nhan} theo công thức lệch ${lech.toLocaleString("vi")} đồng so với tổng thuế trên bảng ` +
        `kê (${dv.soHdBan} hóa đơn bán ra). Quá mức sai số làm tròn — kiểm tra mức thuế suất ghi ` +
        `trên hóa đơn.`,
    );
  }

  // 3) Đổi kỳ khai (quý <-> tháng) là lúc số chuyển sang đáng được nhìn lại.
  if (dv.kyNguonCt22 && dv.kyNguonCt22.kyLoai !== dv.kyNay.kyLoai) {
    canhBao.push(
      `[22] nối từ ${nhanKy(dv.kyNguonCt22)} — kỳ trước khai theo ${tenLoaiKy(dv.kyNguonCt22)} ` +
        `còn kỳ này theo ${tenLoaiKy(dv.kyNay)}. Đối chiếu lại số chuyển sang.`,
    );
  }

  return canhBao;
}


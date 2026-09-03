/**
 * Soát một bản tờ khai vừa tính và sinh câu cảnh báo cho màn hình.
 *
 * Tách riêng khỏi `toKhaiGtgt01.service.ts` vì đây là chỗ dễ sai ngưỡng nhất mà lại thuần: không
 * DB, không HTTP, test được đầy đủ (`src/__tests__/soatToKhai.test.ts`).
 *
 * Nguyên tắc: KHÔNG tự sửa số. Máy không biết kế toán định làm gì — nó chỉ nói ra chỗ đáng ngờ.
 */

import type { CtGtgt01 } from "./tinhGtgt01";
import { nhanKy, type Ky } from "./kySoThue";
import { lamTronDong } from "./tienVnd";

/**
 * Một hóa đơn THAY THẾ có tổng nhỏ hơn hóa đơn gốc nó thay.
 *
 * Thay thế là thay TOÀN BỘ tờ gốc — không có chuyện thay từng dòng. Nên khi tờ thay thế bỏ sót một
 * dòng hàng, phần tiền đó rơi khỏi tờ khai mà bảng kê không hiện dấu hiệu gì: nhìn vào chỉ thấy tờ
 * thay thế với số đúng của chính nó.
 */
export interface ThayTheHut {
  /** `C26TLT|2122` — ký hiệu và số của tờ THAY THẾ. */
  hoaDon: string;
  /** Số của tờ GỐC bị thay. */
  soGoc: string;
  /** Tiền chưa thuế của gốc trừ đi của tờ thay thế; luôn dương. */
  hut: number;
}

export interface DauVaoSoat {
  /** Bộ chỉ tiêu CUỐI (đã áp ghi đè). */
  ct: CtGtgt01;
  /** Bộ chỉ tiêu máy tính thuần, chưa áp ghi đè. */
  ctMay: CtGtgt01;
  soHdBan: number;
  /** Hóa đơn đã bị thay thế / đã bị hủy — luật loại khỏi tờ khai, gộp cả hai chiều. */
  biLoai: { soHd: number; giaTri: number };
  /** Tờ thay thế nhỏ hơn tờ gốc, gộp cả hai chiều — xem `ThayTheHut`. */
  thayTheHut: ThayTheHut[];
  /** Thuế được giảm của nhóm thuế suất quy định 10%, lấy từ phụ lục. */
  giamThue10: number;
  kyNay: Ky;
  /**
   * Câu mô tả phần dữ liệu còn THIẾU của chính kỳ đang lập (từ `phanThieuPhuKy`); `null` = đã đồng
   * bộ trọn vẹn.
   */
  thieuDuLieuKyNay: string | null;
  /** Kỳ mà [22] nối từ đó; `null` = nhập tay. */
  kyNguonCt22: Ky | null;
  /**
   * Câu mô tả phần dữ liệu còn THIẾU của kỳ nguồn [22] (từ `canhBaoPhuKy`); `null` = kỳ đó đã đồng
   * bộ trọn vẹn, hoặc [22] không nối từ kỳ nào.
   */
  thieuDuLieuKyNguonCt22: string | null;
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

  // 2) Đối chiếu số của ta với CÔNG THỨC KIỂM CỦA HTKK.
  //
  //    [31]/[33] lấy tổng thuế thực trên hóa đơn (xem `tinhGtgt01.ts`), còn HTKK kiểm bằng
  //    `làm tròn([32] x 10%) - (cột 6 phụ lục)`. Cùng một đại lượng, chỉ khác chỗ làm tròn nên
  //    thường chênh vài đồng — HTKK chỉ nhắc chứ không chặn. Chênh VƯỢT mức làm tròn thì không
  //    còn là chuyện làm tròn nữa: có hóa đơn ghi sai mức thuế suất.
  //
  //    Dùng `ctMay` chứ không `ct`: ô kế toán ghi đè lệch khỏi hóa đơn là CỐ Ý, không phải lỗi.
  // `ct`/`ctMay` có thể đọc từ JSON của bản lưu cũ nên khóa có thể vắng mặt -> `?? 0`, không thì
  // phép nhân ra NaN và câu cảnh báo in "NaN đồng".
  const oMay = (k: string) => Number(dv.ctMay[k] ?? 0);
  const nguong = nguongLamTron(dv.soHdBan);
  for (const [nhan, thuc, htkk] of [
    ["[31]", oMay("ct31"), lamTronDong(oMay("ct30") * 0.05)],
    ["[33]", oMay("ct33"), lamTronDong(oMay("ct32") * 0.1) - dv.giamThue10],
  ] as const) {
    const lech = thuc - htkk;
    if (Math.abs(lech) <= nguong) continue;
    canhBao.push(
      `${nhan} cộng từ bảng kê (${thuc.toLocaleString("vi")}) lệch ` +
        `${lech.toLocaleString("vi")} đồng so với công thức kiểm của HTKK ` +
        `(${htkk.toLocaleString("vi")}), trên ${dv.soHdBan} hóa đơn bán ra. Quá mức sai số làm ` +
        `tròn — kiểm tra mức thuế suất ghi trên hóa đơn.`,
    );
  }

  // 3) Đổi kỳ khai (quý <-> tháng) là lúc số chuyển sang đáng được nhìn lại.
  if (dv.kyNguonCt22 && dv.kyNguonCt22.kyLoai !== dv.kyNay.kyLoai) {
    canhBao.push(
      `[22] nối từ ${nhanKy(dv.kyNguonCt22)} — kỳ trước khai theo ${tenLoaiKy(dv.kyNguonCt22)} ` +
        `còn kỳ này theo ${tenLoaiKy(dv.kyNay)}. Đối chiếu lại số chuyển sang.`,
    );
  }

  // 4) Hóa đơn bị LUẬT loại khỏi tờ khai.
  //
  //    Chúng đã bị GIẤU khỏi bảng kê (xem `layBangKeTheoKy`) nên không còn dấu vết nào trên màn
  //    hình — câu này là chỗ DUY NHẤT nói ra. Đây không phải lỗi, nhưng kế toán đối chiếu với sổ
  //    sẽ thấy hụt đúng số tiền đó và cần biết vì sao (đo thật Q1/2026: 1.490.909.300 đồng).
  if (dv.biLoai.soHd > 0) {
    canhBao.push(
      `${dv.biLoai.soHd} hóa đơn đã bị thay thế / đã bị hủy không được kê và không hiện trên bảng ` +
        `kê (${dv.biLoai.giaTri.toLocaleString("vi")} đồng chưa thuế). Đúng quy định — nêu ra để ` +
        `đối chiếu khi sổ kế toán vẫn còn những tờ này.`,
    );
  }

  // 5) Hóa đơn thay thế bỏ sót dòng hàng.
  //
  //    Ca thật C26TLT 2122 thay cho 1056: tờ gốc có hai dòng (bánh xe gang 852.000 @10% + bánh xe
  //    đẩy 540.000 @8%), tờ thay thế được lập để sửa thuế suất dòng bánh xe gang nhưng QUÊN dòng
  //    còn lại. 540.000 rơi khỏi [32] mà không ai thấy. Đo trên dữ liệu thật: 4 tờ bán ra hụt
  //    2.342.000 và 1 tờ mua vào hụt 263.460.500.
  if (dv.thayTheHut.length > 0) {
    const tong = dv.thayTheHut.reduce((s, x) => s + x.hut, 0);
    // Sắp lại theo số tiền TRƯỚC khi cắt còn 3: danh sách vào đây là hai chiều nối đuôi nhau, cắt
    // thẳng thì tờ hụt nhiều nhất có thể rơi vào phần bị giấu — đúng tờ cần nhìn nhất.
    const vaiTo = [...dv.thayTheHut]
      .sort((a, b) => b.hut - a.hut)
      .slice(0, 3)
      .map((x) => `${x.hoaDon} thay |${x.soGoc} hụt ${x.hut.toLocaleString("vi")}`);
    canhBao.push(
      `${dv.thayTheHut.length} hóa đơn thay thế có tổng NHỎ HƠN hóa đơn gốc, hụt ` +
        `${tong.toLocaleString("vi")} đồng (${vaiTo.join("; ")}` +
        `${dv.thayTheHut.length > 3 ? "; …" : ""}). Thay thế là thay TOÀN BỘ tờ gốc nên phần chênh ` +
        `này rơi khỏi tờ khai — kiểm tra tờ thay thế có sót dòng hàng không.`,
    );
  }

  // 6) Chính kỳ đang lập còn thiếu hóa đơn.
  //
  //    Dialog "Kê khai" đã cảnh báo lúc gán kỳ, nhưng đó là một lần rồi thôi: kế toán bấm qua, hoặc
  //    mở lại bản nháp hôm sau, thì màn tờ khai không còn dấu vết gì. Mà tờ khai thiếu 1/3 số liệu
  //    trông y hệt tờ khai đủ.
  if (dv.thieuDuLieuKyNay) {
    canhBao.push(
      `${nhanKy(dv.kyNay)} chưa đồng bộ đủ hóa đơn (${dv.thieuDuLieuKyNay}). Mọi chỉ tiêu trên đây ` +
        `đang tính thiếu — đồng bộ trọn kỳ rồi kê khai lại.`,
    );
  }

  // 7) [22] nối từ một kỳ chưa đồng bộ đủ hóa đơn.
  //
  //    Đây là lỗi im lặng nặng nhất của cả module: [22] sai thì [41] và [43] sai theo, mà [43] lại
  //    chảy tiếp sang [22] của kỳ sau — một kỳ thiếu dữ liệu làm hỏng mọi kỳ về sau, không kỳ nào
  //    có dấu hiệu gì. Ca thật (MST 0111142786): Q4/2025 chỉ đồng bộ tháng 12, [43] ra 42.997.436
  //    thay vì 366.696.473 trên tờ khai đã nộp, kéo [43] của Q1/2026 hụt 323.594.395 đồng.
  if (dv.kyNguonCt22 && dv.thieuDuLieuKyNguonCt22) {
    canhBao.push(
      `[22] nối từ [43] của ${nhanKy(dv.kyNguonCt22)}, nhưng kỳ đó chưa đồng bộ đủ hóa đơn ` +
        `(${dv.thieuDuLieuKyNguonCt22}). [22] gần như chắc chắn thiếu, kéo [41] và [43] sai theo — ` +
        `đồng bộ trọn ${nhanKy(dv.kyNguonCt22)} rồi tính lại, hoặc nhập tay [22] theo tờ khai đã ` +
        `nộp của kỳ đó.`,
    );
  }

  return canhBao;
}


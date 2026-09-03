/**
 * Phụ lục "Giảm thuế giá trị gia tăng theo Nghị quyết 204/2025/QH15" — nộp KÈM tờ khai 01/GTGT khi
 * kỳ có hàng được giảm thuế từ 10% xuống 8%.
 *
 * Cấu trúc bám bản thật (đối chiếu Q1+Q2/2026 của MST 0111142786 và Q2/2026 của MST 0106861880):
 *   Mục I   — hàng MUA VÀO nhóm 8% (xem `gopMuaVao8`)
 *   Mục II  — hàng BÁN RA nhóm 8%: giá trị, thuế suất quy định (10%), sau giảm (8%),
 *             thuế được giảm = giá trị × (10% − 8%)
 *   Mục III — chênh lệch [09] = thuế bán ra được giảm − thuế mua vào
 *
 * Hàm THUẦN, không đụng DB — test ở `src/__tests__/phuLuc204.test.ts`.
 */

import type { KetQuaBanRa, KetQuaMuaVao, NhomThueSuat } from "./gomHoaDonGtgt";
import { lamTronDong } from "./tienVnd";

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

/** Gộp tên hàng thành một câu mô tả, cắt bằng "..." khi còn nữa (giống cách bản thật viết). */
/**
 * Trần độ dài ô mô tả hàng hóa của phụ lục.
 *
 * 75 ký tự theo đúng bản HTKK xuất: "Bánh xe, Càng bánh xe, Xe đẩy, Cước vận chuyển, VPP, Dịch vụ
 * ăn uống, khác…". Đếm 12 TÊN là chưa đủ — có công ty đặt tên hàng dài cả trăm ký tự ("Bánh xe của
 * xe đẩy hàng hóa bằng sắt kết hợp nhựa, có giá đỡ bằng sắt 1 bánh, cỡ bánh xe phi 100mm…"), một
 * tên như thế đã vượt trần.
 */
export const DAI_TOI_DA_MO_TA = 75;

/**
 * Cắt mô tả về trần, thêm " ..." khi còn nữa.
 *
 * Ưu tiên cắt ở ranh giới TÊN (dấu ", " giữa các tên); tên đầu tiên mà đã quá dài thì cắt ở
 * khoảng trắng gần nhất để không đứt giữa từ. Không cắt ở dấu phẩy bất kỳ: chính tên hàng cũng
 * chứa dấu phẩy ("bằng sắt kết hợp nhựa, có giá đỡ bằng sắt 1 bánh") nên lấy nó làm ranh giới sẽ
 * đứt giữa một tên và mô tả đọc thành câu cụt.
 *
 * Export để chỗ dựng XML gọi lại — bản phụ lục lưu trong DB từ trước có thể còn mô tả dài, mà file
 * nộp thuế thì không được dài.
 */
/** Đuôi báo "còn nữa". Tính vào trần nên cắt hai lần vẫn ra một kết quả. */
const DUOI_CON_NUA = " ...";

export function catMoTa(mo: string): string {
  if (mo.length <= DAI_TOI_DA_MO_TA) return mo;
  // Chuỗi ĐÃ cắt thì trả nguyên. Mô tả đi qua hai chỗ cắt (đọc bản cũ ở `docBan`, rồi dựng XML),
  // không chặn ở đây là lần sau xén tiếp và chồng thành "... ...".
  if (mo.endsWith(DUOI_CON_NUA) && mo.length <= DAI_TOI_DA_MO_TA + DUOI_CON_NUA.length) return mo;
  const cat = mo.slice(0, DAI_TOI_DA_MO_TA);
  const ranhGioiTen = cat.lastIndexOf(", ");
  if (ranhGioiTen > 0) return `${cat.slice(0, ranhGioiTen)}${DUOI_CON_NUA}`;
  const khoangTrang = cat.lastIndexOf(" ");
  return `${khoangTrang > 0 ? cat.slice(0, khoangTrang) : cat}${DUOI_CON_NUA}`;
}

function moTaHang(tenHang: string[]): string {
  if (tenHang.length === 0) return "";
  const cau = tenHang.join(", ");
  if (cau.length > DAI_TOI_DA_MO_TA) return catMoTa(cau);
  return tenHang.length >= 12 ? `${cau} ...` : cau;
}

/**
 * Mục I lấy ĐÚNG nhóm 8% của hàng mua vào — theo đúng tiêu đề mẫu ("...được áp dụng mức thuế suất
 * thuế giá trị gia tăng 8%").
 *
 * Từng có bản gộp MỌI nhóm có thuế, suy từ phụ lục thật Q2/2026 của MST 0106861880 (thuế 5.102.437
 * = 5.081.437 nhóm 8% + 21.000 nhóm 10%). Hai tờ khai thật của MST 0111142786 bác cách đó:
 *
 *              | phụ lục đã nộp          | chỉ nhóm 8%          | mọi nhóm có thuế
 *   Q1/2026    | 6.185.602.920           | lệch    -8.685.122   | lệch +1.022.271.928
 *   Q2/2026    | 7.880.500.667           | lệch    -9.268.211   | lệch   +793.410.717
 *
 * Tức 0,1% so với 11-17%. Phần lệch còn lại đúng bằng 8% cả hai kỳ (694.811 và 741.459 tiền thuế) —
 * là hàng 8% mà cổng thuế ghi thiếu trong `thttltsuat`, không phải nhóm 10% lẫn vào. Con số
 * 21.000 của MST 0106861880 nhiều khả năng là một dòng kế toán tự thêm tay.
 */
function gopMuaVao8(theoNhan: Record<string, NhomThueSuat>): {
  giaTri: number;
  thue: number;
  tenHang: string[];
} {
  const nhom = theoNhan[NHAN_GIAM_THUE];
  return {
    giaTri: nhom?.giaTri ?? 0,
    thue: nhom?.thue ?? 0,
    tenHang: nhom?.tenHang ?? [],
  };
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
  // Cả hai mục đều chỉ lấy nhóm 8% — xem ghi chú `gopMuaVao8`.
  const mua = gopMuaVao8(muaVao.theoNhan);

  const giaTriBan = nhomBan?.giaTri ?? 0;
  // Làm tròn thường — số đối chứng ở `tienVnd.ts`.
  const thueDuocGiam = lamTronDong(
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

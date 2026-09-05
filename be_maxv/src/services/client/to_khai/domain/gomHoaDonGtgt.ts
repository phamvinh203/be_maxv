/**
 * Lọc hóa đơn theo trạng thái rồi gộp tiền theo từng mức thuế suất, ra đúng các ô của mẫu 01/GTGT.
 *
 * Hàm THUẦN: nhận mảng dòng đã đọc sẵn từ `vct50view`/`vct60view`, không đụng DB — nhờ vậy test
 * được không cần Postgres (`src/__tests__/gomHoaDonGtgt.test.ts`).
 *
 * Đầu vào là hóa đơn ĐÃ GÁN KỲ và kế toán để `ke_khai = true`; việc loại hóa đơn "không kê khai"
 * làm ở tầng service, không ở đây.
 *
 * Số tách theo thuế suất nằm ở `detail.thttltsuat`. Thiếu khối đó thì thử suy MỘT mức từ tổng hóa
 * đơn (`nhomTuTongHoaDon`); suy không ra thì xếp vào `treo` thay vì cộng nhầm vào một ô nào đó.
 */

import { lamTronDong } from "./tienVnd";

/** Dòng hóa đơn tối giản mà engine cần — khớp `select` của tầng service. */
export interface HoaDonGom {
  id: string;
  tthai: string | null;
  dvtte: string | null;
  /** Prisma trả `Decimal`; ép qua `so()` trước khi tính. */
  tgia: unknown;
  tgtcthue: unknown;
  tgtthue: unknown;
  detail: unknown;
}

export interface TongBanRa {
  ct26: number;
  ct29: number;
  ct30: number;
  /** Tiền thuế 5% cộng THỰC từ hóa đơn — đây CHÍNH LÀ [31] của tờ khai (xem `tinhGtgt01.ts`). */
  ct31: number;
  ct32: number;
  ct32a: number;
  /** Tiền thuế 10% + 8% cộng THỰC từ hóa đơn — đây CHÍNH LÀ [33] của tờ khai. */
  ct33: number;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

/**
 * Số liệu của MỘT mức thuế suất, giữ nguyên theo nhãn gốc.
 *
 * Cần vì tờ khai chính gộp 8% chung dòng với 10% ([32]/[33]), trong khi phụ lục giảm thuế theo
 * Nghị quyết 204/2025 lại phải khai RIÊNG nhóm 8% — không tách ở đây thì phụ lục không dựng được.
 */
export interface NhomThueSuat {
  giaTri: number;
  thue: number;
  /** Tên hàng gặp trong nhóm, đã khử trùng, giữ thứ tự xuất hiện — để mô tả hàng hóa ở phụ lục. */
  tenHang: string[];
}

/**
 * Hóa đơn bị LUẬT loại khỏi tờ khai (đã bị thay thế / đã bị hủy) — đếm riêng để nói ra.
 *
 * Chúng vẫn nằm trong bảng kê với cột "Kê khai" bật, nhưng engine bỏ qua. Không đếm ra thì kế toán
 * nhìn bảng kê thấy tick mà số không vào tờ khai, không hiểu vì sao (đo thật: 1.424.055.300 đồng
 * mua vào của Q1/2026 bị loại lặng lẽ).
 */
export interface HoaDonBiLoai {
  soHd: number;
  /** Tiền chưa thuế, ĐÃ quy về đồng như mọi số khác. */
  giaTri: number;
}

export interface KetQuaBanRa {
  tong: TongBanRa;
  treo: HoaDonTreo[];
  /** Hóa đơn đã bị thay thế (4) / đã bị hủy (6) — luật cấm kê, không có cách nào bật lên. */
  biLoai: HoaDonBiLoai;
  /** Nhóm `tthai=3` — ĐÃ cộng vào `tong`, tách ra đây chỉ để hiển thị và soát dấu. */
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  /** Số liệu theo TỪNG nhãn thuế suất (`"8%"`, `"10%"`, `"KCT"`…) — nguồn cho phụ lục giảm thuế. */
  theoNhan: Record<string, NhomThueSuat>;
  soHd: number;
}

export interface KetQuaMuaVao {
  ct23: number;
  ct24: number;
  treo: HoaDonTreo[];
  biLoai: HoaDonBiLoai;
  /**
   * Số liệu theo từng nhãn thuế suất. Hóa đơn không tách được mức (nhiều mức mà cổng chỉ trả tổng,
   * hoặc thuế bằng 0) vẫn được cộng vào `ct23`/`ct24` (mua vào chỉ cần tổng) nhưng không xuất hiện
   * ở đây — nên tổng các nhãn có thể NHỎ HƠN `ct23`, đừng dùng nó để kiểm tra chéo.
   */
  theoNhan: Record<string, NhomThueSuat>;
  soHd: number;
}

/** Trạng thái bị loại khỏi tờ khai: 4 = đã bị thay thế, 6 = đã bị hủy. */
const TTHAI_LOAI = new Set(["4", "6"]);

export function duocTinh(tthai: string | null): boolean {
  return !TTHAI_LOAI.has(String(tthai ?? "").trim());
}

/** Decimal/số/chuỗi -> number; không đọc được -> 0. */
function so(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Nhãn "thuế suất khác" của cổng thuế, có mức thật gắn kèm: `KHAC:08.00%`, `KHAC:8%`.
 *
 * Gặp thật trên hóa đơn mua vào của MST 0111142786: một nhóm 1.869.629.200 đồng, thuế 149.570.336
 * — đúng 8,00%. Không bóc mức ra thì nhãn này thành một nhóm riêng: bên MUA VÀO chỉ lệch phụ lục,
 * nhưng bên BÁN RA thì cả hóa đơn bị xếp vào `treo` và rơi khỏi [32], tức mất doanh thu mà bảng
 * không hiện dấu hiệu gì.
 */
const NHAN_KHAC_RE = /^KHAC:\s*([\d.]+)\s*%?$/;

/**
 * Chuẩn hóa nhãn thuế suất cổng trả ("10", "10%", " KCT ", "KHAC:08.00%") về một dạng duy nhất để
 * tra bảng ánh xạ. Mức số ra `"10%"`; mã chữ ra chữ hoa không khoảng trắng thừa.
 */
function chuanHoaNhan(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  const khac = NHAN_KHAC_RE.exec(s);
  if (khac) {
    const mucKhac = Number(khac[1]);
    // `KHAC` không kèm mức đọc được thì giữ nguyên chuỗi — thà treo hóa đơn còn hơn đoán một mức.
    if (Number.isFinite(mucKhac)) return `${mucKhac}%`;
  }
  const chuoiSo = s.replace("%", "").trim();
  // Rỗng sau khi bỏ "%" (nhãn rác kiểu chỉ có dấu "%") -> `Number("")` là `0`, KHÔNG phải `NaN`
  // (quái tính của JS) — không chặn ở đây thì nhãn rác lặng lẽ thành "0%" và tiền chảy vào [29]
  // thay vì treo để người xem lại.
  if (!chuoiSo) return s;
  const phanTram = Number(chuoiSo);
  return Number.isFinite(phanTram) ? `${phanTram}%` : s;
}

/**
 * Nhãn thuế suất -> ô nhận giá trị và ô nhận tiền thuế. Thêm/đổi mức thuế suất CHỈ sửa bảng này.
 */
const O_THEO_NHAN: Record<string, { giaTri: keyof TongBanRa; thue?: keyof TongBanRa }> = {
  KCT: { giaTri: "ct26" },
  "0%": { giaTri: "ct29" },
  "5%": { giaTri: "ct30", thue: "ct31" },
  // 8% (giảm theo nghị quyết) kê chung dòng 10%. Số thuế cộng ở đây là thuế THỰC trên hóa đơn và
  // đi thẳng vào [33] của tờ khai — xem `tinhGtgt01.ts`.
  "8%": { giaTri: "ct32", thue: "ct33" },
  "10%": { giaTri: "ct32", thue: "ct33" },
  KKKNT: { giaTri: "ct32a" },
};

/** Số tên hàng giữ lại mỗi nhãn — phụ lục chỉ cần một câu mô tả, giữ hết là ô dài vô tận. */
export const TEN_HANG_TOI_DA = 12;

/** Nhãn thuế suất của một dòng — cổng thuế dùng lẫn lộn 3 tên trường tùy loại hóa đơn. */
function nhanCuaDong(o: Record<string, unknown>): string {
  return chuanHoaNhan(o.ltsuat ?? o.tsuat ?? o.thuesuat);
}

/**
 * Tên hàng của các dòng thuộc một nhãn thuế suất, đọc từ `detail.hdhhdvu`.
 *
 * Mảng `thttltsuat` chỉ có tiền theo mức thuế, không có tên hàng — tên nằm ở mảng dòng hàng, mỗi
 * dòng mang nhãn thuế suất riêng. Hóa đơn không có mảng dòng hàng (chỉ có tổng) -> không tên nào.
 */
function tenHangTheoNhan(detail: unknown): Map<string, string[]> {
  const ra = new Map<string, string[]>();
  if (!detail || typeof detail !== "object") return ra;
  const ds = (detail as Record<string, unknown>).hdhhdvu;
  if (!Array.isArray(ds)) return ra;
  for (const it of ds) {
    const o = (it ?? {}) as Record<string, unknown>;
    const nhan = nhanCuaDong(o);
    const ten = String(o.ten ?? o.tenhang ?? "").trim();
    if (!nhan || !ten) continue;
    const cu = ra.get(nhan) ?? [];
    if (!cu.includes(ten)) cu.push(ten);
    ra.set(nhan, cu);
  }
  return ra;
}

/** Cộng một nhóm vào bảng theo nhãn, khử trùng tên hàng và chặn trần độ dài. */
function congVaoNhan(
  bang: Record<string, NhomThueSuat>,
  nhan: string,
  giaTri: number,
  thue: number,
  tenHang: string[],
): void {
  const cu = bang[nhan] ?? { giaTri: 0, thue: 0, tenHang: [] };
  for (const t of tenHang) {
    if (cu.tenHang.length >= TEN_HANG_TOI_DA) break;
    if (!cu.tenHang.includes(t)) cu.tenHang.push(t);
  }
  bang[nhan] = {
    giaTri: cu.giaTri + giaTri,
    thue: cu.thue + thue,
    tenHang: cu.tenHang,
  };
}

/** Một nhóm thuế suất của hóa đơn sau khi đã chuẩn hóa. */
export interface NhomTien {
  nhan: string;
  thtien: number;
  tthue: number;
}

/** Các mức thuế suất CÓ tiền thuế mà một nhóm có thể mang — dùng khi phải suy ngược mức thật. */
const SUAT_CO_THUE = [5, 8, 10] as const;

/** Số nhóm tối đa còn dò hết tổ hợp được (3^6 = 729 phép thử). Vượt ngưỡng thì thôi, không đoán. */
const NHOM_TOI_DA_DO = 6;

/** Nhãn `"8%"` -> 8; nhãn chữ (KCT/KKKNT) hoặc rỗng -> `null`. */
function suatTuNhan(nhan: string): number | null {
  const s = Number(nhan.replace("%", ""));
  return Number.isFinite(s) && s > 0 ? s : null;
}

/**
 * Suy MỨC THUẾ SUẤT THẬT của từng nhóm từ tiền thuế, khi nhãn cổng trả không đáng tin.
 *
 * Ràng buộc: `Σ (tthue_i ÷ suất_i)` phải bằng đúng `tgtcthue`. Dò hết tổ hợp mức trong
 * `SUAT_CO_THUE` và chỉ nhận khi có ĐÚNG MỘT tổ hợp thỏa — hai tổ hợp cùng thỏa nghĩa là dữ liệu
 * không đủ để kết luận, thà giữ nguyên còn hơn chuyển tiền nhầm giữa nhóm 8% và nhóm 10%.
 *
 * Trả về mảng tiền theo từng nhóm, hoặc `null` khi không có lời giải duy nhất.
 */
function suyMucThueSuat(nhom: NhomTien[], tgtcthue: number): { suat: number; tien: number }[] | null {
  if (nhom.length > NHOM_TOI_DA_DO) return null;

  let loiGiai: { suat: number; tien: number }[] | null = null;
  let soLoiGiai = 0;
  const dang: { suat: number; tien: number }[] = [];

  const duyet = (i: number, conLai: number): void => {
    // Thấy lời giải thứ hai là dừng: đằng nào cũng trả `null`, dò tiếp chỉ tốn công.
    if (soLoiGiai > 1) return;
    if (i === nhom.length) {
      if (Math.abs(conLai) > 1) return;
      soLoiGiai += 1;
      loiGiai = dang.map((x) => ({ ...x }));
      return;
    }
    for (const suat of SUAT_CO_THUE) {
      const tien = nhom[i].tthue / (suat / 100);
      dang.push({ suat, tien });
      duyet(i + 1, conLai - tien);
      dang.pop();
    }
  };
  duyet(0, tgtcthue);

  return soLoiGiai === 1 ? loiGiai : null;
}

/**
 * Vá hóa đơn mà cổng trả `thtien` NHÂN BẢN — mọi nhóm ghi bằng TỔNG hóa đơn thay vì tiền của
 * riêng nhóm.
 *
 * Ca thật (MST 0111142786, hóa đơn C26TLT 1090, `tgtcthue` = 41.499.000):
 *
 *     [ { 8%,  thuế 3.096.880, thtien 41.499.000 },
 *       { 10%, thuế   278.800, thtien 41.499.000 } ]
 *
 * Cộng thẳng `thtien` là tính 41.499.000 HAI LẦN. Số thật suy ngược từ tiền thuế:
 * 3.096.880 ÷ 8% = 38.711.000 và 278.800 ÷ 10% = 2.788.000, cộng lại đúng bằng `tgtcthue`.
 * Đo trên dữ liệu thật: 38 hóa đơn bán ra dính, tổng thừa 213.346.363 — đúng bằng phần lệch [32]
 * của hai kỳ so với tờ khai đã nộp.
 *
 * ===== NHÃN THUẾ SUẤT CŨNG HỎNG THEO =====
 *
 * Hóa đơn dính lỗi này thường bị chép luôn cả `tsuat` của nhóm đầu sang nhóm sau. Ca thật
 * (C26TLT 426, `tgtcthue` = 786.000, `tgtthue` = 66.280):
 *
 *     [ { "8%", thuế 49.280, thtien 786.000 },
 *       { "8%", thuế 17.000, thtien 786.000 } ]
 *
 * Nhóm sau ghi 8% nhưng 17.000 ÷ 8% = 212.500 không ra tổng nào đúng; chỉ 17.000 ÷ 10% = 170.000
 * mới cho 616.000 + 170.000 = 786.000 — khớp từng đồng với sổ kế toán. Nên phải suy lại MỨC trước,
 * rồi mới chia tiền (`suyMucThueSuat`), thay vì tin nhãn. Tin nhãn thì [32] vẫn đúng (8% và 10%
 * chung một ô) nhưng phụ lục giảm thuế lệch, kéo [33] lệch theo.
 *
 * Nhận diện HẸP, không đoán rộng: chỉ vá khi có TỪ HAI nhóm và MỌI nhóm ghi `thtien` bằng
 * `tgtcthue`. Hóa đơn nhiều nhóm mà tổng khớp `tgtcthue` là dữ liệu lành, không đụng vào.
 *
 * Không suy được mức duy nhất thì lùi về `tthue ÷ nhãn`. Nhóm thuế 0 hoặc nhãn chữ (KCT/KKKNT) làm
 * cả hai đường mất nghĩa -> TRẢ NGUYÊN mảng cũ, để hóa đơn rơi vào nhóm treo thay vì bịa cách chia.
 *
 * ===== TIỀN CỦA TỪNG NHÓM LÀ `tthue ÷ suất`, KHÔNG PHẢI CHIA TỈ LỆ =====
 *
 * Mỗi nhóm nhận đúng `tthue ÷ suất` của chính nó; nhóm CUỐI nhận phần còn lại để tổng khớp
 * `tgtcthue` từng đồng. Bản trước chia tỉ lệ (`tgtcthue × trọngSố ÷ Σ trọngSố`) nên khi tổng các
 * base không khớp `tgtcthue` — hóa đơn có chiết khấu hoặc làm tròn lẻ — phần dư bị rải đều và làm
 * lệch MỌI nhóm.
 *
 * Ca thật C26TLT 978 (`tgtcthue` = 3.959.273, thuế 184.000 + 165.927):
 *
 *     tiền thật : 8% = 184.000 ÷ 8%  = 2.300.000   (khớp sổ kế toán)
 *                 10% = 165.927 ÷ 10% = 1.659.270   -> tổng 3.959.270, thiếu 3 đồng
 *     chia tỉ lệ: 8% = 2.300.002 · 10% = 1.659.271  -> SAI cả hai nhóm
 *     cách này  : 8% = 2.300.000 · 10% = 1.659.273  -> khớp sổ kế toán
 *
 * Cách này cũng đúng hơn ở ca nhãn hỏng: `[616.000, 786.000 − 616.000] = [616.000, 170.000]` ra
 * thẳng số thật mà không cần giải, trong khi chia tỉ lệ ra 584.401/201.599 — không phải base của
 * mức thuế nào.
 *
 * ===== AI NHẬN PHẦN LẺ =====
 *
 * Nhóm mà `tthue ÷ suất` KHÔNG ra số nguyên — vì tiền thuế của chính nhóm đó đã bị làm tròn nên
 * base của nó là số kém chắc chắn nhất. Base tiền Việt luôn nguyên đồng; nhóm chia hết là nhóm có
 * base chắc, đừng đụng vào. Ca thật C26TLT 364 (`tgtcthue` = 7.761.090, thuế 611.287 + 12.000):
 *
 *     12.000 ÷ 10%  = 120.000       -> nguyên, base chắc
 *     611.287 ÷ 8%  = 7.641.087,5   -> lẻ, nhận phần còn lại = 7.761.090 − 120.000 = 7.641.090
 *
 * Khớp sổ kế toán. Dồn theo vị trí (nhóm cuối) thì tờ này sai 2 đồng. Mọi nhóm đều chia hết mà
 * tổng vẫn lệch (ca 978, lẻ 3 đồng của bản thân hóa đơn) -> nhóm CUỐI nhận, cũng khớp sổ.
 */
export function vaNhomNhanBan(nhom: NhomTien[], tgtcthue: number): NhomTien[] {
  if (nhom.length < 2 || tgtcthue === 0) return nhom;
  const nhanBan = nhom.every((n) => Math.abs(n.thtien - tgtcthue) <= 1);
  if (!nhanBan) return nhom;
  if (nhom.some((n) => n.tthue === 0 || suatTuNhan(n.nhan) === null)) return nhom;

  const suy = suyMucThueSuat(nhom, tgtcthue);
  const tienNhom = nhom.map((n, i) => suy?.[i].tien ?? n.tthue / (suatTuNhan(n.nhan)! / 100));
  const tong = tienNhom.reduce((a, b) => a + b, 0);
  if (tong === 0) return nhom;

  // Nhóm cuối nhận phần CÒN LẠI: tổng phân bổ phải khớp `tgtcthue` từng đồng, lệch một đồng ở đây
  // là lệch thẳng vào [32].
  // Nhóm nhận phần lẻ: nhóm cuối cùng có base KHÔNG nguyên đồng; mọi nhóm đều nguyên thì nhóm cuối.
  const leDong = (x: number) => Math.abs(x - Math.round(x)) > 1e-6;
  let oNhanDu = nhom.length - 1;
  for (let i = 0; i < tienNhom.length; i += 1) if (leDong(tienNhom[i])) oNhanDu = i;

  const tien = tienNhom.map((t) => lamTronDong(t));
  tien[oNhanDu] = tgtcthue - tien.reduce((s, x, i) => (i === oNhanDu ? s : s + x), 0);

  // Nhãn đi theo mức vừa suy ra — nó quyết định hóa đơn vào nhóm 8% của phụ lục hay không.
  return nhom.map((n, i) => ({ ...n, nhan: suy ? `${suy[i].suat}%` : n.nhan, thtien: tien[i] }));
}

/**
 * Suy MỘT nhóm thuế suất từ tổng của cả hóa đơn, dùng khi cổng thuế không trả khối `thttltsuat`.
 *
 * Gặp thật (MST 0111142786): 122 hóa đơn mua vào — điện lực, Viettel, MobiFone — chỉ có tổng, không
 * có khối tách thuế suất. Chúng vẫn vào [23]/[24] (mua vào chỉ cần tổng) nhưng KHÔNG vào bảng
 * `theoNhan`, nên phụ lục giảm thuế hụt mất phần hàng 8% của chúng: Mục I thiếu 8.685.122 ở Q1 và
 * 9.268.211 ở Q2 so với phụ lục đã nộp.
 *
 * Chỉ nhận khi ĐÚNG MỘT mức khớp tiền thuế trong sai số 1 đồng. Hai ca cố tình từ chối:
 *
 *   - `tthue = 0`: không phân biệt được KCT (vào [26]) với thuế suất 0% (vào [29]) — hai ô khác
 *     nhau, đoán sai là chuyển tiền sang sai dòng tờ khai.
 *   - Hóa đơn NHIỀU mức: tỷ lệ thuế/tiền ra một số không phải mức nào (7 hóa đơn FPT: 9,4109%).
 *     Không suy được thì để nguyên, thà thiếu ở phụ lục còn hơn xếp nhầm nhóm được giảm thuế.
 */
function nhomTuTongHoaDon(tgtcthue: number, tgtthue: number): NhomTien[] | null {
  if (tgtcthue === 0 || tgtthue === 0) return null;
  const khop = SUAT_CO_THUE.filter(
    (m) => Math.abs(tgtthue - lamTronDong((tgtcthue * m) / 100)) <= 1,
  );
  if (khop.length !== 1) return null;
  return [{ nhan: `${khop[0]}%`, thtien: tgtcthue, tthue: tgtthue }];
}

/**
 * Gộp DÒNG HÀNG (`detail.hdhhdvu`) thành các nhóm thuế suất — mỗi dòng đã mang nhãn mức của nó.
 *
 * Đây là số THẬT chứ không phải suy, nên dùng trước `nhomTuTongHoaDon`. Cứu đúng ca hóa đơn NHIỀU
 * mức mà cổng bỏ trống khối `thttltsuat` — ví dụ hóa đơn FPT (`K26THT`): tổng 336.364 thuế 31.655
 * (9,41%, không phải mức nào), nhưng hai dòng hàng ghi rõ 8% 99.091 và 10% 237.273.
 *
 * Chỉ nhận khi tổng dòng hàng khớp `tgtcthue` từng đồng: lệch nghĩa là cổng trả thiếu dòng, hoặc có
 * chiết khấu nằm ngoài — gộp lúc đó là hụt tiền mà không biết.
 */
function nhomTuDongHang(detail: unknown, tgtcthue: number): NhomTien[] | null {
  if (!detail || typeof detail !== "object") return null;
  const ds = (detail as Record<string, unknown>).hdhhdvu;
  if (!Array.isArray(ds) || ds.length === 0) return null;

  const theoNhan = new Map<string, NhomTien>();
  for (const it of ds) {
    const o = (it ?? {}) as Record<string, unknown>;
    const nhan = nhanCuaDong(o);
    if (!nhan) return null;
    const cu = theoNhan.get(nhan) ?? { nhan, thtien: 0, tthue: 0 };
    cu.thtien += so(o.thtien);
    cu.tthue += so(o.tthue);
    theoNhan.set(nhan, cu);
  }
  const nhom = [...theoNhan.values()];
  const tong = nhom.reduce((s, n) => s + n.thtien, 0);
  return Math.abs(tong - tgtcthue) <= 1 ? nhom : null;
}

/** Các nhóm thuế suất của một hóa đơn; `null` = không tách được. */
function nhomThueSuat(hd: HoaDonGom): NhomTien[] | null {
  const tgtcthue = so(hd.tgtcthue);
  const detail = hd.detail;
  const ds =
    detail && typeof detail === "object"
      ? (detail as Record<string, unknown>).thttltsuat
      : undefined;
  // Thiếu khối tách thuế suất (hoặc có mà rỗng) -> gộp dòng hàng, không được nữa thì suy từ tổng.
  if (!Array.isArray(ds) || ds.length === 0) {
    return nhomTuDongHang(detail, tgtcthue) ?? nhomTuTongHoaDon(tgtcthue, so(hd.tgtthue));
  }
  const nhom = ds.map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return {
      nhan: nhanCuaDong(o),
      thtien: so(o.thtien),
      tthue: so(o.tthue),
    };
  });
  return vaNhomNhanBan(nhom, tgtcthue);
}

/**
 * Quy đổi một số tiền về VND rồi làm tròn về ĐỒNG, theo TỪNG hóa đơn.
 *
 * Làm tròn ngay tại đây vì mọi ô trên tờ khai là số nguyên, mà `thtien × tỷ giá` thì lẻ — và quy
 * tắc kiểm của HTKK (`[33] = [32] x 10% - phụ lục`) sẽ không bao giờ khớp nếu [32] lẻ đồng.
 * Từng hóa đơn chứ không phải tổng: mỗi hóa đơn là một chứng từ, số VND của nó phải tự đứng được
 * khi đối chiếu. Hóa đơn VND (hệ số 1) không đổi gì vì số đã nguyên sẵn.
 */
function veDong(tien: number, heSo: number): number {
  return lamTronDong(tien * heSo);
}

/** Hệ số quy đổi về VND; `null` = ngoại tệ mà thiếu tỷ giá -> không đoán, cho hóa đơn treo. */
function heSoQuyDoi(hd: HoaDonGom): number | null {
  const dvt = String(hd.dvtte ?? "").trim().toUpperCase();
  if (!dvt || dvt === "VND") return 1;
  const tg = so(hd.tgia);
  return tg > 0 ? tg : null;
}

/**
 * Bước lọc CHUNG cho `gomBanRa`/`gomMuaVao`: loại hóa đơn bị luật cấm kê (`biLoai`), rồi quy đổi
 * ngoại tệ — thiếu tỷ giá thì treo thay vì đoán hệ số.
 */
type KetQuaChuanBi =
  | { loai: "bi_loai"; giaTri: number }
  | { loai: "treo"; lyDo: string }
  | { loai: "ok"; heSo: number };

function chuanBiHoaDon(hd: HoaDonGom): KetQuaChuanBi {
  if (!duocTinh(hd.tthai)) {
    return { loai: "bi_loai", giaTri: veDong(so(hd.tgtcthue), heSoQuyDoi(hd) ?? 1) };
  }
  const heSo = heSoQuyDoi(hd);
  if (heSo === null) {
    return { loai: "treo", lyDo: `Hóa đơn ngoại tệ ${hd.dvtte} nhưng thiếu tỷ giá` };
  }
  return { loai: "ok", heSo };
}

export function gomBanRa(rows: HoaDonGom[]): KetQuaBanRa {
  const tong: TongBanRa = { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };
  const treo: HoaDonTreo[] = [];
  const dieuChinh = { soHd: 0, giaTri: 0, thue: 0 };
  const theoNhan: Record<string, NhomThueSuat> = {};
  const biLoai: HoaDonBiLoai = { soHd: 0, giaTri: 0 };
  let soHd = 0;

  for (const hd of rows) {
    const cb = chuanBiHoaDon(hd);
    if (cb.loai === "bi_loai") {
      biLoai.soHd += 1;
      biLoai.giaTri += cb.giaTri;
      continue;
    }
    if (cb.loai === "treo") {
      treo.push({ id: hd.id, lyDo: cb.lyDo });
      continue;
    }
    const heSo = cb.heSo;

    const nhom = nhomThueSuat(hd);
    if (nhom === null || nhom.length === 0) {
      treo.push({ id: hd.id, lyDo: "Hóa đơn chưa tải chi tiết nên chưa tách được thuế suất" });
      continue;
    }

    const tenTheoNhan = tenHangTheoNhan(hd.detail);
    let coNhanLa = false;
    let giaTriHd = 0;
    let thueHd = 0;
    for (const g of nhom) {
      const o = O_THEO_NHAN[g.nhan];
      if (!o) {
        coNhanLa = true;
        continue;
      }
      const giaTri = veDong(g.thtien, heSo);
      const thue = veDong(g.tthue, heSo);
      tong[o.giaTri] += giaTri;
      if (o.thue) tong[o.thue] += thue;
      // Giữ nguyên theo NHÃN GỐC bên cạnh việc rót vào ô: [32]/[33] gộp 8% với 10%, mà phụ lục
      // giảm thuế cần riêng nhóm 8%.
      congVaoNhan(theoNhan, g.nhan, giaTri, thue, tenTheoNhan.get(g.nhan) ?? []);
      giaTriHd += giaTri;
      thueHd += thue;
    }

    if (coNhanLa) {
      treo.push({ id: hd.id, lyDo: "Có mức thuế suất chưa nhận diện được" });
    }
    soHd += 1;
    if (String(hd.tthai ?? "").trim() === "3") {
      dieuChinh.soHd += 1;
      dieuChinh.giaTri += giaTriHd;
      dieuChinh.thue += thueHd;
    }
  }

  return { tong, treo, biLoai, dieuChinh, theoNhan, soHd };
}

/**
 * Mua vào chỉ cần tổng: [23] giá trị, [24] tiền thuế. Không tách theo thuế suất nên KHÔNG cần
 * `detail` — hóa đơn chưa tải chi tiết vẫn cộng được (khác hẳn `gomBanRa`).
 */
export function gomMuaVao(rows: HoaDonGom[]): KetQuaMuaVao {
  const treo: HoaDonTreo[] = [];
  const theoNhan: Record<string, NhomThueSuat> = {};
  const biLoai: HoaDonBiLoai = { soHd: 0, giaTri: 0 };
  let ct23 = 0;
  let ct24 = 0;
  let soHd = 0;

  for (const hd of rows) {
    const cb = chuanBiHoaDon(hd);
    if (cb.loai === "bi_loai") {
      biLoai.soHd += 1;
      biLoai.giaTri += cb.giaTri;
      continue;
    }
    if (cb.loai === "treo") {
      treo.push({ id: hd.id, lyDo: cb.lyDo });
      continue;
    }
    const heSo = cb.heSo;
    ct23 += veDong(so(hd.tgtcthue), heSo);
    ct24 += veDong(so(hd.tgtthue), heSo);
    soHd += 1;

    // Tách theo nhãn CHỈ để dựng phụ lục giảm thuế — hóa đơn chưa tải chi tiết vẫn tính vào
    // ct23/ct24 ở trên, chỉ không góp mặt ở đây.
    const nhom = nhomThueSuat(hd);
    if (nhom === null) continue;
    const tenTheoNhan = tenHangTheoNhan(hd.detail);
    for (const g of nhom) {
      congVaoNhan(
        theoNhan,
        g.nhan,
        veDong(g.thtien, heSo),
        veDong(g.tthue, heSo),
        tenTheoNhan.get(g.nhan) ?? [],
      );
    }
  }

  return { ct23, ct24, treo, biLoai, theoNhan, soHd };
}

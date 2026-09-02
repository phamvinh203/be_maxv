/**
 * Lọc hóa đơn theo trạng thái rồi gộp tiền theo từng mức thuế suất, ra đúng các ô của mẫu 01/GTGT.
 *
 * Hàm THUẦN: nhận mảng dòng đã đọc sẵn từ `vct50view`/`vct60view`, không đụng DB — nhờ vậy test
 * được không cần Postgres (`src/__tests__/gomHoaDonGtgt.test.ts`).
 *
 * Đầu vào là hóa đơn ĐÃ GÁN KỲ và kế toán để `ke_khai = true`; việc loại hóa đơn "không kê khai"
 * làm ở tầng service, không ở đây.
 *
 * Số tách theo thuế suất chỉ có trong `detail.thttltsuat` — hóa đơn chưa tải chi tiết KHÔNG đoán
 * được là 8% hay 10%, nên xếp vào `treo` thay vì cộng nhầm vào một ô nào đó.
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
  /**
   * Tiền thuế 5% cộng THỰC từ hóa đơn. Tờ khai KHÔNG lấy trực tiếp số này — [31] tính theo công
   * thức HTKK (xem `tinhGtgt01.ts`). Giữ lại để ĐỐI CHIẾU: công thức và bảng kê lệch quá mức làm
   * tròn cho phép nghĩa là bảng kê có vấn đề (nhãn thuế suất sai, hóa đơn ghi thuế sai).
   */
  ct31: number;
  ct32: number;
  ct32a: number;
  /** Tiền thuế 10% + 8% cộng THỰC từ hóa đơn — cùng vai trò đối chiếu như `ct31`. */
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

export interface KetQuaBanRa {
  tong: TongBanRa;
  treo: HoaDonTreo[];
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
  /**
   * Số liệu theo từng nhãn thuế suất. Chỉ có với hóa đơn ĐÃ tải chi tiết; hóa đơn thiếu `detail`
   * vẫn được cộng vào `ct23`/`ct24` (mua vào chỉ cần tổng) nhưng không xuất hiện ở đây — nên tổng
   * các nhãn có thể NHỎ HƠN `ct23`, đừng dùng nó để kiểm tra chéo.
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
 * Chuẩn hóa nhãn thuế suất cổng trả ("10", "10%", " KCT ") về một dạng duy nhất để tra bảng ánh
 * xạ. Mức số ra `"10%"`; mã chữ ra chữ hoa không khoảng trắng thừa.
 */
function chuanHoaNhan(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  const phanTram = Number(s.replace("%", ""));
  return Number.isFinite(phanTram) ? `${phanTram}%` : s;
}

/**
 * Nhãn thuế suất -> ô nhận giá trị và ô nhận tiền thuế. Thêm/đổi mức thuế suất CHỈ sửa bảng này.
 */
const O_THEO_NHAN: Record<string, { giaTri: keyof TongBanRa; thue?: keyof TongBanRa }> = {
  KCT: { giaTri: "ct26" },
  "0%": { giaTri: "ct29" },
  "5%": { giaTri: "ct30", thue: "ct31" },
  // 8% (giảm theo nghị quyết) kê chung dòng 10%. Số thuế cộng ở đây là thuế THỰC trên hóa đơn,
  // nhưng [33] của tờ khai KHÔNG dùng nó: HTKK tính [33] = làm tròn([32] x 10%) trừ phần được
  // giảm ở phụ lục — xem `tinhGtgt01.ts`. Số thực ở đây giữ lại để đối chiếu với bảng kê.
  "8%": { giaTri: "ct32", thue: "ct33" },
  "10%": { giaTri: "ct32", thue: "ct33" },
  KKKNT: { giaTri: "ct32a" },
};

/** Số tên hàng giữ lại mỗi nhãn — phụ lục chỉ cần một câu mô tả, giữ hết là ô dài vô tận. */
const TEN_HANG_TOI_DA = 12;

/**
 * Tên hàng của các dòng thuộc một nhãn thuế suất, đọc từ `detail.hdhhdvu`.
 *
 * Mảng `thttltsuat` chỉ có tiền theo mức thuế, không có tên hàng — tên nằm ở mảng dòng hàng, mỗi
 * dòng mang nhãn thuế suất riêng. Hóa đơn không có mảng dòng hàng (chỉ có tổng) -> không tên nào.
 */
function tenHangTheoNhan(detail: unknown, chuanHoa: (v: unknown) => string): Map<string, string[]> {
  const ra = new Map<string, string[]>();
  if (!detail || typeof detail !== "object") return ra;
  const ds = (detail as Record<string, unknown>).hdhhdvu;
  if (!Array.isArray(ds)) return ra;
  for (const it of ds) {
    const o = (it ?? {}) as Record<string, unknown>;
    const nhan = chuanHoa(o.ltsuat ?? o.tsuat ?? o.thuesuat);
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

/** Các nhóm thuế suất của một hóa đơn; `null` = hóa đơn chưa có chi tiết. */
function nhomThueSuat(detail: unknown): { nhan: string; thtien: number; tthue: number }[] | null {
  if (!detail || typeof detail !== "object") return null;
  const ds = (detail as Record<string, unknown>).thttltsuat;
  if (!Array.isArray(ds)) return null;
  return ds.map((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return {
      nhan: chuanHoaNhan(o.ltsuat ?? o.tsuat ?? o.thuesuat),
      thtien: so(o.thtien),
      tthue: so(o.tthue),
    };
  });
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

export function gomBanRa(rows: HoaDonGom[]): KetQuaBanRa {
  const tong: TongBanRa = { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };
  const treo: HoaDonTreo[] = [];
  const dieuChinh = { soHd: 0, giaTri: 0, thue: 0 };
  const theoNhan: Record<string, NhomThueSuat> = {};
  let soHd = 0;

  for (const hd of rows) {
    if (!duocTinh(hd.tthai)) continue;

    const heSo = heSoQuyDoi(hd);
    if (heSo === null) {
      treo.push({ id: hd.id, lyDo: `Hóa đơn ngoại tệ ${hd.dvtte} nhưng thiếu tỷ giá` });
      continue;
    }

    const nhom = nhomThueSuat(hd.detail);
    if (nhom === null || nhom.length === 0) {
      treo.push({ id: hd.id, lyDo: "Hóa đơn chưa tải chi tiết nên chưa tách được thuế suất" });
      continue;
    }

    const tenTheoNhan = tenHangTheoNhan(hd.detail, chuanHoaNhan);
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

  return { tong, treo, dieuChinh, theoNhan, soHd };
}

/**
 * Mua vào chỉ cần tổng: [23] giá trị, [24] tiền thuế. Không tách theo thuế suất nên KHÔNG cần
 * `detail` — hóa đơn chưa tải chi tiết vẫn cộng được (khác hẳn `gomBanRa`).
 */
export function gomMuaVao(rows: HoaDonGom[]): KetQuaMuaVao {
  const treo: HoaDonTreo[] = [];
  const theoNhan: Record<string, NhomThueSuat> = {};
  let ct23 = 0;
  let ct24 = 0;
  let soHd = 0;

  for (const hd of rows) {
    if (!duocTinh(hd.tthai)) continue;
    const heSo = heSoQuyDoi(hd);
    if (heSo === null) {
      treo.push({ id: hd.id, lyDo: `Hóa đơn ngoại tệ ${hd.dvtte} nhưng thiếu tỷ giá` });
      continue;
    }
    ct23 += veDong(so(hd.tgtcthue), heSo);
    ct24 += veDong(so(hd.tgtthue), heSo);
    soHd += 1;

    // Tách theo nhãn CHỈ để dựng phụ lục giảm thuế — hóa đơn chưa tải chi tiết vẫn tính vào
    // ct23/ct24 ở trên, chỉ không góp mặt ở đây.
    const nhom = nhomThueSuat(hd.detail);
    if (nhom === null) continue;
    const tenTheoNhan = tenHangTheoNhan(hd.detail, chuanHoaNhan);
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

  return { ct23, ct24, treo, theoNhan, soHd };
}

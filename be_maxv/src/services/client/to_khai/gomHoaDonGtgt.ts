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
  ct31: number;
  ct32: number;
  ct32a: number;
  ct33: number;
}

export interface HoaDonTreo {
  id: string;
  lyDo: string;
}

export interface KetQuaBanRa {
  tong: TongBanRa;
  treo: HoaDonTreo[];
  /** Nhóm `tthai=3` — ĐÃ cộng vào `tong`, tách ra đây chỉ để hiển thị và soát dấu. */
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  soHd: number;
}

export interface KetQuaMuaVao {
  ct23: number;
  ct24: number;
  treo: HoaDonTreo[];
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
 *
 * Export vì tầng service suy ánh xạ NGƯỢC (chỉ tiêu -> các nhãn rót vào nó) từ chính bảng này —
 * hai chiều dùng chung một nguồn thì không bao giờ lệch nhau.
 */
export const O_THEO_NHAN: Record<string, { giaTri: keyof TongBanRa; thue?: keyof TongBanRa }> = {
  KCT: { giaTri: "ct26" },
  "0%": { giaTri: "ct29" },
  "5%": { giaTri: "ct30", thue: "ct31" },
  // 8% (giảm theo nghị quyết) kê chung dòng 10%; [33] lấy số thuế THỰC TẾ, không nhân lại 10%.
  "8%": { giaTri: "ct32", thue: "ct33" },
  "10%": { giaTri: "ct32", thue: "ct33" },
  KKKNT: { giaTri: "ct32a" },
};

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

    let coNhanLa = false;
    let giaTriHd = 0;
    let thueHd = 0;
    for (const g of nhom) {
      const o = O_THEO_NHAN[g.nhan];
      if (!o) {
        coNhanLa = true;
        continue;
      }
      const giaTri = g.thtien * heSo;
      const thue = g.tthue * heSo;
      tong[o.giaTri] += giaTri;
      if (o.thue) tong[o.thue] += thue;
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

  return { tong, treo, dieuChinh, soHd };
}

/**
 * Mua vào chỉ cần tổng: [23] giá trị, [24] tiền thuế. Không tách theo thuế suất nên KHÔNG cần
 * `detail` — hóa đơn chưa tải chi tiết vẫn cộng được (khác hẳn `gomBanRa`).
 */
export function gomMuaVao(rows: HoaDonGom[]): KetQuaMuaVao {
  const treo: HoaDonTreo[] = [];
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
    ct23 += so(hd.tgtcthue) * heSo;
    ct24 += so(hd.tgtthue) * heSo;
    soHd += 1;
  }

  return { ct23, ct24, treo, soHd };
}

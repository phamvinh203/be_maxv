import {
  CT_DEM_NGUOI,
  CT_GOC_SUA_DUOC,
  CT_TAGS,
  CT_TONG_HOP,
  type ChiTieuTncn05,
  type CtTag,
} from '../../../../constants/hrm/to_khai_thue/chiTieuTncn05';
import { ToKhaiThueError } from '../../../../helpers/hrm/toKhaiThueErrors';

/**
 * TỜ KHAI 05/KK-TNCN — phần tính THUẦN (data-model Mục 8, BR-tkt-018). Truy vấn/giao dịch nằm ở
 * `taxDeclaration.service.ts`, dựng file ở `taxDeclarationFile.ts`.
 *
 * Nguồn là `hrm_tax_calculation_lines` của 3 tháng ĐÃ CHỐT — tức số đã đóng băng (ADR-013), nên tờ
 * khai tính lại bao nhiêu lần cũng ra một kết quả. Đơn vị gộp là NGƯỜI (`recipientKey`): người có mặt
 * nhiều tháng chỉ ĐẾM một lần ở chỉ tiêu đếm người, nhưng CỘNG DỒN ở chỉ tiêu tiền.
 */

/** Cột tiền của một dòng Bảng tính thuế tháng — bảng chi tiết nhân viên cộng dồn đúng các cột này. */
export const COT_TIEN_BANG_THUE = [
  'thu_nhap_luong',
  'thu_nhap_ngoai',
  'thu_nhap_khau_tru_rieng',
  'tong_thu_nhap',
  'thu_nhap_mien_thue',
  'thu_nhap_chiu_thue',
  'giam_tru_ban_than',
  'giam_tru_phu_thuoc',
  'giam_tru_bao_hiem',
  'tong_giam_tru',
  'thu_nhap_tinh_thue',
  'thue_luy_tien',
  'thue_toan_phan',
  'tong_thue_tncn',
] as const;
export type CotTienBangThue = (typeof COT_TIEN_BANG_THUE)[number];

/** Một dòng snapshot tháng đã chuẩn hóa về `number`, kèm tháng của kỳ. */
export interface DongThueQuy extends Record<CotTienBangThue, number> {
  thang: number;
  recipientKey: string;
  ma_nv: string | null;
  ho_ten: string;
  mst_ca_nhan: string | null;
  so_cccd: string | null;
  loai_lao_dong: string;
  cu_tru: boolean;
}

export type GhiDeChiTieu = Partial<
  Record<CtTag, { gia: number; lyDo: string }>
>;

/** Lý do ghi đè tối thiểu (AC-tkt-026). */
const LY_DO_TOI_THIEU = 10;

export function cacThangCuaQuy(quy: number): [number, number, number] {
  const dau = 3 * (quy - 1) + 1;
  return [dau, dau + 1, dau + 2];
}

function ctRong(): ChiTieuTncn05 {
  return Object.fromEntries(CT_TAGS.map((t) => [t, 0])) as ChiTieuTncn05;
}

/** 4 chỉ tiêu tổng hợp LUÔN suy lại từ chỉ tiêu con (BR-tkt-018) — không có nhánh nào giữ số cũ. */
function tinhLaiTongHop(ct: ChiTieuTncn05): ChiTieuTncn05 {
  for (const [tong, con] of Object.entries(CT_TONG_HOP) as Array<
    [CtTag, readonly CtTag[]]
  >) {
    ct[tong] = con.reduce((s, t) => s + ct[t], 0);
  }
  return ct;
}

interface NguoiTrongQuy {
  cuTru: boolean;
  coHdld3Thang: boolean;
  tnct: number;
  thue: number;
}

/** Số máy tự tính — bảng ánh xạ data-model Mục 8. */
export function tinhChiTieuMay(dong: DongThueQuy[]): ChiTieuTncn05 {
  const theoNguoi = new Map<string, NguoiTrongQuy>();
  for (const d of dong) {
    const coHdld = d.loai_lao_dong === 'HOP_DONG_3_THANG_TRO_LEN';
    const n = theoNguoi.get(d.recipientKey);
    if (n) {
      // Cư trú phải đúng ở MỌI tháng có mặt — cùng luật "mọi khoản đều cư trú" của dòng tháng.
      n.cuTru = n.cuTru && d.cu_tru;
      n.coHdld3Thang = n.coHdld3Thang || coHdld;
      n.tnct += d.thu_nhap_chiu_thue;
      n.thue += d.tong_thue_tncn;
    } else {
      theoNguoi.set(d.recipientKey, {
        cuTru: d.cu_tru,
        coHdld3Thang: coHdld,
        tnct: d.thu_nhap_chiu_thue,
        thue: d.tong_thue_tncn,
      });
    }
  }

  const ds = [...theoNguoi.values()];
  const dem = (dk: (n: NguoiTrongQuy) => boolean) => ds.filter(dk).length;
  const cong = (
    dk: (n: NguoiTrongQuy) => boolean,
    lay: (n: NguoiTrongQuy) => number,
  ) => ds.filter(dk).reduce((s, n) => s + lay(n), 0);

  const ct = ctRong();
  ct.ct16 = ds.length;
  ct.ct17 = dem((n) => n.cuTru && n.coHdld3Thang);
  ct.ct19 = dem((n) => n.cuTru && n.thue > 0);
  ct.ct20 = dem((n) => !n.cuTru && n.thue > 0);
  ct.ct22 = cong(
    (n) => n.cuTru,
    (n) => n.tnct,
  );
  ct.ct23 = cong(
    (n) => !n.cuTru,
    (n) => n.tnct,
  );
  ct.ct27 = cong(
    (n) => n.cuTru && n.thue > 0,
    (n) => n.tnct,
  );
  ct.ct28 = cong(
    (n) => !n.cuTru && n.thue > 0,
    (n) => n.tnct,
  );
  ct.ct30 = cong(
    (n) => n.cuTru,
    (n) => n.thue,
  );
  ct.ct31 = cong(
    (n) => !n.cuTru,
    (n) => n.thue,
  );
  // [24] [25] [32] = 0: chưa có nguồn dữ liệu (phí bảo hiểm nhân thọ của DN bảo hiểm nước ngoài, thu
  // nhập miễn theo hợp đồng dầu khí). [32] chủ dự án chốt 2026-09-15 — kế toán ghi đè nếu có (OQ-tkt-05).
  return tinhLaiTongHop(ct);
}

/** Bộ CUỐI = số máy + ghi đè ở chỉ tiêu gốc, rồi suy lại chỉ tiêu tổng hợp. */
export function hopNhatGhiDe(
  ctMay: ChiTieuTncn05,
  ghiDe: GhiDeChiTieu,
): ChiTieuTncn05 {
  const ct = { ...ctMay };
  for (const tag of CT_GOC_SUA_DUOC) {
    const o = ghiDe[tag];
    if (o) ct[tag] = o.gia;
  }
  return tinhLaiTongHop(ct);
}

/**
 * Kiểm tra chéo — giữ nguyên bộ luật của mã nháp (`toKhaiTncn05.service.ts:51-99`, data-model Mục 8).
 * Chỉ CẢNH BÁO, không chặn: sau khi ghi đè hợp lệ, một bất đẳng thức vẫn có thể lệch tạm.
 */
export function kiemTraCanDoi(ct: ChiTieuTncn05): string[] {
  const canhBao: string[] = [];
  if (ct.ct17 > ct.ct16) {
    canhBao.push(
      'Chỉ tiêu [17] (Cá nhân cư trú có HĐLĐ) không được lớn hơn [16] (Tổng số người lao động).',
    );
  }
  if (ct.ct18 !== ct.ct19 + ct.ct20) {
    canhBao.push(
      `Chỉ tiêu [18] (${ct.ct18}) không khớp công thức [19] + [20] (${ct.ct19 + ct.ct20}).`,
    );
  }
  if (ct.ct18 > ct.ct16) {
    canhBao.push(
      'Chỉ tiêu [18] (Số cá nhân đã khấu trừ thuế) không được lớn hơn [16] (Tổng số lao động).',
    );
  }
  if (ct.ct21 !== ct.ct22 + ct.ct23) {
    canhBao.push(
      `Chỉ tiêu [21] (${ct.ct21}) không khớp công thức [22] + [23] (${ct.ct22 + ct.ct23}).`,
    );
  }
  if (ct.ct26 !== ct.ct27 + ct.ct28) {
    canhBao.push(
      `Chỉ tiêu [26] (${ct.ct26}) không khớp công thức [27] + [28] (${ct.ct27 + ct.ct28}).`,
    );
  }
  if (ct.ct26 > ct.ct21) {
    canhBao.push(
      'Chỉ tiêu [26] (TNCT diện khấu trừ thuế) không được lớn hơn [21] (Tổng TNCT).',
    );
  }
  if (ct.ct27 > ct.ct22) {
    canhBao.push(
      'Chỉ tiêu [27] (TNCT cá nhân cư trú diện khấu trừ) không được lớn hơn [22] (TNCT cá nhân cư trú).',
    );
  }
  if (ct.ct28 > ct.ct23) {
    canhBao.push(
      'Chỉ tiêu [28] (TNCT không cư trú diện khấu trừ) không được lớn hơn [23] (TNCT không cư trú).',
    );
  }
  if (ct.ct29 !== ct.ct30 + ct.ct31) {
    canhBao.push(
      `Chỉ tiêu [29] (${ct.ct29}) không khớp công thức [30] + [31] (${ct.ct30 + ct.ct31}).`,
    );
  }
  if (ct.ct32 > ct.ct30) {
    canhBao.push(
      'Chỉ tiêu [32] (Thuế khấu trừ trên phí bảo hiểm nhân thọ nước ngoài) không được lớn hơn [30] (Thuế của cá nhân cư trú).',
    );
  }
  return canhBao;
}

/**
 * Kiểm và chuẩn hóa ghi đè gửi lên (api-contract Mục 5.3). Mã lỗi phụ thuộc TỪNG vi phạm (011 vs 012)
 * nên không dựng được bằng một schema Zod duy nhất.
 */
export function chuanHoaGhiDe(
  overrides: Record<string, { gia: number; lyDo?: string }>,
): GhiDeChiTieu {
  const kq: GhiDeChiTieu = {};
  for (const [ma, o] of Object.entries(overrides)) {
    const so = ma.replace(/^ct/, '');
    // Ô tổng hợp bị cấm TRƯỚC khi xét lý do: kèm lý do hay không thì ô đó cũng không bao giờ ghi đè được.
    if (ma in CT_TONG_HOP) throw new ToKhaiThueError('E-tkt-012');
    if (!(CT_GOC_SUA_DUOC as readonly string[]).includes(ma)) {
      throw new ToKhaiThueError(
        'E-tkt-012',
        `"${ma}" không phải chỉ tiêu gốc sửa được của tờ khai 05/KK-TNCN.`,
      );
    }
    const lyDo = o.lyDo?.trim() ?? '';
    if (lyDo.length < LY_DO_TOI_THIEU) throw new ToKhaiThueError('E-tkt-011');
    if (!Number.isFinite(o.gia) || o.gia < 0) {
      throw new ToKhaiThueError(
        'E-tkt-012',
        `Giá trị ghi đè của chỉ tiêu [${so}] phải là số không âm.`,
      );
    }
    const demNguoi = (CT_DEM_NGUOI as readonly string[]).includes(ma);
    if (demNguoi && !Number.isInteger(o.gia)) {
      throw new ToKhaiThueError(
        'E-tkt-012',
        `Chỉ tiêu [${so}] đếm số người nên phải là số nguyên.`,
      );
    }
    // Tiền làm tròn tới đồng — cùng quy ước với mọi phép tính khác của sub-cụm (api-contract Mục 0.3).
    kq[ma as CtTag] = { gia: demNguoi ? o.gia : Math.round(o.gia), lyDo };
  }
  return kq;
}

/** Một dòng bảng chi tiết theo nhân viên nội bộ (FR-tkt-015). */
export interface DongChiTietNhanVien extends Record<CotTienBangThue, number> {
  ma_nv: string;
  ho_ten: string;
  mst_ca_nhan: string | null;
  so_cccd: string | null;
  loai_lao_dong: string;
  cu_tru: boolean;
  cacThang: number[];
}

/** Gộp 3 tháng theo nhân viên NỘI BỘ; định danh + loại lao động lấy theo tháng MỚI NHẤT của quý. */
export function gopChiTietNhanVien(dong: DongThueQuy[]): DongChiTietNhanVien[] {
  const theoNv = new Map<string, DongChiTietNhanVien>();
  for (const d of [...dong].sort((a, b) => a.thang - b.thang)) {
    if (!d.ma_nv) continue;
    let g = theoNv.get(d.ma_nv);
    if (!g) {
      g = {
        ma_nv: d.ma_nv,
        ho_ten: d.ho_ten,
        mst_ca_nhan: null,
        so_cccd: null,
        loai_lao_dong: d.loai_lao_dong,
        cu_tru: d.cu_tru,
        cacThang: [],
        ...(Object.fromEntries(COT_TIEN_BANG_THUE.map((c) => [c, 0])) as Record<
          CotTienBangThue,
          number
        >),
      };
      theoNv.set(d.ma_nv, g);
    }
    g.ho_ten = d.ho_ten;
    g.mst_ca_nhan = d.mst_ca_nhan ?? g.mst_ca_nhan;
    g.so_cccd = d.so_cccd ?? g.so_cccd;
    g.loai_lao_dong = d.loai_lao_dong;
    g.cu_tru = d.cu_tru;
    g.cacThang.push(d.thang);
    for (const c of COT_TIEN_BANG_THUE) g[c] += d[c];
  }
  return [...theoNv.values()].sort((a, b) =>
    a.ma_nv < b.ma_nv ? -1 : a.ma_nv > b.ma_nv ? 1 : 0,
  );
}

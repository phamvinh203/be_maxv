import type { DongBangTinhThueDto } from "../../../types/toKhaiThue";
import { tienVn } from "../../../_shared/format";
import {
  NHAN_LOAI_LAO_DONG,
  NHAN_PHUONG_PHAP_TINH,
  nhanDienThue,
  nhanKieuLuong,
  nhanLoaiHopDong,
} from "../nhan";

/**
 * MỘT danh sách cột lá duy nhất cho cả màn hình lẫn file Excel — header hai tầng, thân bảng, dòng
 * tổng và các cột Excel đều sinh ra từ đây.
 *
 * Trước đây màn hình khai cột một nơi, Excel khai lại lần nữa cho header, lần nữa cho dòng dữ liệu
 * và lần nữa cho dòng tổng: bốn danh sách phải tự khớp nhau bằng niềm tin, thêm một cột vào giữa là
 * file Excel lệch cột mà không có gì báo. Giữ ở đây thì thêm/bớt cột chỉ sửa một chỗ.
 *
 * `nhom` là tên cột cha; các cột cùng `nhom` PHẢI nằm liền nhau trong mảng — header gom theo chuỗi
 * liên tiếp, xen kẽ sẽ vỡ thành hai cột cha trùng tên.
 *
 * Số trong ngoặc vuông là số hiệu cột kế toán dùng khi đối chiếu, giữ nguyên trong nhãn.
 */
export type CotBang = {
  khoa: string;
  nhan: string;
  nhom?: string;
  /** `trong` = đã dựng cột nhưng chưa có nguồn số (đợt 2), hiện dấu gạch chứ KHÔNG hiện 0. */
  kieu: "stt" | "chu" | "tien" | "trong";
  lay?: (d: DongBangTinhThueDto) => number;
  chu?: (d: DongBangTinhThueDto) => string;
  /** Chú thích hiện khi rê chuột — chỉ khi trả về chuỗi khác rỗng. */
  ghiChu?: (d: DongBangTinhThueDto) => string;
  /** Bề rộng cột trong file Excel (đơn vị ký tự của exceljs). */
  rong: number;
};

export const NHOM_KHAU_TRU = "Khấu trừ, giảm trừ";
export const NHOM_NET = "Quy đổi NET";

export const COT: CotBang[] = [
  { khoa: "stt", nhan: "STT", kieu: "stt", rong: 6 },
  { khoa: "ma_nv", nhan: "Mã NV", kieu: "chu", chu: (d) => d.ma_nv ?? "Vãng lai", rong: 12 },
  {
    khoa: "ho_ten",
    nhan: "Họ và tên",
    kieu: "chu",
    chu: (d) => d.ho_ten,
    // Loại lao động và tình trạng cư trú không còn cột riêng nhưng vẫn là hai thứ quyết định cách
    // tính thuế của dòng — giữ chúng ở chú thích thay vì bỏ hẳn.
    ghiChu: (d) =>
      `${NHAN_LOAI_LAO_DONG[d.loai_lao_dong]}${d.cu_tru ? "" : " · không cư trú"} · ${d.so_nguoi_phu_thuoc} người phụ thuộc`,
    rong: 26,
  },
  { khoa: "mst", nhan: "MST", kieu: "chu", chu: (d) => d.mst_ca_nhan ?? "—", rong: 16 },
  { khoa: "so_hd", nhan: "Số HĐ", kieu: "chu", chu: (d) => d.so_hop_dong ?? "—", rong: 16 },
  { khoa: "bo_phan", nhan: "Bộ phận", kieu: "chu", chu: (d) => d.bo_phan ?? "—", rong: 20 },
  { khoa: "chuc_vu", nhan: "Chức vụ", kieu: "chu", chu: (d) => d.chuc_vu ?? "—", rong: 20 },

  {
    khoa: "loai_hd",
    nhom: "Hợp đồng",
    nhan: "Loại HĐ",
    kieu: "chu",
    chu: (d) => nhanLoaiHopDong(d.loai_hop_dong),
    rong: 20,
  },
  {
    khoa: "kieu_luong",
    nhom: "Hợp đồng",
    nhan: "Kiểu lương",
    kieu: "chu",
    chu: (d) => nhanKieuLuong(d.kieu_luong),
    rong: 12,
  },

  {
    khoa: "dien_thue",
    nhan: "Diện thuế",
    kieu: "chu",
    chu: (d) => nhanDienThue(d.phuong_phap_tinh, d.kieu_luong),
    ghiChu: (d) => NHAN_PHUONG_PHAP_TINH[d.phuong_phap_tinh],
    rong: 16,
  },

  {
    khoa: "tn_bl",
    nhom: "Thu nhập",
    nhan: "Theo BL [1]",
    kieu: "tien",
    lay: (d) => d.thu_nhap_luong,
    rong: 16,
  },
  {
    khoa: "tn_ngoai",
    nhom: "Thu nhập",
    nhan: "Ngoài BL [2]",
    kieu: "tien",
    lay: (d) => d.thu_nhap_ngoai,
    rong: 16,
  },
  {
    khoa: "tn_tong",
    nhom: "Thu nhập",
    nhan: "Tổng [3]",
    kieu: "tien",
    lay: (d) => d.tong_thu_nhap,
    rong: 16,
  },

  { khoa: "khong_tinh_thue", nhan: "Không tính thuế [4]", kieu: "trong", rong: 18 },
  {
    khoa: "mien_thue",
    nhan: "Miễn thuế [5]",
    kieu: "tien",
    lay: (d) => d.thu_nhap_mien_thue,
    rong: 16,
  },
  {
    khoa: "chiu_thue",
    nhan: "Chịu thuế [6]",
    kieu: "tien",
    lay: (d) => d.thu_nhap_chiu_thue,
    rong: 16,
  },

  {
    khoa: "bhxh",
    nhom: NHOM_KHAU_TRU,
    nhan: "BHXH [7]",
    kieu: "tien",
    lay: (d) => d.giam_tru_bao_hiem,
    rong: 14,
  },
  {
    khoa: "ban_than",
    nhom: NHOM_KHAU_TRU,
    nhan: "Bản thân [8]",
    kieu: "tien",
    lay: (d) => d.giam_tru_ban_than,
    rong: 14,
  },
  {
    khoa: "gia_canh",
    nhom: NHOM_KHAU_TRU,
    nhan: "Gia cảnh [9]",
    kieu: "tien",
    lay: (d) => d.giam_tru_phu_thuoc,
    rong: 14,
  },
  // [10]–[12]: chưa chốt nguồn dữ liệu nên luôn bằng 0 — để 0 (không phải gạch) vì chúng vẫn là số
  // hạng thật của [13]; hiện gạch thì dòng tổng khấu trừ trông như cộng thiếu.
  { khoa: "y_te", nhom: NHOM_KHAU_TRU, nhan: "Y tế [10]", kieu: "tien", lay: () => 0, rong: 12 },
  {
    khoa: "giao_duc",
    nhom: NHOM_KHAU_TRU,
    nhan: "Giáo dục [11]",
    kieu: "tien",
    lay: () => 0,
    rong: 12,
  },
  { khoa: "khac", nhom: NHOM_KHAU_TRU, nhan: "Khác [12]", kieu: "tien", lay: () => 0, rong: 12 },
  {
    khoa: "tong_khau_tru",
    nhom: NHOM_KHAU_TRU,
    nhan: "Tổng khấu trừ [13]",
    kieu: "tien",
    lay: (d) => d.tong_giam_tru,
    rong: 18,
  },

  { khoa: "can_cu_quy_doi", nhom: NHOM_NET, nhan: "Căn cứ quy đổi [14]", kieu: "trong", rong: 18 },
  {
    khoa: "tinh_thue_quy_doi",
    nhom: NHOM_NET,
    nhan: "Tính thuế (quy đổi) [15]",
    kieu: "trong",
    rong: 20,
  },
  { khoa: "gross_quy_doi", nhom: NHOM_NET, nhan: "GROSS quy đổi [16]", kieu: "trong", rong: 18 },

  {
    khoa: "tinh_thue",
    nhom: "Thuế TNCN",
    nhan: "Tính thuế [17]",
    kieu: "tien",
    lay: (d) => d.thu_nhap_tinh_thue,
    // Cột "Khấu trừ riêng" không còn chỗ trong bố cục mới, nhưng nó vẫn nằm trong công thức:
    // [17] = [6] − khấu trừ riêng − [13]. Không nói ra thì dòng vãng lai/thời vụ trông như cộng sai.
    ghiChu: (d) =>
      d.thu_nhap_khau_tru_rieng > 0
        ? `Đã trừ ${tienVn(d.thu_nhap_khau_tru_rieng)}đ thu nhập khấu trừ tại nguồn (không vào nền lũy tiến).`
        : "",
    rong: 16,
  },
  {
    khoa: "tong_thue",
    nhom: "Thuế TNCN",
    nhan: "Tổng thuế TNCN [18]",
    kieu: "tien",
    lay: (d) => d.tong_thue_tncn,
    rong: 18,
  },
];

/** Gom cột lá thành các cột cha liên tiếp để dựng dòng header thứ nhất. */
function nhomHeader(cot: CotBang[]): Array<{ nhom?: string; cot: CotBang[] }> {
  const ra: Array<{ nhom?: string; cot: CotBang[] }> = [];
  for (const c of cot) {
    const cuoi = ra[ra.length - 1];
    if (c.nhom && cuoi?.nhom === c.nhom) cuoi.cot.push(c);
    else ra.push({ nhom: c.nhom, cot: [c] });
  }
  return ra;
}

export const HEADER_TREN = nhomHeader(COT);
export const COT_CON = COT.filter((c) => c.nhom);

/**
 * Cột đứng CUỐI mỗi nhóm — chỗ vẽ vạch đậm. Không có vạch này thì bảy cột con của "Khấu trừ, giảm
 * trừ" và ba cột của "Quy đổi NET" dính liền nhau thành một dải số không biết đâu là đâu.
 * Cột đơn (không nhóm) cũng tính là cuối nhóm của chính nó.
 */
export const CUOI_NHOM = new Set(HEADER_TREN.map((g) => g.cot[g.cot.length - 1].khoa));

/** Giá trị thô của một ô — dùng cho Excel (số ra số để còn cộng được trong file), không cho màn hình. */
export function oExcel(c: CotBang, d: DongBangTinhThueDto, i: number): string | number {
  if (c.kieu === "stt") return i + 1;
  if (c.kieu === "trong") return "";
  if (c.kieu === "tien" && c.lay) return c.lay(d);
  return c.chu?.(d) ?? "";
}

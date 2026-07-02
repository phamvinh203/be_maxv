/** 1 dòng hàng hóa (danh sách + chi tiết). Decimal từ BE có thể là string. */
export interface HangHoa {
  ma_vt: string;
  ten_vt: string;
  ten_vt2: string | null;
  dvt: string;
  dvt2: string | null;
  he_so2: string | number;
  nhieu_dvt: boolean;
  loai_vt: string | null;
  gia_ton: number;
  nh_vt1: string | null;
  nh_vt2: string | null;
  nh_vt3: string | null;
  ma_kho: string | null;
  ma_vi_tri: string | null;
  ma_thue: string | null;
  ma_thue_nk: string | null;
  tk_vt: string | null;
  tk_gv: string | null;
  tk_dt: string | null;
  tk_dtnb: string | null;
  tk_tl: string | null;
  tk_cpbh: string | null;
  tk_spdd: string | null;
  tk_cl_vt: string | null;
  ghi_chu: string | null;
  status: string;
  // Các cột chỉ có ở chi tiết (GET 1), danh sách không trả -> optional.
  tk_dl?: string | null;
  tk_ck?: string | null;
  vt_ton_kho?: boolean;
  lo_yn?: boolean;
  kk_yn?: boolean;
  kieu_lo?: number;
  cach_xuat?: number;
  so_ngay_sp?: number;
  so_ngay_bh?: number;
  tao_lo?: boolean;
  sl_min?: string | number;
  sl_max?: string | number;
  volume?: string | number;
  dvtvolume?: string | null;
  weight?: string | number;
  dvtweight?: string | null;
}

/** Payload gửi lên khi tạo/sửa (ô trống -> BE tự chuyển null). */
export interface HangHoaForm {
  ma_vt: string;
  ten_vt: string;
  ten_vt2: string;
  dvt: string;
  dvt2: string;
  he_so2: number;
  nhieu_dvt: boolean;
  vt_ton_kho: boolean;
  lo_yn: boolean;
  kk_yn: boolean;
  gia_ton: number;
  loai_vt: string;
  nh_vt1: string;
  nh_vt2: string;
  nh_vt3: string;
  ma_kho: string;
  ma_vi_tri: string;
  ma_thue: string;
  ma_thue_nk: string;
  // Tài khoản
  tk_vt: string;
  tk_gv: string;
  tk_dt: string;
  tk_dtnb: string;
  tk_tl: string;
  tk_dl: string;
  tk_spdd: string;
  tk_cl_vt: string;
  tk_ck: string;
  tk_cpbh: string;
  // Lô
  kieu_lo: number;
  cach_xuat: number;
  so_ngay_sp: number;
  so_ngay_bh: number;
  tao_lo: boolean;
  // Khác
  sl_min: number;
  sl_max: number;
  volume: number;
  dvtvolume: string;
  weight: number;
  dvtweight: string;
  ghi_chu: string;
  status: string;
}

export interface HangHoaListResult {
  data: HangHoa[];
  total: number;
  page: number;
  limit: number;
}

export interface HangHoaListParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/** Option cho các <Select> trong form. */
export interface Lookup {
  value: string;
  label: string;
}

/** Dữ liệu thô 1 đơn vị tính (để auto-điền ĐVT 2 theo ĐVT đã chọn). */
export interface DvtRaw {
  dvt: string;
  dvt2: string | null;
}

export interface Lookups {
  dvtList: Lookup[];
  /** Bản ghi đvt gốc (kèm dvt2) — dùng để auto-fill ĐVT 2. */
  dvtRaw: DvtRaw[];
  loaiList: Lookup[];
  khoList: Lookup[];
  thueList: Lookup[];
  thuenkList: Lookup[];
  nh1List: Lookup[];
  nh2List: Lookup[];
  nh3List: Lookup[];
}

/** Phương pháp tính giá tồn (gia_ton) — khớp maxv_v1. */
export const GIA_TON: Record<number, string> = {
  1: 'Giá trung bình',
  2: 'Đích danh',
  3: 'Nhập trước xuất trước',
  4: 'TB di động',
};

export const GIA_TON_OPTIONS: Lookup[] = Object.entries(GIA_TON).map(
  ([value, label]) => ({ value, label }),
);

/** Cột lưới danh sách (khớp maxv_v1 COLS). */
export interface GridCol {
  key: keyof HangHoa;
  label: string;
  w: number;
  align?: 'left' | 'center' | 'right';
}

export const COLS: GridCol[] = [
  { key: 'ma_vt', label: 'Mã hàng', w: 100 },
  { key: 'ten_vt', label: 'Tên mặt hàng', w: 240 },
  { key: 'dvt', label: 'Đvt', w: 55, align: 'center' },
  { key: 'dvt2', label: 'Đvt 2', w: 65, align: 'center' },
  { key: 'he_so2', label: 'Hệ số', w: 65, align: 'right' },
  { key: 'loai_vt', label: 'Loại', w: 60 },
  { key: 'gia_ton', label: 'PP tính giá', w: 150 },
  { key: 'tk_vt', label: 'Tk kho', w: 85 },
  { key: 'tk_dt', label: 'Tk dt', w: 85 },
  { key: 'tk_dtnb', label: 'Tk dtnb', w: 85 },
  { key: 'tk_tl', label: 'Tk h.bán trả lại', w: 110 },
  { key: 'tk_gv', label: 'Tk gv', w: 85 },
  { key: 'tk_cpbh', label: 'Tk chi phí KM', w: 100 },
  { key: 'tk_spdd', label: 'Tk sp dở dang', w: 105 },
  { key: 'tk_cl_vt', label: 'Tk CL giá vốn', w: 105 },
  { key: 'nh_vt1', label: 'Nhóm 1', w: 70 },
  { key: 'nh_vt2', label: 'Nhóm 2', w: 70 },
  { key: 'nh_vt3', label: 'Nhóm 3', w: 70 },
];

export const EMPTY_FORM: HangHoaForm = {
  ma_vt: '',
  ten_vt: '',
  ten_vt2: '',
  dvt: '',
  dvt2: '',
  he_so2: 1,
  nhieu_dvt: false,
  vt_ton_kho: true,
  lo_yn: false,
  kk_yn: false,
  gia_ton: 1,
  loai_vt: '',
  nh_vt1: '',
  nh_vt2: '',
  nh_vt3: '',
  ma_kho: '',
  ma_vi_tri: '',
  ma_thue: '',
  ma_thue_nk: '',
  tk_vt: '',
  tk_gv: '',
  tk_dt: '',
  tk_dtnb: '',
  tk_tl: '',
  tk_dl: '',
  tk_spdd: '',
  tk_cl_vt: '',
  tk_ck: '',
  tk_cpbh: '',
  kieu_lo: 1,
  cach_xuat: 1,
  so_ngay_sp: 0,
  so_ngay_bh: 0,
  tao_lo: false,
  sl_min: 0,
  sl_max: 0,
  volume: 0,
  dvtvolume: '',
  weight: 0,
  dvtweight: '',
  ghi_chu: '',
  status: '1',
};

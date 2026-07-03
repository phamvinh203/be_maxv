/** 1 hóa đơn bán hàng ở danh sách (m81 + ten_kh). Số tiền/ngày là chuỗi từ API. */
export interface HoaDon {
  stt_rec: string;
  ma_dvcs: string | null;
  ngay_ct: string | null;
  ngay_lct: string | null;
  so_ct: string;
  so_seri: string | null;
  ma_kh: string;
  ten_kh: string;
  ma_kh2: string | null;
  ong_ba: string | null;
  dien_giai: string | null;
  tk: string | null;
  ma_nt: string;
  ty_gia: string | number;
  ma_gd: string | null;
  loai_ct: string | null;
  ma_nvbh: string | null;
  ma_tt: string | null;
  ma_ht_tt: string | null;
  tk_thue_no: string | null;
  tk_thue_co: string | null;
  status: string;
  user_id0: string | null;
  t_so_luong: string | number;
  t_tien_nt2: string | number;
  t_ck_nt: string | number;
  t_thue_nt: string | number;
  t_tt_nt: string | number;
  t_tt: string | number;
}

/** 1 dòng chi tiết trả từ API chi-tiet (d81 + ten_vt). */
export interface HoaDonChiTiet {
  stt_rec0: string;
  ma_vt: string;
  ten_vt: string;
  dvt2: string | null;
  dvt: string | null;
  so_luong2: string | number;
  so_luong2_nl: string | number;
  so_luong_giao: string | number;
  so_luong_hh: string | number;
  ty_le_hh: string | number;
  so_luong: string | number;
  gia_nt2: string | number;
  tien_nt2: string | number;
  gia_khay_nt: string | number;
  tien_khay_nt: string | number;
  tien_no_nt: string | number;
  tl_ck: string | number;
  ck_nt: string | number;
  ma_thue: string | null;
  thue_suat: string | number;
  thue_nt: string | number;
  ma_du_an: string | null;
  ma_pb: string | null;
  ma_kho: string | null;
  tk_dt: string | null;
  tk_ck: string | null;
  tk_gv: string | null;
  tk_thue: string | null;
  tk_vt: string | null;
}

/** 1 dòng trong form (số là number để nhập/tính). */
export interface LineForm {
  ma_vt: string;
  ten_vt: string;
  dvt2: string;
  dvt: string;
  so_luong2: number;
  so_luong2_nl: number;
  so_luong_giao: number;
  so_luong_hh: number;
  ty_le_hh: number;
  so_luong: number;
  gia_nt2: number;
  tien_nt2: number;
  gia_khay_nt: number;
  tien_khay_nt: number;
  tien_no_nt: number;
  tl_ck: number;
  ck_nt: number;
  ma_thue: string;
  thue_suat: number;
  thue_nt: number;
  ma_du_an: string;
  ma_pb: string;
  ma_kho: string;
  tk_dt: string;
  tk_ck: string;
  tk_gv: string;
  tk_thue: string;
  tk_vt: string;
}

/** Header + các dòng khi tạo/sửa. */
export interface HoaDonForm {
  so_ct: string;
  so_seri: string;
  ngay_ct: string; // yyyy-mm-dd
  ngay_lct: string;
  ma_dvcs: string;
  ma_gd: string;
  ma_kh: string;
  ong_ba: string;
  tk: string;
  ma_nvbh: string;
  ma_nt: string;
  ty_gia: number;
  ma_tt: string;
  ma_ht_tt: string;
  tk_thue_no: string;
  tk_thue_co: string;
  dien_giai: string;
  status: string;
  chi_tiet: LineForm[];
}

export interface HoaDonListParams {
  so_ct?: string;
  ma_kh?: string;
  ten_kh?: string;
  ngay_ct?: string;
  trang_thai?: string;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const EMPTY_LINE: LineForm = {
  ma_vt: '',
  ten_vt: '',
  dvt2: '',
  dvt: '',
  so_luong2: 0,
  so_luong2_nl: 0,
  so_luong_giao: 0,
  so_luong_hh: 0,
  ty_le_hh: 0,
  so_luong: 0,
  gia_nt2: 0,
  tien_nt2: 0,
  gia_khay_nt: 0,
  tien_khay_nt: 0,
  tien_no_nt: 0,
  tl_ck: 0,
  ck_nt: 0,
  ma_thue: '',
  thue_suat: 0,
  thue_nt: 0,
  ma_du_an: '',
  ma_pb: '',
  ma_kho: '',
  tk_dt: '',
  tk_ck: '',
  tk_gv: '',
  tk_thue: '',
  tk_vt: '',
};

export const emptyHoaDon = (): HoaDonForm => ({
  so_ct: '',
  so_seri: '',
  ngay_ct: todayIso(),
  ngay_lct: todayIso(),
  ma_dvcs: '',
  ma_gd: '',
  ma_kh: '',
  ong_ba: '',
  tk: '',
  ma_nvbh: '',
  ma_nt: 'VND',
  ty_gia: 1,
  ma_tt: '',
  ma_ht_tt: '',
  tk_thue_no: '',
  tk_thue_co: '',
  dien_giai: '',
  status: '2',
  chi_tiet: [{ ...EMPTY_LINE }],
});

const num = (v: string | number | null | undefined): number =>
  v == null || v === '' ? 0 : Number(v);
const str = (v: string | null): string => v ?? '';
const dateInput = (v: string | null): string => (v ? v.slice(0, 10) : '');

/** Header hóa đơn (list row) -> form (chưa gồm chi tiết — nạp riêng qua API). */
export function hoaDonToForm(d: HoaDon): HoaDonForm {
  return {
    so_ct: d.so_ct,
    so_seri: str(d.so_seri),
    ngay_ct: dateInput(d.ngay_ct),
    ngay_lct: dateInput(d.ngay_lct),
    ma_dvcs: str(d.ma_dvcs),
    ma_gd: str(d.ma_gd),
    ma_kh: d.ma_kh,
    ong_ba: str(d.ong_ba),
    tk: str(d.tk),
    ma_nvbh: str(d.ma_nvbh),
    ma_nt: d.ma_nt || 'VND',
    ty_gia: num(d.ty_gia) || 1,
    ma_tt: str(d.ma_tt),
    ma_ht_tt: str(d.ma_ht_tt),
    tk_thue_no: str(d.tk_thue_no),
    tk_thue_co: str(d.tk_thue_co),
    dien_giai: str(d.dien_giai),
    status: d.status || '2',
    chi_tiet: [],
  };
}

/** Dòng chi tiết API -> dòng form. */
export function chiTietToLine(d: HoaDonChiTiet): LineForm {
  return {
    ma_vt: d.ma_vt,
    ten_vt: d.ten_vt,
    dvt2: str(d.dvt2),
    dvt: str(d.dvt),
    so_luong2: num(d.so_luong2),
    so_luong2_nl: num(d.so_luong2_nl),
    so_luong_giao: num(d.so_luong_giao),
    so_luong_hh: num(d.so_luong_hh),
    ty_le_hh: num(d.ty_le_hh),
    so_luong: num(d.so_luong),
    gia_nt2: num(d.gia_nt2),
    tien_nt2: num(d.tien_nt2),
    gia_khay_nt: num(d.gia_khay_nt),
    tien_khay_nt: num(d.tien_khay_nt),
    tien_no_nt: num(d.tien_no_nt),
    tl_ck: num(d.tl_ck),
    ck_nt: num(d.ck_nt),
    ma_thue: str(d.ma_thue),
    thue_suat: num(d.thue_suat),
    thue_nt: num(d.thue_nt),
    ma_du_an: str(d.ma_du_an),
    ma_pb: str(d.ma_pb),
    ma_kho: str(d.ma_kho),
    tk_dt: str(d.tk_dt),
    tk_ck: str(d.tk_ck),
    tk_gv: str(d.tk_gv),
    tk_thue: str(d.tk_thue),
    tk_vt: str(d.tk_vt),
  };
}

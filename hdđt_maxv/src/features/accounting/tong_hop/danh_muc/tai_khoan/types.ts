/** 1 tài khoản (dmtk). */
export interface TaiKhoan {
  tk: string;
  ten_tk: string;
  ten_tk2: string | null;
  ten_ngan: string | null;
  ten_ngan2: string | null;
  ma_nt: string | null;
  loai_tk: string | null;
  tk_me: string | null;
  bac_tk: number | null;
  tk_sc: string;
  tk_cn: string;
  nh_tk0: string | null;
  nh_tk2: string | null;
  loai_cl_no: string | null;
  loai_cl_co: string | null;
  status: string;
}

/**
 * Payload tạo/sửa. Giữ ĐỦ field mà validator BE (optText) sẽ set null nếu
 * thiếu — kể cả nh_tk0/nh_tk2 dù form không hiển thị — để round-trip không
 * làm mất dữ liệu.
 */
export interface TaiKhoanForm {
  tk: string;
  ten_tk: string;
  ten_tk2: string;
  ten_ngan: string;
  ten_ngan2: string;
  ma_nt: string;
  tk_me: string;
  bac_tk: string;
  tk_sc: string;
  tk_cn: string;
  nh_tk0: string;
  nh_tk2: string;
  loai_cl_no: string;
  loai_cl_co: string;
  status: string;
}

export interface TaiKhoanListParams {
  tk?: string;
  ten_tk?: string;
  tk_me?: string;
  ma_nt?: string;
}

export const EMPTY_TAI_KHOAN: TaiKhoanForm = {
  tk: '',
  ten_tk: '',
  ten_tk2: '',
  ten_ngan: '',
  ten_ngan2: '',
  ma_nt: '',
  tk_me: '',
  bac_tk: '',
  tk_sc: '1',
  tk_cn: '0',
  nh_tk0: '',
  nh_tk2: '',
  loai_cl_no: '',
  loai_cl_co: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function taiKhoanToForm(d: TaiKhoan): TaiKhoanForm {
  const s = (v: string | null): string => v ?? '';
  return {
    tk: d.tk,
    ten_tk: d.ten_tk,
    ten_tk2: s(d.ten_tk2),
    ten_ngan: s(d.ten_ngan),
    ten_ngan2: s(d.ten_ngan2),
    ma_nt: s(d.ma_nt),
    tk_me: s(d.tk_me),
    bac_tk: d.bac_tk == null ? '' : String(d.bac_tk),
    tk_sc: d.tk_sc || '1',
    tk_cn: d.tk_cn || '0',
    nh_tk0: s(d.nh_tk0),
    nh_tk2: s(d.nh_tk2),
    loai_cl_no: s(d.loai_cl_no),
    loai_cl_co: s(d.loai_cl_co),
    status: d.status || '1',
  };
}

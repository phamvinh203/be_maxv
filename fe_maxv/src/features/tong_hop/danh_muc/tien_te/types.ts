/** 1 ngoại tệ (dmnt). */
export interface TienTe {
  ma_nt: string;
  ten_nt: string;
  ten_nt2: string | null;
  tk_pscl_no: string | null;
  tk_pscl_co: string | null;
  tk_dgcl_no: string | null;
  tk_dgcl_co: string | null;
  ra_ndec: number;
  ra_1: string | null;
  ra_2: string | null;
  ra_3: string | null;
  ra_4: string | null;
  ra_5: string | null;
  ra_12: string | null;
  ra_22: string | null;
  ra_32: string | null;
  ra_42: string | null;
  ra_52: string | null;
  status: string;
}

/**
 * Payload tạo/sửa — giữ ĐỦ field (kể cả ra_* dù form không hiển thị) để khi
 * sửa round-trip không làm mất dữ liệu cấu hình làm tròn.
 */
export interface TienTeForm {
  ma_nt: string;
  ten_nt: string;
  ten_nt2: string;
  tk_pscl_no: string;
  tk_pscl_co: string;
  tk_dgcl_no: string;
  tk_dgcl_co: string;
  ra_ndec: number;
  ra_1: string;
  ra_2: string;
  ra_3: string;
  ra_4: string;
  ra_5: string;
  ra_12: string;
  ra_22: string;
  ra_32: string;
  ra_42: string;
  ra_52: string;
  status: string;
}

export interface TienTeListParams {
  ma_nt?: string;
  ten_nt?: string;
}

export const EMPTY_TIEN_TE: TienTeForm = {
  ma_nt: '',
  ten_nt: '',
  ten_nt2: '',
  tk_pscl_no: '',
  tk_pscl_co: '',
  tk_dgcl_no: '',
  tk_dgcl_co: '',
  ra_ndec: 0,
  ra_1: '',
  ra_2: '',
  ra_3: '',
  ra_4: '',
  ra_5: '',
  ra_12: '',
  ra_22: '',
  ra_32: '',
  ra_42: '',
  ra_52: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function tienTeToForm(d: TienTe): TienTeForm {
  const s = (v: string | null): string => v ?? '';
  return {
    ma_nt: d.ma_nt,
    ten_nt: d.ten_nt,
    ten_nt2: s(d.ten_nt2),
    tk_pscl_no: s(d.tk_pscl_no),
    tk_pscl_co: s(d.tk_pscl_co),
    tk_dgcl_no: s(d.tk_dgcl_no),
    tk_dgcl_co: s(d.tk_dgcl_co),
    ra_ndec: Number(d.ra_ndec) || 0,
    ra_1: s(d.ra_1),
    ra_2: s(d.ra_2),
    ra_3: s(d.ra_3),
    ra_4: s(d.ra_4),
    ra_5: s(d.ra_5),
    ra_12: s(d.ra_12),
    ra_22: s(d.ra_22),
    ra_32: s(d.ra_32),
    ra_42: s(d.ra_42),
    ra_52: s(d.ra_52),
    status: d.status || '1',
  };
}

/** 1 nhóm hàng hóa (dmnhvt). Khóa ghép (loai_nh, ma_nh). */
export interface PhanNhom {
  loai_nh: number;
  ma_nh: string;
  ten_nh: string;
  ten_nh2: string | null;
  status: string;
}

/** Payload tạo/sửa (ô trống -> BE tự chuyển null). */
export interface PhanNhomForm {
  loai_nh: number;
  ma_nh: string;
  ten_nh: string;
  ten_nh2: string;
  status: string;
}

export interface PhanNhomListParams {
  loai_nh?: number;
  ma_nh?: string;
  ten_nh?: string;
}

export const LOAI_NH_OPTIONS = [
  { value: 1, label: 'Nhóm 1' },
  { value: 2, label: 'Nhóm 2' },
  { value: 3, label: 'Nhóm 3' },
];

export const EMPTY_PHAN_NHOM: PhanNhomForm = {
  loai_nh: 1,
  ma_nh: '',
  ten_nh: '',
  ten_nh2: '',
  status: '1',
};

/** Khóa duy nhất trên URL & cho useCatalogList: "loai_nh-ma_nh". */
export const rowId = (r: Pick<PhanNhom, 'loai_nh' | 'ma_nh'>): string =>
  `${r.loai_nh}-${r.ma_nh}`;

/** Chi tiết -> form (null -> ''). */
export function phanNhomToForm(d: PhanNhom): PhanNhomForm {
  return {
    loai_nh: d.loai_nh,
    ma_nh: d.ma_nh,
    ten_nh: d.ten_nh,
    ten_nh2: d.ten_nh2 ?? '',
    status: d.status || '1',
  };
}

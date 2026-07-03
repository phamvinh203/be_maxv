/** 1 loại vật tư (dmloaivt). */
export interface LoaiVt {
  ma_loai_vt: string;
  ten_loai_vt: string;
  ten_loai_vt2: string | null;
  status: string;
}

/** Payload tạo/sửa (ô trống -> BE tự chuyển null). */
export interface LoaiVtForm {
  ma_loai_vt: string;
  ten_loai_vt: string;
  ten_loai_vt2: string;
  status: string;
}

export interface LoaiVtListParams {
  ma_loai_vt?: string;
  ten_loai_vt?: string;
}

export const EMPTY_LOAI_VT: LoaiVtForm = {
  ma_loai_vt: '',
  ten_loai_vt: '',
  ten_loai_vt2: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function loaiVtToForm(d: LoaiVt): LoaiVtForm {
  return {
    ma_loai_vt: d.ma_loai_vt,
    ten_loai_vt: d.ten_loai_vt,
    ten_loai_vt2: d.ten_loai_vt2 ?? '',
    status: d.status || '1',
  };
}

/** 1 nhóm kho (dmnhkho). */
export interface NhomKho {
  ma_nh: string;
  ten_nh: string;
  ten_nh2: string | null;
  status: string;
}

/** Payload tạo/sửa (ô trống -> BE tự chuyển null). */
export interface NhomKhoForm {
  ma_nh: string;
  ten_nh: string;
  ten_nh2: string;
  status: string;
}

export interface NhomKhoListParams {
  ma_nh?: string;
  ten_nh?: string;
}

export const EMPTY_NHOM_KHO: NhomKhoForm = {
  ma_nh: '',
  ten_nh: '',
  ten_nh2: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function nhomKhoToForm(d: NhomKho): NhomKhoForm {
  return {
    ma_nh: d.ma_nh,
    ten_nh: d.ten_nh,
    ten_nh2: d.ten_nh2 ?? '',
    status: d.status || '1',
  };
}

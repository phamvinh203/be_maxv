/** 1 kho hàng (dmkho). `ten_nhkho` chỉ có ở danh sách (join nhóm kho). */
export interface Kho {
  ma_kho: string;
  ma_dvcs: string;
  ten_kho: string;
  ten_kho2: string | null;
  dai_ly_yn: boolean;
  ma_nh: string | null;
  ghi_chu: string | null;
  status: string;
  ten_nhkho?: string | null;
}

/** Payload tạo/sửa (ô trống -> BE tự chuyển null). */
export interface KhoForm {
  ma_kho: string;
  ma_dvcs: string;
  ten_kho: string;
  ten_kho2: string;
  dai_ly_yn: boolean;
  ma_nh: string;
  ghi_chu: string;
  status: string;
}

export interface KhoListParams {
  ma_kho?: string;
  ten_kho?: string;
  ma_dvcs?: string;
}

export const EMPTY_KHO: KhoForm = {
  ma_kho: '',
  ma_dvcs: '001',
  ten_kho: '',
  ten_kho2: '',
  dai_ly_yn: false,
  ma_nh: '',
  ghi_chu: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function khoToForm(d: Kho): KhoForm {
  return {
    ma_kho: d.ma_kho,
    ma_dvcs: d.ma_dvcs || '001',
    ten_kho: d.ten_kho,
    ten_kho2: d.ten_kho2 ?? '',
    dai_ly_yn: !!d.dai_ly_yn,
    ma_nh: d.ma_nh ?? '',
    ghi_chu: d.ghi_chu ?? '',
    status: d.status || '1',
  };
}

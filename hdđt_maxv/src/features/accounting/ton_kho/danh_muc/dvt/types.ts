/** 1 đơn vị tính (dmdvt). */
export interface Dvt {
  dvt: string;
  dvt2: string | null;
  ten_dvt: string;
  ten_dvt2: string | null;
  status: string;
}

/** Payload tạo/sửa (ô trống -> BE tự chuyển null). */
export interface DvtForm {
  dvt: string;
  dvt2: string;
  ten_dvt: string;
  ten_dvt2: string;
  status: string;
}

export interface DvtListParams {
  dvt?: string;
  ten_dvt?: string;
}

export const EMPTY_DVT: DvtForm = {
  dvt: '',
  dvt2: '',
  ten_dvt: '',
  ten_dvt2: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function dvtToForm(d: Dvt): DvtForm {
  return {
    dvt: d.dvt,
    dvt2: d.dvt2 ?? '',
    ten_dvt: d.ten_dvt,
    ten_dvt2: d.ten_dvt2 ?? '',
    status: d.status || '1',
  };
}

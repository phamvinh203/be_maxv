/** 1 vị trí kho (dmvitri). Khóa ghép (ma_kho, ma_vi_tri). `ten_kho` từ list. */
export interface ViTri {
  ma_kho: string;
  ma_vi_tri: string;
  ten_vi_tri: string;
  ten_vi_tri2: string | null;
  status: string;
  ten_kho?: string | null;
}

/** Payload tạo/sửa (ô trống -> BE tự chuyển null). */
export interface ViTriForm {
  ma_kho: string;
  ma_vi_tri: string;
  ten_vi_tri: string;
  ten_vi_tri2: string;
  status: string;
}

export interface ViTriListParams {
  ma_kho?: string;
  ma_vi_tri?: string;
  ten_vi_tri?: string;
}

export const EMPTY_VI_TRI: ViTriForm = {
  ma_kho: '',
  ma_vi_tri: '',
  ten_vi_tri: '',
  ten_vi_tri2: '',
  status: '1',
};

/** Khóa duy nhất cho useCatalogList (cách nhau bằng khoảng trắng). */
export const rowId = (r: Pick<ViTri, 'ma_kho' | 'ma_vi_tri'>): string =>
  `${r.ma_kho} ${r.ma_vi_tri}`;

/** Chi tiết -> form (null -> ''). */
export function viTriToForm(d: ViTri): ViTriForm {
  return {
    ma_kho: d.ma_kho,
    ma_vi_tri: d.ma_vi_tri,
    ten_vi_tri: d.ten_vi_tri,
    ten_vi_tri2: d.ten_vi_tri2 ?? '',
    status: d.status || '1',
  };
}

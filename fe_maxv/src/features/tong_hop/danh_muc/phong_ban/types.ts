/** 1 phòng ban (dmpb). */
export interface PhongBan {
  ma_pb: string;
  ten_pb: string;
  ten_pb2: string | null;
  dia_chi: string | null;
  dien_thoai: string | null;
  ma_td1: string | null;
  ten_tk: string | null;
  ghi_chu: string | null;
  status: string;
}

/** Payload tạo/sửa. */
export interface PhongBanForm {
  ma_pb: string;
  ten_pb: string;
  ten_pb2: string;
  dia_chi: string;
  dien_thoai: string;
  ma_td1: string;
  ten_tk: string;
  ghi_chu: string;
  status: string;
}

export interface PhongBanListParams {
  ma_pb?: string;
  ten_pb?: string;
}

export const EMPTY_PHONG_BAN: PhongBanForm = {
  ma_pb: '',
  ten_pb: '',
  ten_pb2: '',
  dia_chi: '',
  dien_thoai: '',
  ma_td1: '',
  ten_tk: '',
  ghi_chu: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function phongBanToForm(d: PhongBan): PhongBanForm {
  const s = (v: string | null): string => v ?? '';
  return {
    ma_pb: d.ma_pb,
    ten_pb: d.ten_pb,
    ten_pb2: s(d.ten_pb2),
    dia_chi: s(d.dia_chi),
    dien_thoai: s(d.dien_thoai),
    ma_td1: s(d.ma_td1),
    ten_tk: s(d.ten_tk),
    ghi_chu: s(d.ghi_chu),
    status: d.status || '1',
  };
}

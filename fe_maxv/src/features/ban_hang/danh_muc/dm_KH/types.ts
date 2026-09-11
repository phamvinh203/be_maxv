/** 1 khách hàng (dmkh). */
export interface KhachHang {
  ma_kh: string;
  ten_kh: string;
  ten_kh2: string | null;
  dia_chi: string | null;
  ma_so_thue: string | null;
  status: string;
}

/** Payload tạo/sửa. */
export interface KhachHangForm {
  ma_kh: string;
  ten_kh: string;
  ten_kh2: string;
  dia_chi: string;
  ma_so_thue: string;
  status: string;
}

/** Một trang danh sách khách hàng (GET /ban-hang/khach-hang) — server phân trang. */
export interface KhachHangPage {
  items: KhachHang[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KhachHangListParams {
  /** Trang, bắt đầu từ 1. */
  page?: number;
  /** Số dòng mỗi trang — server giới hạn tối đa 100. */
  pageSize?: number;
  /** Ô tìm chung: mã / tên / mã số thuế (server lọc). */
  q?: string;
  ma_kh?: string;
  ten_kh?: string;
  dia_chi?: string;
  ma_so_thue?: string;
}

export const EMPTY_KHACH_HANG: KhachHangForm = {
  ma_kh: '',
  ten_kh: '',
  ten_kh2: '',
  dia_chi: '',
  ma_so_thue: '',
  status: '1',
};

/** Chi tiết -> form (null -> ''). */
export function khachHangToForm(d: KhachHang): KhachHangForm {
  const s = (v: string | null): string => v ?? '';
  return {
    ma_kh: d.ma_kh,
    ten_kh: d.ten_kh,
    ten_kh2: s(d.ten_kh2),
    dia_chi: s(d.dia_chi),
    ma_so_thue: s(d.ma_so_thue),
    status: d.status || '1',
  };
}

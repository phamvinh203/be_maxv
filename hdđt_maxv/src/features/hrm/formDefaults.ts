/**
 * Giá trị rỗng của các form HRM.
 *
 * Để ở file riêng (không nằm cạnh component) vì mỗi form được mở từ nhiều chỗ:
 * hợp đồng mở từ tab 1 lúc thêm nhân viên và từ tab "Lịch sử hợp đồng"; người
 * phụ thuộc mở từ tab 4 và từ màn hình độc lập. Một nguồn giá trị mặc định thì
 * các lối vào không lệch nhau.
 */

import { moTaLoaiKhoan } from "./constants";
import type {
  CaLamViecFormValues,
  ChiTieuKpiFormValues,
  HopDongFormValues,
  KhoanBuTruFormValues,
  KhoanLuongFormValues,
  LoaiChuyenCanFormValues,
  LoaiKhoanLuong,
  NgayLeFormValues,
  NguoiPhuThuocFormValues,
  NhanVien,
  SanPhamFormValues,
  TaiLieuFormValues,
} from "./types";

export function nhanVienRong(maNv: string): NhanVien {
  return {
    ma_nv: maNv,
    ho_ten: "",
    so_cccd: "",
    mst_ca_nhan: "",
    ngay_sinh: "",
    gioi_tinh: "nam",
    dien_thoai: "",
    email: "",
    dia_chi: "",
    ghi_chu: "",
    ma_pb: null,
    ma_cv: "",
    cap_bac: "",
    cong_doan: false,
    ngay_vao: "",
    ngan_hang: "",
    so_tk: "",
    chu_tk: "",
    status: "1",
  };
}

export function hopDongRong(): HopDongFormValues {
  return {
    so_hd: "",
    loai_hd: "xac_dinh",
    kieu_luong: "GROSS",
    luong_chinh: 0,
    luong_bhxh: 0,
    ngay_bat_dau: "",
    ngay_ket_thuc: "",
    trich_bhxh: true,
    tinh_tncn: true,
    ghi_chu: "",
  };
}

export function taiLieuRong(): TaiLieuFormValues {
  return {
    loai: "cccd",
    so_hieu: "",
    ngay_cap: "",
    noi_cap: "",
    ghi_chu: "",
  };
}

export function caLamViecRong(): CaLamViecFormValues {
  return {
    ten_ca: "",
    gio_vao: "08:00",
    gio_ra: "17:00",
    nghi_giua_ca: 60,
    status: "1",
  };
}

/** Khoản lương rỗng — hai cờ lấy mặc định theo loại, người dùng vẫn sửa được. */
export function khoanLuongRong(loai: LoaiKhoanLuong): KhoanLuongFormValues {
  const moTa = moTaLoaiKhoan(loai);
  return {
    loai,
    ten_khoan: "",
    ghi_chu: "",
    tinh_bhxh: moTa.macDinhBhxh,
    chiu_thue_tncn: moTa.macDinhTncn,
    ty_le: 0,
    status: "1",
  };
}

/** Khoản bù trừ rỗng — mặc định chiều "trừ", phần lớn khoản ở màn này là khấu trừ. */
export function khoanBuTruRong(): KhoanBuTruFormValues {
  return {
    ten_bt: "",
    chieu: "tru",
    ghi_chu: "",
    status: "1",
  };
}

/** Loại lỗi chuyên cần rỗng — mặc định trừ theo giờ, cách hay gặp nhất. */
export function loaiChuyenCanRong(): LoaiChuyenCanFormValues {
  return {
    ten_cc: "",
    cach_tru: "theo_gio",
    muc_tru: 0,
    ghi_chu: "",
    status: "1",
  };
}

/** Sản phẩm rỗng của danh mục nghiệm thu. */
export function sanPhamRong(): SanPhamFormValues {
  return {
    ten_sp: "",
    don_vi: "",
    don_gia: 0,
    ghi_chu: "",
    status: "1",
  };
}

/** Chỉ tiêu KPI rỗng. Trọng số 10 để bảng có sẵn số, không phải gõ từ 0. */
export function chiTieuKpiRong(): ChiTieuKpiFormValues {
  return {
    ten_kpi: "",
    don_vi: "",
    trong_so_mac_dinh: 10,
    ghi_chu: "",
    status: "1",
  };
}

export function ngayLeRong(): NgayLeFormValues {
  return {
    ngay: "",
    ten: "",
    loai: "le_duong_lich",
    lap_lai_hang_nam: true,
    co_luong: true,
    ghi_chu: "",
  };
}

export function nptRong(): NguoiPhuThuocFormValues {
  return {
    ho_ten: "",
    quan_he: "con",
    ngay_sinh: "",
    so_cccd: "",
    mst_ca_nhan: "",
    dien_thoai: "",
    dia_chi: "",
    gt_tu_thang: "",
    gt_den_thang: "",
  };
}

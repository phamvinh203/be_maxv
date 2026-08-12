/**
 * Kiểu dữ liệu của khu HRM.
 *
 * Tên trường giữ nguyên dạng snake_case theo cột DB đã chốt trong
 * `docs/superpowers/specs/2026-08-11-hrm-danh-muc-nhan-vien-design.md`, để khi
 * thay lớp mock bằng API thật thì không phải ánh xạ lại tên.
 *
 * Quy ước của pha hardcode: trường văn bản tùy chọn dùng chuỗi rỗng thay vì
 * `null` — form MUI luôn cần chuỗi, dùng `null` sẽ phải `?? ""` ở mọi ô nhập.
 * Riêng `ma_pb_me` và `ma_pb` giữ `null` vì "không có cha" / "chưa gán phòng
 * ban" là trạng thái nghiệp vụ thật, không phải ô bỏ trống.
 */

/** `"1"` đang dùng · `"0"` ngừng — khớp cột `status` của mọi danh mục trong tenant DB. */
export type TrangThai = "1" | "0";

export type GioiTinh = "nam" | "nu" | "khac";
export type QuanHe = "con" | "vo_chong" | "cha" | "me" | "anh_chi_em" | "ong_ba" | "chau" | "khac";
export type LoaiHopDong = "khong_xac_dinh" | "xac_dinh" | "thu_viec" | "thoi_vu" | "khoan";
export type KieuLuong = "GROSS" | "NET";
export type LoaiTaiLieu = "cccd" | "ho_chieu" | "bang_cap" | "chung_chi" | "so_yeu_ly_lich";

export interface PhongBan {
  ma_pb: string;
  ten_pb: string;
  /** Trực thuộc — `null` là phòng ban gốc. */
  ma_pb_me: string | null;
  /** Ô "Mô tả" trên form ánh xạ vào đây. */
  ghi_chu: string;
  status: TrangThai;
}

/** Dòng phòng ban đã tính sẵn cấp, tên cha và số nhân viên để đổ thẳng ra bảng. */
export interface PhongBanRow extends PhongBan {
  /** Gốc là 1. Tính từ cây mỗi lần dựng bảng, không lưu. */
  cap: number;
  ten_pb_me: string;
  so_nv: number;
}

export interface NhanVien {
  ma_nv: string;
  ho_ten: string;
  so_cccd: string;
  mst_ca_nhan: string;
  /** `YYYY-MM-DD` — khớp thẳng `<input type="date">`, không dính lệch múi giờ. */
  ngay_sinh: string;
  gioi_tinh: GioiTinh;
  dien_thoai: string;
  email: string;
  dia_chi: string;
  ghi_chu: string;
  /** `null` = chưa gán phòng ban (Gán nhanh lọc theo đúng trường hợp này). */
  ma_pb: string | null;
  ma_cv: string;
  cap_bac: string;
  cong_doan: boolean;
  ngay_vao: string;
  ngan_hang: string;
  so_tk: string;
  chu_tk: string;
  status: TrangThai;
}

/** Dòng nhân viên kèm dữ liệu tra từ bảng khác — bảng danh sách dùng trực tiếp. */
export interface NhanVienRow extends NhanVien {
  ten_pb: string;
  ten_cv: string;
  /** Hợp đồng hiện hành, `null` khi chưa ký hợp đồng nào. */
  hop_dong: HopDong | null;
  so_npt: number;
}

export interface HopDong {
  id: string;
  ma_nv: string;
  so_hd: string;
  loai_hd: LoaiHopDong;
  kieu_luong: KieuLuong;
  luong_chinh: number;
  /** Gốc tính phí công đoàn 1%. */
  luong_bhxh: number;
  ngay_bat_dau: string;
  /** Rỗng = không xác định thời hạn. */
  ngay_ket_thuc: string;
  trich_bhxh: boolean;
  tinh_tncn: boolean;
  ghi_chu: string;
}

export interface TaiLieu {
  id: string;
  ma_nv: string;
  loai: LoaiTaiLieu;
  so_hieu: string;
  ngay_cap: string;
  noi_cap: string;
  ghi_chu: string;
}

export interface NguoiPhuThuoc {
  id: string;
  ma_nv: string;
  ho_ten: string;
  quan_he: QuanHe;
  ngay_sinh: string;
  so_cccd: string;
  mst_ca_nhan: string;
  dien_thoai: string;
  dia_chi: string;
  /** Đăng ký giảm trừ gia cảnh, dạng `YYYY-MM` — khớp `<input type="month">`. */
  gt_tu_thang: string;
  gt_den_thang: string;
}

export interface NguoiPhuThuocRow extends NguoiPhuThuoc {
  ten_nv: string;
}

/** Giá trị form phòng ban — không có `ma_pb` vì mã sinh tự động. */
export interface PhongBanFormValues {
  ten_pb: string;
  ma_pb_me: string | null;
  ghi_chu: string;
  status: TrangThai;
}

export type HopDongFormValues = Omit<HopDong, "id" | "ma_nv">;
export type TaiLieuFormValues = Omit<TaiLieu, "id" | "ma_nv">;
export type NguoiPhuThuocFormValues = Omit<NguoiPhuThuoc, "id" | "ma_nv">;

/**
 * Payload thêm nhân viên: hợp đồng đầu tiên nằm lồng bên trong vì tab 1 của
 * dialog gộp cả hai nhóm — tách thành hai lượt ghi sẽ để lại nhân viên không
 * có hợp đồng nếu lượt thứ hai hỏng.
 */
export interface ThemNhanVienPayload {
  nhan_vien: NhanVien;
  hop_dong: HopDongFormValues | null;
}

/** Bộ lọc của bảng nhân viên. `status` rỗng = xem tất cả. */
export interface NhanVienFilters {
  q: string;
  ma_pb: string;
  status: TrangThai | "";
}

// ───────────────────────────── Cấu hình mặc định ─────────────────────────────

export type PhuongPhapNgayCong = "co_dinh_24" | "co_dinh_26" | "theo_thang";
export type ChinhSachNgay = "lam_ca_ngay" | "lam_nua_ngay" | "nghi";

/**
 * Một bậc của biểu thuế lũy tiến từng phần.
 *
 * `khoang` mang nghĩa khác nhau theo vị trí, đúng như cách biểu thuế được đọc:
 * bậc 1 là **mức chịu thuế tối đa**, bậc 2–4 là **độ rộng khoảng** cộng thêm lên
 * bậc trước, bậc cuối không có khoảng (áp cho toàn bộ phần vượt) nên để `0`.
 */
export interface BacThue {
  khoang: number;
  thue_suat: number;
}

export interface CauHinhMacDinh {
  // Ngày công & giờ công
  phuong_phap_ngay_cong: PhuongPhapNgayCong;
  chinh_sach_thu_7: ChinhSachNgay;
  chinh_sach_chu_nhat: ChinhSachNgay;
  gio_cong_chuan_ngay: number;

  // Nghỉ phép có lương
  ngay_phep_co_ban: number;
  nam_tham_nien_them_phep: number;

  // Hệ số tăng ca (%)
  tc_ngay_thuong_ngay: number;
  tc_ngay_thuong_dem: number;
  tc_chu_nhat_ngay: number;
  tc_chu_nhat_dem: number;
  tc_ngay_le_ngay: number;
  tc_ngay_le_dem: number;

  // Giới hạn giờ tăng ca
  gioi_han_tc_thang: number;
  nguong_canh_bao_tc_nam: number;
  nguong_vuot_muc_tc_nam: number;

  // Lương cơ sở / tối thiểu vùng
  luong_co_so: number;
  luong_toi_thieu_vung: number;

  // Bảo hiểm — nhân viên đóng (%)
  bhxh_nv: number;
  bhyt_nv: number;
  bhtn_nv: number;

  // Bảo hiểm — công ty đóng (%)
  bhxh_ct: number;
  bhyt_ct: number;
  bhtn_ct: number;

  // Công đoàn
  doan_phi_nv: number;
  tran_co_so_doan_phi: number;
  kinh_phi_cong_doan_ct: number;

  // Giảm trừ thuế TNCN
  giam_tru_ban_than: number;
  giam_tru_npt: number;

  /** Đúng 5 phần tử — biểu thuế lũy tiến rút gọn 5 bậc. */
  bac_thue: BacThue[];
}

export interface CaLamViec {
  ma_ca: string;
  ten_ca: string;
  /** `HH:mm` — khớp thẳng `<input type="time">`. */
  gio_vao: string;
  gio_ra: string;
  /** Nghỉ giữa ca, tính bằng phút. */
  nghi_giua_ca: number;
  status: TrangThai;
}

export type CaLamViecFormValues = Omit<CaLamViec, "ma_ca">;

// ─────────────────────── Cài đặt lương › Danh mục khoản ───────────────────────

export type LoaiKhoanLuong =
  | "luong_phu_cap"
  | "luong_ho_tro"
  | "luong_nghiem_thu"
  | "luong_phan_tram"
  | "luong_kpi"
  | "luong_thuong"
  | "luong_chuyen_can";

/**
 * Một khoản trong danh mục lương & phụ cấp.
 *
 * Bảy loại khoản dùng chung một bảng vì chúng khác nhau ở **cách tính**, không
 * ở dữ liệu cần lưu: đều là một cái tên, một ghi chú và hai cờ quyết định khoản
 * đó có vào gốc đóng BHXH và thu nhập chịu thuế hay không. Tách bảy bảng riêng
 * sẽ nhân bảy toàn bộ phần CRUD mà không thêm được thông tin nào.
 */
export interface KhoanLuong {
  ma_khoan: string;
  loai: LoaiKhoanLuong;
  ten_khoan: string;
  ghi_chu: string;
  tinh_bhxh: boolean;
  chiu_thue_tncn: boolean;
  /** Chỉ có nghĩa với loại `luong_phan_tram`; các loại khác luôn là 0. */
  ty_le: number;
  status: TrangThai;
}

export type KhoanLuongFormValues = Omit<KhoanLuong, "ma_khoan">;

// ─────────────────── Cấu hình mặc định › Lịch ngày lễ ───────────────────

export type LoaiNgayLe = "le_duong_lich" | "le_am_lich" | "nghi_bu" | "le_cong_ty";

export interface NgayLe {
  id: string;
  /** `YYYY-MM-DD` — luôn là ngày dương lịch, kể cả với lễ gốc âm lịch. */
  ngay: string;
  ten: string;
  loai: LoaiNgayLe;
  /**
   * Lặp lại mọi năm **theo dương lịch**. Lễ gốc âm lịch không bật được cờ này
   * vì ngày dương của chúng đổi mỗi năm — phải tạo lại từng năm.
   */
  lap_lai_hang_nam: boolean;
  co_luong: boolean;
  ghi_chu: string;
}

export type NgayLeFormValues = Omit<NgayLe, "id">;

/** Bộ lọc của bảng lịch ngày lễ. */
export type LocNgayLe = "tat_ca" | "hang_nam" | "nam_nay";

// ─────────────────────── Dữ liệu tính lương › Chấm công ───────────────────────

export type LoaiCong =
  | "lam_viec"
  | "nua_ngay"
  | "cong_tac"
  | "nghi_phep"
  | "nghi_le"
  | "om"
  | "khong_luong"
  | "khac";

/** Nội dung một ô chấm công. */
export interface OChamCong {
  loai: LoaiCong;
  /** Số giờ làm cụ thể. `0` = dùng công mặc định của loại. */
  soGio: number;
}

// ─────────────────────── Cài đặt lương › Set lương ───────────────────────

/** Cách khoản này vào thu nhập chịu thuế TNCN. */
export type PhanLoaiThue = "tncn" | "mien_thue";

/** Căn cứ quy đổi từ mức cấu hình ra số tiền thực trả trong kỳ. */
export type TieuThucTinh =
  | "co_dinh_thang"
  | "theo_ngay_cong"
  | "theo_gio_cong"
  | "theo_san_luong"
  | "theo_doanh_so"
  | "theo_kpi"
  | "nhap_tay";

/** Một khoản trong cấu trúc lương đang áp dụng. */
export interface DongCauTrucLuong {
  /** → `KhoanLuong.ma_khoan` trong Danh mục lương & phụ cấp. */
  ma_khoan: string;
  phan_loai: PhanLoaiThue;
  /** Khoản này có được nhân hệ số tăng ca không. */
  tang_ca: boolean;
  tieu_thuc: TieuThucTinh;
  /** Mức mặc định của khoản; từng nhân viên chỉnh lại khi set lương. */
  so_tien: number;
}

/**
 * Cấu trúc lương của công ty trong một khoảng hiệu lực.
 *
 * Một bản duy nhất đang áp dụng — đổi cấu trúc là đổi cho toàn công ty, còn số
 * tiền riêng của từng người nằm ở `SetLuongNhanVien`.
 */
export interface CauTrucLuong {
  tu_ngay: string;
  den_ngay: string;
  ghi_chu: string;
  dong: DongCauTrucLuong[];
}

export type TrangThaiSetLuong = "nhap" | "cho_duyet" | "da_duyet";

export interface SetLuongNhanVien {
  ma_nv: string;
  /** Tăng thêm một sau mỗi lần lưu — cột "Lần thiết lập". */
  lan_thiet_lap: number;
  hieu_luc_tu: string;
  hieu_luc_den: string;
  /** Số tiền từng khoản của riêng nhân viên này, khóa là `ma_khoan`. */
  khoan: Record<string, number>;
  trang_thai: TrangThaiSetLuong;
}

/** Dòng của bảng danh sách set lương, đã ghép dữ liệu tra từ bảng khác. */
export interface SetLuongRow {
  ma_nv: string;
  ho_ten: string;
  ten_cv: string;
  loai_hd: LoaiHopDong | null;
  so_tk: string;
  daSet: boolean;
  lan_thiet_lap: number;
  hieu_luc_tu: string;
  hieu_luc_den: string;
  tong_luong: number;
  trang_thai: TrangThaiSetLuong | null;
}

export interface SetLuongFilters {
  q: string;
  ma_pb: string;
  loai_hd: LoaiHopDong | "";
  /** `true` = đã set lương, `false` = chưa set. */
  daSet: boolean;
}

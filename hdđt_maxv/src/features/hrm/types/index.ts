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

// ──────────────────── Dữ liệu tính lương › dùng chung ────────────────────

/**
 * Phạm vi áp một bảng (KPI, thưởng…) — quyết định danh sách nhân viên nhận bảng
 * đang soạn.
 *
 * Không lưu vào bản của nhân viên: sau khi áp xong thì mỗi người đều có một bảng
 * riêng, phạm vi chỉ là cách chọn nhanh "áp cho ai" ở màn hình.
 */
export type PhamViApDung = "nhan_vien" | "phong_ban" | "toan_cong_ty";

/** Bộ lọc nhân viên của các màn hình trong khu "Dữ liệu tính lương". */
export interface LocNhanVienKyLuong {
  q: string;
  ma_pb: string;
  loai_hd: LoaiHopDong | "";
}

/** Phần dùng chung của một dòng bảng nhân viên trong khu "Dữ liệu tính lương". */
export interface NhanVienKyLuongRow {
  ma_nv: string;
  ho_ten: string;
  ten_pb: string;
  loai_hd: LoaiHopDong | null;
}

// ────────────────────────── Dữ liệu tính lương › KPI ──────────────────────────

/**
 * Một chỉ tiêu trong danh mục KPI — quản lý ở nút "Quản lý KPI".
 *
 * Tách khỏi `DongKpi` vì cùng một chỉ tiêu ("Doanh số ký mới", "Số đơn xử lý")
 * dùng lại ở nhiều bảng với mục tiêu khác nhau. Cho gõ tên tự do ở từng bảng thì
 * hai kỳ lương liền nhau sẽ có hai cách viết tên và không đối chiếu được.
 */
export interface ChiTieuKpi {
  ma_kpi: string;
  ten_kpi: string;
  /** Đơn vị của mục tiêu: `đồng`, `đơn`, `%`, `giờ`… Hiện sau ô nhập cho đỡ nhầm. */
  don_vi: string;
  /** Trọng số gợi ý khi kéo chỉ tiêu này vào bảng; sửa lại được từng bảng. */
  trong_so_mac_dinh: number;
  ghi_chu: string;
  status: TrangThai;
}

export type ChiTieuKpiFormValues = Omit<ChiTieuKpi, "ma_kpi">;

/** Một dòng của bảng KPI. Tỷ lệ HT tính từ `thuc_thi / muc_tieu`, không lưu. */
export interface DongKpi {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** → `ChiTieuKpi.ma_kpi`. Rỗng = dòng vừa thêm, chưa chọn chỉ tiêu. */
  ma_kpi: string;
  trong_so: number;
  muc_tieu: number;
  thuc_thi: number;
}

/** Bảng KPI đã áp cho một nhân viên. */
export interface BanKpiNhanVien {
  ma_nv: string;
  /** Tăng thêm một sau mỗi lần áp KPI — cột "Lần lương". */
  lan_luong: number;
  dong: DongKpi[];
}

/** Dòng của bảng nhân viên ở màn KPI, đã tính sẵn hiệu suất. */
export interface KpiNhanVienRow extends NhanVienKyLuongRow {
  lan_luong: number;
  /** Bình quân tỷ lệ HT theo trọng số (%). `null` = chưa áp KPI lần nào. */
  hieu_suat: number | null;
  so_chi_tieu: number;
}

// ───────────────────────── Dữ liệu tính lương › Thưởng ─────────────────────────

/**
 * Một dòng của bảng thưởng.
 *
 * Loại thưởng trỏ về **Danh mục lương & phụ cấp** (`KhoanLuong` loại
 * `luong_thuong`) chứ không phải một danh mục riêng: các khoản thưởng đã khai ở
 * Cài đặt lương và cấu trúc lương cũng gọi đúng những mã đó — dựng thêm một danh
 * mục thứ hai thì bảng lương sẽ có hai nguồn khoản thưởng không khớp nhau.
 */
export interface DongThuong {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** → `KhoanLuong.ma_khoan`. Rỗng = dòng vừa thêm, chưa chọn loại thưởng. */
  ma_khoan: string;
  /** Mức thưởng của **một** nhân viên. */
  so_tien: number;
}

/** Bảng thưởng đã áp cho một nhân viên. */
export interface BanThuongNhanVien {
  ma_nv: string;
  dong: DongThuong[];
}

/** Dòng của bảng nhân viên ở màn Thưởng, đã cộng sẵn tổng tiền. */
export interface ThuongNhanVienRow extends NhanVienKyLuongRow {
  /** Tổng tiền thưởng đã áp. `null` = chưa áp thưởng lần nào. */
  tien_thuong: number | null;
  so_khoan: number;
}

// ──────────────────────── Dữ liệu tính lương › Tăng ca ────────────────────────

/**
 * Sáu loại giờ tăng ca.
 *
 * Đúng sáu hệ số đã khai ở **Cấu hình mặc định** (`tc_*`) — bảng tăng ca không
 * tự giữ hệ số riêng, nếu không thì đổi hệ số ở Thiết lập chung sẽ không kéo
 * theo số giờ quy đổi trên màn hình này.
 */
export type LoaiTangCa =
  | "ngay_thuong_ngay"
  | "ngay_thuong_dem"
  | "chu_nhat_ngay"
  | "chu_nhat_dem"
  | "ngay_le_ngay"
  | "ngay_le_dem";

/** Một dòng của bảng tăng ca. Giờ quy đổi tính từ hệ số, không lưu. */
export interface DongTangCa {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** Rỗng = dòng vừa thêm, chưa chọn loại tăng ca. */
  loai: LoaiTangCa | "";
  so_gio: number;
}

/** Bảng tăng ca đã áp cho một nhân viên. */
export interface BanTangCaNhanVien {
  ma_nv: string;
  dong: DongTangCa[];
  /**
   * Giờ OT của các kỳ **trước** trong năm.
   *
   * Giữ riêng khỏi `dong` vì cột "Tổng giờ năm" phải cộng cả các tháng đã chốt,
   * mà bảng đang áp chỉ là của kỳ này — trộn vào một chỗ thì áp lại kỳ này sẽ
   * xóa mất lũy kế của cả năm.
   */
  gio_luy_ke_nam: number;
}

/** Dòng của bảng nhân viên ở màn Tăng ca, đã cộng sẵn giờ. */
export interface TangCaNhanVienRow extends NhanVienKyLuongRow {
  /** Giờ OT của kỳ này. `null` = chưa áp tăng ca lần nào. */
  gio_thang: number | null;
  /** Lũy kế cả năm, đã gồm giờ của kỳ này. */
  gio_nam: number;
  /** Giờ quy đổi của kỳ này, sau khi nhân hệ số từng loại. */
  gio_quy_doi: number;
}

// ───────────────────── Dữ liệu tính lương › Lương sản phẩm ─────────────────────

/**
 * Một sản phẩm trong danh mục nghiệm thu — quản lý ở nút "Quản lý sản phẩm".
 *
 * Không dùng lại `KhoanLuong` loại `luong_nghiem_thu` như màn Thưởng dùng
 * `luong_thuong`: khoản lương chỉ có tên và hai cờ thuế, còn ở đây phải có **đơn
 * vị tính** và **đơn giá** thì mới nhân ra được thành tiền. Hai thứ khác nhau về
 * dữ liệu nên là hai bảng.
 */
export interface SanPham {
  ma_sp: string;
  ten_sp: string;
  /** Đơn vị tính: `cái`, `kiện`, `đơn`, `bộ`… */
  don_vi: string;
  /** Đơn giá theo bảng giá công ty; từng kỳ vẫn sửa lại được ở bảng. */
  don_gia: number;
  ghi_chu: string;
  status: TrangThai;
}

export type SanPhamFormValues = Omit<SanPham, "ma_sp">;

/** Một dòng của bảng lương sản phẩm. Thành tiền = đơn giá × số lượng, không lưu. */
export interface DongLuongSanPham {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** → `SanPham.ma_sp`. Rỗng = dòng vừa thêm, chưa chọn sản phẩm. */
  ma_sp: string;
  /**
   * Đơn giá áp cho kỳ này.
   *
   * Chép từ danh mục lúc chọn sản phẩm chứ không đọc thẳng danh mục mỗi lần
   * hiển thị: đổi bảng giá tháng sau mà số tiền đã nghiệm thu của tháng trước
   * cũng đổi theo thì bảng lương cũ không còn khớp phiếu chi.
   */
  don_gia: number;
  so_luong: number;
}

/** Bảng lương sản phẩm đã áp cho một nhân viên. */
export interface BanLuongSanPhamNhanVien {
  ma_nv: string;
  dong: DongLuongSanPham[];
}

/** Dòng của bảng nhân viên ở màn Lương sản phẩm, đã cộng sẵn tổng tiền. */
export interface LuongSanPhamNhanVienRow extends NhanVienKyLuongRow {
  /** Tổng thành tiền đã áp. `null` = chưa áp lương sản phẩm lần nào. */
  tien_luong: number | null;
  so_dong: number;
}

// ──────────────────── Dữ liệu tính lương › Lương phần trăm ────────────────────

/**
 * Một dòng của bảng lương phần trăm.
 *
 * Loại % trỏ về **Danh mục lương & phụ cấp** (`KhoanLuong` loại
 * `luong_phan_tram`) — đúng loại khoản đã có sẵn ô "Tỷ lệ mặc định" ở danh mục,
 * nên không phải dựng danh mục thứ hai.
 */
export interface DongLuongPhanTram {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** → `KhoanLuong.ma_khoan`. Rỗng = dòng vừa thêm, chưa chọn loại %. */
  ma_khoan: string;
  /**
   * Tỷ lệ áp cho kỳ này (%).
   *
   * Chép từ `KhoanLuong.ty_le` lúc chọn loại chứ không đọc thẳng danh mục mỗi
   * lần hiển thị: đổi tỷ lệ hoa hồng của quý sau mà số tiền đã chốt của quý
   * trước cũng đổi theo thì bảng lương cũ không còn khớp phiếu chi.
   */
  ty_le: number;
  /** Doanh số / số tiền làm gốc nhân tỷ lệ. */
  so_tien_co_so: number;
}

/** Bảng lương phần trăm đã áp cho một nhân viên. */
export interface BanLuongPhanTramNhanVien {
  ma_nv: string;
  dong: DongLuongPhanTram[];
}

/** Dòng của bảng nhân viên ở màn Lương phần trăm, đã cộng sẵn tổng tiền. */
export interface LuongPhanTramNhanVienRow extends NhanVienKyLuongRow {
  /** Tổng thành tiền đã áp. `null` = chưa áp lương phần trăm lần nào. */
  tien_luong: number | null;
  so_dong: number;
}

// ─────────────────── Dữ liệu tính lương › Lương chuyên cần ───────────────────

/** Cách một lỗi chuyên cần cắt vào khoản chuyên cần của nhân viên. */
export type CachTruChuyenCan =
  /** Nhân số giờ trễ/nghỉ với mức trừ mỗi giờ. */
  | "theo_gio"
  /** Trừ trọn mức, bao nhiêu giờ cũng vậy — quên chấm công, nghỉ có phép… */
  | "theo_lan"
  /** Mất trắng khoản chuyên cần của kỳ, không cần biết mức trừ. */
  | "mat_toan_bo";

/**
 * Một loại lỗi chuyên cần — quản lý ở nút "Quản lý chuyên cần".
 *
 * Không dùng lại `KhoanLuong` loại `luong_chuyen_can`: khoản kia là **số tiền
 * được hưởng**, còn đây là **lý do bị trừ**. Hai thứ ngược chiều nhau, gom một
 * bảng thì không phân biệt được cái nào cộng cái nào trừ.
 */
export interface LoaiChuyenCan {
  ma_cc: string;
  ten_cc: string;
  cach_tru: CachTruChuyenCan;
  /** Đồng/giờ với `theo_gio`, đồng/lần với `theo_lan`; `mat_toan_bo` bỏ qua. */
  muc_tru: number;
  ghi_chu: string;
  status: TrangThai;
}

export type LoaiChuyenCanFormValues = Omit<LoaiChuyenCan, "ma_cc">;

/** Một dòng của bảng chuyên cần — một lần vi phạm. */
export interface DongChuyenCan {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** → `LoaiChuyenCan.ma_cc`. Rỗng = dòng vừa thêm, chưa chọn loại. */
  ma_cc: string;
  /** Số giờ trễ/nghỉ. Chỉ có nghĩa với `theo_gio`; loại khác vẫn ghi để đối chiếu. */
  so_gio: number;
  /** `YYYY-MM-DD` — khớp thẳng `<input type="date">`. */
  ngay: string;
}

/**
 * Bảng chuyên cần đã áp cho một nhân viên.
 *
 * `dong` rỗng **khác** với chưa áp: rỗng nghĩa là kỳ này không vi phạm gì và
 * nhận đủ chuyên cần, còn chưa áp là chưa ai chốt bảng cho người đó.
 */
export interface BanChuyenCanNhanVien {
  ma_nv: string;
  dong: DongChuyenCan[];
}

/** Dòng của bảng nhân viên ở màn Lương chuyên cần. */
export interface ChuyenCanNhanVienRow extends NhanVienKyLuongRow {
  /** Mức chuyên cần được hưởng, lấy từ Set lương (hoặc Cấu trúc lương công ty). */
  don_gia: number;
  /** Tổng tiền bị trừ trong kỳ. `null` = chưa áp bảng chuyên cần. */
  tong_tru: number | null;
  /** `don_gia − tong_tru`, không xuống dưới 0. `null` = chưa áp. */
  thanh_tien: number | null;
  so_dong: number;
}

// ──────────────── Dữ liệu tính lương › Các khoản ứng - bù trừ ────────────────

/** Khoản này cắt vào lương hay cộng thêm vào lương. */
export type ChieuBuTru =
  /** Khấu trừ: tạm ứng, thu hồi tạm ứng, phạt… */
  | "tru"
  /** Bù thêm: truy lĩnh kỳ trước, bù chênh lệch bảo hiểm… */
  | "bu";

/**
 * Một khoản ứng / bù trừ — quản lý ở nút "Quản lý khoản bù trừ".
 *
 * `chieu` là thứ khiến bảng này không gộp được vào Danh mục lương & phụ cấp:
 * khoản lương luôn cộng vào thu nhập, còn ở đây phần lớn là trừ ra. Trộn chung
 * thì bảng lương không biết dấu của từng khoản.
 */
export interface KhoanBuTru {
  ma_bt: string;
  ten_bt: string;
  chieu: ChieuBuTru;
  ghi_chu: string;
  status: TrangThai;
}

export type KhoanBuTruFormValues = Omit<KhoanBuTru, "ma_bt">;

/** Một dòng của bảng ứng - bù trừ. `so_tien` luôn dương, dấu nằm ở `chieu`. */
export interface DongBuTru {
  /** Chỉ cần duy nhất trong một bảng — làm `key` và mốc sửa/xóa dòng. */
  id: string;
  /** → `KhoanBuTru.ma_bt`. Rỗng = dòng vừa thêm, chưa chọn khoản. */
  ma_bt: string;
  so_tien: number;
}

/** Bảng ứng - bù trừ đã áp cho một nhân viên. */
export interface BanBuTruNhanVien {
  ma_nv: string;
  dong: DongBuTru[];
}

/** Dòng của bảng nhân viên ở màn Các khoản ứng - bù trừ. */
export interface BuTruNhanVienRow extends NhanVienKyLuongRow {
  /**
   * Tổng khấu trừ trừ đi tổng bù. Dương = bị trừ, **âm** = được nhận thêm.
   * `null` = chưa áp bảng bù trừ.
   */
  tong_bi_tru: number | null;
  so_dong: number;
}

// ────────────────────────────── Bảng lương ──────────────────────────────

/** Đơn vị hiển thị số tiền trên bảng — 18 cột tiền để nguyên đồng thì rất khó đọc. */
export type CheDoHienThi = "dong" | "nghin" | "trieu";

/** Mức chi tiết cột: đủ 18 cột hay chỉ các cột chốt. */
export type MucChiTiet = "day_du" | "rut_gon";

/**
 * Một dòng bảng lương của một nhân viên trong kỳ.
 *
 * Mọi số ở đây đều **tính ra**, không nhập: nguồn là Set lương, Chấm công và
 * bảy màn của khu Dữ liệu tính lương. Sửa số ở đây thì kỳ sau tính lại là mất,
 * nên bảng lương chỉ để xem và xuất.
 */
export interface DongBangLuong {
  ma_nv: string;
  ho_ten: string;
  ten_pb: string;
  ten_cv: string;
  loai_hd: LoaiHopDong | null;
  kieu_luong: KieuLuong | null;
  /** Số người phụ thuộc đang trong kỳ đăng ký giảm trừ. */
  so_npt: number;

  /** Mức tháng của các khoản cố định (lương/phụ cấp + hỗ trợ) trong Set lương. */
  luong: number;
  ngay_cong: number;
  ngay_cong_chuan: number;
  gio_tang_ca: number;
  /** Giờ tăng ca sau khi nhân hệ số — số dùng để nhân đơn giá giờ. */
  gio_quy_doi: number;
  tien_tang_ca: number;
  /** Phần lương cố định sau khi quy theo ngày công thực tế. */
  luong_theo_ngay: number;
  luong_san_pham: number;
  thuong: number;
  kpi: number;
  /** Hoa hồng — gộp vào "Thu nhập", không có cột riêng. */
  luong_phan_tram: number;
  /** Chuyên cần còn lại sau khi trừ vi phạm — gộp vào "Thu nhập". */
  chuyen_can: number;

  thu_nhap: number;
  /** Phần thu nhập chịu thuế TNCN (đã bỏ các khoản miễn thuế). */
  thu_nhap_chiu_thue: number;
  /** Gốc đóng bảo hiểm, lấy từ hợp đồng hiện hành. */
  luong_bhxh: number;
  /** Bảo hiểm **nhân viên** đóng — khoản bị trừ vào lương. */
  bao_hiem: number;
  /** Bảo hiểm **công ty** đóng — không trừ vào lương, chỉ vào quỹ lương. */
  bao_hiem_ct: number;
  /** Đoàn phí nhân viên đóng. */
  cong_doan: number;
  /** Kinh phí công đoàn công ty nộp — chi phí của công ty. */
  kpcd_ct: number;
  /** Dương = bị trừ, âm = được nhận thêm. */
  bu_tru: number;
  thue_tncn: number;
  thuc_linh: number;
  /** Tổng chi phí công ty bỏ ra cho người này trong kỳ. */
  quy_luong: number;
}

/** Bộ lọc của bảng lương. */
export interface BangLuongFilters {
  q: string;
  ma_pb: string;
  loai_hd: LoaiHopDong | "";
  kieu_luong: KieuLuong | "";
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

/**
 * Danh sách chọn dùng chung của khu HRM.
 *
 * Gom một chỗ để mã lưu xuống DB và nhãn hiển thị không bao giờ lệch nhau giữa
 * form và bảng. Khi nối API thật, Zod ở backend phải liệt kê **đúng** các mã
 * này — lệch một giá trị thì request bị 400 mà người dùng chỉ thấy lỗi chung.
 */

import type {
  CachTruChuyenCan,
  ChieuBuTru,
  ChinhSachNgay,
  GioiTinh,
  KieuLuong,
  LoaiCong,
  LoaiHopDong,
  LoaiKhoanLuong,
  LoaiNgayLe,
  LoaiTaiLieu,
  LoaiTangCa,
  PhamViApDung,
  PhanLoaiThue,
  TieuThucTinh,
  PhuongPhapNgayCong,
  QuanHe,
  TrangThai,
} from "./types";

export interface LuaChon<T extends string> {
  value: T;
  label: string;
}

export const GIOI_TINH: LuaChon<GioiTinh>[] = [
  { value: "nam", label: "Nam" },
  { value: "nu", label: "Nữ" },
  { value: "khac", label: "Khác" },
];

export const QUAN_HE: LuaChon<QuanHe>[] = [
  { value: "con", label: "Con" },
  { value: "vo_chong", label: "Vợ/Chồng" },
  { value: "cha", label: "Cha" },
  { value: "me", label: "Mẹ" },
  { value: "anh_chi_em", label: "Anh/Chị/Em ruột" },
  { value: "ong_ba", label: "Ông/Bà" },
  { value: "chau", label: "Cháu" },
  { value: "khac", label: "Khác" },
];

export const LOAI_HD: LuaChon<LoaiHopDong>[] = [
  { value: "khong_xac_dinh", label: "Không xác định thời hạn" },
  { value: "xac_dinh", label: "Xác định thời hạn" },
  { value: "thu_viec", label: "Thử việc" },
  { value: "thoi_vu", label: "Thời vụ" },
  { value: "khoan", label: "Khoán việc" },
];

export const KIEU_LUONG: LuaChon<KieuLuong>[] = [
  { value: "GROSS", label: "GROSS — nhân viên tự đóng thuế" },
  { value: "NET", label: "NET — công ty đóng thuế" },
];

export const LOAI_TAI_LIEU: LuaChon<LoaiTaiLieu>[] = [
  { value: "cccd", label: "CCCD/CMND" },
  { value: "ho_chieu", label: "Hộ chiếu" },
  { value: "bang_cap", label: "Bằng cấp" },
  { value: "chung_chi", label: "Chứng chỉ" },
  { value: "so_yeu_ly_lich", label: "Sơ yếu lý lịch" },
];

export const TRANG_THAI_PB: LuaChon<TrangThai>[] = [
  { value: "1", label: "Đang dùng" },
  { value: "0", label: "Ngừng" },
];

export const TRANG_THAI_NV: LuaChon<TrangThai>[] = [
  { value: "1", label: "Đang làm" },
  { value: "0", label: "Đã nghỉ" },
];

/**
 * Chức vụ — pha hardcode để là hằng số. Khi nối backend thì đây thành danh mục
 * `hrm_chuc_vu` có màn hình nhập liệu riêng; mã `CV..` giữ nguyên nên dữ liệu
 * nhân viên không phải sửa.
 */
export const CHUC_VU: LuaChon<string>[] = [
  { value: "CV01", label: "Giám đốc" },
  { value: "CV02", label: "Phó giám đốc" },
  { value: "CV03", label: "Trưởng phòng" },
  { value: "CV04", label: "Phó phòng" },
  { value: "CV05", label: "Kế toán trưởng" },
  { value: "CV06", label: "Kế toán viên" },
  { value: "CV07", label: "Nhân viên kinh doanh" },
  { value: "CV08", label: "Nhân viên hành chính" },
  { value: "CV09", label: "Lập trình viên" },
  { value: "CV10", label: "Nhân viên" },
];

/** Ngân hàng phổ biến — ô nhập cho phép gõ tự do ngoài danh sách này. */
export const NGAN_HANG_VN: string[] = [
  "Vietcombank",
  "VietinBank",
  "BIDV",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "VPBank",
  "Sacombank",
  "TPBank",
  "HDBank",
  "VIB",
  "SHB",
  "SeABank",
  "MSB",
  "OCB",
  "Eximbank",
  "LPBank",
  "Nam A Bank",
  "BVBank",
];

/**
 * Giá trị riêng của ô lọc phòng ban, nghĩa là "chưa gán phòng ban".
 * Không dùng chuỗi rỗng vì rỗng đã mang nghĩa "tất cả phòng ban".
 */
export const PB_CHUA_GAN = "__chua_gan__";

export const PHUONG_PHAP_NGAY_CONG: LuaChon<PhuongPhapNgayCong>[] = [
  { value: "co_dinh_26", label: "Cố định 26 ngày/tháng" },
  { value: "co_dinh_24", label: "Cố định 24 ngày/tháng" },
  { value: "theo_thang", label: "Theo số ngày làm việc thực tế của tháng" },
];

export const CHINH_SACH_NGAY: LuaChon<ChinhSachNgay>[] = [
  { value: "lam_ca_ngay", label: "Làm cả ngày" },
  { value: "lam_nua_ngay", label: "Làm nửa ngày" },
  { value: "nghi", label: "Nghỉ" },
];

/**
 * Mô tả bảy loại khoản lương.
 *
 * Gom vào một bảng mô tả thay vì viết bảy dialog: các loại chỉ khác nhau ở nhãn
 * và ở chỗ có hiện ô "Tính vào lương đóng BHXH" / ô tỷ lệ hay không. Một dialog
 * đọc bảng này ra là đủ, và thêm loại thứ tám chỉ phải thêm một dòng ở đây.
 */
export interface MoTaLoaiKhoan {
  value: LoaiKhoanLuong;
  /** Nhãn ngắn hiện ở cột "Loại" của bảng. */
  label: string;
  /** Nhãn rất ngắn cho chip đứng cạnh tên khoản ở bảng cấu trúc lương. */
  nhanNgan: string;
  /** Nhãn nút ở cột "Tạo danh mục" bên trái. */
  nhanNut: string;
  /** Nhãn ô nhập tên trong dialog. */
  nhanTen: string;
  /** Ô ghi chú của loại này gọi là "Ghi chú" hay "Mô tả". */
  nhanGhiChu: string;
  moTa: string;
  /** Có hiện ô tích "Tính vào lương đóng BHXH" không. */
  coBhxh: boolean;
  /** Có hiện ô nhập tỷ lệ phần trăm không. */
  coTyLe: boolean;
  macDinhBhxh: boolean;
  macDinhTncn: boolean;
}

export const LOAI_KHOAN_LUONG: MoTaLoaiKhoan[] = [
  {
    value: "luong_phu_cap",
    nhanNgan: "Phụ cấp",
    label: "Lương/Phụ cấp",
    nhanNut: "Tạo lương/phụ cấp",
    nhanTen: "Tên khoản lương phụ cấp",
    nhanGhiChu: "Ghi chú",
    moTa: "Khoản trả cố định hằng tháng theo hợp đồng.",
    coBhxh: true,
    coTyLe: false,
    macDinhBhxh: true,
    macDinhTncn: true,
  },
  {
    value: "luong_ho_tro",
    nhanNgan: "Hỗ trợ",
    label: "Lương hỗ trợ",
    nhanNut: "Tạo lương hỗ trợ",
    nhanTen: "Tên khoản lương hỗ trợ",
    nhanGhiChu: "Mô tả",
    moTa: "Hỗ trợ ăn ca, xăng xe, điện thoại — không vào gốc đóng BHXH.",
    coBhxh: false,
    coTyLe: false,
    macDinhBhxh: false,
    macDinhTncn: true,
  },
  {
    value: "luong_nghiem_thu",
    nhanNgan: "Nghiệm thu",
    label: "Lương nghiệm thu",
    nhanNut: "Tạo lương nghiệm thu",
    nhanTen: "Tên khoản lương nghiệm thu",
    nhanGhiChu: "Ghi chú",
    moTa: "Trả theo khối lượng công việc đã nghiệm thu.",
    coBhxh: true,
    coTyLe: false,
    macDinhBhxh: true,
    macDinhTncn: true,
  },
  {
    value: "luong_phan_tram",
    nhanNgan: "Phần trăm",
    label: "Lương phần trăm",
    nhanNut: "Tạo lương phần trăm",
    nhanTen: "Tên khoản lương phần trăm",
    nhanGhiChu: "Ghi chú",
    moTa: "Hoa hồng tính theo tỷ lệ trên doanh số.",
    coBhxh: true,
    coTyLe: true,
    macDinhBhxh: false,
    macDinhTncn: true,
  },
  {
    value: "luong_kpi",
    nhanNgan: "KPI",
    label: "Lương KPI",
    nhanNut: "Tạo lương KPI",
    nhanTen: "Tên khoản lương KPI",
    nhanGhiChu: "Ghi chú",
    moTa: "Trả theo mức hoàn thành chỉ tiêu.",
    coBhxh: true,
    coTyLe: false,
    macDinhBhxh: false,
    macDinhTncn: true,
  },
  {
    value: "luong_thuong",
    nhanNgan: "Thưởng",
    label: "Lương thưởng",
    nhanNut: "Tạo lương thưởng",
    nhanTen: "Tên khoản lương thưởng",
    nhanGhiChu: "Ghi chú",
    moTa: "Thưởng lễ, tết, thành tích — trả không định kỳ.",
    coBhxh: true,
    coTyLe: false,
    macDinhBhxh: false,
    macDinhTncn: true,
  },
  {
    value: "luong_chuyen_can",
    nhanNgan: "Chuyên cần",
    label: "Lương chuyên cần",
    nhanNut: "Tạo lương chuyên cần",
    nhanTen: "Tên khoản lương chuyên cần",
    nhanGhiChu: "Ghi chú",
    moTa: "Trả khi đi làm đủ công, không nghỉ không phép.",
    coBhxh: true,
    coTyLe: false,
    macDinhBhxh: false,
    macDinhTncn: true,
  },
];

export function moTaLoaiKhoan(loai: LoaiKhoanLuong): MoTaLoaiKhoan {
  // Loại lạ (dữ liệu cũ, hoặc mã gõ tay) vẫn phải render được — rơi về loại đầu.
  return LOAI_KHOAN_LUONG.find((item) => item.value === loai) ?? LOAI_KHOAN_LUONG[0]!;
}

export const PHAN_LOAI_THUE: LuaChon<PhanLoaiThue>[] = [
  { value: "tncn", label: "TNCN" },
  { value: "mien_thue", label: "Miễn thuế" },
];

export const TIEU_THUC_TINH: LuaChon<TieuThucTinh>[] = [
  { value: "co_dinh_thang", label: "Cố định theo tháng" },
  { value: "theo_ngay_cong", label: "Theo ngày công thực tế" },
  { value: "theo_gio_cong", label: "Theo giờ công" },
  { value: "theo_san_luong", label: "Theo sản lượng nghiệm thu" },
  { value: "theo_doanh_so", label: "Theo doanh số (%)" },
  { value: "theo_kpi", label: "Theo mức hoàn thành KPI" },
  { value: "nhap_tay", label: "Nhập tay từng kỳ" },
];

export const TRANG_THAI_SET_LUONG = [
  { value: "nhap", label: "Nháp" },
  { value: "cho_duyet", label: "Chờ duyệt" },
  { value: "da_duyet", label: "Đã duyệt" },
] as const;

/**
 * Tám loại công của một ô chấm công.
 *
 * `phim` là phím tắt bấm được khi popover đang mở — chấm công cả tháng cho vài
 * chục người mà phải rê chuột từng ô thì quá chậm.
 */
export interface MoTaLoaiCong {
  value: LoaiCong;
  /** Ký hiệu hiện trong ô của bảng. */
  kyHieu: string;
  label: string;
  phim: string;
  mau: "success" | "info" | "primary" | "warning" | "error" | "default";
  /** Có cộng vào cột "Ngày công thực tế" không. */
  tinhCong: boolean;
  /** Công quy đổi khi không nhập số giờ cụ thể. */
  congMacDinh: number;
}

export const LOAI_CONG: MoTaLoaiCong[] = [
  { value: "lam_viec", kyHieu: "1", label: "Làm việc", phim: "1", mau: "success", tinhCong: true, congMacDinh: 1 },
  { value: "nua_ngay", kyHieu: "1/2", label: "Nửa ngày", phim: "2", mau: "success", tinhCong: true, congMacDinh: 0.5 },
  { value: "cong_tac", kyHieu: "CT", label: "Công tác", phim: "3", mau: "info", tinhCong: false, congMacDinh: 0 },
  { value: "nghi_phep", kyHieu: "P", label: "Nghỉ phép", phim: "4", mau: "primary", tinhCong: false, congMacDinh: 0 },
  { value: "nghi_le", kyHieu: "NL", label: "Nghỉ lễ", phim: "5", mau: "warning", tinhCong: false, congMacDinh: 0 },
  { value: "om", kyHieu: "O", label: "Ốm", phim: "6", mau: "warning", tinhCong: false, congMacDinh: 0 },
  { value: "khong_luong", kyHieu: "X", label: "Không lương", phim: "7", mau: "error", tinhCong: false, congMacDinh: 0 },
  { value: "khac", kyHieu: "K", label: "Khác", phim: "8", mau: "default", tinhCong: false, congMacDinh: 0 },
];

export function moTaLoaiCong(loai: LoaiCong): MoTaLoaiCong {
  return LOAI_CONG.find((item) => item.value === loai) ?? LOAI_CONG[0]!;
}

/** Các loại có cột thống kê riêng trên bảng chấm công, đúng thứ tự cột. */
export const COT_THONG_KE_CONG: LoaiCong[] = [
  "cong_tac",
  "nghi_phep",
  "om",
  "khong_luong",
  "khac",
];

/**
 * Ba phạm vi áp bảng, dùng chung cho các màn hình của khu "Dữ liệu tính lương".
 *
 * `moTa` giải thích bảng đang soạn sẽ áp cho ai — một lần bấm "Áp dụng" là ghi
 * đè bảng của cả danh sách, nên phải nói trước.
 */
export const PHAM_VI_AP_DUNG: (LuaChon<PhamViApDung> & { moTa: string })[] = [
  {
    value: "nhan_vien",
    label: "Nhân viên",
    moTa: "Áp cho những nhân viên đang lọc ra ở danh sách bên dưới.",
  },
  {
    value: "phong_ban",
    label: "Phòng ban",
    moTa: "Áp cho toàn bộ nhân viên đang làm của phòng ban đã chọn.",
  },
  {
    value: "toan_cong_ty",
    label: "Toàn công ty",
    moTa: "Áp cho toàn bộ nhân viên đang làm — bỏ qua bộ lọc phòng ban và loại HĐ.",
  },
];

/**
 * Sáu loại giờ tăng ca, kèm tên trường hệ số tương ứng ở Cấu hình mặc định.
 *
 * `truong` liệt kê thẳng sáu khóa thay vì `keyof CauHinhMacDinh`: kiểu hẹp lại
 * như vậy thì `cauHinh[truong]` chắc chắn là số, không lỡ trỏ vào `bac_thue`.
 */
export interface MoTaLoaiTangCa {
  value: LoaiTangCa;
  label: string;
  truong:
    | "tc_ngay_thuong_ngay"
    | "tc_ngay_thuong_dem"
    | "tc_chu_nhat_ngay"
    | "tc_chu_nhat_dem"
    | "tc_ngay_le_ngay"
    | "tc_ngay_le_dem";
}

export const LOAI_TANG_CA: MoTaLoaiTangCa[] = [
  { value: "ngay_thuong_ngay", label: "Ngày thường — ban ngày", truong: "tc_ngay_thuong_ngay" },
  { value: "ngay_thuong_dem", label: "Ngày thường — ban đêm", truong: "tc_ngay_thuong_dem" },
  { value: "chu_nhat_ngay", label: "Chủ nhật — ban ngày", truong: "tc_chu_nhat_ngay" },
  { value: "chu_nhat_dem", label: "Chủ nhật — ban đêm", truong: "tc_chu_nhat_dem" },
  { value: "ngay_le_ngay", label: "Ngày lễ — ban ngày", truong: "tc_ngay_le_ngay" },
  { value: "ngay_le_dem", label: "Ngày lễ — ban đêm", truong: "tc_ngay_le_dem" },
];

export function moTaLoaiTangCa(loai: LoaiTangCa): MoTaLoaiTangCa {
  // Loại lạ (dữ liệu cũ, hoặc mã gõ tay) vẫn phải render được — rơi về loại đầu.
  return LOAI_TANG_CA.find((item) => item.value === loai) ?? LOAI_TANG_CA[0]!;
}

/**
 * Ba cách trừ chuyên cần.
 *
 * `donVi` là hậu tố của ô "Mức trừ" trong dialog quản lý — rỗng nghĩa là loại đó
 * không dùng tới mức trừ, dialog ẩn luôn ô đi.
 */
export const CACH_TRU_CHUYEN_CAN: (LuaChon<CachTruChuyenCan> & { donVi: string })[] = [
  { value: "theo_gio", label: "Trừ theo giờ", donVi: "₫/giờ" },
  { value: "theo_lan", label: "Trừ trọn mức mỗi lần", donVi: "₫/lần" },
  { value: "mat_toan_bo", label: "Mất toàn bộ chuyên cần", donVi: "" },
];

export function moTaCachTru(cach: CachTruChuyenCan) {
  // Cách lạ (dữ liệu cũ, hoặc mã gõ tay) vẫn phải render được — rơi về cách đầu.
  return CACH_TRU_CHUYEN_CAN.find((item) => item.value === cach) ?? CACH_TRU_CHUYEN_CAN[0]!;
}

/** Hai chiều của khoản ứng - bù trừ, kèm màu dùng ở chip và cột tiền. */
export const CHIEU_BU_TRU: (LuaChon<ChieuBuTru> & { mau: "error" | "success" })[] = [
  { value: "tru", label: "Trừ vào lương", mau: "error" },
  { value: "bu", label: "Bù thêm vào lương", mau: "success" },
];

export function moTaChieuBuTru(chieu: ChieuBuTru) {
  // Chiều lạ (dữ liệu cũ, hoặc mã gõ tay) vẫn phải render được — rơi về "trừ".
  return CHIEU_BU_TRU.find((item) => item.value === chieu) ?? CHIEU_BU_TRU[0]!;
}

export const LOAI_NGAY_LE: LuaChon<LoaiNgayLe>[] = [
  { value: "le_duong_lich", label: "Lễ theo dương lịch" },
  { value: "le_am_lich", label: "Lễ theo âm lịch" },
  { value: "nghi_bu", label: "Nghỉ bù" },
  { value: "le_cong_ty", label: "Lễ riêng của công ty" },
];

/** Nhãn của 5 bậc thuế — bậc 1 và bậc cuối đọc khác các bậc giữa. */
export const NHAN_BAC_THUE = [
  "Bậc 1: Mức chịu thuế tối đa",
  "Bậc 2: Khoảng chịu thuế",
  "Bậc 3: Khoảng chịu thuế",
  "Bậc 4: Khoảng chịu thuế",
  "Bậc 5: Phần vượt bậc 4",
];

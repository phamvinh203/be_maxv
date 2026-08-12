/**
 * Dữ liệu mẫu của khu HRM — pha dựng giao diện, chưa nối backend.
 *
 * Cố ý cài sẵn các trường hợp biên để bấm thử là thấy ngay:
 * - `NV0011` chưa gán phòng ban → thử bộ lọc "Chưa có phòng ban" của Gán nhanh.
 * - `NV0012` đã nghỉ → thử dòng hiển thị mờ và bộ lọc trạng thái.
 * - `NV0003` có hai đời hợp đồng (thử việc đã hết hạn + chính thức) → thử luật
 *   chọn hợp đồng hiện hành.
 * - `NPT005` đã hết kỳ đăng ký giảm trừ → cột "ĐK giảm trừ" có cả hai dạng.
 * - `PB01` không có phòng ban con nhưng còn nhân viên → thử chặn xóa.
 */

import { ngayLeChuanVN } from "../ngayLeChuan";
import type {
  CaLamViec,
  CauHinhMacDinh,
  CauTrucLuong,
  HopDong,
  KhoanLuong,
  NgayLe,
  NguoiPhuThuoc,
  NhanVien,
  PhongBan,
  SetLuongNhanVien,
  TaiLieu,
} from "../types";

export const PHONG_BAN_MAU: PhongBan[] = [
  { ma_pb: "PB01", ten_pb: "Ban giám đốc", ma_pb_me: null, ghi_chu: "Ban điều hành công ty", status: "1" },
  { ma_pb: "PB02", ten_pb: "Khối kinh doanh", ma_pb_me: null, ghi_chu: "", status: "1" },
  { ma_pb: "PB02.01", ten_pb: "Phòng Kinh doanh 1", ma_pb_me: "PB02", ghi_chu: "Khách hàng doanh nghiệp", status: "1" },
  { ma_pb: "PB02.02", ten_pb: "Phòng Kinh doanh 2", ma_pb_me: "PB02", ghi_chu: "Khách hàng cá nhân", status: "1" },
  { ma_pb: "PB03", ten_pb: "Khối hỗ trợ", ma_pb_me: null, ghi_chu: "", status: "1" },
  { ma_pb: "PB03.01", ten_pb: "Phòng Kế toán", ma_pb_me: "PB03", ghi_chu: "", status: "1" },
  { ma_pb: "PB03.02", ten_pb: "Phòng Nhân sự", ma_pb_me: "PB03", ghi_chu: "", status: "1" },
  { ma_pb: "PB03.03", ten_pb: "Phòng Công nghệ thông tin", ma_pb_me: "PB03", ghi_chu: "", status: "1" },
];

export const NHAN_VIEN_MAU: NhanVien[] = [
  {
    ma_nv: "NV0001", ho_ten: "Nguyễn Văn Hùng", so_cccd: "001085001234", mst_ca_nhan: "8012345678",
    ngay_sinh: "1985-04-12", gioi_tinh: "nam", dien_thoai: "0912345678", email: "hung.nv@maxv.vn",
    dia_chi: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội", ghi_chu: "",
    ma_pb: "PB01", ma_cv: "CV01", cap_bac: "C-level", cong_doan: false, ngay_vao: "2019-03-01",
    ngan_hang: "Vietcombank", so_tk: "0011004567890", chu_tk: "NGUYEN VAN HUNG", status: "1",
  },
  {
    ma_nv: "NV0002", ho_ten: "Trần Thị Mai", so_cccd: "001188002345", mst_ca_nhan: "8023456789",
    ngay_sinh: "1988-09-30", gioi_tinh: "nu", dien_thoai: "0987654321", email: "mai.tt@maxv.vn",
    dia_chi: "45 Lê Lợi, Hoàn Kiếm, Hà Nội", ghi_chu: "",
    ma_pb: "PB01", ma_cv: "CV02", cap_bac: "C-level", cong_doan: false, ngay_vao: "2020-06-15",
    ngan_hang: "Techcombank", so_tk: "19035678901234", chu_tk: "TRAN THI MAI", status: "1",
  },
  {
    ma_nv: "NV0003", ho_ten: "Lê Minh Quân", so_cccd: "001090003456", mst_ca_nhan: "8034567890",
    ngay_sinh: "1990-01-20", gioi_tinh: "nam", dien_thoai: "0903112233", email: "quan.lm@maxv.vn",
    dia_chi: "78 Trần Hưng Đạo, Hai Bà Trưng, Hà Nội", ghi_chu: "",
    ma_pb: "PB02.01", ma_cv: "CV03", cap_bac: "Quản lý cấp trung", cong_doan: true, ngay_vao: "2021-02-01",
    ngan_hang: "BIDV", so_tk: "21010001234567", chu_tk: "LE MINH QUAN", status: "1",
  },
  {
    ma_nv: "NV0004", ho_ten: "Phạm Thu Hà", so_cccd: "001193004567", mst_ca_nhan: "8045678901",
    ngay_sinh: "1993-07-08", gioi_tinh: "nu", dien_thoai: "0934556677", email: "ha.pt@maxv.vn",
    dia_chi: "9 Ngõ 100 Cầu Giấy, Hà Nội", ghi_chu: "",
    ma_pb: "PB02.01", ma_cv: "CV07", cap_bac: "Nhân viên chính", cong_doan: true, ngay_vao: "2022-05-16",
    ngan_hang: "MB Bank", so_tk: "0001234567899", chu_tk: "PHAM THU HA", status: "1",
  },
  {
    ma_nv: "NV0005", ho_ten: "Đỗ Văn Thành", so_cccd: "001087005678", mst_ca_nhan: "8056789012",
    ngay_sinh: "1987-11-25", gioi_tinh: "nam", dien_thoai: "0977889900", email: "thanh.dv@maxv.vn",
    dia_chi: "234 Giải Phóng, Hoàng Mai, Hà Nội", ghi_chu: "",
    ma_pb: "PB02.02", ma_cv: "CV03", cap_bac: "Quản lý cấp trung", cong_doan: false, ngay_vao: "2020-09-01",
    ngan_hang: "VPBank", so_tk: "192837465500", chu_tk: "DO VAN THANH", status: "1",
  },
  {
    ma_nv: "NV0006", ho_ten: "Vũ Thị Ngọc", so_cccd: "001195006789", mst_ca_nhan: "8067890123",
    ngay_sinh: "1995-03-14", gioi_tinh: "nu", dien_thoai: "0965443322", email: "ngoc.vt@maxv.vn",
    dia_chi: "56 Kim Mã, Ba Đình, Hà Nội", ghi_chu: "",
    ma_pb: "PB02.02", ma_cv: "CV07", cap_bac: "Nhân viên", cong_doan: true, ngay_vao: "2023-01-09",
    ngan_hang: "ACB", so_tk: "2468013579", chu_tk: "VU THI NGOC", status: "1",
  },
  {
    ma_nv: "NV0007", ho_ten: "Hoàng Anh Tuấn", so_cccd: "001086007890", mst_ca_nhan: "8078901234",
    ngay_sinh: "1986-06-02", gioi_tinh: "nam", dien_thoai: "0918273645", email: "tuan.ha@maxv.vn",
    dia_chi: "17 Tôn Đức Thắng, Đống Đa, Hà Nội", ghi_chu: "Kiêm phụ trách thuế",
    ma_pb: "PB03.01", ma_cv: "CV05", cap_bac: "Quản lý cấp trung", cong_doan: true, ngay_vao: "2019-08-01",
    ngan_hang: "Vietcombank", so_tk: "0011009876543", chu_tk: "HOANG ANH TUAN", status: "1",
  },
  {
    ma_nv: "NV0008", ho_ten: "Bùi Thị Lan", so_cccd: "001194008901", mst_ca_nhan: "8089012345",
    ngay_sinh: "1994-12-19", gioi_tinh: "nu", dien_thoai: "0946372819", email: "lan.bt@maxv.vn",
    dia_chi: "88 Nguyễn Chí Thanh, Đống Đa, Hà Nội", ghi_chu: "",
    ma_pb: "PB03.01", ma_cv: "CV06", cap_bac: "Nhân viên", cong_doan: false, ngay_vao: "2023-04-03",
    ngan_hang: "Sacombank", so_tk: "060012345678", chu_tk: "BUI THI LAN", status: "1",
  },
  {
    ma_nv: "NV0009", ho_ten: "Đặng Quốc Bảo", so_cccd: "001089009012", mst_ca_nhan: "8090123456",
    ngay_sinh: "1989-02-27", gioi_tinh: "nam", dien_thoai: "0902938475", email: "bao.dq@maxv.vn",
    dia_chi: "301 Trường Chinh, Thanh Xuân, Hà Nội", ghi_chu: "",
    ma_pb: "PB03.02", ma_cv: "CV03", cap_bac: "Quản lý cấp trung", cong_doan: true, ngay_vao: "2021-07-12",
    ngan_hang: "TPBank", so_tk: "0339988776655", chu_tk: "DANG QUOC BAO", status: "1",
  },
  {
    ma_nv: "NV0010", ho_ten: "Ngô Thị Hương", so_cccd: "001196010123", mst_ca_nhan: "8101234567",
    ngay_sinh: "1996-08-05", gioi_tinh: "nu", dien_thoai: "0923456781", email: "huong.nt@maxv.vn",
    dia_chi: "5 Duy Tân, Cầu Giấy, Hà Nội", ghi_chu: "",
    ma_pb: "PB03.03", ma_cv: "CV09", cap_bac: "Nhân viên chính", cong_doan: false, ngay_vao: "2022-11-21",
    ngan_hang: "Techcombank", so_tk: "19087654321098", chu_tk: "NGO THI HUONG", status: "1",
  },
  {
    ma_nv: "NV0011", ho_ten: "Trịnh Văn Sơn", so_cccd: "001199011234", mst_ca_nhan: "",
    ngay_sinh: "1999-10-10", gioi_tinh: "nam", dien_thoai: "0956789012", email: "son.tv@maxv.vn",
    dia_chi: "22 Lạc Long Quân, Tây Hồ, Hà Nội", ghi_chu: "Mới tuyển, chưa phân phòng ban",
    ma_pb: null, ma_cv: "CV10", cap_bac: "", cong_doan: false, ngay_vao: "2026-08-03",
    ngan_hang: "", so_tk: "", chu_tk: "", status: "1",
  },
  {
    ma_nv: "NV0012", ho_ten: "Lý Thị Bích", so_cccd: "001192012345", mst_ca_nhan: "8112345678",
    ngay_sinh: "1992-05-17", gioi_tinh: "nu", dien_thoai: "0938475612", email: "bich.lt@maxv.vn",
    dia_chi: "140 Xuân Thủy, Cầu Giấy, Hà Nội", ghi_chu: "Nghỉ việc từ 30/06/2026",
    ma_pb: "PB02.01", ma_cv: "CV07", cap_bac: "Nhân viên", cong_doan: false, ngay_vao: "2022-03-07",
    ngan_hang: "VIB", so_tk: "601234567890", chu_tk: "LY THI BICH", status: "0",
  },
];

export const HOP_DONG_MAU: HopDong[] = [
  { id: "HD001", ma_nv: "NV0001", so_hd: "HĐLĐ-2019/001", loai_hd: "khong_xac_dinh", kieu_luong: "NET", luong_chinh: 60000000, luong_bhxh: 36000000, ngay_bat_dau: "2019-03-01", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD002", ma_nv: "NV0002", so_hd: "HĐLĐ-2020/014", loai_hd: "khong_xac_dinh", kieu_luong: "GROSS", luong_chinh: 45000000, luong_bhxh: 30000000, ngay_bat_dau: "2020-06-15", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  // Hai đời hợp đồng: thử việc đã hết hạn rồi lên chính thức.
  { id: "HD003", ma_nv: "NV0003", so_hd: "HĐTV-2021/003", loai_hd: "thu_viec", kieu_luong: "GROSS", luong_chinh: 16000000, luong_bhxh: 0, ngay_bat_dau: "2021-02-01", ngay_ket_thuc: "2021-03-31", trich_bhxh: false, tinh_tncn: true, ghi_chu: "Thử việc 2 tháng" },
  { id: "HD004", ma_nv: "NV0003", so_hd: "HĐLĐ-2021/021", loai_hd: "khong_xac_dinh", kieu_luong: "GROSS", luong_chinh: 28000000, luong_bhxh: 20000000, ngay_bat_dau: "2021-04-01", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD005", ma_nv: "NV0004", so_hd: "HĐLĐ-2022/045", loai_hd: "xac_dinh", kieu_luong: "GROSS", luong_chinh: 18000000, luong_bhxh: 15000000, ngay_bat_dau: "2025-05-16", ngay_ket_thuc: "2027-05-15", trich_bhxh: true, tinh_tncn: true, ghi_chu: "Gia hạn lần 1" },
  { id: "HD006", ma_nv: "NV0005", so_hd: "HĐLĐ-2020/030", loai_hd: "khong_xac_dinh", kieu_luong: "GROSS", luong_chinh: 27000000, luong_bhxh: 20000000, ngay_bat_dau: "2020-09-01", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD007", ma_nv: "NV0006", so_hd: "HĐLĐ-2023/002", loai_hd: "xac_dinh", kieu_luong: "NET", luong_chinh: 15000000, luong_bhxh: 13000000, ngay_bat_dau: "2025-01-09", ngay_ket_thuc: "2027-01-08", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD008", ma_nv: "NV0007", so_hd: "HĐLĐ-2019/019", loai_hd: "khong_xac_dinh", kieu_luong: "GROSS", luong_chinh: 32000000, luong_bhxh: 24000000, ngay_bat_dau: "2019-08-01", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD009", ma_nv: "NV0008", so_hd: "HĐLĐ-2023/018", loai_hd: "xac_dinh", kieu_luong: "GROSS", luong_chinh: 14000000, luong_bhxh: 12000000, ngay_bat_dau: "2025-04-03", ngay_ket_thuc: "2027-04-02", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD010", ma_nv: "NV0009", so_hd: "HĐLĐ-2021/033", loai_hd: "khong_xac_dinh", kieu_luong: "GROSS", luong_chinh: 26000000, luong_bhxh: 20000000, ngay_bat_dau: "2021-07-12", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD011", ma_nv: "NV0010", so_hd: "HĐLĐ-2022/061", loai_hd: "khong_xac_dinh", kieu_luong: "NET", luong_chinh: 25000000, luong_bhxh: 18000000, ngay_bat_dau: "2022-11-21", ngay_ket_thuc: "", trich_bhxh: true, tinh_tncn: true, ghi_chu: "" },
  { id: "HD012", ma_nv: "NV0011", so_hd: "HĐTV-2026/007", loai_hd: "thu_viec", kieu_luong: "GROSS", luong_chinh: 12000000, luong_bhxh: 0, ngay_bat_dau: "2026-08-03", ngay_ket_thuc: "2026-10-02", trich_bhxh: false, tinh_tncn: true, ghi_chu: "Thử việc 2 tháng" },
  // Đã hết hạn và không ký tiếp — bảng vẫn phải hiện hợp đồng gần nhất.
  { id: "HD013", ma_nv: "NV0012", so_hd: "HĐLĐ-2022/012", loai_hd: "xac_dinh", kieu_luong: "GROSS", luong_chinh: 16000000, luong_bhxh: 14000000, ngay_bat_dau: "2024-03-07", ngay_ket_thuc: "2026-06-30", trich_bhxh: true, tinh_tncn: true, ghi_chu: "Chấm dứt theo thỏa thuận" },
];

export const TAI_LIEU_MAU: TaiLieu[] = [
  { id: "TL001", ma_nv: "NV0001", loai: "cccd", so_hieu: "001085001234", ngay_cap: "2021-06-10", noi_cap: "Cục Cảnh sát QLHC về TTXH", ghi_chu: "" },
  { id: "TL002", ma_nv: "NV0001", loai: "bang_cap", so_hieu: "ĐHKTQD-2007-1123", ngay_cap: "2007-07-01", noi_cap: "Đại học Kinh tế Quốc dân", ghi_chu: "Cử nhân Quản trị kinh doanh" },
  { id: "TL003", ma_nv: "NV0003", loai: "cccd", so_hieu: "001090003456", ngay_cap: "2022-01-18", noi_cap: "Cục Cảnh sát QLHC về TTXH", ghi_chu: "" },
  { id: "TL004", ma_nv: "NV0007", loai: "chung_chi", so_hieu: "KTV-2018-0456", ngay_cap: "2018-11-20", noi_cap: "Bộ Tài chính", ghi_chu: "Chứng chỉ hành nghề kế toán" },
  { id: "TL005", ma_nv: "NV0010", loai: "so_yeu_ly_lich", so_hieu: "", ngay_cap: "2022-11-15", noi_cap: "UBND phường Dịch Vọng", ghi_chu: "Có xác nhận địa phương" },
];

export const NGUOI_PHU_THUOC_MAU: NguoiPhuThuoc[] = [
  { id: "NPT001", ma_nv: "NV0001", ho_ten: "Nguyễn Minh Khôi", quan_he: "con", ngay_sinh: "2015-09-02", so_cccd: "", mst_ca_nhan: "", dien_thoai: "", dia_chi: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội", gt_tu_thang: "2021-01", gt_den_thang: "" },
  { id: "NPT002", ma_nv: "NV0001", ho_ten: "Nguyễn Ngọc Diệp", quan_he: "con", ngay_sinh: "2019-04-25", so_cccd: "", mst_ca_nhan: "", dien_thoai: "", dia_chi: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội", gt_tu_thang: "2022-06", gt_den_thang: "" },
  { id: "NPT003", ma_nv: "NV0003", ho_ten: "Lê Bảo An", quan_he: "con", ngay_sinh: "2018-12-11", so_cccd: "", mst_ca_nhan: "", dien_thoai: "", dia_chi: "78 Trần Hưng Đạo, Hai Bà Trưng, Hà Nội", gt_tu_thang: "2021-05", gt_den_thang: "" },
  { id: "NPT004", ma_nv: "NV0004", ho_ten: "Phạm Gia Bảo", quan_he: "con", ngay_sinh: "2021-03-30", so_cccd: "", mst_ca_nhan: "", dien_thoai: "", dia_chi: "9 Ngõ 100 Cầu Giấy, Hà Nội", gt_tu_thang: "2022-07", gt_den_thang: "" },
  // Kỳ đăng ký đã kết thúc — cột "ĐK giảm trừ" hiện đủ hai đầu ngày.
  { id: "NPT005", ma_nv: "NV0007", ho_ten: "Nguyễn Thị Vân", quan_he: "me", ngay_sinh: "1958-02-14", so_cccd: "001158099887", mst_ca_nhan: "8123456780", dien_thoai: "0913222111", dia_chi: "17 Tôn Đức Thắng, Đống Đa, Hà Nội", gt_tu_thang: "2023-01", gt_den_thang: "2025-12" },
  { id: "NPT006", ma_nv: "NV0009", ho_ten: "Đặng Khánh Linh", quan_he: "con", ngay_sinh: "2016-07-19", so_cccd: "", mst_ca_nhan: "", dien_thoai: "", dia_chi: "301 Trường Chinh, Thanh Xuân, Hà Nội", gt_tu_thang: "2021-09", gt_den_thang: "" },
];

/**
 * Cấu hình mặc định — số liệu theo quy định hiện hành tại Việt Nam.
 *
 * Đây là giá trị **khởi tạo cho một công ty mới**, không phải hằng số của hệ
 * thống: doanh nghiệp sửa lại theo thỏa ước lao động của mình. Nút "Khôi phục
 * mặc định" trên màn hình đưa về đúng bộ này.
 */
export const CAU_HINH_MAU: CauHinhMacDinh = {
  phuong_phap_ngay_cong: "co_dinh_26",
  chinh_sach_thu_7: "lam_nua_ngay",
  chinh_sach_chu_nhat: "nghi",
  gio_cong_chuan_ngay: 8,

  ngay_phep_co_ban: 12,
  nam_tham_nien_them_phep: 5,

  // Bộ luật Lao động 2019: ngày thường 150%, chủ nhật 200%, ngày lễ 300%;
  // làm đêm cộng thêm 30% lương cơ bản và 20% của đơn giá làm thêm ban ngày.
  tc_ngay_thuong_ngay: 150,
  tc_ngay_thuong_dem: 200,
  tc_chu_nhat_ngay: 200,
  tc_chu_nhat_dem: 270,
  tc_ngay_le_ngay: 300,
  tc_ngay_le_dem: 390,

  gioi_han_tc_thang: 40,
  nguong_canh_bao_tc_nam: 200,
  nguong_vuot_muc_tc_nam: 300,

  luong_co_so: 2340000,
  luong_toi_thieu_vung: 4960000,

  bhxh_nv: 8,
  bhyt_nv: 1.5,
  bhtn_nv: 1,

  bhxh_ct: 17.5,
  bhyt_ct: 3,
  bhtn_ct: 1,

  doan_phi_nv: 1,
  // Trần đóng đoàn phí = 10% lương cơ sở.
  tran_co_so_doan_phi: 234000,
  kinh_phi_cong_doan_ct: 2,

  giam_tru_ban_than: 11000000,
  giam_tru_npt: 4400000,

  // Lũy kế: 5tr → 10tr → 18tr → 32tr → phần vượt 32tr.
  bac_thue: [
    { khoang: 5000000, thue_suat: 5 },
    { khoang: 5000000, thue_suat: 10 },
    { khoang: 8000000, thue_suat: 15 },
    { khoang: 14000000, thue_suat: 20 },
    { khoang: 0, thue_suat: 25 },
  ],
};

export const CA_LAM_VIEC_MAU: CaLamViec[] = [
  { ma_ca: "CA01", ten_ca: "Ca hành chính", gio_vao: "08:00", gio_ra: "17:00", nghi_giua_ca: 60, status: "1" },
  { ma_ca: "CA02", ten_ca: "Ca sáng", gio_vao: "06:00", gio_ra: "14:00", nghi_giua_ca: 30, status: "1" },
  { ma_ca: "CA03", ten_ca: "Ca chiều", gio_vao: "14:00", gio_ra: "22:00", nghi_giua_ca: 30, status: "1" },
  // Ca qua đêm — dùng để thử phép tính số giờ khi giờ ra nhỏ hơn giờ vào.
  { ma_ca: "CA04", ten_ca: "Ca đêm", gio_vao: "22:00", gio_ra: "06:00", nghi_giua_ca: 30, status: "1" },
  { ma_ca: "CA05", ten_ca: "Ca bán thời gian sáng", gio_vao: "08:00", gio_ra: "12:00", nghi_giua_ca: 0, status: "0" },
];

/** Danh mục lương & phụ cấp — đủ bảy loại để thấy ngay cách bảng phân nhóm. */
export const KHOAN_LUONG_MAU: KhoanLuong[] = [
  { ma_khoan: "KL01", loai: "luong_phu_cap", ten_khoan: "Lương cơ bản", ghi_chu: "Khoản gốc trên hợp đồng lao động", tinh_bhxh: true, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL02", loai: "luong_phu_cap", ten_khoan: "Phụ cấp có bảo hiểm xã hội", ghi_chu: "Cộng vào gốc đóng BHXH", tinh_bhxh: true, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL03", loai: "luong_phu_cap", ten_khoan: "Phụ cấp không tính bảo hiểm xã hội", ghi_chu: "", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL04", loai: "luong_phu_cap", ten_khoan: "Phụ cấp độc hại", ghi_chu: "Theo danh mục nghề nặng nhọc, độc hại", tinh_bhxh: true, chiu_thue_tncn: false, ty_le: 0, status: "1" },
  { ma_khoan: "KL05", loai: "luong_ho_tro", ten_khoan: "Hỗ trợ con nhỏ", ghi_chu: "Áp cho nhân viên có con dưới 6 tuổi", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL06", loai: "luong_ho_tro", ten_khoan: "Hỗ trợ nhà ở", ghi_chu: "Trong mức miễn thuế theo quy định", tinh_bhxh: false, chiu_thue_tncn: false, ty_le: 0, status: "1" },
  { ma_khoan: "KL07", loai: "luong_ho_tro", ten_khoan: "Phụ cấp điện thoại", ghi_chu: "Theo quy chế công ty", tinh_bhxh: false, chiu_thue_tncn: false, ty_le: 0, status: "1" },
  { ma_khoan: "KL08", loai: "luong_ho_tro", ten_khoan: "Phụ cấp tiền cơm", ghi_chu: "730.000 đ/tháng nằm trong mức miễn thuế", tinh_bhxh: false, chiu_thue_tncn: false, ty_le: 0, status: "1" },
  { ma_khoan: "KL09", loai: "luong_nghiem_thu", ten_khoan: "Lương giao hàng", ghi_chu: "Trả theo số đơn đã giao", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL10", loai: "luong_nghiem_thu", ten_khoan: "Lương đóng hàng", ghi_chu: "Trả theo số kiện đã đóng", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL11", loai: "luong_nghiem_thu", ten_khoan: "Lương sản phẩm", ghi_chu: "Trả theo sản lượng đã nghiệm thu", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL12", loai: "luong_phan_tram", ten_khoan: "Lương %", ghi_chu: "Hoa hồng trên doanh thu đã thu tiền", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 3, status: "1" },
  { ma_khoan: "KL13", loai: "luong_kpi", ten_khoan: "KPI", ghi_chu: "Theo mức hoàn thành chỉ tiêu", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL14", loai: "luong_thuong", ten_khoan: "Thưởng lễ", ghi_chu: "30/4, 1/5, 2/9, Tết Dương lịch, Tết Âm lịch", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL15", loai: "luong_thuong", ten_khoan: "Thưởng đột xuất", ghi_chu: "Theo quyết định từng lần", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL16", loai: "luong_thuong", ten_khoan: "Thưởng", ghi_chu: "Thưởng chung theo kỳ", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
  { ma_khoan: "KL17", loai: "luong_chuyen_can", ten_khoan: "Chuyên cần", ghi_chu: "Mất khi nghỉ không phép từ 1 ngày", tinh_bhxh: false, chiu_thue_tncn: true, ty_le: 0, status: "1" },
];

/**
 * Lịch ngày lễ mẫu: bộ chuẩn năm 2026 sinh từ `ngayLeChuanVN`, cộng một ngày lễ
 * riêng của công ty để thấy được loại "Lễ riêng" và cờ "không lương".
 */
export const NGAY_LE_MAU: NgayLe[] = [
  ...ngayLeChuanVN(2026).map((nl, i) => ({ ...nl, id: `NL${String(i + 1).padStart(3, "0")}` })),
  {
    id: "NL900",
    ngay: "2026-10-15",
    ten: "Ngày thành lập công ty",
    loai: "le_cong_ty",
    lap_lai_hang_nam: true,
    co_luong: true,
    ghi_chu: "Nghỉ nửa ngày buổi chiều",
  },
  {
    id: "NL901",
    ngay: "2026-12-24",
    ten: "Nghỉ Giáng sinh (không lương)",
    loai: "le_cong_ty",
    lap_lai_hang_nam: false,
    co_luong: false,
    ghi_chu: "Đăng ký tự nguyện, trừ vào phép năm",
  },
];

/**
 * Cấu trúc lương đang áp dụng — chọn sẵn 9 khoản hay dùng nhất.
 *
 * Bốn khoản còn lại trong danh mục (thưởng đột xuất, lương giao/đóng hàng, lương %)
 * cố ý để ngoài, để thử nút "Thêm khoản có sẵn".
 */
export const CAU_TRUC_LUONG_MAU: CauTrucLuong = {
  tu_ngay: "2026-01-01",
  den_ngay: "2026-12-31",
  ghi_chu: "Áp dụng từ kỳ lương tháng 01/2026 theo quy chế lương mới.",
  dong: [
    { ma_khoan: "KL01", phan_loai: "tncn", tang_ca: true, tieu_thuc: "theo_ngay_cong", so_tien: 10000000 },
    { ma_khoan: "KL02", phan_loai: "tncn", tang_ca: false, tieu_thuc: "co_dinh_thang", so_tien: 2000000 },
    { ma_khoan: "KL03", phan_loai: "tncn", tang_ca: false, tieu_thuc: "co_dinh_thang", so_tien: 1000000 },
    { ma_khoan: "KL04", phan_loai: "mien_thue", tang_ca: false, tieu_thuc: "theo_ngay_cong", so_tien: 800000 },
    { ma_khoan: "KL05", phan_loai: "tncn", tang_ca: false, tieu_thuc: "co_dinh_thang", so_tien: 500000 },
    { ma_khoan: "KL06", phan_loai: "mien_thue", tang_ca: false, tieu_thuc: "co_dinh_thang", so_tien: 1500000 },
    { ma_khoan: "KL07", phan_loai: "mien_thue", tang_ca: false, tieu_thuc: "co_dinh_thang", so_tien: 300000 },
    { ma_khoan: "KL08", phan_loai: "mien_thue", tang_ca: false, tieu_thuc: "theo_ngay_cong", so_tien: 730000 },
    { ma_khoan: "KL17", phan_loai: "tncn", tang_ca: false, tieu_thuc: "co_dinh_thang", so_tien: 500000 },
  ],
};

/**
 * Set lương cho 7 trong 11 nhân viên đang làm — bốn người còn lại nằm ở bộ lọc
 * "Chưa set lương". Đủ cả ba trạng thái để thử nút "Duyệt lương".
 */
export const SET_LUONG_MAU: SetLuongNhanVien[] = [
  {
    ma_nv: "NV0001", lan_thiet_lap: 3, hieu_luc_tu: "2026-01-01", hieu_luc_den: "2026-12-31",
    trang_thai: "da_duyet",
    khoan: { KL01: 40000000, KL02: 8000000, KL04: 0, KL06: 3000000, KL07: 500000, KL08: 730000 },
  },
  {
    ma_nv: "NV0002", lan_thiet_lap: 2, hieu_luc_tu: "2026-01-01", hieu_luc_den: "2026-12-31",
    trang_thai: "da_duyet",
    khoan: { KL01: 30000000, KL02: 6000000, KL06: 3000000, KL07: 500000, KL08: 730000 },
  },
  {
    ma_nv: "NV0003", lan_thiet_lap: 2, hieu_luc_tu: "2026-01-01", hieu_luc_den: "2026-12-31",
    trang_thai: "da_duyet",
    khoan: { KL01: 20000000, KL02: 3000000, KL05: 500000, KL08: 730000, KL17: 500000 },
  },
  {
    ma_nv: "NV0004", lan_thiet_lap: 1, hieu_luc_tu: "2026-07-01", hieu_luc_den: "2026-12-31",
    trang_thai: "cho_duyet",
    khoan: { KL01: 15000000, KL03: 1000000, KL05: 500000, KL08: 730000, KL17: 500000 },
  },
  {
    ma_nv: "NV0005", lan_thiet_lap: 2, hieu_luc_tu: "2026-01-01", hieu_luc_den: "2026-12-31",
    trang_thai: "da_duyet",
    khoan: { KL01: 20000000, KL02: 3000000, KL07: 300000, KL08: 730000 },
  },
  {
    ma_nv: "NV0006", lan_thiet_lap: 1, hieu_luc_tu: "2026-07-01", hieu_luc_den: "",
    trang_thai: "cho_duyet",
    khoan: { KL01: 13000000, KL03: 800000, KL08: 730000, KL17: 500000 },
  },
  {
    ma_nv: "NV0007", lan_thiet_lap: 1, hieu_luc_tu: "2026-08-01", hieu_luc_den: "",
    trang_thai: "nhap",
    khoan: { KL01: 24000000, KL02: 4000000, KL04: 800000, KL08: 730000 },
  },
];

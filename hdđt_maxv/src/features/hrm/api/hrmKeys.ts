/**
 * Query key của khu HRM, gom một chỗ vì ba thực thể **phụ thuộc số liệu của nhau**:
 *   - danh sách phòng ban mang `so_nv`  -> đổi nhân viên là số này sai
 *   - danh sách nhân viên mang `ten_pb` và `so_npt` -> đổi phòng ban / người phụ thuộc là sai
 *   - người phụ thuộc / hồ sơ tài liệu / hợp đồng đều bị ẩn theo nhân viên đã xóa mềm
 *   - ghi hợp đồng thì BE tự đồng bộ bản sao "HĐ hiện hành" xuống bảng nhân viên
 *
 * Để mỗi file tự khai key rồi import chéo nhau sẽ thành vòng import; đặt ở đây thì cả ba
 * cùng nhìn một nguồn và invalidate được sang nhau.
 */

export const hrmPhongBanKeys = {
  all: ["hrm-phong-ban"] as const,
  // Gắn companyId: mọi API đi theo tenant qua cookie, đổi công ty phải nạp lại danh sách khác.
  list: (companyId: string | null) =>
    ["hrm-phong-ban", companyId, "list"] as const,
};

export const hrmNhanVienKeys = {
  all: ["hrm-nhan-vien"] as const,
  list: (companyId: string | null) =>
    ["hrm-nhan-vien", companyId, "list"] as const,
};

export const hrmNptKeys = {
  all: ["hrm-nguoi-phu-thuoc"] as const,
  list: (companyId: string | null) =>
    ["hrm-nguoi-phu-thuoc", companyId, "list"] as const,
};

export const hrmTaiLieuKeys = {
  all: ["hrm-tai-lieu"] as const,
  list: (companyId: string | null) =>
    ["hrm-tai-lieu", companyId, "list"] as const,
};

/**
 * Hợp đồng khóa THÊM theo `ma_nv`, không phải một danh sách chung.
 *
 * Từ QĐ #8, `GET /hrm/hop-dong` bắt buộc `ma_nv` (thiếu -> 400) và toàn nhóm chỉ mở cho người
 * được cấp quyền xem lương (thiếu -> 403). Trước đây FE gọi trần một lần rồi `filter` phía
 * trình duyệt, nghĩa là lương cả công ty nằm trong cache của mọi người mở màn hồ sơ
 * (BUG-HRM-25). Mỗi nhân viên một khóa cache thì dữ liệu tải về đúng bằng thứ đang xem.
 */
export const hrmHopDongKeys = {
  all: ["hrm-hop-dong"] as const,
  list: (companyId: string | null, maNv: string | null) =>
    ["hrm-hop-dong", companyId, "list", maNv] as const,
};

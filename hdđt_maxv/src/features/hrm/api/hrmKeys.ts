/**
 * Query key của khu HRM, gom một chỗ vì ba thực thể **phụ thuộc số liệu của nhau**:
 *   - danh sách phòng ban mang `so_nv`  -> đổi nhân viên là số này sai
 *   - danh sách nhân viên mang `ten_pb` và `so_npt` -> đổi phòng ban / người phụ thuộc là sai
 *   - người phụ thuộc bị ẩn theo nhân viên đã xóa mềm
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

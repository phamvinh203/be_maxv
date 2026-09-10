import type { EmployeeSalaryListParams } from "./cai_dat_luong/employeeSalariesApi";

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

export const hrmCauHinhKeys = {
  all: ["hrm-cau-hinh"] as const,
  detail: (companyId: string | null) =>
    ["hrm-cau-hinh", companyId, "detail"] as const,
};

/*
 * Hai khóa `detail` dưới đây **chưa có hook nào dùng** (biên bản review 2026-09-08, 🟢 đề xuất 1)
 * — giữ lại có chủ ý, không phải sót:
 *   - Chúng đi cặp với `getWorkShiftDetail` / `getHolidayDetail`, hai hàm Architect yêu cầu ở
 *     `FE-03` để phủ đủ `GET /:id` của hợp đồng; xóa khóa mà giữ hàm thì lần dùng đầu tiên lại
 *     phải nghĩ lại quy ước đặt khóa.
 *   - Tiền tố `["hrm-work-shifts"]` / `["hrm-holidays"]` trùng với `all`, nên `invalidateQueries`
 *     hiện tại đã quét luôn cả `detail` — thêm hook đọc chi tiết sau này không phải sửa chỗ khác.
 * Chỗ dùng dự kiến: mở màn sửa bằng liên kết trực tiếp hoặc F5 giữa chừng, khi chưa có danh sách.
 */
export const hrmWorkShiftKeys = {
  all: ["hrm-work-shifts"] as const,
  list: (companyId: string | null) =>
    ["hrm-work-shifts", companyId, "list"] as const,
  detail: (companyId: string | null, id: string) =>
    ["hrm-work-shifts", companyId, "detail", id] as const,
};

export const hrmHolidayKeys = {
  all: ["hrm-holidays"] as const,
  list: (companyId: string | null, year?: number) =>
    ["hrm-holidays", companyId, "list", year] as const,
  detail: (companyId: string | null, id: string) =>
    ["hrm-holidays", companyId, "detail", id] as const,
  /**
   * Bản xem trước "Tạo nhanh" của MỘT năm (`POST .../quick-generate` với `dryRun: true`).
   *
   * Là phép **đọc** nên nằm ở `useQuery` và có khóa cache riêng theo năm — đổi năm trong ô chọn
   * là đổi khóa, năm đã xem không phải hỏi lại. Vẫn gắn `companyId` như mọi khóa khác trong file:
   * `skippedCount` phụ thuộc lịch **của công ty đang mở**, thiếu companyId thì đổi công ty xong
   * hộp thoại còn hiện dự báo của công ty cũ.
   *
   * Tiền tố `["hrm-holidays"]` cố tình trùng `all`, nên `invalidateQueries({ queryKey: all })`
   * sau khi tạo/sửa/xóa ngày lễ đã quét luôn cả bản xem trước — không phải nhớ invalidate riêng.
   */
  quickPreview: (companyId: string | null, year: number) =>
    ["hrm-holidays", companyId, "quick-preview", year] as const,
};

export const hrmSalaryItemKeys = {
  all: ["hrm-salary-items"] as const,
  list: (companyId: string | null) =>
    ["hrm-salary-items", companyId, "list"] as const,
};

/** Chỉ MỘT cấu trúc lương khung đang áp dụng (`GET/PUT .../salary-structures/current`) — không phải danh sách. */
export const hrmSalaryStructureKeys = {
  all: ["hrm-salary-structures"] as const,
  current: (companyId: string | null) =>
    ["hrm-salary-structures", companyId, "current"] as const,
};

/**
 * `detail` khóa theo `employeeId` giống `hrmHopDongKeys` — set lương là dữ liệu lương của TỪNG
 * người, gộp chung một khóa sẽ làm mở hồ sơ người này thấy cache set lương của người khác.
 */
export const hrmEmployeeSalaryKeys = {
  all: ["hrm-employee-salaries"] as const,
  list: (companyId: string | null, params?: EmployeeSalaryListParams) =>
    ["hrm-employee-salaries", companyId, "list", params] as const,
  counts: (companyId: string | null) =>
    ["hrm-employee-salaries", companyId, "counts"] as const,
  detail: (companyId: string | null, employeeId: string) =>
    ["hrm-employee-salaries", companyId, "detail", employeeId] as const,
};

/** Quản lý kỳ lương */
export const hrmPayrollPeriodKeys = {
  all: ["hrm-payroll-periods"] as const,
  list: (companyId: string | null) =>
    ["hrm-payroll-periods", companyId, "list"] as const,
  detail: (companyId: string | null, id: string) =>
    ["hrm-payroll-periods", companyId, "detail", id] as const,
};

/** 4 Danh mục chuyên biệt phục vụ tính lương (KPI, Sản phẩm, Lỗi chuyên cần, Bù trừ) */
export const hrmPayrollCatalogKeys = {
  all: ["hrm-payroll-catalogs"] as const,
  kpiList: (companyId: string | null) =>
    ["hrm-payroll-catalogs", companyId, "kpi-items"] as const,
  productList: (companyId: string | null) =>
    ["hrm-payroll-catalogs", companyId, "products"] as const,
  diligenceTypeList: (companyId: string | null) =>
    ["hrm-payroll-catalogs", companyId, "diligence-types"] as const,
  adjustmentItemList: (companyId: string | null) =>
    ["hrm-payroll-catalogs", companyId, "adjustment-items"] as const,
};

/** 8 Phân hệ nhập liệu tính lương theo kỳ */
export const hrmPayrollDataKeys = {
  all: ["hrm-payroll-data"] as const,
  attendanceMatrix: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "attendance", periodId] as const,
  overtimeList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "overtime", periodId] as const,
  kpiList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "kpi", periodId] as const,
  bonusList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "bonus", periodId] as const,
  pieceworkList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "piecework", periodId] as const,
  commissionList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "commission", periodId] as const,
  diligenceList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "diligence", periodId] as const,
  adjustmentList: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-data", companyId, "adjustments", periodId] as const,
};

/** Bảng lương tính toán và snapshot */
export const hrmPayrollCalculationKeys = {
  all: ["hrm-payroll-calculation"] as const,
  calculate: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-calculation", companyId, "calculate", periodId] as const,
  sheetLines: (companyId: string | null, periodId: string) =>
    ["hrm-payroll-calculation", companyId, "sheet-lines", periodId] as const,
};


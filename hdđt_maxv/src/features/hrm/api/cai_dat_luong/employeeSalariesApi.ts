import { api } from "@/lib/apiClient";

const BASE = "/hrm/employee-salaries";

export type EmployeeSalaryStatusApi =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export interface EmployeeSalaryListParams {
  q?: string;
  ma_pb?: string;
  loai_hd?: string;
  /** `true` = đã set lương, `false` = chưa set. */
  daSet?: boolean;
}

export interface EmployeeSalaryListItemApi {
  ma_nv: string;
  ho_ten: string;
  ten_cv: string;
  ma_pb: string | null;
  loai_hd: string | null;
  so_tk: string;
  daSet: boolean;
  setupVersion: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  totalAmount: number;
  status: EmployeeSalaryStatusApi | null;
}

export interface EmployeeSalaryCountsApi {
  daSet: number;
  chuaSet: number;
  hasSalary: number;
  missingSalary: number;
  totalActiveEmployees: number;
}

/** Một khoản của bản thiết lập — dùng ở `items`, còn `khoan` là map cùng dữ liệu keyed theo mã. */
export interface EmployeeSalaryItemApi {
  salaryItemId: string;
  amount: number;
  ma_khoan: string;
  ten_khoan: string;
}

export interface EmployeeSalaryDetailApi {
  /** Vắng mặt = nhân viên CHƯA từng set lương. */
  id?: string;
  ma_nv: string;
  ho_ten: string;
  setupVersion: number;
  /** `YYYY-MM-DD`, chuỗi rỗng khi chưa có. */
  effectiveFrom: string;
  effectiveTo: string;
  totalAmount: number;
  status: EmployeeSalaryStatusApi;
  items: EmployeeSalaryItemApi[];
  /** Khóa bằng CẢ `salaryItemId` (UUID) lẫn `ma_khoan` — đọc bằng khóa nào cũng ra cùng giá trị. */
  khoan: Record<string, number>;
}

export interface SetEmployeeSalaryApiBody {
  khoan: Record<string, number>;
}

/** Một bản set lương người duyệt đang xem — máy chủ chỉ duyệt nếu bản đó còn đúng phiên bản này. */
export interface BanSetLuongDaXem {
  employeeId: string;
  setupVersion: number;
}

export interface ApproveSalariesApiBody {
  items: BanSetLuongDaXem[];
}

export interface ApproveSalariesApiResult {
  approvedCount: number;
  /** Bản gửi lên nhưng không duyệt: đã bị sửa sau khi xem (phiên bản đổi) hoặc không còn chờ duyệt. */
  skippedCount: number;
  message: string;
}

export function listEmployeeSalaries(
  params?: EmployeeSalaryListParams,
): Promise<EmployeeSalaryListItemApi[]> {
  return api.get<EmployeeSalaryListItemApi[]>(BASE, { params });
}

export function countEmployeeSalaries(): Promise<EmployeeSalaryCountsApi> {
  return api.get<EmployeeSalaryCountsApi>(`${BASE}/counts`);
}

export function getEmployeeSalary(
  employeeId: string,
): Promise<EmployeeSalaryDetailApi> {
  return api.get<EmployeeSalaryDetailApi>(
    `${BASE}/${encodeURIComponent(employeeId)}`,
  );
}

/** `PUT`, không phải `POST` — route thật là `app.put('/employee-salaries/:employeeId')`. */
export function setEmployeeSalary(
  employeeId: string,
  body: SetEmployeeSalaryApiBody,
): Promise<EmployeeSalaryDetailApi> {
  return api.put<EmployeeSalaryDetailApi>(
    `${BASE}/${encodeURIComponent(employeeId)}`,
    body,
  );
}

export function deleteEmployeeSalary(
  employeeId: string,
): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/${encodeURIComponent(employeeId)}`);
}

/**
 * Duyệt ĐÚNG các bản đang xem, kèm phiên bản đã xem (vbsec 2026-09-10 #40). Máy chủ bỏ qua bản đã bị sửa
 * sau khi xem — không còn kiểu "gửi rỗng = duyệt tất cả" (máy chủ trả 400).
 */
export function approveEmployeeSalaries(
  body: ApproveSalariesApiBody,
): Promise<ApproveSalariesApiResult> {
  return api.post<ApproveSalariesApiResult>(`${BASE}/approve`, body);
}

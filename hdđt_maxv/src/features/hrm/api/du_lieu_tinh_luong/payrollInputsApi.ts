import { api } from "@/lib/apiClient";

const BASE = "/hrm/payroll-data";

export type ScopeTypeApi = "toan_cong_ty" | "phong_ban" | "nhan_vien";

export interface BaseScopeBody {
  periodId: string;
  scope: ScopeTypeApi;
  ma_pb?: string;
  employeeIds?: string[];
}

export interface ListModuleParams {
  periodId: string;
  ma_pb?: string;
  q?: string;
}

// 1. Chấm công (Attendance)
export type AttendanceTypeApi =
  | "lam_viec"
  | "nua_ngay"
  | "cong_tac"
  | "nghi_phep"
  | "nghi_le"
  | "om"
  | "khong_luong"
  | "khac";

export interface AttendanceCellOverrideBody {
  periodId: string;
  ma_nv: string;
  workDate: string; // YYYY-MM-DD
  attendanceType: AttendanceTypeApi;
  actualHours?: number;
  note?: string;
}

export interface AttendanceRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  workDate: string;
  attendanceType: AttendanceTypeApi;
  actualHours: number;
  note: string | null;
}

/**
 * Response THẬT của `GET .../attendance/matrix` (`payrollInputs.service.ts::getAttendanceMatrix`)
 * — KHÔNG phải mảng phẳng `AttendanceRecordApi[]` như khai báo cũ (BUG phát hiện lúc đấu dây
 * `ChamCongPanel`, 2026-09-09): máy chủ trả cả `period`/`settings`/`holidays`/`employees` kèm
 * `records`. Chỉ khai những trường FE thực sự dùng — `settings`/`holidays`/`period` giữ lỏng vì
 * `ChamCongPanel` đọc cấu hình/lịch lễ từ `cauHinhQueries`/`holidaysQueries` (API thật riêng),
 * không qua endpoint này.
 */
export interface AttendanceMatrixResponse {
  employees: { ma_nv: string; ho_ten: string; ma_pb: string | null }[];
  records: AttendanceRecordApi[];
}

export function getAttendanceMatrix(
  params: ListModuleParams,
): Promise<AttendanceMatrixResponse> {
  return api.get<AttendanceMatrixResponse>(`${BASE}/attendance/matrix`, { params });
}

export function overrideAttendanceCell(body: AttendanceCellOverrideBody): Promise<AttendanceRecordApi> {
  return api.put<AttendanceRecordApi>(`${BASE}/attendance/cell`, body);
}

// 2. Tăng ca (Overtime)
export type OvertimeTypeApi =
  | "ngay_thuong_ngay"
  | "ngay_thuong_dem"
  | "chu_nhat_ngay"
  | "chu_nhat_dem"
  | "ngay_le_ngay"
  | "ngay_le_dem";

export interface OvertimeItemBody {
  otType: OvertimeTypeApi;
  hours: number;
  note?: string;
}

export interface ApplyOvertimeBody extends BaseScopeBody {
  items: OvertimeItemBody[];
}

export interface OvertimeRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  otType: OvertimeTypeApi;
  hours: number;
  convertedHours: number;
  note: string | null;
}

/**
 * Response THẬT của `GET .../overtime` (`payrollInputs.service.ts::getOvertimeData`) — MỘT
 * dòng/nhân viên, gộp sẵn `records` + tổng hợp, KHÔNG phải mảng phẳng `OvertimeRecordApi[]` như
 * khai báo cũ (cùng lớp lỗi với `AttendanceMatrixResponse`, xem ghi chú ở đó).
 */
export interface OvertimeSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: OvertimeRecordApi[];
  totalHours: number;
  convertedHours: number;
  isWarningMonth: boolean;
}

export function getOvertimeData(params: ListModuleParams): Promise<OvertimeSummaryApi[]> {
  return api.get<OvertimeSummaryApi[]>(`${BASE}/overtime`, { params });
}

export function applyOvertimeData(body: ApplyOvertimeBody): Promise<{ count: number }> {
  return api.post<{ count: number }>(`${BASE}/overtime/apply`, body);
}

export function deleteOvertimeData(ma_nv: string, periodId: string): Promise<{ count: number }> {
  return api.del<{ count: number }>(
    `${BASE}/overtime/${encodeURIComponent(ma_nv)}?periodId=${encodeURIComponent(periodId)}`,
  );
}

// 3. KPI
export interface KpiItemBody {
  kpiItemId: string;
  weight: number;
  targetValue: number;
  actualValue: number;
  note?: string;
}

export interface ApplyKpiBody extends BaseScopeBody {
  items: KpiItemBody[];
}

export interface KpiRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  kpiItemId: string;
  weight: number;
  targetValue: number;
  actualValue: number;
  completionRate: number;
  note: string | null;
  kpiItem?: {
    code: string;
    name: string;
    unit: string;
  };
}

/**
 * Response THẬT của `GET .../kpi` (`payrollInputs.service.ts::getKpiData`) — MỘT dòng/nhân
 * viên, gộp sẵn `records` + điểm bình quân, KHÔNG phải mảng phẳng `KpiRecordApi[]` như khai báo
 * cũ (cùng lớp lỗi với `AttendanceMatrixResponse`, xem ghi chú ở đó).
 */
export interface KpiSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: KpiRecordApi[];
  /** Bình quân `completionRate` theo trọng số. `null` = chưa có chỉ tiêu nào / tổng trọng số 0. */
  avgScore: number | null;
  totalKpiItems: number;
}

export function getKpiData(params: ListModuleParams): Promise<KpiSummaryApi[]> {
  return api.get<KpiSummaryApi[]>(`${BASE}/kpi`, { params });
}

export function applyKpiData(body: ApplyKpiBody): Promise<{ count: number }> {
  return api.post<{ count: number }>(`${BASE}/kpi/apply`, body);
}

// 4. Thưởng (Bonus)
export interface BonusItemBody {
  salaryItemId: string;
  amount: number;
  note?: string;
}

export interface ApplyBonusBody extends BaseScopeBody {
  items: BonusItemBody[];
}

export interface BonusRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  salaryItemId: string;
  amount: number;
  note: string | null;
  salaryItem?: {
    code: string;
    name: string;
  };
}

/**
 * Response THẬT của `GET .../bonus` (`payrollInputs.service.ts::getBonusData`) — MỘT dòng/nhân
 * viên, gộp sẵn `records` + tổng tiền, KHÔNG phải mảng phẳng `BonusRecordApi[]` như khai báo cũ
 * (cùng lớp lỗi với `AttendanceMatrixResponse`, xem ghi chú ở đó).
 */
export interface BonusSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: BonusRecordApi[];
  totalAmount: number;
}

export function getBonusData(params: ListModuleParams): Promise<BonusSummaryApi[]> {
  return api.get<BonusSummaryApi[]>(`${BASE}/bonus`, { params });
}

export function applyBonusData(body: ApplyBonusBody): Promise<{ count: number }> {
  return api.post<{ count: number }>(`${BASE}/bonus/apply`, body);
}

// 5. Lương sản phẩm (Piecework)
export interface PieceworkRecordItemBody {
  productId: string;
  unitPrice?: number;
  quantity: number;
  note?: string;
}

export interface ApplyPieceworkBody extends BaseScopeBody {
  items: PieceworkRecordItemBody[];
}

export interface PieceworkRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note: string | null;
  product?: {
    code: string;
    name: string;
    unit: string;
  };
}

/**
 * Response THẬT của `GET .../piecework` (`payrollInputs.service.ts::getPieceworkData`) — MỘT
 * dòng/nhân viên, gộp sẵn `records` + tổng tiền, KHÔNG phải mảng phẳng `PieceworkRecordApi[]`
 * như khai báo cũ (cùng lớp lỗi với `AttendanceMatrixResponse`, xem ghi chú ở đó).
 */
export interface PieceworkSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: PieceworkRecordApi[];
  totalAmount: number;
}

export function getPieceworkData(params: ListModuleParams): Promise<PieceworkSummaryApi[]> {
  return api.get<PieceworkSummaryApi[]>(`${BASE}/piecework`, { params });
}

export function applyPieceworkData(body: ApplyPieceworkBody): Promise<{ count: number }> {
  return api.post<{ count: number }>(`${BASE}/piecework/apply`, body);
}

// 6. Lương phần trăm (Commission)
export interface CommissionRecordItemBody {
  salaryItemId: string;
  commissionRate?: number;
  baseAmount: number;
  note?: string;
}

export interface ApplyCommissionBody extends BaseScopeBody {
  items: CommissionRecordItemBody[];
}

export interface CommissionRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  salaryItemId: string;
  commissionRate: number;
  baseAmount: number;
  amount: number;
  note: string | null;
  salaryItem?: {
    code: string;
    name: string;
  };
}

/**
 * Response THẬT của `GET .../commission` (`payrollInputs.service.ts::getCommissionData`) — MỘT
 * dòng/nhân viên, gộp sẵn `records` + tổng tiền, KHÔNG phải mảng phẳng `CommissionRecordApi[]`
 * như khai báo cũ (cùng lớp lỗi với `AttendanceMatrixResponse`, xem ghi chú ở đó).
 */
export interface CommissionSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: CommissionRecordApi[];
  totalAmount: number;
}

export function getCommissionData(params: ListModuleParams): Promise<CommissionSummaryApi[]> {
  return api.get<CommissionSummaryApi[]>(`${BASE}/commission`, { params });
}

export function applyCommissionData(body: ApplyCommissionBody): Promise<{ count: number }> {
  return api.post<{ count: number }>(`${BASE}/commission/apply`, body);
}

// 7. Lương chuyên cần (Diligence)
export interface RecordDiligenceBody {
  periodId: string;
  ma_nv: string;
  violationTypeId: string;
  violationDate: string; // YYYY-MM-DD
  violationHours?: number;
  note?: string;
}

export interface DiligenceRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  violationTypeId: string;
  violationDate: string;
  violationHours: number | null;
  deductionAmount: number;
  note: string | null;
  violationType?: {
    code: string;
    name: string;
    deductionMethod: string;
    penaltyRate: number;
  };
}

/**
 * Response THẬT của `GET .../diligence` (`payrollInputs.service.ts::getDiligenceData`) — MỘT
 * dòng/nhân viên, gộp sẵn `records` + đơn giá/tổng trừ/thành tiền đã áp bất biến "chặn sàn
 * chuyên cần" (BR-dltl-016), KHÔNG phải mảng phẳng `DiligenceRecordApi[]` như khai báo cũ (cùng
 * lớp lỗi với `AttendanceMatrixResponse`, xem ghi chú ở đó). FE KHÔNG cần tự tính lại các số này.
 */
export interface DiligenceSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: DiligenceRecordApi[];
  donGia: number;
  tongTru: number;
  thanhTien: number;
  soViPham: number;
}

export function getDiligenceData(params: ListModuleParams): Promise<DiligenceSummaryApi[]> {
  return api.get<DiligenceSummaryApi[]>(`${BASE}/diligence`, { params });
}

export function recordDiligence(body: RecordDiligenceBody): Promise<DiligenceRecordApi> {
  return api.post<DiligenceRecordApi>(`${BASE}/diligence/record`, body);
}

export function deleteDiligenceRecord(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/diligence/${encodeURIComponent(id)}`);
}

// 8. Ứng - Bù trừ (Adjustments)
export interface AdjustmentRecordItemBody {
  adjustmentItemId: string;
  amount: number;
  note?: string;
}

export interface ApplyAdjustmentsBody extends BaseScopeBody {
  items: AdjustmentRecordItemBody[];
}

export interface SalaryAdjustmentRecordApi {
  id: string;
  periodId: string;
  ma_nv: string;
  adjustmentItemId: string;
  amount: number;
  direction: "tru" | "bu";
  note: string | null;
  adjustmentItem?: {
    code: string;
    name: string;
    direction: "tru" | "bu";
  };
}

/**
 * Response THẬT của `GET .../adjustments` (`payrollInputs.service.ts::getAdjustmentsData`) —
 * MỘT dòng/nhân viên, gộp sẵn `records` + tổng trừ/tổng bù/net, KHÔNG phải mảng phẳng
 * `SalaryAdjustmentRecordApi[]` như khai báo cũ (cùng lớp lỗi với `AttendanceMatrixResponse`,
 * xem ghi chú ở đó).
 */
export interface AdjustmentSummaryApi {
  ma_nv: string;
  ho_ten: string;
  ma_pb: string | null;
  records: SalaryAdjustmentRecordApi[];
  tongTru: number;
  tongBu: number;
  /** Dương = khấu trừ lương, âm = nhận thêm. */
  netAdjustment: number;
}

export function getAdjustmentData(params: ListModuleParams): Promise<AdjustmentSummaryApi[]> {
  return api.get<AdjustmentSummaryApi[]>(`${BASE}/adjustments`, { params });
}

export function applyAdjustmentData(body: ApplyAdjustmentsBody): Promise<{ count: number }> {
  return api.post<{ count: number }>(`${BASE}/adjustments/apply`, body);
}

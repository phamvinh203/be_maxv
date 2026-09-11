import { api } from "@/lib/apiClient";
import type { PayrollPeriodStatusApi } from "../du_lieu_tinh_luong/payrollPeriodsApi";

const BASE = "/hrm/payroll-periods";

/** 12 bảng kê của màn Chốt kỳ lương — khớp enum `PayrollModuleCode` ở tenant schema. */
export type MaBangKe =
  | "ATTENDANCE"
  | "OVERTIME"
  | "KPI"
  | "BONUS"
  | "ADJUSTMENT"
  | "PIECEWORK"
  | "COMMISSION"
  | "OTHER_INCOME"
  | "DILIGENCE"
  | "TAX_DEDUCTION"
  | "SALARY_PROFILE"
  | "SUPPORT_ALLOWANCE";

export interface BangKeApiItem {
  module: MaBangKe;
  label: string;
  /** `true` = dữ liệu riêng của kỳ, chốt số thì máy chủ chặn ghi; `false` = chỉ xác nhận đã rà. */
  periodData: boolean;
  locked: boolean;
  /** `MODULE` = chốt riêng bảng kê này; `PERIOD` = kỳ đã khóa sổ nên coi như đã chốt. */
  lockSource: "MODULE" | "PERIOD" | null;
  lockedAt: string | null;
  lockedByUserId: string | null;
  lockedByName: string | null;
}

export interface ChotKyLuongApi {
  period: {
    id: string;
    code: string;
    name: string;
    month: number;
    year: number;
    status: PayrollPeriodStatusApi;
    lockedAt: string | null;
  };
  periodLocked: boolean;
  modules: BangKeApiItem[];
  lockedModuleCount: number;
  totalModules: number;
  payroll: { calculatedEmployees: number; totalEmployees: number };
}

export type LoaiHoatDong = "LOCK" | "UNLOCK" | "EDIT" | "APPROVE";

export interface HoatDongKyLuongApi {
  id: string;
  action: string;
  type: LoaiHoatDong;
  description: string;
  userId: string | null;
  userName: string;
  createdAt: string;
}

const kyUrl = (periodId: string) => `${BASE}/${encodeURIComponent(periodId)}`;

export function getChotKyLuong(periodId: string): Promise<ChotKyLuongApi> {
  return api.get<ChotKyLuongApi>(`${kyUrl(periodId)}/closing`);
}

export function getLichSuKyLuong(periodId: string): Promise<HoatDongKyLuongApi[]> {
  return api.get<HoatDongKyLuongApi[]>(`${kyUrl(periodId)}/activities`);
}

export function chotBangKe(periodId: string, module: MaBangKe): Promise<unknown> {
  return api.post(`${kyUrl(periodId)}/modules/${module}/lock`);
}

export function moChotBangKe(periodId: string, module: MaBangKe): Promise<unknown> {
  return api.post(`${kyUrl(periodId)}/modules/${module}/unlock`);
}

export function chotToanKy(periodId: string): Promise<{ lockedModules: MaBangKe[] }> {
  return api.post<{ lockedModules: MaBangKe[] }>(`${kyUrl(periodId)}/modules/lock-all`);
}

export function tinhLuongKy(periodId: string): Promise<{ calculatedEmployees: number }> {
  return api.post<{ calculatedEmployees: number }>(`${kyUrl(periodId)}/calculate`);
}

import { api } from "@/lib/apiClient";

const BASE = "/hrm/payroll-periods";

export type PayrollPeriodStatusApi =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "LOCKED"
  | "APPROVED"
  | "PAID"
  | "ARCHIVED";

export interface PayrollPeriodApiItem {
  id: string;
  month: number;
  year: number;
  name: string;
  status: PayrollPeriodStatusApi;
  lockedAt: string | null;
  lockedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  paidAt: string | null;
  paidBy: string | null;
  totalEmployees: number;
  totalGrossSalary: number;
  totalNetSalary: number;
  reopenCount: number;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListPayrollPeriodsParams {
  year?: number;
  status?: PayrollPeriodStatusApi;
}

export interface CreatePayrollPeriodBody {
  month: number;
  year: number;
  name: string;
}

export interface UpdatePayrollPeriodBody {
  name?: string;
}

export interface ReopenPayrollPeriodBody {
  reason: string;
}

export function listPayrollPeriods(
  params?: ListPayrollPeriodsParams,
): Promise<PayrollPeriodApiItem[]> {
  return api.get<PayrollPeriodApiItem[]>(BASE, { params });
}

export function getPayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.get<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}`);
}

export function createPayrollPeriod(
  body: CreatePayrollPeriodBody,
): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(BASE, body);
}

export function updatePayrollPeriod(
  id: string,
  body: UpdatePayrollPeriodBody,
): Promise<PayrollPeriodApiItem> {
  return api.patch<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deletePayrollPeriod(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/${encodeURIComponent(id)}`);
}

// Vòng đời trạng thái
export function submitPayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/submit`);
}

export function rejectPayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/reject`);
}

export function lockPayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/lock`);
}

export function reopenPayrollPeriod(
  id: string,
  body: ReopenPayrollPeriodBody,
): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/reopen`, body);
}

export function approvePayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/approve`);
}

export function markPaidPayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/mark-paid`);
}

export function archivePayrollPeriod(id: string): Promise<PayrollPeriodApiItem> {
  return api.post<PayrollPeriodApiItem>(`${BASE}/${encodeURIComponent(id)}/archive`);
}

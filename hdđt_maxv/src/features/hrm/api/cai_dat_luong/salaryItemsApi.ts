import { api } from "@/lib/apiClient";

const BASE = "/hrm/salary-items";

export type SalaryItemCategoryApi =
  | "FIXED_ALLOWANCE"
  | "BENEFIT_ALLOWANCE"
  | "DELIVERY_PIECEWORK"
  | "COMMISSION_PERCENTAGE"
  | "KPI_PERFORMANCE"
  | "PERIODIC_BONUS"
  | "ATTENDANCE_ALLOWANCE";

export type SalaryItemStatusApi = "ACTIVE" | "INACTIVE";

export interface SalaryItemApiItem {
  id: string;
  code: string;
  name: string;
  category: SalaryItemCategoryApi;
  description: string | null;
  isSocialInsurance: boolean;
  isTaxable: boolean;
  defaultRate: number | null;
  status: SalaryItemStatusApi;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryItemListParams {
  q?: string;
  category?: SalaryItemCategoryApi;
  status?: SalaryItemStatusApi;
}

export interface CreateSalaryItemApiBody {
  name: string;
  category: SalaryItemCategoryApi;
  /** Bỏ trống để máy chủ tự sinh KL01..KL99 (BR-sal-001). */
  code?: string;
  description?: string | null;
  isSocialInsurance?: boolean;
  isTaxable?: boolean;
  defaultRate?: number | null;
}

export interface UpdateSalaryItemApiBody {
  name?: string;
  category?: SalaryItemCategoryApi;
  description?: string | null;
  isSocialInsurance?: boolean;
  isTaxable?: boolean;
  defaultRate?: number | null;
  status?: SalaryItemStatusApi;
}

/** Danh mục không phân trang — trần tự nhiên là 99 khoản (mã tự sinh KL01–KL99). */
export function listSalaryItems(
  params?: SalaryItemListParams,
): Promise<SalaryItemApiItem[]> {
  return api.get<SalaryItemApiItem[]>(BASE, { params });
}

export function createSalaryItem(
  body: CreateSalaryItemApiBody,
): Promise<SalaryItemApiItem> {
  return api.post<SalaryItemApiItem>(BASE, body);
}

/** `PATCH`, không phải `PUT` — route thật là `app.patch('/salary-items/:id')`. */
export function updateSalaryItem(
  id: string,
  body: UpdateSalaryItemApiBody,
): Promise<SalaryItemApiItem> {
  return api.patch<SalaryItemApiItem>(`${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteSalaryItem(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/${encodeURIComponent(id)}`);
}

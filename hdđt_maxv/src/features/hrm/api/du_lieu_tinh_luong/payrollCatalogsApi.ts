import { api } from "@/lib/apiClient";

const BASE = "/hrm/payroll-catalogs";

export type CatalogStatusApi = "ACTIVE" | "INACTIVE";

export interface CatalogQueryParams {
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  q?: string;
}

// 1. KPI Item
export interface KpiItemApi {
  id: string;
  code: string;
  name: string;
  unit: string;
  defaultWeight: number;
  status: CatalogStatusApi;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKpiItemBody {
  code?: string;
  name: string;
  unit: string;
  defaultWeight?: number;
  status?: CatalogStatusApi;
}

export interface UpdateKpiItemBody {
  code?: string;
  name?: string;
  unit?: string;
  defaultWeight?: number;
  status?: CatalogStatusApi;
}

export function listKpiItems(params?: CatalogQueryParams): Promise<KpiItemApi[]> {
  return api.get<KpiItemApi[]>(`${BASE}/kpi-items`, { params });
}

export function createKpiItem(body: CreateKpiItemBody): Promise<KpiItemApi> {
  return api.post<KpiItemApi>(`${BASE}/kpi-items`, body);
}

export function updateKpiItem(id: string, body: UpdateKpiItemBody): Promise<KpiItemApi> {
  return api.patch<KpiItemApi>(`${BASE}/kpi-items/${encodeURIComponent(id)}`, body);
}

export function deleteKpiItem(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/kpi-items/${encodeURIComponent(id)}`);
}

// 2. Piecework Product
export interface PieceworkProductApi {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  status: CatalogStatusApi;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePieceworkProductBody {
  code?: string;
  name: string;
  unit: string;
  unitPrice?: number;
  status?: CatalogStatusApi;
}

export interface UpdatePieceworkProductBody {
  code?: string;
  name?: string;
  unit?: string;
  unitPrice?: number;
  status?: CatalogStatusApi;
}

export function listPieceworkProducts(params?: CatalogQueryParams): Promise<PieceworkProductApi[]> {
  return api.get<PieceworkProductApi[]>(`${BASE}/products`, { params });
}

export function createPieceworkProduct(body: CreatePieceworkProductBody): Promise<PieceworkProductApi> {
  return api.post<PieceworkProductApi>(`${BASE}/products`, body);
}

export function updatePieceworkProduct(id: string, body: UpdatePieceworkProductBody): Promise<PieceworkProductApi> {
  return api.patch<PieceworkProductApi>(`${BASE}/products/${encodeURIComponent(id)}`, body);
}

export function deletePieceworkProduct(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/products/${encodeURIComponent(id)}`);
}

// 3. Diligence Violation Type
export type DiligenceDeductionMethodApi = "theo_gio" | "theo_lan" | "mat_toan_bo";

export interface DiligenceViolationTypeApi {
  id: string;
  code: string;
  name: string;
  deductionMethod: DiligenceDeductionMethodApi;
  penaltyRate: number;
  status: CatalogStatusApi;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiligenceViolationTypeBody {
  code?: string;
  name: string;
  deductionMethod: DiligenceDeductionMethodApi;
  penaltyRate?: number;
  status?: CatalogStatusApi;
}

export interface UpdateDiligenceViolationTypeBody {
  code?: string;
  name?: string;
  deductionMethod?: DiligenceDeductionMethodApi;
  penaltyRate?: number;
  status?: CatalogStatusApi;
}

export function listDiligenceViolationTypes(params?: CatalogQueryParams): Promise<DiligenceViolationTypeApi[]> {
  return api.get<DiligenceViolationTypeApi[]>(`${BASE}/diligence-types`, { params });
}

export function createDiligenceViolationType(body: CreateDiligenceViolationTypeBody): Promise<DiligenceViolationTypeApi> {
  return api.post<DiligenceViolationTypeApi>(`${BASE}/diligence-types`, body);
}

export function updateDiligenceViolationType(id: string, body: UpdateDiligenceViolationTypeBody): Promise<DiligenceViolationTypeApi> {
  return api.patch<DiligenceViolationTypeApi>(`${BASE}/diligence-types/${encodeURIComponent(id)}`, body);
}

export function deleteDiligenceViolationType(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/diligence-types/${encodeURIComponent(id)}`);
}

// 4. Salary Adjustment Item
export type AdjustmentDirectionApi = "tru" | "bu";

export interface SalaryAdjustmentItemApi {
  id: string;
  code: string;
  name: string;
  direction: AdjustmentDirectionApi;
  status: CatalogStatusApi;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryAdjustmentItemBody {
  code?: string;
  name: string;
  direction: AdjustmentDirectionApi;
  status?: CatalogStatusApi;
}

export interface UpdateSalaryAdjustmentItemBody {
  code?: string;
  name?: string;
  direction?: AdjustmentDirectionApi;
  status?: CatalogStatusApi;
}

export function listSalaryAdjustmentItems(params?: CatalogQueryParams): Promise<SalaryAdjustmentItemApi[]> {
  return api.get<SalaryAdjustmentItemApi[]>(`${BASE}/adjustment-items`, { params });
}

export function createSalaryAdjustmentItem(body: CreateSalaryAdjustmentItemBody): Promise<SalaryAdjustmentItemApi> {
  return api.post<SalaryAdjustmentItemApi>(`${BASE}/adjustment-items`, body);
}

export function updateSalaryAdjustmentItem(id: string, body: UpdateSalaryAdjustmentItemBody): Promise<SalaryAdjustmentItemApi> {
  return api.patch<SalaryAdjustmentItemApi>(`${BASE}/adjustment-items/${encodeURIComponent(id)}`, body);
}

export function deleteSalaryAdjustmentItem(id: string): Promise<{ message: string }> {
  return api.del<{ message: string }>(`${BASE}/adjustment-items/${encodeURIComponent(id)}`);
}

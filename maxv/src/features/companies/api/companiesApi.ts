import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';
import type {
  Company,
  CompanyDetail,
  CompanyOverview,
  ListCompaniesParams,
} from '@/features/companies/types/company';

type StatusResult = { id: string; status: string };

export function listCompanies(
  params: ListCompaniesParams,
): Promise<Paginated<Company>> {
  return api.get<Paginated<Company>>('/admin/companies', { params });
}

export function getCompany(id: string): Promise<CompanyDetail> {
  return api.get<CompanyDetail>(`/admin/companies/${id}`);
}

export function getCompanyOverview(id: string): Promise<CompanyOverview> {
  return api.get<CompanyOverview>(`/admin/companies/${id}/overview`);
}

export function suspendCompany(id: string): Promise<StatusResult> {
  return api.post<StatusResult>(`/admin/companies/${id}/suspend`);
}

export function resumeCompany(id: string): Promise<StatusResult> {
  return api.post<StatusResult>(`/admin/companies/${id}/resume`);
}

export function retryProvision(
  id: string,
): Promise<StatusResult & { dbName: string }> {
  return api.post<StatusResult & { dbName: string }>(
    `/admin/companies/${id}/retry-provision`,
  );
}

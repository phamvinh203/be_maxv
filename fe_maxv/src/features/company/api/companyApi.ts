import { api } from '@/lib/apiClient';
import type { SwitchCompanyResult } from '@/features/auth/types/auth';
import type {
  Company,
  CompanyInvite,
  Employee,
  InviteEmployeeInput,
  RegisterCompanyInput,
  RegisterCompanyResponse,
} from '@/features/company/types/company';

export function registerCompany(
  input: RegisterCompanyInput,
): Promise<RegisterCompanyResponse> {
  return api.post<RegisterCompanyResponse>('/companies', input);
}

/** Danh sách công ty/MST kèm thông tin chi tiết (bảng Cài đặt › Công ty/MST). */
export function listCompanies(): Promise<Company[]> {
  return api.get<Company[]>('/companies');
}

/** Đổi công ty đang làm việc: backend đặt access cookie mới nhúng donViId của MST đích. */
export function switchCompany(id: string): Promise<SwitchCompanyResult> {
  return api.post<SwitchCompanyResult>(`/companies/${id}/switch`);
}

export function listEmployees(): Promise<Employee[]> {
  return api.get<Employee[]>('/companies/employees');
}

export function listInvites(): Promise<CompanyInvite[]> {
  return api.get<CompanyInvite[]>('/companies/invites');
}

export function inviteEmployee(input: InviteEmployeeInput): Promise<CompanyInvite> {
  return api.post<CompanyInvite>('/companies/invite', input);
}

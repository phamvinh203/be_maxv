import { api } from '@/lib/apiClient';
import type {
  AuthCompany,
  SwitchCompanyResult,
} from '@/features/auth/types/auth';
import type {
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

/** Danh sách MST/công ty tài khoản được phép (dùng để làm mới Select đổi MST). */
export function listCompanies(): Promise<AuthCompany[]> {
  return api.get<AuthCompany[]>('/companies');
}

/** Đổi công ty đang làm việc: backend cấp lại token nhúng donViId mới của MST đích. */
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

import { api } from '@/lib/apiClient';
import type {
  CompanyInvite,
  Employee,
  InviteEmployeeInput,
  RegisterCompanyInput,
  RegisterCompanyResult,
} from '@/features/company/types/company';

export function registerCompany(
  input: RegisterCompanyInput,
): Promise<RegisterCompanyResult> {
  return api.post<RegisterCompanyResult>('/companies', input);
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

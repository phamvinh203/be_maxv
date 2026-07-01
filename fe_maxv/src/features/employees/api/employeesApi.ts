import { api } from '@/lib/apiClient';
import type {
  Employee,
  InviteEmployeeInput,
  InviteResult,
} from '@/features/employees/types/employee';

export function listEmployees(): Promise<Employee[]> {
  return api.get<Employee[]>('/nhan-vien');
}

export function inviteEmployee(input: InviteEmployeeInput): Promise<InviteResult> {
  return api.post<InviteResult>('/nhan-vien/invite', input);
}

import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { listEmployees, inviteEmployee } from '@/features/employees/api/employeesApi';
import type { InviteEmployeeInput } from '@/features/employees/types/employee';

export const employeeKeys = { all: ['employees'] as const };

export function useEmployees() {
  return useSuspenseQuery({
    queryKey: employeeKeys.all,
    queryFn: listEmployees,
  });
}

export function useInviteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteEmployeeInput) => inviteEmployee(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

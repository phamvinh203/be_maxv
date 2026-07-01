import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inviteEmployee,
  listEmployees,
  listInvites,
} from '@/features/company/api/companyApi';

export function useEmployees() {
  return useQuery({ queryKey: ['company', 'employees'], queryFn: listEmployees });
}

export function useCompanyInvites() {
  return useQuery({ queryKey: ['company', 'invites'], queryFn: listInvites });
}

export function useInviteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['company', 'invites'] });
    },
  });
}

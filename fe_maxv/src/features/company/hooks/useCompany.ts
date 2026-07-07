import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inviteEmployee,
  listCompanies,
  listEmployees,
  listInvites,
  registerCompany,
} from '@/features/company/api/companyApi';

/** Khóa query danh sách công ty — export để invalidate sau khi thêm MST. */
export const COMPANIES_QUERY_KEY = ['company', 'list'] as const;

export function useRegisterCompany() {
  return useMutation({ mutationFn: registerCompany });
}

export function useCompanies() {
  return useQuery({ queryKey: COMPANIES_QUERY_KEY, queryFn: listCompanies });
}

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

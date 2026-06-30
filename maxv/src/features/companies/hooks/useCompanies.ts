import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listCompanies,
  getCompany,
  getCompanyOverview,
  suspendCompany,
  resumeCompany,
  retryProvision,
} from '@/features/companies/api/companiesApi';
import type { ListCompaniesParams } from '@/features/companies/types/company';

export const companyKeys = {
  all: ['companies'] as const,
  list: (params: ListCompaniesParams) =>
    [...companyKeys.all, 'list', params] as const,
  detail: (id: string) => [...companyKeys.all, 'detail', id] as const,
  overview: (id: string) => [...companyKeys.all, 'overview', id] as const,
};

export function useCompanies(params: ListCompaniesParams) {
  return useSuspenseQuery({
    queryKey: companyKeys.list(params),
    queryFn: () => listCompanies(params),
  });
}

export function useCompany(id: string) {
  return useSuspenseQuery({
    queryKey: companyKeys.detail(id),
    queryFn: () => getCompany(id),
  });
}

export function useCompanyOverview(id: string) {
  return useSuspenseQuery({
    queryKey: companyKeys.overview(id),
    queryFn: () => getCompanyOverview(id),
  });
}

// Sau khi đổi vòng đời -> làm mới mọi query companies.
// invalidate theo prefix companyKeys.all đã bao trùm list/detail/overview.
function useCompanyAction(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: companyKeys.all });
    },
  });
}

export function useSuspendCompany() {
  return useCompanyAction(suspendCompany);
}

export function useResumeCompany() {
  return useCompanyAction(resumeCompany);
}

export function useRetryProvision() {
  return useCompanyAction(retryProvision);
}

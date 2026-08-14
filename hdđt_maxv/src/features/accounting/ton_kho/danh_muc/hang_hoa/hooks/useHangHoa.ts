import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createHangHoa,
  deleteHangHoa,
  doiMaHangHoa,
  fetchLookups,
  getHangHoa,
  listHangHoa,
  updateHangHoa,
} from '@/features/accounting/ton_kho/danh_muc/hang_hoa/api/hangHoaApi';
import type {
  HangHoaForm,
  HangHoaListParams,
} from '@/features/accounting/ton_kho/danh_muc/hang_hoa/types';
import { useAuth } from '@/features/auth/useAuth';

// Mọi key đều gắn companyId — API theo tenant qua cookie, không tự đổi khi đổi công ty.
export const hangHoaKeys = {
  all: ['hang-hoa'] as const,
  list: (companyId: string | null, params: HangHoaListParams) =>
    [...hangHoaKeys.all, companyId, 'list', params] as const,
  detail: (companyId: string | null, maVt: string) =>
    [...hangHoaKeys.all, companyId, 'detail', maVt] as const,
  lookups: (companyId: string | null) => [...hangHoaKeys.all, companyId, 'lookups'] as const,
};

export function useHangHoaList(
  params: HangHoaListParams,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hangHoaKeys.list(currentCompanyId, params),
    queryFn: () => listHangHoa(params),
    placeholderData: (prev) => prev, // giữ dữ liệu cũ khi đổi trang/tìm kiếm
    enabled: (options?.enabled ?? true) && isAuthenticated && !!currentCompanyId,
  });
}

export function useHangHoaDetail(maVt: string | null) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hangHoaKeys.detail(currentCompanyId, maVt ?? ''),
    queryFn: () => getHangHoa(maVt as string),
    enabled: isAuthenticated && !!currentCompanyId && !!maVt,
  });
}

/** Danh mục lookup ít đổi -> cache lâu. */
export function useLookups() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hangHoaKeys.lookups(currentCompanyId),
    queryFn: fetchLookups,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

function useInvalidateList() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: hangHoaKeys.all });
}

export function useCreateHangHoa() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: (body: HangHoaForm) => createHangHoa(body),
    onSuccess: invalidate,
  });
}

export function useUpdateHangHoa() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: ({ maVt, body }: { maVt: string; body: HangHoaForm }) =>
      updateHangHoa(maVt, body),
    onSuccess: invalidate,
  });
}

export function useDeleteHangHoa() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: (maVt: string) => deleteHangHoa(maVt),
    onSuccess: invalidate,
  });
}

export function useDoiMaHangHoa() {
  const invalidate = useInvalidateList();
  return useMutation({
    mutationFn: ({ ma_cu, ma_moi }: { ma_cu: string; ma_moi: string }) =>
      doiMaHangHoa(ma_cu, ma_moi),
    onSuccess: invalidate,
  });
}

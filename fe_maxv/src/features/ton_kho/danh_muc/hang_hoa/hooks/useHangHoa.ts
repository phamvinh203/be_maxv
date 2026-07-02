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
} from '@/features/ton_kho/danh_muc/hang_hoa/api/hangHoaApi';
import type {
  HangHoaForm,
  HangHoaListParams,
} from '@/features/ton_kho/danh_muc/hang_hoa/types';

export const hangHoaKeys = {
  all: ['hang-hoa'] as const,
  list: (params: HangHoaListParams) =>
    [...hangHoaKeys.all, 'list', params] as const,
  detail: (maVt: string) => [...hangHoaKeys.all, 'detail', maVt] as const,
  lookups: ['hang-hoa', 'lookups'] as const,
};

export function useHangHoaList(params: HangHoaListParams) {
  return useQuery({
    queryKey: hangHoaKeys.list(params),
    queryFn: () => listHangHoa(params),
    placeholderData: (prev) => prev, // giữ dữ liệu cũ khi đổi trang/tìm kiếm
  });
}

export function useHangHoaDetail(maVt: string | null) {
  return useQuery({
    queryKey: hangHoaKeys.detail(maVt ?? ''),
    queryFn: () => getHangHoa(maVt as string),
    enabled: !!maVt,
  });
}

/** Danh mục lookup ít đổi -> cache lâu. */
export function useLookups() {
  return useQuery({
    queryKey: hangHoaKeys.lookups,
    queryFn: fetchLookups,
    staleTime: 5 * 60 * 1000,
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

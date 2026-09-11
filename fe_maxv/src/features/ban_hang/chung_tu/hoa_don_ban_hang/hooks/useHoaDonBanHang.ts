import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createHoaDon,
  deleteHoaDon,
  getChiTiet,
  listHoaDon,
  updateHoaDon,
} from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/api/hoaDonBanHangApi';
import type {
  HoaDonListParams,
  HoaDonPayload,
} from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/types';

export const hoaDonKeys = {
  all: ['hoa-don-ban-hang'] as const,
  list: (params: HoaDonListParams) => ['hoa-don-ban-hang', 'list', params] as const,
  chiTiet: (sttRec: string) => ['hoa-don-ban-hang', 'chi-tiet', sttRec] as const,
};

/** Một trang danh sách theo `params` — giữ trang cũ trên màn hình trong lúc nạp trang mới. */
export function useHoaDonList(params: HoaDonListParams) {
  return useQuery({
    queryKey: hoaDonKeys.list(params),
    queryFn: () => listHoaDon(params),
    placeholderData: (prev) => prev,
  });
}

/** Nạp chi tiết dòng của 1 hóa đơn (chỉ khi có sttRec). */
export function useChiTiet(sttRec: string | null) {
  return useQuery({
    queryKey: hoaDonKeys.chiTiet(sttRec ?? ''),
    queryFn: () => getChiTiet(sttRec as string),
    enabled: !!sttRec,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: hoaDonKeys.all });
}

export function useCreateHoaDon() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: HoaDonPayload) => createHoaDon(body),
    onSuccess: invalidate,
  });
}

export function useUpdateHoaDon() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ sttRec, body }: { sttRec: string; body: HoaDonPayload }) =>
      updateHoaDon(sttRec, body),
    onSuccess: invalidate,
  });
}

export function useDeleteHoaDon() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (sttRec: string) => deleteHoaDon(sttRec),
    onSuccess: invalidate,
  });
}

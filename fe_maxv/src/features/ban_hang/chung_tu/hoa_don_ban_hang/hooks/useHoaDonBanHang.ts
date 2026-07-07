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
import type { HoaDonPayload } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/types';

export const hoaDonKeys = {
  all: ['hoa-don-ban-hang'] as const,
  list: ['hoa-don-ban-hang', 'list'] as const,
  chiTiet: (sttRec: string) => ['hoa-don-ban-hang', 'chi-tiet', sttRec] as const,
};

export function useHoaDonList() {
  return useQuery({
    queryKey: hoaDonKeys.list,
    queryFn: () => listHoaDon(),
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

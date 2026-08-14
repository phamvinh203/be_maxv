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
} from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/api/hoaDonBanHangApi';
import type { HoaDonPayload } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types';
import { useAuth } from '@/features/auth/useAuth';

// Mọi key đều gắn companyId — API theo tenant qua cookie, không tự đổi khi đổi công ty.
export const hoaDonKeys = {
  all: ['hoa-don-ban-hang'] as const,
  list: (companyId: string | null) => ['hoa-don-ban-hang', companyId, 'list'] as const,
  chiTiet: (companyId: string | null, sttRec: string) =>
    ['hoa-don-ban-hang', companyId, 'chi-tiet', sttRec] as const,
};

export function useHoaDonList() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hoaDonKeys.list(currentCompanyId),
    queryFn: () => listHoaDon(),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Nạp chi tiết dòng của 1 hóa đơn (chỉ khi có sttRec). */
export function useChiTiet(sttRec: string | null) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hoaDonKeys.chiTiet(currentCompanyId, sttRec ?? ''),
    queryFn: () => getChiTiet(sttRec as string),
    enabled: isAuthenticated && !!currentCompanyId && !!sttRec,
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

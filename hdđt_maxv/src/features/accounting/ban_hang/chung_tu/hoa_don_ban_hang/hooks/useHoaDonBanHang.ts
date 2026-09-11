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
import type {
  HoaDonListParams,
  HoaDonPayload,
} from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types';
import { useAuth } from '@/features/auth/useAuth';

// Mọi key đều gắn companyId — API theo tenant qua cookie, không tự đổi khi đổi công ty.
export const hoaDonKeys = {
  all: ['hoa-don-ban-hang'] as const,
  list: (companyId: string | null, params: HoaDonListParams) =>
    ['hoa-don-ban-hang', companyId, 'list', params] as const,
  chiTiet: (companyId: string | null, sttRec: string) =>
    ['hoa-don-ban-hang', companyId, 'chi-tiet', sttRec] as const,
};

/** BE phân trang server-side — truyền `page/pageSize/q` để lấy đúng trang đang xem. */
export function useHoaDonList(params: HoaDonListParams = {}) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: hoaDonKeys.list(currentCompanyId, params),
    queryFn: () => listHoaDon(params),
    // RVW-N07: không giữ placeholder qua lần đổi công ty — tránh hiện data tenant cũ
    // dưới tên công ty mới trong lúc chờ refetch.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === currentCompanyId ? prev : undefined,
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

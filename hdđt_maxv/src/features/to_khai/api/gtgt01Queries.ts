import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { toKhaiKeys } from "./toKhaiQueries";
import {
  getBan,
  getDanhSachKy,
  postDoiTrangThai,
  postTinh,
  putGhiDe,
  putPhuLuc,
  type GhiDeItem,
} from "./gtgt01";
import type { Ky } from "../ky";

/** Khóa query của phần tờ khai — nằm dưới cùng prefix `toKhaiKeys.byCompany` để invalidate chung. */
export const gtgt01Keys = {
  ban: (companyId: string | null, ky: Ky) => ["toKhai", companyId, "gtgt01", ky] as const,
  danhSach: (companyId: string | null) => ["toKhai", companyId, "gtgt01", "danhSach"] as const,
};

/**
 * Bản tờ khai của kỳ. `retry: false` vì kỳ chưa lập trả 404 — đó là trạng thái BÌNH THƯỜNG
 * (chưa bấm "Lập tờ khai"), thử lại chỉ tốn request.
 */
export function useBanToKhaiQuery(ky: Ky, enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: gtgt01Keys.ban(currentCompanyId, ky),
    queryFn: () => getBan(ky),
    enabled: enabled && isAuthenticated && !!currentCompanyId,
    retry: false,
  });
}

export function useDanhSachKyQuery(enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: gtgt01Keys.danhSach(currentCompanyId),
    queryFn: getDanhSachKy,
    enabled: enabled && isAuthenticated && !!currentCompanyId,
  });
}

/** Mọi mutation làm mới chung prefix của mô-đun: bản trả về đã đủ, chỉ cần cache khớp lại. */
function useLamMoi() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return () => qc.invalidateQueries({ queryKey: toKhaiKeys.byCompany(currentCompanyId) });
}

export function useTinhToKhai() {
  const lamMoi = useLamMoi();
  return useMutation({ mutationFn: (ky: Ky) => postTinh(ky), onSuccess: lamMoi });
}

export function useLuuGhiDe() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; ghiDe: Record<string, GhiDeItem> }) => putGhiDe(v.ky, v.ghiDe),
    onSuccess: lamMoi,
  });
}

/** Sửa mô tả hàng hóa trên phụ lục giảm thuế. */
export function useLuuPhuLuc() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; ten: { muaVao?: string; banRa?: string } }) =>
      putPhuLuc(v.ky, v.ten),
    onSuccess: lamMoi,
  });
}

export function useDoiTrangThai() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; chot: boolean }) => postDoiTrangThai(v.ky, v.chot),
    onSuccess: lamMoi,
  });
}

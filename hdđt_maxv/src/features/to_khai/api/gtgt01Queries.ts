import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import {
  getBan,
  getDanhSachKy,
  postDoiTrangThai,
  postTinh,
  putGhiDe,
  putPhuLuc,
  type BanToKhai,
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

/**
 * Nhận bản tờ khai mới về: đặt thẳng vào cache của đúng kỳ đó, và chỉ làm mới thêm danh sách kỳ.
 *
 * Trước đây mọi mutation invalidate cả prefix `toKhai/{companyId}` — kéo theo bảng kê của CẢ HAI
 * chiều bị đánh dấu cũ, nên sửa một ô như [22] (chẳng đụng gì tới hóa đơn) cũng làm lần sau mở tab
 * hóa đơn phải tải lại toàn bộ danh sách. Bản trả về đã đủ dùng, không cần GET lại.
 *
 * Danh sách kỳ vẫn phải làm mới vì [40]/[43]/trạng thái của kỳ này đổi theo.
 */
function useNhanBanMoi() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return (ban: BanToKhai, ky: Ky) => {
    qc.setQueryData(gtgt01Keys.ban(currentCompanyId, ky), ban);
    void qc.invalidateQueries({ queryKey: gtgt01Keys.danhSach(currentCompanyId) });
  };
}

export function useTinhToKhai() {
  const nhan = useNhanBanMoi();
  return useMutation({
    mutationFn: (ky: Ky) => postTinh(ky),
    onSuccess: (ban, ky) => nhan(ban, ky),
  });
}

export function useLuuGhiDe() {
  const nhan = useNhanBanMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; ghiDe: Record<string, GhiDeItem> }) => putGhiDe(v.ky, v.ghiDe),
    onSuccess: (ban, v) => nhan(ban, v.ky),
  });
}

/** Sửa mô tả hàng hóa trên phụ lục giảm thuế. */
export function useLuuPhuLuc() {
  const nhan = useNhanBanMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; ten: { muaVao?: string; banRa?: string } }) =>
      putPhuLuc(v.ky, v.ten),
    onSuccess: (ban, v) => nhan(ban, v.ky),
  });
}

export function useDoiTrangThai() {
  const nhan = useNhanBanMoi();
  return useMutation({
    mutationFn: (v: { ky: Ky; chot: boolean }) => postDoiTrangThai(v.ky, v.chot),
    onSuccess: (ban, v) => nhan(ban, v.ky),
  });
}

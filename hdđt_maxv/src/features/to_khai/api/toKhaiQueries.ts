import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import {
  getBangKe,
  getPhuSongKy,
  patchQuyetDinh,
  postKeKhai,
  type QuyetDinhKeKhai,
} from "./toKhai";
import type { Ky } from "../ky";
import type { InvoiceDirection } from "../../hddt/types";

// Khóa gắn `companyId` vì tờ khai nằm ở DB riêng từng tenant — đổi công ty là đổi key, không rò
// dữ liệu công ty cũ (cùng quy ước `invoiceKeys` bên mô-đun hóa đơn).
export const toKhaiKeys = {
  byCompany: (companyId: string | null) => ["toKhai", companyId] as const,
  bangKe: (companyId: string | null, ky: Ky, chieu: InvoiceDirection) =>
    ["toKhai", companyId, "bangKe", ky, chieu] as const,
};

/**
 * Kỳ đã đồng bộ hóa đơn trọn vẹn chưa — dialog "Kê khai" gọi mỗi khi đổi kỳ.
 *
 * Không cache lâu: người dùng thường mở dialog, thấy cảnh báo, sang đồng bộ rồi quay lại ngay —
 * đọc lại `sync_log` là một truy vấn nhẹ, rẻ hơn nhiều so với việc hiện cảnh báo đã lỗi thời.
 */
export function usePhuSongKyQuery(ky: Ky, enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: ["toKhai", currentCompanyId, "phuSong", ky] as const,
    queryFn: () => getPhuSongKy(ky),
    enabled: enabled && isAuthenticated && !!currentCompanyId,
    staleTime: 0,
  });
}

/** Bảng kê một kỳ/một chiều. `enabled=false` cho tab đang ẩn để khỏi gọi API thừa. */
export function useBangKeQuery(ky: Ky, chieu: InvoiceDirection, enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: toKhaiKeys.bangKe(currentCompanyId, ky, chieu),
    queryFn: () => getBangKe(ky, chieu),
    enabled: enabled && isAuthenticated && !!currentCompanyId,
  });
}

/**
 * Lượt "Kê khai" — gán hóa đơn vào kỳ. Xong thì bỏ toàn bộ cache của mô-đun tờ khai: kỳ vừa gán
 * (và cả kỳ CŨ mà hóa đơn vừa bị chuyển đi) đều đổi nội dung, mà cache theo từng kỳ nên không
 * biết trước kỳ nào bị ảnh hưởng.
 */
export function useKeKhaiMutation() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return useMutation({
    mutationFn: (ky: Ky) => postKeKhai(ky),
    onSuccess: () => qc.invalidateQueries({ queryKey: toKhaiKeys.byCompany(currentCompanyId) }),
  });
}

/**
 * Sửa quyết định kê khai của một dòng trên bảng kê.
 *
 * Làm mới cả prefix của mô-đun thay vì chỉ bảng kê đang xem: hai cột này là đầu vào của lượt tính
 * tờ khai, nên bản tờ khai đã lập của kỳ cũng phải được coi là cũ sau khi đổi.
 */
export function useSuaQuyetDinhMutation() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return useMutation({
    mutationFn: (v: { chieu: InvoiceDirection; id: string; quyetDinh: QuyetDinhKeKhai }) =>
      patchQuyetDinh(v.chieu, v.id, v.quyetDinh),
    onSuccess: () => qc.invalidateQueries({ queryKey: toKhaiKeys.byCompany(currentCompanyId) }),
  });
}

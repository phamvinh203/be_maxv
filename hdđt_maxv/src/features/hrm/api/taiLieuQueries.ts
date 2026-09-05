/**
 * Hook hồ sơ / tài liệu chạy trên API THẬT — bản thay thế của `mock/hooks/taiLieu.ts`.
 * Giữ nguyên chữ ký hook bản mock, riêng `useTaiLieuList` trả thêm trạng thái tải (tab nằm
 * trong hồ sơ nhân viên, mảng rỗng lúc lỗi mạng đọc thành "chưa có giấy tờ nào").
 *
 * Hai chỗ quy đổi: ngày cấp ISO <-> `YYYY-MM-DD` của ô nhập, và các ô trống null <-> "".
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmTaiLieuKeys } from "./hrmKeys";
import type { LoaiTaiLieu, TaiLieu, TaiLieuFormValues } from "../types";
import {
  createTaiLieu,
  deleteTaiLieu,
  listTaiLieu,
  updateTaiLieu,
  type TaiLieuApiBody,
  type TaiLieuApiRow,
} from "./taiLieuApi";

/** ISO của BE -> `YYYY-MM-DD` cho `<input type="date">`. */
function veNgayInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function veKieuFe(r: TaiLieuApiRow): TaiLieu {
  return {
    id: r.id,
    ma_nv: r.ma_nv,
    // BE để loại giấy tờ là chữ tự do (còn sổ BHXH, giấy khám sức khỏe… ngoài danh mục FE);
    // ép kiểu về union hiển thị, chỗ nào không khớp thì `nhan()` tự hiện nguyên chữ.
    loai: r.loai as LoaiTaiLieu,
    so_hieu: r.so_hieu ?? "",
    ngay_cap: veNgayInput(r.ngay_cap),
    noi_cap: r.noi_cap ?? "",
    ghi_chu: r.ghi_chu ?? "",
  };
}

function veKieuApi(values: TaiLieuFormValues): TaiLieuApiBody {
  return {
    loai: values.loai,
    so_hieu: values.so_hieu.trim() || null,
    ngay_cap: values.ngay_cap.trim() || null,
    noi_cap: values.noi_cap.trim() || null,
    ghi_chu: values.ghi_chu.trim() || null,
  };
}

/**
 * Lấy toàn bộ tài liệu của công ty rồi lọc ở client — cùng lý do với người phụ thuộc: danh mục
 * nhỏ, và một query dùng chung thì sửa ở tab này là mọi nơi khác thấy ngay.
 */
function useDanhSachTaiLieu() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData: (prev) => prev` — xem ghi chú cùng loại ở các file api khác:
  // nó giữ dữ liệu cũ xuyên qua việc đổi công ty.
  return useQuery({
    queryKey: hrmTaiLieuKeys.list(currentCompanyId),
    queryFn: () => listTaiLieu(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Hồ sơ giấy tờ của một nhân viên, kèm trạng thái tải. */
export function useTaiLieuList(maNv: string | null): {
  items: TaiLieu[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachTaiLieu();
  const items = useMemo(
    () =>
      maNv ? (data ?? []).filter((r) => r.ma_nv === maNv).map(veKieuFe) : [],
    [data, maNv],
  );
  return { items, isLoading, isError, error };
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: hrmTaiLieuKeys.all });
}

/**
 * Thêm mới hoặc sửa. Không truyền `id` là thêm.
 * Luật "nhân viên phải tồn tại" và định dạng ngày do BE chặn, thông điệp hiện thẳng lên toast.
 */
export function useLuuTaiLieu() {
  const lamMoi = useLamMoi();
  const them = useMutation({ mutationFn: createTaiLieu, onSuccess: lamMoi });
  const sua = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaiLieuApiBody }) =>
      updateTaiLieu(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maNv: string, values: TaiLieuFormValues, id?: string) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      if (!values.loai) throw new Error("Chưa chọn loại tài liệu.");

      const body = veKieuApi(values);
      if (id) await sua.mutateAsync({ id, body });
      else await them.mutateAsync({ ...body, ma_nv: maNv });
    },
    [them, sua],
  );
}

export function useXoaTaiLieu() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deleteTaiLieu, onSuccess: lamMoi });

  return useCallback(
    async (id: string) => {
      await xoa.mutateAsync(id);
    },
    [xoa],
  );
}

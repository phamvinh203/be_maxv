/** Hook nghiệp vụ hồ sơ/tài liệu. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import type { TaiLieu, TaiLieuFormValues } from "../../types";
import { sinhId } from "../store";
import { useHrmStore } from "../useHrmStore";

export function useTaiLieuList(maNv: string | null): TaiLieu[] {
  const { state } = useHrmStore();
  return useMemo(
    () => (maNv ? state.taiLieu.filter((tl) => tl.ma_nv === maNv) : []),
    [state.taiLieu, maNv],
  );
}

/** Thêm mới hoặc sửa. Không truyền `id` là thêm. */
export function useLuuTaiLieu() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string, values: TaiLieuFormValues, id?: string) => {
      if (!values.loai) throw new Error("Chưa chọn loại tài liệu.");

      const taiLieu: TaiLieu = {
        ...values,
        so_hieu: values.so_hieu.trim(),
        id: id ?? sinhId("TL"),
        ma_nv: maNv,
      };
      dispatch(id ? { type: "taiLieu/sua", taiLieu } : { type: "taiLieu/them", taiLieu });
    },
    [dispatch],
  );
}

export function useXoaTaiLieu() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (id: string) => {
      dispatch({ type: "taiLieu/xoa", id });
    },
    [dispatch],
  );
}

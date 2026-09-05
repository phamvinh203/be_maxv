/**
 * Hook nghiệp vụ hợp đồng lao động — BẢN MOCK, KHÔNG CÒN MÀN NÀO DÙNG.
 *
 * Tab Lịch sử hợp đồng và các dialog liên quan đã chuyển sang API thật ở
 * `../../api/hopDongQueries.ts`. Giữ file lại vì kho mock vẫn còn dữ liệu hợp đồng phục vụ
 * các màn lương chưa nối API. Đừng import từ đây cho màn mới.
 *
 * Xem ghi chú về chữ ký ở `hooks/phongBan.ts`.
 */

import { useCallback, useMemo } from "react";
import type { HopDong, HopDongFormValues } from "../../types";
import { sinhId } from "../store";
import { useHrmStore } from "../useHrmStore";

/** Lịch sử hợp đồng của một nhân viên, mới nhất lên đầu. */
export function useHopDongList(maNv: string | null): HopDong[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    if (!maNv) return [];
    return state.hopDong
      .filter((hd) => hd.ma_nv === maNv)
      .sort((a, b) => b.ngay_bat_dau.localeCompare(a.ngay_bat_dau));
  }, [state.hopDong, maNv]);
}

/** Thêm mới hoặc sửa. Không truyền `id` là thêm. */
export function useLuuHopDong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string, values: HopDongFormValues, id?: string) => {
      if (!values.so_hd.trim()) throw new Error("Số hợp đồng không được để trống.");
      if (!values.ngay_bat_dau) throw new Error("Ngày bắt đầu không được để trống.");
      if (values.ngay_ket_thuc && values.ngay_ket_thuc < values.ngay_bat_dau) {
        throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
      }

      const hopDong: HopDong = {
        ...values,
        so_hd: values.so_hd.trim(),
        id: id ?? sinhId("HD"),
        ma_nv: maNv,
      };
      dispatch(id ? { type: "hopDong/sua", hopDong } : { type: "hopDong/them", hopDong });
    },
    [dispatch],
  );
}

/**
 * Chốt hợp đồng hiện hành rồi ký hợp đồng mới, trong một lần ghi.
 *
 * `idCu` là `null` khi nhân viên chưa có hợp đồng nào — lúc đó chỉ tạo mới,
 * không có gì để chốt.
 */
export function useDoiHopDong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (
      maNv: string,
      idCu: string | null,
      ngayChot: string,
      values: HopDongFormValues,
    ) => {
      if (idCu && !ngayChot) throw new Error("Chưa chọn ngày chốt hợp đồng hiện tại.");
      if (!values.so_hd.trim()) throw new Error("Số hợp đồng mới không được để trống.");
      if (!values.ngay_bat_dau) throw new Error("Hợp đồng mới phải có ngày bắt đầu.");
      // Bắt đầu trước hoặc đúng ngày chốt sẽ có hai hợp đồng cùng hiệu lực, và
      // luật chọn "hợp đồng hiện hành" sẽ trả về cái nào cũng đúng như nhau.
      if (idCu && values.ngay_bat_dau <= ngayChot) {
        throw new Error("Hợp đồng mới phải bắt đầu sau ngày chốt hợp đồng hiện tại.");
      }
      if (values.ngay_ket_thuc && values.ngay_ket_thuc < values.ngay_bat_dau) {
        throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
      }

      dispatch({
        type: "hopDong/doi",
        idCu,
        ngayChot,
        hopDongMoi: {
          ...values,
          so_hd: values.so_hd.trim(),
          id: sinhId("HD"),
          ma_nv: maNv,
        },
      });
    },
    [dispatch],
  );
}

export function useXoaHopDong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (id: string) => {
      dispatch({ type: "hopDong/xoa", id });
    },
    [dispatch],
  );
}

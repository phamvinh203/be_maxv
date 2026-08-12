/** Hook nghiệp vụ danh mục lương & phụ cấp. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import type { KhoanLuong, KhoanLuongFormValues, LoaiKhoanLuong } from "../../types";
import { useHrmStore } from "../useHrmStore";

export interface KhoanLuongFilters {
  q: string;
  /** Rỗng = mọi loại. */
  loai: LoaiKhoanLuong | "";
}

export function useKhoanLuongList(): KhoanLuong[] {
  return useHrmStore().state.khoanLuong;
}

export function useKhoanLuongRows(filters: KhoanLuongFilters): KhoanLuong[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const tuKhoa = filters.q.trim().toLowerCase();
    return state.khoanLuong.filter((kl) => {
      if (filters.loai && kl.loai !== filters.loai) return false;
      if (!tuKhoa) return true;
      return [kl.ma_khoan, kl.ten_khoan, kl.ghi_chu].some((truong) =>
        truong.toLowerCase().includes(tuKhoa),
      );
    });
  }, [state.khoanLuong, filters]);
}

/** Đếm số khoản theo từng loại — hiện lên nút ở cột "Tạo danh mục". */
export function useSoKhoanTheoLoai(): Map<LoaiKhoanLuong, number> {
  const { state } = useHrmStore();
  return useMemo(() => {
    const dem = new Map<LoaiKhoanLuong, number>();
    for (const kl of state.khoanLuong) {
      dem.set(kl.loai, (dem.get(kl.loai) ?? 0) + 1);
    }
    return dem;
  }, [state.khoanLuong]);
}

/** Thêm mới hoặc sửa. Không truyền `maKhoan` là thêm — mã sinh tự động. */
export function useLuuKhoanLuong() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: KhoanLuongFormValues, maKhoan?: string) => {
      const tenKhoan = values.ten_khoan.trim();
      if (!tenKhoan) throw new Error("Tên khoản không được để trống.");

      // Trùng tên trong cùng một loại gần như chắc chắn là bấm nhầm hai lần —
      // hai khoản cùng tên sẽ không phân biệt được khi dựng bảng lương.
      const trung = state.khoanLuong.some(
        (kl) =>
          kl.ma_khoan !== maKhoan &&
          kl.loai === values.loai &&
          kl.ten_khoan.trim().toLowerCase() === tenKhoan.toLowerCase(),
      );
      if (trung) throw new Error(`Đã có khoản tên "${tenKhoan}" trong loại này.`);

      if (maKhoan) {
        const cu = state.khoanLuong.find((kl) => kl.ma_khoan === maKhoan);
        if (!cu) throw new Error("Khoản lương không còn tồn tại.");
        dispatch({
          type: "khoanLuong/sua",
          khoan: { ...values, ten_khoan: tenKhoan, ma_khoan: maKhoan },
        });
        return;
      }

      const daDung = new Set(state.khoanLuong.map((kl) => kl.ma_khoan));
      let maMoi = "";
      for (let i = 1; i <= 999 && !maMoi; i += 1) {
        const ma = `KL${String(i).padStart(2, "0")}`;
        if (!daDung.has(ma)) maMoi = ma;
      }
      if (!maMoi) throw new Error("Đã đạt giới hạn số khoản lương.");

      dispatch({
        type: "khoanLuong/them",
        khoan: { ...values, ten_khoan: tenKhoan, ma_khoan: maMoi },
      });
    },
    [state.khoanLuong, dispatch],
  );
}

export function useXoaKhoanLuong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maKhoan: string) => {
      dispatch({ type: "khoanLuong/xoa", maKhoan });
    },
    [dispatch],
  );
}

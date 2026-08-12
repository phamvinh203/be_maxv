/**
 * Hook nghiệp vụ người phụ thuộc.
 *
 * Hai lối vào — tab trong hồ sơ nhân viên và màn hình độc lập — dùng chung các
 * hook này, chỉ khác chỗ lấy `ma_nv`: tab lấy từ nhân viên đang mở, màn hình
 * độc lập lấy từ ô chọn nhân viên trên form.
 */

import { useCallback, useMemo } from "react";
import type {
  NguoiPhuThuoc,
  NguoiPhuThuocFormValues,
  NguoiPhuThuocRow,
} from "../../types";
import { sinhId } from "../store";
import { useHrmStore } from "../useHrmStore";

/** Người phụ thuộc của một nhân viên. */
export function useNguoiPhuThuocList(maNv: string | null): NguoiPhuThuoc[] {
  const { state } = useHrmStore();
  return useMemo(
    () => (maNv ? state.nguoiPhuThuoc.filter((npt) => npt.ma_nv === maNv) : []),
    [state.nguoiPhuThuoc, maNv],
  );
}

/** Toàn công ty, kèm tên nhân viên — cho màn hình độc lập. `q` lọc theo tên/mã/CCCD. */
export function useNguoiPhuThuocRows(q: string): NguoiPhuThuocRow[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const tenNvTheoMa = new Map(state.nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));
    const tuKhoa = q.trim().toLowerCase();
    return state.nguoiPhuThuoc
      .map((npt) => ({
        ...npt,
        ten_nv: tenNvTheoMa.get(npt.ma_nv) ?? npt.ma_nv,
      }))
      .filter((row) => {
        if (!tuKhoa) return true;
        return [row.ma_nv, row.ten_nv, row.ho_ten, row.so_cccd, row.mst_ca_nhan].some(
          (truong) => truong.toLowerCase().includes(tuKhoa),
        );
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv) || a.ho_ten.localeCompare(b.ho_ten));
  }, [state.nguoiPhuThuoc, state.nhanVien, q]);
}

/** Thêm mới hoặc sửa. Không truyền `id` là thêm. */
export function useLuuNguoiPhuThuoc() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string, values: NguoiPhuThuocFormValues, id?: string) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      if (!values.ho_ten.trim()) throw new Error("Họ và tên người phụ thuộc không được để trống.");
      if (!state.nhanVien.some((nv) => nv.ma_nv === maNv)) {
        throw new Error("Nhân viên không còn tồn tại.");
      }
      if (
        values.gt_tu_thang &&
        values.gt_den_thang &&
        values.gt_den_thang < values.gt_tu_thang
      ) {
        throw new Error("Tháng kết thúc giảm trừ phải sau tháng bắt đầu.");
      }

      const npt: NguoiPhuThuoc = {
        ...values,
        ho_ten: values.ho_ten.trim(),
        id: id ?? sinhId("NPT"),
        ma_nv: maNv,
      };
      dispatch(id ? { type: "npt/sua", npt } : { type: "npt/them", npt });
    },
    [state.nhanVien, dispatch],
  );
}

export function useXoaNguoiPhuThuoc() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (id: string) => {
      dispatch({ type: "npt/xoa", id });
    },
    [dispatch],
  );
}

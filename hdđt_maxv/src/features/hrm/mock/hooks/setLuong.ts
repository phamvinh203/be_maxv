/** Hook nghiệp vụ Set lương. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { hopDongHienHanh } from "../../cay";
import { CHUC_VU } from "../../constants";
import { homNay, nhan } from "../../format";
import type {
  CauTrucLuong,
  DongCauTrucLuong,
  SetLuongFilters,
  SetLuongNhanVien,
  SetLuongRow,
} from "../../types";
import { useHrmStore } from "../useHrmStore";

export function useCauTrucLuong(): CauTrucLuong {
  return useHrmStore().state.cauTrucLuong;
}

/** Tổng của một bản set lương. */
export function tongLuong(ban: SetLuongNhanVien): number {
  return Object.values(ban.khoan).reduce((tong, tien) => tong + tien, 0);
}

export function useSetLuongList(): SetLuongNhanVien[] {
  return useHrmStore().state.setLuong;
}

export function useSetLuongCuaNhanVien(maNv: string | null): SetLuongNhanVien | null {
  const { state } = useHrmStore();
  return useMemo(
    () => (maNv ? (state.setLuong.find((sl) => sl.ma_nv === maNv) ?? null) : null),
    [state.setLuong, maNv],
  );
}

/**
 * Danh sách nhân viên kèm tình trạng set lương.
 *
 * Chỉ lấy người **đang làm**: set lương cho người đã nghỉ không đi vào kỳ lương
 * nào, chỉ làm hai bộ đếm "đã set / chưa set" sai.
 */
export function useSetLuongRows(filters: SetLuongFilters): SetLuongRow[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const banTheoNv = new Map(state.setLuong.map((sl) => [sl.ma_nv, sl]));
    const moc = homNay();
    const tuKhoa = filters.q.trim().toLowerCase();

    return state.nhanVien
      .filter((nv) => nv.status === "1")
      .map((nv): SetLuongRow => {
        const ban = banTheoNv.get(nv.ma_nv);
        const hd = hopDongHienHanh(
          state.hopDong.filter((item) => item.ma_nv === nv.ma_nv),
          moc,
        );
        return {
          ma_nv: nv.ma_nv,
          ho_ten: nv.ho_ten,
          ten_cv: nv.ma_cv ? nhan(CHUC_VU, nv.ma_cv) : "",
          loai_hd: hd?.loai_hd ?? null,
          so_tk: nv.so_tk,
          daSet: Boolean(ban),
          lan_thiet_lap: ban?.lan_thiet_lap ?? 0,
          hieu_luc_tu: ban?.hieu_luc_tu ?? "",
          hieu_luc_den: ban?.hieu_luc_den ?? "",
          tong_luong: ban ? tongLuong(ban) : 0,
          trang_thai: ban?.trang_thai ?? null,
        };
      })
      .filter((row) => {
        if (row.daSet !== filters.daSet) return false;
        if (filters.loai_hd && row.loai_hd !== filters.loai_hd) return false;
        if (filters.ma_pb) {
          const nv = state.nhanVien.find((item) => item.ma_nv === row.ma_nv);
          if (nv?.ma_pb !== filters.ma_pb) return false;
        }
        if (!tuKhoa) return true;
        return [row.ma_nv, row.ho_ten, row.so_tk].some((truong) =>
          truong.toLowerCase().includes(tuKhoa),
        );
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [state.nhanVien, state.hopDong, state.setLuong, filters]);
}

/** Đếm cho hai nhãn "Đã set lương" / "Chưa set lương". */
export function useDemSetLuong(): { daSet: number; chuaSet: number } {
  const { state } = useHrmStore();
  return useMemo(() => {
    const coBan = new Set(state.setLuong.map((sl) => sl.ma_nv));
    const dangLam = state.nhanVien.filter((nv) => nv.status === "1");
    const daSet = dangLam.filter((nv) => coBan.has(nv.ma_nv)).length;
    return { daSet, chuaSet: dangLam.length - daSet };
  }, [state.nhanVien, state.setLuong]);
}

export function useLuuCauTrucLuong() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (cauTruc: CauTrucLuong) => {
      if (!cauTruc.tu_ngay) throw new Error("Chưa chọn ngày bắt đầu hiệu lực.");
      if (cauTruc.den_ngay && cauTruc.den_ngay < cauTruc.tu_ngay) {
        throw new Error("Ngày kết thúc hiệu lực phải sau ngày bắt đầu.");
      }
      if (cauTruc.dong.length === 0) {
        throw new Error("Cấu trúc lương phải có ít nhất một khoản.");
      }
      const laKhoanThat = new Set(state.khoanLuong.map((kl) => kl.ma_khoan));
      const lac = cauTruc.dong.filter((d) => !laKhoanThat.has(d.ma_khoan));
      if (lac.length > 0) {
        throw new Error("Cấu trúc có khoản không còn trong danh mục, hãy bỏ khoản đó ra.");
      }
      dispatch({ type: "cauTrucLuong/luu", cauTruc });
    },
    [state.khoanLuong, dispatch],
  );
}

/** Lưu set lương của một nhân viên. Mỗi lần lưu tăng "Lần thiết lập" thêm một. */
export function useLuuSetLuong() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string, khoan: Record<string, number>) => {
      if (!state.nhanVien.some((nv) => nv.ma_nv === maNv)) {
        throw new Error("Nhân viên không còn tồn tại.");
      }
      const tong = Object.values(khoan).reduce((cong, tien) => cong + tien, 0);
      if (tong <= 0) throw new Error("Tổng lương phải lớn hơn 0.");

      const cu = state.setLuong.find((sl) => sl.ma_nv === maNv);
      dispatch({
        type: "setLuong/luu",
        ban: {
          ma_nv: maNv,
          lan_thiet_lap: (cu?.lan_thiet_lap ?? 0) + 1,
          hieu_luc_tu: state.cauTrucLuong.tu_ngay,
          hieu_luc_den: state.cauTrucLuong.den_ngay,
          khoan,
          // Sửa lại mức lương thì phải duyệt lại — giữ nguyên "đã duyệt" là để
          // lọt một thay đổi chưa ai xem qua vào kỳ lương.
          trang_thai: "cho_duyet",
        },
      });
    },
    [state.nhanVien, state.setLuong, state.cauTrucLuong, dispatch],
  );
}

export function useXoaSetLuong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "setLuong/xoa", maNv });
    },
    [dispatch],
  );
}

/** Duyệt toàn bộ bản set lương đang chờ. Trả về số bản đã duyệt. */
export function useDuyetLuong() {
  const { state, dispatch } = useHrmStore();
  return useCallback(async (): Promise<number> => {
    const can = state.setLuong.filter((sl) => sl.trang_thai !== "da_duyet");
    if (can.length === 0) return 0;
    dispatch({ type: "setLuong/duyet", danhSachMaNv: can.map((sl) => sl.ma_nv) });
    return can.length;
  }, [state.setLuong, dispatch]);
}

/** Mức mặc định của một khoản, lấy từ cấu trúc lương đang áp dụng. */
export function mucMacDinh(cauTruc: CauTrucLuong, maKhoan: string): number {
  return cauTruc.dong.find((d: DongCauTrucLuong) => d.ma_khoan === maKhoan)?.so_tien ?? 0;
}

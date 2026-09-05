/**
 * Hook nghiệp vụ nhân viên — BẢN MOCK.
 *
 * ĐỌC TRƯỚC KHI DÙNG: màn Nhân viên (bảng, form thêm/sửa, dialog chi tiết) đã chuyển sang API
 * thật ở `../../api/nhanVienQueries.ts`. File này chỉ còn phục vụ các màn CHƯA nối API — các
 * dialog "Tái sử dụng…" của Dữ liệu lương, Set lương, form Người phụ thuộc và Gán nhanh phòng
 * ban — vì chúng vẫn đọc/ghi kho mock. Thêm màn mới thì dùng bản API, đừng import từ đây.
 *
 * Xem ghi chú về chữ ký ở `hooks/phongBan.ts`.
 */

import { useCallback, useMemo } from "react";
import { hopDongHienHanh, sinhMaNhanVien } from "../../cay";
import { CHUC_VU, PB_CHUA_GAN } from "../../constants";
import { homNay, nhan } from "../../format";
import type {
  HopDong,
  NhanVien,
  NhanVienFilters,
  NhanVienRow,
  ThemNhanVienPayload,
} from "../../types";
import { sinhId } from "../store";
import { useHrmStore } from "../useHrmStore";

/** Danh sách thô — dùng cho dialog Gán nhanh và ô chọn nhân viên. */
export function useNhanVienList(): NhanVien[] {
  return useHrmStore().state.nhanVien;
}

/** Mã gợi ý cho form thêm mới. Người dùng sửa lại được. */
export function useMaNhanVienMoi(): string {
  const { state } = useHrmStore();
  return useMemo(() => sinhMaNhanVien(state.nhanVien), [state.nhanVien]);
}

/** Danh sách đã lọc, kèm tên phòng ban, tên chức vụ, hợp đồng hiện hành, số NPT. */
export function useNhanVienRows(filters: NhanVienFilters): NhanVienRow[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const tenPbTheoMa = new Map(state.phongBan.map((pb) => [pb.ma_pb, pb.ten_pb]));

    const hopDongTheoNv = new Map<string, HopDong[]>();
    for (const hd of state.hopDong) {
      const nhom = hopDongTheoNv.get(hd.ma_nv);
      if (nhom) nhom.push(hd);
      else hopDongTheoNv.set(hd.ma_nv, [hd]);
    }

    const soNptTheoNv = new Map<string, number>();
    for (const npt of state.nguoiPhuThuoc) {
      soNptTheoNv.set(npt.ma_nv, (soNptTheoNv.get(npt.ma_nv) ?? 0) + 1);
    }

    const moc = homNay();
    const tuKhoa = filters.q.trim().toLowerCase();

    return state.nhanVien
      .filter((nv) => {
        if (filters.status && nv.status !== filters.status) return false;
        if (filters.ma_pb === PB_CHUA_GAN && nv.ma_pb) return false;
        if (filters.ma_pb && filters.ma_pb !== PB_CHUA_GAN && nv.ma_pb !== filters.ma_pb) {
          return false;
        }
        if (!tuKhoa) return true;
        return [nv.ma_nv, nv.ho_ten, nv.so_cccd, nv.dien_thoai].some((truong) =>
          truong.toLowerCase().includes(tuKhoa),
        );
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv))
      .map((nv) => ({
        ...nv,
        ten_pb: nv.ma_pb ? (tenPbTheoMa.get(nv.ma_pb) ?? nv.ma_pb) : "",
        ten_cv: nv.ma_cv ? nhan(CHUC_VU, nv.ma_cv) : "",
        hop_dong: hopDongHienHanh(hopDongTheoNv.get(nv.ma_nv) ?? [], moc),
        so_npt: soNptTheoNv.get(nv.ma_nv) ?? 0,
      }));
  }, [state, filters]);
}

/** Chi tiết một nhân viên — dialog sửa nạp từ đây. */
export function useNhanVienDetail(maNv: string | null): NhanVien | null {
  const { state } = useHrmStore();
  return useMemo(
    () => (maNv ? (state.nhanVien.find((nv) => nv.ma_nv === maNv) ?? null) : null),
    [state.nhanVien, maNv],
  );
}

/** Tạo nhân viên kèm hợp đồng đầu tiên (nếu có) trong một lần ghi. */
export function useThemNhanVien() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (payload: ThemNhanVienPayload) => {
      const maNv = payload.nhan_vien.ma_nv.trim();
      if (!maNv) throw new Error("Mã nhân viên không được để trống.");
      if (!payload.nhan_vien.ho_ten.trim()) throw new Error("Họ và tên không được để trống.");
      if (state.nhanVien.some((nv) => nv.ma_nv === maNv)) {
        throw new Error(`Mã nhân viên ${maNv} đã tồn tại.`);
      }
      if (payload.hop_dong && !payload.hop_dong.ngay_bat_dau) {
        throw new Error("Hợp đồng phải có ngày bắt đầu.");
      }

      dispatch({
        type: "nhanVien/them",
        nhanVien: { ...payload.nhan_vien, ma_nv: maNv, ho_ten: payload.nhan_vien.ho_ten.trim() },
        hopDong: payload.hop_dong
          ? { ...payload.hop_dong, id: sinhId("HD"), ma_nv: maNv }
          : null,
      });
    },
    [state.nhanVien, dispatch],
  );
}

export function useSuaNhanVien() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (nhanVien: NhanVien) => {
      if (!nhanVien.ho_ten.trim()) throw new Error("Họ và tên không được để trống.");
      if (!state.nhanVien.some((nv) => nv.ma_nv === nhanVien.ma_nv)) {
        throw new Error("Nhân viên không còn tồn tại, vui lòng tải lại danh sách.");
      }
      dispatch({
        type: "nhanVien/sua",
        nhanVien: { ...nhanVien, ho_ten: nhanVien.ho_ten.trim() },
      });
    },
    [state.nhanVien, dispatch],
  );
}

export function useXoaNhanVien() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "nhanVien/xoa", maNv });
    },
    [dispatch],
  );
}

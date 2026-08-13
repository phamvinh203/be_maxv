/** Hook nghiệp vụ Lương sản phẩm. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { nhanBanDongSanPham, tongTienSanPham } from "../../luongSanPham";
import type {
  BanLuongSanPhamNhanVien,
  DongLuongSanPham,
  LocNhanVienKyLuong,
  LuongSanPhamNhanVienRow,
  PhamViApDung,
  SanPham,
  SanPhamFormValues,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

export function useSanPhamList(): SanPham[] {
  return useHrmStore().state.sanPham;
}

/** Bảng đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauLuongSanPham(): DongLuongSanPham[] {
  return useHrmStore().state.mauLuongSanPham;
}

export function useBanLuongSanPhamList(): BanLuongSanPhamNhanVien[] {
  return useHrmStore().state.banLuongSanPham;
}

/** Danh sách nhân viên sẽ nhận bảng, kèm tổng tiền của bảng đã áp. */
export function useLuongSanPhamRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): LuongSanPhamNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);

  return useMemo(() => {
    const banTheoNv = new Map(state.banLuongSanPham.map((ban) => [ban.ma_nv, ban]));
    return nhanVien.map((row): LuongSanPhamNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      return {
        ...row,
        tien_luong: ban ? tongTienSanPham(ban.dong) : null,
        so_dong: ban?.dong.length ?? 0,
      };
    });
  }, [nhanVien, state.banLuongSanPham]);
}

/**
 * Kiểm tra bảng trước khi ghi.
 *
 * Dùng chung cho "Lưu thay đổi" và "Áp dụng lương SP" — hai nút ghi cùng một
 * bảng nên phải bắt cùng một bộ lỗi.
 */
function kiemTraBang(dong: DongLuongSanPham[], tenSanPham: (maSp: string) => string): void {
  const daGap = new Set<string>();
  for (const d of dong) {
    if (!d.ma_sp) {
      throw new Error("Còn dòng chưa chọn sản phẩm — chọn hoặc xóa dòng đó trước.");
    }
    if (daGap.has(d.ma_sp)) {
      throw new Error(`Sản phẩm "${tenSanPham(d.ma_sp)}" bị lặp trong bảng.`);
    }
    daGap.add(d.ma_sp);
    if (d.don_gia < 0 || d.so_luong < 0) {
      throw new Error("Đơn giá và số lượng không được âm.");
    }
  }
}

/** Tra tên sản phẩm để ghép vào thông điệp lỗi. Mã lạ thì trả lại chính nó. */
function useTenSanPham(): (maSp: string) => string {
  const { state } = useHrmStore();
  return useCallback(
    (maSp: string) => state.sanPham.find((sp) => sp.ma_sp === maSp)?.ten_sp ?? maSp,
    [state.sanPham],
  );
}

/** Lưu bảng đang soạn. Bảng rỗng vẫn lưu được — đó là cách xóa sạch bảng. */
export function useLuuMauLuongSanPham() {
  const { dispatch } = useHrmStore();
  const tenSanPham = useTenSanPham();
  return useCallback(
    async (dong: DongLuongSanPham[]) => {
      kiemTraBang(dong, tenSanPham);
      dispatch({ type: "luongSanPham/luuMau", dong });
    },
    [dispatch, tenSanPham],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * Ghi luôn vào `mauLuongSanPham` để bản nháp và bản đã lưu khớp nhau sau khi áp.
 */
export function useApDungLuongSanPham() {
  const { dispatch } = useHrmStore();
  const tenSanPham = useTenSanPham();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongLuongSanPham[]): Promise<number> => {
      if (dong.length === 0) throw new Error("Bảng lương sản phẩm chưa có dòng nào để áp.");
      kiemTraBang(dong, tenSanPham);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp lương sản phẩm.");
      }
      dispatch({ type: "luongSanPham/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng.
      dispatch({
        type: "luongSanPham/apDung",
        danhSachMaNv,
        dong: nhanBanDongSanPham(dong),
      });
      return danhSachMaNv.length;
    },
    [dispatch, tenSanPham],
  );
}

export function useXoaBanLuongSanPham() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "luongSanPham/xoaBan", maNv });
    },
    [dispatch],
  );
}

/** Thêm mới hoặc sửa sản phẩm. Không truyền `maSp` là thêm — mã sinh tự động. */
export function useLuuSanPham() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: SanPhamFormValues, maSp?: string) => {
      const tenSp = values.ten_sp.trim();
      if (!tenSp) throw new Error("Tên sản phẩm không được để trống.");
      if (values.don_gia < 0) throw new Error("Đơn giá không được âm.");

      // Hai sản phẩm trùng tên thì ô chọn chỉ hiện tên, không phân biệt được —
      // gần như chắc chắn là bấm tạo hai lần.
      const trung = state.sanPham.some(
        (sp) => sp.ma_sp !== maSp && sp.ten_sp.trim().toLowerCase() === tenSp.toLowerCase(),
      );
      if (trung) throw new Error(`Đã có sản phẩm tên "${tenSp}".`);

      if (maSp) {
        if (!state.sanPham.some((sp) => sp.ma_sp === maSp)) {
          throw new Error("Sản phẩm không còn tồn tại.");
        }
        dispatch({ type: "sanPham/sua", sanPham: { ...values, ten_sp: tenSp, ma_sp: maSp } });
        return;
      }

      const daDung = new Set(state.sanPham.map((sp) => sp.ma_sp));
      let maMoi = "";
      for (let i = 1; i <= 999 && !maMoi; i += 1) {
        const ma = `SP${String(i).padStart(2, "0")}`;
        if (!daDung.has(ma)) maMoi = ma;
      }
      if (!maMoi) throw new Error("Đã đạt giới hạn số sản phẩm.");

      dispatch({ type: "sanPham/them", sanPham: { ...values, ten_sp: tenSp, ma_sp: maMoi } });
    },
    [state.sanPham, dispatch],
  );
}

/**
 * Xóa một sản phẩm khỏi danh mục.
 *
 * Chặn khi sản phẩm còn nằm trong bảng đang soạn hoặc bảng đã áp cho nhân viên:
 * xóa đi thì các bảng đó mất tên sản phẩm và số tiền đã nghiệm thu không còn
 * giải thích được. Muốn dừng dùng thì chuyển trạng thái "Ngừng".
 */
export function useXoaSanPham() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maSp: string) => {
      const soNvDangDung = state.banLuongSanPham.filter((ban) =>
        ban.dong.some((d) => d.ma_sp === maSp),
      ).length;
      if (soNvDangDung > 0) {
        throw new Error(
          `Sản phẩm đang nằm trong bảng của ${soNvDangDung} nhân viên. Hãy chuyển sang trạng thái "Ngừng" thay vì xóa.`,
        );
      }
      if (state.mauLuongSanPham.some((d) => d.ma_sp === maSp)) {
        throw new Error("Sản phẩm đang nằm trong bảng đã lưu — bỏ dòng đó ra trước.");
      }
      dispatch({ type: "sanPham/xoa", maSp });
    },
    [state.banLuongSanPham, state.mauLuongSanPham, dispatch],
  );
}

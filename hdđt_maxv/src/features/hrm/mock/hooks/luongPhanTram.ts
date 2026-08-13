/** Hook nghiệp vụ Lương phần trăm. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { nhanBanDongPhanTram, tongTienPhanTram } from "../../luongPhanTram";
import type {
  BanLuongPhanTramNhanVien,
  DongLuongPhanTram,
  KhoanLuong,
  LocNhanVienKyLuong,
  LuongPhanTramNhanVienRow,
  PhamViApDung,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

/**
 * Các loại % chọn được ở bảng — lấy từ **Danh mục lương & phụ cấp**, lọc đúng
 * loại `luong_phan_tram`. Xem ghi chú ở `DongLuongPhanTram` về việc không dựng
 * danh mục riêng cho màn hình này.
 */
export function useKhoanPhanTramList(): KhoanLuong[] {
  const { state } = useHrmStore();
  return useMemo(
    () => state.khoanLuong.filter((kl) => kl.loai === "luong_phan_tram"),
    [state.khoanLuong],
  );
}

/** Bảng đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauLuongPhanTram(): DongLuongPhanTram[] {
  return useHrmStore().state.mauLuongPhanTram;
}

export function useBanLuongPhanTramList(): BanLuongPhanTramNhanVien[] {
  return useHrmStore().state.banLuongPhanTram;
}

/** Danh sách nhân viên sẽ nhận bảng, kèm tổng tiền của bảng đã áp. */
export function useLuongPhanTramRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): LuongPhanTramNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);

  return useMemo(() => {
    const banTheoNv = new Map(state.banLuongPhanTram.map((ban) => [ban.ma_nv, ban]));
    return nhanVien.map((row): LuongPhanTramNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      return {
        ...row,
        tien_luong: ban ? tongTienPhanTram(ban.dong) : null,
        so_dong: ban?.dong.length ?? 0,
      };
    });
  }, [nhanVien, state.banLuongPhanTram]);
}

/**
 * Kiểm tra bảng trước khi ghi.
 *
 * Dùng chung cho "Lưu thay đổi" và "Áp dụng lương %" — hai nút ghi cùng một
 * bảng nên phải bắt cùng một bộ lỗi.
 */
function kiemTraBang(dong: DongLuongPhanTram[], tenKhoan: (maKhoan: string) => string): void {
  const daGap = new Set<string>();
  for (const d of dong) {
    if (!d.ma_khoan) {
      throw new Error("Còn dòng chưa chọn loại % — chọn hoặc xóa dòng đó trước.");
    }
    if (daGap.has(d.ma_khoan)) {
      throw new Error(`Loại "${tenKhoan(d.ma_khoan)}" bị lặp trong bảng.`);
    }
    daGap.add(d.ma_khoan);
    if (d.ty_le < 0 || d.so_tien_co_so < 0) {
      throw new Error("Tỷ lệ và số tiền cơ sở không được âm.");
    }
  }
}

/** Tra tên khoản để ghép vào thông điệp lỗi. Mã lạ thì trả lại chính nó. */
function useTenKhoan(): (maKhoan: string) => string {
  const { state } = useHrmStore();
  return useCallback(
    (maKhoan: string) =>
      state.khoanLuong.find((kl) => kl.ma_khoan === maKhoan)?.ten_khoan ?? maKhoan,
    [state.khoanLuong],
  );
}

/** Lưu bảng đang soạn. Bảng rỗng vẫn lưu được — đó là cách xóa sạch bảng. */
export function useLuuMauLuongPhanTram() {
  const { dispatch } = useHrmStore();
  const tenKhoan = useTenKhoan();
  return useCallback(
    async (dong: DongLuongPhanTram[]) => {
      kiemTraBang(dong, tenKhoan);
      dispatch({ type: "luongPhanTram/luuMau", dong });
    },
    [dispatch, tenKhoan],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * Ghi luôn vào `mauLuongPhanTram` để bản nháp và bản đã lưu khớp nhau sau khi áp.
 */
export function useApDungLuongPhanTram() {
  const { dispatch } = useHrmStore();
  const tenKhoan = useTenKhoan();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongLuongPhanTram[]): Promise<number> => {
      if (dong.length === 0) throw new Error("Bảng lương phần trăm chưa có dòng nào để áp.");
      kiemTraBang(dong, tenKhoan);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp lương phần trăm.");
      }
      dispatch({ type: "luongPhanTram/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng.
      dispatch({
        type: "luongPhanTram/apDung",
        danhSachMaNv,
        dong: nhanBanDongPhanTram(dong),
      });
      return danhSachMaNv.length;
    },
    [dispatch, tenKhoan],
  );
}

export function useXoaBanLuongPhanTram() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "luongPhanTram/xoaBan", maNv });
    },
    [dispatch],
  );
}

/**
 * Xóa một loại % khỏi danh mục.
 *
 * Chặn khi khoản còn nằm trong bảng đang soạn, trong bảng đã áp cho nhân viên,
 * hoặc trong cấu trúc lương — cùng luật với `useXoaKhoanThuong`.
 */
export function useXoaKhoanPhanTram() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maKhoan: string) => {
      const soNvDangDung = state.banLuongPhanTram.filter((ban) =>
        ban.dong.some((d) => d.ma_khoan === maKhoan),
      ).length;
      if (soNvDangDung > 0) {
        throw new Error(
          `Loại % đang nằm trong bảng của ${soNvDangDung} nhân viên. Hãy chuyển sang trạng thái "Ngừng" thay vì xóa.`,
        );
      }
      if (state.mauLuongPhanTram.some((d) => d.ma_khoan === maKhoan)) {
        throw new Error("Loại % đang nằm trong bảng đã lưu — bỏ dòng đó ra trước.");
      }
      if (state.cauTrucLuong.dong.some((d) => d.ma_khoan === maKhoan)) {
        throw new Error("Loại % đang nằm trong cấu trúc lương của công ty.");
      }
      dispatch({ type: "khoanLuong/xoa", maKhoan });
    },
    [state.banLuongPhanTram, state.mauLuongPhanTram, state.cauTrucLuong, dispatch],
  );
}

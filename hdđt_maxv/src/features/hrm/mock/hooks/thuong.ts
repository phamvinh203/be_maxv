/** Hook nghiệp vụ Thưởng. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { nhanBanDongThuong, tongTienThuong } from "../../thuong";
import type {
  BanThuongNhanVien,
  DongThuong,
  KhoanLuong,
  LocNhanVienKyLuong,
  PhamViApDung,
  ThuongNhanVienRow,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

/**
 * Các loại thưởng chọn được ở bảng — lấy từ **Danh mục lương & phụ cấp**, lọc
 * đúng loại `luong_thuong`. Xem ghi chú ở `DongThuong` về việc không dựng danh
 * mục riêng cho màn hình này.
 */
export function useKhoanThuongList(): KhoanLuong[] {
  const { state } = useHrmStore();
  return useMemo(
    () => state.khoanLuong.filter((kl) => kl.loai === "luong_thuong"),
    [state.khoanLuong],
  );
}

/** Bảng thưởng đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauThuong(): DongThuong[] {
  return useHrmStore().state.mauThuong;
}

export function useBanThuongList(): BanThuongNhanVien[] {
  return useHrmStore().state.banThuong;
}

/** Danh sách nhân viên sẽ nhận bảng thưởng, kèm tổng tiền của bảng đã áp. */
export function useThuongRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): ThuongNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);

  return useMemo(() => {
    const banTheoNv = new Map(state.banThuong.map((ban) => [ban.ma_nv, ban]));
    return nhanVien.map((row): ThuongNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      return {
        ...row,
        tien_thuong: ban ? tongTienThuong(ban.dong) : null,
        so_khoan: ban?.dong.length ?? 0,
      };
    });
  }, [nhanVien, state.banThuong]);
}

/**
 * Kiểm tra bảng thưởng trước khi ghi.
 *
 * Dùng chung cho "Lưu thay đổi" và "Áp dụng thưởng" — hai nút ghi cùng một bảng
 * nên phải bắt cùng một bộ lỗi.
 */
function kiemTraBang(dong: DongThuong[], tenKhoan: (maKhoan: string) => string): void {
  if (dong.some((d) => !d.ma_khoan)) {
    throw new Error("Còn dòng chưa chọn loại thưởng — chọn hoặc xóa dòng đó trước.");
  }
  const daGap = new Set<string>();
  for (const d of dong) {
    if (daGap.has(d.ma_khoan)) {
      throw new Error(`Loại thưởng "${tenKhoan(d.ma_khoan)}" bị lặp trong bảng.`);
    }
    daGap.add(d.ma_khoan);
  }
  if (dong.some((d) => d.so_tien < 0)) {
    throw new Error("Số tiền thưởng không được âm.");
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

/** Lưu bảng thưởng đang soạn. Bảng rỗng vẫn lưu được — đó là cách xóa sạch bảng. */
export function useLuuMauThuong() {
  const { dispatch } = useHrmStore();
  const tenKhoan = useTenKhoan();
  return useCallback(
    async (dong: DongThuong[]) => {
      kiemTraBang(dong, tenKhoan);
      dispatch({ type: "thuong/luuMau", dong });
    },
    [dispatch, tenKhoan],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * Ghi luôn vào `mauThuong` để bản nháp và bản đã lưu khớp nhau sau khi áp — áp
 * xong mà màn hình vẫn báo "có thay đổi chưa lưu" thì rất khó hiểu.
 */
export function useApDungThuong() {
  const { dispatch } = useHrmStore();
  const tenKhoan = useTenKhoan();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongThuong[]): Promise<number> => {
      if (dong.length === 0) throw new Error("Bảng thưởng chưa có khoản nào để áp.");
      kiemTraBang(dong, tenKhoan);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp thưởng.");
      }
      dispatch({ type: "thuong/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng.
      dispatch({ type: "thuong/apDung", danhSachMaNv, dong: nhanBanDongThuong(dong) });
      return danhSachMaNv.length;
    },
    [dispatch, tenKhoan],
  );
}

export function useXoaBanThuong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "thuong/xoaBan", maNv });
    },
    [dispatch],
  );
}

/**
 * Xóa một loại thưởng khỏi danh mục.
 *
 * Chặn khi khoản còn nằm trong bảng đang soạn, trong bảng đã áp cho nhân viên,
 * hoặc trong cấu trúc lương: xóa đi thì các bảng đó mất tên khoản và số tiền đã
 * áp không còn giải thích được. Muốn dừng dùng thì chuyển trạng thái "Ngừng".
 */
export function useXoaKhoanThuong() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maKhoan: string) => {
      const soNvDangDung = state.banThuong.filter((ban) =>
        ban.dong.some((d) => d.ma_khoan === maKhoan),
      ).length;
      if (soNvDangDung > 0) {
        throw new Error(
          `Khoản thưởng đang nằm trong bảng của ${soNvDangDung} nhân viên. Hãy chuyển sang trạng thái "Ngừng" thay vì xóa.`,
        );
      }
      if (state.mauThuong.some((d) => d.ma_khoan === maKhoan)) {
        throw new Error("Khoản thưởng đang nằm trong bảng đã lưu — bỏ dòng đó ra trước.");
      }
      if (state.cauTrucLuong.dong.some((d) => d.ma_khoan === maKhoan)) {
        throw new Error("Khoản thưởng đang nằm trong cấu trúc lương của công ty.");
      }
      dispatch({ type: "khoanLuong/xoa", maKhoan });
    },
    [state.banThuong, state.mauThuong, state.cauTrucLuong, dispatch],
  );
}

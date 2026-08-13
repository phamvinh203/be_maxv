/** Hook nghiệp vụ Các khoản ứng - bù trừ. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { nhanBanDongBuTru, tongBiTru } from "../../buTru";
import type {
  BanBuTruNhanVien,
  BuTruNhanVienRow,
  DongBuTru,
  KhoanBuTru,
  KhoanBuTruFormValues,
  LocNhanVienKyLuong,
  PhamViApDung,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

export function useKhoanBuTruList(): KhoanBuTru[] {
  return useHrmStore().state.khoanBuTru;
}

/** Bảng đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauBuTru(): DongBuTru[] {
  return useHrmStore().state.mauBuTru;
}

export function useBanBuTruList(): BanBuTruNhanVien[] {
  return useHrmStore().state.banBuTru;
}

/** Danh sách nhân viên sẽ nhận bảng, kèm tổng bị trừ (âm = được nhận thêm). */
export function useBuTruRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): BuTruNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);

  return useMemo(() => {
    const banTheoNv = new Map(state.banBuTru.map((ban) => [ban.ma_nv, ban]));
    const khoanTheoMa = new Map(state.khoanBuTru.map((bt) => [bt.ma_bt, bt]));

    return nhanVien.map((row): BuTruNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      return {
        ...row,
        tong_bi_tru: ban ? tongBiTru(ban.dong, khoanTheoMa) : null,
        so_dong: ban?.dong.length ?? 0,
      };
    });
  }, [nhanVien, state.banBuTru, state.khoanBuTru]);
}

/**
 * Kiểm tra bảng trước khi ghi.
 *
 * Dùng chung cho "Lưu thay đổi" và "Áp dụng bù trừ" — hai nút ghi cùng một bảng
 * nên phải bắt cùng một bộ lỗi.
 */
function kiemTraBang(dong: DongBuTru[], tenKhoan: (maBt: string) => string): void {
  const daGap = new Set<string>();
  for (const d of dong) {
    if (!d.ma_bt) {
      throw new Error("Còn dòng chưa chọn khoản bù trừ — chọn hoặc xóa dòng đó trước.");
    }
    if (daGap.has(d.ma_bt)) {
      throw new Error(`Khoản "${tenKhoan(d.ma_bt)}" bị lặp trong bảng.`);
    }
    daGap.add(d.ma_bt);
    // Số âm ở đây nghĩa là đảo chiều khoản — chiều đã khai ở danh mục rồi, nhập
    // số âm nữa là trừ hóa thành cộng mà không ai để ý.
    if (d.so_tien < 0) {
      throw new Error("Số tiền không được âm — chiều trừ hay bù chọn ở danh mục khoản.");
    }
  }
}

/** Tra tên khoản để ghép vào thông điệp lỗi. Mã lạ thì trả lại chính nó. */
function useTenKhoan(): (maBt: string) => string {
  const { state } = useHrmStore();
  return useCallback(
    (maBt: string) => state.khoanBuTru.find((bt) => bt.ma_bt === maBt)?.ten_bt ?? maBt,
    [state.khoanBuTru],
  );
}

/** Lưu bảng đang soạn. Bảng rỗng vẫn lưu được — đó là cách xóa sạch bảng. */
export function useLuuMauBuTru() {
  const { dispatch } = useHrmStore();
  const tenKhoan = useTenKhoan();
  return useCallback(
    async (dong: DongBuTru[]) => {
      kiemTraBang(dong, tenKhoan);
      dispatch({ type: "buTru/luuMau", dong });
    },
    [dispatch, tenKhoan],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * Ghi luôn vào `mauBuTru` để bản nháp và bản đã lưu khớp nhau sau khi áp.
 */
export function useApDungBuTru() {
  const { dispatch } = useHrmStore();
  const tenKhoan = useTenKhoan();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongBuTru[]): Promise<number> => {
      if (dong.length === 0) throw new Error("Bảng ứng - bù trừ chưa có dòng nào để áp.");
      kiemTraBang(dong, tenKhoan);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp bù trừ.");
      }
      dispatch({ type: "buTru/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng.
      dispatch({ type: "buTru/apDung", danhSachMaNv, dong: nhanBanDongBuTru(dong) });
      return danhSachMaNv.length;
    },
    [dispatch, tenKhoan],
  );
}

export function useXoaBanBuTru() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "buTru/xoaBan", maNv });
    },
    [dispatch],
  );
}

/** Thêm mới hoặc sửa khoản bù trừ. Không truyền `maBt` là thêm — mã sinh tự động. */
export function useLuuKhoanBuTru() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: KhoanBuTruFormValues, maBt?: string) => {
      const tenBt = values.ten_bt.trim();
      if (!tenBt) throw new Error("Tên khoản không được để trống.");

      const trung = state.khoanBuTru.some(
        (bt) => bt.ma_bt !== maBt && bt.ten_bt.trim().toLowerCase() === tenBt.toLowerCase(),
      );
      if (trung) throw new Error(`Đã có khoản tên "${tenBt}".`);

      if (maBt) {
        if (!state.khoanBuTru.some((bt) => bt.ma_bt === maBt)) {
          throw new Error("Khoản bù trừ không còn tồn tại.");
        }
        dispatch({ type: "khoanBuTru/sua", khoan: { ...values, ten_bt: tenBt, ma_bt: maBt } });
        return;
      }

      const daDung = new Set(state.khoanBuTru.map((bt) => bt.ma_bt));
      let maMoi = "";
      for (let i = 1; i <= 999 && !maMoi; i += 1) {
        const ma = `BT${String(i).padStart(2, "0")}`;
        if (!daDung.has(ma)) maMoi = ma;
      }
      if (!maMoi) throw new Error("Đã đạt giới hạn số khoản bù trừ.");

      dispatch({ type: "khoanBuTru/them", khoan: { ...values, ten_bt: tenBt, ma_bt: maMoi } });
    },
    [state.khoanBuTru, dispatch],
  );
}

/**
 * Xóa một khoản khỏi danh mục.
 *
 * Chặn khi khoản còn nằm trong bảng đang soạn hoặc bảng đã áp cho nhân viên: xóa
 * đi thì tổng bị trừ đã tính không còn giải thích được — mà đây là tiền đã thực
 * sự ứng ra. Muốn dừng dùng thì chuyển trạng thái "Ngừng".
 */
export function useXoaKhoanBuTru() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maBt: string) => {
      const soNvDangDung = state.banBuTru.filter((ban) =>
        ban.dong.some((d) => d.ma_bt === maBt),
      ).length;
      if (soNvDangDung > 0) {
        throw new Error(
          `Khoản này đang nằm trong bảng của ${soNvDangDung} nhân viên. Hãy chuyển sang trạng thái "Ngừng" thay vì xóa.`,
        );
      }
      if (state.mauBuTru.some((d) => d.ma_bt === maBt)) {
        throw new Error("Khoản này đang nằm trong bảng đã lưu — bỏ dòng đó ra trước.");
      }
      dispatch({ type: "khoanBuTru/xoa", maBt });
    },
    [state.banBuTru, state.mauBuTru, dispatch],
  );
}

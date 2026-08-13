/** Hook nghiệp vụ Tăng ca. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { moTaLoaiTangCa } from "../../constants";
import { nhanBanDongTangCa, tongGioOt, tongGioQuyDoi } from "../../tangCa";
import type {
  BanTangCaNhanVien,
  DongTangCa,
  LoaiTangCa,
  LocNhanVienKyLuong,
  PhamViApDung,
  TangCaNhanVienRow,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

/** Bảng tăng ca đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauTangCa(): DongTangCa[] {
  return useHrmStore().state.mauTangCa;
}

export function useBanTangCaList(): BanTangCaNhanVien[] {
  return useHrmStore().state.banTangCa;
}

/** Danh sách nhân viên sẽ nhận bảng tăng ca, kèm giờ tháng / giờ năm / quy đổi. */
export function useTangCaRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): TangCaNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);

  return useMemo(() => {
    const banTheoNv = new Map(state.banTangCa.map((ban) => [ban.ma_nv, ban]));
    return nhanVien.map((row): TangCaNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      const gioThang = ban ? tongGioOt(ban.dong) : null;
      return {
        ...row,
        gio_thang: gioThang,
        gio_nam: (ban?.gio_luy_ke_nam ?? 0) + (gioThang ?? 0),
        gio_quy_doi: ban ? tongGioQuyDoi(ban.dong, state.cauHinh) : 0,
      };
    });
  }, [nhanVien, state.banTangCa, state.cauHinh]);
}

/**
 * Kiểm tra bảng tăng ca trước khi ghi.
 *
 * Dùng chung cho "Lưu thay đổi" và "Áp dụng tăng ca" — hai nút ghi cùng một
 * bảng nên phải bắt cùng một bộ lỗi.
 */
function kiemTraBang(dong: DongTangCa[]): void {
  const daGap = new Set<LoaiTangCa>();
  for (const d of dong) {
    if (!d.loai) {
      throw new Error("Còn dòng chưa chọn loại tăng ca — chọn hoặc xóa dòng đó trước.");
    }
    if (daGap.has(d.loai)) {
      throw new Error(`Loại "${moTaLoaiTangCa(d.loai).label}" bị lặp trong bảng.`);
    }
    daGap.add(d.loai);
    if (d.so_gio < 0) throw new Error("Số giờ tăng ca không được âm.");
  }
}

/** Lưu bảng tăng ca đang soạn. Bảng rỗng vẫn lưu được — đó là cách xóa sạch bảng. */
export function useLuuMauTangCa() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (dong: DongTangCa[]) => {
      kiemTraBang(dong);
      dispatch({ type: "tangCa/luuMau", dong });
    },
    [dispatch],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * **Không** chặn khi vượt trần giờ tăng ca: có kỳ doanh nghiệp buộc phải vượt và
 * xử lý bằng thủ tục riêng, chặn cứng ở đây thì người làm lương không nhập nổi
 * số thật. Màn hình tô đỏ các dòng vượt trần để không ai bỏ sót.
 */
export function useApDungTangCa() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongTangCa[]): Promise<number> => {
      if (dong.length === 0) throw new Error("Bảng tăng ca chưa có dòng nào để áp.");
      kiemTraBang(dong);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp tăng ca.");
      }
      dispatch({ type: "tangCa/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng.
      dispatch({ type: "tangCa/apDung", danhSachMaNv, dong: nhanBanDongTangCa(dong) });
      return danhSachMaNv.length;
    },
    [dispatch],
  );
}

export function useXoaBanTangCa() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "tangCa/xoaBan", maNv });
    },
    [dispatch],
  );
}

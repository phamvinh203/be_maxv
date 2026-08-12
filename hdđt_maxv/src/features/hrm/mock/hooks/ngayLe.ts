/** Hook nghiệp vụ lịch ngày lễ. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { ngayLeChuanVN } from "../../ngayLeChuan";
import type { LocNgayLe, NgayLe, NgayLeFormValues } from "../../types";
import { sinhId } from "../store";
import { useHrmStore } from "../useHrmStore";

export function useNgayLeList(): NgayLe[] {
  return useHrmStore().state.ngayLe;
}

/** Danh sách đã lọc, sắp theo ngày tăng dần. */
export function useNgayLeRows(loc: LocNgayLe): NgayLe[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const namNay = String(new Date().getFullYear());
    return state.ngayLe
      .filter((nl) => {
        if (loc === "hang_nam") return nl.lap_lai_hang_nam;
        if (loc === "nam_nay") {
          // Ngày lặp hằng năm luôn thuộc năm nay dù bản ghi lưu năm nào.
          return nl.lap_lai_hang_nam || nl.ngay.startsWith(namNay);
        }
        return true;
      })
      .sort((a, b) => a.ngay.localeCompare(b.ngay));
  }, [state.ngayLe, loc]);
}

/** Thêm mới hoặc sửa. Không truyền `id` là thêm. */
export function useLuuNgayLe() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: NgayLeFormValues, id?: string) => {
      const ten = values.ten.trim();
      if (!ten) throw new Error("Tên ngày lễ không được để trống.");
      if (!values.ngay) throw new Error("Chưa chọn ngày.");

      // Lễ gốc âm lịch có ngày dương đổi mỗi năm — bật "lặp lại mọi năm" sẽ sinh
      // ra lịch sai từ năm sau, chặn ngay ở đây.
      if (values.loai === "le_am_lich" && values.lap_lai_hang_nam) {
        throw new Error(
          "Lễ theo âm lịch không lặp lại theo dương lịch được. Hãy tạo lại cho từng năm.",
        );
      }

      const trung = state.ngayLe.some(
        (nl) => nl.id !== id && nl.ngay === values.ngay && nl.ten.trim() === ten,
      );
      if (trung) throw new Error(`Ngày ${values.ngay} đã có ngày lễ tên "${ten}".`);

      const ngayLe: NgayLe = { ...values, ten, id: id ?? sinhId("NL") };
      dispatch(id ? { type: "ngayLe/sua", ngayLe } : { type: "ngayLe/them", ngayLe });
    },
    [state.ngayLe, dispatch],
  );
}

export function useXoaNgayLe() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (id: string) => {
      dispatch({ type: "ngayLe/xoa", id });
    },
    [dispatch],
  );
}

/**
 * Sinh lịch nghỉ lễ chuẩn Việt Nam cho một năm.
 *
 * Bỏ qua những ngày **đã có** (cùng ngày, cùng tên) thay vì báo lỗi cả lượt:
 * người dùng thường bấm "Tạo nhanh" sau khi đã tự thêm vài ngày, và bắt họ xóa
 * hết đi rồi tạo lại là bắt làm việc thừa. Trả về số dòng thực sự thêm.
 */
export function useTaoNhanhNgayLe() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (nam: number): Promise<number> => {
      const chuan = ngayLeChuanVN(nam);
      if (chuan.length === 0) {
        throw new Error(`Chưa có dữ liệu lịch âm cho năm ${nam}.`);
      }

      const daCo = new Set(state.ngayLe.map((nl) => `${nl.ngay}|${nl.ten.trim()}`));
      const canThem = chuan
        .filter((nl) => !daCo.has(`${nl.ngay}|${nl.ten}`))
        .map((nl) => ({ ...nl, id: sinhId("NL") }));

      if (canThem.length === 0) return 0;
      dispatch({ type: "ngayLe/taoNhanh", danhSach: canThem });
      return canThem.length;
    },
    [state.ngayLe, dispatch],
  );
}

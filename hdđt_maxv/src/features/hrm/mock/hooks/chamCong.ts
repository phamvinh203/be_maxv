/** Hook nghiệp vụ chấm công. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import {
  cacNgayTrongThang,
  khoaCham,
  ngayCongChuan,
  oCham,
  thongKeDong,
  type NgayCham,
  type ThongKeDong,
} from "../../chamCong";
import type { NhanVien, OChamCong } from "../../types";
import { useHrmStore } from "../useHrmStore";

export interface DongChamCong {
  nhanVien: NhanVien;
  /** Nội dung từng ô, cùng thứ tự với `ngayTrongThang`. `null` = ô trống. */
  o: (OChamCong | null)[];
  thongKe: ThongKeDong;
}

export interface BangChamCong {
  ngayTrongThang: NgayCham[];
  ngayCongChuan: number;
  gioCongChuanNgay: number;
  dong: DongChamCong[];
}

/**
 * Bảng chấm công của một tháng.
 *
 * Chỉ lấy nhân viên **đang làm** — chấm công cho người đã nghỉ chỉ làm bảng dài
 * thêm và số ngày công của họ không đi đâu cả.
 */
export function useBangChamCong(nam: number, thang: number): BangChamCong {
  const { state } = useHrmStore();

  return useMemo(() => {
    const ngayTrongThang = cacNgayTrongThang(nam, thang, state.cauHinh, state.ngayLe);
    const gioCongChuanNgay = state.cauHinh.gio_cong_chuan_ngay;

    const dong = state.nhanVien
      .filter((nv) => nv.status === "1")
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv))
      .map((nv) => ({
        nhanVien: nv,
        o: ngayTrongThang.map((nc) => oCham(state.chamCong, nv.ma_nv, nc)),
        thongKe: thongKeDong(state.chamCong, nv.ma_nv, ngayTrongThang, gioCongChuanNgay),
      }));

    return {
      ngayTrongThang,
      ngayCongChuan: ngayCongChuan(state.cauHinh, ngayTrongThang),
      gioCongChuanNgay,
      dong,
    };
  }, [nam, thang, state.cauHinh, state.ngayLe, state.nhanVien, state.chamCong]);
}

/** Ghi nội dung một ô. `null` = xóa trắng ô (khác với đưa về mặc định). */
export function useDatOChamCong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    (maNv: string, ngay: string, o: OChamCong | null) => {
      dispatch({ type: "chamCong/dat", khoa: khoaCham(maNv, ngay), o });
    },
    [dispatch],
  );
}

/** Bỏ chỉnh tay của một ô — ô quay về đúng mặc định theo lịch. */
export function useBoGhiDeO() {
  const { dispatch } = useHrmStore();
  return useCallback(
    (maNv: string, ngay: string) => {
      dispatch({ type: "chamCong/boGhiDe", khoa: khoaCham(maNv, ngay) });
    },
    [dispatch],
  );
}

/** Bỏ mọi chỉnh tay của tháng — cả bảng quay về đúng lịch chuẩn. */
export function useDatLaiChamCong() {
  const { dispatch } = useHrmStore();
  return useCallback(
    (tienToThang: string) => {
      dispatch({ type: "chamCong/datLaiThang", tienToThang });
    },
    [dispatch],
  );
}

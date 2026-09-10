/** Hook nghiệp vụ chấm công. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { useCauHinh } from "../../api/cau_hinh_mac_dinh/cauHinhQueries";
import {
  cacNgayTrongThang,
  khoaCham,
  ngayCongChuan,
  oCham,
  thongKeDong,
  type NgayCham,
  type ThongKeDong,
} from "../../calculations/du_lieu_tinh_luong/chamCong";
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
  /*
   * Cấu hình lấy từ MÁY CHỦ `[2026-09-08 đợt 3]`, không lấy `state.cauHinh` nữa.
   *
   * Ba thứ dưới đây đi thẳng vào bảng lương: chính sách thứ 7 / chủ nhật (số ngày công chuẩn),
   * phương pháp tính ngày công chuẩn, và giờ công chuẩn mỗi ngày. Để bảng lương đọc biểu thuế
   * của máy chủ mà số ngày công chuẩn vẫn lấy từ kho giả thì hai nửa của cùng một phép tính
   * dùng hai bộ tham số khác nhau — sai theo hướng rất khó thấy.
   *
   * ⚠️ Còn nợ: `state.ngayLe` bên dưới **vẫn là lịch giả**. Lịch thật nằm ở
   * `api/holidaysQueries.ts::useNgayLeList`; đổi nó là chạm vào dữ liệu nghiệp vụ (không phải
   * cấu hình) nên để lại cho đợt nối màn Chấm công.
   */
  const cauHinh = useCauHinh();

  return useMemo(() => {
    const ngayTrongThang = cacNgayTrongThang(nam, thang, cauHinh, state.ngayLe);
    const gioCongChuanNgay = cauHinh.gio_cong_chuan_ngay;

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
      ngayCongChuan: ngayCongChuan(cauHinh, ngayTrongThang),
      gioCongChuanNgay,
      dong,
    };
  }, [nam, thang, cauHinh, state.ngayLe, state.nhanVien, state.chamCong]);
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

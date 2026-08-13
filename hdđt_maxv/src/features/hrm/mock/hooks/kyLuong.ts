/**
 * Phần dùng chung của các màn hình trong khu "Dữ liệu tính lương".
 *
 * Màn KPI và màn Thưởng chọn nhân viên theo **cùng một luật** (phạm vi + ba ô
 * lọc) rồi mới gắn cột riêng của mình vào. Viết hai lần thì sớm muộn cũng có một
 * bên quên sửa khi luật đổi, mà lệch ở đây nghĩa là hai màn hình áp bảng cho hai
 * tập nhân viên khác nhau dù nhìn giống hệt.
 */

import { useMemo } from "react";
import { hopDongHienHanh } from "../../cay";
import { homNay } from "../../format";
import type {
  HopDong,
  LocNhanVienKyLuong,
  NhanVienKyLuongRow,
  PhamViApDung,
} from "../../types";
import { useHrmStore } from "../useHrmStore";

/**
 * Nhân viên sẽ nhận bảng, theo phạm vi đang chọn.
 *
 * Chỉ lấy người **đang làm** — áp bảng cho người đã nghỉ không vào kỳ lương nào.
 * Phạm vi quyết định ô lọc nào có tác dụng:
 * - `toan_cong_ty`: bỏ qua hết bộ lọc, lấy toàn bộ nhân viên đang làm;
 * - `phong_ban`: **bắt buộc** chọn phòng ban, chưa chọn thì trả rỗng để không ai
 *   lỡ tay áp bảng cho cả công ty khi đang định áp cho một phòng;
 * - `nhan_vien`: áp dụng cả ba ô lọc như bảng nhân viên thường.
 */
export function useNhanVienKyLuong(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): NhanVienKyLuongRow[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const tenPbTheoMa = new Map(state.phongBan.map((pb) => [pb.ma_pb, pb.ten_pb]));

    const hopDongTheoNv = new Map<string, HopDong[]>();
    for (const hd of state.hopDong) {
      const nhom = hopDongTheoNv.get(hd.ma_nv);
      if (nhom) nhom.push(hd);
      else hopDongTheoNv.set(hd.ma_nv, [hd]);
    }

    const moc = homNay();
    const tuKhoa = filters.q.trim().toLowerCase();

    return state.nhanVien
      .filter((nv) => nv.status === "1")
      .filter((nv) => {
        if (phamVi === "toan_cong_ty") return true;
        if (phamVi === "phong_ban") {
          return Boolean(filters.ma_pb) && nv.ma_pb === filters.ma_pb;
        }
        if (filters.ma_pb && nv.ma_pb !== filters.ma_pb) return false;
        if (!tuKhoa) return true;
        return [nv.ma_nv, nv.ho_ten].some((truong) => truong.toLowerCase().includes(tuKhoa));
      })
      .map((nv): NhanVienKyLuongRow => {
        const hd = hopDongHienHanh(hopDongTheoNv.get(nv.ma_nv) ?? [], moc);
        return {
          ma_nv: nv.ma_nv,
          ho_ten: nv.ho_ten,
          ten_pb: nv.ma_pb ? (tenPbTheoMa.get(nv.ma_pb) ?? nv.ma_pb) : "",
          loai_hd: hd?.loai_hd ?? null,
        };
      })
      // Lọc loại HĐ để sau cùng vì phải có hợp đồng hiện hành mới so được.
      .filter((row) => {
        if (phamVi === "toan_cong_ty") return true;
        return !filters.loai_hd || row.loai_hd === filters.loai_hd;
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [state.nhanVien, state.phongBan, state.hopDong, phamVi, filters]);
}

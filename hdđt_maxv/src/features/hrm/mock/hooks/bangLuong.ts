/**
 * Ráp dữ liệu cho bảng lương.
 *
 * Đây là chỗ **duy nhất** biết bảy màn của khu Dữ liệu tính lương ghép vào bảng
 * lương như thế nào. Công thức nằm ở `features/hrm/bangLuong.ts`; file này chỉ
 * lo gom nguồn rồi gọi công thức đó.
 */

import { useMemo } from "react";
import { tinhDongBangLuong, type NguonTinhLuong } from "../../bangLuong";
import { tongBiTru } from "../../buTru";
import { thangHienTai } from "../../chamCong";
import { thanhTienChuyenCan, tongTruChuyenCan } from "../../chuyenCan";
import { hopDongHienHanh } from "../../cay";
import { CHUC_VU } from "../../constants";
import { homNay, nhan } from "../../format";
import { hieuSuat } from "../../kpi";
import { tongTienPhanTram } from "../../luongPhanTram";
import { tongTienSanPham } from "../../luongSanPham";
import { tongGioOt, tongGioQuyDoi } from "../../tangCa";
import { tongTienThuong } from "../../thuong";
import type {
  BangLuongFilters,
  DongBangLuong,
  DongLuongHoTro,
  HopDong,
  KhoanLuong,
  LoaiKhoanLuong,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useBangChamCong } from "./chamCong";

/** Các loại khoản đã có màn hình riêng ở khu Dữ liệu tính lương. */
const LOAI_TINH_RIENG: LoaiKhoanLuong[] = [
  "luong_nghiem_thu",
  "luong_phan_tram",
  "luong_kpi",
  "luong_thuong",
  "luong_chuyen_can",
];

/** `YYYY-MM` của kỳ đang tính — dùng để lọc người phụ thuộc còn hiệu lực. */
function maKy(nam: number, thang: number): string {
  return `${nam}-${String(thang).padStart(2, "0")}`;
}

/**
 * Bảng lương của kỳ hiện tại.
 *
 * `nonce` chỉ để nút "Tính lại lương" ép chạy lại phép tính. Số liệu vốn đã bám
 * theo kho nên lúc nào cũng mới; nút đó là để người dùng chốt lại và biết mình
 * đang nhìn kết quả tính lúc nào.
 */
export function useBangLuongRows(
  filters: BangLuongFilters,
  nonce: number,
): DongBangLuong[] {
  const { state } = useHrmStore();
  const { nam, thang } = thangHienTai();
  const bangCong = useBangChamCong(nam, thang);

  return useMemo(() => {
    const tenPbTheoMa = new Map(state.phongBan.map((pb) => [pb.ma_pb, pb.ten_pb]));
    const khoanTheoMa = new Map(state.khoanLuong.map((kl) => [kl.ma_khoan, kl]));
    const setLuongTheoNv = new Map(state.setLuong.map((sl) => [sl.ma_nv, sl]));
    const congTheoNv = new Map(
      bangCong.dong.map((d) => [d.nhanVien.ma_nv, d.thongKe.ngayCongThucTe]),
    );

    const hopDongTheoNv = new Map<string, HopDong[]>();
    for (const hd of state.hopDong) {
      const nhom = hopDongTheoNv.get(hd.ma_nv);
      if (nhom) nhom.push(hd);
      else hopDongTheoNv.set(hd.ma_nv, [hd]);
    }

    // Người phụ thuộc chỉ được giảm trừ trong khoảng đã đăng ký — đăng ký hết
    // hạn mà vẫn đếm là tính thiếu thuế cho cả năm.
    const ky = maKy(nam, thang);
    const soNptTheoNv = new Map<string, number>();
    for (const npt of state.nguoiPhuThuoc) {
      const trongKy =
        Boolean(npt.gt_tu_thang) &&
        npt.gt_tu_thang <= ky &&
        (!npt.gt_den_thang || npt.gt_den_thang >= ky);
      if (trongKy) soNptTheoNv.set(npt.ma_nv, (soNptTheoNv.get(npt.ma_nv) ?? 0) + 1);
    }

    const tieuThucTheoKhoan = new Map(
      state.cauTrucLuong.dong.map((d) => [d.ma_khoan, d.tieu_thuc]),
    );
    const mucMacDinh = new Map(state.cauTrucLuong.dong.map((d) => [d.ma_khoan, d.so_tien]));

    const banTangCaTheoNv = new Map(state.banTangCa.map((b) => [b.ma_nv, b]));
    const banSanPhamTheoNv = new Map(state.banLuongSanPham.map((b) => [b.ma_nv, b]));
    const banThuongTheoNv = new Map(state.banThuong.map((b) => [b.ma_nv, b]));
    const banKpiTheoNv = new Map(state.banKpi.map((b) => [b.ma_nv, b]));
    const banPhanTramTheoNv = new Map(state.banLuongPhanTram.map((b) => [b.ma_nv, b]));
    const banChuyenCanTheoNv = new Map(state.banChuyenCan.map((b) => [b.ma_nv, b]));
    const banBuTruTheoNv = new Map(state.banBuTru.map((b) => [b.ma_nv, b]));
    const loaiChuyenCanTheoMa = new Map(state.loaiChuyenCan.map((cc) => [cc.ma_cc, cc]));
    const khoanBuTruTheoMa = new Map(state.khoanBuTru.map((bt) => [bt.ma_bt, bt]));

    const moc = homNay();
    const tuKhoa = filters.q.trim().toLowerCase();

    return state.nhanVien
      .filter((nv) => nv.status === "1")
      .map((nv): DongBangLuong => {
        // Chưa set lương thì lấy mức của Cấu trúc lương công ty — đúng số người
        // đó sẽ nhận khi tới lượt set, và bảng lương không bỏ trống ai.
        const ban = setLuongTheoNv.get(nv.ma_nv);
        const khoanCuaNv = ban ? new Map(Object.entries(ban.khoan)) : mucMacDinh;

        let luongCoDinh = 0;
        let luongTheoCong = 0;
        let mienThueCoDinh = 0;
        let mienThueTheoCong = 0;
        let mucKpi = 0;
        let mucChuyenCan = 0;

        for (const [maKhoan, soTien] of khoanCuaNv) {
          const kl: KhoanLuong | undefined = khoanTheoMa.get(maKhoan);
          if (!kl) continue;
          if (kl.loai === "luong_kpi") mucKpi += soTien;
          if (kl.loai === "luong_chuyen_can") mucChuyenCan += soTien;
          // Các loại có màn hình riêng không vào cột "Lương" — số của chúng đã
          // nằm ở cột Thưởng / KPI / Lương sản phẩm, cộng nữa là tính hai lần.
          if (LOAI_TINH_RIENG.includes(kl.loai)) continue;
          luongCoDinh += soTien;
          const tieuThuc = tieuThucTheoKhoan.get(maKhoan);
          const theoCong = tieuThuc === "theo_ngay_cong" || tieuThuc === "theo_gio_cong";
          if (theoCong) luongTheoCong += soTien;
          if (!kl.chiu_thue_tncn) {
            if (theoCong) mienThueTheoCong += soTien;
            else mienThueCoDinh += soTien;
          }
        }

        const hd = hopDongHienHanh(hopDongTheoNv.get(nv.ma_nv) ?? [], moc);
        const banTangCa = banTangCaTheoNv.get(nv.ma_nv);
        const banKpi = banKpiTheoNv.get(nv.ma_nv);
        const banChuyenCan = banChuyenCanTheoNv.get(nv.ma_nv);
        const banBuTru = banBuTruTheoNv.get(nv.ma_nv);

        const nguon: NguonTinhLuong = {
          ma_nv: nv.ma_nv,
          ho_ten: nv.ho_ten,
          ten_pb: nv.ma_pb ? (tenPbTheoMa.get(nv.ma_pb) ?? nv.ma_pb) : "",
          ten_cv: nv.ma_cv ? nhan(CHUC_VU, nv.ma_cv) : "",
          loai_hd: hd?.loai_hd ?? null,
          kieu_luong: hd?.kieu_luong ?? null,
          so_npt: soNptTheoNv.get(nv.ma_nv) ?? 0,
          cong_doan: nv.cong_doan,

          luong_co_dinh: luongCoDinh,
          luong_theo_cong: luongTheoCong,
          mien_thue_co_dinh: mienThueCoDinh,
          mien_thue_theo_cong: mienThueTheoCong,

          ngay_cong: congTheoNv.get(nv.ma_nv) ?? 0,
          ngay_cong_chuan: bangCong.ngayCongChuan,
          gio_cong_chuan_ngay: bangCong.gioCongChuanNgay,
          gio_tang_ca: banTangCa ? tongGioOt(banTangCa.dong) : 0,
          gio_quy_doi: banTangCa ? tongGioQuyDoi(banTangCa.dong, state.cauHinh) : 0,

          luong_san_pham: tongTienSanPham(banSanPhamTheoNv.get(nv.ma_nv)?.dong ?? []),
          thuong: tongTienThuong(banThuongTheoNv.get(nv.ma_nv)?.dong ?? []),
          // Chưa chấm KPI thì chưa có tiền KPI — khác với chuyên cần bên dưới,
          // vì KPI phải đo mới có, còn chuyên cần mặc định là được hưởng.
          kpi: banKpi ? Math.round((mucKpi * hieuSuat(banKpi.dong)) / 100) : 0,
          luong_phan_tram: tongTienPhanTram(banPhanTramTheoNv.get(nv.ma_nv)?.dong ?? []),
          chuyen_can: banChuyenCan
            ? thanhTienChuyenCan(
                mucChuyenCan,
                tongTruChuyenCan(banChuyenCan.dong, loaiChuyenCanTheoMa, mucChuyenCan),
              )
            : mucChuyenCan,
          bu_tru: banBuTru ? tongBiTru(banBuTru.dong, khoanBuTruTheoMa) : 0,

          luong_bhxh: hd?.trich_bhxh ? hd.luong_bhxh : 0,
          tinh_tncn: hd?.tinh_tncn ?? false,
        };

        return tinhDongBangLuong(nguon, state.cauHinh);
      })
      .filter((row) => {
        if (filters.ma_pb) {
          const nv = state.nhanVien.find((item) => item.ma_nv === row.ma_nv);
          if (nv?.ma_pb !== filters.ma_pb) return false;
        }
        if (filters.loai_hd && row.loai_hd !== filters.loai_hd) return false;
        if (filters.kieu_luong && row.kieu_luong !== filters.kieu_luong) return false;
        if (!tuKhoa) return true;
        return [row.ma_nv, row.ho_ten].some((truong) => truong.toLowerCase().includes(tuKhoa));
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
    // `nonce` cố ý nằm trong deps: nút "Tính lại lương" dựa vào nó để chạy lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, bangCong, nam, thang, filters, nonce]);
}

/** Kỳ lương đang hiển thị — hiện ở tiêu đề màn hình. */
export function useKyBangLuong(): { nam: number; thang: number; nhan: string } {
  const { nam, thang } = thangHienTai();
  return useMemo(
    () => ({ nam, thang, nhan: `Tháng ${String(thang).padStart(2, "0")}/${nam}` }),
    [nam, thang],
  );
}

/** Các khoản hỗ trợ đang dùng — mỗi khoản là một cột của tab "Lương hỗ trợ". */
export function useKhoanHoTroList(): KhoanLuong[] {
  const { state } = useHrmStore();
  return useMemo(
    () => state.khoanLuong.filter((kl) => kl.loai === "luong_ho_tro" && kl.status === "1"),
    [state.khoanLuong],
  );
}

/**
 * Bóc tách phần lương hỗ trợ của kỳ hiện tại.
 *
 * Quy theo ngày công **đúng cách mà tab Bảng lương quy** (`tieu_thuc` của Cấu
 * trúc lương): hai tab lệch nhau ở chỗ này thì tổng hỗ trợ ở đây sẽ không khớp
 * phần hỗ trợ nằm trong cột "Thu nhập" bên kia, mà người dùng chắc chắn sẽ cộng
 * thử.
 */
export function useLuongHoTroRows(
  filters: BangLuongFilters,
  nonce: number,
): DongLuongHoTro[] {
  const { state } = useHrmStore();
  const { nam, thang } = thangHienTai();
  const bangCong = useBangChamCong(nam, thang);
  const khoanHoTro = useKhoanHoTroList();

  return useMemo(() => {
    const tenPbTheoMa = new Map(state.phongBan.map((pb) => [pb.ma_pb, pb.ten_pb]));
    const setLuongTheoNv = new Map(state.setLuong.map((sl) => [sl.ma_nv, sl]));
    const mucMacDinh = new Map(state.cauTrucLuong.dong.map((d) => [d.ma_khoan, d.so_tien]));
    const tieuThucTheoKhoan = new Map(
      state.cauTrucLuong.dong.map((d) => [d.ma_khoan, d.tieu_thuc]),
    );
    const congTheoNv = new Map(
      bangCong.dong.map((d) => [d.nhanVien.ma_nv, d.thongKe.ngayCongThucTe]),
    );

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
      .map((nv): DongLuongHoTro => {
        const ban = setLuongTheoNv.get(nv.ma_nv);
        const khoanCuaNv = ban ? new Map(Object.entries(ban.khoan)) : mucMacDinh;
        const ngayCong = congTheoNv.get(nv.ma_nv) ?? 0;
        const tyLeCong =
          bangCong.ngayCongChuan > 0
            ? Math.min(ngayCong / bangCong.ngayCongChuan, 1)
            : 0;

        const khoan: Record<string, number> = {};
        let tong = 0;
        let tongMucThang = 0;
        for (const kl of khoanHoTro) {
          const muc = khoanCuaNv.get(kl.ma_khoan) ?? 0;
          const tieuThuc = tieuThucTheoKhoan.get(kl.ma_khoan);
          const theoCong = tieuThuc === "theo_ngay_cong" || tieuThuc === "theo_gio_cong";
          const soTien = Math.round(theoCong ? muc * tyLeCong : muc);
          khoan[kl.ma_khoan] = soTien;
          tong += soTien;
          tongMucThang += muc;
        }

        const hd = hopDongHienHanh(hopDongTheoNv.get(nv.ma_nv) ?? [], moc);
        return {
          ma_nv: nv.ma_nv,
          ho_ten: nv.ho_ten,
          ten_pb: nv.ma_pb ? (tenPbTheoMa.get(nv.ma_pb) ?? nv.ma_pb) : "",
          ten_cv: nv.ma_cv ? nhan(CHUC_VU, nv.ma_cv) : "",
          loai_hd: hd?.loai_hd ?? null,
          kieu_luong: hd?.kieu_luong ?? null,
          ngay_cong: ngayCong,
          ngay_cong_chuan: bangCong.ngayCongChuan,
          khoan,
          tong_muc_thang: tongMucThang,
          tong,
        };
      })
      .filter((row) => {
        if (filters.ma_pb) {
          const nv = state.nhanVien.find((item) => item.ma_nv === row.ma_nv);
          if (nv?.ma_pb !== filters.ma_pb) return false;
        }
        if (filters.loai_hd && row.loai_hd !== filters.loai_hd) return false;
        if (filters.kieu_luong && row.kieu_luong !== filters.kieu_luong) return false;
        if (!tuKhoa) return true;
        return [row.ma_nv, row.ho_ten].some((truong) => truong.toLowerCase().includes(tuKhoa));
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
    // `nonce` cố ý nằm trong deps — xem ghi chú ở `useBangLuongRows`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, bangCong, khoanHoTro, filters, nonce]);
}

/** Số nhân viên đang làm — mẫu số của dòng "tổng ... nhân viên". */
export function useSoNhanVienDangLam(): number {
  const { state } = useHrmStore();
  return useMemo(
    () => state.nhanVien.filter((nv) => nv.status === "1").length,
    [state.nhanVien],
  );
}

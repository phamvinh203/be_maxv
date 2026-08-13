/** Hook nghiệp vụ Lương chuyên cần. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import {
  nhanBanDongChuyenCan,
  thanhTienChuyenCan,
  tongTruChuyenCan,
} from "../../chuyenCan";
import type {
  BanChuyenCanNhanVien,
  ChuyenCanNhanVienRow,
  DongChuyenCan,
  LoaiChuyenCan,
  LoaiChuyenCanFormValues,
  LocNhanVienKyLuong,
  PhamViApDung,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

export function useLoaiChuyenCanList(): LoaiChuyenCan[] {
  return useHrmStore().state.loaiChuyenCan;
}

/** Bảng đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauChuyenCan(): DongChuyenCan[] {
  return useHrmStore().state.mauChuyenCan;
}

export function useBanChuyenCanList(): BanChuyenCanNhanVien[] {
  return useHrmStore().state.banChuyenCan;
}

/**
 * Mức chuyên cần từng nhân viên được hưởng, tra theo mã nhân viên.
 *
 * Lấy từ **Set lương** của người đó, cộng mọi khoản thuộc loại
 * `luong_chuyen_can`. Người chưa set lương thì rơi về mức của **Cấu trúc lương**
 * công ty — đó đúng là số họ sẽ nhận khi tới lượt set.
 *
 * Không lưu đơn giá vào bảng chuyên cần: sửa mức chuyên cần ở Set lương mà màn
 * này vẫn giữ số cũ thì hai màn hình nói hai kiểu về cùng một khoản.
 */
export function useDonGiaChuyenCan(): Map<string, number> {
  const { state } = useHrmStore();
  return useMemo(() => {
    const maKhoanChuyenCan = new Set(
      state.khoanLuong.filter((kl) => kl.loai === "luong_chuyen_can").map((kl) => kl.ma_khoan),
    );
    const mucMacDinh = state.cauTrucLuong.dong
      .filter((d) => maKhoanChuyenCan.has(d.ma_khoan))
      .reduce((tong, d) => tong + d.so_tien, 0);

    const theoNv = new Map<string, number>();
    for (const ban of state.setLuong) {
      const tong = Object.entries(ban.khoan)
        .filter(([maKhoan]) => maKhoanChuyenCan.has(maKhoan))
        .reduce((cong, [, tien]) => cong + tien, 0);
      theoNv.set(ban.ma_nv, tong);
    }

    // Người chưa set lương không có mặt trong `theoNv` — trả mức mặc định qua
    // một Map con để chỗ gọi chỉ cần `.get() ?? mucMacDinh`.
    const ketQua = new Map<string, number>();
    for (const nv of state.nhanVien) {
      ketQua.set(nv.ma_nv, theoNv.get(nv.ma_nv) ?? mucMacDinh);
    }
    return ketQua;
  }, [state.khoanLuong, state.cauTrucLuong, state.setLuong, state.nhanVien]);
}

/** Danh sách nhân viên sẽ nhận bảng, kèm đơn giá / tổng trừ / thành tiền. */
export function useChuyenCanRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): ChuyenCanNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);
  const donGiaTheoNv = useDonGiaChuyenCan();

  return useMemo(() => {
    const banTheoNv = new Map(state.banChuyenCan.map((ban) => [ban.ma_nv, ban]));
    const loaiTheoMa = new Map(state.loaiChuyenCan.map((cc) => [cc.ma_cc, cc]));

    return nhanVien.map((row): ChuyenCanNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      const donGia = donGiaTheoNv.get(row.ma_nv) ?? 0;
      // Bảng rỗng vẫn là "đã áp": kỳ này không vi phạm, nhận đủ chuyên cần.
      const tongTru = ban ? tongTruChuyenCan(ban.dong, loaiTheoMa, donGia) : null;
      return {
        ...row,
        don_gia: donGia,
        tong_tru: tongTru,
        thanh_tien: tongTru === null ? null : thanhTienChuyenCan(donGia, tongTru),
        so_dong: ban?.dong.length ?? 0,
      };
    });
  }, [nhanVien, state.banChuyenCan, state.loaiChuyenCan, donGiaTheoNv]);
}

/**
 * Kiểm tra bảng trước khi ghi.
 *
 * Khác các màn kia ở một chỗ: **cho phép trùng loại**. Một người đi trễ ba hôm
 * là ba dòng cùng loại, khác ngày — gộp lại thì mất dấu ngày vi phạm. Đổi lại
 * phải bắt trùng đúng cặp loại + ngày.
 */
function kiemTraBang(dong: DongChuyenCan[], tenLoai: (maCc: string) => string): void {
  const daGap = new Set<string>();
  for (const d of dong) {
    if (!d.ma_cc) {
      throw new Error("Còn dòng chưa chọn loại chuyên cần — chọn hoặc xóa dòng đó trước.");
    }
    if (!d.ngay) throw new Error(`Dòng "${tenLoai(d.ma_cc)}" chưa có ngày.`);
    const khoa = `${d.ma_cc}|${d.ngay}`;
    if (daGap.has(khoa)) {
      throw new Error(`Lỗi "${tenLoai(d.ma_cc)}" bị khai hai lần cho ngày ${d.ngay}.`);
    }
    daGap.add(khoa);
    if (d.so_gio < 0) throw new Error("Số giờ trễ/nghỉ không được âm.");
  }
}

/** Tra tên loại để ghép vào thông điệp lỗi. Mã lạ thì trả lại chính nó. */
function useTenLoai(): (maCc: string) => string {
  const { state } = useHrmStore();
  return useCallback(
    (maCc: string) => state.loaiChuyenCan.find((cc) => cc.ma_cc === maCc)?.ten_cc ?? maCc,
    [state.loaiChuyenCan],
  );
}

/**
 * Lưu bảng đang soạn.
 *
 * Bảng rỗng vẫn lưu được, và ở màn này nó còn có nghĩa riêng: áp một bảng rỗng
 * là chốt "kỳ này không vi phạm", nhân viên nhận đủ chuyên cần.
 */
export function useLuuMauChuyenCan() {
  const { dispatch } = useHrmStore();
  const tenLoai = useTenLoai();
  return useCallback(
    async (dong: DongChuyenCan[]) => {
      kiemTraBang(dong, tenLoai);
      dispatch({ type: "chuyenCan/luuMau", dong });
    },
    [dispatch, tenLoai],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * Không chặn bảng rỗng — xem ghi chú ở `useLuuMauChuyenCan`.
 */
export function useApDungChuyenCan() {
  const { dispatch } = useHrmStore();
  const tenLoai = useTenLoai();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongChuyenCan[]): Promise<number> => {
      kiemTraBang(dong, tenLoai);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp chuyên cần.");
      }
      dispatch({ type: "chuyenCan/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng.
      dispatch({ type: "chuyenCan/apDung", danhSachMaNv, dong: nhanBanDongChuyenCan(dong) });
      return danhSachMaNv.length;
    },
    [dispatch, tenLoai],
  );
}

export function useXoaBanChuyenCan() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "chuyenCan/xoaBan", maNv });
    },
    [dispatch],
  );
}

/** Thêm mới hoặc sửa loại lỗi. Không truyền `maCc` là thêm — mã sinh tự động. */
export function useLuuLoaiChuyenCan() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: LoaiChuyenCanFormValues, maCc?: string) => {
      const tenCc = values.ten_cc.trim();
      if (!tenCc) throw new Error("Tên loại chuyên cần không được để trống.");
      if (values.muc_tru < 0) throw new Error("Mức trừ không được âm.");

      const trung = state.loaiChuyenCan.some(
        (cc) => cc.ma_cc !== maCc && cc.ten_cc.trim().toLowerCase() === tenCc.toLowerCase(),
      );
      if (trung) throw new Error(`Đã có loại chuyên cần tên "${tenCc}".`);

      // Loại mất toàn bộ không dùng tới mức trừ — ép về 0 để bảng danh mục không
      // hiện một con số chẳng ảnh hưởng gì tới tiền.
      const chuanHoa = {
        ...values,
        ten_cc: tenCc,
        muc_tru: values.cach_tru === "mat_toan_bo" ? 0 : values.muc_tru,
      };

      if (maCc) {
        if (!state.loaiChuyenCan.some((cc) => cc.ma_cc === maCc)) {
          throw new Error("Loại chuyên cần không còn tồn tại.");
        }
        dispatch({ type: "loaiChuyenCan/sua", loai: { ...chuanHoa, ma_cc: maCc } });
        return;
      }

      const daDung = new Set(state.loaiChuyenCan.map((cc) => cc.ma_cc));
      let maMoi = "";
      for (let i = 1; i <= 999 && !maMoi; i += 1) {
        const ma = `CC${String(i).padStart(2, "0")}`;
        if (!daDung.has(ma)) maMoi = ma;
      }
      if (!maMoi) throw new Error("Đã đạt giới hạn số loại chuyên cần.");

      dispatch({ type: "loaiChuyenCan/them", loai: { ...chuanHoa, ma_cc: maMoi } });
    },
    [state.loaiChuyenCan, dispatch],
  );
}

/**
 * Xóa một loại lỗi khỏi danh mục.
 *
 * Chặn khi loại còn nằm trong bảng đang soạn hoặc bảng đã áp cho nhân viên: xóa
 * đi thì tổng trừ đã tính không còn giải thích được. Muốn dừng dùng thì chuyển
 * trạng thái "Ngừng".
 */
export function useXoaLoaiChuyenCan() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maCc: string) => {
      const soNvDangDung = state.banChuyenCan.filter((ban) =>
        ban.dong.some((d) => d.ma_cc === maCc),
      ).length;
      if (soNvDangDung > 0) {
        throw new Error(
          `Loại này đang nằm trong bảng của ${soNvDangDung} nhân viên. Hãy chuyển sang trạng thái "Ngừng" thay vì xóa.`,
        );
      }
      if (state.mauChuyenCan.some((d) => d.ma_cc === maCc)) {
        throw new Error("Loại này đang nằm trong bảng đã lưu — bỏ dòng đó ra trước.");
      }
      dispatch({ type: "loaiChuyenCan/xoa", maCc });
    },
    [state.banChuyenCan, state.mauChuyenCan, dispatch],
  );
}

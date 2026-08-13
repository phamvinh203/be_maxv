/** Hook nghiệp vụ KPI. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback, useMemo } from "react";
import { hieuSuat, nhanBanDongKpi, tongTrongSo } from "../../kpi";
import type {
  BanKpiNhanVien,
  ChiTieuKpi,
  ChiTieuKpiFormValues,
  DongKpi,
  KpiNhanVienRow,
  LocNhanVienKyLuong,
  PhamViApDung,
} from "../../types";
import { useHrmStore } from "../useHrmStore";
import { useNhanVienKyLuong } from "./kyLuong";

export function useChiTieuKpiList(): ChiTieuKpi[] {
  return useHrmStore().state.chiTieuKpi;
}

/** Bảng KPI đã lưu — màn hình giữ một bản nháp riêng và đồng bộ lại từ đây. */
export function useMauKpi(): DongKpi[] {
  return useHrmStore().state.mauKpi;
}

export function useBanKpiList(): BanKpiNhanVien[] {
  return useHrmStore().state.banKpi;
}

/** Danh sách nhân viên sẽ nhận bảng KPI, kèm hiệu suất đã tính từ bảng đã áp. */
export function useKpiRows(
  phamVi: PhamViApDung,
  filters: LocNhanVienKyLuong,
): KpiNhanVienRow[] {
  const { state } = useHrmStore();
  const nhanVien = useNhanVienKyLuong(phamVi, filters);

  return useMemo(() => {
    const banTheoNv = new Map(state.banKpi.map((ban) => [ban.ma_nv, ban]));
    return nhanVien.map((row): KpiNhanVienRow => {
      const ban = banTheoNv.get(row.ma_nv);
      return {
        ...row,
        lan_luong: ban?.lan_luong ?? 0,
        hieu_suat: ban ? hieuSuat(ban.dong) : null,
        so_chi_tieu: ban?.dong.length ?? 0,
      };
    });
  }, [nhanVien, state.banKpi]);
}

/**
 * Kiểm tra bảng KPI trước khi ghi.
 *
 * Dùng chung cho cả "Lưu thay đổi" lẫn "Áp dụng KPI" — hai nút ghi cùng một bảng
 * nên phải bắt cùng một bộ lỗi, tách ra là sớm muộn cũng lệch.
 */
function kiemTraBang(dong: DongKpi[], tenChiTieu: (maKpi: string) => string): void {
  if (dong.some((d) => !d.ma_kpi)) {
    throw new Error("Còn dòng chưa chọn chỉ tiêu — chọn hoặc xóa dòng đó trước.");
  }
  const daGap = new Set<string>();
  for (const d of dong) {
    if (daGap.has(d.ma_kpi)) {
      throw new Error(`Chỉ tiêu "${tenChiTieu(d.ma_kpi)}" bị lặp trong bảng.`);
    }
    daGap.add(d.ma_kpi);
  }
  if (dong.length > 0 && tongTrongSo(dong) <= 0) {
    throw new Error("Tổng trọng số phải lớn hơn 0, nếu không hiệu suất luôn bằng 0.");
  }
}

/** Tra tên chỉ tiêu để ghép vào thông điệp lỗi. Mã lạ thì trả lại chính nó. */
function useTenChiTieu(): (maKpi: string) => string {
  const { state } = useHrmStore();
  return useCallback(
    (maKpi: string) =>
      state.chiTieuKpi.find((ct) => ct.ma_kpi === maKpi)?.ten_kpi ?? maKpi,
    [state.chiTieuKpi],
  );
}

/** Lưu bảng KPI đang soạn. Bảng rỗng vẫn lưu được — đó là cách xóa sạch bảng. */
export function useLuuMauKpi() {
  const { dispatch } = useHrmStore();
  const tenChiTieu = useTenChiTieu();
  return useCallback(
    async (dong: DongKpi[]) => {
      kiemTraBang(dong, tenChiTieu);
      dispatch({ type: "kpi/luuMau", dong });
    },
    [dispatch, tenChiTieu],
  );
}

/**
 * Áp bảng đang soạn cho một danh sách nhân viên. Trả về số người đã áp.
 *
 * Ghi luôn bảng vào `mauKpi` để bản nháp và bản đã lưu khớp nhau sau khi áp —
 * áp một bảng rồi mà màn hình vẫn báo "có thay đổi chưa lưu" thì rất khó hiểu.
 */
export function useApDungKpi() {
  const { dispatch } = useHrmStore();
  const tenChiTieu = useTenChiTieu();
  return useCallback(
    async (danhSachMaNv: string[], dong: DongKpi[]): Promise<number> => {
      if (dong.length === 0) throw new Error("Bảng KPI chưa có chỉ tiêu nào để áp.");
      kiemTraBang(dong, tenChiTieu);
      if (danhSachMaNv.length === 0) {
        throw new Error("Không có nhân viên nào trong danh sách để áp KPI.");
      }
      dispatch({ type: "kpi/luuMau", dong });
      // Id sinh lại: bảng của mỗi người là một bản riêng, dùng chung id thì sửa
      // dòng của người này sẽ khớp nhầm dòng của người kia.
      dispatch({ type: "kpi/apDung", danhSachMaNv, dong: nhanBanDongKpi(dong) });
      return danhSachMaNv.length;
    },
    [dispatch, tenChiTieu],
  );
}

export function useXoaBanKpi() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maNv: string) => {
      dispatch({ type: "kpi/xoaBan", maNv });
    },
    [dispatch],
  );
}

/** Thêm mới hoặc sửa chỉ tiêu. Không truyền `maKpi` là thêm — mã sinh tự động. */
export function useLuuChiTieuKpi() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: ChiTieuKpiFormValues, maKpi?: string) => {
      const tenKpi = values.ten_kpi.trim();
      if (!tenKpi) throw new Error("Tên chỉ tiêu không được để trống.");
      if (values.trong_so_mac_dinh < 0) throw new Error("Trọng số không được âm.");

      // Hai chỉ tiêu trùng tên thì bảng KPI không phân biệt được, mà ô chọn chỉ
      // hiện tên — gần như chắc chắn là bấm tạo hai lần.
      const trung = state.chiTieuKpi.some(
        (ct) =>
          ct.ma_kpi !== maKpi && ct.ten_kpi.trim().toLowerCase() === tenKpi.toLowerCase(),
      );
      if (trung) throw new Error(`Đã có chỉ tiêu tên "${tenKpi}".`);

      if (maKpi) {
        if (!state.chiTieuKpi.some((ct) => ct.ma_kpi === maKpi)) {
          throw new Error("Chỉ tiêu không còn tồn tại.");
        }
        dispatch({
          type: "chiTieuKpi/sua",
          chiTieu: { ...values, ten_kpi: tenKpi, ma_kpi: maKpi },
        });
        return;
      }

      const daDung = new Set(state.chiTieuKpi.map((ct) => ct.ma_kpi));
      let maMoi = "";
      for (let i = 1; i <= 999 && !maMoi; i += 1) {
        const ma = `KPI${String(i).padStart(2, "0")}`;
        if (!daDung.has(ma)) maMoi = ma;
      }
      if (!maMoi) throw new Error("Đã đạt giới hạn số chỉ tiêu KPI.");

      dispatch({
        type: "chiTieuKpi/them",
        chiTieu: { ...values, ten_kpi: tenKpi, ma_kpi: maMoi },
      });
    },
    [state.chiTieuKpi, dispatch],
  );
}

/**
 * Xóa một chỉ tiêu khỏi danh mục.
 *
 * Chặn khi chỉ tiêu còn nằm trong bảng đang soạn hoặc trong bảng đã áp cho nhân
 * viên: xóa đi thì các bảng đó mất tên chỉ tiêu và hiệu suất đã tính không còn
 * giải thích được. Muốn dừng dùng thì đổi trạng thái sang "Ngừng".
 */
export function useXoaChiTieuKpi() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maKpi: string) => {
      const soNvDangDung = state.banKpi.filter((ban) =>
        ban.dong.some((d) => d.ma_kpi === maKpi),
      ).length;
      if (soNvDangDung > 0) {
        throw new Error(
          `Chỉ tiêu đang nằm trong bảng KPI của ${soNvDangDung} nhân viên. Hãy chuyển sang trạng thái "Ngừng" thay vì xóa.`,
        );
      }
      if (state.mauKpi.some((d) => d.ma_kpi === maKpi)) {
        throw new Error("Chỉ tiêu đang nằm trong bảng KPI đã lưu — bỏ dòng đó ra trước.");
      }
      dispatch({ type: "chiTieuKpi/xoa", maKpi });
    },
    [state.banKpi, state.mauKpi, dispatch],
  );
}

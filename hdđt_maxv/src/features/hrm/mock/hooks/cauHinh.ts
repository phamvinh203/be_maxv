/** Hook nghiệp vụ cấu hình mặc định. Xem ghi chú về chữ ký ở `hooks/phongBan.ts`. */

import { useCallback } from "react";
import type { CaLamViec, CaLamViecFormValues, CauHinhMacDinh } from "../../types";
import { CAU_HINH_MAU } from "../seed";
import { useHrmStore } from "../useHrmStore";

export function useCauHinh(): CauHinhMacDinh {
  return useHrmStore().state.cauHinh;
}

/** Bộ giá trị khởi tạo — nút "Khôi phục mặc định" nạp lại đúng bộ này. */
export function cauHinhMacDinhGoc(): CauHinhMacDinh {
  return { ...CAU_HINH_MAU, bac_thue: CAU_HINH_MAU.bac_thue.map((bac) => ({ ...bac })) };
}

export function useLuuCauHinh() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (cauHinh: CauHinhMacDinh) => {
      if (cauHinh.gio_cong_chuan_ngay <= 0 || cauHinh.gio_cong_chuan_ngay > 24) {
        throw new Error("Giờ công chuẩn/ngày phải nằm trong khoảng 1–24 giờ.");
      }
      if (cauHinh.luong_toi_thieu_vung <= 0) {
        throw new Error("Lương tối thiểu vùng phải lớn hơn 0.");
      }
      // Thuế suất phải tăng dần: biểu lũy tiến mà bậc sau thấp hơn bậc trước thì
      // người thu nhập cao lại nộp ít hơn — sai ngay ở gốc, chặn từ đây.
      for (let i = 1; i < cauHinh.bac_thue.length; i += 1) {
        const truoc = cauHinh.bac_thue[i - 1];
        const sau = cauHinh.bac_thue[i];
        if (truoc && sau && sau.thue_suat <= truoc.thue_suat) {
          throw new Error(`Thuế suất bậc ${i + 1} phải cao hơn bậc ${i}.`);
        }
      }
      dispatch({ type: "cauHinh/luu", cauHinh });
    },
    [dispatch],
  );
}

export function useCaLamViecList(): CaLamViec[] {
  return useHrmStore().state.caLamViec;
}

/** Thêm mới hoặc sửa ca. Không truyền `maCa` là thêm — mã sinh tự động. */
export function useLuuCaLamViec() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: CaLamViecFormValues, maCa?: string) => {
      if (!values.ten_ca.trim()) throw new Error("Tên ca không được để trống.");
      if (!values.gio_vao || !values.gio_ra) {
        throw new Error("Ca làm việc phải có giờ vào và giờ ra.");
      }
      if (values.nghi_giua_ca < 0) throw new Error("Nghỉ giữa ca không được là số âm.");

      if (maCa) {
        const cu = state.caLamViec.find((ca) => ca.ma_ca === maCa);
        if (!cu) throw new Error("Ca làm việc không còn tồn tại.");
        dispatch({
          type: "ca/sua",
          ca: { ...values, ten_ca: values.ten_ca.trim(), ma_ca: maCa },
        });
        return;
      }

      const daDung = new Set(state.caLamViec.map((ca) => ca.ma_ca));
      let maMoi = "";
      for (let i = 1; i <= 99 && !maMoi; i += 1) {
        const ma = `CA${String(i).padStart(2, "0")}`;
        if (!daDung.has(ma)) maMoi = ma;
      }
      if (!maMoi) throw new Error("Đã đạt giới hạn 99 ca làm việc.");

      dispatch({
        type: "ca/them",
        ca: { ...values, ten_ca: values.ten_ca.trim(), ma_ca: maMoi },
      });
    },
    [state.caLamViec, dispatch],
  );
}

export function useXoaCaLamViec() {
  const { dispatch } = useHrmStore();
  return useCallback(
    async (maCa: string) => {
      dispatch({ type: "ca/xoa", maCa });
    },
    [dispatch],
  );
}

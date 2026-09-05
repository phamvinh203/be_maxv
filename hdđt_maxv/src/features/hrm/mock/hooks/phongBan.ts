/**
 * Hook nghiệp vụ phòng ban — BẢN MOCK.
 *
 * ĐỌC TRƯỚC KHI DÙNG: màn Phòng ban đã chuyển sang API thật ở `../../api/phongBanQueries.ts`.
 * File này chỉ còn phục vụ các màn CHƯA nối API (bộ lọc bảng lương, kỳ lương, set lương, bảng
 * và tab nhân viên) vì chúng vẫn đọc nhân viên từ mock store. Hai nơi đang giữ hai danh sách
 * phòng ban khác nhau — cố ý, sẽ hết khi API nhân viên xong. Thêm màn mới thì dùng bản API,
 * đừng import từ đây.
 *
 * Mọi hàm ghi đều `async` và **ném `Error` có thông điệp tiếng Việt** khi vi
 * phạm ràng buộc — component chỉ việc `try/catch` rồi toast. Giữ đúng chữ ký
 * này để khi thay bằng `useMutation` thật thì call site không phải sửa.
 */

import { useCallback, useMemo } from "react";
import { layConChau, sapXepCay, sinhMaPhongBan } from "../../cay";
import type { PhongBan, PhongBanFormValues, PhongBanRow } from "../../types";
import { useHrmStore } from "../useHrmStore";

/** Danh sách phẳng chưa xử lý — dùng cho ô Select "Trực thuộc". */
export function usePhongBanList(): PhongBan[] {
  return useHrmStore().state.phongBan;
}

/** Danh sách đã sắp theo cây, kèm cấp, tên phòng ban cha và số nhân viên. */
export function usePhongBanRows(): PhongBanRow[] {
  const { state } = useHrmStore();
  return useMemo(() => {
    const soNvTheoPb = new Map<string, number>();
    for (const nv of state.nhanVien) {
      if (!nv.ma_pb) continue;
      soNvTheoPb.set(nv.ma_pb, (soNvTheoPb.get(nv.ma_pb) ?? 0) + 1);
    }
    const tenTheoMa = new Map(state.phongBan.map((pb) => [pb.ma_pb, pb.ten_pb]));
    return sapXepCay(state.phongBan).map((pb) => ({
      ...pb,
      // Cha đã bị xóa thì hiện lại mã trần, không nuốt thành ô trống.
      ten_pb_me: pb.ma_pb_me ? (tenTheoMa.get(pb.ma_pb_me) ?? pb.ma_pb_me) : "",
      so_nv: soNvTheoPb.get(pb.ma_pb) ?? 0,
    }));
  }, [state.phongBan, state.nhanVien]);
}

/** Thêm mới hoặc sửa. Không truyền `maPb` là thêm — mã sinh tự động. */
export function useLuuPhongBan() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (values: PhongBanFormValues, maPb?: string) => {
      const tenPb = values.ten_pb.trim();
      if (!tenPb) throw new Error("Tên phòng ban không được để trống.");

      const ghiChu = values.ghi_chu.trim();

      if (!maPb) {
        dispatch({
          type: "phongBan/them",
          phongBan: {
            ma_pb: sinhMaPhongBan(state.phongBan, values.ma_pb_me),
            ten_pb: tenPb,
            ma_pb_me: values.ma_pb_me,
            ghi_chu: ghiChu,
            // Phòng ban mới luôn đang dùng — ô Trạng thái chỉ có ở chế độ sửa.
            status: "1",
          },
        });
        return;
      }

      const cu = state.phongBan.find((pb) => pb.ma_pb === maPb);
      if (!cu) throw new Error("Phòng ban không còn tồn tại, vui lòng tải lại danh sách.");
      if (values.ma_pb_me === maPb) {
        throw new Error("Phòng ban không thể trực thuộc chính nó.");
      }
      if (values.ma_pb_me && layConChau(state.phongBan, maPb).has(values.ma_pb_me)) {
        throw new Error("Không thể trực thuộc một phòng ban cấp dưới của chính nó.");
      }

      dispatch({
        type: "phongBan/sua",
        phongBan: {
          ...cu,
          ten_pb: tenPb,
          ma_pb_me: values.ma_pb_me,
          ghi_chu: ghiChu,
          status: values.status,
        },
      });
    },
    [state.phongBan, dispatch],
  );
}

export function useXoaPhongBan() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maPb: string) => {
      if (state.phongBan.some((pb) => pb.ma_pb_me === maPb)) {
        throw new Error(
          "Phòng ban còn phòng ban trực thuộc. Hãy chuyển hoặc xóa các phòng ban con trước.",
        );
      }
      const soNv = state.nhanVien.filter((nv) => nv.ma_pb === maPb).length;
      if (soNv > 0) {
        throw new Error(
          `Phòng ban còn ${soNv} nhân viên. Hãy chuyển nhân viên sang phòng ban khác trước.`,
        );
      }
      dispatch({ type: "phongBan/xoa", maPb });
    },
    [state.phongBan, state.nhanVien, dispatch],
  );
}

export function useGanNhanhPhongBan() {
  const { state, dispatch } = useHrmStore();
  return useCallback(
    async (maPb: string, maNvList: string[]) => {
      if (!maPb) throw new Error("Chưa chọn phòng ban đích.");
      if (maNvList.length === 0) throw new Error("Chưa chọn nhân viên nào.");
      if (!state.phongBan.some((pb) => pb.ma_pb === maPb)) {
        throw new Error("Phòng ban đích không còn tồn tại.");
      }
      // Có mã lạ thì từ chối cả lô: gán nửa chừng để lại trạng thái người dùng
      // không biết đã đi tới đâu.
      const daCo = new Set(state.nhanVien.map((nv) => nv.ma_nv));
      const thieu = maNvList.filter((ma) => !daCo.has(ma));
      if (thieu.length > 0) {
        throw new Error(`Không tìm thấy nhân viên: ${thieu.join(", ")}.`);
      }
      dispatch({ type: "phongBan/ganNhanh", maPb, maNvList });
    },
    [state.phongBan, state.nhanVien, dispatch],
  );
}

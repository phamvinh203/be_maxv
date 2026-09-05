/**
 * Hook phòng ban HRM chạy trên API THẬT — bản thay thế của `mock/hooks/phongBan.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock (`usePhongBanList` trả mảng, `useLuuPhongBan` trả hàm
 * `async (values, maPb?)`, ném `Error` thông điệp tiếng Việt) nên component chỉ đổi dòng
 * import. Riêng `usePhongBanRows` trả thêm trạng thái tải — bảng cần phân biệt "đang tải"
 * với "không có phòng ban nào", việc mà mảng rỗng không nói được.
 *
 * PHẠM VI: chỉ màn Phòng ban dùng file này. Các màn còn lại (bảng lương, kỳ lương, bảng
 * nhân viên, tổng quan) vẫn đọc phòng ban từ mock store — xem `mock/hooks/phongBan.ts`.
 * Nghĩa là hai nơi đang có hai danh sách phòng ban khác nhau cho tới khi API nhân viên xong.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmNhanVienKeys, hrmPhongBanKeys } from "./hrmKeys";
import { sapXepCay } from "../cay";
import type { PhongBan, PhongBanFormValues, PhongBanRow } from "../types";
import {
  createPhongBan,
  deletePhongBan,
  listPhongBan,
  updatePhongBan,
  type PhongBanApiBody,
  type PhongBanApiRow,
} from "./phongBanApi";

/** BE để null cho ô trống, type FE dùng chuỗi rỗng — quy đổi ngay tại biên, không rò xuống dưới. */
function veKieuFe(r: PhongBanApiRow): PhongBan {
  return {
    ma_pb: r.ma_pb,
    ten_pb: r.ten_pb,
    ma_pb_me: r.ma_pb_me,
    ghi_chu: r.ghi_chu ?? "",
    status: r.status,
  };
}

function useDanhSachPhongBan() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData: (prev) => prev`: nó giữ dữ liệu cũ xuyên qua việc ĐỔI query
  // key, mà key ở đây gắn `currentCompanyId` — đổi công ty sẽ hiện nguyên danh sách phòng ban của
  // công ty trước dưới tên công ty mới, `isLoading` lại là false nên không có dấu hiệu nào.
  // Ba truy vấn này không phân trang nên cũng chẳng được lợi gì từ nó.
  return useQuery({
    queryKey: hrmPhongBanKeys.list(currentCompanyId),
    queryFn: () => listPhongBan(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Danh sách phẳng chưa xử lý — dùng cho ô Select "Trực thuộc". */
export function usePhongBanList(): PhongBan[] {
  const { data } = useDanhSachPhongBan();
  return useMemo(() => (data ?? []).map(veKieuFe), [data]);
}

/** Danh sách đã sắp theo cây, kèm cấp, tên phòng ban cha và số nhân viên. */
export function usePhongBanRows(): {
  rows: PhongBanRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachPhongBan();

  const rows = useMemo<PhongBanRow[]>(() => {
    const goc = data ?? [];
    const tenChaTheoMa = new Map(goc.map((r) => [r.ma_pb, r.ten_pb_me]));
    const soNvTheoMa = new Map(goc.map((r) => [r.ma_pb, r.so_nv]));

    // `cap` tính ở FE (sapXepCay) chứ không lấy từ BE: nó phụ thuộc thứ tự duyệt cây của đúng
    // tập dòng đang hiển thị, không phải thuộc tính lưu trong DB.
    return sapXepCay(goc.map(veKieuFe)).map((pb) => ({
      ...pb,
      // Cha đã bị xóa thì hiện lại mã trần, không nuốt thành ô trống (giữ hành vi bản mock).
      ten_pb_me: pb.ma_pb_me
        ? (tenChaTheoMa.get(pb.ma_pb) ?? pb.ma_pb_me)
        : "",
      so_nv: soNvTheoMa.get(pb.ma_pb) ?? 0,
    }));
  }, [data]);

  return { rows, isLoading, isError, error };
}

/**
 * Làm mới sau khi ghi. Phải đụng cả danh sách NHÂN VIÊN: mỗi dòng nhân viên mang `ten_pb` do
 * BE tra sẵn, đổi tên hoặc xóa phòng ban mà không nạp lại thì bảng nhân viên còn hiện tên cũ.
 */
function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmPhongBanKeys.all });
    void qc.invalidateQueries({ queryKey: hrmNhanVienKeys.all });
  };
}

/**
 * Thêm mới hoặc sửa. Không truyền `maPb` là thêm — mã do BE sinh theo cây.
 *
 * Các luật "không trực thuộc chính nó / không trực thuộc cấp dưới của mình" KHÔNG kiểm lại ở
 * đây: BE đã chặn và trả thông điệp tiếng Việt, kiểm hai nơi là hai bộ luật phải giữ đồng bộ.
 * Form vẫn loại sẵn chính nó + nhánh dưới khỏi ô Select nên người dùng hiếm khi chạm tới.
 */
export function useLuuPhongBan() {
  const lamMoi = useLamMoi();
  const taoMoi = useMutation({
    mutationFn: createPhongBan,
    onSuccess: lamMoi,
  });
  const capNhat = useMutation({
    mutationFn: ({ maPb, body }: { maPb: string; body: PhongBanApiBody }) =>
      updatePhongBan(maPb, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (values: PhongBanFormValues, maPb?: string) => {
      const tenPb = values.ten_pb.trim();
      if (!tenPb) throw new Error("Tên phòng ban không được để trống.");

      const ghiChu = values.ghi_chu.trim();
      const body = {
        ten_pb: tenPb,
        ma_pb_me: values.ma_pb_me,
        ghi_chu: ghiChu || null,
        status: values.status,
      };

      if (!maPb) {
        // Phòng ban mới luôn đang dùng — ô Trạng thái chỉ có ở chế độ sửa.
        await taoMoi.mutateAsync({ ...body, status: "1" });
        return;
      }
      await capNhat.mutateAsync({ maPb, body });
    },
    [taoMoi, capNhat],
  );
}

/** Xóa. Luật "còn phòng ban con / còn nhân viên" do BE chặn, thông điệp hiện thẳng lên toast. */
export function useXoaPhongBan() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({ mutationFn: deletePhongBan, onSuccess: lamMoi });

  return useCallback(
    async (maPb: string) => {
      await xoa.mutateAsync(maPb);
    },
    [xoa],
  );
}

/**
 * Hook ca làm việc HRM chạy trên API THẬT — bản thay thế phần ca của `mock/hooks/cauHinh.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock (`useCaLamViecList` trả mảng, `useLuuCaLamViec` trả hàm
 * `async (values, maCa?)`, `useXoaCaLamViec` trả `async (maCa)`) nên component chỉ đổi dòng
 * import. `useLuuCaLamViec` trả THÊM mã cảnh báo của máy chủ — bên gọi cũ bỏ qua vẫn chạy đúng.
 *
 * CHỖ DỄ NHẦM: giao diện định danh ca bằng **mã ca** (`ma_ca`), còn API định danh bằng **id**
 * (UUID). Ánh xạ mã → id nằm gọn trong file này, đọc từ chính danh sách đã tải; đừng gửi mã ca
 * vào đường dẫn `/:id`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmWorkShiftKeys } from "../hrmKeys";
import type { CaLamViec, CaLamViecFormValues } from "../../types";
import {
  listWorkShifts,
  createWorkShift,
  updateWorkShift,
  deleteWorkShift,
  type CreateWorkShiftApiBody,
  type ShiftStatusApi,
  type UpdateWorkShiftApiBody,
  type WorkShiftApiItem,
} from "./workShiftsApi";
import { PAGE_SIZE_TOI_DA, taiHetTrang } from "./taiHetTrang";

/** Mã cảnh báo máy chủ trả khi số giờ công của ca vượt trần 12h (BR-hrm-076). */
export const CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD = "CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD";

/**
 * Trạng thái FE là `"1" | "0"`, API là `ACTIVE | INACTIVE` — quy đổi ngay tại biên.
 * Viết thành hàm có kiểu trả về tường minh để literal không bị nới thành `string`.
 */
function veTrangThaiApi(status: CaLamViec["status"]): ShiftStatusApi {
  return status === "1" ? "ACTIVE" : "INACTIVE";
}

/** Adapter BE → FE. `warning` vắng mặt thì `canh_bao` cũng vắng mặt, không dựng chuỗi rỗng. */
function veKieuFe(r: WorkShiftApiItem): CaLamViec {
  return {
    ma_ca: r.code || "",
    ten_ca: r.name || "",
    // Máy chủ trả đúng `HH:mm`; cắt 5 ký tự để chịu được cả trường hợp có giây.
    gio_vao: r.startTime ? r.startTime.slice(0, 5) : "",
    gio_ra: r.endTime ? r.endTime.slice(0, 5) : "",
    nghi_giua_ca: r.breakMinutes ?? 0,
    status: r.status === "ACTIVE" ? "1" : "0",
    so_gio_cong: r.workingHours,
    ...(r.warning ? { canh_bao: r.warning } : {}),
  };
}

/**
 * Kéo **toàn bộ** danh mục ca, theo trang, trần `pageSize` của máy chủ là 100
 * (`workShifts.validator.ts:73`).
 *
 * ⚠️ Chú thích cũ ở đây ghi "tối đa 99 dòng (mã tự sinh `CA01`–`CA99`) nên kéo một lượt" —
 * **lập luận đó sai**. `CA01`–`CA99` chỉ là dải mã **tự sinh**; người dùng được **tự nhập mã**
 * tới 20 ký tự (`workShifts.validator.ts:8-14`) nên số ca không bị chặn ở 99. Công ty vượt 100
 * ca thì bảng cụt **im lặng**, và tệ hơn: `useLuuCaLamViec` / `useXoaCaLamViec` tra `id` theo mã
 * trong chính danh sách đã cụt ⇒ báo "Ca làm việc không còn tồn tại" cho ca **có thật**
 * (🟢 đề xuất 3 của biên bản review 2026-09-08). Cùng lớp lỗi với `B1` bên ngày lễ.
 */
function useDanhSachCaLamViec() {
  const { currentCompanyId, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: hrmWorkShiftKeys.list(currentCompanyId),
    queryFn: () =>
      taiHetTrang(
        "danh mục ca làm việc",
        (trang) =>
          listWorkShifts({
            page: trang,
            pageSize: PAGE_SIZE_TOI_DA,
            sortBy: "code",
            sortOrder: "asc",
          }),
        (ca) => ca.id,
      ),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Danh sách ca làm việc — giữ đúng chữ ký mock (trả thẳng mảng). */
export function useCaLamViecList(): CaLamViec[] {
  const { data } = useDanhSachCaLamViec();
  return useMemo(() => (data?.items ?? []).map(veKieuFe), [data]);
}

/**
 * Trạng thái tải/lỗi của danh sách ca — bảng cần phân biệt "đang tải" với "chưa có ca nào".
 *
 * `thieuDong` bật khi danh mục vượt trần 20 trang: bảng đang thiếu ca, và mọi thao tác sửa/xóa
 * theo mã ca có thể báo nhầm "không còn tồn tại". Phải nói ra, đừng để người dùng tự đoán.
 */
export function useTrangThaiCaLamViec(): {
  dangTai: boolean;
  loi: boolean;
  thieuDong: boolean;
} {
  const { isLoading, isError, data } = useDanhSachCaLamViec();
  return {
    dangTai: isLoading,
    loi: isError,
    thieuDong: data ? !data.daDayDu : false,
  };
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmWorkShiftKeys.all });
  };
}

/**
 * Thêm mới hoặc sửa ca. Không truyền `maCa` là thêm — **mã do máy chủ sinh** (gap scanning
 * `CA01`–`CA99`), nên không gửi `code` lên.
 *
 * Trả mã cảnh báo (`CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD`) nếu ca vừa lưu vượt trần 12h.
 * Ngưỡng 12h **không** được tính lại ở đây: đó là luật của máy chủ (ADR-009 QĐ 4).
 */
export function useLuuCaLamViec(): (
  values: CaLamViecFormValues,
  maCa?: string,
) => Promise<string | undefined> {
  const lamMoi = useLamMoi();
  const { data } = useDanhSachCaLamViec();

  const taoMoi = useMutation({
    mutationFn: (body: CreateWorkShiftApiBody) => createWorkShift(body),
    onSuccess: lamMoi,
  });
  const capNhat = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWorkShiftApiBody }) =>
      updateWorkShift(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (values: CaLamViecFormValues, maCa?: string) => {
      const tenCa = values.ten_ca.trim();
      if (!tenCa) throw new Error("Tên ca không được để trống.");
      if (!values.gio_vao || !values.gio_ra) {
        throw new Error("Ca làm việc phải có giờ vào và giờ ra.");
      }
      if (values.nghi_giua_ca < 0) {
        throw new Error("Nghỉ giữa ca không được là số âm.");
      }

      const body = {
        name: tenCa,
        startTime: values.gio_vao,
        endTime: values.gio_ra,
        breakMinutes: values.nghi_giua_ca,
        status: veTrangThaiApi(values.status),
      };

      if (maCa) {
        const item = data?.items.find((x) => x.code === maCa);
        if (!item) throw new Error("Ca làm việc không còn tồn tại.");
        const ketQua = await capNhat.mutateAsync({ id: item.id, body });
        return ketQua.warning;
      }

      const ketQua = await taoMoi.mutateAsync(body);
      return ketQua.warning;
    },
    [taoMoi, capNhat, data?.items],
  );
}

/** Xóa ca theo mã. Ràng buộc "ca đang được dùng" do máy chủ chặn, thông điệp hiện thẳng lên toast. */
export function useXoaCaLamViec(): (maCa: string) => Promise<void> {
  const lamMoi = useLamMoi();
  const { data } = useDanhSachCaLamViec();

  const xoa = useMutation({
    mutationFn: (id: string) => deleteWorkShift(id),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maCa: string) => {
      const item = data?.items.find((x) => x.code === maCa);
      if (!item) throw new Error("Ca làm việc không còn tồn tại.");
      await xoa.mutateAsync(item.id);
    },
    [xoa, data?.items],
  );
}

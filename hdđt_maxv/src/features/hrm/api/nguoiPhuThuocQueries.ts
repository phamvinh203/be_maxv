/**
 * Hook người phụ thuộc chạy trên API THẬT — bản thay thế của `mock/hooks/nguoiPhuThuoc.ts`.
 * Giữ nguyên chữ ký hook bản mock nên hai lối vào (tab trong hồ sơ nhân viên và màn hình độc
 * lập) chỉ đổi dòng import.
 *
 * Ba chỗ phải quy đổi vì FE và BE mô tả cùng dữ liệu theo hai kiểu khác nhau:
 *   - ngày sinh: FE `<input type="date">` = `YYYY-MM-DD`  <->  BE lưu CHỮ `dd/MM/yyyy`
 *   - kỳ giảm trừ: FE `<input type="month">` = `YYYY-MM`  <->  BE tách 4 số nguyên tháng/năm
 *   - MST: FE gọi `mst_ca_nhan`, BE gọi `mst`
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmNhanVienKeys, hrmNptKeys } from "./hrmKeys";
import type {
  NguoiPhuThuoc,
  NguoiPhuThuocFormValues,
  NguoiPhuThuocRow,
  QuanHe,
} from "../types";
import {
  createNguoiPhuThuoc,
  deleteNguoiPhuThuoc,
  listNguoiPhuThuoc,
  updateNguoiPhuThuoc,
  type NguoiPhuThuocApiBody,
  type NguoiPhuThuocApiRow,
} from "./nguoiPhuThuocApi";

/** `dd/MM/yyyy` (BE) -> `YYYY-MM-DD` cho ô nhập ngày. Sai dạng thì trả rỗng, không đoán bừa. */
function ngaySinhVeFe(s: string | null): string {
  if (!s) return "";
  const khop = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return khop ? `${khop[3]}-${khop[2]}-${khop[1]}` : "";
}

/** `YYYY-MM-DD` (ô nhập ngày) -> `dd/MM/yyyy` cho BE. */
function ngaySinhVeApi(s: string): string | null {
  const khop = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  return khop ? `${khop[3]}/${khop[2]}/${khop[1]}` : null;
}

/** Cặp (tháng, năm) của BE -> `YYYY-MM` cho `<input type="month">`. */
function kyVeFe(thang: number | null, nam: number | null): string {
  if (!thang || !nam) return "";
  return `${nam}-${String(thang).padStart(2, "0")}`;
}

/** `YYYY-MM` -> cặp (tháng, năm) cho BE. Rỗng/sai dạng -> cả hai null (BE bắt đi theo cặp). */
function kyVeApi(s: string): { thang: number | null; nam: number | null } {
  const khop = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!khop) return { thang: null, nam: null };
  return { thang: Number(khop[2]), nam: Number(khop[1]) };
}

function veKieuFe(r: NguoiPhuThuocApiRow): NguoiPhuThuoc {
  return {
    id: r.id,
    ma_nv: r.ma_nv,
    ho_ten: r.ho_ten,
    // BE để quan hệ là chữ tự do; danh sách gợi ý nằm ở FE nên ép kiểu về đúng union hiển thị.
    quan_he: (r.quan_he ?? "khac") as QuanHe,
    ngay_sinh: ngaySinhVeFe(r.ngay_sinh),
    so_cccd: r.so_cccd ?? "",
    mst_ca_nhan: r.mst ?? "",
    dien_thoai: r.dien_thoai ?? "",
    dia_chi: r.dia_chi ?? "",
    gt_tu_thang: kyVeFe(r.dk_tu_thang, r.dk_tu_nam),
    gt_den_thang: kyVeFe(r.dk_den_thang, r.dk_den_nam),
  };
}

function veKieuApi(values: NguoiPhuThuocFormValues): NguoiPhuThuocApiBody {
  const tu = kyVeApi(values.gt_tu_thang);
  const den = kyVeApi(values.gt_den_thang);
  return {
    ho_ten: values.ho_ten.trim(),
    quan_he: values.quan_he || null,
    ngay_sinh: ngaySinhVeApi(values.ngay_sinh),
    so_cccd: values.so_cccd.trim() || null,
    mst: values.mst_ca_nhan.trim() || null,
    dien_thoai: values.dien_thoai.trim() || null,
    dia_chi: values.dia_chi.trim() || null,
    dk_tu_thang: tu.thang,
    dk_tu_nam: tu.nam,
    dk_den_thang: den.thang,
    dk_den_nam: den.nam,
  };
}

/**
 * Lấy TOÀN BỘ người phụ thuộc của công ty rồi lọc ở client.
 * Danh mục này nhỏ (vài người/nhân viên) và cả hai lối vào đều cần cùng bộ dữ liệu — một
 * query dùng chung thì đổi ở tab cũng thấy ngay ở màn danh sách, không phải nghĩ cách đồng bộ
 * nhiều cache theo từng `ma_nv`.
 */
function useDanhSachNpt() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  // KHÔNG dùng `placeholderData: (prev) => prev`: nó giữ dữ liệu cũ xuyên qua việc ĐỔI query
  // key, mà key ở đây gắn `currentCompanyId` — đổi công ty sẽ hiện nguyên danh sách người phụ thuộc của
  // công ty trước dưới tên công ty mới, `isLoading` lại là false nên không có dấu hiệu nào.
  // Ba truy vấn này không phân trang nên cũng chẳng được lợi gì từ nó.
  return useQuery({
    queryKey: hrmNptKeys.list(currentCompanyId),
    queryFn: () => listNguoiPhuThuoc(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/**
 * Người phụ thuộc của một nhân viên, kèm trạng thái tải.
 *
 * Trả kèm `isLoading`/`isError` chứ không trả mảng trần như bản mock: tab này nằm trong hồ sơ
 * nhân viên, mảng rỗng lúc lỗi mạng đọc thành "chưa có người phụ thuộc" và người dùng sẽ nhập
 * lại một bản trùng.
 */
export function useNguoiPhuThuocList(maNv: string | null): {
  items: NguoiPhuThuoc[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachNpt();
  const items = useMemo(
    () =>
      maNv ? (data ?? []).filter((r) => r.ma_nv === maNv).map(veKieuFe) : [],
    [data, maNv],
  );
  return { items, isLoading, isError, error };
}

/** Toàn công ty, kèm tên nhân viên — cho màn hình độc lập. `q` lọc theo tên/mã/CCCD. */
export function useNguoiPhuThuocRows(q: string): {
  rows: NguoiPhuThuocRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { data, isLoading, isError, error } = useDanhSachNpt();

  const rows = useMemo<NguoiPhuThuocRow[]>(() => {
    const tuKhoa = q.trim().toLowerCase();
    return (data ?? [])
      .map((r) => ({ ...veKieuFe(r), ten_nv: r.ten_nv ?? r.ma_nv }))
      .filter((row) => {
        if (!tuKhoa) return true;
        return [row.ma_nv, row.ten_nv, row.ho_ten, row.so_cccd, row.mst_ca_nhan].some(
          (truong) => truong.toLowerCase().includes(tuKhoa),
        );
      })
      .sort(
        (a, b) =>
          a.ma_nv.localeCompare(b.ma_nv) || a.ho_ten.localeCompare(b.ho_ten),
      );
  }, [data, q]);

  return { rows, isLoading, isError, error };
}

/**
 * Làm mới sau khi ghi. Phải đụng cả danh sách NHÂN VIÊN: cột `so_npt` ở bảng nhân viên do BE
 * đếm, thêm/xóa người phụ thuộc mà không nạp lại thì con số đứng im.
 */
function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmNptKeys.all });
    void qc.invalidateQueries({ queryKey: hrmNhanVienKeys.all });
  };
}

/**
 * Thêm mới hoặc sửa. Không truyền `id` là thêm.
 *
 * Luật "tháng kết thúc phải sau tháng bắt đầu" và "nhân viên phải tồn tại" do BE chặn, thông
 * điệp hiện thẳng lên toast — không kiểm lại ở đây để khỏi phải giữ hai bộ luật đồng bộ.
 */
export function useLuuNguoiPhuThuoc() {
  const lamMoi = useLamMoi();
  const them = useMutation({
    mutationFn: createNguoiPhuThuoc,
    onSuccess: lamMoi,
  });
  const sua = useMutation({
    mutationFn: ({ id, body }: { id: string; body: NguoiPhuThuocApiBody }) =>
      updateNguoiPhuThuoc(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maNv: string, values: NguoiPhuThuocFormValues, id?: string) => {
      if (!maNv) throw new Error("Chưa chọn nhân viên.");
      if (!values.ho_ten.trim()) {
        throw new Error("Họ và tên người phụ thuộc không được để trống.");
      }

      const body = veKieuApi(values);
      if (id) await sua.mutateAsync({ id, body });
      else await them.mutateAsync({ ...body, ma_nv: maNv });
    },
    [them, sua],
  );
}

export function useXoaNguoiPhuThuoc() {
  const lamMoi = useLamMoi();
  const xoa = useMutation({
    mutationFn: deleteNguoiPhuThuoc,
    onSuccess: lamMoi,
  });

  return useCallback(
    async (id: string) => {
      await xoa.mutateAsync(id);
    },
    [xoa],
  );
}

/**
 * Hook Danh mục lương & phụ cấp chạy trên API THẬT — bản thay thế `mock/hooks/khoanLuong.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock (`useKhoanLuongList` trả mảng, `useKhoanLuongRows(filters)`,
 * `useSoKhoanTheoLoai` trả Map, `useLuuKhoanLuong` trả `async (values, maKhoan?)`,
 * `useXoaKhoanLuong` trả `async (maKhoan)`) nên component chỉ đổi dòng import.
 *
 * CHỖ DỄ NHẦM: giao diện định danh khoản bằng **mã khoản** (`ma_khoan`), còn API định danh
 * bằng **id** (UUID) cho sửa/xóa. Ánh xạ mã → id đọc từ chính danh sách đã tải, đừng gửi mã
 * khoản vào đường dẫn `/:id`.
 *
 * Trùng tên trong cùng loại (BR-sal-002) và khoản đang dùng không xóa được (BR-sal-004) đã do
 * máy chủ chặn (E-sal-002 / E-sal-003) — không kiểm tra lại ở đây, để thông điệp lỗi hiện
 * thẳng lên toast qua `getErrorMessage`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmSalaryItemKeys } from "../hrmKeys";
import {
  createSalaryItem,
  deleteSalaryItem,
  listSalaryItems,
  updateSalaryItem,
  type SalaryItemApiItem,
  type SalaryItemCategoryApi,
  type UpdateSalaryItemApiBody,
} from "./salaryItemsApi";
import type { KhoanLuong, KhoanLuongFormValues, LoaiKhoanLuong } from "../../types";

export interface KhoanLuongFilters {
  q: string;
  /** Rỗng = mọi loại. */
  loai: LoaiKhoanLuong | "";
}

/** Bảy loại khoản của FE ↔ bảy category của máy chủ — khớp 1-1 theo nghiệp vụ. */
const LOAI_TO_CATEGORY: Record<LoaiKhoanLuong, SalaryItemCategoryApi> = {
  luong_phu_cap: "FIXED_ALLOWANCE",
  luong_ho_tro: "BENEFIT_ALLOWANCE",
  luong_nghiem_thu: "DELIVERY_PIECEWORK",
  luong_phan_tram: "COMMISSION_PERCENTAGE",
  luong_kpi: "KPI_PERFORMANCE",
  luong_thuong: "PERIODIC_BONUS",
  luong_chuyen_can: "ATTENDANCE_ALLOWANCE",
};

/** Chiều ngược lại — suy từ `LOAI_TO_CATEGORY` để khỏi giữ tay hai bảng cùng một dữ liệu. */
const CATEGORY_TO_LOAI = Object.fromEntries(
  Object.entries(LOAI_TO_CATEGORY).map(([loai, category]) => [category, loai]),
) as Record<SalaryItemCategoryApi, LoaiKhoanLuong>;

/** Adapter BE → FE. */
function veKieuFe(r: SalaryItemApiItem): KhoanLuong {
  return {
    ma_khoan: r.code,
    // Loại lạ (dữ liệu cũ hiếm gặp) vẫn phải render được — rơi về loại đầu.
    loai: CATEGORY_TO_LOAI[r.category] ?? "luong_phu_cap",
    ten_khoan: r.name,
    ghi_chu: r.description ?? "",
    tinh_bhxh: r.isSocialInsurance,
    chiu_thue_tncn: r.isTaxable,
    ty_le: r.defaultRate ?? 0,
    status: r.status === "ACTIVE" ? "1" : "0",
  };
}

function useDanhSachKhoanLuong() {
  const { currentCompanyId, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: hrmSalaryItemKeys.list(currentCompanyId),
    queryFn: () => listSalaryItems(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Danh sách khoản lương — giữ đúng chữ ký mock (trả thẳng mảng). */
export function useKhoanLuongList(): KhoanLuong[] {
  const { data } = useDanhSachKhoanLuong();
  return useMemo(() => (data ?? []).map(veKieuFe), [data]);
}

export function useKhoanLuongRows(filters: KhoanLuongFilters): KhoanLuong[] {
  const rows = useKhoanLuongList();
  return useMemo(() => {
    const tuKhoa = filters.q.trim().toLowerCase();
    return rows.filter((kl) => {
      if (filters.loai && kl.loai !== filters.loai) return false;
      if (!tuKhoa) return true;
      return [kl.ma_khoan, kl.ten_khoan, kl.ghi_chu].some((truong) =>
        truong.toLowerCase().includes(tuKhoa),
      );
    });
  }, [rows, filters]);
}

/** Đếm số khoản theo từng loại — hiện lên nút ở cột "Tạo danh mục". */
export function useSoKhoanTheoLoai(): Map<LoaiKhoanLuong, number> {
  const rows = useKhoanLuongList();
  return useMemo(() => {
    const dem = new Map<LoaiKhoanLuong, number>();
    for (const kl of rows) {
      dem.set(kl.loai, (dem.get(kl.loai) ?? 0) + 1);
    }
    return dem;
  }, [rows]);
}

/** Danh sách khoản thưởng đang dùng (cho phân hệ Thưởng) */
export function useKhoanThuongList(): KhoanLuong[] {
  const items = useKhoanLuongList();
  return useMemo(
    () => items.filter((kl) => kl.loai === "luong_thuong" && kl.status === "1"),
    [items],
  );
}

/** Danh sách khoản phần trăm đang dùng (cho phân hệ Lương phần trăm) */
export function useKhoanPhanTramList(): KhoanLuong[] {
  const items = useKhoanLuongList();
  return useMemo(
    () => items.filter((kl) => kl.loai === "luong_phan_tram" && kl.status === "1"),
    [items],
  );
}

/**
 * Mã khoản (`ma_khoan`) → id thật của máy chủ.
 *
 * Khu "Dữ liệu tính lương" (Thưởng, Lương phần trăm) định danh khoản bằng **mã**, còn API
 * `POST /payroll-data/{bonus,commission}/apply` cần **id** (`salaryItemId`) — map này đổi ngay
 * trước khi gửi. Cùng `queryKey`/`queryFn` với `useKhoanLuongList` nên không tốn thêm request.
 */
export function useKhoanLuongIdByCode(): Map<string, string> {
  const { data } = useDanhSachKhoanLuong();
  return useMemo(() => new Map((data ?? []).map((x) => [x.code, x.id])), [data]);
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmSalaryItemKeys.all });
  };
}

/** Thêm mới hoặc sửa. Không truyền `maKhoan` là thêm — mã do máy chủ sinh, không gửi `code`. */
export function useLuuKhoanLuong(): (
  values: KhoanLuongFormValues,
  maKhoan?: string,
) => Promise<void> {
  const lamMoi = useLamMoi();
  const { data } = useDanhSachKhoanLuong();

  const taoMoi = useMutation({
    mutationFn: createSalaryItem,
    onSuccess: lamMoi,
  });
  const capNhat = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSalaryItemApiBody }) =>
      updateSalaryItem(id, body),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (values: KhoanLuongFormValues, maKhoan?: string) => {
      const tenKhoan = values.ten_khoan.trim();
      if (!tenKhoan) throw new Error("Tên khoản không được để trống.");

      const category = LOAI_TO_CATEGORY[values.loai];

      if (maKhoan) {
        const item = data?.find((x) => x.code === maKhoan);
        if (!item) throw new Error("Khoản lương không còn tồn tại.");
        await capNhat.mutateAsync({
          id: item.id,
          body: {
            name: tenKhoan,
            category,
            description: values.ghi_chu || null,
            isSocialInsurance: values.tinh_bhxh,
            isTaxable: values.chiu_thue_tncn,
            defaultRate: values.ty_le,
            status: values.status === "1" ? "ACTIVE" : "INACTIVE",
          },
        });
        return;
      }

      await taoMoi.mutateAsync({
        name: tenKhoan,
        category,
        description: values.ghi_chu || null,
        isSocialInsurance: values.tinh_bhxh,
        isTaxable: values.chiu_thue_tncn,
        defaultRate: values.ty_le,
      });
    },
    [taoMoi, capNhat, data],
  );
}

export function useXoaKhoanLuong(): (maKhoan: string) => Promise<void> {
  const lamMoi = useLamMoi();
  const { data } = useDanhSachKhoanLuong();

  const xoa = useMutation({
    mutationFn: deleteSalaryItem,
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maKhoan: string) => {
      const item = data?.find((x) => x.code === maKhoan);
      if (!item) throw new Error("Khoản lương không còn tồn tại.");
      await xoa.mutateAsync(item.id);
    },
    [xoa, data],
  );
}

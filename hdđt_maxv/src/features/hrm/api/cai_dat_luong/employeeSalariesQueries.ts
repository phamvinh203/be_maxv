/**
 * Hook Thiết lập lương nhân viên chạy trên API THẬT — bản thay thế phần set lương của
 * `mock/hooks/setLuong.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock (`useSetLuongCuaNhanVien`, `useSetLuongRows(filters)`,
 * `useDemSetLuong`, `useLuuSetLuong`, `useXoaSetLuong`, `useDuyetLuong`) nên component chỉ đổi
 * dòng import.
 *
 * CHỖ DỄ NHẦM:
 * - Máy chủ định danh nhân viên bằng chính `ma_nv` (không có id riêng) nên không cần ánh xạ gì —
 *   khác với ca làm việc / khoản lương phải tra mã → UUID.
 * - `useDuyetLuong` gọi endpoint duyệt HÀNG LOẠT (`POST .../approve`) bỏ trống `employeeIds` —
 *   máy chủ hiểu là duyệt TẤT CẢ bản đang chờ, đúng hành vi mock cũ. Máy chủ không có endpoint
 *   duyệt riêng từng người (`api-contract-cai-dat-luong.md` mục 3.4 mô tả sai, route đó không
 *   tồn tại), nhưng UI hiện tại cũng chỉ có nút duyệt hàng loạt nên không thiếu chức năng.
 * - `status` của máy chủ có 4 giá trị (`DRAFT/PENDING_APPROVAL/APPROVED/REJECTED`), FE chỉ có 3
 *   (`nhap/cho_duyet/da_duyet`). `REJECTED` rơi về `cho_duyet` (coi như "chưa xong") — không chỉ
 *   vì UI chưa có nút "từ chối", mà vì backend không có bất kỳ endpoint/service nào ghi trạng thái
 *   này (`employeeSalaries.service.ts` chỉ ghi `PENDING_APPROVAL`/`APPROVED`) — trạng thái này
 *   không thể phát sinh qua bất kỳ luồng nào của hệ thống hiện tại, không riêng UI.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmEmployeeSalaryKeys } from "../hrmKeys";
import {
  approveEmployeeSalaries,
  countEmployeeSalaries,
  deleteEmployeeSalary,
  getEmployeeSalary,
  listEmployeeSalaries,
  setEmployeeSalary,
  type EmployeeSalaryDetailApi,
  type EmployeeSalaryListItemApi,
  type EmployeeSalaryListParams,
  type EmployeeSalaryStatusApi,
} from "./employeeSalariesApi";
import type {
  LoaiHopDong,
  SetLuongFilters,
  SetLuongNhanVien,
  SetLuongRow,
  TrangThaiSetLuong,
} from "../../types";

const STATUS_TO_TRANG_THAI: Record<EmployeeSalaryStatusApi, TrangThaiSetLuong> = {
  DRAFT: "nhap",
  PENDING_APPROVAL: "cho_duyet",
  APPROVED: "da_duyet",
  // Không có luồng nào (kể cả backend) từng ghi trạng thái này — xem chú thích đầu file.
  REJECTED: "cho_duyet",
};

function veTrangThaiFe(status: EmployeeSalaryStatusApi | null): TrangThaiSetLuong | null {
  return status ? STATUS_TO_TRANG_THAI[status] : null;
}

function veHangFe(r: EmployeeSalaryListItemApi): SetLuongRow {
  return {
    ma_nv: r.ma_nv,
    ho_ten: r.ho_ten,
    ten_cv: r.ten_cv,
    loai_hd: (r.loai_hd as LoaiHopDong | null) ?? null,
    so_tk: r.so_tk,
    daSet: r.daSet,
    lan_thiet_lap: r.setupVersion,
    hieu_luc_tu: r.effectiveFrom ?? "",
    hieu_luc_den: r.effectiveTo ?? "",
    tong_luong: r.totalAmount,
    trang_thai: veTrangThaiFe(r.status),
  };
}

/**
 * Danh sách nhân viên kèm tình trạng set lương — máy chủ lọc sẵn theo đúng tham số của FE.
 *
 * Ô tìm kiếm gõ tới đâu bắn request tới đó (khác `useKhoanLuongRows` lọc client-side trên danh
 * mục đã tải hết) — debounce 300ms trước khi đưa vào query key, cùng ngưỡng với ô MST ở
 * `CompanyFormDialog`.
 */
export function useSetLuongRows(filters: SetLuongFilters): SetLuongRow[] {
  const { currentCompanyId, isAuthenticated } = useAuth();

  const [qDaDebounce, setQDaDebounce] = useState(filters.q);
  useEffect(() => {
    const timer = setTimeout(() => setQDaDebounce(filters.q), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const params: EmployeeSalaryListParams = {
    q: qDaDebounce || undefined,
    ma_pb: filters.ma_pb || undefined,
    loai_hd: filters.loai_hd || undefined,
    daSet: filters.daSet,
  };

  const { data } = useQuery({
    queryKey: hrmEmployeeSalaryKeys.list(currentCompanyId, params),
    queryFn: () => listEmployeeSalaries(params),
    enabled: isAuthenticated && !!currentCompanyId,
  });

  return useMemo(() => (data ?? []).map(veHangFe), [data]);
}

/** Đếm cho hai nhãn "Đã set lương" / "Chưa set lương". */
export function useDemSetLuong(): { daSet: number; chuaSet: number } {
  const { currentCompanyId, isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: hrmEmployeeSalaryKeys.counts(currentCompanyId),
    queryFn: () => countEmployeeSalaries(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
  return { daSet: data?.daSet ?? 0, chuaSet: data?.chuaSet ?? 0 };
}

function veSetLuongNhanVienFe(r: EmployeeSalaryDetailApi | undefined): SetLuongNhanVien | null {
  if (!r || !r.id) return null;
  return {
    ma_nv: r.ma_nv,
    lan_thiet_lap: r.setupVersion,
    hieu_luc_tu: r.effectiveFrom,
    hieu_luc_den: r.effectiveTo,
    khoan: r.khoan,
    trang_thai: STATUS_TO_TRANG_THAI[r.status],
  };
}

export function useSetLuongCuaNhanVien(maNv: string | null): SetLuongNhanVien | null {
  const { currentCompanyId, isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: hrmEmployeeSalaryKeys.detail(currentCompanyId, maNv ?? ""),
    queryFn: () => getEmployeeSalary(maNv as string),
    enabled: isAuthenticated && !!currentCompanyId && !!maNv,
  });
  return useMemo(() => veSetLuongNhanVienFe(data), [data]);
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmEmployeeSalaryKeys.all });
  };
}

/**
 * Lưu set lương của một nhân viên. Gửi thẳng map `{ma_khoan: số_tiền}` — validator của máy chủ
 * (`employeeSalaries.validator.ts`) nhận trực tiếp định dạng `khoan` này, không cần đổi sang
 * mảng `items`.
 */
export function useLuuSetLuong(): (
  maNv: string,
  khoan: Record<string, number>,
) => Promise<void> {
  const lamMoi = useLamMoi();
  const luu = useMutation({
    mutationFn: ({ maNv, khoan }: { maNv: string; khoan: Record<string, number> }) =>
      setEmployeeSalary(maNv, { khoan }),
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maNv: string, khoan: Record<string, number>) => {
      await luu.mutateAsync({ maNv, khoan });
    },
    [luu],
  );
}

export function useXoaSetLuong(): (maNv: string) => Promise<void> {
  const lamMoi = useLamMoi();
  const xoa = useMutation({
    mutationFn: deleteEmployeeSalary,
    onSuccess: lamMoi,
  });

  return useCallback(
    async (maNv: string) => {
      await xoa.mutateAsync(maNv);
    },
    [xoa],
  );
}

/** Duyệt toàn bộ bản set lương đang chờ (bỏ trống `employeeIds`). Trả về số bản đã duyệt. */
export function useDuyetLuong(): () => Promise<number> {
  const lamMoi = useLamMoi();
  const duyet = useMutation({
    mutationFn: () => approveEmployeeSalaries(),
    onSuccess: lamMoi,
  });

  return useCallback(async () => {
    const ketQua = await duyet.mutateAsync();
    return ketQua.approvedCount;
  }, [duyet]);
}

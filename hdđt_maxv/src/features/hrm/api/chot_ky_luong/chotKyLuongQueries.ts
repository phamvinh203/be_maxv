import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollPeriodKeys } from "../hrmKeys";
import {
  chotBangKe,
  chotToanKy,
  getChotKyLuong,
  getLichSuKyLuong,
  moChotBangKe,
  tinhLuongKy,
  type MaBangKe,
} from "./chotKyLuongApi";

export type {
  BangKeApiItem,
  ChotKyLuongApi,
  HoatDongKyLuongApi,
  LoaiHoatDong,
  MaBangKe,
} from "./chotKyLuongApi";

/** Tổng quan màn Chốt kỳ lương — cũng là nguồn cờ "bảng kê đã chốt" cho 8 màn nhập liệu. */
export function useChotKyLuong(periodId: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollPeriodKeys.closing(currentCompanyId, periodId ?? ""),
    queryFn: () => getChotKyLuong(periodId as string),
    enabled: isAuthenticated && !!currentCompanyId && !!periodId,
  });
}

export function useLichSuKyLuong(periodId: string | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollPeriodKeys.activities(currentCompanyId, periodId ?? ""),
    queryFn: () => getLichSuKyLuong(periodId as string),
    enabled: isAuthenticated && !!currentCompanyId && !!periodId,
  });
}

/**
 * Mọi thao tác của màn chỉ đổi thẻ bảng kê + lịch sử của ĐÚNG kỳ đó: không đổi danh sách kỳ, cũng
 * không đổi số liệu tính lương (kỳ còn mở luôn tính trực tiếp; "Tính lương" chỉ lưu bản tạm để đếm
 * "a/b NV"). Làm mới rộng hơn là bắt Bảng lương / Dashboard tính lại lương toàn công ty vô ích.
 * Trả promise để `mutateAsync` về sau khi thẻ đã nạp lại — nút không nhả ra trước khi thẻ đổi.
 */
function useLamMoiChotKy(periodId: string) {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: hrmPayrollPeriodKeys.closing(currentCompanyId, periodId) }),
        qc.invalidateQueries({ queryKey: hrmPayrollPeriodKeys.activities(currentCompanyId, periodId) }),
      ]),
    [qc, currentCompanyId, periodId],
  );
}

export function useChotBangKe(periodId: string) {
  const invalidate = useLamMoiChotKy(periodId);
  return useMutation({
    mutationFn: (module: MaBangKe) => chotBangKe(periodId, module),
    onSuccess: invalidate,
  });
}

export function useMoChotBangKe(periodId: string) {
  const invalidate = useLamMoiChotKy(periodId);
  return useMutation({
    mutationFn: (module: MaBangKe) => moChotBangKe(periodId, module),
    onSuccess: invalidate,
  });
}

export function useChotToanKy(periodId: string) {
  const invalidate = useLamMoiChotKy(periodId);
  return useMutation({
    mutationFn: () => chotToanKy(periodId),
    onSuccess: invalidate,
  });
}

export function useTinhLuongKy(periodId: string) {
  const invalidate = useLamMoiChotKy(periodId);
  return useMutation({
    mutationFn: () => tinhLuongKy(periodId),
    onSuccess: invalidate,
  });
}

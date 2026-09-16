import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/useAuth";
import {
  hrmIncomeCategoryKeys,
  hrmOtherIncomeKeys,
  hrmTaxCalculationKeys,
  hrmToKhaiTncnKeys,
} from "../hrmKeys";
import type {
  CreateIncomeCategoryPayload,
  CreateOtherIncomePayload,
  DanhDauDaNopPayload,
  DinhDangFile,
  IncomeCategoryListParams,
  OtherIncomeListParams,
  PreviewOtherIncomePayload,
  PutOverridesPayload,
  TaxCalculationParams,
  UpdateIncomeCategoryPayload,
  UpdateOtherIncomePayload,
  XoaGhiDeParams,
  XuatToKhaiPayload,
} from "../../types/toKhaiThue";
import {
  chotBangTinhThue,
  danhDauDaNop,
  ghiDeChiTieu,
  layBangTinhThue,
  layDanhSachDanhMuc,
  layDanhSachKhoan,
  layLichSuKyKhai,
  layToKhaiQuy,
  moLaiBangTinhThue,
  suaDanhMuc,
  suaKhoan,
  taiBangChiTietExcel,
  taiLaiFileToKhai,
  taoDanhMuc,
  taoKhoan,
  tinhThuKhoan,
  xoaDanhMuc,
  xoaGhiDeChiTieu,
  xoaKhoan,
  xuatToKhai,
} from "./toKhaiThueApi";

/**
 * Hook TanStack Query cho cụm Tờ khai thuế TNCN.
 *
 * Hai quy ước quan trọng:
 *   1. Lọc, tìm kiếm và phân trang đi Ở MÁY CHỦ — tham số nằm trong khóa truy vấn, không tải hết
 *      rồi `.filter()` ở trình duyệt (BUG-HRM-25).
 *   2. Ghi một khoản thu nhập ngoài lương làm đổi luôn Bảng tính thuế tháng và Tờ khai quý, nên
 *      mọi lệnh ghi đều làm mới cả ba nhóm khóa — xem `useLamMoiTheoKy`.
 */

/* ── 1. Danh mục loại thu nhập ──────────────────────────────────────── */

export function useDanhSachDanhMuc(thamSo: IncomeCategoryListParams = {}) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmIncomeCategoryKeys.list(currentCompanyId, thamSo),
    queryFn: () => layDanhSachDanhMuc(thamSo),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Sửa danh mục KHÔNG hồi tố, nhưng khoản ghi MỚI sẽ theo tham số mới ⇒ làm mới cả khoản và bảng thuế. */
function useLamMoiDanhMuc() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: hrmIncomeCategoryKeys.all }),
        qc.invalidateQueries({ queryKey: hrmOtherIncomeKeys.all }),
      ]),
    [qc],
  );
}

export function useTaoDanhMuc() {
  const lamMoi = useLamMoiDanhMuc();
  return useMutation({
    mutationFn: (payload: CreateIncomeCategoryPayload) => taoDanhMuc(payload),
    onSuccess: lamMoi,
  });
}

export function useSuaDanhMuc() {
  const lamMoi = useLamMoiDanhMuc();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIncomeCategoryPayload }) =>
      suaDanhMuc(id, payload),
    onSuccess: lamMoi,
  });
}

export function useXoaDanhMuc() {
  const lamMoi = useLamMoiDanhMuc();
  return useMutation({
    mutationFn: (id: string) => xoaDanhMuc(id),
    // 404 `E-tkt-016` nghĩa là người khác vừa xóa mất — vẫn phải nạp lại để dòng đó biến khỏi bảng,
    // nếu không kế toán bấm xóa lại rồi lại nhận 404 (cùng lập luận với RVW-740).
    onSettled: lamMoi,
  });
}

/* ── 2. Thu nhập ngoài lương ────────────────────────────────────────── */

export function useDanhSachKhoan(thamSo: OtherIncomeListParams | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmOtherIncomeKeys.list(currentCompanyId, thamSo ?? { periodId: "" }),
    queryFn: () => layDanhSachKhoan(thamSo as OtherIncomeListParams),
    enabled: isAuthenticated && !!currentCompanyId && !!thamSo?.periodId,
  });
}

/**
 * Ghi một khoản đổi ba thứ: danh sách khoản, Bảng tính thuế tháng (tháng chưa chốt tính trực tiếp)
 * và Tờ khai quý chứa tháng đó. Làm mới cả ba, nếu không kế toán thấy số cũ mà tưởng chưa ghi được.
 */
function useLamMoiTheoKy() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: hrmOtherIncomeKeys.all }),
        qc.invalidateQueries({ queryKey: hrmTaxCalculationKeys.all }),
        qc.invalidateQueries({ queryKey: hrmToKhaiTncnKeys.all }),
      ]),
    [qc],
  );
}

/** Tính thử — KHÔNG ghi, nên không làm mới gì. */
export function useTinhThuKhoan() {
  return useMutation({
    mutationFn: (payload: PreviewOtherIncomePayload) => tinhThuKhoan(payload),
  });
}

export function useTaoKhoan() {
  const lamMoi = useLamMoiTheoKy();
  return useMutation({
    mutationFn: (payload: CreateOtherIncomePayload) => taoKhoan(payload),
    onSuccess: lamMoi,
  });
}

export function useSuaKhoan() {
  const lamMoi = useLamMoiTheoKy();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOtherIncomePayload }) =>
      suaKhoan(id, payload),
    onSuccess: lamMoi,
  });
}

export function useXoaKhoan() {
  const lamMoi = useLamMoiTheoKy();
  return useMutation({
    mutationFn: (id: string) => xoaKhoan(id),
    onSettled: lamMoi,
  });
}

/* ── 3. Bảng tính thuế tháng ────────────────────────────────────────── */

export function useBangTinhThue(thamSo: TaxCalculationParams | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmTaxCalculationKeys.sheet(currentCompanyId, thamSo ?? { periodId: "" }),
    queryFn: () => layBangTinhThue(thamSo as TaxCalculationParams),
    enabled: isAuthenticated && !!currentCompanyId && !!thamSo?.periodId,
  });
}

/** Chốt và mở lại đều đổi cờ `periodLocked` của danh sách khoản ⇒ làm mới đủ ba nhóm. */
export function useChotBangTinhThue() {
  const lamMoi = useLamMoiTheoKy();
  return useMutation({
    mutationFn: (periodId: string) => chotBangTinhThue(periodId),
    onSuccess: lamMoi,
  });
}

export function useMoLaiBangTinhThue() {
  const lamMoi = useLamMoiTheoKy();
  return useMutation({
    mutationFn: ({ periodId, lyDo }: { periodId: string; lyDo: string }) =>
      moLaiBangTinhThue(periodId, lyDo),
    onSuccess: lamMoi,
  });
}

/* ── 4. Tờ khai quý ─────────────────────────────────────────────────── */

export function useToKhaiQuy(nam: number | null, quy: number | null) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmToKhaiTncnKeys.detail(currentCompanyId, nam ?? 0, quy ?? 0),
    queryFn: () => layToKhaiQuy(nam as number, quy as number),
    enabled: isAuthenticated && !!currentCompanyId && !!nam && !!quy,
  });
}

export function useLichSuKyKhai(nam?: number) {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmToKhaiTncnKeys.periods(currentCompanyId, nam),
    queryFn: () => layLichSuKyKhai(nam),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Ghi đè, xóa ghi đè, xuất, đánh dấu nộp — đều chỉ đổi dữ liệu của tờ khai. */
function useLamMoiToKhai() {
  const qc = useQueryClient();
  return useCallback(
    () => qc.invalidateQueries({ queryKey: hrmToKhaiTncnKeys.all }),
    [qc],
  );
}

export function useGhiDeChiTieu() {
  const lamMoi = useLamMoiToKhai();
  return useMutation({
    mutationFn: (payload: PutOverridesPayload) => ghiDeChiTieu(payload),
    onSuccess: lamMoi,
  });
}

export function useXoaGhiDeChiTieu() {
  const lamMoi = useLamMoiToKhai();
  return useMutation({
    mutationFn: (thamSo: XoaGhiDeParams) => xoaGhiDeChiTieu(thamSo),
    onSuccess: lamMoi,
  });
}

/**
 * Xuất tờ khai: KHÔNG LÙI LẠI ĐƯỢC (cả 3 tháng của quý khóa vĩnh viễn). Màn gọi phải hỏi lại
 * trước khi bấm. Làm mới cả nhóm bảng tính thuế vì `coTheMoLai` của 3 tháng đổi theo.
 */
export function useXuatToKhai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: XuatToKhaiPayload) => xuatToKhai(payload),
    // `onSettled` chứ KHÔNG phải `onSuccess` (RVW-740): lỗi kết xuất xảy ra SAU khi giao dịch đã
    // commit (hợp đồng Mục 5.5), mất mạng giữa chừng cũng vậy — tờ khai đã sang "đã xuất" và ba
    // tháng đã khóa vĩnh viễn dù lệnh báo lỗi. Không làm mới là màn còn mời xuất lần hai.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: hrmToKhaiTncnKeys.all }),
        qc.invalidateQueries({ queryKey: hrmTaxCalculationKeys.all }),
      ]),
  });
}

/** Tải lại file đã xuất — không đổi trạng thái nên không làm mới gì. */
export function useTaiLaiFileToKhai() {
  return useMutation({
    mutationFn: ({ nam, quy, format }: { nam: number; quy: number; format: DinhDangFile }) =>
      taiLaiFileToKhai(nam, quy, format),
  });
}

export function useTaiBangChiTietExcel() {
  return useMutation({
    mutationFn: ({ nam, quy }: { nam: number; quy: number }) => taiBangChiTietExcel(nam, quy),
  });
}

export function useDanhDauDaNop() {
  const lamMoi = useLamMoiToKhai();
  return useMutation({
    mutationFn: (payload: DanhDauDaNopPayload) => danhDauDaNop(payload),
    // Cùng lý do với `useXuatToKhai`: đọc lại trạng thái thật thay vì tin vào nhánh thành công.
    onSettled: lamMoi,
  });
}

/* ── 5. Chính sách thuế ─────────────────────────────────────────────── */


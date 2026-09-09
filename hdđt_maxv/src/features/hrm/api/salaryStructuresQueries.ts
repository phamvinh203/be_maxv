/**
 * Hook Cấu trúc lương khung chạy trên API THẬT — bản thay thế phần cấu trúc lương của
 * `mock/hooks/setLuong.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock: `useCauTrucLuong` trả thẳng MỘT `CauTrucLuong` (không phải
 * mảng — công ty chỉ có một cấu trúc khung đang áp dụng), `useLuuCauTrucLuong` trả
 * `async (cauTruc) => void`.
 *
 * Máy chủ nhận `salaryItemId` là cả UUID lẫn **mã khoản** (`ma_khoan`) — xem
 * `saveSalaryStructure` ở `salaryStructures.service.ts` (tự dò `idMap`), nên gửi thẳng
 * `ma_khoan` lên mà không cần tra UUID trước.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmSalaryStructureKeys } from "./hrmKeys";
import {
  getCurrentSalaryStructure,
  saveSalaryStructure,
  type CalculationMethodApi,
  type SalaryStructureApi,
} from "./salaryStructuresApi";
import type { CauTrucLuong, PhanLoaiThue, TieuThucTinh } from "../types";

/** Bảy tiêu thức tính của FE ↔ bảy calculationMethod của máy chủ — khớp 1-1. */
const TIEU_THUC_TO_CALC_METHOD: Record<TieuThucTinh, CalculationMethodApi> = {
  co_dinh_thang: "MONTHLY_FIXED",
  theo_ngay_cong: "ACTUAL_WORKDAYS",
  theo_gio_cong: "HOURLY",
  theo_san_luong: "OUTPUT_BASED",
  theo_doanh_so: "REVENUE_PERCENTAGE",
  theo_kpi: "KPI_BASED",
  nhap_tay: "MANUAL_ENTRY",
};

/** Chiều ngược lại — suy từ `TIEU_THUC_TO_CALC_METHOD` để khỏi giữ tay hai bảng cùng một dữ liệu. */
const CALC_METHOD_TO_TIEU_THUC = Object.fromEntries(
  Object.entries(TIEU_THUC_TO_CALC_METHOD).map(([tieuThuc, calc]) => [calc, tieuThuc]),
) as Record<CalculationMethodApi, TieuThucTinh>;

function vePhanLoai(taxTreatment: "TAXABLE" | "EXEMPT"): PhanLoaiThue {
  return taxTreatment === "TAXABLE" ? "tncn" : "mien_thue";
}

function veTaxTreatment(phanLoai: PhanLoaiThue): "TAXABLE" | "EXEMPT" {
  return phanLoai === "tncn" ? "TAXABLE" : "EXEMPT";
}

/** Cấu trúc rỗng — công ty chưa từng lưu cấu trúc lương khung nào. */
const CAU_TRUC_RONG: CauTrucLuong = { tu_ngay: "", den_ngay: "", ghi_chu: "", dong: [] };

/** Adapter BE → FE. */
function veKieuFe(r: SalaryStructureApi | null | undefined): CauTrucLuong {
  if (!r) return CAU_TRUC_RONG;
  return {
    tu_ngay: r.effectiveFrom,
    den_ngay: r.effectiveTo ?? "",
    ghi_chu: r.note ?? "",
    dong: r.items.map((it) => ({
      ma_khoan: it.ma_khoan,
      phan_loai: vePhanLoai(it.taxTreatment),
      tang_ca: it.isOvertimeBase,
      // Tiêu thức lạ (dữ liệu cũ hiếm gặp) vẫn phải render được — rơi về "cố định theo tháng".
      tieu_thuc: CALC_METHOD_TO_TIEU_THUC[it.calculationMethod] ?? "co_dinh_thang",
      so_tien: it.defaultAmount,
    })),
  };
}

function useHienHanhCauTrucLuong() {
  const { currentCompanyId, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: hrmSalaryStructureKeys.current(currentCompanyId),
    queryFn: () => getCurrentSalaryStructure(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

/** Cấu trúc lương đang áp dụng — giữ đúng chữ ký mock (trả thẳng object, không phải mảng). */
export function useCauTrucLuong(): CauTrucLuong {
  const { data } = useHienHanhCauTrucLuong();
  return useMemo(() => veKieuFe(data), [data]);
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: hrmSalaryStructureKeys.all });
  };
}

/** Lưu đè cấu trúc khung hiện hành (tạo mới nếu công ty chưa từng lưu bản nào). */
export function useLuuCauTrucLuong(): (cauTruc: CauTrucLuong) => Promise<void> {
  const lamMoi = useLamMoi();

  const luu = useMutation({
    mutationFn: saveSalaryStructure,
    onSuccess: lamMoi,
  });

  return useCallback(
    async (cauTruc: CauTrucLuong) => {
      if (!cauTruc.tu_ngay) throw new Error("Chưa chọn ngày bắt đầu hiệu lực.");
      if (cauTruc.den_ngay && cauTruc.den_ngay < cauTruc.tu_ngay) {
        throw new Error("Ngày kết thúc hiệu lực phải sau ngày bắt đầu.");
      }
      if (cauTruc.dong.length === 0) {
        throw new Error("Cấu trúc lương phải có ít nhất một khoản.");
      }

      await luu.mutateAsync({
        effectiveFrom: cauTruc.tu_ngay,
        effectiveTo: cauTruc.den_ngay || null,
        note: cauTruc.ghi_chu || null,
        items: cauTruc.dong.map((d) => ({
          salaryItemId: d.ma_khoan,
          taxTreatment: veTaxTreatment(d.phan_loai),
          isOvertimeBase: d.tang_ca,
          calculationMethod: TIEU_THUC_TO_CALC_METHOD[d.tieu_thuc],
          defaultAmount: d.so_tien,
        })),
      });
    },
    [luu],
  );
}

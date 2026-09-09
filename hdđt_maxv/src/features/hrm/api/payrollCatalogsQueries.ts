import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmPayrollCatalogKeys } from "./hrmKeys";
import {
  createDiligenceViolationType,
  createKpiItem,
  createPieceworkProduct,
  createSalaryAdjustmentItem,
  deleteDiligenceViolationType,
  deleteKpiItem,
  deletePieceworkProduct,
  deleteSalaryAdjustmentItem,
  listDiligenceViolationTypes,
  listKpiItems,
  listPieceworkProducts,
  listSalaryAdjustmentItems,
  updateDiligenceViolationType,
  updateKpiItem,
  updatePieceworkProduct,
  updateSalaryAdjustmentItem,
  type DiligenceViolationTypeApi,
  type KpiItemApi,
  type PieceworkProductApi,
  type SalaryAdjustmentItemApi,
} from "./payrollCatalogsApi";
import type {
  ChiTieuKpi,
  ChiTieuKpiFormValues,
  KhoanBuTru,
  KhoanBuTruFormValues,
  LoaiChuyenCan,
  LoaiChuyenCanFormValues,
  SanPham,
  SanPhamFormValues,
} from "../types";

// ==========================================
// 1. KPI Items
// ==========================================
function kpiVeKieuFe(r: KpiItemApi): ChiTieuKpi {
  return {
    ma_kpi: r.code,
    ten_kpi: r.name,
    don_vi: r.unit,
    trong_so_mac_dinh: r.defaultWeight,
    ghi_chu: "",
    status: r.status === "ACTIVE" ? "1" : "0",
  };
}

/** Truy vấn dùng chung cho cả 4 hook bên dưới — tránh khai báo lại cùng 1 `useQuery` bốn lần. */
function useKpiCatalogQuery() {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollCatalogKeys.kpiList(currentCompanyId),
    queryFn: () => listKpiItems({ status: "ALL" }),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

export function useChiTieuKpiList(): ChiTieuKpi[] {
  const { data } = useKpiCatalogQuery();
  return useMemo(() => (data ?? []).map(kpiVeKieuFe), [data]);
}

/**
 * Mã chỉ tiêu (`ma_kpi`) → id thật của máy chủ.
 *
 * Khu "Dữ liệu tính lương" định danh chỉ tiêu bằng **mã** (`ma_kpi`, giữ đúng chữ ký bản mock),
 * nhưng API `POST /payroll-data/kpi/apply` cần **id** (`kpiItemId`, UUID) — dùng map này để đổi
 * ngay trước khi gửi. Cùng `queryKey`/`queryFn` với `useChiTieuKpiList` nên KHÔNG tốn thêm
 * request (React Query gộp chung cache).
 */
export function useChiTieuKpiIdByCode(): Map<string, string> {
  const { data } = useKpiCatalogQuery();
  return useMemo(() => new Map((data ?? []).map((x) => [x.code, x.id])), [data]);
}

export function useLuuChiTieuKpi() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useKpiCatalogQuery();

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.kpiList(currentCompanyId) });

  const createMut = useMutation({ mutationFn: createKpiItem, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateKpiItem>[1] }) =>
      updateKpiItem(id, body),
    onSuccess: invalidate,
  });

  return useCallback(
    async (values: ChiTieuKpiFormValues, maKpi?: string) => {
      const tenKpi = values.ten_kpi.trim();
      if (!tenKpi) throw new Error("Tên chỉ tiêu không được để trống.");
      if (values.trong_so_mac_dinh < 0) throw new Error("Trọng số không được âm.");

      if (maKpi) {
        const item = data?.find((x) => x.code === maKpi);
        if (!item) throw new Error("Chỉ tiêu không còn tồn tại.");
        await updateMut.mutateAsync({
          id: item.id,
          body: {
            name: tenKpi,
            unit: values.don_vi,
            defaultWeight: values.trong_so_mac_dinh,
            status: values.status === "1" ? "ACTIVE" : "INACTIVE",
          },
        });
        return;
      }

      await createMut.mutateAsync({
        name: tenKpi,
        unit: values.don_vi,
        defaultWeight: values.trong_so_mac_dinh,
        status: values.status === "1" ? "ACTIVE" : "INACTIVE",
      });
    },
    [createMut, updateMut, data],
  );
}

export function useXoaChiTieuKpi() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useKpiCatalogQuery();

  const deleteMut = useMutation({
    mutationFn: deleteKpiItem,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.kpiList(currentCompanyId) }),
  });

  return useCallback(
    async (maKpi: string) => {
      const item = data?.find((x) => x.code === maKpi);
      if (!item) throw new Error("Chỉ tiêu không còn tồn tại.");
      await deleteMut.mutateAsync(item.id);
    },
    [deleteMut, data],
  );
}

// ==========================================
// 2. Piecework Products (Sản phẩm)
// ==========================================
function sanPhamVeKieuFe(r: PieceworkProductApi): SanPham {
  return {
    ma_sp: r.code,
    ten_sp: r.name,
    don_vi: r.unit,
    don_gia: r.unitPrice,
    ghi_chu: "",
    status: r.status === "ACTIVE" ? "1" : "0",
  };
}

/** Truy vấn dùng chung cho cả 4 hook bên dưới — tránh khai báo lại cùng 1 `useQuery` bốn lần. */
function useProductCatalogQuery() {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollCatalogKeys.productList(currentCompanyId),
    queryFn: () => listPieceworkProducts({ status: "ALL" }),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

export function useSanPhamList(): SanPham[] {
  const { data } = useProductCatalogQuery();
  return useMemo(() => (data ?? []).map(sanPhamVeKieuFe), [data]);
}

/** Mã sản phẩm (`ma_sp`) → id thật — dùng khi gửi `productId` lên `payroll-data/piecework/apply`. */
export function useSanPhamIdByCode(): Map<string, string> {
  const { data } = useProductCatalogQuery();
  return useMemo(() => new Map((data ?? []).map((x) => [x.code, x.id])), [data]);
}

export function useLuuSanPham() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useProductCatalogQuery();

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.productList(currentCompanyId) });

  const createMut = useMutation({ mutationFn: createPieceworkProduct, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updatePieceworkProduct>[1] }) =>
      updatePieceworkProduct(id, body),
    onSuccess: invalidate,
  });

  return useCallback(
    async (values: SanPhamFormValues, maSp?: string) => {
      const tenSp = values.ten_sp.trim();
      if (!tenSp) throw new Error("Tên sản phẩm không được để trống.");
      if (values.don_gia < 0) throw new Error("Đơn giá không được âm.");

      if (maSp) {
        const item = data?.find((x) => x.code === maSp);
        if (!item) throw new Error("Sản phẩm không còn tồn tại.");
        await updateMut.mutateAsync({
          id: item.id,
          body: {
            name: tenSp,
            unit: values.don_vi,
            unitPrice: values.don_gia,
            status: values.status === "1" ? "ACTIVE" : "INACTIVE",
          },
        });
        return;
      }

      await createMut.mutateAsync({
        name: tenSp,
        unit: values.don_vi,
        unitPrice: values.don_gia,
        status: values.status === "1" ? "ACTIVE" : "INACTIVE",
      });
    },
    [createMut, updateMut, data],
  );
}

export function useXoaSanPham() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useProductCatalogQuery();

  const deleteMut = useMutation({
    mutationFn: deletePieceworkProduct,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.productList(currentCompanyId) }),
  });

  return useCallback(
    async (maSp: string) => {
      const item = data?.find((x) => x.code === maSp);
      if (!item) throw new Error("Sản phẩm không còn tồn tại.");
      await deleteMut.mutateAsync(item.id);
    },
    [deleteMut, data],
  );
}

// ==========================================
// 3. Diligence Types (Loại chuyên cần)
// ==========================================
function chuyenCanVeKieuFe(r: DiligenceViolationTypeApi): LoaiChuyenCan {
  return {
    ma_cc: r.code,
    ten_cc: r.name,
    cach_tru: r.deductionMethod,
    muc_tru: r.penaltyRate,
    ghi_chu: "",
    status: r.status === "ACTIVE" ? "1" : "0",
  };
}

/** Truy vấn dùng chung cho cả 4 hook bên dưới — tránh khai báo lại cùng 1 `useQuery` bốn lần. */
function useDiligenceTypeCatalogQuery() {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollCatalogKeys.diligenceTypeList(currentCompanyId),
    queryFn: () => listDiligenceViolationTypes({ status: "ALL" }),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

export function useLoaiChuyenCanList(): LoaiChuyenCan[] {
  const { data } = useDiligenceTypeCatalogQuery();
  return useMemo(() => (data ?? []).map(chuyenCanVeKieuFe), [data]);
}

/** Mã loại chuyên cần (`ma_cc`) → id thật — dùng khi gửi `violationTypeId` lên `diligence/record`. */
export function useLoaiChuyenCanIdByCode(): Map<string, string> {
  const { data } = useDiligenceTypeCatalogQuery();
  return useMemo(() => new Map((data ?? []).map((x) => [x.code, x.id])), [data]);
}

export function useLuuLoaiChuyenCan() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useDiligenceTypeCatalogQuery();

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.diligenceTypeList(currentCompanyId) });

  const createMut = useMutation({ mutationFn: createDiligenceViolationType, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateDiligenceViolationType>[1] }) =>
      updateDiligenceViolationType(id, body),
    onSuccess: invalidate,
  });

  return useCallback(
    async (values: LoaiChuyenCanFormValues, maCc?: string) => {
      const tenCc = values.ten_cc.trim();
      if (!tenCc) throw new Error("Tên loại chuyên cần không được để trống.");
      if (values.muc_tru < 0) throw new Error("Mức trừ không được âm.");

      if (maCc) {
        const item = data?.find((x) => x.code === maCc);
        if (!item) throw new Error("Loại chuyên cần không còn tồn tại.");
        await updateMut.mutateAsync({
          id: item.id,
          body: {
            name: tenCc,
            deductionMethod: values.cach_tru,
            penaltyRate: values.cach_tru === "mat_toan_bo" ? 0 : values.muc_tru,
            status: values.status === "1" ? "ACTIVE" : "INACTIVE",
          },
        });
        return;
      }

      await createMut.mutateAsync({
        name: tenCc,
        deductionMethod: values.cach_tru,
        penaltyRate: values.cach_tru === "mat_toan_bo" ? 0 : values.muc_tru,
        status: values.status === "1" ? "ACTIVE" : "INACTIVE",
      });
    },
    [createMut, updateMut, data],
  );
}

export function useXoaLoaiChuyenCan() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useDiligenceTypeCatalogQuery();

  const deleteMut = useMutation({
    mutationFn: deleteDiligenceViolationType,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.diligenceTypeList(currentCompanyId) }),
  });

  return useCallback(
    async (maCc: string) => {
      const item = data?.find((x) => x.code === maCc);
      if (!item) throw new Error("Loại chuyên cần không còn tồn tại.");
      await deleteMut.mutateAsync(item.id);
    },
    [deleteMut, data],
  );
}

// ==========================================
// 4. Salary Adjustment Items (Khoản bù trừ)
// ==========================================
function buTruVeKieuFe(r: SalaryAdjustmentItemApi): KhoanBuTru {
  return {
    ma_bt: r.code,
    ten_bt: r.name,
    chieu: r.direction,
    ghi_chu: "",
    status: r.status === "ACTIVE" ? "1" : "0",
  };
}

/** Truy vấn dùng chung cho cả 4 hook bên dưới — tránh khai báo lại cùng 1 `useQuery` bốn lần. */
function useAdjustmentItemCatalogQuery() {
  const { currentCompanyId, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: hrmPayrollCatalogKeys.adjustmentItemList(currentCompanyId),
    queryFn: () => listSalaryAdjustmentItems({ status: "ALL" }),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

export function useKhoanBuTruList(): KhoanBuTru[] {
  const { data } = useAdjustmentItemCatalogQuery();
  return useMemo(() => (data ?? []).map(buTruVeKieuFe), [data]);
}

/** Mã khoản bù trừ (`ma_bt`) → id thật — dùng khi gửi `adjustmentItemId` lên `adjustments/apply`. */
export function useKhoanBuTruIdByCode(): Map<string, string> {
  const { data } = useAdjustmentItemCatalogQuery();
  return useMemo(() => new Map((data ?? []).map((x) => [x.code, x.id])), [data]);
}

export function useLuuKhoanBuTru() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useAdjustmentItemCatalogQuery();

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.adjustmentItemList(currentCompanyId) });

  const createMut = useMutation({ mutationFn: createSalaryAdjustmentItem, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateSalaryAdjustmentItem>[1] }) =>
      updateSalaryAdjustmentItem(id, body),
    onSuccess: invalidate,
  });

  return useCallback(
    async (values: KhoanBuTruFormValues, maBt?: string) => {
      const tenBt = values.ten_bt.trim();
      if (!tenBt) throw new Error("Tên khoản không được để trống.");

      if (maBt) {
        const item = data?.find((x) => x.code === maBt);
        if (!item) throw new Error("Khoản bù trừ không còn tồn tại.");
        await updateMut.mutateAsync({
          id: item.id,
          body: {
            name: tenBt,
            direction: values.chieu,
            status: values.status === "1" ? "ACTIVE" : "INACTIVE",
          },
        });
        return;
      }

      await createMut.mutateAsync({
        name: tenBt,
        direction: values.chieu,
        status: values.status === "1" ? "ACTIVE" : "INACTIVE",
      });
    },
    [createMut, updateMut, data],
  );
}

export function useXoaKhoanBuTru() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  const { data } = useAdjustmentItemCatalogQuery();

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSalaryAdjustmentItem(id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: hrmPayrollCatalogKeys.adjustmentItemList(currentCompanyId) }),
  });

  return useCallback(
    async (maBt: string) => {
      const item = data?.find((x) => x.code === maBt);
      if (!item) throw new Error("Khoản bù trừ không còn tồn tại.");
      await deleteMut.mutateAsync(item.id);
    },
    [deleteMut, data],
  );
}

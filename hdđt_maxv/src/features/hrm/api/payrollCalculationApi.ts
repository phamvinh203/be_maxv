import { api } from "@/lib/apiClient";

const BASE = "/hrm/payroll";

export interface PayrollCalculationLineApi {
  ma_nv: string;
  ho_ten: string;
  ten_pb: string;
  chuc_vu?: string;
  so_npt: number;
  ngay_cong: number;
  gio_tang_ca: number;
  luong_co_dinh: number;
  luong_theo_cong: number;
  phu_cap_khong_thue: number;
  phu_cap_tinh_thue: number;
  luong_san_pham: number;
  luong_kpi: number;
  luong_thuong: number;
  luong_phan_tram: number;
  luong_chuyen_can: number;
  luong_tang_ca: number;
  tong_thu_nhap: number;
  bhxh_cong_doan: number;
  giam_tru_gia_canh: number;
  thu_nhap_tinh_thue: number;
  thue_tncn: number;
  tam_ung_bu_tru: number;
  thuc_linh: number;
}

export interface PayrollCalculationResultApi {
  period: {
    id: string;
    month: number;
    year: number;
    name: string;
    status: string;
  };
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  totalDeduction: number;
  lines: PayrollCalculationLineApi[];
}

export interface PayrollCalculationParams {
  periodId: string;
  ma_pb?: string;
  q?: string;
}

export function calculatePayrollPreview(
  params: PayrollCalculationParams,
): Promise<PayrollCalculationResultApi> {
  return api.get<PayrollCalculationResultApi>(`${BASE}/calculate`, { params });
}

export function getPayrollSheetLines(
  params: PayrollCalculationParams,
): Promise<PayrollCalculationLineApi[]> {
  return api.get<PayrollCalculationLineApi[]>(`${BASE}/sheet-lines`, { params });
}

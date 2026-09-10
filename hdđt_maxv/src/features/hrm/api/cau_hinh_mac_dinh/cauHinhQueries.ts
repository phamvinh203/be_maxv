/**
 * Hook cấu hình mặc định HRM chạy trên API THẬT — bản thay thế `mock/hooks/cauHinh.ts`.
 *
 * Giữ NGUYÊN chữ ký hook bản mock (`useCauHinh` trả `CauHinhMacDinh`, `useLuuCauHinh` trả hàm
 * `async (cauHinh)`) nên component chỉ đổi dòng import. Riêng `useLuuCauHinh` trả THÊM mã cảnh
 * báo của máy chủ — bên gọi cũ bỏ qua giá trị trả về vẫn chạy đúng.
 *
 * HAI CHỖ DỄ NHẦM, đọc trước khi sửa file này:
 *
 * 1. **`Decimal` đọc về là CHUỖI, ghi lên là SỐ** (api-contract 7D.0 (a), ADR-009 QĐ 3). Mọi
 *    `Number()` nằm gọn trong `veKieuFeCauHinh`; đừng để chuỗi rò xuống dưới.
 * 2. **`khoang` chỉ có MỘT nghĩa: ngưỡng trên lũy kế** (BR-hrm-080). Hai hàm quy đổi
 *    cumulative ↔ incremental trước đây **đã bị xóa** — đừng dựng lại dưới tên khác. Bậc mở
 *    là `khoang: null`, KHÔNG phải `0` và KHÔNG phải `999999999999`.
 *
 * PHẠM VI `[cập nhật 2026-09-08 đợt 3]`: đây là nguồn cấu hình **duy nhất** của cả khu HRM —
 * màn Cấu hình mặc định, khu Tăng ca (5 component, cả đường GHI ở `QuanLyTangCaDialog`), bảng
 * lương (`mock/hooks/bangLuong.ts`) và bảng chấm công (`mock/hooks/chamCong.ts`).
 * `mock/hooks/cauHinh.ts` **không còn ai import**; đừng dựng lại đường đọc từ kho giả, vì hai
 * bản trùng tên hàm (`useCauHinh`, `useLuuCauHinh`) nên nhập nhầm là im lặng đi sai nguồn.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { hrmCauHinhKeys } from "../hrmKeys";
import type {
  BacThue,
  CauHinhMacDinh,
  ChinhSachNgay,
  PhuongPhapNgayCong,
} from "../../types";
import {
  getGeneralSettings,
  updateGeneralSettings,
  restoreDefaultSettings,
  type GeneralSettingApiData,
  type TaxBracketApiItem,
  type UpdateGeneralSettingsApiBody,
  type WorkDayMethodApi,
  type DayPolicyApi,
} from "./cauHinhApi";

/** Mã cảnh báo máy chủ trả khi biểu thuế lưu vào khác biểu chuẩn 7 bậc (BR-hrm-083). */
export const CANH_BAO_BIEU_THUE_LECH_CHUAN = "CANH_BAO_BIEU_THUE_LECH_CHUAN";

// ─────────────────────── Bảng ánh xạ enum ───────────────────────

const MAP_PHUONG_PHAP: Record<WorkDayMethodApi, PhuongPhapNgayCong> = {
  FIXED_26: "co_dinh_26",
  FIXED_24: "co_dinh_24",
  ACTUAL_MONTH: "theo_thang",
};
const MAP_PHUONG_PHAP_NGUOC: Record<PhuongPhapNgayCong, WorkDayMethodApi> = {
  co_dinh_26: "FIXED_26",
  co_dinh_24: "FIXED_24",
  theo_thang: "ACTUAL_MONTH",
};

const MAP_CHINH_SACH: Record<DayPolicyApi, ChinhSachNgay> = {
  FULL_DAY: "lam_ca_ngay",
  HALF_DAY: "lam_nua_ngay",
  OFF: "nghi",
};
const MAP_CHINH_SACH_NGUOC: Record<ChinhSachNgay, DayPolicyApi> = {
  lam_ca_ngay: "FULL_DAY",
  lam_nua_ngay: "HALF_DAY",
  nghi: "OFF",
};

// ─────────────────────── Adapter BE → FE ───────────────────────

/** Mốc tương thích ngược của bậc mở ở dữ liệu cũ — đọc về thì quy ngay về `null`. */
const MOC_BAC_MO_CU = 999999999999;

/**
 * Biểu thuế đọc về.
 *
 * KHÔNG quy đổi ngữ nghĩa (`khoang` giữ nguyên nghĩa ngưỡng lũy kế). Chỉ chuẩn hóa **một**
 * thứ: công ty lưu từ trước có thể còn mốc `999999999999` ở bậc cuối; quy về `null` ngay tại
 * biên để phần còn lại của giao diện chỉ phải biết một cách biểu diễn bậc mở. Cửa sổ tương
 * thích này đóng khi `FR-hrm-055` chạy xong (ADR-009 QĐ 1, quy tắc 4).
 */
function veKieuFeBacThue(api: TaxBracketApiItem[]): BacThue[] {
  return api.map((bac) => ({
    khoang:
      bac.khoang === null || bac.khoang >= MOC_BAC_MO_CU ? null : Number(bac.khoang),
    thue_suat: Number(bac.thueSuat),
  }));
}

/** BE trả 20 trường Decimal dạng chuỗi — `Number()` ở đây, đúng một chỗ. */
function veKieuFeCauHinh(r: GeneralSettingApiData): CauHinhMacDinh {
  return {
    phuong_phap_ngay_cong: MAP_PHUONG_PHAP[r.standardWorkingDaysMethod],
    chinh_sach_thu_7: MAP_CHINH_SACH[r.saturdayPolicy],
    chinh_sach_chu_nhat: MAP_CHINH_SACH[r.sundayPolicy],

    gio_cong_chuan_ngay: Number(r.standardHoursPerDay),

    // Hai trường Int — BE trả số thật, `Number()` ở đây chỉ để không phải nhớ trường nào là loại nào.
    ngay_phep_co_ban: Number(r.baseAnnualLeaveDays),
    nam_tham_nien_them_phep: Number(r.seniorityYearsForExtraDay),

    tc_ngay_thuong_ngay: Number(r.otRateWeekdayDay),
    tc_ngay_thuong_dem: Number(r.otRateWeekdayNight),
    tc_chu_nhat_ngay: Number(r.otRateWeekendDay),
    tc_chu_nhat_dem: Number(r.otRateWeekendNight),
    tc_ngay_le_ngay: Number(r.otRateHolidayDay),
    tc_ngay_le_dem: Number(r.otRateHolidayNight),

    gioi_han_tc_thang: Number(r.maxOtHoursPerMonth),
    nguong_canh_bao_tc_nam: Number(r.warningOtHoursPerYear),
    nguong_vuot_muc_tc_nam: Number(r.maxOtHoursPerYear),

    luong_co_so: Number(r.baseSalary),
    luong_toi_thieu_vung: Number(r.regionMinSalary),

    bhxh_nv: Number(r.insuranceEmployeeSocial),
    bhyt_nv: Number(r.insuranceEmployeeHealth),
    bhtn_nv: Number(r.insuranceEmployeeUnemployment),
    bhxh_ct: Number(r.insuranceCompanySocial),
    bhyt_ct: Number(r.insuranceCompanyHealth),
    bhtn_ct: Number(r.insuranceCompanyUnemployment),

    doan_phi_nv: Number(r.unionFeeEmployeeRate),
    tran_co_so_doan_phi: Number(r.unionFeeMaxAmount),
    kinh_phi_cong_doan_ct: Number(r.unionFeeCompanyRate),

    giam_tru_ban_than: Number(r.personalDeduction),
    giam_tru_npt: Number(r.dependentDeduction),

    bac_thue: veKieuFeBacThue(r.taxBrackets ?? []),
  };
}

// ─────────────────────── Adapter FE → BE ───────────────────────

/**
 * Chiều ghi: **số**, không phải chuỗi.
 *
 * Biểu thuế đi thẳng, chỉ đổi tên trường (`thue_suat` → `thueSuat`) và ép bậc cuối về `null`
 * — giao diện đã khóa ô ngưỡng của dòng cuối, dòng này là lớp chặn cuối cùng phòng khi dữ
 * liệu cũ nạp lên còn mốc số (`E-hrm-082` sẽ từ chối cả lượt nếu lọt).
 */
function veKieuBeBacThue(fe: BacThue[]): TaxBracketApiItem[] {
  return fe.map((bac, i) => ({
    khoang: i === fe.length - 1 ? null : bac.khoang,
    thueSuat: bac.thue_suat,
  }));
}

function veKieuBe(fe: CauHinhMacDinh): UpdateGeneralSettingsApiBody {
  return {
    standardWorkingDaysMethod: MAP_PHUONG_PHAP_NGUOC[fe.phuong_phap_ngay_cong],
    saturdayPolicy: MAP_CHINH_SACH_NGUOC[fe.chinh_sach_thu_7],
    sundayPolicy: MAP_CHINH_SACH_NGUOC[fe.chinh_sach_chu_nhat],
    standardHoursPerDay: fe.gio_cong_chuan_ngay,
    baseAnnualLeaveDays: fe.ngay_phep_co_ban,
    seniorityYearsForExtraDay: fe.nam_tham_nien_them_phep,
    otRateWeekdayDay: fe.tc_ngay_thuong_ngay,
    otRateWeekdayNight: fe.tc_ngay_thuong_dem,
    otRateWeekendDay: fe.tc_chu_nhat_ngay,
    otRateWeekendNight: fe.tc_chu_nhat_dem,
    otRateHolidayDay: fe.tc_ngay_le_ngay,
    otRateHolidayNight: fe.tc_ngay_le_dem,
    maxOtHoursPerMonth: fe.gioi_han_tc_thang,
    warningOtHoursPerYear: fe.nguong_canh_bao_tc_nam,
    maxOtHoursPerYear: fe.nguong_vuot_muc_tc_nam,
    baseSalary: fe.luong_co_so,
    regionMinSalary: fe.luong_toi_thieu_vung,
    insuranceEmployeeSocial: fe.bhxh_nv,
    insuranceEmployeeHealth: fe.bhyt_nv,
    insuranceEmployeeUnemployment: fe.bhtn_nv,
    insuranceCompanySocial: fe.bhxh_ct,
    insuranceCompanyHealth: fe.bhyt_ct,
    insuranceCompanyUnemployment: fe.bhtn_ct,
    unionFeeEmployeeRate: fe.doan_phi_nv,
    unionFeeMaxAmount: fe.tran_co_so_doan_phi,
    unionFeeCompanyRate: fe.kinh_phi_cong_doan_ct,
    personalDeduction: fe.giam_tru_ban_than,
    dependentDeduction: fe.giam_tru_npt,
    taxBrackets: veKieuBeBacThue(fe.bac_thue),
  };
}

// ─────────────────────── Giá trị mặc định ───────────────────────

/**
 * Bộ giá trị chuẩn pháp luật Việt Nam — dùng làm khung tạm trong lúc chờ `GET` trả về.
 *
 * Biểu thuế là **7 bậc** theo Điều 22 Luật Thuế TNCN (`BR-hrm-081`), trần 35%, bậc cuối là bậc
 * mở. Bản 5 bậc dừng ở 25% trước đây là biểu chuẩn **bị cắt cụt ba bậc trên**, khấu trừ thiếu
 * với mọi người có thu nhập tính thuế trên 52tr/tháng — không tương ứng với bất kỳ biểu thuế
 * nào của pháp luật.
 *
 * ⚠️ Đây KHÔNG phải nút "Khôi phục mặc định": khôi phục là thao tác **ghi**, phải gọi
 * `useKhoiPhucCauHinh` để máy chủ nạp bộ chuẩn của chính nó rồi ghi nhật ký.
 */
export function cauHinhMacDinhGoc(): CauHinhMacDinh {
  return {
    phuong_phap_ngay_cong: "co_dinh_26",
    chinh_sach_thu_7: "lam_nua_ngay",
    chinh_sach_chu_nhat: "nghi",
    gio_cong_chuan_ngay: 8,
    ngay_phep_co_ban: 12,
    nam_tham_nien_them_phep: 5,
    tc_ngay_thuong_ngay: 150,
    tc_ngay_thuong_dem: 200,
    tc_chu_nhat_ngay: 200,
    tc_chu_nhat_dem: 270,
    tc_ngay_le_ngay: 300,
    tc_ngay_le_dem: 390,
    gioi_han_tc_thang: 40,
    nguong_canh_bao_tc_nam: 200,
    nguong_vuot_muc_tc_nam: 300,
    luong_co_so: 2340000,
    luong_toi_thieu_vung: 4960000,
    bhxh_nv: 8,
    bhyt_nv: 1.5,
    bhtn_nv: 1,
    bhxh_ct: 17.5,
    bhyt_ct: 3,
    bhtn_ct: 1,
    doan_phi_nv: 1,
    tran_co_so_doan_phi: 234000,
    kinh_phi_cong_doan_ct: 2,
    giam_tru_ban_than: 11000000,
    giam_tru_npt: 4400000,
    bac_thue: [
      { khoang: 5000000, thue_suat: 5 },
      { khoang: 10000000, thue_suat: 10 },
      { khoang: 18000000, thue_suat: 15 },
      { khoang: 32000000, thue_suat: 20 },
      { khoang: 52000000, thue_suat: 25 },
      { khoang: 80000000, thue_suat: 30 },
      { khoang: null, thue_suat: 35 },
    ],
  };
}

// ─────────────────────── Internal query ───────────────────────

function useCauHinhQuery() {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    // Khóa gắn `currentCompanyId`: đổi công ty là bộ tham số tính lương khác hẳn, không được
    // để dữ liệu công ty trước hiện dưới tên công ty mới.
    queryKey: hrmCauHinhKeys.detail(currentCompanyId),
    queryFn: () => getGeneralSettings(),
    enabled: isAuthenticated && !!currentCompanyId,
  });
}

// ─────────────────────── Exported hooks ───────────────────────

/**
 * Cấu hình mặc định hiện tại.
 *
 * Chưa tải xong thì trả bộ chuẩn để form có khung hiện lên thay vì nhấp nháy rỗng — nhưng
 * `dangTai` phải được dùng để **khóa nút Lưu**, nếu không người dùng có thể ghi đè cấu hình
 * thật bằng bộ chuẩn mà không hề sửa gì.
 */
export function useCauHinh(): CauHinhMacDinh {
  const { data } = useCauHinhQuery();
  return useMemo(
    () => (data ? veKieuFeCauHinh(data) : cauHinhMacDinhGoc()),
    [data],
  );
}

/** Trạng thái tải/lỗi của cấu hình — tách riêng để `useCauHinh` giữ đúng chữ ký bản mock. */
export function useTrangThaiCauHinh(): {
  dangTai: boolean;
  loi: boolean;
  daCoDuLieu: boolean;
} {
  const { isLoading, isError, data } = useCauHinhQuery();
  return { dangTai: isLoading, loi: isError, daCoDuLieu: Boolean(data) };
}

/**
 * Lưu cấu hình. Trả mã cảnh báo của máy chủ (`CANH_BAO_BIEU_THUE_LECH_CHUAN`) hoặc `undefined`.
 *
 * Ba phép kiểm trước khi gửi giữ nguyên từ bản mock, cộng một phép kiểm ngưỡng tăng dần. Đây
 * là ngoại lệ có chủ ý của luật "không nhân đôi luật nghiệp vụ": lỗi 400 của máy chủ cho nhóm
 * biểu thuế **không có trường `message`**, chỉ có `errors.fieldErrors`, nên người dùng gõ sai
 * biểu thuế mà không chặn ở đây sẽ chỉ nhận một câu chung chung không nói được sai chỗ nào
 * (api-contract Mục 1.2). Máy chủ vẫn là nơi chốt (`E-hrm-069/080/081/082`).
 */
export function useLuuCauHinh() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (cauHinh: CauHinhMacDinh) =>
      updateGeneralSettings(veKieuBe(cauHinh)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrmCauHinhKeys.all });
    },
  });

  return useCallback(
    async (cauHinh: CauHinhMacDinh): Promise<string | undefined> => {
      /*
       * Ngưỡng dưới là **1.0**, không phải "lớn hơn 0": máy chủ chặn `< 1.0` (`E-hrm-067`,
       * BR-hrm-071, `generalSettings.validator.ts:164-172`). Bản cũ chặn `<= 0` nên `0.5` lọt
       * qua đây rồi ăn 400 với thông điệp Zod tiếng Anh — phép kiểm lỏng hơn máy chủ chỉ tạo
       * cảm giác đã kiểm chứ không đỡ được gì.
       */
      if (cauHinh.gio_cong_chuan_ngay < 1 || cauHinh.gio_cong_chuan_ngay > 24) {
        throw new Error("Giờ công chuẩn/ngày phải nằm trong khoảng 1–24 giờ.");
      }
      if (cauHinh.luong_toi_thieu_vung <= 0) {
        throw new Error("Lương tối thiểu vùng phải lớn hơn 0.");
      }

      const bac = cauHinh.bac_thue;
      if (bac.length < 2) {
        throw new Error("Biểu thuế lũy tiến phải có ít nhất 2 bậc.");
      }
      for (let i = 0; i < bac.length; i += 1) {
        const hienTai = bac[i];
        const truoc = i > 0 ? bac[i - 1] : undefined;
        if (!hienTai) continue;

        // Bậc cuối là bậc mở nên không có ngưỡng để so; các bậc còn lại phải dương và tăng
        // NGHIÊM NGẶT — ngưỡng đi lùi làm biểu vô nghĩa mà thuế suất vẫn tăng đều nên lọt.
        if (i < bac.length - 1) {
          if (hienTai.khoang === null || hienTai.khoang <= 0) {
            throw new Error(
              `Ngưỡng thu nhập của bậc ${i + 1} phải là số lớn hơn 0.`,
            );
          }
          if (truoc?.khoang != null && hienTai.khoang <= truoc.khoang) {
            throw new Error(
              `Ngưỡng thu nhập bậc ${i + 1} phải cao hơn bậc ${i}.`,
            );
          }
        }
        if (truoc && hienTai.thue_suat <= truoc.thue_suat) {
          throw new Error(`Thuế suất bậc ${i + 1} phải cao hơn bậc ${i}.`);
        }
      }

      const ketQua = await mutation.mutateAsync(cauHinh);
      return ketQua.warning;
    },
    [mutation],
  );
}

/**
 * Khôi phục bộ chuẩn pháp luật VN — **thao tác ghi, không hoàn tác được**, ghi đè cả biểu thuế
 * công ty tự đặt. Bên gọi bắt buộc hỏi xác nhận trước (FR-hrm-047).
 *
 * Cố ý gọi máy chủ chứ không nạp `cauHinhMacDinhGoc()` vào form: bộ chuẩn thật thuộc về máy
 * chủ, và chỉ đường này mới sinh được nhật ký kiểm toán.
 */
export function useKhoiPhucCauHinh() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => restoreDefaultSettings(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrmCauHinhKeys.all });
    },
  });

  return useCallback(async () => {
    await mutation.mutateAsync();
  }, [mutation]);
}

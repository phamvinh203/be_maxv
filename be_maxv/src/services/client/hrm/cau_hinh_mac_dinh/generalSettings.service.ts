import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { HRM_CANH_BAO } from '../../../../constants/hrm/hrmCanhBao';
import {
  chuanHoaBacMo,
  MOC_TUONG_THICH_BAC_MO,
  type TaxBracketItem,
  type UpdateGeneralSettingsInput,
} from '../../../../validators/hrm/cau_hinh_mac_dinh/generalSettings.validator';

export const SINGLETON_ID = 'DEFAULT';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * BIỂU THUẾ TNCN LŨY TIẾN TỪNG PHẦN — BIỂU CHUẨN 5 BẬC (BR-hrm-081).
 *
 * ĐÂY LÀ NƠI ĐỊNH NGHĨA DUY NHẤT của biểu chuẩn trong toàn bộ mã máy chủ. Bốn đường tiêu thụ nó —
 * tự khởi tạo (self-healing ở `GET`), khôi phục mặc định, nền của cập nhật một phần, và bộ tính
 * thuế của Bảng lương tổng hợp (`tinhThueLuyTien`) — đều đọc từ đây; thao tác chuẩn hóa
 * `FR-hrm-055` (`scripts/chuan-hoa-bieu-thue.ts`) cũng vậy. TUYỆT ĐỐI KHÔNG chép lại bộ số này.
 *
 * Căn cứ: Luật Thuế TNCN số 109/2025/QH15 (sửa đổi bởi Luật số 09/2026/QH16) và Nghị định
 * 253/2026/NĐ-CP, **hiệu lực từ kỳ tính thuế 2026**. Áp cho **thu nhập tính thuế theo tháng**;
 * `khoang` là **ngưỡng trên lũy kế** (BR-hrm-080).
 *
 * | Bậc | Thu nhập tính thuế/tháng | `khoang`    | Thuế suất |
 * |----:|--------------------------|------------:|----------:|
 * |   1 | Đến 10 triệu             |  10.000.000 |        5% |
 * |   2 | Trên 10 đến 30 triệu     |  30.000.000 |       10% |
 * |   3 | Trên 30 đến 60 triệu     |  60.000.000 |       20% |
 * |   4 | Trên 60 đến 100 triệu    | 100.000.000 |       30% |
 * |   5 | Trên 100 triệu           | `null`      |       35% |
 *
 * ⚠️ Hai biểu LỖI THỜI có thể còn nằm trong DB của tenant cũ, cấm dùng lại làm mặc định:
 * `BIEU_THUE_7_BAC_CU` (Điều 22 Luật 04/2007/QH12 — đúng luật CŨ, đã bị thay thế) và
 * `BIEU_THUE_5_BAC_CU` (biểu cắt cụt ở 25% — chưa bao giờ đúng luật nào). Cả hai được
 * `FR-hrm-055` nhận diện để chuẩn hóa về biểu này.
 */
export const BIEU_THUE_CHUAN_5_BAC: TaxBracketItem[] = [
  { khoang: 10000000, thueSuat: 5 },
  { khoang: 30000000, thueSuat: 10 },
  { khoang: 60000000, thueSuat: 20 },
  { khoang: 100000000, thueSuat: 30 },
  { khoang: null, thueSuat: 35 },
];

/**
 * BIỂU 7 BẬC CŨ — chỉ để **NHẬN DIỆN** dữ liệu tenant còn giữ biểu theo luật đã hết hiệu lực.
 *
 * Đây từng là biểu chuẩn (Điều 22 Luật Thuế TNCN số 04/2007/QH12 sửa đổi bởi Luật 26/2012/QH13)
 * cho tới khi Luật 109/2025/QH15 thay thế từ kỳ tính thuế 2026. Khác `BIEU_THUE_5_BAC_CU` ở chỗ
 * bộ số này **đã từng đúng luật** — không phải lỗi mã — nhưng nay khấu trừ SAI với mọi mức thu
 * nhập, nên vẫn phải chuẩn hóa. KHÔNG dùng làm giá trị khởi tạo hay khôi phục ở bất cứ đâu.
 */
export const BIEU_THUE_7_BAC_CU: TaxBracketItem[] = [
  { khoang: 5000000, thueSuat: 5 },
  { khoang: 10000000, thueSuat: 10 },
  { khoang: 18000000, thueSuat: 15 },
  { khoang: 32000000, thueSuat: 20 },
  { khoang: 52000000, thueSuat: 25 },
  { khoang: 80000000, thueSuat: 30 },
  { khoang: null, thueSuat: 35 },
];

/**
 * BIỂU 5 BẬC CẮT CỤT CŨ — chỉ để **NHẬN DIỆN** dữ liệu hệ thống đã tự nạp sai trước 2026-09-08.
 *
 * KHÔNG được dùng làm giá trị khởi tạo hay khôi phục ở bất cứ đâu. Tồn tại đúng một mục đích:
 * thao tác chuẩn hóa `FR-hrm-055` chỉ được ghi đè khi biểu đang lưu **trùng khớp nguyên văn**
 * bộ này — đó là ranh giới duy nhất phân biệt *lỗi của hệ thống* với *lựa chọn của người dùng*.
 *
 * Bậc cuối ghi bằng mốc `999999999999` đúng như bản cũ đã ghi xuống DB, KHÔNG phải `null`: đây là
 * mẫu để so khớp dữ liệu lịch sử, không phải một biểu hợp lệ theo ADR-009.
 */
export const BIEU_THUE_5_BAC_CU: TaxBracketItem[] = [
  { khoang: 5000000, thueSuat: 5 },
  { khoang: 10000000, thueSuat: 10 },
  { khoang: 18000000, thueSuat: 15 },
  { khoang: 32000000, thueSuat: 20 },
  { khoang: 999999999999, thueSuat: 25 },
];

/**
 * So khớp NGUYÊN VĂN hai biểu thuế: cùng số bậc và từng cặp (`khoang`, `thueSuat`) bằng nhau.
 * Dùng cho cả cảnh báo lệch chuẩn (BR-hrm-083) lẫn phép nhận diện của `FR-hrm-055`.
 *
 * Nhận `unknown` vì đầu vào thường là cột `Json` đọc từ Prisma — kiểu ở đó là `JsonValue`, không
 * có gì bảo đảm hình dạng. Bất kỳ thứ gì không đúng hình dạng đều coi là KHÔNG trùng khớp.
 */
export function laBieuThueTrungKhop(
  bieu: unknown,
  mau: TaxBracketItem[],
): boolean {
  if (!Array.isArray(bieu) || bieu.length !== mau.length) return false;
  return bieu.every((bac, i) => {
    if (typeof bac !== 'object' || bac === null) return false;
    const { khoang, thueSuat } = bac as { khoang?: unknown; thueSuat?: unknown };
    const khoangMau = mau[i].khoang;
    const khoangKhop =
      khoangMau === null ? khoang === null : khoang === khoangMau;
    return khoangKhop && thueSuat === mau[i].thueSuat;
  });
}

/**
 * Bộ giá trị cấu hình mặc định chuẩn theo quy định hiện hành của pháp luật Việt Nam:
 * - BLLĐ 2019: Giờ công chuẩn 8h/ngày, 26 ngày/tháng, phép năm 12 ngày, OT 150%/200%/300%
 * - Nghị định 73/2024/NĐ-CP: Lương cơ sở 2.340.000đ (từ 01/07/2024)
 * - Nghị định 74/2024/NĐ-CP: Sàn lương tối thiểu Vùng 1 là 4.960.000đ (từ 01/07/2024)
 * - Nghị quyết 110/2025/UBTVQH15: Giảm trừ gia cảnh bản thân 15.500.000đ, người phụ thuộc
 *   6.200.000đ (hiệu lực từ kỳ tính thuế 2026 — thay Nghị quyết 954/2020/UBTVQH14)
 * - Luật BHXH: NLĐ 10.5% (8% BHXH + 1.5% BHYT + 1% BHTN), DN 21.5% (17.5% BHXH + 3% BHYT + 1% BHTN)
 * - Luật Công đoàn: Đoàn phí NLĐ 1%, trần 10% lương cơ sở (234.000đ), DN đóng 2%
 * - Luật Thuế TNCN số 109/2025/QH15: **biểu thuế lũy tiến từng phần 5 bậc**, trần 35% — xem
 *   `BIEU_THUE_CHUAN_5_BAC` (BR-hrm-081). Số bậc là DỮ LIỆU, không phải hằng số: đừng viết mã
 *   nào giả định biểu luôn có đúng ngần này bậc.
 */
export function khoiTaoCauHinhMacDinh() {
  return {
    standardWorkingDaysMethod: 'FIXED_26' as const,
    saturdayPolicy: 'HALF_DAY' as const,
    sundayPolicy: 'OFF' as const,
    standardHoursPerDay: 8.0,
    baseAnnualLeaveDays: 12,
    seniorityYearsForExtraDay: 5,
    otRateWeekdayDay: 150.0,
    otRateWeekdayNight: 200.0,
    otRateWeekendDay: 200.0,
    otRateWeekendNight: 270.0,
    otRateHolidayDay: 300.0,
    otRateHolidayNight: 390.0,
    maxOtHoursPerMonth: 40,
    warningOtHoursPerYear: 200,
    maxOtHoursPerYear: 300,
    baseSalary: 2340000,
    regionMinSalary: 4960000,
    insuranceEmployeeSocial: 8.0,
    insuranceEmployeeHealth: 1.5,
    insuranceEmployeeUnemployment: 1.0,
    insuranceCompanySocial: 17.5,
    insuranceCompanyHealth: 3.0,
    insuranceCompanyUnemployment: 1.0,
    unionFeeEmployeeRate: 1.0,
    unionFeeMaxAmount: 234000,
    unionFeeCompanyRate: 2.0,
    personalDeduction: 15500000,
    dependentDeduction: 6200000,
    // Sao chép nông từng phần tử: đối tượng ở `BIEU_THUE_CHUAN_5_BAC` là hằng dùng chung, đừng
    // để một nơi gọi lỡ tay sửa tại chỗ rồi mọi nơi khác lãnh đủ.
    taxBrackets: BIEU_THUE_CHUAN_5_BAC.map((b) => ({ ...b })),
    // ADR-010 QĐ-2 (2026-09-10) — Bảng lương tổng hợp: 3 tham số thuế/miễn thuế mới của
    // BR-dltl-026/027. Khác hệ số trần bảo hiểm (`× 20`, xem `constants/hrm/du_lieu_tinh_luong/
    // insuranceCaps.ts`) — đây là SỐ TIỀN/THUẾ SUẤT nên là cột cấu hình, không phải hằng số.
    // Hai ngưỡng dưới ĐÃ ĐỔI 2026-09-14 theo NĐ 253/2026/NĐ-CP (BUG-dltl-004): trần ăn ca
    // 730.000 → 1.200.000, ngưỡng khấu trừ 10% 2.000.000 → 5.000.000/lần chi trả.
    lunchAllowanceTaxFreeCap: 1200000, // NĐ 253/2026/NĐ-CP (thay TT 26/2016/TT-BLĐTBXH)
    withholdingTaxRate: 10.0, // NĐ 253/2026/NĐ-CP Điều 50 (giữ nguyên 10%)
    withholdingTaxThreshold: 5000000, // NĐ 253/2026/NĐ-CP Điều 50 khoản 2, hiệu lực 01/07/2026
  };
}

/** Bộ mặc định ở dạng Prisma nhận được cho cột `Json`. */
function duLieuMacDinhChoPrisma() {
  const defaultData = khoiTaoCauHinhMacDinh();
  return {
    ...defaultData,
    taxBrackets: defaultData.taxBrackets as unknown as Prisma.InputJsonValue,
  };
}

/**
 * CHUẨN HÓA BẬC MỞ TRÊN ĐƯỜNG ĐỌC — `api-contract.md` Mục 7D.0(b): **chiều đọc LUÔN trả `null`**
 * cho bậc cuối, không bao giờ trả mốc tương thích `999999999999`.
 *
 * Trước đây chỉ chiều GHI chuẩn hóa (`chuanHoaBacMo` gọi trong validator), còn ba đường đọc
 * (`getSettings` / `updateSettings` / `restoreDefault`) trả thẳng bản ghi Prisma. Hệ quả: tenant
 * có dữ liệu cũ ghi mốc số sẽ **mãi trả mốc số** chừng nào chưa ai bấm Lưu. Giao diện không vỡ vì
 * nó tự quy về `null`, nhưng đó là client vá lỗi server — mọi bên tiêu thụ khác (bộ tính lương,
 * báo cáo) sẽ thấy một con số 999 tỷ và coi đó là ngưỡng thật.
 *
 * Chỉ chuẩn hóa **hình dạng trả ra**, KHÔNG ghi lại xuống DB: việc ghi đè dữ liệu là chuyện của
 * thao tác chuẩn hóa `FR-hrm-055` (`scripts/chuan-hoa-bieu-thue.ts`), không phải của một lời gọi
 * `GET`. Dữ liệu cột `Json` không có gì bảo đảm hình dạng nên hễ không đúng dạng thì trả nguyên
 * trạng, không ném lỗi — người dùng đang MỞ MÀN HÌNH.
 */
function chuanHoaBieuThueKhiDoc<T extends { taxBrackets: unknown }>(banGhi: T): T {
  const bieu = banGhi.taxBrackets;
  if (!Array.isArray(bieu) || bieu.length === 0) return banGhi;

  const dungDang = bieu.every(
    (bac) =>
      typeof bac === 'object' &&
      bac !== null &&
      (typeof (bac as TaxBracketItem).khoang === 'number' ||
        (bac as TaxBracketItem).khoang === null) &&
      typeof (bac as TaxBracketItem).thueSuat === 'number',
  );
  if (!dungDang) return banGhi;

  const cuoi = bieu[bieu.length - 1] as TaxBracketItem;
  if (cuoi.khoang === null || cuoi.khoang < MOC_TUONG_THICH_BAC_MO) return banGhi;

  return { ...banGhi, taxBrackets: chuanHoaBacMo(bieu as TaxBracketItem[]) };
}

/**
 * Lấy cấu hình mặc định (Self-healing pattern):
 * Nếu tenant DB mới chưa có bản ghi id = "DEFAULT", tự khởi tạo bộ giá trị chuẩn luật VN.
 *
 * Dùng `upsert` chứ không `create` cho nhánh tự chữa: hai lời gọi `GET` đồng thời trên một tenant
 * trắng đều thấy `findUnique` trả rỗng, cùng lao vào ghi, và với `create` thì người thứ hai vỡ
 * khóa chính rồi nhận 409 — trong khi họ chỉ đang MỞ MÀN HÌNH, không hề ghi gì (`BE-06`).
 * `update: {}` giữ nguyên bản ghi người kia vừa tạo và trả về chính nó.
 */
export async function getSettings(db: Db) {
  const settings = await db.generalSetting.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (settings) return chuanHoaBieuThueKhiDoc(settings);

  return chuanHoaBieuThueKhiDoc(
    await db.generalSetting.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID, ...duLieuMacDinhChoPrisma() },
    }),
  );
}

/** Bản ghi cấu hình kèm cảnh báo tùy chọn — `warning` VẮNG MẶT khi không có gì để cảnh báo. */
export type KetQuaCauHinh<T> = T & { warning?: string };

/**
 * Cập nhật cấu hình mặc định (partial update / batch update).
 *
 * Cảnh báo lệch chuẩn (`BR-hrm-083`, `BE-11`): khi payload CÓ gửi `taxBrackets` và biểu lưu vào
 * khác `BIEU_THUE_CHUAN_5_BAC` — khác số bậc hoặc khác bất kỳ cặp ngưỡng–thuế suất nào — phản hồi
 * kèm `warning: "CANH_BAO_BIEU_THUE_LECH_CHUAN"`. Không gửi `taxBrackets`, hoặc gửi đúng biểu
 * chuẩn, thì BỎ HẲN trường. Cảnh báo là thông tin: không đổi mã HTTP, không chặn lưu.
 *
 * Biểu đi tới đây đã qua bốn điều kiện toàn vẹn của `BR-hrm-082` và đã được chuẩn hóa bậc mở về
 * `null` ở tầng validator — service KHÔNG kiểm lại và KHÔNG chuẩn hóa lần hai.
 */
export async function updateSettings(
  db: Db,
  payload: UpdateGeneralSettingsInput,
): Promise<KetQuaCauHinh<Awaited<ReturnType<typeof getSettings>>>> {
  const macDinh = duLieuMacDinhChoPrisma();

  const updateData: Prisma.GeneralSettingUpdateInput = {
    ...payload,
    taxBrackets:
      payload.taxBrackets !== undefined
        ? (payload.taxBrackets as unknown as Prisma.InputJsonValue)
        : undefined,
  };

  const createData: Prisma.GeneralSettingCreateInput = {
    id: SINGLETON_ID,
    ...macDinh,
    ...payload,
    taxBrackets: (payload.taxBrackets ??
      macDinh.taxBrackets) as unknown as Prisma.InputJsonValue,
  };

  const banGhi = chuanHoaBieuThueKhiDoc(
    await db.generalSetting.upsert({
      where: { id: SINGLETON_ID },
      update: updateData,
      create: createData,
    }),
  );

  if (
    payload.taxBrackets !== undefined &&
    !laBieuThueTrungKhop(payload.taxBrackets, BIEU_THUE_CHUAN_5_BAC)
  ) {
    return { ...banGhi, warning: HRM_CANH_BAO.BIEU_THUE_LECH_CHUAN };
  }
  return banGhi;
}

/**
 * Khôi phục cấu hình mặc định chuẩn theo luật Việt Nam.
 * KHÔNG bao giờ kèm `warning`: khôi phục luôn cho ra đúng biểu chuẩn nên không có gì lệch.
 */
export async function restoreDefault(db: Db) {
  const macDinh = duLieuMacDinhChoPrisma();

  return chuanHoaBieuThueKhiDoc(
    await db.generalSetting.upsert({
      where: { id: SINGLETON_ID },
      update: macDinh,
      create: { id: SINGLETON_ID, ...macDinh },
    }),
  );
}

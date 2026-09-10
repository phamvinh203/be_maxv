import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../generated/tenant';
import {
  calculatePayrollPreview,
  getSupportAllowanceBreakdown,
  laHopDongKhauTruTaiNguon,
  laKhoanMienThue,
  tinhKhoanPhuCapTheoKy,
  tinhThueLuyTien,
} from '../../services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service';

/**
 * KIỂM THỬ ENGINE THUẦN (không qua HTTP) cho pipeline 10 bước của Bảng lương tổng hợp
 * (`ADR-010-pipeline-thue-bao-hiem-bang-luong.md`). Bám số liệu chính xác theo
 * `docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md` (53 ca, TC-blth-001..050).
 *
 * ⚠️ NGOẠI LỆ có chủ đích với 2 ca của Nhóm 6 (TC-blth-032/033): xem chú thích tại chỗ — test
 * matrix quên quy đổi công cho TRẦN miễn thuế, mâu thuẫn với chính SRS 15.3.1 (AC-dltl-23) và
 * ADR-010 bước [5c] (cả hai đều nói cap PHẢI quy đổi công cùng tỷ lệ). Bám ADR-010/SRS làm chuẩn
 * theo đúng chỉ đạo — KHÔNG lặp lại số sai của bảng test-matrix cũ.
 *
 * `calculatePayrollPreview(db, periodId, preloadedPeriod)` nhận `preloadedPeriod` trực tiếp nên
 * KHÔNG cần mock `payrollPeriod.findUnique` cho phần lớn test — chỉ `getSupportAllowanceBreakdown`
 * (không nhận preloadedPeriod) mới cần.
 */

const PERIOD = {
  id: 'period-1',
  year: 2026,
  month: 9,
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-30'),
  status: 'DRAFT',
};

const DEFAULT_SETTING = {
  standardWorkingDaysMethod: 'FIXED_26',
  saturdayPolicy: 'HALF_DAY',
  sundayPolicy: 'OFF',
  standardHoursPerDay: new Prisma.Decimal(8.0),
  baseSalary: new Prisma.Decimal(2_340_000),
  regionMinSalary: new Prisma.Decimal(4_960_000),
  insuranceEmployeeSocial: new Prisma.Decimal(8.0),
  insuranceEmployeeHealth: new Prisma.Decimal(1.5),
  insuranceEmployeeUnemployment: new Prisma.Decimal(1.0),
  insuranceCompanySocial: new Prisma.Decimal(17.5),
  insuranceCompanyHealth: new Prisma.Decimal(3.0),
  insuranceCompanyUnemployment: new Prisma.Decimal(1.0),
  unionFeeEmployeeRate: new Prisma.Decimal(1.0),
  unionFeeMaxAmount: new Prisma.Decimal(234_000),
  unionFeeCompanyRate: new Prisma.Decimal(2.0),
  personalDeduction: new Prisma.Decimal(11_000_000),
  dependentDeduction: new Prisma.Decimal(4_400_000),
  lunchAllowanceTaxFreeCap: new Prisma.Decimal(730_000),
  withholdingTaxRate: new Prisma.Decimal(10.0),
  withholdingTaxThreshold: new Prisma.Decimal(2_000_000),
};

function makeEmployee(overrides: any = {}) {
  const { hop_dong, ...rest } = overrides;
  return {
    ma_nv: 'NV0001',
    ho_ten: 'Nguyễn Văn A',
    chuc_vu: 'Nhân viên',
    ma_pb: null,
    cong_doan: false,
    status: '1',
    da_xoa: false,
    hop_dong: hop_dong ?? [
      {
        id: 'hd-1',
        ma_nv: 'NV0001',
        so_hd: 'HD01',
        loai_hd: 'xac_dinh',
        kieu_luong: 'gross',
        luong_chinh: new Prisma.Decimal(12_000_000),
        luong_bhxh: new Prisma.Decimal(12_000_000),
        ngay_bat_dau: new Date('2026-01-01'),
        ngay_ket_thuc: null,
        trich_bhxh: true,
        tinh_tncn: true,
      },
    ],
    nguoi_phu_thuoc: [],
    ...rest,
  };
}

interface DbFixture {
  employees?: any[];
  generalSetting?: Record<string, unknown> | null;
  employeeSalaries?: any[];
  salaryStructures?: any[];
  attendances?: any[];
  overtimes?: any[];
  salaryItemsCatalog?: any[];
  adjustments?: any[];
}

function buildDb(fixture: DbFixture = {}) {
  const employees = fixture.employees ?? [makeEmployee()];
  const generalSetting =
    fixture.generalSetting === null ? null : { ...DEFAULT_SETTING, ...(fixture.generalSetting ?? {}) };
  const employeeSalaries = fixture.employeeSalaries ?? [];
  const salaryStructures = fixture.salaryStructures ?? [];
  const attendances = fixture.attendances ?? [];
  const overtimes = fixture.overtimes ?? [];
  const salaryItemsCatalog = fixture.salaryItemsCatalog ?? [];
  const adjustments = fixture.adjustments ?? [];

  const db: any = {
    // RVW-025 (review-findings.md 2026-09-10): engine đổi từ `findFirst()` sang
    // `findUnique({ where: { id: SINGLETON_ID } })` — mock phải có cả hai để không vỡ.
    generalSetting: {
      findFirst: async () => generalSetting,
      findUnique: async () => generalSetting,
    },
    holiday: { findMany: async () => [] },
    hrm_nhan_vien: { findMany: async () => employees },
    hrm_phong_ban: { findMany: async () => [] },
    employeeSalary: {
      // RVW-021 — mô phỏng ĐÚNG bộ lọc theo kỳ mà engine thật truyền vào (`effectiveFrom`/
      // `effectiveTo`). Fixture nào KHÔNG khai 2 trường này thì coi như luôn hiệu lực (giữ hành
      // vi cũ cho ~40 test hiện có chưa từng set 2 trường này).
      findMany: async ({ where }: any = {}) => {
        let list = [...employeeSalaries];
        if (where?.status) list = list.filter((es: any) => es.status === where.status);
        if (where?.effectiveFrom?.lte) {
          const lte = where.effectiveFrom.lte;
          list = list.filter((es: any) => !es.effectiveFrom || es.effectiveFrom <= lte);
        }
        if (where?.OR) {
          const gte = where.OR.find((c: any) => c.effectiveTo?.gte)?.effectiveTo?.gte;
          if (gte) {
            list = list.filter(
              (es: any) => es.effectiveTo === undefined || es.effectiveTo === null || es.effectiveTo >= gte,
            );
          }
        }
        return list;
      },
    },
    salaryStructure: { findMany: async () => salaryStructures },
    salaryItem: {
      findMany: async ({ where }: any = {}) => {
        let list = [...salaryItemsCatalog];
        if (where?.category) list = list.filter((i: any) => i.category === where.category);
        if (where?.status) list = list.filter((i: any) => i.status === where.status);
        return list;
      },
    },
    attendanceRecord: { findMany: async () => attendances },
    overtimeRecord: { findMany: async () => overtimes },
    kpiRecord: { findMany: async () => [] },
    bonusRecord: { findMany: async () => [] },
    pieceworkRecord: { findMany: async () => [] },
    commissionRecord: { findMany: async () => [] },
    diligenceRecord: { findMany: async () => [] },
    salaryAdjustmentRecord: { findMany: async () => adjustments },
    payrollPeriod: { findUnique: async () => PERIOD },
  };
  return db;
}

function salaryItem(over: Partial<{
  id: string; code: string; name: string; category: string; isTaxable: boolean; isMealAllowance: boolean;
}>) {
  return {
    id: over.id ?? 'si-1',
    code: over.code ?? 'KL01',
    name: over.name ?? 'Khoản lương',
    category: over.category ?? 'FIXED_ALLOWANCE',
    isTaxable: over.isTaxable ?? true,
    isMealAllowance: over.isMealAllowance ?? false,
  };
}

function esItem(si: ReturnType<typeof salaryItem>, amount: number) {
  return { salaryItemId: si.id, amount: new Prisma.Decimal(amount), salaryItem: si };
}

function activeStructure(items: Array<{
  salaryItemId: string; calculationMethod?: string; isOvertimeBase?: boolean; taxTreatment?: string;
}>) {
  return {
    isActive: true,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    items: items.map((it) => ({
      salaryItemId: it.salaryItemId,
      calculationMethod: it.calculationMethod ?? 'MONTHLY_FIXED',
      isOvertimeBase: it.isOvertimeBase ?? false,
      taxTreatment: it.taxTreatment ?? 'TAXABLE',
    })),
  };
}

function overtimeRecord(hours: number, convertedHours: number, ratePercent: number, otType = 'ngay_thuong_ngay') {
  return {
    ma_nv: 'NV0001',
    otType,
    hours: new Prisma.Decimal(hours),
    ratePercent: new Prisma.Decimal(ratePercent),
    convertedHours: new Prisma.Decimal(convertedHours),
  };
}

/** 1 bản ghi chấm công delta workDayValue=0 (nghỉ không lương) — mỗi bản ghi trừ đúng 1 công. */
function unpaidLeaveRecord(date: string) {
  return { ma_nv: 'NV0001', workDate: new Date(date), workDayValue: new Prisma.Decimal(0) };
}

async function calcNV0001(fixture: DbFixture) {
  const db = buildDb(fixture);
  const rows = await calculatePayrollPreview(db, PERIOD.id, PERIOD);
  const row = rows.find((r) => r.ma_nv === 'NV0001');
  assert.ok(row, 'phải có dòng cho NV0001');
  return row!;
}

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 1 — Nguồn lương cơ bản hybrid (BR-dltl-028 / ADR-010 bước [1]/[2])
 * ════════════════════════════════════════════════════════════════════ */

test('TC-blth-001: fixedAllowanceTotal gồm CẢ 2 category, baseSalaryMonthly = hợp đồng + phụ cấp', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', code: 'KL01', name: 'Phụ cấp điện thoại', category: 'FIXED_ALLOWANCE' });
  const xangXe = salaryItem({ id: 'si-xx', code: 'KL02', name: 'Phụ cấp xăng xe', category: 'FIXED_ALLOWANCE' });
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', name: 'Phụ cấp ăn trưa', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true });

  const row = await calcNV0001({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        items: [esItem(dienThoai, 500_000), esItem(xangXe, 300_000), esItem(anTrua, 700_000)],
      },
    ],
  });

  assert.equal(row.fixedAllowanceTotal, 1_500_000);
  assert.equal(row.baseSalaryMonthly, 13_500_000);
});

test('TC-blth-001b: thiếu công — mỗi khoản quy đổi RIÊNG theo calculationMethod, KHÔNG gộp 1 tỷ lệ', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE' });
  const xangXe = salaryItem({ id: 'si-xx', code: 'KL02', category: 'FIXED_ALLOWANCE' });
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true });

  const attendances = [
    unpaidLeaveRecord('2026-09-01'),
    unpaidLeaveRecord('2026-09-02'),
    unpaidLeaveRecord('2026-09-03'),
    unpaidLeaveRecord('2026-09-04'),
    unpaidLeaveRecord('2026-09-05'),
    unpaidLeaveRecord('2026-09-06'),
  ]; // actualWorkDays = 26 - 6 = 20

  const row = await calcNV0001({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        items: [esItem(dienThoai, 500_000), esItem(xangXe, 300_000), esItem(anTrua, 700_000)],
      },
    ],
    salaryStructures: [activeStructure([{ salaryItemId: 'si-xx', calculationMethod: 'ACTUAL_WORKDAYS' }])],
    attendances,
  });

  assert.equal(row.actualWorkDays, 20);
  assert.equal(row.baseSalaryMonthly, 13_500_000, 'cột Lương KHÔNG quy đổi công');
  assert.equal(row.allowanceInPeriodTotal, 500_000 + 230_769 + 700_000);
  assert.equal(row.proratedWorkSalary, Math.round((12_000_000 * 20) / 26));
});

test('TC-blth-002: Set lương chỉ có khoản KHÔNG thuộc FIXED/BENEFIT_ALLOWANCE -> không cộng', async () => {
  const chuyenCan = salaryItem({ id: 'si-cc', code: 'KL04', category: 'ATTENDANCE_ALLOWANCE' });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(chuyenCan, 1_000_000)] },
    ],
  });
  assert.equal(row.fixedAllowanceTotal, 0);
  assert.equal(row.baseSalaryMonthly, 12_000_000);
});

test('TC-blth-003: không có Set lương nào -> baseSalaryMonthly chỉ từ hợp đồng', async () => {
  const row = await calcNV0001({ employeeSalaries: [] });
  assert.equal(row.baseSalaryMonthly, 12_000_000);
});

test('TC-blth-004: Set lương tồn tại nhưng CHƯA APPROVED -> không được tính', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', category: 'FIXED_ALLOWANCE' });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'PENDING_APPROVAL', totalAmount: new Prisma.Decimal(0), items: [esItem(dienThoai, 500_000)] },
    ],
  });
  assert.equal(row.baseSalaryMonthly, 12_000_000);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 2 — Biểu thuế TNCN 7 bậc (đối chiếu, regression)
 * ════════════════════════════════════════════════════════════════════ */

test('TC-blth-006..012: biểu thuế 7 bậc — đúng từng bậc theo Điều 22 Luật Thuế TNCN', () => {
  assert.equal(tinhThueLuyTien(5_000_000), 250_000); // bậc 1
  assert.equal(tinhThueLuyTien(10_000_000), 750_000); // bậc 2
  assert.equal(tinhThueLuyTien(18_000_000), 1_950_000); // bậc 3
  assert.equal(tinhThueLuyTien(32_000_000), 4_750_000); // bậc 4
  assert.equal(tinhThueLuyTien(52_000_000), 9_750_000); // bậc 5
  assert.equal(tinhThueLuyTien(80_000_000), 18_150_000); // bậc 6
  assert.equal(tinhThueLuyTien(100_000_000), 25_150_000); // bậc 7, mở
});

test('TC-blth-013: biểu 7 bậc KHÔNG được trùng kết quả biểu 5 bậc cắt cụt ở 25%', () => {
  const bay_bac = tinhThueLuyTien(100_000_000);
  const nam_bac_sai =
    5_000_000 * 0.05 + 5_000_000 * 0.1 + 8_000_000 * 0.15 + 14_000_000 * 0.2 + (100_000_000 - 32_000_000) * 0.25;
  assert.notEqual(bay_bac, Math.round(nam_bac_sai));
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 3 — Hai trần bảo hiểm độc lập (BR-dltl-024, ADR-010 QĐ-2)
 * ════════════════════════════════════════════════════════════════════ */

function contractWithBhxh(luongBhxh: number, trichBhxh = true) {
  return [
    {
      id: 'hd-1',
      ma_nv: 'NV0001',
      so_hd: 'HD01',
      loai_hd: 'xac_dinh',
      kieu_luong: 'gross',
      luong_chinh: new Prisma.Decimal(luongBhxh),
      luong_bhxh: new Prisma.Decimal(luongBhxh),
      ngay_bat_dau: new Date('2026-01-01'),
      ngay_ket_thuc: null,
      trich_bhxh: trichBhxh,
      tinh_tncn: true,
    },
  ];
}

test('TC-blth-014: dưới cả 2 trần — công thức KHÔNG đổi so với cách gộp cũ', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithBhxh(20_000_000) })] });
  assert.equal(row.employeeInsuranceDeduction, 2_100_000);
  assert.equal(row.companyInsuranceExpense, 4_300_000);
  assert.equal(row.insuranceCapAppliedBhxhByt, false);
  assert.equal(row.insuranceCapAppliedBhtn, false);
});

test('TC-blth-015: vượt cả 2 trần — tính RIÊNG từng trần rồi cộng, KHÔNG kẹp 1 trần chung', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithBhxh(120_000_000) })] });
  assert.equal(row.employeeInsuranceDeduction, 5_438_000);
  assert.equal(row.companyInsuranceExpense, 10_586_000);
  assert.equal(row.insuranceCapAppliedBhxhByt, true);
  assert.equal(row.insuranceCapAppliedBhtn, true);
});

test('TC-blth-016: vượt trần BHXH+BHYT nhưng CHƯA vượt trần BHTN', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithBhxh(70_000_000) })] });
  assert.equal(row.employeeInsuranceDeduction, 5_146_000);
  assert.equal(row.companyInsuranceExpense, 10_294_000);
  assert.equal(row.insuranceCapAppliedBhxhByt, true);
  assert.equal(row.insuranceCapAppliedBhtn, false);
});

test('TC-blth-017: boundary đúng trần BHXH+BHYT (46.800.000) — KHÔNG bị coi là vượt', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithBhxh(46_800_000) })] });
  assert.equal(row.employeeInsuranceDeduction, 4_914_000);
  assert.equal(row.insuranceCapAppliedBhxhByt, false);
});

test('TC-blth-018: boundary đúng trần BHTN (99.200.000)', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithBhxh(99_200_000) })] });
  assert.equal(row.employeeInsuranceDeduction, 5_438_000);
  assert.equal(row.insuranceCapAppliedBhtn, false);
});

test('TC-blth-019: trich_bhxh=false -> cả 2 trần = 0đ (giữ nguyên hành vi hiện tại)', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithBhxh(20_000_000, false) })] });
  assert.equal(row.employeeInsuranceDeduction, 0);
  assert.equal(row.companyInsuranceExpense, 0);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 4 — Miễn thuế OT vượt chuẩn (BR-dltl-025, ADR-010 QĐ-1)
 * ════════════════════════════════════════════════════════════════════ */

function contractOt(luongChinh = 15_600_000, overrides: Record<string, unknown> = {}) {
  return [
    {
      id: 'hd-1',
      ma_nv: 'NV0001',
      so_hd: 'HD01',
      loai_hd: 'xac_dinh',
      kieu_luong: 'gross',
      luong_chinh: new Prisma.Decimal(luongChinh),
      luong_bhxh: new Prisma.Decimal(luongChinh),
      ngay_bat_dau: new Date('2026-01-01'),
      ngay_ket_thuc: null,
      trich_bhxh: false,
      tinh_tncn: true,
      ...overrides,
    },
  ];
}

test('TC-blth-020: OT ngày thường 150% — otHourlyRate=75.000đ, miễn thuế đúng phần vượt chuẩn', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt() })],
    overtimes: [overtimeRecord(10, 15, 150)],
  });
  assert.equal(row.otAmount, 1_125_000);
  assert.equal(row.otTaxExemptAmount, 375_000);
});

test('TC-blth-021: OT ngày nghỉ 200%', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt() })],
    overtimes: [overtimeRecord(5, 10, 200, 'chu_nhat_ngay')],
  });
  assert.equal(row.otAmount, 750_000);
  assert.equal(row.otTaxExemptAmount, 375_000);
});

test('TC-blth-022: OT ngày lễ 300%', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt() })],
    overtimes: [overtimeRecord(4, 12, 300, 'ngay_le_ngay')],
  });
  assert.equal(row.otAmount, 900_000);
  assert.equal(row.otTaxExemptAmount, 600_000);
});

test('TC-blth-023: cộng dồn cả 3 loại OT trong 1 kỳ', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt() })],
    overtimes: [
      overtimeRecord(10, 15, 150),
      overtimeRecord(5, 10, 200, 'chu_nhat_ngay'),
      overtimeRecord(4, 12, 300, 'ngay_le_ngay'),
    ],
  });
  assert.equal(row.otAmount, 2_775_000);
  assert.equal(row.otTaxExemptAmount, 1_350_000);
  assert.equal(row.otRawHours, 19);
});

test('TC-blth-024: tinh_tncn=false — OT vẫn tính đủ vào thực lĩnh, nhưng personalIncomeTax=0', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt(15_600_000, { tinh_tncn: false }) })],
    overtimes: [overtimeRecord(10, 15, 150)],
  });
  assert.equal(row.otAmount, 1_125_000);
  assert.equal(row.personalIncomeTax, 0);
});

test('TC-blth-024b (regression B-5): otBase KHÔNG phồng theo phụ cấp cố định mặc định', async () => {
  const pcTrachNhiem = salaryItem({ id: 'si-tn', code: 'KL05', category: 'FIXED_ALLOWANCE' });
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt() })],
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(pcTrachNhiem, 2_000_000)] },
    ],
    overtimes: [overtimeRecord(10, 15, 150)],
  });
  assert.equal(row.baseSalaryMonthly, 17_600_000);
  assert.equal(row.otAmount, 1_125_000, 'otHourlyRate phải dùng contractBaseSalary=15.600.000, KHÔNG dùng baseSalaryMonthly');
});

test('TC-blth-024c: khoản isOvertimeBase=true ĐƯỢC cộng vào otBase khi kế toán chủ động bật', async () => {
  const pcTrachNhiem = salaryItem({ id: 'si-tn', code: 'KL05', category: 'FIXED_ALLOWANCE' });
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractOt() })],
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(pcTrachNhiem, 2_080_000)] },
    ],
    salaryStructures: [activeStructure([{ salaryItemId: 'si-tn', isOvertimeBase: true }])],
    overtimes: [overtimeRecord(10, 15, 150)],
  });
  // otBase = 15.600.000 + 2.080.000 = 17.680.000 -> otHourlyRate = 17.680.000/208 = 85.000
  assert.equal(row.otAmount, Math.round(85_000 * 15));
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 5 — Khấu trừ 10% tại nguồn HĐ thử việc/thời vụ (BR-dltl-026, ADR-010 QĐ-3)
 * ════════════════════════════════════════════════════════════════════ */

function contractWithholding(loaiHd: string, luongChinh: number, overrides: Record<string, unknown> = {}) {
  return [
    {
      id: 'hd-1',
      ma_nv: 'NV0001',
      so_hd: 'HD01',
      loai_hd: loaiHd,
      kieu_luong: 'gross',
      luong_chinh: new Prisma.Decimal(luongChinh),
      luong_bhxh: new Prisma.Decimal(luongChinh),
      ngay_bat_dau: new Date('2026-01-01'),
      ngay_ket_thuc: null,
      trich_bhxh: false,
      tinh_tncn: true,
      ...overrides,
    },
  ];
}

test('TC-blth-025: thu_viec, gross >= ngưỡng -> khấu trừ 10%, KHÔNG giảm trừ gia cảnh', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithholding('thu_viec', 5_000_000) })] });
  assert.equal(row.personalIncomeTax, 500_000);
  assert.equal(row.withholdingTaxApplied, true);
});

test('TC-blth-026: thoi_vu, gross < ngưỡng 2.000.000 -> không khấu trừ', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithholding('thoi_vu', 1_800_000) })] });
  assert.equal(row.personalIncomeTax, 0);
  assert.equal(row.withholdingTaxApplied, false);
});

test('TC-blth-027: thu_viec, đúng ngưỡng 2.000.000 (boundary >=) -> CÓ khấu trừ', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithholding('thu_viec', 2_000_000) })] });
  assert.equal(row.personalIncomeTax, 200_000);
  assert.equal(row.withholdingTaxApplied, true);
});

test('TC-blth-028: xac_dinh (HĐ dài hạn) cùng mức gross -> áp nhánh lũy tiến, khác hẳn TC-025', async () => {
  const row = await calcNV0001({ employees: [makeEmployee({ hop_dong: contractWithholding('xac_dinh', 5_000_000) })] });
  assert.equal(row.personalIncomeTax, 0); // dưới ngưỡng chịu thuế sau giảm trừ gia cảnh
  assert.equal(row.withholdingTaxApplied, false);
});

test('TC-blth-029 (GAP-QA-05 đã đóng): tinh_tncn=false ĐÈ LÊN cả 2 cơ chế, bất kể loai_hd', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractWithholding('thu_viec', 5_000_000, { tinh_tncn: false }) })],
  });
  assert.equal(row.personalIncomeTax, 0);
  assert.equal(row.withholdingTaxApplied, false);
});

test('laHopDongKhauTruTaiNguon: đúng phạm vi {thu_viec, thoi_vu}, chuẩn hóa hoa/thường + khoảng trắng', () => {
  assert.equal(laHopDongKhauTruTaiNguon('thu_viec'), true);
  assert.equal(laHopDongKhauTruTaiNguon('thoi_vu'), true);
  assert.equal(laHopDongKhauTruTaiNguon('  Thu_Viec  '), true);
  assert.equal(laHopDongKhauTruTaiNguon('khoan'), false);
  assert.equal(laHopDongKhauTruTaiNguon('xac_dinh'), false);
  assert.equal(laHopDongKhauTruTaiNguon(null), false);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 6 — Trần miễn thuế ăn trưa 730k/tháng (BR-dltl-027)
 * ════════════════════════════════════════════════════════════════════ */

function mealFixture(monthlyAmount: number, attendances: any[] = []) {
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true });
  return {
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(anTrua, monthlyAmount)] },
    ],
    salaryStructures: [activeStructure([{ salaryItemId: 'si-at', calculationMethod: 'ACTUAL_WORKDAYS' }])],
    attendances,
  };
}

test('TC-blth-030: trong trần, đủ công', async () => {
  const row = await calcNV0001(mealFixture(700_000));
  assert.equal(row.mealAllowanceAmount, 700_000);
  assert.equal(row.lunchAllowanceExemptAmount, 700_000);
  assert.equal(row.lunchAllowanceTaxableAmount, 0);
});

test('TC-blth-031: vượt trần, đủ công', async () => {
  const row = await calcNV0001(mealFixture(900_000));
  assert.equal(row.mealAllowanceAmount, 900_000);
  assert.equal(row.lunchAllowanceExemptAmount, 730_000);
  assert.equal(row.lunchAllowanceTaxableAmount, 170_000);
});

test('TC-blth-032 (số liệu ĐÃ SỬA theo AC-dltl-23/ADR-010 [5c] — trần CŨNG quy đổi công)', async () => {
  const attendances = [
    unpaidLeaveRecord('2026-09-01'),
    unpaidLeaveRecord('2026-09-02'),
    unpaidLeaveRecord('2026-09-03'),
    unpaidLeaveRecord('2026-09-04'),
    unpaidLeaveRecord('2026-09-05'),
    unpaidLeaveRecord('2026-09-06'),
  ]; // actualWorkDays = 20/26
  const row = await calcNV0001(mealFixture(800_000, attendances));
  assert.equal(row.actualWorkDays, 20);
  assert.equal(row.mealAllowanceAmount, 615_385); // round(800.000 × 20/26)
  // hanMucMienThue = round(730.000 × 20/26) = 561.538 (KHÔNG phải 730.000 cố định — test-matrix cũ
  // sai vì quên quy đổi công cho trần, mâu thuẫn AC-dltl-23; xem chú thích đầu file).
  assert.equal(row.lunchAllowanceExemptAmount, 561_538);
  assert.equal(row.lunchAllowanceTaxableAmount, 615_385 - 561_538);
});

test('TC-blth-033 (số liệu ĐÃ SỬA cùng lý do TC-032) — vượt trần sau khi cả 2 vế đều quy đổi công', async () => {
  const attendances = [
    unpaidLeaveRecord('2026-09-01'),
    unpaidLeaveRecord('2026-09-02'),
    unpaidLeaveRecord('2026-09-03'),
    unpaidLeaveRecord('2026-09-04'),
    unpaidLeaveRecord('2026-09-05'),
    unpaidLeaveRecord('2026-09-06'),
  ];
  const row = await calcNV0001(mealFixture(1_200_000, attendances));
  assert.equal(row.mealAllowanceAmount, 923_077); // round(1.200.000 × 20/26)
  assert.equal(row.lunchAllowanceExemptAmount, 561_538);
  assert.equal(row.lunchAllowanceTaxableAmount, 923_077 - 561_538);
});

test('TC-blth-034: boundary đúng trần (730.000), đủ công', async () => {
  const row = await calcNV0001(mealFixture(730_000));
  assert.equal(row.mealAllowanceAmount, 730_000);
  assert.equal(row.lunchAllowanceExemptAmount, 730_000);
  assert.equal(row.lunchAllowanceTaxableAmount, 0);
});

test('AC-dltl-23: nghỉ nửa tháng — hanMucMienThue quy đổi đúng theo công, KHÔNG giữ nguyên 730.000', async () => {
  const attendances = Array.from({ length: 13 }, (_, i) =>
    unpaidLeaveRecord(`2026-09-${String(i + 1).padStart(2, '0')}`),
  ); // actualWorkDays = 26 - 13 = 13 = standardWorkDays / 2
  const row = await calcNV0001(mealFixture(1_000_000, attendances));
  assert.equal(row.actualWorkDays, 13);
  assert.equal(row.lunchAllowanceExemptAmount <= 365_000, true);
  assert.equal(Math.round(730_000 * 0.5), 365_000);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 7 — Endpoint mới GET /payroll/support-allowances (BR-dltl-029)
 * ════════════════════════════════════════════════════════════════════ */

test('TC-blth-035/8.7(a): total của support-allowances KHỚP ĐÚNG phần BENEFIT_ALLOWANCE trong allowanceInPeriodTotal', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE' });
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', name: 'Phụ cấp ăn trưa', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true });
  const fixture: DbFixture = {
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        items: [esItem(dienThoai, 500_000), esItem(anTrua, 700_000)],
      },
    ],
    salaryItemsCatalog: [
      { id: 'si-at', code: 'KL03', name: 'Phụ cấp ăn trưa', category: 'BENEFIT_ALLOWANCE', status: 'ACTIVE', isTaxable: true, isMealAllowance: true },
    ],
  };
  const db = buildDb(fixture);

  const calcRows = await calculatePayrollPreview(db, PERIOD.id, PERIOD);
  const calcRow = calcRows.find((r) => r.ma_nv === 'NV0001')!;

  const breakdown = await getSupportAllowanceBreakdown(db, PERIOD.id);
  assert.equal(breakdown.columns.length, 1);
  assert.equal(breakdown.columns[0].code, 'KL03');
  const item = breakdown.items.find((i: any) => i.ma_nv === 'NV0001');
  assert.ok(item);
  assert.equal(item.amounts.KL03, 700_000);
  assert.equal(item.total, 700_000);

  // Bất biến bắt buộc (api-contract Mục 8.7a) — CHỈ phần BENEFIT_ALLOWANCE của allowanceInPeriodTotal.
  assert.equal(item.total, 700_000);
  assert.equal(calcRow.allowanceInPeriodTotal, 500_000 + 700_000);
});

test('TC-blth-036: kỳ chưa có nhân viên hoạt động -> items rỗng', async () => {
  const db = buildDb({ employees: [] });
  const breakdown = await getSupportAllowanceBreakdown(db, PERIOD.id);
  assert.deepEqual(breakdown.items, []);
});

test('TC-blth-037: periodId không tồn tại -> ném lỗi (404 E-dltl-025)', async () => {
  const db = buildDb({});
  db.payrollPeriod.findUnique = async () => null;
  await assert.rejects(() => getSupportAllowanceBreakdown(db, 'khong-ton-tai'));
});

test('TC-blth-039: nhân viên có Set lương nhưng KHÔNG có BENEFIT_ALLOWANCE -> vẫn có dòng, tổng=0', async () => {
  const chuyenCan = salaryItem({ id: 'si-cc', code: 'KL04', category: 'ATTENDANCE_ALLOWANCE' });
  const db = buildDb({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(chuyenCan, 1_000_000)] },
    ],
  });
  const breakdown = await getSupportAllowanceBreakdown(db, PERIOD.id);
  const item = breakdown.items.find((i: any) => i.ma_nv === 'NV0001');
  assert.ok(item);
  assert.equal(item.total, 0);
  assert.equal(item.monthlyTotal, 0);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 8 — Regression: bất biến tài chính đã có
 * ════════════════════════════════════════════════════════════════════ */

test('TC-blth-041: thực lĩnh ÂM không bị ép về 0 khi tạm ứng lớn hơn thu nhập', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractWithBhxh(10_000_000, false) })],
    adjustments: [{ ma_nv: 'NV0001', amount: new Prisma.Decimal(20_000_000), adjustmentItem: { direction: 'tru' } }],
  });
  assert.equal(row.netTakeHomeSalary < 0, true);
});

test('TC-blth-044: HĐ thử việc + tạm ứng lớn hơn thu nhập — 2 cơ chế mới không xung đột', async () => {
  const row = await calcNV0001({
    employees: [makeEmployee({ hop_dong: contractWithholding('thu_viec', 3_000_000) })],
    adjustments: [{ ma_nv: 'NV0001', amount: new Prisma.Decimal(4_000_000), adjustmentItem: { direction: 'tru' } }],
  });
  assert.equal(row.personalIncomeTax, 300_000);
  assert.equal(row.netTakeHomeSalary, 3_000_000 - 0 - 300_000 - 4_000_000);
  assert.equal(row.netTakeHomeSalary < 0, true);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 9 — Miễn thuế phụ cấp cố định theo khai báo (Q-1/Q-2/Q-9.3, ADR-010 QĐ-9)
 * ════════════════════════════════════════════════════════════════════ */

test('TC-blth-045: 1 khoản tick isTaxable=false, không phải ăn ca -> vẫn trả đủ tiền, chỉ giảm thuế', async () => {
  const pcTrachNhiem = salaryItem({ id: 'si-tn', code: 'KL05', category: 'FIXED_ALLOWANCE', isTaxable: false });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(pcTrachNhiem, 1_000_000)] },
    ],
  });
  assert.equal(row.fixedAllowanceTotal, 1_000_000);
  assert.equal(row.baseSalaryMonthly, 13_000_000);
  assert.equal(row.allowanceInPeriodTotal, 1_000_000, 'VẪN được trả đủ, không bị trừ khỏi thực lĩnh');
  assert.equal(row.otherAllowanceTaxExemptAmount, 1_000_000);
});

test('TC-blth-046: 2 khoản, chỉ khoản tick isTaxable=false mới bị trừ khỏi thuế', async () => {
  const pcTrachNhiem = salaryItem({ id: 'si-tn', code: 'KL05', category: 'FIXED_ALLOWANCE', isTaxable: false });
  const pcDienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE', isTaxable: true });
  const row = await calcNV0001({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        items: [esItem(pcTrachNhiem, 1_000_000), esItem(pcDienThoai, 500_000)],
      },
    ],
  });
  assert.equal(row.allowanceInPeriodTotal, 1_500_000);
  assert.equal(row.otherAllowanceTaxExemptAmount, 1_000_000);
});

test('TC-blth-047: khoản ăn ca VỪA isMealAllowance VỪA isTaxable=false -> CHỈ 1 lớp (trần thắng), KHÔNG cộng đôi', async () => {
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true, isTaxable: false });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(anTrua, 900_000)] },
    ],
  });
  assert.equal(row.mealAllowanceAmount, 900_000);
  assert.equal(row.lunchAllowanceExemptAmount, 730_000);
  assert.equal(row.lunchAllowanceTaxableAmount, 170_000);
  assert.equal(row.otherAllowanceTaxExemptAmount, 0, 'TUYỆT ĐỐI không cộng thêm lớp miễn theo khai báo');
});

test('TC-blth-048: khoản ăn ca isTaxable=true (mặc định) -> trần vẫn áp Y HỆT — trần ĐỘC LẬP với isTaxable', async () => {
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true, isTaxable: true });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(anTrua, 900_000)] },
    ],
  });
  assert.equal(row.lunchAllowanceExemptAmount, 730_000);
  assert.equal(row.lunchAllowanceTaxableAmount, 170_000);
});

test('TC-blth-049 (regression): không khoản nào tick miễn thuế -> otherAllowanceTaxExemptAmount=0', async () => {
  const pcDienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE', isTaxable: true });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(pcDienThoai, 500_000)] },
    ],
  });
  assert.equal(row.otherAllowanceTaxExemptAmount, 0);
});

test('TC-blth-050 / AC-dltl-25 (Q-2, phép OR): isTaxable=true NHƯNG taxTreatment=EXEMPT -> VẪN miễn', async () => {
  const pcTrachNhiem = salaryItem({ id: 'si-tn', code: 'KL05', category: 'FIXED_ALLOWANCE', isTaxable: true });
  const row = await calcNV0001({
    employeeSalaries: [
      { ma_nv: 'NV0001', status: 'APPROVED', totalAmount: new Prisma.Decimal(0), items: [esItem(pcTrachNhiem, 1_000_000)] },
    ],
    salaryStructures: [activeStructure([{ salaryItemId: 'si-tn', taxTreatment: 'EXEMPT' }])],
  });
  assert.equal(row.otherAllowanceTaxExemptAmount, 1_000_000, 'EXEMPT không bị isTaxable=true phủ quyết (OR)');
});

test('AC-dltl-27: BonusRecord/CommissionRecord isTaxable=false KHÔNG được đọc — chỉ phụ cấp cố định mới xét', () => {
  const bonusItem = salaryItem({ id: 'si-th', code: 'TH01', category: 'PERIODIC_BONUS', isTaxable: false });
  // `tinhKhoanPhuCapTheoKy` phải BỎ QUA hoàn toàn danh mục ngoài FIXED_ALLOWANCE/BENEFIT_ALLOWANCE.
  const rows = tinhKhoanPhuCapTheoKy([esItem(bonusItem, 2_000_000)], new Map(), 1);
  assert.equal(rows.length, 0);
});

test('laKhoanMienThue: EXEMPT hoặc isTaxable=false là đủ (OR bất đối xứng, ADR-010 QĐ-9.2)', () => {
  assert.equal(laKhoanMienThue(undefined, { isTaxable: false }), true);
  assert.equal(laKhoanMienThue({ calculationMethod: 'MONTHLY_FIXED', isOvertimeBase: false, taxTreatment: 'EXEMPT' }, { isTaxable: true }), true);
  assert.equal(laKhoanMienThue({ calculationMethod: 'MONTHLY_FIXED', isOvertimeBase: false, taxTreatment: 'TAXABLE' }, { isTaxable: true }), false);
  assert.equal(laKhoanMienThue(undefined, { isTaxable: true }), false);
});

/* ════════════════════════════════════════════════════════════════════
 * Nhóm 9 — Vòng sửa lỗi Review 2026-09-10 (RVW-019, RVW-021, RVW-025)
 * ════════════════════════════════════════════════════════════════════ */

test('RVW-019: support-allowances.total KHÔNG cộng khoản BENEFIT_ALLOWANCE đã INACTIVE — Σamounts luôn khớp total', async () => {
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', name: 'Phụ cấp ăn trưa', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true });
  // si-hd: nhân viên vẫn đang được gán khoản này trong `EmployeeSalaryItem`, nhưng khoản đã bị
  // chuyển INACTIVE ở danh mục (`salaryItemsCatalog` bên dưới KHÔNG khai nó — mô phỏng đúng
  // `where: { status: 'ACTIVE' }` của `getSupportAllowanceBreakdown`).
  const hoTro = salaryItem({ id: 'si-hd', code: 'KL05', name: 'Hỗ trợ đã ngừng', category: 'BENEFIT_ALLOWANCE' });

  const db = buildDb({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        items: [esItem(anTrua, 700_000), esItem(hoTro, 300_000)],
      },
    ],
    // CHỈ khoản KL03 còn ACTIVE trong danh mục — KL05 đã bị ẩn (INACTIVE), không nằm trong
    // `salaryItemsCatalog` (mock `salaryItem.findMany` lọc `status='ACTIVE'`).
    salaryItemsCatalog: [
      { id: 'si-at', code: 'KL03', name: 'Phụ cấp ăn trưa', category: 'BENEFIT_ALLOWANCE', status: 'ACTIVE', isTaxable: true, isMealAllowance: true },
    ],
  });

  const breakdown = await getSupportAllowanceBreakdown(db, PERIOD.id);
  assert.equal(breakdown.columns.length, 1, 'chỉ 1 cột ACTIVE (KL03), KL05 đã INACTIVE không hiện cột');

  const item = breakdown.items.find((i: any) => i.ma_nv === 'NV0001');
  assert.ok(item);
  // Bất biến RVW-019: total PHẢI bằng đúng tổng amounts hiển thị (KHÔNG cộng thêm khoản INACTIVE).
  const sumAmounts = Object.values(item.amounts as Record<string, number>).reduce((s, v) => s + v, 0);
  assert.equal(item.total, sumAmounts, 'total phải khớp Σ amounts hiển thị trên bảng');
  assert.equal(item.total, 700_000, 'CHỈ tính KL03 (ACTIVE), bỏ KL05 (INACTIVE)');
});

test('RVW-020: getSupportAllowanceBreakdown trả kèm periodStatus + isLiveRecalculated để FE cảnh báo khi kỳ đã khóa', async () => {
  const db = buildDb({});
  db.payrollPeriod.findUnique = async () => ({ ...PERIOD, status: 'LOCKED' });
  const breakdown = await getSupportAllowanceBreakdown(db, PERIOD.id);
  assert.equal(breakdown.periodStatus, 'LOCKED');
  assert.equal(breakdown.isLiveRecalculated, true);
});

test('RVW-021: set lương hiệu lực từ THÁNG SAU (effectiveFrom > kỳ đang tính) KHÔNG được engine đọc', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE' });
  const row = await calcNV0001({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        effectiveFrom: new Date('2026-10-01'), // kỳ đang tính là 2026-09 -> hiệu lực từ THÁNG SAU
        effectiveTo: null,
        items: [esItem(dienThoai, 500_000)],
      },
    ],
  });
  assert.equal(row.fixedAllowanceTotal, 0, 'set lương của tháng sau KHÔNG được cộng vào kỳ hiện tại');
  assert.equal(row.baseSalaryMonthly, 12_000_000, 'chỉ còn lương hợp đồng, không có phụ cấp');
});

test('RVW-021: set lương đã HẾT hiệu lực (effectiveTo < đầu kỳ đang tính) KHÔNG được engine đọc', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE' });
  const row = await calcNV0001({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-08-31'), // hết hiệu lực TRƯỚC kỳ 2026-09
        items: [esItem(dienThoai, 500_000)],
      },
    ],
  });
  assert.equal(row.fixedAllowanceTotal, 0, 'set lương đã hết hiệu lực KHÔNG được dùng cho kỳ hiện tại');
});

test('RVW-021: set lương phủ đúng kỳ đang tính (effectiveFrom <= cuối kỳ, effectiveTo null) VẪN được đọc bình thường', async () => {
  const dienThoai = salaryItem({ id: 'si-dt', code: 'KL01', category: 'FIXED_ALLOWANCE' });
  const row = await calcNV0001({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        items: [esItem(dienThoai, 500_000)],
      },
    ],
  });
  assert.equal(row.fixedAllowanceTotal, 500_000, 'set lương phủ đúng kỳ hiện tại vẫn được cộng bình thường');
});

test('RVW-021: cùng bộ lọc theo kỳ áp dụng cho getSupportAllowanceBreakdown (không chỉ calculatePayrollPreview)', async () => {
  const anTrua = salaryItem({ id: 'si-at', code: 'KL03', category: 'BENEFIT_ALLOWANCE', isMealAllowance: true });
  const db = buildDb({
    employeeSalaries: [
      {
        ma_nv: 'NV0001',
        status: 'APPROVED',
        totalAmount: new Prisma.Decimal(0),
        effectiveFrom: new Date('2026-10-01'), // hiệu lực từ tháng sau, kỳ đang tính là 2026-09
        effectiveTo: null,
        items: [esItem(anTrua, 700_000)],
      },
    ],
    salaryItemsCatalog: [
      { id: 'si-at', code: 'KL03', category: 'BENEFIT_ALLOWANCE', status: 'ACTIVE', isTaxable: true, isMealAllowance: true },
    ],
  });
  const breakdown = await getSupportAllowanceBreakdown(db, PERIOD.id);
  const item = breakdown.items.find((i: any) => i.ma_nv === 'NV0001');
  assert.ok(item);
  assert.equal(item.total, 0, 'set lương chưa hiệu lực -> không hiện trong support-allowances của kỳ này');
});

test('RVW-025: generalSetting.findUnique(id=SINGLETON_ID) được dùng thay findFirst() không mệnh đề where', async () => {
  let capturedWhere: unknown;
  const db = buildDb({});
  db.generalSetting = {
    findFirst: async () => { throw new Error('KHÔNG được gọi findFirst() nữa'); },
    findUnique: async ({ where }: any) => { capturedWhere = where; return DEFAULT_SETTING; },
  };
  await calculatePayrollPreview(db, PERIOD.id, PERIOD);
  assert.deepEqual(capturedWhere, { id: 'DEFAULT' });
});

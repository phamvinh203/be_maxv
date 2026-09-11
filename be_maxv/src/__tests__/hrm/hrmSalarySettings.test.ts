import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../generated/tenant';
import { MESSAGES } from '../../constants/messages';
import {
  countSalaryItemsByCategory,
  createSalaryItem,
  deleteSalaryItem,
  generateNextSalaryItemCode,
  getSalaryItemById,
  listSalaryItems,
  updateSalaryItem,
} from '../../services/client/hrm/cai_dat_luong/salaryItems.service';
import {
  getCurrentSalaryStructure,
  saveSalaryStructure,
} from '../../services/client/hrm/cai_dat_luong/salaryStructures.service';
import {
  approveEmployeeSalaries,
  countEmployeeSalaries,
  deleteEmployeeSalary,
  getEmployeeSalary,
  listEmployeeSalaries,
  setEmployeeSalary,
} from '../../services/client/hrm/cai_dat_luong/employeeSalaries.service';
import {
  createSalaryItemSchema,
  salaryItemListQuerySchema,
  updateSalaryItemSchema,
} from '../../validators/hrm/cai_dat_luong/salaryItems.validator';
import { saveSalaryStructureSchema } from '../../validators/hrm/cai_dat_luong/salaryStructures.validator';
import {
  approveSalariesSchema,
  employeeSalaryListQuerySchema,
  setEmployeeSalarySchema,
} from '../../validators/hrm/cai_dat_luong/employeeSalaries.validator';

/*
 * =============================================================================================
 * TẦNG 1: KIỂM THỬ VALIDATOR (ZOD SCHEMAS)
 * =============================================================================================
 */

test('VALIDATOR: createSalaryItemSchema kiểm tra tên và loại bắt buộc', () => {
  const invalid1 = createSalaryItemSchema.safeParse({});
  assert.equal(invalid1.success, false);

  const invalidName = createSalaryItemSchema.safeParse({
    name: '   ',
    category: 'FIXED_ALLOWANCE',
  });
  assert.equal(invalidName.success, false);

  const valid = createSalaryItemSchema.safeParse({
    name: 'Lương cơ bản',
    category: 'FIXED_ALLOWANCE',
    isSocialInsurance: true,
    isTaxable: true,
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, 'Lương cơ bản');
    assert.equal(valid.data.isSocialInsurance, true);
  }
});

test('VALIDATOR: saveSalaryStructureSchema kiểm tra ngày hiệu lực và số dòng tối thiểu', () => {
  // Rỗng items -> lỗi
  const emptyItems = saveSalaryStructureSchema.safeParse({
    effectiveFrom: '2026-01-01',
    items: [],
  });
  assert.equal(emptyItems.success, false);

  // effectiveTo < effectiveFrom -> lỗi
  const invalidDates = saveSalaryStructureSchema.safeParse({
    effectiveFrom: '2026-05-01',
    effectiveTo: '2026-04-01',
    items: [
      {
        salaryItemId: 'item-1',
        taxTreatment: 'TAXABLE',
        isOvertimeBase: true,
        calculationMethod: 'MONTHLY_FIXED',
        defaultAmount: 10000000,
      },
    ],
  });
  assert.equal(invalidDates.success, false);

  // Trùng salaryItemId -> lỗi E-sal-011
  const duplicateItems = saveSalaryStructureSchema.safeParse({
    effectiveFrom: '2026-01-01',
    items: [
      { salaryItemId: 'item-1', defaultAmount: 10000000 },
      { salaryItemId: 'item-1', defaultAmount: 20000000 },
    ],
  });
  assert.equal(duplicateItems.success, false);

  // Hợp lệ
  const valid = saveSalaryStructureSchema.safeParse({
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    note: 'Quy chế lương 2026',
    items: [
      {
        salaryItemId: 'item-1',
        taxTreatment: 'TAXABLE',
        isOvertimeBase: true,
        calculationMethod: 'MONTHLY_FIXED',
        defaultAmount: 10000000,
      },
    ],
  });
  assert.equal(valid.success, true);
});

test('VALIDATOR: setEmployeeSalarySchema hỗ trợ cả items[] và khoan{} object', () => {
  // Định dạng items[]
  const fromItems = setEmployeeSalarySchema.safeParse({
    items: [{ salaryItemId: 'item-1', amount: 5000000 }],
  });
  assert.equal(fromItems.success, true);
  if (fromItems.success) {
    assert.equal(fromItems.data.items.length, 1);
    assert.equal(fromItems.data.items[0].amount, 5000000);
  }

  // Định dạng khoan: { 'item-1': 8000000 }
  const fromKhoan = setEmployeeSalarySchema.safeParse({
    khoan: { 'item-1': 8000000, 'item-2': 1000000 },
  });
  assert.equal(fromKhoan.success, true);
  if (fromKhoan.success) {
    assert.equal(fromKhoan.data.items.length, 2);
    const sum = fromKhoan.data.items.reduce((s, it) => s + it.amount, 0);
    assert.equal(sum, 9000000);
  }

  // Tổng tiền = 0 -> lỗi E-sal-008
  const zeroTotal = setEmployeeSalarySchema.safeParse({
    items: [{ salaryItemId: 'item-1', amount: 0 }],
  });
  assert.equal(zeroTotal.success, false);
});

/*
 * =============================================================================================
 * TẦNG 2: KIỂM THỬ NGHIỆP VỤ DANH MỤC KHOẢN LƯƠNG (SALARY ITEMS)
 * =============================================================================================
 */

test('BR-sal-001: sinh mã KL01..KL99 theo thứ tự và lấp chỗ trống (gap scanning)', async () => {
  // Mock db với các mã đã dùng: KL01, KL03 (khuyết KL02)
  const mockDb = {
    salaryItem: {
      findMany: async () => [{ code: 'KL01' }, { code: 'KL03' }],
    },
  } as any;

  const nextCode = await generateNextSalaryItemCode(mockDb);
  assert.equal(nextCode, 'KL02', 'Phải lấp vào chỗ trống KL02 trước KL04');

  // Đầy từ KL01 đến KL99 -> ném lỗi giới hạn
  const allFullDb = {
    salaryItem: {
      findMany: async () =>
        Array.from({ length: 99 }, (_, i) => ({
          code: `KL${String(i + 1).padStart(2, '0')}`,
        })),
    },
  } as any;

  await assert.rejects(
    async () => generateNextSalaryItemCode(allFullDb),
    (err: any) => err.message === MESSAGES.HRM.GIOI_HAN_99_KHOAN_LUONG,
  );
});

test('BR-sal-002 (E-sal-002): chống trùng tên khoản lương trong cùng loại (case-insensitive)', async () => {
  const mockDb = {
    salaryItem: {
      findFirst: async ({ where }: any) => {
        if (
          where.category === 'FIXED_ALLOWANCE' &&
          where.name?.equals?.toLowerCase() === 'lương cơ bản'
        ) {
          return { id: 'item-1', code: 'KL01', name: 'Lương cơ bản', category: 'FIXED_ALLOWANCE' };
        }
        return null;
      },
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: 'new-id', ...data }),
    },
  } as any;

  // Trùng tên "Lương cơ bản" trong FIXED_ALLOWANCE -> ConflictError
  await assert.rejects(
    async () =>
      createSalaryItem(mockDb, {
        name: '  LƯƠNG CƠ BẢN  ',
        category: 'FIXED_ALLOWANCE',
        isSocialInsurance: true,
        isTaxable: true,
        isMealAllowance: false,
      }),
    (err: any) => err.name === 'ConflictError',
  );

  // Cùng tên nhưng ở loại khác (ví dụ BENEFIT_ALLOWANCE) -> được phép tạo thành công
  const created = await createSalaryItem(mockDb, {
    name: 'Lương cơ bản',
    category: 'BENEFIT_ALLOWANCE',
    isSocialInsurance: false,
    isTaxable: false,
    isMealAllowance: false,
  });
  assert.equal(created.name, 'Lương cơ bản');
  assert.equal(created.category, 'BENEFIT_ALLOWANCE');
  assert.equal(created.code, 'KL01');
});

test('BR-sal-004 (E-sal-003): chặn xoá khoản lương đang nằm trong cấu trúc khung hoặc nhân viên', async () => {
  // Khoản lương nằm trong cấu trúc khung
  const inStructureDb = {
    salaryItem: {
      findUnique: async () => ({ id: 'item-1', code: 'KL01', name: 'Lương cơ bản' }),
    },
    salaryStructureItem: {
      count: async () => 1,
    },
    employeeSalaryItem: {
      count: async () => 0,
    },
  } as any;

  await assert.rejects(
    async () => deleteSalaryItem(inStructureDb, 'item-1'),
    (err: any) =>
      err.name === 'BadRequestError' && err.message === MESSAGES.HRM.SALARY_ITEM_IN_USE,
  );

  // Khoản lương nằm trong bảng lương nhân viên
  const inEmployeeDb = {
    salaryItem: {
      findUnique: async () => ({ id: 'item-2', code: 'KL02', name: 'Phụ cấp cơm' }),
    },
    salaryStructureItem: {
      count: async () => 0,
    },
    employeeSalaryItem: {
      count: async () => 2,
    },
  } as any;

  await assert.rejects(
    async () => deleteSalaryItem(inEmployeeDb, 'item-2'),
    (err: any) =>
      err.name === 'BadRequestError' && err.message === MESSAGES.HRM.SALARY_ITEM_IN_USE,
  );

  // Chưa dùng ở đâu -> xoá thành công
  let deletedId = '';
  const unusedDb = {
    salaryItem: {
      findUnique: async () => ({ id: 'item-3', code: 'KL03', name: 'Khoản rác' }),
      delete: async ({ where }: any) => {
        deletedId = where.id;
      },
    },
    salaryStructureItem: { count: async () => 0 },
    employeeSalaryItem: { count: async () => 0 },
  } as any;

  await deleteSalaryItem(unusedDb, 'item-3');
  assert.equal(deletedId, 'item-3');
});

test('SALARY_ITEMS: đếm theo 7 loại danh mục và tính tổng TOTAL chính xác', async () => {
  const mockDb = {
    salaryItem: {
      groupBy: async () => [
        { category: 'FIXED_ALLOWANCE', _count: { id: 3 } },
        { category: 'BENEFIT_ALLOWANCE', _count: { id: 2 } },
        { category: 'KPI_PERFORMANCE', _count: { id: 1 } },
      ],
    },
  } as any;

  const counts = await countSalaryItemsByCategory(mockDb);
  assert.equal(counts.FIXED_ALLOWANCE, 3);
  assert.equal(counts.BENEFIT_ALLOWANCE, 2);
  assert.equal(counts.KPI_PERFORMANCE, 1);
  assert.equal(counts.COMMISSION_PERCENTAGE, 0);
  assert.equal(counts.TOTAL, 6);
});

/*
 * =============================================================================================
 * TẦNG 3: KIỂM THỬ CẤU TRÚC LƯƠNG KHUNG (SALARY STRUCTURE)
 * =============================================================================================
 */

test('SALARY_STRUCTURE: lưu cấu trúc lương khung trong transaction và map đúng định dạng FE', async () => {
  let createdStructure: any = null;
  const createdItems: any[] = [];

  const mockDb = {
    salaryItem: {
      findMany: async () => [
        { id: 'uuid-kl01', code: 'KL01', name: 'Lương chính', status: 'ACTIVE' },
        { id: 'uuid-kl02', code: 'KL02', name: 'Ăn ca', status: 'ACTIVE' },
      ],
    },
    $transaction: async (fn: any) => {
      const tx = {
        // Khóa advisory của `saveSalaryStructure` (mọi lượt lưu cơ cấu chạy lần lượt) — ở đây chỉ 1 lượt.
        $executeRaw: async () => 1,
        salaryStructure: {
          findFirst: async () => null, // chưa có -> tạo mới
          create: async ({ data }: any) => {
            createdStructure = { id: 'struct-1', ...data };
            return createdStructure;
          },
          findUnique: async () => ({
            ...createdStructure,
            items: createdItems.map((ci) => ({
              ...ci,
              salaryItem: {
                id: ci.salaryItemId,
                code: ci.salaryItemId === 'uuid-kl01' ? 'KL01' : 'KL02',
                name: ci.salaryItemId === 'uuid-kl01' ? 'Lương chính' : 'Ăn ca',
                category: 'FIXED_ALLOWANCE',
                isSocialInsurance: true,
                isTaxable: true,
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })),
          }),
        },
        salaryStructureItem: {
          createMany: async ({ data }: any) => {
            for (const row of data) {
              createdItems.push({ id: `si-${createdItems.length + 1}`, ...row });
            }
          },
        },
      };
      return await fn(tx);
    },
  } as any;

  const saved = await saveSalaryStructure(mockDb, {
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    note: 'Chính sách lương mới',
    items: [
      {
        salaryItemId: 'KL01', // hỗ trợ truyền code KL01
        taxTreatment: 'TAXABLE',
        isOvertimeBase: true,
        calculationMethod: 'MONTHLY_FIXED',
        defaultAmount: 15000000,
      },
      {
        salaryItemId: 'uuid-kl02', // hỗ trợ truyền UUID
        taxTreatment: 'EXEMPT',
        isOvertimeBase: false,
        calculationMethod: 'ACTUAL_WORKDAYS',
        defaultAmount: 730000,
      },
    ],
  });

  assert.ok(saved);
  assert.equal(saved.tu_ngay, '2026-01-01');
  assert.equal(saved.den_ngay, '2026-12-31');
  assert.equal(saved.dong.length, 2);
  assert.equal(saved.dong[0].ma_khoan, 'KL01');
  assert.equal(saved.dong[0].so_tien, 15000000);
  assert.equal(saved.dong[0].phan_loai, 'tncn');
  assert.equal(saved.dong[1].ma_khoan, 'KL02');
  assert.equal(saved.dong[1].so_tien, 730000);
  assert.equal(saved.dong[1].phan_loai, 'mien_thue');
});

/*
 * =============================================================================================
 * TẦNG 4: KIỂM THỬ THIẾT LẬP LƯƠNG NHÂN VIÊN (EMPLOYEE SALARIES)
 * =============================================================================================
 */

test('BR-sal-008 (E-sal-009): chặn set lương cho nhân viên KHÔNG có Hợp đồng hiệu lực hiện tại', async () => {
  const mockDb = {
    hrm_nhan_vien: {
      findFirst: async () => ({ ma_nv: 'NV0001', ho_ten: 'Nguyễn Văn A', da_xoa: false }),
    },
    // Không tìm thấy hợp đồng nào còn hạn
    hrm_hop_dong: {
      findFirst: async () => null,
    },
    // Tải song song với nhân viên (không dùng tới vì hàm chặn ở bước hợp đồng trước) — vẫn phải
    // có mặt để không vỡ do gọi `.findFirst` trên `undefined`.
    salaryStructure: {
      findFirst: async () => null,
    },
  } as any;

  await assert.rejects(
    async () =>
      setEmployeeSalary(mockDb, 'NV0001', {
        items: [{ salaryItemId: 'item-1', amount: 10000000 }],
      }),
    (err: any) =>
      err.name === 'BadRequestError' &&
      err.message === MESSAGES.HRM.SALARY_EMPLOYEE_NO_ACTIVE_CONTRACT,
  );
});

test('BR-sal-005 (E-sal-010): chặn gán khoản lương KHÔNG thuộc cấu trúc khung hiện hành', async () => {
  const now = new Date();
  const mockDb = {
    hrm_nhan_vien: {
      findFirst: async () => ({ ma_nv: 'NV0001', ho_ten: 'Nguyễn Văn A', da_xoa: false }),
    },
    hrm_hop_dong: {
      findFirst: async () => ({
        id: 'hd-1',
        ma_nv: 'NV0001',
        ngay_bat_dau: new Date('2025-01-01'),
        ngay_ket_thuc: null,
      }),
    },
    salaryStructure: {
      findFirst: async () => ({
        id: 'struct-1',
        isActive: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        items: [
          {
            salaryItemId: 'uuid-kl01',
            salaryItem: { id: 'uuid-kl01', code: 'KL01', name: 'Lương cơ bản' },
          },
        ],
      }),
    },
    salaryItem: {
      findFirst: async () => ({ id: 'uuid-kl99', code: 'KL99', name: 'Khoản lạ ngoài khung' }),
    },
  } as any;

  await assert.rejects(
    async () =>
      setEmployeeSalary(mockDb, 'NV0001', {
        items: [{ salaryItemId: 'KL99', amount: 5000000 }],
      }),
    (err: any) =>
      err.name === 'BadRequestError' &&
      err.message.includes('không thuộc cấu trúc lương khung hiện hành'),
  );
});

test('EMPLOYEE_SALARY: set lương thành công tăng setupVersion, chuyển PENDING_APPROVAL và reset người duyệt', async () => {
  const now = new Date();
  let existingSalary: any = {
    id: 'salary-1',
    ma_nv: 'NV0001',
    setupVersion: 2,
    status: 'APPROVED',
    approvedByUserId: 'user-admin',
    approvedAt: new Date(),
    totalAmount: new Prisma.Decimal(12000000),
  };

  const mockDb = {
    hrm_nhan_vien: {
      findFirst: async () => ({ ma_nv: 'NV0001', ho_ten: 'Trần Văn B', da_xoa: false }),
    },
    hrm_hop_dong: {
      findFirst: async () => ({
        id: 'hd-1',
        ma_nv: 'NV0001',
        ngay_bat_dau: new Date('2025-01-01'),
        ngay_ket_thuc: null,
      }),
    },
    salaryStructure: {
      findFirst: async () => ({
        id: 'struct-1',
        isActive: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        items: [
          {
            salaryItemId: 'uuid-kl01',
            salaryItem: { id: 'uuid-kl01', code: 'KL01', name: 'Lương cơ bản' },
          },
          {
            salaryItemId: 'uuid-kl02',
            salaryItem: { id: 'uuid-kl02', code: 'KL02', name: 'Ăn trưa' },
          },
        ],
      }),
    },
    $transaction: async (fn: any) => {
      const tx = {
        employeeSalary: {
          findUnique: async () => ({
            ...existingSalary,
            items: [
              {
                id: 'esi-1',
                salaryItemId: 'uuid-kl01',
                amount: new Prisma.Decimal(18000000),
                salaryItem: { code: 'KL01', name: 'Lương cơ bản' },
              },
              {
                id: 'esi-2',
                salaryItemId: 'uuid-kl02',
                amount: new Prisma.Decimal(1000000),
                salaryItem: { code: 'KL02', name: 'Ăn trưa' },
              },
            ],
          }),
          // Như Prisma: `{ increment }` cộng vào giá trị đang lưu (service tăng setupVersion nguyên tử).
          update: async ({ data }: any) => {
            const v = data.setupVersion;
            existingSalary = {
              ...existingSalary,
              ...data,
              setupVersion:
                v && typeof v === 'object' ? existingSalary.setupVersion + v.increment : (v ?? existingSalary.setupVersion),
            };
            return existingSalary;
          },
        },
        employeeSalaryItem: {
          deleteMany: async () => {},
          createMany: async () => {},
        },
      };
      return await fn(tx);
    },
  } as any;

  const result = await setEmployeeSalary(
    mockDb,
    'NV0001',
    {
      items: [
        { salaryItemId: 'KL01', amount: 18000000 },
        { salaryItemId: 'KL02', amount: 1000000 },
      ],
    },
    'user-editor',
  );

  assert.equal(result.lan_thiet_lap, 3, 'setupVersion phải tăng từ 2 lên 3');
  assert.equal(result.status, 'PENDING_APPROVAL', 'Trạng thái phải lùi về PENDING_APPROVAL');
  assert.equal(result.trang_thai, 'pending_approval');
  assert.equal(result.tong_luong, 19000000);
  assert.equal(result.approvedByUserId, null, 'Phải reset người duyệt');
});

test('EMPLOYEE_SALARY: duyệt lương hàng loạt (approve) cập nhật APPROVED kèm ngày và người duyệt', async () => {
  let updatedData: any = null;
  const mockDb = {
    employeeSalary: {
      findMany: async () => [{ id: 's1', ma_nv: 'NV0001' }, { id: 's2', ma_nv: 'NV0002' }],
      updateMany: async ({ data }: any) => {
        updatedData = data;
        return { count: 2 };
      },
    },
  } as any;

  const res = await approveEmployeeSalaries(
    mockDb,
    {
      items: [
        { employeeId: 'NV0001', setupVersion: 1 },
        { employeeId: 'NV0002', setupVersion: 1 },
      ],
    },
    'approver-123',
  );
  assert.equal(res.approvedCount, 2);
  assert.equal(updatedData.status, 'APPROVED');
  assert.equal(updatedData.approvedByUserId, 'approver-123');
  assert.ok(updatedData.approvedAt instanceof Date);
});

test('EMPLOYEE_SALARY: đếm đã set và chưa set lương đúng số lượng nhân viên đang làm việc', async () => {
  const mockDb = {
    hrm_nhan_vien: {
      findMany: async () => [
        { ma_nv: 'NV0001' },
        { ma_nv: 'NV0002' },
        { ma_nv: 'NV0003' },
      ],
    },
    employeeSalary: {
      findMany: async () => [{ ma_nv: 'NV0001' }],
    },
  } as any;

  const counts = await countEmployeeSalaries(mockDb);
  assert.equal(counts.totalActiveEmployees, 3);
  assert.equal(counts.daSet, 1);
  assert.equal(counts.chuaSet, 2);
  assert.equal(counts.hasSalary, 1);
  assert.equal(counts.missingSalary, 2);
});

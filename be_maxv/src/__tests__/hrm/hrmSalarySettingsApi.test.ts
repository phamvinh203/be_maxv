import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { Prisma } from '../../generated/tenant';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';
import { ForbiddenError } from '../../helpers/errors';

/**
 * KIỂM THỬ TÍCH HỢP HTTP (Fastify Inject)
 * Kiểm tra các endpoint RESTful của cụm Cài đặt lương:
 * - /salary-items
 * - /salary-structures
 * - /employee-salaries
 *
 * Route/controller THẬT (không tự dựng lại logic điều hướng), chỉ thay `resolveTenantDb` bằng
 * bản trả thẳng mock DB qua `node:test` `mock.module()` (cần cờ `--experimental-test-module-mocks`
 * — đã bật sẵn trong script `test` của package.json). KHÔNG đụng gì tới `helpers/resolveTenantDb.ts`
 * — file đó là chỗ hơn chục controller khác trong app cùng dùng, không được biết gì về test.
 *
 * `mock.module()` phải chạy TRƯỚC khi bất kỳ file nào `import` các route — import tĩnh ở đầu file
 * sẽ nạp bản `resolveTenantDb` THẬT trước khi `before()` kịp chạy, nên các route module được
 * `import()` động bên trong `before()`, sau khi mock đã cài xong.
 */

let hrmSalaryItemsRoutes: typeof import('../../routes/hrm/cai_dat_luong/salaryItems.route').hrmSalaryItemsRoutes;
let hrmSalaryStructuresRoutes: typeof import('../../routes/hrm/cai_dat_luong/salaryStructures.route').hrmSalaryStructuresRoutes;
let hrmEmployeeSalariesRoutes: typeof import('../../routes/hrm/cai_dat_luong/employeeSalaries.route').hrmEmployeeSalariesRoutes;

/** Đọc bởi bản mock của `resolveTenantDb` — mỗi `buildTestApp()` trỏ lại biến này về db riêng của nó. */
let dbChoRequestHienTai: unknown;

// BR-hrm-059: cờ quyền xem lương mô phỏng cho `resolveTenantCtx` mock (cùng khuôn A-01 của
// `hrmPayrollInputData.test.ts`) — mọi test mặc định `true`, test kiểm chứng guard tự đặt `false`
// rồi phải trả lại `true`.
let xemLuongChoRequestHienTai = true;

// RVW-018 (review-findings.md 2026-09-10) — spy cho `writeLog` (services/shared/syslog.service),
// cùng khuôn với `hrmPayrollInputData.test.ts` "Bug#8": tránh gọi `sysPrisma` thật (control plane)
// trong test, vừa cho phép assert đúng hành động đã ghi.
let ghiNhatKyKhoanLuongCalls: Array<{
  hanhDong: string;
  userId?: string;
  donViId?: string;
  chiTiet?: Record<string, unknown>;
}> = [];

before(async () => {
  mock.module('../../helpers/resolveTenantDb', {
    // `exports` (tên mới) chưa có trong @types/node@22 đang cài — dùng `namedExports` (deprecated ở
    // runtime Node 24 nhưng vẫn hoạt động đúng) để qua tsc mà không phải ép kiểu.
    namedExports: {
      resolveTenantDb: async () => dbChoRequestHienTai,
      resolveTenantCtx: async () => ({
        db: dbChoRequestHienTai,
        dbName: 'test-db',
        maSoThue: '0000000000',
        xemLuong: xemLuongChoRequestHienTai,
      }),
      assertXemLuong: (ctx: { xemLuong: boolean }) => {
        if (!ctx.xemLuong) {
          throw new ForbiddenError('Không có quyền xem dữ liệu lương.');
        }
      },
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: {
      writeLog: async (input: { hanhDong: string; userId?: string; donViId?: string; chiTiet?: Record<string, unknown> }) => {
        ghiNhatKyKhoanLuongCalls.push(input);
      },
    },
  });
  ({ hrmSalaryItemsRoutes } = await import('../../routes/hrm/cai_dat_luong/salaryItems.route'));
  ({ hrmSalaryStructuresRoutes } = await import(
    '../../routes/hrm/cai_dat_luong/salaryStructures.route'
  ));
  ({ hrmEmployeeSalariesRoutes } = await import(
    '../../routes/hrm/cai_dat_luong/employeeSalaries.route'
  ));
});

function createMockTenantDb() {
  const salaryItems: any[] = [
    {
      id: 'uuid-kl01',
      code: 'KL01',
      name: 'Lương cơ bản',
      category: 'FIXED_ALLOWANCE',
      description: 'Lương ghi trên HĐLĐ',
      isSocialInsurance: true,
      isTaxable: true,
      defaultRate: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'uuid-kl02',
      code: 'KL02',
      name: 'Phụ cấp ăn trưa',
      category: 'BENEFIT_ALLOWANCE',
      description: 'Tiền cơm trưa',
      isSocialInsurance: false,
      isTaxable: false,
      defaultRate: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  let currentStructure: any = {
    id: 'struct-1',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    note: 'Cấu trúc lương chuẩn 2026',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'si-1',
        salaryStructureId: 'struct-1',
        salaryItemId: 'uuid-kl01',
        taxTreatment: 'TAXABLE',
        isOvertimeBase: true,
        calculationMethod: 'MONTHLY_FIXED',
        defaultAmount: new Prisma.Decimal(10000000),
        salaryItem: salaryItems[0],
      },
      {
        id: 'si-2',
        salaryStructureId: 'struct-1',
        salaryItemId: 'uuid-kl02',
        taxTreatment: 'EXEMPT',
        isOvertimeBase: false,
        calculationMethod: 'ACTUAL_WORKDAYS',
        defaultAmount: new Prisma.Decimal(730000),
        salaryItem: salaryItems[1],
      },
    ],
  };

  const employees: any[] = [
    {
      ma_nv: 'NV0001',
      ho_ten: 'Nguyễn Văn An',
      chuc_vu: 'Lập trình viên',
      ma_pb: 'PB01',
      so_tai_khoan: '19033888999',
      status: '1',
      da_xoa: false,
      hop_dong: [
        {
          id: 'hd-1',
          ma_nv: 'NV0001',
          so_hd: 'HĐ01',
          loai_hd: 'xac_dinh',
          ngay_bat_dau: new Date('2025-01-01'),
          ngay_ket_thuc: null,
        },
      ],
      luong_thiet_lap: null,
    },
  ];

  const employeeSalaries: Map<string, any> = new Map();

  const mockDb = {
    salaryItem: {
      findMany: async ({ where }: any = {}) => {
        let list = [...salaryItems];
        if (where?.category) {
          list = list.filter((i) => i.category === where.category);
        }
        if (where?.status) {
          list = list.filter((i) => i.status === where.status);
        }
        return list;
      },
      findFirst: async ({ where }: any) => {
        if (where?.OR) {
          const conditions = where.OR;
          return (
            salaryItems.find((i) =>
              conditions.some(
                (c: any) =>
                  (c.id && i.id === c.id) ||
                  (c.code && i.code.toLowerCase() === c.code.toLowerCase()),
              ),
            ) ?? null
          );
        }
        if (where?.category && where?.name?.equals) {
          const targetName = where.name.equals.toLowerCase();
          return (
            salaryItems.find(
              (i) =>
                i.category === where.category &&
                i.name.toLowerCase() === targetName &&
                (!where.id?.not || i.id !== where.id.not),
            ) ?? null
          );
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        return salaryItems.find((i) => i.id === where.id || i.code === where.code) ?? null;
      },
      create: async ({ data }: any) => {
        const item = {
          id: `uuid-${data.code.toLowerCase()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        salaryItems.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = salaryItems.findIndex((i) => i.id === where.id);
        if (idx >= 0) {
          salaryItems[idx] = { ...salaryItems[idx], ...data, updatedAt: new Date() };
          return salaryItems[idx];
        }
        return null;
      },
      delete: async ({ where }: any) => {
        const idx = salaryItems.findIndex((i) => i.id === where.id);
        if (idx >= 0) salaryItems.splice(idx, 1);
      },
      groupBy: async () => {
        const map = new Map<string, number>();
        for (const it of salaryItems) {
          map.set(it.category, (map.get(it.category) ?? 0) + 1);
        }
        return Array.from(map.entries()).map(([category, count]) => ({
          category,
          _count: { id: count },
        }));
      },
    },
    salaryStructure: {
      findFirst: async () => currentStructure,
      findUnique: async () => currentStructure,
      update: async ({ data }: any) => {
        currentStructure = { ...currentStructure, ...data };
        return currentStructure;
      },
    },
    salaryStructureItem: {
      count: async () => 0,
      deleteMany: async () => {},
      createMany: async () => {},
    },
    hrm_nhan_vien: {
      findMany: async () => {
        return employees.map((nv) => ({
          ...nv,
          luong_thiet_lap: employeeSalaries.get(nv.ma_nv) ?? null,
        }));
      },
      findFirst: async ({ where }: any) => {
        return employees.find((nv) => nv.ma_nv === where.ma_nv && !nv.da_xoa) ?? null;
      },
    },
    hrm_phong_ban: {
      findMany: async () => [{ ma_pb: 'PB01', ten_pb: 'Phòng Kỹ thuật' }],
    },
    hrm_hop_dong: {
      findFirst: async ({ where }: any) => {
        const nv = employees.find((e) => e.ma_nv === where.ma_nv);
        return nv?.hop_dong[0] ?? null;
      },
    },
    employeeSalary: {
      findMany: async () => Array.from(employeeSalaries.values()),
      findUnique: async ({ where }: any) => employeeSalaries.get(where.ma_nv) ?? null,
      delete: async ({ where }: any) => {
        for (const [k, v] of employeeSalaries.entries()) {
          if (v.id === where.id || v.ma_nv === where.ma_nv) {
            employeeSalaries.delete(k);
          }
        }
      },
      updateMany: async ({ data }: any) => {
        for (const v of employeeSalaries.values()) {
          Object.assign(v, data);
        }
        return { count: employeeSalaries.size };
      },
    },
    employeeSalaryItem: {
      count: async () => 0,
      deleteMany: async () => {},
      createMany: async () => {},
    },
    $transaction: async (fn: any) => {
      const tx = {
        // Khóa advisory của `saveSalaryStructure` (mọi lượt lưu cơ cấu chạy lần lượt).
        $executeRaw: async () => 1,
        // Lưu cấu trúc lương (`saveSalaryStructure`) chạy trong transaction — dùng chung kho mock ở trên.
        salaryStructure: mockDb.salaryStructure,
        salaryStructureItem: mockDb.salaryStructureItem,
        employeeSalary: {
          findUnique: async ({ where }: any) => {
            let found = null;
            if (where.ma_nv) found = employeeSalaries.get(where.ma_nv) ?? null;
            if (!found && where.id) {
              for (const v of employeeSalaries.values()) {
                if (v.id === where.id) {
                  found = v;
                  break;
                }
              }
            }
            if (!found) return null;
            return {
              ...found,
              items: [
                {
                  id: 'esi-1',
                  salaryItemId: 'uuid-kl01',
                  amount: new Prisma.Decimal(12000000),
                  salaryItem: salaryItems[0],
                },
              ],
            };
          },
          create: async ({ data }: any) => {
            const item = { id: `sal-${Date.now()}`, ...data };
            employeeSalaries.set(data.ma_nv, item);
            return item;
          },
          update: async ({ where, data }: any) => {
            const cur = employeeSalaries.get(where.ma_nv) ?? {};
            const updated = { ...cur, ...data };
            employeeSalaries.set(where.ma_nv, updated);
            return updated;
          },
        },
        employeeSalaryItem: {
          deleteMany: async () => {},
          createMany: async () => {},
        },
      };
      return await fn(tx);
    },
  };

  return mockDb;
}

// RVW-018 — role tham số hóa để test được cả 403 (OWNER_EMPLOYEE) lẫn 2xx (ADMIN/OWNER) cho 3
// route ghi của `/salary-items`. Mặc định giữ nguyên `ADMIN` để không phá vỡ các test HTTP có sẵn.
async function buildTestApp(role: string = 'ADMIN') {
  const app = Fastify();
  dbChoRequestHienTai = createMockTenantDb();

  app.addHook('onRequest', async (req) => {
    (req as any).user = {
      userId: 'user-admin-1',
      donViId: 'dv-1',
      role,
      tokenVersion: 1,
    };
  });

  // RVW-018 — cần đăng ký để `ForbiddenError` (assertAdminOrOwner) ánh xạ đúng 403 thay vì rơi
  // vào nhánh 500 mặc định của Fastify (AppError không có `statusCode` riêng).
  await app.register(errorHandlerPlugin);
  await app.register(hrmSalaryItemsRoutes);
  await app.register(hrmSalaryStructuresRoutes);
  await app.register(hrmEmployeeSalariesRoutes);

  await app.ready();
  return app;
}

/*
 * =============================================================================================
 * HTTP TESTS: /salary-items
 * =============================================================================================
 */

test('HTTP GET /salary-items: trả về 200 và danh sách khoản lương', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'GET',
    url: '/salary-items',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].code, 'KL01');
  assert.equal(body.data[0].ma_khoan, 'KL01');
});

test('HTTP GET /salary-items/count-by-category: trả về 200 và đếm đủ 7 loại + TOTAL', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'GET',
    url: '/salary-items/count-by-category',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.FIXED_ALLOWANCE, 1);
  assert.equal(body.data.BENEFIT_ALLOWANCE, 1);
  assert.equal(body.data.TOTAL, 2);
});

test('HTTP POST /salary-items: tạo mới thành công trả về 201 Created', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/salary-items',
    payload: {
      name: 'Lương hiệu quả công việc KPI',
      category: 'KPI_PERFORMANCE',
      description: 'Đánh giá cuối quý',
      isSocialInsurance: false,
      isTaxable: true,
    },
  });

  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.name, 'Lương hiệu quả công việc KPI');
  assert.equal(body.data.category, 'KPI_PERFORMANCE');
  assert.equal(body.data.code, 'KL03');
  assert.equal(body.data.ma_khoan, 'KL03');
});

test('HTTP PATCH /salary-items/:id: cập nhật thành công trả về 200 OK', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'PATCH',
    url: '/salary-items/uuid-kl01',
    payload: {
      description: 'Mô tả đã sửa',
    },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.description, 'Mô tả đã sửa');
});

test('ADR-010 QĐ-4: POST /salary-items nhận isMealAllowance, mặc định false khi không gửi', async () => {
  const app = await buildTestApp();

  const resDefault = await app.inject({
    method: 'POST',
    url: '/salary-items',
    payload: {
      name: 'Phụ cấp xăng xe',
      category: 'FIXED_ALLOWANCE',
      isSocialInsurance: false,
      isTaxable: true,
    },
  });
  assert.equal(resDefault.statusCode, 201);
  assert.equal(resDefault.json().data.isMealAllowance, false);

  const resMeal = await app.inject({
    method: 'POST',
    url: '/salary-items',
    payload: {
      name: 'Phụ cấp tiền cơm',
      category: 'BENEFIT_ALLOWANCE',
      isSocialInsurance: false,
      isTaxable: false,
      isMealAllowance: true,
    },
  });
  assert.equal(resMeal.statusCode, 201);
  assert.equal(resMeal.json().data.isMealAllowance, true);
});

test('ADR-010 QĐ-4: PATCH /salary-items/:id cập nhật isMealAllowance', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'PATCH',
    url: '/salary-items/uuid-kl02',
    payload: { isMealAllowance: true },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.isMealAllowance, true);
});

test('HTTP DELETE /salary-items/:id: xóa thành công trả về 200 OK', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'DELETE',
    url: '/salary-items/uuid-kl02',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
});

test('RVW-018: POST/PATCH/DELETE /salary-items chặn role không phải ADMIN/OWNER, và ghi audit log khi thành công', async () => {
  // Từ ADR-010, isTaxable/isMealAllowance quyết định trực tiếp thuế TNCN của toàn công ty — 3
  // route ghi phải yêu cầu assertAdminOrOwner (403 cho OWNER_EMPLOYEE) và ghi writeLog khi thành
  // công (trước đây review-findings.md RVW-018 ghi nhận CẢ HAI đều thiếu).
  // Reset spy TRƯỚC CẢ phần denied — các test HTTP trước đó trong file này (role mặc định ADMIN)
  // cũng đã kích hoạt writeLog thật, mảng spy dùng chung cấp module nên phải dọn sạch ở đây.
  ghiNhatKyKhoanLuongCalls = [];
  const appDenied = await buildTestApp('OWNER_EMPLOYEE');

  const resCreateDenied = await appDenied.inject({
    method: 'POST',
    url: '/salary-items',
    payload: { name: 'Phụ cấp bị chặn', category: 'FIXED_ALLOWANCE', isSocialInsurance: false, isTaxable: true },
  });
  assert.equal(resCreateDenied.statusCode, 403);

  const resUpdateDenied = await appDenied.inject({
    method: 'PATCH',
    url: '/salary-items/uuid-kl01',
    payload: { isTaxable: false },
  });
  assert.equal(resUpdateDenied.statusCode, 403);

  const resDeleteDenied = await appDenied.inject({
    method: 'DELETE',
    url: '/salary-items/uuid-kl02',
  });
  assert.equal(resDeleteDenied.statusCode, 403);

  assert.equal(ghiNhatKyKhoanLuongCalls.length, 0, 'không ghi audit log khi bị chặn 403');

  // OWNER làm được cả 3 thao tác + audit log ghi đúng hành động và khóa nghiệp vụ (ma_khoan).
  ghiNhatKyKhoanLuongCalls = [];
  const appAllowed = await buildTestApp('OWNER');

  const resCreateOk = await appAllowed.inject({
    method: 'POST',
    url: '/salary-items',
    payload: { name: 'Phụ cấp OWNER tạo', category: 'FIXED_ALLOWANCE', isSocialInsurance: false, isTaxable: true },
  });
  assert.equal(resCreateOk.statusCode, 201);
  const createdCode = resCreateOk.json().data.ma_khoan;

  const resUpdateOk = await appAllowed.inject({
    method: 'PATCH',
    url: '/salary-items/uuid-kl01',
    payload: { isTaxable: false },
  });
  assert.equal(resUpdateOk.statusCode, 200);

  const resDeleteOk = await appAllowed.inject({
    method: 'DELETE',
    url: '/salary-items/uuid-kl02',
  });
  assert.equal(resDeleteOk.statusCode, 200);

  assert.equal(ghiNhatKyKhoanLuongCalls.length, 3);
  assert.ok(ghiNhatKyKhoanLuongCalls.some((c) => c.hanhDong === 'HRM_CREATE_SALARY_ITEM' && c.chiTiet?.khoaNghiepVu === createdCode));
  assert.ok(ghiNhatKyKhoanLuongCalls.some((c) => c.hanhDong === 'HRM_UPDATE_SALARY_ITEM' && c.chiTiet?.khoaNghiepVu === 'KL01'));
  assert.ok(ghiNhatKyKhoanLuongCalls.some((c) => c.hanhDong === 'HRM_DELETE_SALARY_ITEM' && c.chiTiet?.khoaNghiepVu === 'KL02'));
  assert.ok(ghiNhatKyKhoanLuongCalls.every((c) => c.userId === 'user-admin-1'));
});

/*
 * =============================================================================================
 * HTTP TESTS: /salary-structures
 * =============================================================================================
 */

test('HTTP GET /salary-structures/current: trả về 200 và cấu trúc khung', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'GET',
    url: '/salary-structures/current',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.tu_ngay, '2026-01-01');
  assert.ok(Array.isArray(body.data.dong));
  assert.equal(body.data.dong.length, 2);
});

/*
 * =============================================================================================
 * HTTP TESTS: /employee-salaries
 * =============================================================================================
 */

test('HTTP GET /employee-salaries: danh sách nhân viên kèm tình trạng set lương', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'GET',
    url: '/employee-salaries?hasSalary=false',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].ma_nv, 'NV0001');
  assert.equal(body.data[0].daSet, false);
});

test('HTTP GET /employee-salaries/counts: đếm số lượng đã set và chưa set lương', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'GET',
    url: '/employee-salaries/counts',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.totalActiveEmployees, 1);
  assert.equal(body.data.daSet, 0);
  assert.equal(body.data.chuaSet, 1);
});

test('HTTP PUT /employee-salaries/:employeeId: set lương thành công trả về 200', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'PUT',
    url: '/employee-salaries/NV0001',
    payload: {
      items: [{ salaryItemId: 'KL01', amount: 12000000 }],
    },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.employeeId, 'NV0001');
  assert.equal(body.data.status, 'PENDING_APPROVAL');
  assert.equal(body.data.lan_thiet_lap, 1);
});

test('HTTP POST /employee-salaries/approve: duyệt lương trả về 200 OK', async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: 'POST',
    url: '/employee-salaries/approve',
    payload: { items: [{ employeeId: 'NV0001', setupVersion: 1 }] },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.message.includes('duyệt'));

  // Không còn "bỏ trống = duyệt tất cả" (vbsec #39/#40): phải gửi đúng các bản đã xem kèm phiên bản.
  const rong = await app.inject({ method: 'POST', url: '/employee-salaries/approve', payload: {} });
  assert.equal(rong.statusCode, 400);
});

test('Duyệt set lương chỉ OWNER/ADMIN: nhân viên CÓ quyền xem lương vẫn bị chặn 403, không tự duyệt lương mình vừa đặt', async () => {
  // Quyết định 2026-09-10 (vbsec, phần treo từ lỗi CAO [2][3]): `xemLuong` cho phép đọc + đặt lương,
  // nhưng DUYỆT là bước kiểm soát — người đặt không được tự duyệt. Cùng guard với duyệt / khóa sổ kỳ
  // lương (`payrollPeriods.route.ts`) và lưu cấu trúc lương.
  const appNv = await buildTestApp('OWNER_EMPLOYEE');
  const dat = await appNv.inject({
    method: 'PUT',
    url: '/employee-salaries/NV0001',
    payload: { items: [{ salaryItemId: 'KL01', amount: 90000000 }] },
  });
  assert.equal(dat.statusCode, 200);

  const duyet = await appNv.inject({
    method: 'POST',
    url: '/employee-salaries/approve',
    payload: { items: [{ employeeId: 'NV0001', setupVersion: 1 }] },
  });
  assert.equal(duyet.statusCode, 403);
  const ds = await appNv.inject({ method: 'GET', url: '/employee-salaries?hasSalary=true' });
  const nv = ds.json().data.find((r: { ma_nv: string }) => r.ma_nv === 'NV0001');
  assert.notEqual(nv?.status, 'APPROVED');

  const appOwner = await buildTestApp('OWNER');
  const duyetOwner = await appOwner.inject({
    method: 'POST',
    url: '/employee-salaries/approve',
    payload: { items: [{ employeeId: 'NV0001', setupVersion: 1 }] },
  });
  assert.equal(duyetOwner.statusCode, 200);
});

test('BR-hrm-059: cả nhóm /employee-salaries trả 403 khi thiếu quyền xem lương, và không ghi được gì', async () => {
  // Trước khi sửa (vbsec 2026-09-10): controller gọi `resolveTenantDb` trơn nên OWNER_EMPLOYEE bị tắt
  // cờ `xemLuong` vẫn đọc được lương + số tài khoản của cả công ty, tự đặt lương rồi tự duyệt.
  const app = await buildTestApp('OWNER_EMPLOYEE');

  xemLuongChoRequestHienTai = false;
  try {
    const cacLuotGoi = [
      { method: 'GET', url: '/employee-salaries' },
      { method: 'GET', url: '/employee-salaries/counts' },
      { method: 'GET', url: '/employee-salaries/NV0001' },
      {
        method: 'PUT',
        url: '/employee-salaries/NV0001',
        payload: { items: [{ salaryItemId: 'KL01', amount: 90000000 }] },
      },
      { method: 'DELETE', url: '/employee-salaries/NV0001' },
      {
        method: 'POST',
        url: '/employee-salaries/approve',
        payload: { items: [{ employeeId: 'NV0001', setupVersion: 1 }] },
      },
    ] as const;

    for (const luot of cacLuotGoi) {
      const res = await app.inject(luot);
      assert.equal(res.statusCode, 403, `${luot.method} ${luot.url} phải bị chặn 403`);
    }
  } finally {
    xemLuongChoRequestHienTai = true; // KHÔNG để rò rỉ sang các test sau
  }

  // Lượt PUT bị chặn ở trên không được để lại bản set lương nào.
  const resSau = await app.inject({ method: 'GET', url: '/employee-salaries?hasSalary=false' });
  assert.equal(resSau.statusCode, 200);
  const nv = resSau.json().data.find((r: { ma_nv: string }) => r.ma_nv === 'NV0001');
  assert.equal(nv.daSet, false);
});

test('Cấu trúc lương: PUT /salary-structures/current chặn OWNER_EMPLOYEE (403), không đổi cấu trúc; OWNER lưu được', async () => {
  // `taxTreatment: 'EXEMPT'` biến một khoản thành miễn thuế TNCN cho cả công ty — cùng mức nhạy cảm
  // với `isTaxable` của /salary-items (RVW-018) nên phải cùng guard `assertAdminOrOwner`.
  const payload = {
    effectiveFrom: '2026-01-01',
    note: 'Đổi lương cơ bản thành miễn thuế',
    items: [{ salaryItemId: 'KL01', taxTreatment: 'EXEMPT' }],
  };

  const appDenied = await buildTestApp('OWNER_EMPLOYEE');
  const resDenied = await appDenied.inject({ method: 'PUT', url: '/salary-structures/current', payload });
  assert.equal(resDenied.statusCode, 403);

  const resSauKhiChan = await appDenied.inject({ method: 'GET', url: '/salary-structures/current' });
  assert.equal(resSauKhiChan.json().data.ghi_chu, 'Cấu trúc lương chuẩn 2026');

  const appAllowed = await buildTestApp('OWNER');
  const resOk = await appAllowed.inject({ method: 'PUT', url: '/salary-structures/current', payload });
  assert.equal(resOk.statusCode, 200);
  assert.equal(resOk.json().data.ghi_chu, 'Đổi lương cơ bản thành miễn thuế');
});

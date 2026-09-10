/**
 * KIỂM THỬ TÍCH HỢP HTTP (app.inject) — cụm 3 thực thể HRM:
 *   Cấu hình mặc định · Ca làm việc · Lịch ngày lễ
 *
 * Bộ ca: TC-hrm-273 … TC-hrm-327 (docs/hrm/qa/test-cases.md Mục 7).
 *
 *   npx tsx --test src/__tests__/hrmSettingsShiftsHolidaysApi.test.ts
 *
 * ĐẶC ĐIỂM (khác hẳn bộ `hrmSettingsShiftsHolidays.test.ts` — bộ đó là unit test hàm thuần):
 *   • Gọi HTTP THẬT trong tiến trình bằng `app.inject()` — đi trọn vòng plugin → hook auth →
 *     `requireModule('hrm')` → controller → validator → service → Postgres → errorHandler.
 *   • Tự cấp **hai DB tenant riêng** (`maxv_9970000001_app`, `maxv_9970000002_app`) rồi DROP hẳn
 *     lúc dọn. KHÔNG ghi một dòng nào vào DB tenant thật của chủ dự án.
 *   • Xác thực bằng đúng đường của sản phẩm: `POST /auth/login` → cookie `accessToken` httpOnly →
 *     `POST /companies/:id/switch` để nhúng `donViId`. Không tự ký JWT tay.
 *
 * DỌN DẸP: `cleanup()` chạy CẢ ở `before` lẫn `after` — lần chạy trước có sập giữa chừng thì lần
 * sau vẫn khởi động sạch.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { sysPrisma } from '../../config/db.sys';
import { hashPassword } from '../../utils/password';
import { tenantSlug, tenantDbName } from '../../utils/dbName';
import { provisionTenant, dropTenant } from '../../services/shared/provisioning.service';
import { getTenantDb } from '../../helpers/tenantClient';

// ---------------------------------------------------------------- dữ liệu cố định của bộ test

const PW = 'QaHrm1234';
const OWNER_EMAIL = 'qa.hrm.owner@test.local';
const STAFF_EMAIL = 'qa.hrm.staff@test.local';
const MST_A = '9970000001';
const MST_B = '9970000002';
const PLAN_MA = 'QA_HRM_PLAN';
const DB_A = tenantDbName(MST_A);
const DB_B = tenantDbName(MST_B);

let app: FastifyInstance;
let ownerId = '';
let staffId = '';
let donViA = '';
let donViB = '';
let veOwnerA = ''; // cookie accessToken: OWNER + công ty A
let veOwnerB = ''; // cookie accessToken: OWNER + công ty B
let veStaffA = ''; // cookie accessToken: OWNER_EMPLOYEE + công ty A

// ---------------------------------------------------------------- sổ ghi kết quả (bằng chứng)

interface DongNhatKy {
  tc: string;
  buoc: string;
  method: string;
  url: string;
  status: number;
  than: string;
}
const NHAT_KY: DongNhatKy[] = [];

function catGon(s: string, n = 1300): string {
  return s.length <= n ? s : `${s.slice(0, n)}…[cắt ${s.length - n} ký tự]`;
}

interface KetQuaGoi {
  status: number;
  json: any;
  raw: string;
}

async function goi(
  tc: string,
  buoc: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  opts: { ve?: string; payload?: unknown } = {},
): Promise<KetQuaGoi> {
  const res = await app.inject({
    method,
    url,
    ...(opts.ve ? { cookies: { accessToken: opts.ve } } : {}),
    ...(opts.payload !== undefined ? { payload: opts.payload as object } : {}),
  });
  const raw = res.body;
  let json: any = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  NHAT_KY.push({ tc, buoc, method, url, status: res.statusCode, than: catGon(raw) });
  return { status: res.statusCode, json, raw };
}

// ---------------------------------------------------------------- dựng / dọn môi trường

async function cleanup() {
  // Thứ tự: syslog (không có FK) → don_vi (cascade access) → sub → plan → user.
  const users = await sysPrisma.user.findMany({
    where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await sysPrisma.sysLog.deleteMany({ where: { userId: { in: ids } } });
  }
  const dv = await sysPrisma.donVi.findMany({
    where: { maSoThue: { in: [MST_A, MST_B] } },
    select: { id: true, dbName: true },
  });
  if (dv.length > 0) {
    await sysPrisma.sysLog.deleteMany({ where: { donViId: { in: dv.map((d) => d.id) } } });
  }
  await sysPrisma.donVi.deleteMany({ where: { maSoThue: { in: [MST_A, MST_B] } } });
  if (ids.length > 0) {
    await sysPrisma.subscription.deleteMany({ where: { ownerId: { in: ids } } });
  }
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
  await sysPrisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STAFF_EMAIL] } } });
  // DROP hai DB tenant của bộ test (IF EXISTS — chạy lần đầu không có gì để xóa).
  await dropTenant(DB_A);
  await dropTenant(DB_B);
}

/** Lấy cookie accessToken sau khi đăng nhập + chọn công ty. */
async function layVe(email: string, donViId: string): Promise<string> {
  const dn = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: PW },
  });
  assert.equal(dn.statusCode, 200, `đăng nhập ${email} hỏng: ${dn.body}`);
  const c1 = dn.cookies.find((c) => c.name === 'accessToken');
  assert.ok(c1, `không thấy cookie accessToken sau login ${email}`);

  const doi = await app.inject({
    method: 'POST',
    url: `/api/v1/companies/${donViId}/switch`,
    cookies: { accessToken: c1.value },
  });
  assert.equal(doi.statusCode, 200, `đổi công ty hỏng: ${doi.body}`);
  const c2 = doi.cookies.find((c) => c.name === 'accessToken');
  assert.ok(c2, 'không thấy cookie accessToken sau switch');
  return c2.value;
}

before(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
  await cleanup();

  const pwHash = await hashPassword(PW);
  const owner = await sysPrisma.user.create({
    data: {
      email: OWNER_EMAIL,
      hoTen: 'QA HRM Owner',
      password: pwHash,
      role: 'OWNER',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  ownerId = owner.id;
  const staff = await sysPrisma.user.create({
    data: {
      email: STAFF_EMAIL,
      hoTen: 'QA HRM Staff',
      password: pwHash,
      role: 'OWNER_EMPLOYEE',
      status: 'ACTIVE',
      isActive: true,
      ownerId,
    },
  });
  staffId = staff.id;

  const plan = await sysPrisma.subscriptionPlan.create({
    data: {
      ma: PLAN_MA,
      ten: 'QA HRM',
      gia: 0,
      chuKyThang: 1,
      soMstToiDa: 5,
      soNguoiToiDa: 5,
      features: { hrm: true, dvc: true, tokhai: true, accounting: true },
    },
  });
  await sysPrisma.subscription.create({
    data: { ownerId, planId: plan.id, status: 'ACTIVE' },
  });

  const a = await sysPrisma.donVi.create({
    data: {
      ownerId,
      maSoThue: MST_A,
      slug: tenantSlug(MST_A),
      tenDonVi: 'QA Tenant A',
      status: 'PROVISIONING',
    },
  });
  donViA = a.id;
  const b = await sysPrisma.donVi.create({
    data: {
      ownerId,
      maSoThue: MST_B,
      slug: tenantSlug(MST_B),
      tenDonVi: 'QA Tenant B',
      status: 'PROVISIONING',
    },
  });
  donViB = b.id;

  // Cấp DB thật cho cả hai tenant (CREATE DATABASE + prisma db push + ràng buộc HRM).
  await provisionTenant(donViA, MST_A);
  await provisionTenant(donViB, MST_B);

  // Nhân viên chỉ được cấp quyền vào công ty A.
  await sysPrisma.donViAccess.create({
    data: { userId: staffId, donViId: donViA, xemLuong: false },
  });

  veOwnerA = await layVe(OWNER_EMAIL, donViA);
  veOwnerB = await layVe(OWNER_EMAIL, donViB);
  veStaffA = await layVe(STAFF_EMAIL, donViA);
});

after(async () => {
  // In toàn bộ nhật ký gọi HTTP để báo cáo có log nguyên văn.
  console.log('\n================ NHẬT KÝ GỌI HTTP (nguyên văn) ================');
  for (const d of NHAT_KY) {
    console.log(`[${d.tc}] ${d.buoc} :: ${d.method} ${d.url} -> ${d.status}`);
    console.log(`    ${d.than}`);
  }
  console.log(`================ TỔNG ${NHAT_KY.length} LƯỢT GỌI ================\n`);

  await cleanup();
  await app.close();
  await sysPrisma.$disconnect();
});

// ---------------------------------------------------------------- tiện ích nghiệp vụ

const BASE = '/api/v1/hrm';
const dbA = () => getTenantDb(DB_A);
const dbB = () => getTenantDb(DB_B);

async function xoaHetCa() {
  await dbA().workShift.deleteMany({});
  await dbB().workShift.deleteMany({});
}
async function xoaHetLe() {
  await dbA().holiday.deleteMany({});
  await dbB().holiday.deleteMany({});
}

// ================================================================================
// 7.1 — CẤU HÌNH MẶC ĐỊNH (TC-hrm-273 … TC-hrm-287)
// ================================================================================

test('7.1 Cấu hình mặc định — TC-hrm-273…287', async (t) => {
  await t.test('TC-hrm-273 — GET trên tenant trắng tự khởi tạo bản ghi DEFAULT', async () => {
    const truoc = await dbA().generalSetting.findUnique({ where: { id: 'DEFAULT' } });
    assert.equal(truoc, null, 'tiền điều kiện: tenant A phải chưa có bản ghi cấu hình');

    const r = await goi('TC-hrm-273', 'GET lần đầu', 'GET', `${BASE}/settings/general`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    const d = r.json.data;
    assert.equal(d.id, 'DEFAULT');
    assert.equal(d.baseSalary, '2340000');
    assert.equal(d.regionMinSalary, '4960000');
    assert.equal(d.personalDeduction, '11000000');
    assert.equal(d.dependentDeduction, '4400000');
    assert.equal(d.standardHoursPerDay, '8');
    assert.ok(Object.keys(d).length > 30, `phải có > 30 tham số, đang có ${Object.keys(d).length}`);
    // Biểu thuế chuẩn: 7 bậc, bậc cuối mở (null), trần 35% — BR-hrm-081 / ADR-009.
    assert.equal(d.taxBrackets.length, 7, 'BR-hrm-081: biểu chuẩn phải có 7 bậc');
    assert.equal(d.taxBrackets[6].khoang, null, 'bậc cuối phải là bậc mở (khoang = null)');
    assert.equal(d.taxBrackets[6].thueSuat, 35, 'trần thuế suất phải là 35%');
  });

  await t.test('TC-hrm-274 — GET lần 2 khớp 100% bản ghi đã lưu', async () => {
    const r = await goi('TC-hrm-274', 'GET lần 2', 'GET', `${BASE}/settings/general`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    const row = await dbA().generalSetting.findUnique({ where: { id: 'DEFAULT' } });
    assert.ok(row);
    assert.equal(r.json.data.standardHoursPerDay, String(row.standardHoursPerDay));
    assert.equal(r.json.data.baseSalary, String(row.baseSalary));
    assert.deepEqual(r.json.data.taxBrackets, row.taxBrackets);
  });

  await t.test('TC-hrm-275 — PUT một phần: trường gửi đổi, trường không gửi giữ nguyên', async () => {
    const r = await goi('TC-hrm-275', 'PUT 3 trường', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { standardHoursPerDay: 7.5, saturdayPolicy: 'OFF', unionFeeEmployeeRate: 0.8 },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.standardHoursPerDay, '7.5');
    assert.equal(r.json.data.saturdayPolicy, 'OFF');
    assert.equal(r.json.data.unionFeeEmployeeRate, '0.8');
    assert.equal(r.json.data.baseSalary, '2340000', 'trường không gửi phải giữ nguyên');
    assert.equal(r.json.data.sundayPolicy, 'OFF');
    assert.equal(r.json.data.warning, undefined, 'không gửi taxBrackets thì không có cảnh báo');
  });

  await t.test('TC-hrm-276 — biên hợp lệ standardHoursPerDay 1.0 và 24.0', async () => {
    const a = await goi('TC-hrm-276', '(1) 1.0', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { standardHoursPerDay: 1.0 },
    });
    assert.equal(a.status, 200, a.raw);
    assert.equal(a.json.data.standardHoursPerDay, '1');
    const b = await goi('TC-hrm-276', '(2) 24.0', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { standardHoursPerDay: 24.0 },
    });
    assert.equal(b.status, 200, b.raw);
    assert.equal(b.json.data.standardHoursPerDay, '24');
  });

  await t.test('TC-hrm-277 — ngoài biên standardHoursPerDay -> 400 E-hrm-067', async () => {
    for (const [i, v] of [0.9, 24.1, 0].entries()) {
      const r = await goi(
        'TC-hrm-277',
        `(${i + 1}) ${v}`,
        'PUT',
        `${BASE}/settings/general`,
        { ve: veOwnerA, payload: { standardHoursPerDay: v } },
      );
      assert.equal(r.status, 400, `${v} phải 400: ${r.raw}`);
      assert.match(
        JSON.stringify(r.json.errors),
        /Giờ công chuẩn/,
        `thiếu thông điệp E-hrm-067: ${r.raw}`,
      );
    }
    // Không được lưu: giá trị vẫn là 24 của TC-276.
    const row = await dbA().generalSetting.findUnique({ where: { id: 'DEFAULT' } });
    assert.equal(String(row?.standardHoursPerDay), '24');
  });

  await t.test('TC-hrm-278 — lương cơ sở / lương vùng <= 0 -> 400 E-hrm-068', async () => {
    const bo: Array<Record<string, number>> = [
      { baseSalary: 0 },
      { baseSalary: -500000 },
      { regionMinSalary: 0 },
      { regionMinSalary: -1000 },
    ];
    for (const [i, p] of bo.entries()) {
      const r = await goi(
        'TC-hrm-278',
        `(${i + 1}) ${JSON.stringify(p)}`,
        'PUT',
        `${BASE}/settings/general`,
        { ve: veOwnerA, payload: p },
      );
      assert.equal(r.status, 400, `${JSON.stringify(p)} phải 400: ${r.raw}`);
      assert.match(JSON.stringify(r.json.errors), /Lương cơ sở/);
    }
  });

  await t.test('TC-hrm-279 — biên nhỏ nhất baseSalary=1, regionMinSalary=1 -> 200', async () => {
    const r = await goi('TC-hrm-279', 'PUT 1/1', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { baseSalary: 1, regionMinSalary: 1 },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.baseSalary, '1');
    assert.equal(r.json.data.regionMinSalary, '1');
  });

  await t.test('TC-hrm-280 — biểu thuế không lũy tiến -> 400 E-hrm-069', async () => {
    const bang = await goi(
      'TC-hrm-280',
      '(1) hai bậc bằng nhau',
      'PUT',
      `${BASE}/settings/general`,
      {
        ve: veOwnerA,
        payload: {
          taxBrackets: [
            { khoang: 5000000, thueSuat: 5 },
            { khoang: null, thueSuat: 5 },
          ],
        },
      },
    );
    assert.equal(bang.status, 400, bang.raw);
    assert.match(JSON.stringify(bang.json.errors), /lũy tiến|lớn hơn bậc/i);

    const giam = await goi(
      'TC-hrm-280',
      '(2) bậc sau nhỏ hơn',
      'PUT',
      `${BASE}/settings/general`,
      {
        ve: veOwnerA,
        payload: {
          taxBrackets: [
            { khoang: 5000000, thueSuat: 5 },
            { khoang: null, thueSuat: 4 },
          ],
        },
      },
    );
    assert.equal(giam.status, 400, giam.raw);
  });

  await t.test('TC-hrm-281 — biểu 7 bậc chuẩn -> 200, KHÔNG cảnh báo', async () => {
    const r = await goi('TC-hrm-281', 'PUT 7 bậc chuẩn', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: {
        taxBrackets: [
          { khoang: 5000000, thueSuat: 5 },
          { khoang: 10000000, thueSuat: 10 },
          { khoang: 18000000, thueSuat: 15 },
          { khoang: 32000000, thueSuat: 20 },
          { khoang: 52000000, thueSuat: 25 },
          { khoang: 80000000, thueSuat: 30 },
          { khoang: null, thueSuat: 35 },
        ],
      },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.taxBrackets.length, 7);
    assert.equal(
      r.json.data.warning,
      undefined,
      'biểu đúng chuẩn thì phải VẮNG hẳn trường warning',
    );
  });

  await t.test('TC-hrm-282 — OWNER_EMPLOYEE gọi PUT -> 403 E-hrm-077', async () => {
    const r = await goi('TC-hrm-282', 'PUT bằng vé nhân viên', 'PUT', `${BASE}/settings/general`, {
      ve: veStaffA,
      payload: { standardHoursPerDay: 9 },
    });
    assert.equal(r.status, 403, r.raw);
    assert.match(r.json.message, /ADMIN|OWNER|Chủ doanh nghiệp/i);
  });

  await t.test('TC-hrm-283 — POST restore-default trả 200 và khôi phục đúng bộ chuẩn', async () => {
    const r = await goi(
      'TC-hrm-283',
      'POST restore-default',
      'POST',
      `${BASE}/settings/general/restore-default`,
      { ve: veOwnerA, payload: {} },
    );
    assert.equal(r.status, 200, `ADR-009: phải 200 chứ không 201. Thực tế ${r.status}: ${r.raw}`);
    const d = r.json.data;
    assert.equal(d.baseSalary, '2340000');
    assert.equal(d.regionMinSalary, '4960000');
    assert.equal(d.standardHoursPerDay, '8');
    assert.equal(d.saturdayPolicy, 'HALF_DAY');
    assert.equal(d.unionFeeEmployeeRate, '1');
    assert.equal(d.taxBrackets.length, 7);
    assert.equal(d.taxBrackets[6].khoang, null);
    assert.equal(d.taxBrackets[6].thueSuat, 35);
    assert.equal(d.warning, undefined, 'khôi phục thì không bao giờ kèm cảnh báo');
  });

  await t.test('TC-hrm-284 — OWNER_EMPLOYEE gọi restore-default -> 403', async () => {
    const r = await goi(
      'TC-hrm-284',
      'restore bằng vé nhân viên',
      'POST',
      `${BASE}/settings/general/restore-default`,
      { ve: veStaffA, payload: {} },
    );
    assert.equal(r.status, 403, r.raw);
  });

  await t.test('TC-hrm-285 — OWNER_EMPLOYEE được GET cấu hình', async () => {
    const r = await goi('TC-hrm-285', 'GET bằng vé nhân viên', 'GET', `${BASE}/settings/general`, {
      ve: veStaffA,
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.id, 'DEFAULT');
  });

  await t.test('TC-hrm-286 — không tồn tại POST/DELETE trên singleton', async () => {
    const p = await goi('TC-hrm-286', 'POST /settings/general', 'POST', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: {},
    });
    assert.ok([404, 405].includes(p.status), `phải 404/405, thực tế ${p.status}: ${p.raw}`);
    const d = await goi(
      'TC-hrm-286',
      'DELETE /settings/general',
      'DELETE',
      `${BASE}/settings/general`,
      { ve: veOwnerA },
    );
    assert.ok([404, 405].includes(d.status), `phải 404/405, thực tế ${d.status}: ${d.raw}`);
  });

  await t.test('TC-hrm-287 — cô lập tenant: A sửa 7.0, B vẫn 8.0', async () => {
    const a = await goi('TC-hrm-287', 'A PUT 7.0', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { standardHoursPerDay: 7.0 },
    });
    assert.equal(a.status, 200, a.raw);
    assert.equal(a.json.data.standardHoursPerDay, '7');

    const b = await goi('TC-hrm-287', 'B GET', 'GET', `${BASE}/settings/general`, { ve: veOwnerB });
    assert.equal(b.status, 200, b.raw);
    assert.equal(b.json.data.standardHoursPerDay, '8', 'B phải giữ giá trị riêng của B');
  });
});

// ================================================================================
// KIỂM RIÊNG — các điểm đợt 1 chấm sai / bỏ sót
// ================================================================================

test('KR — cảnh báo, nhật ký kiểm toán, Decimal, vòng GET→PUT', async (t) => {
  await t.test('KR-01 — PUT biểu lệch chuẩn -> warning CANH_BAO_BIEU_THUE_LECH_CHUAN', async () => {
    const r = await goi('KR-01', 'PUT biểu 3 bậc', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: {
        taxBrackets: [
          { khoang: 5000000, thueSuat: 5 },
          { khoang: 10000000, thueSuat: 10 },
          { khoang: null, thueSuat: 20 },
        ],
      },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.warning, 'CANH_BAO_BIEU_THUE_LECH_CHUAN');
  });

  await t.test('KR-02 — bốn điều kiện toàn vẹn BR-hrm-082', async () => {
    // (1) < 2 bậc -> E-hrm-081
    const mot = await goi('KR-02', '(1) 1 bậc', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { taxBrackets: [{ khoang: null, thueSuat: 5 }] },
    });
    assert.equal(mot.status, 400, mot.raw);
    assert.match(JSON.stringify(mot.json.errors), /2 bậc/i);

    // (2) ngưỡng không tăng -> E-hrm-080
    const nguong = await goi('KR-02', '(2) ngưỡng giảm', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: {
        taxBrackets: [
          { khoang: 10000000, thueSuat: 5 },
          { khoang: 8000000, thueSuat: 10 },
          { khoang: null, thueSuat: 15 },
        ],
      },
    });
    assert.equal(nguong.status, 400, nguong.raw);
    assert.match(JSON.stringify(nguong.json.errors), /ngưỡng/i);

    // (3) thuế suất không tăng -> E-hrm-069 (đã phủ ở TC-280, kiểm lại trong khối)
    // (4) bậc cuối không mở -> E-hrm-082
    const cuoi = await goi('KR-02', '(4) bậc cuối hữu hạn', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: {
        taxBrackets: [
          { khoang: 5000000, thueSuat: 5 },
          { khoang: 10000000, thueSuat: 10 },
        ],
      },
    });
    assert.equal(cuoi.status, 400, cuoi.raw);
    assert.match(JSON.stringify(cuoi.json.errors), /Bậc thuế cuối cùng/);

    // Cửa tương thích ngược: mốc 999999999999 ở bậc cuối được chuẩn hóa về null.
    const cu = await goi('KR-02', '(5) mốc cũ 999999999999', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: {
        taxBrackets: [
          { khoang: 5000000, thueSuat: 5 },
          { khoang: 999999999999, thueSuat: 10 },
        ],
      },
    });
    assert.equal(cu.status, 200, cu.raw);
    assert.equal(cu.json.data.taxBrackets[1].khoang, null);
  });

  await t.test('KR-03 — nhật ký kiểm toán ghi thật vào bảng syslog', async () => {
    await sysPrisma.sysLog.deleteMany({ where: { userId: ownerId } });

    const put = await goi('KR-03', 'PUT (sinh log)', 'PUT', `${BASE}/settings/general`, {
      ve: veOwnerA,
      payload: { baseAnnualLeaveDays: 13 },
    });
    assert.equal(put.status, 200, put.raw);

    const res = await goi(
      'KR-03',
      'restore-default (sinh log)',
      'POST',
      `${BASE}/settings/general/restore-default`,
      { ve: veOwnerA, payload: {} },
    );
    assert.equal(res.status, 200, res.raw);

    const logs = await sysPrisma.sysLog.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: 'asc' },
      select: { hanhDong: true, userId: true, donViId: true, chiTiet: true, level: true },
    });
    console.log('KR-03 syslog thực đọc từ DB:', JSON.stringify(logs));
    const hanhDong = logs.map((l) => l.hanhDong);
    assert.ok(
      hanhDong.includes('HRM_UPDATE_GENERAL_SETTINGS'),
      `thiếu log cập nhật, thực tế: ${JSON.stringify(hanhDong)}`,
    );
    assert.ok(
      hanhDong.includes('HRM_RESTORE_GENERAL_SETTINGS'),
      `thiếu log khôi phục, thực tế: ${JSON.stringify(hanhDong)}`,
    );
    const dongCapNhat = logs.find((l) => l.hanhDong === 'HRM_UPDATE_GENERAL_SETTINGS');
    assert.equal(dongCapNhat?.donViId, donViA, 'log phải ghi đúng công ty');
    assert.deepEqual(dongCapNhat?.chiTiet, { khoaNghiepVu: 'DEFAULT' });
  });

  await t.test('KR-04 — Decimal đọc ra CHUỖI; vòng GET→PUT nguyên payload', async () => {
    const g = await goi('KR-04', 'GET', 'GET', `${BASE}/settings/general`, { ve: veOwnerA });
    assert.equal(g.status, 200, g.raw);
    assert.equal(typeof g.json.data.standardHoursPerDay, 'string', 'Decimal phải là chuỗi');
    assert.equal(g.json.data.standardHoursPerDay, '8');
    assert.equal(typeof g.json.data.baseSalary, 'string');
    assert.equal(typeof g.json.data.taxBrackets[0].thueSuat, 'number', 'JSONB giữ số thật');

    // (a) Gửi lại NGUYÊN VĂN payload vừa nhận (chuỗi) — hợp đồng nói phải gửi SỐ.
    const nguyen = await goi(
      'KR-04',
      '(a) PUT nguyên payload GET (Decimal là chuỗi)',
      'PUT',
      `${BASE}/settings/general`,
      { ve: veOwnerA, payload: g.json.data },
    );
    console.log(`KR-04(a) trạng thái thực tế = ${nguyen.status}`);

    // (b) Cùng payload nhưng đã đổi 20 cột Decimal sang số — đây là cách FE phải làm.
    const soHoa: Record<string, unknown> = { ...g.json.data };
    delete soHoa.id;
    delete soHoa.createdAt;
    delete soHoa.updatedAt;
    for (const [k, v] of Object.entries(soHoa)) {
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) soHoa[k] = Number(v);
    }
    const daSo = await goi(
      'KR-04',
      '(b) PUT sau khi Number() hóa Decimal',
      'PUT',
      `${BASE}/settings/general`,
      { ve: veOwnerA, payload: soHoa },
    );
    assert.equal(daSo.status, 200, `vòng GET→Number()→PUT phải 200: ${daSo.raw}`);
  });

  await t.test('KR-05 — không có vé đăng nhập -> 401 (hook auth của hrm.route)', async () => {
    const khong = await goi('KR-05', 'không cookie', 'GET', `${BASE}/settings/general`);
    assert.equal(khong.status, 401, khong.raw);
    const veHong = await goi('KR-05', 'cookie rác', 'GET', `${BASE}/settings/general`, {
      ve: 'khong-phai-jwt',
    });
    assert.equal(veHong.status, 401, veHong.raw);
  });
});

// ================================================================================
// 7.2 — CA LÀM VIỆC (TC-hrm-288 … TC-hrm-309)
// ================================================================================

test('7.2 Ca làm việc — TC-hrm-288…309', async (t) => {
  await t.test('chuẩn bị — dọn sạch bảng ca của cả hai tenant', async () => {
    await xoaHetCa();
    assert.equal(await dbA().workShift.count(), 0);
  });

  let idCA01 = '';
  let idCa4h = '';

  await t.test('TC-hrm-288 — bỏ trống mã -> tự cấp CA01, 8.0h', async () => {
    const r = await goi('TC-hrm-288', 'POST không mã', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: {
        name: 'Ca hành chính',
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.code, 'CA01');
    assert.equal(r.json.data.isOvernight, false);
    assert.equal(r.json.data.workingHours, 8);
    assert.equal(r.json.data.status, 'ACTIVE');
    idCA01 = r.json.data.id;
  });

  await t.test('TC-hrm-289 — nhập mã CA02 -> 201, 7.5h', async () => {
    const r = await goi('TC-hrm-289', 'POST CA02', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: {
        code: 'CA02',
        name: 'Ca sáng',
        startTime: '06:00',
        endTime: '14:00',
        breakMinutes: 30,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.code, 'CA02');
    assert.equal(r.json.data.isOvernight, false);
    assert.equal(r.json.data.workingHours, 7.5);
  });

  await t.test('TC-hrm-290 — ca đêm 22:00→06:00 -> isOvernight, 7.5h', async () => {
    const r = await goi('TC-hrm-290', 'POST ca đêm', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: {
        name: 'Ca đêm 3',
        startTime: '22:00',
        endTime: '06:00',
        breakMinutes: 30,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.isOvernight, true);
    assert.equal(r.json.data.workingHours, 7.5);
  });

  await t.test('TC-hrm-291 — 20:00→04:00 break 60 -> 7.0h qua đêm', async () => {
    const r = await goi('TC-hrm-291', 'POST 20-04', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: {
        name: 'Ca khuya qua ngày',
        startTime: '20:00',
        endTime: '04:00',
        breakMinutes: 60,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.isOvernight, true);
    assert.equal(r.json.data.workingHours, 7);
  });

  let idCa24h = '';
  await t.test('TC-hrm-292 — endTime == startTime -> ca 24h, 22.0h + cảnh báo', async () => {
    const r = await goi('TC-hrm-292', 'POST ca trực 24h', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: {
        name: 'Ca trực 24h',
        startTime: '08:00',
        endTime: '08:00',
        breakMinutes: 120,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.isOvernight, true);
    assert.equal(r.json.data.workingHours, 22);
    assert.equal(
      r.json.data.warning,
      'CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD',
      'đường đọc 1/4 (sau tạo) phải kèm cảnh báo',
    );
    idCa24h = r.json.data.id;
  });

  await t.test('TC-hrm-293 — 00:00→08:00 break 0 -> 8.0h, không qua đêm', async () => {
    const r = await goi('TC-hrm-293', 'POST rạng sáng', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: {
        name: 'Ca rạng sáng',
        startTime: '00:00',
        endTime: '08:00',
        breakMinutes: 0,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.isOvernight, false);
    assert.equal(r.json.data.workingHours, 8);
  });

  await t.test('KR-06 — cảnh báo ca >12h ở CẢ 4 đường đọc', async () => {
    const ds = await goi('KR-06', 'GET danh sách', 'GET', `${BASE}/work-shifts?pageSize=100`, {
      ve: veOwnerA,
    });
    assert.equal(ds.status, 200, ds.raw);
    const trong = ds.json.data.items.find((x: any) => x.id === idCa24h);
    assert.equal(trong.warning, 'CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD', 'đường đọc 2/4 (danh sách)');
    // các ca <= 12h phải VẮNG hẳn trường warning
    const ca8h = ds.json.data.items.find((x: any) => x.code === 'CA01');
    assert.equal(ca8h.warning, undefined, 'ca 8h không được có warning');

    const ct = await goi('KR-06', 'GET chi tiết', 'GET', `${BASE}/work-shifts/${idCa24h}`, {
      ve: veOwnerA,
    });
    assert.equal(ct.status, 200, ct.raw);
    assert.equal(ct.json.data.warning, 'CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD', 'đường đọc 3/4 (chi tiết)');

    const sua = await goi('KR-06', 'PATCH', 'PATCH', `${BASE}/work-shifts/${idCa24h}`, {
      ve: veOwnerA,
      payload: { name: 'Ca trực 24h (đổi tên)' },
    });
    assert.equal(sua.status, 200, sua.raw);
    assert.equal(sua.json.data.warning, 'CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD', 'đường đọc 4/4 (sau sửa)');
  });

  await t.test('TC-hrm-294 — thiếu/trống name -> 400 E-hrm-070', async () => {
    const thieu = await goi('TC-hrm-294', '(1) thiếu name', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(thieu.status, 400, thieu.raw);
    assert.match(JSON.stringify(thieu.json.errors), /Tên ca làm việc/);

    const trong = await goi('TC-hrm-294', '(2) name toàn khoảng trắng', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { name: '   ', startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(trong.status, 400, trong.raw);
  });

  await t.test('TC-hrm-295 — giờ vào/ra sai định dạng hoặc thiếu -> 400 E-hrm-071', async () => {
    const bo = [
      { name: 'A', startTime: '8:00', endTime: '17:00' },
      { name: 'A', startTime: '08:00', endTime: '25:00' },
      { name: 'A', startTime: '08:00' },
    ];
    for (const [i, p] of bo.entries()) {
      const r = await goi('TC-hrm-295', `(${i + 1}) ${JSON.stringify(p)}`, 'POST', `${BASE}/work-shifts`, {
        ve: veOwnerA,
        payload: p,
      });
      assert.equal(r.status, 400, r.raw);
      assert.match(JSON.stringify(r.json.errors), /giờ vào và giờ ra|HH:mm/i);
    }
  });

  await t.test('TC-hrm-296 — breakMinutes âm -> 400 E-hrm-072', async () => {
    const r = await goi('TC-hrm-296', 'POST break -15', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { name: 'Ca lỗi', startTime: '08:00', endTime: '17:00', breakMinutes: -15 },
    });
    assert.equal(r.status, 400, r.raw);
    assert.match(JSON.stringify(r.json.errors), /nghỉ giữa ca/i);
  });

  await t.test('TC-hrm-297 — nghỉ >= giờ ca -> 400 E-hrm-072', async () => {
    for (const [i, br] of [240, 300].entries()) {
      const r = await goi('TC-hrm-297', `(${i + 1}) break ${br}`, 'POST', `${BASE}/work-shifts`, {
        ve: veOwnerA,
        payload: { name: 'Ca 4h', startTime: '08:00', endTime: '12:00', breakMinutes: br },
      });
      assert.equal(r.status, 400, r.raw);
      assert.match(JSON.stringify(r.json.errors), /nghỉ giữa ca/i);
    }
  });

  await t.test('TC-hrm-298 — trùng mã CA01 -> 409 E-hrm-073', async () => {
    const r = await goi('TC-hrm-298', 'POST trùng CA01', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { code: 'CA01', name: 'Ca trùng mã', startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(r.status, 409, r.raw);
    assert.match(r.json.message, /đã tồn tại/i);
  });

  await t.test('TC-hrm-299 — gap scanning: có CA01 + CA03, bỏ trống mã -> CA02', async () => {
    await xoaHetCa();
    for (const [code, name] of [
      ['CA01', 'Ca một'],
      ['CA03', 'Ca ba'],
    ]) {
      const c = await goi('TC-hrm-299', `dựng ${code}`, 'POST', `${BASE}/work-shifts`, {
        ve: veOwnerA,
        payload: { code, name, startTime: '08:00', endTime: '17:00', breakMinutes: 60 },
      });
      assert.equal(c.status, 201, c.raw);
    }
    const r = await goi('TC-hrm-299', 'POST không mã', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { name: 'Ca lấp chỗ trống', startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.code, 'CA02');
  });

  await t.test('TC-hrm-300 — danh sách phân trang, 5 ca', async () => {
    await xoaHetCa();
    const mau: Array<[string, string, string, number, string]> = [
      ['Ca hành chính', '08:00', '17:00', 60, 'ACTIVE'],
      ['Ca sáng', '06:00', '14:00', 30, 'ACTIVE'],
      ['Ca đêm', '22:00', '06:00', 30, 'INACTIVE'],
      ['Ca chiều', '14:00', '22:00', 30, 'ACTIVE'],
      ['Ca gãy', '08:00', '12:00', 0, 'ACTIVE'],
    ];
    for (const [name, s, e, br, st] of mau) {
      const c = await goi('TC-hrm-300', `dựng ${name}`, 'POST', `${BASE}/work-shifts`, {
        ve: veOwnerA,
        payload: { name, startTime: s, endTime: e, breakMinutes: br, status: st },
      });
      assert.equal(c.status, 201, c.raw);
      if (name === 'Ca hành chính') idCA01 = c.json.data.id;
      if (name === 'Ca gãy') idCa4h = c.json.data.id;
    }
    const r = await goi('TC-hrm-300', 'GET trang 1', 'GET', `${BASE}/work-shifts?page=1&pageSize=10`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.total, 5);
    assert.equal(r.json.data.items.length, 5);
    for (const it of r.json.data.items) {
      assert.equal(typeof it.isOvernight, 'boolean');
      assert.equal(typeof it.workingHours, 'number');
    }
  });

  await t.test('TC-hrm-301 — lọc search + status', async () => {
    const khongDau = await goi(
      'TC-hrm-301',
      '(a) search=chinh (không dấu, đúng nguyên văn ca kiểm thử)',
      'GET',
      `${BASE}/work-shifts?search=chinh&status=ACTIVE`,
      { ve: veOwnerA },
    );
    assert.equal(khongDau.status, 200, khongDau.raw);
    console.log(
      `TC-hrm-301(a) search=chinh trả về ${khongDau.json.data.total} bản ghi ` +
        `(kỳ vọng của ca kiểm thử: 1)`,
    );

    const coDau = await goi(
      'TC-hrm-301',
      '(b) search=chính (đúng dấu) — đối chứng',
      'GET',
      `${BASE}/work-shifts?search=${encodeURIComponent('chính')}&status=ACTIVE`,
      { ve: veOwnerA },
    );
    assert.equal(coDau.status, 200, coDau.raw);
    assert.equal(coDau.json.data.total, 1, 'tìm đúng dấu phải ra 1 bản ghi');
    assert.equal(coDau.json.data.items[0].name, 'Ca hành chính');

    // Đối chứng lọc trạng thái: ca đêm INACTIVE không lọt vào status=ACTIVE.
    const inactive = await goi(
      'TC-hrm-301',
      '(c) status=INACTIVE',
      'GET',
      `${BASE}/work-shifts?status=INACTIVE`,
      { ve: veOwnerA },
    );
    assert.equal(inactive.json.data.total, 1);
    assert.equal(inactive.json.data.items[0].name, 'Ca đêm');

    // Khẳng định chính thức của ca: tìm không dấu KHÔNG ra kết quả (phát hiện lỗi).
    assert.equal(
      khongDau.json.data.total,
      1,
      'TC-hrm-301 yêu cầu search=chinh khớp "Ca hành chính" — tìm kiếm hiện KHÔNG bỏ dấu',
    );
  });

  await t.test('TC-hrm-302 — chi tiết ca theo id', async () => {
    const r = await goi('TC-hrm-302', 'GET chi tiết', 'GET', `${BASE}/work-shifts/${idCA01}`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.id, idCA01);
    assert.equal(r.json.data.workingHours, 8);
    assert.equal(r.json.data.isOvernight, false);
  });

  await t.test('TC-hrm-303 — id không tồn tại -> 404', async () => {
    const r = await goi('TC-hrm-303', 'GET ws_999', 'GET', `${BASE}/work-shifts/ws_999`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 404, r.raw);
  });

  await t.test('TC-hrm-304 — PATCH tính lại giờ công, giữ nguyên mã', async () => {
    const r = await goi('TC-hrm-304', 'PATCH', 'PATCH', `${BASE}/work-shifts/${idCA01}`, {
      ve: veOwnerA,
      payload: { name: 'Ca HC sửa đổi', breakMinutes: 30, status: 'INACTIVE' },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.workingHours, 8.5);
    assert.equal(r.json.data.name, 'Ca HC sửa đổi');
    assert.equal(r.json.data.status, 'INACTIVE');
    assert.equal(r.json.data.code, 'CA01', 'mã ca phải giữ nguyên');
    // trả lại trạng thái cũ cho các ca sau
    await goi('TC-hrm-304', 'hoàn nguyên', 'PATCH', `${BASE}/work-shifts/${idCA01}`, {
      ve: veOwnerA,
      payload: { name: 'Ca hành chính', breakMinutes: 60, status: 'ACTIVE' },
    });
  });

  await t.test('TC-hrm-305 — PATCH gửi kèm code: mã KHÔNG đổi', async () => {
    const r = await goi('TC-hrm-305', 'PATCH kèm code', 'PATCH', `${BASE}/work-shifts/${idCA01}`, {
      ve: veOwnerA,
      payload: { code: 'CA99', name: 'Đổi mã ca' },
    });
    assert.ok([200, 400].includes(r.status), `phải 200 (bỏ qua code) hoặc 400: ${r.raw}`);
    if (r.status === 200) {
      assert.equal(r.json.data.code, 'CA01', 'code phải giữ nguyên');
    }
    const kiem = await dbA().workShift.findUnique({ where: { id: idCA01 } });
    assert.equal(kiem?.code, 'CA01', 'DB cũng phải giữ CA01');
    await goi('TC-hrm-305', 'hoàn nguyên tên', 'PATCH', `${BASE}/work-shifts/${idCA01}`, {
      ve: veOwnerA,
      payload: { name: 'Ca hành chính' },
    });
  });

  await t.test('TC-hrm-306 — PATCH break 250 trên ca 4h -> 400 E-hrm-072', async () => {
    await goi('TC-hrm-306', 'đặt break 30', 'PATCH', `${BASE}/work-shifts/${idCa4h}`, {
      ve: veOwnerA,
      payload: { breakMinutes: 30 },
    });
    const r = await goi('TC-hrm-306', 'PATCH break 250', 'PATCH', `${BASE}/work-shifts/${idCa4h}`, {
      ve: veOwnerA,
      payload: { breakMinutes: 250 },
    });
    assert.equal(r.status, 400, r.raw);
    assert.match(r.json.message ?? JSON.stringify(r.json.errors), /nghỉ giữa ca/i);
  });

  await t.test('TC-hrm-307 — DELETE ca chưa dùng -> 200, xóa cứng', async () => {
    const r = await goi('TC-hrm-307', 'DELETE', 'DELETE', `${BASE}/work-shifts/${idCa4h}`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    const con = await dbA().workShift.findUnique({ where: { id: idCa4h } });
    assert.equal(con, null, 'phải xóa cứng khỏi DB');
  });

  await t.test('TC-hrm-308 — [KHÔNG CHẠY ĐƯỢC] chưa có bảng hrm_work_schedules', async () => {
    const bang = await dbA().$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT count(*)::bigint AS c FROM information_schema.tables
        WHERE table_schema='public' AND table_name='hrm_work_schedules'`,
    );
    console.log(
      `TC-hrm-308: số bảng hrm_work_schedules trong tenant A = ${bang[0].c} ` +
        `(0 nghĩa là chưa có thực thể phân lịch -> không dựng được tiền điều kiện)`,
    );
    assert.equal(Number(bang[0].c), 0);
  });

  await t.test('KR-08 — dùng hết CA01..CA99 rồi bỏ trống mã -> 400 E-hrm-078 (BUG-HRM-45)', async () => {
    await xoaHetCa();
    await dbA().workShift.createMany({
      data: Array.from({ length: 99 }, (_, i) => ({
        id: `qa-ca-${i + 1}`,
        code: `CA${String(i + 1).padStart(2, '0')}`,
        name: `Ca ${i + 1}`,
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
      })),
    });
    assert.equal(await dbA().workShift.count(), 99);

    const r = await goi('KR-08', 'POST không mã khi đã đủ 99', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { name: 'Ca thứ 100', startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(r.status, 400, `phải 400 E-hrm-078: ${r.raw}`);
    assert.match(r.json.message ?? '', /99 ca|giới hạn/i);

    // Vẫn tạo được nếu người dùng TỰ nhập mã ngoài dải tự sinh.
    const tay = await goi('KR-08', 'POST tự nhập mã CA100', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { code: 'CA100', name: 'Ca thứ 100', startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(tay.status, 201, tay.raw);
    await xoaHetCa();
  });

  await t.test('TC-hrm-309 — cô lập tenant: cả A và B đều tạo được CA01', async () => {
    await xoaHetCa();
    const a = await goi('TC-hrm-309', 'A tạo CA01', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerA,
      payload: { code: 'CA01', name: 'Ca A', startTime: '08:00', endTime: '17:00' },
    });
    assert.equal(a.status, 201, a.raw);
    const b = await goi('TC-hrm-309', 'B tạo CA01', 'POST', `${BASE}/work-shifts`, {
      ve: veOwnerB,
      payload: { code: 'CA01', name: 'Ca B', startTime: '09:00', endTime: '18:00' },
    });
    assert.equal(b.status, 201, b.raw);

    const dsB = await goi('TC-hrm-309', 'B xem danh sách', 'GET', `${BASE}/work-shifts`, {
      ve: veOwnerB,
    });
    assert.equal(dsB.json.data.total, 1, 'B chỉ được thấy đúng ca của B');
    assert.equal(dsB.json.data.items[0].name, 'Ca B');
    const dsA = await goi('TC-hrm-309', 'A xem danh sách', 'GET', `${BASE}/work-shifts`, {
      ve: veOwnerA,
    });
    assert.equal(dsA.json.data.total, 1);
    assert.equal(dsA.json.data.items[0].name, 'Ca A');
  });
});

// ================================================================================
// 7.3 — LỊCH NGÀY LỄ (TC-hrm-310 … TC-hrm-327)
// ================================================================================

test('7.3 Lịch ngày lễ — TC-hrm-310…327', async (t) => {
  let idLe = '';

  await t.test('chuẩn bị — dọn sạch bảng ngày lễ của cả hai tenant', async () => {
    await xoaHetLe();
    assert.equal(await dbA().holiday.count(), 0);
  });

  await t.test('TC-hrm-310 — tạo lễ quốc gia lặp hàng năm', async () => {
    const r = await goi('TC-hrm-310', 'POST 30/04', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-04-30',
        name: 'Ngày Chiến thắng',
        type: 'NATIONAL',
        isAnnual: true,
        isPaid: true,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.type, 'NATIONAL');
    assert.equal(r.json.data.isAnnual, true);
    assert.equal(r.json.data.date.slice(0, 10), '2026-04-30');
  });

  await t.test('TC-hrm-311 — lễ âm lịch isAnnual=false -> 201', async () => {
    const r = await goi('TC-hrm-311', 'POST mùng 1 Tết', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-02-17',
        name: 'Mùng 1 Tết Bính Ngọ',
        type: 'LUNAR',
        isAnnual: false,
        isPaid: true,
      },
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.json.data.isAnnual, false);
    idLe = r.json.data.id;
  });

  await t.test('TC-hrm-312 — lễ âm lịch isAnnual=true -> 400 E-hrm-075', async () => {
    const r = await goi('TC-hrm-312', 'POST LUNAR + isAnnual', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-02-17',
        name: 'Tết Âm lịch',
        type: 'LUNAR',
        isAnnual: true,
        isPaid: true,
      },
    });
    assert.equal(r.status, 400, r.raw);
    assert.match(JSON.stringify(r.json.errors ?? r.json.message), /âm lịch/i);
  });

  await t.test('TC-hrm-313 — thiếu date / name rỗng -> 400 E-hrm-074', async () => {
    const thieuNgay = await goi('TC-hrm-313', '(1) thiếu date', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { name: 'Tết', type: 'NATIONAL' },
    });
    assert.equal(thieuNgay.status, 400, thieuNgay.raw);
    const tenRong = await goi('TC-hrm-313', '(2) name rỗng', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-01-01', name: '', type: 'NATIONAL' },
    });
    assert.equal(tenRong.status, 400, tenRong.raw);
  });

  await t.test('TC-hrm-314 — trùng (date, name) -> 409 E-hrm-076', async () => {
    const lan1 = await goi('TC-hrm-314', 'tạo lần 1', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-01-01', name: 'Tết Dương lịch', type: 'NATIONAL', isAnnual: true },
    });
    assert.equal(lan1.status, 201, lan1.raw);
    const lan2 = await goi('TC-hrm-314', 'tạo lần 2 (trùng)', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-01-01', name: 'Tết Dương lịch', type: 'NATIONAL', isAnnual: true },
    });
    assert.equal(lan2.status, 409, lan2.raw);
  });

  await t.test('TC-hrm-315 — cùng ngày khác tên -> 201', async () => {
    await goi('TC-hrm-315', 'dựng Quốc khánh', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-09-02', name: 'Quốc khánh', type: 'NATIONAL', isAnnual: true },
    });
    const r = await goi('TC-hrm-315', 'POST cùng ngày khác tên', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-09-02',
        name: 'Kỷ niệm thành lập công ty',
        type: 'COMPANY',
        isAnnual: true,
      },
    });
    assert.equal(r.status, 201, r.raw);
  });

  await t.test('TC-hrm-316 — GET ?year=2026&filter=THIS_YEAR', async () => {
    const r = await goi(
      'TC-hrm-316',
      'GET year+THIS_YEAR',
      'GET',
      `${BASE}/holidays?year=2026&filter=THIS_YEAR`,
      { ve: veOwnerA },
    );
    assert.equal(r.status, 200, r.raw);
    assert.ok(r.json.data.total >= 4, `phải thấy các ngày lễ 2026: ${r.raw}`);
    for (const it of r.json.data.items) {
      assert.equal(typeof it.isPaid, 'boolean', 'phải kèm cờ isPaid');
    }
    const truong = Object.keys(r.json.data.items[0]);
    console.log(`TC-hrm-316 các trường của một phần tử: ${JSON.stringify(truong)}`);
    // Ca kiểm thử đòi "thứ trong tuần"; hợp đồng 7F.2 KHÔNG có trường đó.
    assert.ok(
      truong.some((k) => /thu|weekday|dayOfWeek/i.test(k)),
      'TC-hrm-316 đòi trả kèm "thứ trong tuần" — payload hiện không có trường nào như vậy',
    );
  });

  await t.test('TC-hrm-317 — filter=ANNUAL chỉ trả isAnnual=true', async () => {
    const r = await goi('TC-hrm-317', 'GET ANNUAL', 'GET', `${BASE}/holidays?filter=ANNUAL`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    assert.ok(r.json.data.total > 0);
    for (const it of r.json.data.items) {
      assert.equal(it.isAnnual, true);
    }
    assert.ok(
      !r.json.data.items.some((x: any) => x.name === 'Mùng 1 Tết Bính Ngọ'),
      'ngày lễ isAnnual=false không được lọt vào',
    );
  });

  await t.test('TC-hrm-318 — chi tiết ngày lễ', async () => {
    const r = await goi('TC-hrm-318', 'GET chi tiết', 'GET', `${BASE}/holidays/${idLe}`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.id, idLe);
  });

  await t.test('TC-hrm-319 — PATCH thông tin ngày lễ', async () => {
    const r = await goi('TC-hrm-319', 'PATCH', 'PATCH', `${BASE}/holidays/${idLe}`, {
      ve: veOwnerA,
      payload: { name: 'Mùng 1 Tết (sửa)', note: 'Nghỉ trọn vẹn 1 ngày', isPaid: true },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.name, 'Mùng 1 Tết (sửa)');
    assert.equal(r.json.data.note, 'Nghỉ trọn vẹn 1 ngày');
  });

  await t.test('TC-hrm-320 — PATCH sang LUNAR khi isAnnual=true -> 400 E-hrm-075', async () => {
    const tao = await goi('TC-hrm-320', 'dựng lễ isAnnual=true', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-05-01', name: 'Quốc tế Lao động', type: 'NATIONAL', isAnnual: true },
    });
    assert.equal(tao.status, 201, tao.raw);
    const id2 = tao.json.data.id;

    const a = await goi('TC-hrm-320', '(1) chỉ đổi type', 'PATCH', `${BASE}/holidays/${id2}`, {
      ve: veOwnerA,
      payload: { type: 'LUNAR' },
    });
    assert.equal(a.status, 400, `giữ cờ lặp cũ =true, phải 400: ${a.raw}`);

    const b = await goi(
      'TC-hrm-320',
      '(2) type + isAnnual cùng true',
      'PATCH',
      `${BASE}/holidays/${id2}`,
      { ve: veOwnerA, payload: { type: 'LUNAR', isAnnual: true } },
    );
    assert.equal(b.status, 400, b.raw);
  });

  await t.test('TC-hrm-321 — DELETE ngày lễ -> 200', async () => {
    const r = await goi('TC-hrm-321', 'DELETE', 'DELETE', `${BASE}/holidays/${idLe}`, {
      ve: veOwnerA,
    });
    assert.equal(r.status, 200, r.raw);
    const con = await dbA().holiday.findUnique({ where: { id: idLe } });
    assert.equal(con, null);
  });

  await t.test('KR-07 — bộ lọc ?isPaid=false lọc ĐÚNG nhóm không hưởng lương', async () => {
    await xoaHetLe();
    await goi('KR-07', 'dựng lễ có lương', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-01-01', name: 'Có lương', type: 'NATIONAL', isAnnual: true, isPaid: true },
    });
    await goi('KR-07', 'dựng lễ KHÔNG lương', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-03-08',
        name: 'Không lương',
        type: 'COMPANY',
        isAnnual: true,
        isPaid: false,
      },
    });
    const khong = await goi('KR-07', 'GET isPaid=false', 'GET', `${BASE}/holidays?filter=ALL&isPaid=false`, {
      ve: veOwnerA,
    });
    assert.equal(khong.status, 200, khong.raw);
    assert.equal(khong.json.data.total, 1, `phải chỉ ra 1 ngày không lương: ${khong.raw}`);
    assert.equal(khong.json.data.items[0].name, 'Không lương');

    const co = await goi('KR-07', 'GET isPaid=true', 'GET', `${BASE}/holidays?filter=ALL&isPaid=true`, {
      ve: veOwnerA,
    });
    assert.equal(co.json.data.total, 1);
    assert.equal(co.json.data.items[0].name, 'Có lương');

    const la = await goi('KR-07', 'GET isPaid=abc (giá trị lạ)', 'GET', `${BASE}/holidays?isPaid=abc`, {
      ve: veOwnerA,
    });
    assert.equal(la.status, 400, `giá trị lạ phải bị từ chối: ${la.raw}`);
  });

  await t.test('TC-hrm-322 — quick-generate 2026 trên tenant trắng -> 200, đủ 11 ngày', async () => {
    await xoaHetLe();
    const r = await goi('TC-hrm-322', 'POST quick-generate 2026', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026 },
    });
    assert.equal(r.status, 200, `ADR-009: phải 200 chứ không 201. Thực tế ${r.status}: ${r.raw}`);
    assert.equal(r.json.data.year, 2026);
    assert.equal(r.json.data.totalStandard, 11);
    assert.equal(r.json.data.addedCount, 11);
    assert.equal(r.json.data.skippedCount, 0);
    assert.equal(await dbA().holiday.count(), 11);
  });

  await t.test('TC-hrm-323 — idempotent: đã có 01/01 thì chỉ bổ sung 10', async () => {
    await xoaHetLe();
    const tao = await goi('TC-hrm-323', 'dựng sẵn 01/01', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-01-01', name: 'Tết Dương lịch', type: 'NATIONAL', isAnnual: true },
    });
    assert.equal(tao.status, 201, tao.raw);
    const r = await goi('TC-hrm-323', 'POST quick-generate', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026 },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.addedCount, 10);
    assert.equal(r.json.data.skippedCount, 1);
    assert.equal(await dbA().holiday.count(), 11);
  });

  await t.test('TC-hrm-324 — bấm lần hai: thêm 0, bỏ qua 11', async () => {
    const r = await goi('TC-hrm-324', 'POST quick-generate lần 2', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026 },
    });
    assert.equal(r.status, 200, r.raw);
    assert.equal(r.json.data.addedCount, 0);
    assert.equal(r.json.data.skippedCount, 11);
    assert.equal(r.json.data.items.length, 11);
    assert.equal(await dbA().holiday.count(), 11);
  });

  /*
   * KR-10 / KR-11 — CHẾ ĐỘ CHẠY THỬ của "Tạo nhanh".
   *
   * Hai ca này là chỗ DUY NHẤT phủ dây nối controller: bộ unit test gọi thẳng service nên nếu
   * controller quên chuyền `body.dryRun` xuống thì mọi ca ở đó vẫn xanh. Ở đây cờ đi trọn vòng
   * HTTP -> validator -> controller -> service -> Postgres, và kết quả được đối chiếu với số
   * dòng đếm được THẲNG TRONG DB tenant.
   */
  await t.test('KR-10 — dryRun: xem trước KHÔNG ghi dòng nào và bằng đúng lượt tạo thật', async () => {
    await xoaHetLe();

    const truoc = await goi('KR-10', 'quick-generate dryRun', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026, dryRun: true },
    });
    assert.equal(truoc.status, 200, `dryRun cũng phải trả 200: ${truoc.raw}`);
    assert.equal(truoc.json.data.year, 2026);
    assert.equal(truoc.json.data.totalStandard, 11);
    assert.equal(truoc.json.data.addedCount, 11, 'tenant trắng thì dự báo thêm đủ 11');
    assert.equal(truoc.json.data.skippedCount, 0);
    assert.equal(truoc.json.data.items.length, 11);
    assert.equal(await dbA().holiday.count(), 0, 'CHẠY THỬ MÀ VẪN GHI: bảng phải còn trắng nguyên');

    // Lượt tạo thật ngay sau đó, không ai chen ngang: phải khớp từng con số và từng dòng.
    const that = await goi('KR-10', 'quick-generate thật', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026 },
    });
    assert.equal(that.status, 200, that.raw);
    assert.equal(that.json.data.addedCount, truoc.json.data.addedCount, 'dự báo addedCount phải đúng');
    assert.equal(that.json.data.skippedCount, truoc.json.data.skippedCount);
    assert.deepEqual(that.json.data.items, truoc.json.data.items, 'xem trước và tạo thật phải là MỘT');
    assert.equal(await dbA().holiday.count(), 11);

    /*
     * Phép kiểm nặng nhất: so bản xem trước với thứ THỰC SỰ nằm trong DB. Đây đúng chỗ lỗi Tết
     * 2026 từng lọt — giao diện vẽ 16–20/02 bằng bảng tra tay riêng trong khi DB nhận 15–19/02.
     */
    const trongDb = (await dbA().holiday.findMany({ orderBy: { date: 'asc' } })).map((h) => ({
      date: h.date.toISOString().slice(0, 10),
      name: h.name,
    }));
    assert.deepEqual(
      truoc.json.data.items.map((i: { date: string; name: string }) => ({ date: i.date, name: i.name })),
      trongDb,
      'từng ngày của bản xem trước phải trùng đúng ngày đã lưu trong DB',
    );
    const cumTet = trongDb.filter((h) => h.date.startsWith('2026-02')).map((h) => h.date);
    assert.deepEqual(cumTet, ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19']);

    // dryRun lần hai, khi đã có đủ 11 dòng: dự báo 0 thêm / 11 bỏ qua, và vẫn không ghi gì.
    const lai = await goi('KR-10', 'dryRun khi đã có đủ 11', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026, dryRun: true },
    });
    assert.equal(lai.status, 200, lai.raw);
    assert.equal(lai.json.data.addedCount, 0);
    assert.equal(lai.json.data.skippedCount, 11);
    assert.equal(await dbA().holiday.count(), 11, 'dryRun không được thêm dòng nào');
  });

  await t.test('KR-11 — dryRun phải là boolean thật: chuỗi "false" bị từ chối 400', async () => {
    const chuoi = await goi('KR-11', 'dryRun="false" (chuỗi)', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026, dryRun: 'false' },
    });
    assert.equal(
      chuoi.status,
      400,
      `Boolean("false")===true nên z.coerce.boolean() sẽ nuốt mất thao tác ghi (BE-03): ${chuoi.raw}`,
    );

    // Còn dryRun ngoài dải năm thì vẫn bị chặn 400 như đường ghi, không có cửa riêng.
    const ngoaiDai = await goi(
      'KR-11',
      'dryRun năm 2031 (ngoài dải)',
      'POST',
      `${BASE}/holidays/quick-generate`,
      { ve: veOwnerA, payload: { year: 2031, dryRun: true } },
    );
    assert.equal(ngoaiDai.status, 400, `chạy thử không được lách dải năm: ${ngoaiDai.raw}`);
  });

  /*
   * ════════════════════════════════════════════════════════════════════════════════════════
   * KR-12 … KR-15 — `BUG-HRM-51`: Tạo nhanh năm sau KHÔNG được đẻ dòng lặp-hàng-năm TRÙNG NGHĨA
   *
   * Lỗi đo được bằng tay trên trình duyệt (2026-09-08): tenant đã có `2026-01-01 Tết Dương lịch`
   * `isAnnual = true`, bấm Tạo nhanh 2027 vẫn báo "thêm 11 / bỏ qua 0" rồi ghi thêm
   * `2027-01-01` cùng tên, cùng cờ lặp hàng năm. `@@unique([date, name])` không chặn vì khác
   * `date`. Bốn ca dưới đây đi trọn vòng HTTP và đối chiếu với số dòng đếm THẲNG trong DB tenant
   * — chỗ duy nhất chứng minh được là dữ liệu thật không còn dòng thừa.
   * ════════════════════════════════════════════════════════════════════════════════════════
   */

  /** Bất biến hợp đồng: số mục `alreadyCovered === false` phải bằng đúng `addedCount`. */
  const soatBatBien = (
    than: {
      addedCount: number;
      skippedCount: number;
      items: Array<{ alreadyCovered: boolean }>;
    },
    nhan: string,
  ) => {
    const seTao = than.items.filter((i) => i.alreadyCovered === false);
    assert.equal(
      seTao.length,
      than.addedCount,
      `[${nhan}] bất biến vỡ: ${seTao.length} mục alreadyCovered=false nhưng addedCount=${than.addedCount}`,
    );
    assert.equal(
      than.items.length - seTao.length,
      than.skippedCount,
      `[${nhan}] skippedCount không khớp số mục alreadyCovered=true`,
    );
  };

  const TEN_LE_DUONG_LICH = [
    'Tết Dương lịch',
    'Ngày Giải phóng miền Nam',
    'Ngày Quốc tế Lao động',
    'Nghỉ liền kề Quốc khánh',
    'Ngày Quốc khánh',
  ];

  await t.test('KR-12 — BUG-HRM-51: Tạo nhanh 2027 sau khi đã có 2026 chỉ thêm 6 ngày âm lịch', async () => {
    await xoaHetLe();

    const nam2026 = await goi('KR-12', 'quick-generate 2026', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2026 },
    });
    assert.equal(nam2026.status, 200, nam2026.raw);
    assert.equal(nam2026.json.data.addedCount, 11);
    soatBatBien(nam2026.json.data, 'ghi thật 2026');
    assert.equal(await dbA().holiday.count(), 11);

    // (a) Xem trước 2027 — 5 ngày dương lịch phải hiện nhãn "đã có", không ghi dòng nào.
    const xemTruoc = await goi('KR-12', 'dryRun 2027', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2027, dryRun: true },
    });
    assert.equal(xemTruoc.status, 200, xemTruoc.raw);
    assert.equal(xemTruoc.json.data.totalStandard, 11, 'totalStandard giữ nguyên 11');
    assert.equal(
      xemTruoc.json.data.addedCount,
      6,
      `phải chỉ còn 6 ngày âm lịch; bản lỗi báo 11: ${xemTruoc.raw}`,
    );
    assert.equal(xemTruoc.json.data.skippedCount, 5);
    soatBatBien(xemTruoc.json.data, 'dryRun 2027');
    const mucTetDuong = xemTruoc.json.data.items.find(
      (i: { date: string }) => i.date === '2027-01-01',
    );
    assert.ok(mucTetDuong, 'vẫn phải liệt kê 01/01/2027 trong bản xem trước');
    assert.equal(mucTetDuong.alreadyCovered, true, `01/01/2027 phải mang nhãn đã có: ${xemTruoc.raw}`);
    assert.equal(await dbA().holiday.count(), 11, 'dryRun không được ghi dòng nào');

    // (b) Ghi thật 2027 — phải khớp bản xem trước từng con số và từng mục.
    const that = await goi('KR-12', 'quick-generate 2027 thật', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2027 },
    });
    assert.equal(that.status, 200, that.raw);
    assert.equal(that.json.data.addedCount, 6);
    assert.equal(that.json.data.skippedCount, 5);
    soatBatBien(that.json.data, 'ghi thật 2027');
    assert.deepEqual(
      that.json.data.items,
      xemTruoc.json.data.items,
      'xem trước và ghi thật phải là MỘT, kể cả nhãn alreadyCovered',
    );

    // (c) Bằng chứng nặng nhất — đếm thẳng trong DB tenant.
    assert.equal(await dbA().holiday.count(), 17, '11 dòng của 2026 cộng 6 ngày âm lịch của 2027');
    const trongDb = (await dbA().holiday.findMany({ orderBy: { date: 'asc' } })).map((h) => ({
      date: h.date.toISOString().slice(0, 10),
      name: h.name,
      isAnnual: h.isAnnual,
    }));
    assert.ok(
      !trongDb.some((h) => h.date === '2027-01-01'),
      `ĐÃ SINH DÒNG TRÙNG NGHĨA 2027-01-01: ${JSON.stringify(trongDb)}`,
    );
    for (const ten of TEN_LE_DUONG_LICH) {
      const dong = trongDb.filter((h) => h.name === ten);
      assert.equal(dong.length, 1, `"${ten}" bị nhân đôi: ${JSON.stringify(dong)}`);
      assert.equal(dong[0].date.slice(0, 4), '2026', 'dòng giữ lại phải là dòng của năm chạy đầu');
    }
    assert.equal(
      trongDb.filter((h) => h.date.startsWith('2027-')).length,
      6,
      'năm 2027 chỉ được có đúng 6 dòng, tất cả là lễ âm lịch',
    );

    // (d) Bấm lại 2027 lần nữa: không thêm gì.
    const lanBa = await goi('KR-12', 'quick-generate 2027 lần 2', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2027 },
    });
    assert.equal(lanBa.json.data.addedCount, 0);
    assert.equal(lanBa.json.data.skippedCount, 11);
    soatBatBien(lanBa.json.data, 'ghi thật 2027 lần 2');
    assert.equal(await dbA().holiday.count(), 17, 'bấm lại không được thêm dòng nào');
  });

  await t.test('KR-13 — BUG-HRM-51: chạy 2026→2030 liên tiếp, mỗi ngày dương lịch chỉ còn 1 dòng', async () => {
    await xoaHetLe();
    for (let y = 2026; y <= 2030; y++) {
      const r = await goi('KR-13', `quick-generate ${y}`, 'POST', `${BASE}/holidays/quick-generate`, {
        ve: veOwnerA,
        payload: { year: y },
      });
      assert.equal(r.status, 200, r.raw);
      assert.equal(r.json.data.addedCount, y === 2026 ? 11 : 6, `năm ${y}: ${r.raw}`);
      soatBatBien(r.json.data, `ghi thật ${y}`);
    }

    const trongDb = await dbA().holiday.findMany({ orderBy: { date: 'asc' } });
    for (const ten of TEN_LE_DUONG_LICH) {
      const dong = trongDb.filter((h) => h.name === ten);
      assert.equal(
        dong.length,
        1,
        `"${ten}" có ${dong.length} dòng: ${dong.map((d) => d.date.toISOString().slice(0, 10)).join(', ')}`,
      );
    }
    // 5 dòng dương lịch + 6 ngày âm lịch × 5 năm = 35. Bản lỗi để lại 5×5 + 30 = 55.
    assert.equal(trongDb.length, 5 + 6 * 5, `tổng số dòng sai: ${trongDb.length}`);
  });

  await t.test('KR-14 — BUG-HRM-51: dòng cũ isAnnual=false vẫn cần dòng riêng cho năm sau', async () => {
    await xoaHetLe();
    const tao = await goi('KR-14', 'tạo 01/01/2026 KHÔNG lặp hàng năm', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-01-01',
        name: 'Tết Dương lịch',
        type: 'NATIONAL',
        isAnnual: false,
        isPaid: true,
      },
    });
    assert.equal(tao.status, 201, tao.raw);

    const r = await goi('KR-14', 'quick-generate 2027', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2027 },
    });
    assert.equal(r.status, 200, r.raw);
    const muc = r.json.data.items.find((i: { date: string }) => i.date === '2027-01-01');
    assert.ok(muc);
    assert.equal(
      muc.alreadyCovered,
      false,
      `dòng cũ không bật cờ lặp hàng năm chỉ phủ đúng năm của nó: ${r.raw}`,
    );
    assert.equal(r.json.data.addedCount, 11);
    soatBatBien(r.json.data, 'ghi thật 2027 sau dòng isAnnual=false');
    assert.equal(
      await dbA().holiday.count({ where: { name: 'Tết Dương lịch' } }),
      2,
      'phải có đủ hai dòng: 2026 (không lặp) và 2027 (lặp)',
    );
  });

  await t.test('KR-16 — BUG-HRM-51: quy tắc phủ so CẢ TÊN, dòng cùng ngày khác tên không nuốt mục chuẩn', async () => {
    /*
     * Ca này sinh ra từ kiểm thử đột biến: gieo lỗi "quy tắc phủ chỉ so ngày/tháng, bỏ tên" thì
     * toàn bộ bộ tích hợp vẫn xanh. Dòng gieo dưới đây tạo được bằng đường API bình thường —
     * công ty đặt một ngày nghỉ mang tên "Tết Dương lịch" vào 30/04 và bật cờ lặp hàng năm. Bỏ
     * phép so tên thì nó nuốt mất "Ngày Giải phóng miền Nam" 30/04 của MỌI năm về sau.
     */
    await xoaHetLe();
    const gieo = await goi('KR-16', 'tạo "Tết Dương lịch" vào 30/04', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-04-30',
        name: 'Tết Dương lịch',
        type: 'NATIONAL',
        isAnnual: true,
        isPaid: true,
      },
    });
    assert.equal(gieo.status, 201, gieo.raw);

    const r = await goi('KR-16', 'quick-generate 2027', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2027 },
    });
    assert.equal(r.status, 200, r.raw);
    const giaiPhong = r.json.data.items.find((i: { date: string }) => i.date === '2027-04-30');
    assert.ok(giaiPhong);
    assert.equal(giaiPhong.name, 'Ngày Giải phóng miền Nam');
    assert.equal(
      giaiPhong.alreadyCovered,
      false,
      `dòng cùng NGÀY nhưng khác TÊN không được phủ mục chuẩn: ${r.raw}`,
    );
    assert.equal(r.json.data.addedCount, 11, 'không mục chuẩn nào bị phủ');
    soatBatBien(r.json.data, 'ghi thật 2027 khi có dòng cùng ngày khác tên');
    assert.equal(
      await dbA().holiday.count({ where: { name: 'Ngày Giải phóng miền Nam' } }),
      1,
      'Ngày Giải phóng miền Nam 2027 phải thực sự được tạo',
    );
  });

  await t.test('KR-15 — BUG-HRM-51 CHỐNG HỒI QUY: lễ ÂM LỊCH không bao giờ bị quy tắc phủ chặn', async () => {
    /*
     * Ngày dương của lễ âm đổi mỗi năm nên chúng mang `isAnnual = false` và mỗi năm phải có dòng
     * riêng. Ca này gieo THẲNG VÀO DB một dòng chỉ có thể tạo bằng đường ghi trực tiếp (`E-hrm-075`
     * chặn `LUNAR` + `isAnnual = true` ở cả POST lẫn PATCH): cùng TÊN với Mùng 1 Tết 2027, cùng
     * NGÀY/THÁNG 06/02, khác NĂM, và bật cờ lặp hàng năm. Quy tắc phủ mà không kiểm cờ `isAnnual`
     * của chính MỤC CHUẨN thì dòng này nuốt mất Mùng 1 Tết 2027 — lịch nghỉ Tết biến mất, sai
     * lương ngày lễ, và sai theo kiểu không ai nhìn thấy.
     */
    await xoaHetLe();
    await dbA().holiday.create({
      data: {
        id: 'kr15-bay-am-lich',
        date: new Date('2026-02-06T00:00:00.000Z'),
        name: 'Tết Nguyên Đán (Mùng 1)',
        type: 'LUNAR',
        isAnnual: true, // chỉ ghi thẳng DB mới tạo được dòng như thế này
        isPaid: true,
      },
    });

    const r = await goi('KR-15', 'quick-generate 2027 khi có dòng bẫy', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2027 },
    });
    assert.equal(r.status, 200, r.raw);
    const mung1 = r.json.data.items.find((i: { date: string }) => i.date === '2027-02-06');
    assert.ok(mung1, 'Mùng 1 Tết 2027 phải nằm trong danh sách');
    assert.equal(mung1.name, 'Tết Nguyên Đán (Mùng 1)');
    assert.equal(
      mung1.alreadyCovered,
      false,
      `lễ âm lịch bị chặn nhầm bởi dòng lặp hàng năm: ${r.raw}`,
    );
    assert.equal(r.json.data.addedCount, 11, 'không mục chuẩn nào của 2027 được coi là đã phủ');
    soatBatBien(r.json.data, 'ghi thật 2027 khi có dòng bẫy');

    const co2027 = await dbA().holiday.count({
      where: { date: new Date('2027-02-06T00:00:00.000Z') },
    });
    assert.equal(co2027, 1, 'Mùng 1 Tết 2027 phải thực sự nằm trong DB');

    // Sáu ngày âm lịch của 2028 cũng phải ra đủ, không bị 2027 vừa tạo phủ mất.
    const nam2028 = await goi('KR-15', 'quick-generate 2028', 'POST', `${BASE}/holidays/quick-generate`, {
      ve: veOwnerA,
      payload: { year: 2028 },
    });
    assert.equal(nam2028.status, 200, nam2028.raw);
    assert.equal(
      nam2028.json.data.items.filter(
        (i: { type: string; alreadyCovered: boolean }) =>
          i.type === 'LUNAR' && i.alreadyCovered === false,
      ).length,
      6,
      `sáu ngày âm lịch của 2028 phải đều được tạo: ${nam2028.raw}`,
    );
    assert.equal(nam2028.json.data.addedCount, 6);
    soatBatBien(nam2028.json.data, 'ghi thật 2028');
  });

  await t.test('TC-hrm-325 — biên năm hợp lệ 2024 và 2030', async () => {
    /*
     * Ý đồ của ca này là kiểm **biên năm** (hai đầu mút đều chạy được, thuật toán âm lịch phủ
     * đủ 11 ngày), nên mỗi năm phải được thử trên một tenant TRẮNG. Dọn bảng trong vòng lặp chứ
     * không chỉ một lần trước vòng lặp: từ `BUG-HRM-51`, 5 ngày dương lịch của năm chạy trước
     * PHỦ luôn năm chạy sau (đó chính là bản vá), nên chạy hai năm trên cùng dữ liệu sẽ ra
     * `addedCount = 6` — đúng hành vi mới, nhưng làm ca này kiểm nhầm thứ. Hành vi liên-năm đã có
     * `KR-12`/`KR-13` phủ riêng.
     */
    for (const y of [2024, 2030]) {
      await xoaHetLe();
      const r = await goi('TC-hrm-325', `năm ${y}`, 'POST', `${BASE}/holidays/quick-generate`, {
        ve: veOwnerA,
        payload: { year: y },
      });
      assert.equal(r.status, 200, r.raw);
      assert.equal(r.json.data.totalStandard, 11, `thuật toán âm lịch phải phủ năm ${y}`);
      assert.equal(r.json.data.addedCount, 11);
      assert.equal(
        r.json.data.items.filter((i: { date: string }) => i.date.startsWith(String(y))).length,
        11,
        `cả 11 ngày trả về phải thuộc năm ${y}`,
      );
    }
  });

  await t.test('TC-hrm-326 — ngoài dải 2024–2030 -> 400', async () => {
    /*
     * Ca này kiểm hai điều cùng lúc:
     *   (a) hai năm SÁT ngoài dải bị từ chối 400 (không phải 500, không phải lặng lẽ tạo);
     *   (b) câu lỗi `E-hrm-079` đi tới client đúng nguyên văn hợp đồng.
     */
    const cauMongDoi = 'Năm khởi tạo ngày lễ phải nằm trong khoảng từ 2024 đến 2030.';

    for (const y of [2023, 2031]) {
      const r = await goi('TC-hrm-326', `năm ${y}`, 'POST', `${BASE}/holidays/quick-generate`, {
        ve: veOwnerA,
        payload: { year: y },
      });
      assert.equal(r.status, 400, `năm ${y} phải bị từ chối: ${r.raw}`);
      assert.ok(
        JSON.stringify(r.json).includes(cauMongDoi),
        `thân lỗi phải nêu dải 2024–2030, nhận: ${r.raw}`,
      );
    }
    await xoaHetLe();
  });

  await t.test('KR-09 — khoảng trắng thừa ở tên ngày lễ bị .trim() (BUG-HRM-49)', async () => {
    await xoaHetLe();
    const g = await goi('KR-09', 'tạo tên chuẩn', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: { date: '2026-01-01', name: 'Tết Dương lịch', type: 'NATIONAL', isAnnual: true },
    });
    assert.equal(g.status, 201, g.raw);
    const t2 = await goi('KR-09', 'tạo tên có khoảng trắng thừa', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-01-01',
        name: '  Tết Dương lịch  ',
        type: 'NATIONAL',
        isAnnual: true,
      },
    });
    assert.equal(t2.status, 409, `khoảng trắng thừa phải bị .trim() rồi chặn trùng: ${t2.raw}`);
    assert.equal(await dbA().holiday.count(), 1, 'chỉ được tồn tại 1 bản ghi');
  });

  await t.test('TC-hrm-327 — cô lập tenant: B không thấy ngày lễ của A', async () => {
    await xoaHetLe();
    const a = await goi('TC-hrm-327', 'A tạo lễ riêng', 'POST', `${BASE}/holidays`, {
      ve: veOwnerA,
      payload: {
        date: '2026-06-15',
        name: 'Kỷ niệm thành lập công ty A',
        type: 'COMPANY',
        isAnnual: true,
      },
    });
    assert.equal(a.status, 201, a.raw);

    const b = await goi('TC-hrm-327', 'B xem danh sách', 'GET', `${BASE}/holidays?filter=ALL`, {
      ve: veOwnerB,
    });
    assert.equal(b.status, 200, b.raw);
    assert.equal(b.json.data.total, 0, `B phải không thấy gì: ${b.raw}`);

    // Chiều ngược lại: B tạo, A không thấy.
    const b2 = await goi('TC-hrm-327', 'B tạo lễ riêng', 'POST', `${BASE}/holidays`, {
      ve: veOwnerB,
      payload: {
        date: '2026-07-20',
        name: 'Kỷ niệm thành lập công ty B',
        type: 'COMPANY',
        isAnnual: true,
      },
    });
    assert.equal(b2.status, 201, b2.raw);
    const a2 = await goi('TC-hrm-327', 'A xem danh sách', 'GET', `${BASE}/holidays?filter=ALL`, {
      ve: veOwnerA,
    });
    assert.equal(a2.json.data.total, 1);
    assert.equal(a2.json.data.items[0].name, 'Kỷ niệm thành lập công ty A');
  });
});

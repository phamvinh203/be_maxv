import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { sysPrisma } from '../config/db.sys';
import { hashPassword } from '../utils/password';
import { tenantSlug } from '../utils/dbName';

/**
 * Test admin quản lý owner-centric + kiểm soát trần MST (override).
 *   npx tsx --test src/__tests__/adminOwner.test.ts
 */

const PW = 'Test1234';
const ADMIN = 'phase8.admin@test.local';
const OWNER = 'phase8.owner@test.local';
const MST1 = '9980000001';
const MST_NEW = '9980000002';
const PLAN_MA = 'PHASE8_PLAN';

let app: FastifyInstance;
let ownerId = '';
let companyId = '';

async function cleanup() {
  await sysPrisma.user.deleteMany({ where: { email: { in: [ADMIN, OWNER] } } });
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
}

function authH(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: PW },
  });
  assert.equal(res.statusCode, 200, `login ${email}: ${res.body}`);
  return res.json().data.accessToken as string;
}

before(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
  await cleanup();

  const pwHash = await hashPassword(PW);
  await sysPrisma.user.create({
    data: {
      email: ADMIN,
      hoTen: 'Admin',
      password: pwHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  const owner = await sysPrisma.user.create({
    data: {
      email: OWNER,
      hoTen: 'Owner P8',
      password: pwHash,
      role: 'OWNER',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  ownerId = owner.id;

  // 1 công ty + subscription gói (soMstToiDa=2), chưa override.
  const c1 = await sysPrisma.donVi.create({
    data: {
      ownerId,
      maSoThue: MST1,
      slug: tenantSlug(MST1),
      tenDonVi: 'Cty P8',
      status: 'READY',
      dbName: `test_${MST1}`,
    },
  });
  companyId = c1.id;
  const plan = await sysPrisma.subscriptionPlan.create({
    data: { ma: PLAN_MA, ten: 'P8', gia: 0, chuKyThang: 1, soMstToiDa: 2, soNguoiToiDa: 5 },
  });
  await sysPrisma.subscription.create({
    data: { ownerId, planId: plan.id, status: 'ACTIVE' },
  });
});

after(async () => {
  await cleanup();
  await app.close();
  await sysPrisma.$disconnect();
});

test('admin owner-centric + trần MST override', async (t) => {
  const adminToken = await login(ADMIN);
  const ownerToken = await login(OWNER);

  await t.test('① GET /admin/owners — thấy owner + giới hạn theo gói', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/owners',
      headers: authH(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const me = res.json().data.data.find((o: { id: string }) => o.id === ownerId);
    assert.ok(me, 'owner phải có trong danh sách');
    assert.equal(me.soCongTy, 1);
    assert.equal(me.gioiHan.soMstToiDa, 2, 'giới hạn theo gói');
    assert.equal(me.override.soMstToiDa, null);
  });

  await t.test('② GET /admin/owners/:id — chi tiết MST/DB', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/owners/${ownerId}`,
      headers: authH(adminToken),
    });
    assert.equal(res.statusCode, 200);
    const d = res.json().data;
    assert.equal(d.soCongTy, 1);
    assert.equal(d.congTy.length, 1);
    assert.equal(d.congTy[0].maSoThue, MST1);
    assert.equal(d.congTy[0].dbExists, false, 'DB test không tồn tại thật');
    assert.equal(d.gioiHan.soMstToiDa, 2);
  });

  await t.test('③ PATCH limits — admin nâng trần MST lên 5', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/owners/${ownerId}/limits`,
      headers: authH(adminToken),
      payload: { soMstToiDaOverride: 5 },
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.gioiHan.soMstToiDa, 5);
  });

  await t.test('④ hạ trần về 1 -> owner (đã có 1 MST) bị chặn tạo thêm', async () => {
    const set = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/owners/${ownerId}/limits`,
      headers: authH(adminToken),
      payload: { soMstToiDaOverride: 1 },
    });
    assert.equal(set.statusCode, 200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: authH(ownerToken),
      payload: { tenCongTy: 'Cty moi', maSoThue: MST_NEW, diaChi: 'HN' },
    });
    assert.equal(create.statusCode, 403, `phải bị chặn theo override: ${create.body}`);
    const created = await sysPrisma.donVi.findUnique({ where: { maSoThue: MST_NEW } });
    assert.equal(created, null);
  });

  await t.test('⑤ xóa override (null) -> quay lại giới hạn gói (2)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/owners/${ownerId}/limits`,
      headers: authH(adminToken),
      payload: { soMstToiDaOverride: null },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.override.soMstToiDa, null);
    assert.equal(res.json().data.gioiHan.soMstToiDa, 2, 'về theo gói');
  });

  await t.test('⑥ owner thường không gọi được API admin (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/owners',
      headers: authH(ownerToken),
    });
    assert.equal(res.statusCode, 403);
  });
});

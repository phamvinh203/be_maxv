import { test, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../utils/password';

/**
 * Bootstrap control-plane cho seed dữ liệu mẫu HRM (scripts/hrm/seed-control-plane.ts).
 *
 * vbsec 2026-09-10 (MEDIUM, seed-control-plane.ts:26): tài khoản OWNER gói full-feature với mật khẩu CỨNG
 * trong mã nguồn (`12345abc`); email đã có thì lặng lẽ ĐẶT LẠI mật khẩu, nâng OWNER, mở khóa. Chạy nhầm vào
 * DB không phải dev (guard chỉ dựa `NODE_ENV`) là chiếm được tài khoản đó bằng mật khẩu ai cũng đọc được.
 *
 * sysPrisma + provisioning thay bằng bản giả ghi lại mọi lượt ghi.
 */

type Row = Record<string, unknown>;

const ghi: string[] = [];
const kho: {
  user: Row | null;
  donVi: Row | null;
  plan: Row | null;
  sub: Row | null;
} = {
  user: null,
  donVi: null,
  plan: null,
  sub: null,
};

let ensureControlPlaneTestTenant: typeof import('../../scripts/hrm/seed-control-plane').ensureControlPlaneTestTenant;

before(async () => {
  const sysPrisma = {
    user: {
      findUnique: async () => kho.user,
      create: async ({ data }: { data: Row }) => {
        ghi.push('user.create');
        kho.user = { id: 'owner-1', ...data };
        return kho.user;
      },
      update: async ({ data }: { data: Row }) => {
        ghi.push(`user.update:${Object.keys(data).join(',')}`);
        Object.assign(kho.user!, data);
        return kho.user;
      },
    },
    donVi: {
      findUnique: async () => kho.donVi,
      findUniqueOrThrow: async () => kho.donVi,
      create: async ({ data }: { data: Row }) => {
        ghi.push('donVi.create');
        kho.donVi = { id: 'dv-1', ...data };
        return kho.donVi;
      },
    },
    subscriptionPlan: {
      findFirst: async () => kho.plan,
      findUniqueOrThrow: async () => kho.plan,
      create: async ({ data }: { data: Row }) => {
        ghi.push('plan.create');
        kho.plan = { id: 'plan-1', ...data };
        return kho.plan;
      },
    },
    subscription: {
      findUnique: async () => kho.sub,
      create: async ({ data }: { data: Row }) => {
        ghi.push('subscription.create');
        kho.sub = { id: 'sub-1', ...data };
        return kho.sub;
      },
      update: async ({ data }: { data: Row }) => {
        ghi.push('subscription.update');
        Object.assign(kho.sub!, data);
        return kho.sub;
      },
    },
  };
  mock.module('../../config/db.sys', { namedExports: { sysPrisma } });
  mock.module('../../services/shared/provisioning.service', {
    namedExports: {
      provisionTenant: async () => {
        ghi.push('provisionTenant');
        kho.donVi!.status = 'READY';
        return 'maxv_0111142786_app';
      },
      tenantDbExists: async () => true,
    },
  });
  ({ ensureControlPlaneTestTenant } =
    await import('../../scripts/hrm/seed-control-plane'));
});

const envCu = process.env.SEED_OWNER_PASSWORD;

beforeEach(() => {
  ghi.length = 0;
  kho.user = null;
  kho.donVi = null;
  kho.plan = null;
  kho.sub = null;
  delete process.env.SEED_OWNER_PASSWORD;
});

afterEach(() => {
  if (envCu === undefined) delete process.env.SEED_OWNER_PASSWORD;
  else process.env.SEED_OWNER_PASSWORD = envCu;
});

async function taiKhoanCoSan(matKhau: string, them: Row = {}) {
  kho.user = {
    id: 'owner-1',
    email: 'test1@gmail.com',
    password: await hashPassword(matKhau),
    role: 'OWNER',
    status: 'ACTIVE',
    isActive: true,
    ...them,
  };
}

test('không có mật khẩu trong mã nguồn: thiếu SEED_OWNER_PASSWORD thì dừng, không ghi gì', async () => {
  await assert.rejects(ensureControlPlaneTestTenant(), /SEED_OWNER_PASSWORD/);
  assert.deepEqual(ghi, []);
});

test('tài khoản có sẵn mà mật khẩu KHÁC: dừng, KHÔNG đặt lại mật khẩu', async () => {
  process.env.SEED_OWNER_PASSWORD = 'mat-khau-seed-moi';
  await taiKhoanCoSan('mat-khau-nguoi-dung-dang-dung');

  await assert.rejects(ensureControlPlaneTestTenant(), /DỪNG LẠI/);
  assert.deepEqual(ghi, []);
  assert.equal(
    await verifyPassword(
      'mat-khau-nguoi-dung-dang-dung',
      kho.user!.password as string,
    ),
    true,
  );
});

test('tài khoản có sẵn không phải OWNER: dừng, KHÔNG nâng quyền', async () => {
  process.env.SEED_OWNER_PASSWORD = 'mat-khau-seed';
  await taiKhoanCoSan('mat-khau-seed', { role: 'OWNER_EMPLOYEE' });

  await assert.rejects(ensureControlPlaneTestTenant(), /DỪNG LẠI/);
  assert.deepEqual(ghi, []);
});

test('tài khoản có sẵn đang bị khóa: dừng, KHÔNG tự mở khóa', async () => {
  process.env.SEED_OWNER_PASSWORD = 'mat-khau-seed';
  await taiKhoanCoSan('mat-khau-seed', {
    status: 'SUSPENDED',
    isActive: false,
  });

  await assert.rejects(ensureControlPlaneTestTenant(), /DỪNG LẠI/);
  assert.deepEqual(ghi, []);
});

test('tài khoản có sẵn đúng chuẩn: giữ nguyên tài khoản, dựng tiếp công ty + gói', async () => {
  process.env.SEED_OWNER_PASSWORD = 'mat-khau-seed';
  await taiKhoanCoSan('mat-khau-seed');

  const kq = await ensureControlPlaneTestTenant();
  assert.equal(kq.ownerId, 'owner-1');
  assert.equal(ghi.filter((g) => g.startsWith('user.')).length, 0);
  assert.ok(ghi.includes('donVi.create'));
});

test('chưa có tài khoản: tạo mới với mật khẩu lấy từ SEED_OWNER_PASSWORD', async () => {
  process.env.SEED_OWNER_PASSWORD = 'mat-khau-seed';

  await ensureControlPlaneTestTenant();
  assert.ok(ghi.includes('user.create'));
  assert.equal(
    await verifyPassword('mat-khau-seed', kho.user!.password as string),
    true,
  );
});

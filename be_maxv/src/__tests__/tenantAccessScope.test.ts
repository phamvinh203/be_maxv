import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from '../helpers/errors';

/**
 * Phạm vi "user được thao tác trên những công ty nào" (helpers/access.ts) — nguồn duy nhất cho
 * switch công ty (`canAccessDonVi`), danh sách/đăng nhập (`listAccessibleCompanies`) và MỌI request
 * vào DB tenant (`resolveTenantInfo`).
 *
 * Lỗ hổng vbsec 2026-09-10 [5]: admin "tạm khóa truy cập" (`POST /admin/companies/:id/suspend`) chỉ
 * đặt `status = 'SUSPENDED'`, nhưng phạm vi chỉ loại `ARCHIVED` — công ty bị khóa vẫn vào được, đọc
 * ghi DB tenant và dùng mật khẩu cổng thuế đã lưu như chưa hề bị khóa.
 *
 * Chỉ thay control plane (`sysPrisma`) bằng kho trong bộ nhớ; bộ lọc giả bên dưới áp đúng các điều
 * kiện Prisma mà code sinh ra và NÉM LỖI khi gặp điều kiện chưa hỗ trợ (để test không âm thầm đạt).
 */

interface DonViGia {
  id: string;
  ownerId: string;
  status: 'PROVISIONING' | 'READY' | 'FAILED' | 'SUSPENDED' | 'ARCHIVED';
  dbName: string | null;
  maSoThue: string;
  createdAt: Date;
  access: Array<{ userId: string; xemLuong: boolean }>;
}

const donViTrongDb: DonViGia[] = [
  {
    id: 'dv-ready',
    ownerId: 'owner-1',
    status: 'READY',
    dbName: 'maxv_0100000001_app',
    maSoThue: '0100000001',
    createdAt: new Date('2026-01-01'),
    access: [{ userId: 'nv-1', xemLuong: false }],
  },
  {
    id: 'dv-khoa',
    ownerId: 'owner-1',
    status: 'SUSPENDED',
    dbName: 'maxv_0100000002_app',
    maSoThue: '0100000002',
    createdAt: new Date('2026-01-02'),
    access: [{ userId: 'nv-1', xemLuong: true }],
  },
  {
    id: 'dv-luu-tru',
    ownerId: 'owner-1',
    status: 'ARCHIVED',
    dbName: 'maxv_0100000003_app',
    maSoThue: '0100000003',
    createdAt: new Date('2026-01-03'),
    access: [],
  },
];

function khopDieuKien(row: DonViGia, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([truong, dieuKien]) => {
    if (truong === 'access') {
      const userId = (dieuKien as { some: { userId: string } }).some.userId;
      return row.access.some((a) => a.userId === userId);
    }
    const giaTri = row[truong as keyof DonViGia];
    if (dieuKien !== null && typeof dieuKien === 'object') {
      const dk = dieuKien as {
        not?: unknown;
        notIn?: unknown[];
        in?: unknown[];
      };
      if ('not' in dk) return giaTri !== dk.not;
      if ('notIn' in dk) return !dk.notIn!.includes(giaTri);
      if ('in' in dk) return dk.in!.includes(giaTri);
      throw new Error(
        `bộ lọc giả chưa hỗ trợ điều kiện ${truong}: ${JSON.stringify(dieuKien)}`,
      );
    }
    return giaTri === dieuKien;
  });
}

let canAccessDonVi: typeof import('../helpers/access').canAccessDonVi;
let resolveTenantInfo: typeof import('../helpers/resolveTenantDb').resolveTenantInfo;
let listAccessibleCompanies: typeof import('../services/shared/companyAccess.service').listAccessibleCompanies;

before(async () => {
  mock.module('../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: {
          findFirst: async ({ where }: { where: Record<string, unknown> }) => {
            const row = donViTrongDb.find((r) => khopDieuKien(r, where));
            return row
              ? {
                  ...row,
                  access: row.access.map((a) => ({ xemLuong: a.xemLuong })),
                }
              : null;
          },
          findMany: async ({ where }: { where: Record<string, unknown> }) =>
            donViTrongDb
              .filter((r) => khopDieuKien(r, where))
              .map((r) => ({
                id: r.id,
                maSoThue: r.maSoThue,
                status: r.status,
              })),
        },
      },
    },
  });
  ({ canAccessDonVi } = await import('../helpers/access'));
  ({ resolveTenantInfo } = await import('../helpers/resolveTenantDb'));
  ({ listAccessibleCompanies } =
    await import('../services/shared/companyAccess.service'));
});

function requestCua(userId: string, role: string, donViId: string) {
  return {
    user: { userId, role, donViId, tokenVersion: 0 },
  } as unknown as FastifyRequest;
}

test('công ty SUSPENDED: OWNER và nhân viên được cấp quyền đều không switch vào được', async () => {
  assert.equal(await canAccessDonVi('owner-1', 'OWNER', 'dv-khoa'), false);
  assert.equal(
    await canAccessDonVi('nv-1', 'OWNER_EMPLOYEE', 'dv-khoa'),
    false,
  );
});

test('công ty SUSPENDED: mọi request vào DB tenant bị chặn 403 (resolveTenantInfo)', async () => {
  await assert.rejects(
    resolveTenantInfo(requestCua('owner-1', 'OWNER', 'dv-khoa')),
    ForbiddenError,
  );
  await assert.rejects(
    resolveTenantInfo(requestCua('nv-1', 'OWNER_EMPLOYEE', 'dv-khoa')),
    ForbiddenError,
  );
});

test('công ty SUSPENDED/ARCHIVED không có trong danh sách công ty (login, chọn công ty)', async () => {
  const cuaOwner = await listAccessibleCompanies('owner-1', 'OWNER');
  assert.deepEqual(
    cuaOwner.map((c) => c.id),
    ['dv-ready'],
  );

  const cuaNhanVien = await listAccessibleCompanies('nv-1', 'OWNER_EMPLOYEE');
  assert.deepEqual(
    cuaNhanVien.map((c) => c.id),
    ['dv-ready'],
  );
});

test('công ty READY vẫn dùng bình thường (không chặn nhầm)', async () => {
  assert.equal(await canAccessDonVi('owner-1', 'OWNER', 'dv-ready'), true);
  assert.equal(
    await canAccessDonVi('nv-1', 'OWNER_EMPLOYEE', 'dv-ready'),
    true,
  );

  const info = await resolveTenantInfo(
    requestCua('nv-1', 'OWNER_EMPLOYEE', 'dv-ready'),
  );
  assert.deepEqual(info, {
    dbName: 'maxv_0100000001_app',
    maSoThue: '0100000001',
    xemLuong: false,
  });
});

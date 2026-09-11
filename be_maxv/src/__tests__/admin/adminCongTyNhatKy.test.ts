import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictError } from '../../helpers/errors';

/**
 * vbsec 2026-09-10 (LOW):
 *  - adminCompany.service.ts:59 — `GET /admin/companies/:id` dùng `include` -> trả MỌI cột DonVi, gồm
 *    cipher/iv/tag mật khẩu cổng HĐĐT/DVC và refresh token Google Drive.
 *  - adminCompany.service.ts:108 — retry-provision kiểm `FAILED` rồi update không điều kiện -> hai lần bấm
 *    chạy hai saga cấp DB trên cùng một công ty.
 *  - adminLog.service.ts:46 — `distinct` của Prisma (không bật nativeDistinct) kéo cả bảng syslog về lọc
 *    trong bộ nhớ.
 *
 * sysPrisma + provisioning thay bằng bản giả mô phỏng đúng ngữ nghĩa select/include/updateMany của Prisma.
 */

const DONG_DON_VI: Record<string, unknown> = {
  id: 'dv-1',
  maSoThue: '0100000000',
  slug: 'maxv_0100000000',
  tenDonVi: 'Cty A',
  diaChi: null,
  sdt: null,
  loaiHinhKinhDoanh: null,
  gdtPasswordCipher: 'CIPHER-GDT',
  gdtPasswordIv: 'IV-GDT',
  gdtPasswordTag: 'TAG-GDT',
  dvcUsername: '0100000000-ql',
  dvcPasswordCipher: 'CIPHER-DVC',
  dvcPasswordIv: 'IV-DVC',
  dvcPasswordTag: 'TAG-DVC',
  driveEmail: 'kt@congty.vn',
  driveRootFolderId: 'folder',
  driveRefreshTokenCipher: 'CIPHER-DRIVE',
  driveRefreshTokenIv: 'IV-DRIVE',
  driveRefreshTokenTag: 'TAG-DRIVE',
  ownerId: 'owner-1',
  status: 'FAILED',
  dbName: null,
  provisionedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

/** Trạng thái THẬT lúc ghi (lượt retry khác có thể đã đổi); `findUnique` trả bản đọc cũ. */
let trangThaiThat = 'FAILED';
let soLanCapDb = 0;
const goiSysLog: string[] = [];

type Args = { where?: unknown; select?: Record<string, unknown>; include?: Record<string, unknown> };

function giaLapSelectInclude(dong: Record<string, unknown>, args: Args) {
  if (args.select) {
    return Object.fromEntries(
      Object.keys(args.select).map((k) => [k, k === 'owner' ? { id: 'owner-1' } : k === 'access' ? [] : dong[k]]),
    );
  }
  // include: MỌI cột scalar + quan hệ được include.
  return { ...dong, owner: { id: 'owner-1' }, access: [] };
}

let adminGetCompany: typeof import('../../services/admin/adminCompany.service').adminGetCompany;
let adminRetryProvision: typeof import('../../services/admin/adminCompany.service').adminRetryProvision;
let adminListLogActions: typeof import('../../services/admin/adminLog.service').adminListLogActions;

before(async () => {
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: {
          findUnique: async (args: Args) => giaLapSelectInclude(DONG_DON_VI, args),
          update: async () => ({}),
          updateMany: async ({ where }: { where: { status?: string } }) => {
            if (where.status && where.status !== trangThaiThat) return { count: 0 };
            trangThaiThat = 'PROVISIONING';
            return { count: 1 };
          },
        },
        sysLog: {
          findMany: async (args: { distinct?: unknown }) => {
            goiSysLog.push(args.distinct ? 'findMany+distinct' : 'findMany');
            return [{ hanhDong: 'LOGIN' }, { hanhDong: 'LOGOUT' }];
          },
          groupBy: async () => {
            goiSysLog.push('groupBy');
            return [{ hanhDong: 'LOGIN' }, { hanhDong: 'LOGOUT' }];
          },
        },
      },
    },
  });
  mock.module('../../services/shared/provisioning.service', {
    namedExports: {
      provisionTenant: async () => {
        soLanCapDb += 1;
        return 'maxv_0100000000_app';
      },
      tenantDbExists: async () => true,
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  ({ adminGetCompany, adminRetryProvision } = await import('../../services/admin/adminCompany.service'));
  ({ adminListLogActions } = await import('../../services/admin/adminLog.service'));
});

beforeEach(() => {
  trangThaiThat = 'FAILED';
  soLanCapDb = 0;
  goiSysLog.length = 0;
});

test('chi tiết công ty cho admin KHÔNG chứa cipher/iv/tag mật khẩu cổng thuế hay refresh token Drive', async () => {
  const cty = (await adminGetCompany('dv-1')) as Record<string, unknown>;

  const lo = Object.keys(cty).filter((k) => /Cipher|Iv$|Tag$/.test(k));
  assert.deepEqual(lo, []);
  // Vẫn đủ các cột màn admin cần.
  for (const k of ['id', 'maSoThue', 'tenDonVi', 'status', 'dbName', 'provisionedAt', 'createdAt', 'owner', 'access']) {
    assert.ok(k in cty, `thiếu ${k}`);
  }
});

test('retry-provision chen sau một lượt retry khác (đọc FAILED nhưng đã PROVISIONING) -> 409, không cấp DB lần 2', async () => {
  trangThaiThat = 'PROVISIONING';

  await assert.rejects(adminRetryProvision('dv-1', 'admin-1'), ConflictError);
  assert.equal(soLanCapDb, 0);
});

test('retry-provision bình thường vẫn cấp DB', async () => {
  await adminRetryProvision('dv-1', 'admin-1');
  assert.equal(soLanCapDb, 1);
});

test('danh sách hành động nhật ký gom nhóm DƯỚI DB (groupBy), không distinct trong bộ nhớ', async () => {
  assert.deepEqual(await adminListLogActions(), ['LOGIN', 'LOGOUT']);
  assert.deepEqual(goiSysLog, ['groupBy']);
});

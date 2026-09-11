import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedError } from '../helpers/errors';
import { hashPassword } from '../utils/password';

/**
 * Khóa đăng nhập theo TỪNG TÀI KHOẢN (`loginUser`, auth.service.ts).
 *
 * Lỗ hổng vbsec 2026-09-10 (MEDIUM, auth.service.ts:101): chỉ có rate limit 5/phút theo IP — xoay IP là
 * đoán mật khẩu một tài khoản không giới hạn. Phải đếm lần sai theo email và tạm khóa.
 *
 * Chỉ thay control plane (`sysPrisma`) + các dịch vụ phụ của nhánh đăng nhập thành công; so khớp
 * bcrypt chạy thật. Đồng hồ (`Date`) được giả lập để kiểm hết hạn khóa.
 */

const MAT_KHAU_DUNG = 'MatKhauDung123';
const SAI = 'DoanBua999';
let hashMatKhau = '';

let loginUser: typeof import('../services/client/auth.service').loginUser;

before(async () => {
  hashMatKhau = await hashPassword(MAT_KHAU_DUNG);
  mock.module('../config/db.sys', {
    namedExports: {
      sysPrisma: {
        user: {
          findUnique: async ({ where }: { where: { email: string } }) =>
            where.email.endsWith('@test.local')
              ? {
                  id: `id-${where.email}`,
                  email: where.email,
                  hoTen: 'Người dùng test',
                  role: 'OWNER',
                  isActive: true,
                  tokenVersion: 0,
                  password: hashMatKhau,
                }
              : null,
        },
      },
    },
  });
  mock.module('../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  mock.module('../services/shared/companyAccess.service', {
    namedExports: { listAccessibleCompanies: async () => [] },
  });
  mock.module('../services/shared/modules.service', {
    namedExports: { moduleCuaUser: async () => [] },
  });
  ({ loginUser } = await import('../services/client/auth.service'));
});

async function saiNLan(email: string, n: number) {
  for (let i = 0; i < n; i++) {
    await assert.rejects(
      loginUser({ email, password: SAI }),
      UnauthorizedError,
    );
  }
}

test('sai 5 lần liên tiếp -> lần thứ 6 dù ĐÚNG mật khẩu vẫn bị chặn (không cho đoán tiếp)', async () => {
  const email = 'bi-do-mat-khau@test.local';
  await saiNLan(email, 5);

  await assert.rejects(
    loginUser({ email, password: MAT_KHAU_DUNG }),
    UnauthorizedError,
  );
});

test('hết 15 phút khóa thì đăng nhập đúng lại được', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-10T08:00:00Z') });
  const email = 'het-khoa@test.local';
  await saiNLan(email, 5);

  t.mock.timers.tick(14 * 60_000);
  await assert.rejects(
    loginUser({ email, password: MAT_KHAU_DUNG }),
    UnauthorizedError,
    'phút thứ 14 vẫn còn khóa',
  );

  t.mock.timers.tick(2 * 60_000);
  const kq = await loginUser({ email, password: MAT_KHAU_DUNG });
  assert.equal(kq.user.email, email);
});

test('đăng nhập đúng xóa bộ đếm: 4 sai + 1 đúng + 4 sai vẫn chưa bị khóa', async () => {
  const email = 'go-nham@test.local';
  await saiNLan(email, 4);
  await loginUser({ email, password: MAT_KHAU_DUNG });
  await saiNLan(email, 4);

  const kq = await loginUser({ email, password: MAT_KHAU_DUNG });
  assert.equal(kq.user.email, email);
});

test('khóa theo TỪNG tài khoản: tài khoản khác không bị ảnh hưởng', async () => {
  await saiNLan('nan-nhan@test.local', 5);

  const kq = await loginUser({
    email: 'nguoi-khac@test.local',
    password: MAT_KHAU_DUNG,
  });
  assert.equal(kq.user.email, 'nguoi-khac@test.local');
});

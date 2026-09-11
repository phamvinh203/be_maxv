import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictError, UnauthorizedError } from '../../helpers/errors';

/**
 * Thao tác admin lên tài khoản người dùng (adminUser.service.ts) và hệ quả lên PHIÊN đang đăng nhập.
 *
 * Lỗ hổng vbsec 2026-09-10 (MEDIUM):
 *  - adminUser.service.ts:153 — admin đặt lại mật khẩu KHÔNG tăng `tokenVersion`: phiên của kẻ đã
 *    chiếm tài khoản vẫn refresh được sau khi reset (khác hẳn luồng tự đặt lại bằng OTP).
 *    Tương tự khóa rồi mở lại tài khoản làm sống lại mọi refresh token cũ.
 *  - adminUser.service.ts:148 — reset mật khẩu / khóa không chặn đích là ADMIN: một admin lấy được
 *    mật khẩu mới của admin khác, hoặc khóa hết các admin khác.
 *
 * Chỉ thay control plane (`sysPrisma`) bằng kho user trong bộ nhớ (áp đúng `{ increment }` của Prisma).
 * Kiểm hệ quả thật qua `loadUserForRefresh` — chỗ duy nhất quyết định refresh token còn dùng được.
 */

interface UserGia {
  id: string;
  email?: string;
  hoTen?: string;
  role: 'ADMIN' | 'OWNER' | 'OWNER_EMPLOYEE';
  ownerId: string | null;
  isActive: boolean;
  tokenVersion: number;
  password: string;
}

let khoUser = new Map<string, UserGia>();
const mailDaGui: Array<{ to: string; subject: string; text: string }> = [];
let mailHong = false;

function apDung(u: UserGia, data: Record<string, unknown>): void {
  for (const [truong, giaTri] of Object.entries(data)) {
    if (giaTri !== null && typeof giaTri === 'object' && 'increment' in giaTri) {
      (u as unknown as Record<string, number>)[truong] += (giaTri as { increment: number }).increment;
    } else if (giaTri !== null && typeof giaTri === 'object') {
      throw new Error(`kho giả chưa hỗ trợ cập nhật ${truong}: ${JSON.stringify(giaTri)}`);
    } else {
      (u as unknown as Record<string, unknown>)[truong] = giaTri;
    }
  }
}

let adminResetPassword: typeof import('../../services/admin/adminUser.service').adminResetPassword;
let adminSetUserActive: typeof import('../../services/admin/adminUser.service').adminSetUserActive;
let loadUserForRefresh: typeof import('../../services/client/auth.service').loadUserForRefresh;

before(async () => {
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        user: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            const u = khoUser.get(where.id);
            return u ? { ...u } : null;
          },
          update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const u = khoUser.get(where.id);
            if (!u) throw new Error('P2025');
            apDung(u, data);
            return { ...u };
          },
        },
      },
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  mock.module('../../services/shared/mailer.service', {
    namedExports: {
      sendMail: async (m: { to: string; subject: string; text: string }) => {
        if (mailHong) throw new Error('SMTP down');
        mailDaGui.push(m);
      },
    },
  });
  ({ adminResetPassword, adminSetUserActive } = await import('../../services/admin/adminUser.service'));
  ({ loadUserForRefresh } = await import('../../services/client/auth.service'));
});

beforeEach(() => {
  khoUser = new Map<string, UserGia>([
    ['admin-1', { id: 'admin-1', role: 'ADMIN', ownerId: null, isActive: true, tokenVersion: 0, password: 'hash-a1' }],
    ['admin-2', { id: 'admin-2', role: 'ADMIN', ownerId: null, isActive: true, tokenVersion: 0, password: 'hash-a2' }],
    ['owner-1', { id: 'owner-1', email: 'owner1@abc.vn', hoTen: 'Chủ A', role: 'OWNER', ownerId: null, isActive: true, tokenVersion: 3, password: 'hash-o1' }],
  ]);
  mailDaGui.length = 0;
  mailHong = false;
});

/**
 * vbsec 2026-09-10 (LOW, adminUser.service.ts:156): admin đặt lại mật khẩu nhận MẬT KHẨU MỚI DẠNG RÕ trong
 * response (hiện trên màn hình admin, rồi được gửi cho người dùng qua kênh bất kỳ) — admin biết mật khẩu
 * người dùng. Sửa: vô hiệu mật khẩu cũ + đá mọi phiên, gửi email hướng dẫn người dùng TỰ đặt mật khẩu mới
 * bằng "Quên mật khẩu"; response không mang mật khẩu.
 */
test('admin đặt lại mật khẩu: response KHÔNG có mật khẩu; email hướng dẫn tự đặt lại gửi đúng người', async () => {
  const kq = await adminResetPassword('owner-1', 'admin-1');

  assert.ok(!('password' in kq), 'response còn trả mật khẩu');
  assert.deepEqual(kq, { email: 'owner1@abc.vn', daGuiEmail: true });
  assert.notEqual(khoUser.get('owner-1')!.password, 'hash-o1', 'mật khẩu cũ phải bị vô hiệu');
  assert.equal(mailDaGui.length, 1);
  assert.equal(mailDaGui[0]!.to, 'owner1@abc.vn');
  assert.match(mailDaGui[0]!.text, /Quên mật khẩu/);
  assert.doesNotMatch(mailDaGui[0]!.text, /Mật khẩu\s*:/i);
});

test('admin đặt lại mật khẩu mà gửi mail hỏng: vẫn vô hiệu mật khẩu cũ + đá phiên, báo chưa gửi được', async () => {
  mailHong = true;
  const kq = await adminResetPassword('owner-1', 'admin-1');

  assert.deepEqual(kq, { email: 'owner1@abc.vn', daGuiEmail: false });
  assert.equal(khoUser.get('owner-1')!.tokenVersion, 4);
  assert.notEqual(khoUser.get('owner-1')!.password, 'hash-o1');
});

test('admin đặt lại mật khẩu -> refresh token phát TRƯỚC đó bị từ chối', async () => {
  await loadUserForRefresh('owner-1', null, 3); // trước reset: vé đang dùng hợp lệ

  await adminResetPassword('owner-1', 'admin-1');

  await assert.rejects(loadUserForRefresh('owner-1', null, 3), UnauthorizedError);
});

test('khóa rồi mở lại tài khoản -> refresh token cũ KHÔNG sống lại', async () => {
  await adminSetUserActive('owner-1', false, 'admin-1');
  await adminSetUserActive('owner-1', true, 'admin-1');

  await assert.rejects(loadUserForRefresh('owner-1', null, 3), UnauthorizedError);
});

test('không đặt lại mật khẩu / khóa / mở tài khoản ADMIN khác qua UI', async () => {
  await assert.rejects(adminResetPassword('admin-2', 'admin-1'), ConflictError);
  await assert.rejects(adminSetUserActive('admin-2', false, 'admin-1'), ConflictError);
  await assert.rejects(adminSetUserActive('admin-2', true, 'admin-1'), ConflictError);

  assert.deepEqual(khoUser.get('admin-2'), {
    id: 'admin-2',
    role: 'ADMIN',
    ownerId: null,
    isActive: true,
    tokenVersion: 0,
    password: 'hash-a2',
  });
});

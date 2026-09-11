import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyReply } from 'fastify';
import { UnauthorizedError } from '../helpers/errors';

/**
 * `reissueSession` (helpers/authTokens.ts) — cấp lại bộ token GIỮA PHIÊN khi đổi / tạo / xóa công ty
 * đang chọn (company.controller.ts).
 *
 * Lỗ hổng vbsec 2026-09-10 [1]: hàm ký refresh token mới bằng `tokenVersion` HIỆN TẠI trong DB cho bất
 * kỳ ai còn access token sống (≤15 phút) — vé đã bị thu hồi (đặt lại mật khẩu) hay tài khoản đã bị
 * khóa đều được "hồi sinh" thành phiên 7 ngày tự gia hạn, role cũ trong JWT được ký lại mãi.
 *
 * Chỉ thay control plane (`sysPrisma`) bằng bản giả trong bộ nhớ; logic kiểm phiên + ký token chạy thật.
 * `mock.module()` phải chạy TRƯỚC khi nạp `authTokens` nên module đó được `import()` động trong `before()`.
 */

interface UserGia {
  role: string;
  isActive: boolean;
  tokenVersion: number;
}

const usersTrongDb = new Map<string, UserGia>();

interface PhienGia {
  id: string;
  userId: string;
  jti: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
const phienTrongDb = new Map<string, PhienGia>();

let reissueSession: typeof import('../helpers/authTokens').reissueSession;

before(async () => {
  mock.module('../config/db.sys', {
    namedExports: {
      sysPrisma: {
        user: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            const u = usersTrongDb.get(where.id);
            return u ? { id: where.id, ...u } : null;
          },
        },
        refreshSession: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            phienTrongDb.get(where.id) ?? null,
          updateMany: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<PhienGia>;
          }) => {
            const p = phienTrongDb.get(where.id);
            if (!p || p.revokedAt) return { count: 0 };
            Object.assign(p, data);
            return { count: 1 };
          },
        },
      },
    },
  });
  ({ reissueSession } = await import('../helpers/authTokens'));
});

/** Reply giả: ghi lại payload đã ký và cookie đã đặt — đó chính là thứ `reissueSession` phát ra ngoài. */
function taoReply() {
  const daKy: Array<{
    loai: 'access' | 'refresh';
    payload: Record<string, unknown>;
  }> = [];
  const cookieDaDat: string[] = [];
  const reply = {
    jwtSign: async (payload: Record<string, unknown>) => {
      daKy.push({ loai: 'access', payload });
      return 'access-token';
    },
    refreshJwtSign: async (payload: Record<string, unknown>) => {
      daKy.push({ loai: 'refresh', payload });
      return 'refresh-token';
    },
    setCookie: (ten: string) => {
      cookieDaDat.push(ten);
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, daKy, cookieDaDat };
}

test('reissueSession: vé cũ lệch tokenVersion (đã đặt lại mật khẩu) -> 401, không ký token nào', async () => {
  usersTrongDb.set('u-reset', {
    role: 'OWNER',
    isActive: true,
    tokenVersion: 1,
  });
  const { reply, daKy, cookieDaDat } = taoReply();

  await assert.rejects(
    reissueSession(
      reply,
      { userId: 'u-reset', role: 'OWNER', tokenVersion: 0 },
      'dv-1',
    ),
    UnauthorizedError,
  );
  assert.equal(daKy.length, 0);
  assert.equal(cookieDaDat.length, 0);
});

test('reissueSession: tài khoản đã bị khóa (isActive=false) -> 401, không ký token nào', async () => {
  usersTrongDb.set('u-khoa', {
    role: 'OWNER_EMPLOYEE',
    isActive: false,
    tokenVersion: 3,
  });
  const { reply, daKy, cookieDaDat } = taoReply();

  await assert.rejects(
    reissueSession(
      reply,
      { userId: 'u-khoa', role: 'OWNER_EMPLOYEE', tokenVersion: 3 },
      'dv-1',
    ),
    UnauthorizedError,
  );
  assert.equal(daKy.length, 0);
  assert.equal(cookieDaDat.length, 0);
});

test('reissueSession: phiên hợp lệ -> ký lại với role ĐỌC TỪ DB (không tin role trong JWT cũ), giữ đúng phiên', async () => {
  // Admin đã hạ OWNER -> OWNER_EMPLOYEE; access token cũ vẫn mang role OWNER.
  usersTrongDb.set('u-ha-quyen', {
    role: 'OWNER_EMPLOYEE',
    isActive: true,
    tokenVersion: 2,
  });
  phienTrongDb.set('phien-1', {
    id: 'phien-1',
    userId: 'u-ha-quyen',
    jti: 'jti-hien-hanh',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
  });
  const { reply, daKy } = taoReply();

  await reissueSession(
    reply,
    { userId: 'u-ha-quyen', role: 'OWNER', tokenVersion: 2, sid: 'phien-1' },
    'dv-9',
  );

  assert.deepEqual(
    daKy.map((k) => ({ loai: k.loai, ...k.payload })),
    [
      {
        loai: 'access',
        userId: 'u-ha-quyen',
        donViId: 'dv-9',
        role: 'OWNER_EMPLOYEE',
        tokenVersion: 2,
        sid: 'phien-1',
      },
      {
        loai: 'refresh',
        userId: 'u-ha-quyen',
        donViId: 'dv-9',
        role: 'OWNER_EMPLOYEE',
        tokenVersion: 2,
        sid: 'phien-1',
        jti: 'jti-hien-hanh',
      },
    ],
  );
});

test('reissueSession: phiên đã đăng xuất -> 401 dù access token còn hạn, không ký token nào', async () => {
  usersTrongDb.set('u-da-dang-xuat', {
    role: 'OWNER',
    isActive: true,
    tokenVersion: 0,
  });
  phienTrongDb.set('phien-da-thu-hoi', {
    id: 'phien-da-thu-hoi',
    userId: 'u-da-dang-xuat',
    jti: 'jti-x',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: new Date(),
  });
  const { reply, daKy } = taoReply();

  await assert.rejects(
    reissueSession(
      reply,
      {
        userId: 'u-da-dang-xuat',
        role: 'OWNER',
        tokenVersion: 0,
        sid: 'phien-da-thu-hoi',
      },
      'dv-1',
    ),
    UnauthorizedError,
  );
  assert.equal(daKy.length, 0);
});

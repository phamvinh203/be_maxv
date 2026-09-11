import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../app';
import { sysPrisma } from '../config/db.sys';
import { hashPassword } from '../utils/password';
import { tenantSlug } from '../utils/dbName';
import { batBuocDbKiemThu, matKhauNgauNhien } from './_hoTro/dbKiemThu';

/**
 * Phiên đăng nhập phía server: đăng xuất thu hồi được phiên, refresh token xoay vòng + phát hiện dùng lại.
 *
 * vbsec 2026-09-10 (MEDIUM, auth.controller.ts:98): logout chỉ xóa cookie, refresh token 7 ngày tự gia hạn
 * mãi (không jti, không phát hiện tái sử dụng) -> token bị lộ vẫn dùng được sau khi người dùng đăng xuất.
 *
 * Chạy HTTP THẬT (`app.inject`) trên DB control plane. Dữ liệu test: email `vbsec.phien.*@test.local`,
 * MST 9960000061 — dọn trước và sau.
 */

const EMAIL = 'vbsec.phien.owner@test.local';
// Sinh mới mỗi lượt chạy — không để mật khẩu tài khoản test nằm trong repo (vbsec 2026-09-10).
const PW = matKhauNgauNhien();
const MST = '9960000061';

let app: FastifyInstance;
let donViId = '';
let soLanDangNhap = 0;

async function cleanup() {
  const u = await sysPrisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true },
  });
  await sysPrisma.donVi.deleteMany({ where: { maSoThue: MST } });
  if (u) {
    await sysPrisma.sysLog.deleteMany({ where: { userId: u.id } });
    await sysPrisma.user.delete({ where: { id: u.id } });
  }
}

before(async () => {
  batBuocDbKiemThu();
  app = await buildApp({ logger: false });
  await app.ready();
  await cleanup();
  const owner = await sysPrisma.user.create({
    data: {
      email: EMAIL,
      hoTen: 'vbsec phien',
      password: await hashPassword(PW),
      role: 'OWNER',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  const dv = await sysPrisma.donVi.create({
    data: {
      ownerId: owner.id,
      maSoThue: MST,
      slug: tenantSlug(MST),
      tenDonVi: 'vbsec phien',
      status: 'READY',
    },
  });
  donViId = dv.id;
});

after(async () => {
  await cleanup();
  await app.close();
  await sysPrisma.$disconnect();
});

const layCookie = (res: LightMyRequestResponse, ten: string) =>
  res.cookies.find((c) => c.name === ten)?.value;

interface Ve {
  access: string;
  refresh: string;
}

async function dangNhap(): Promise<Ve> {
  // Mỗi lượt một IP: login có trần 5 lượt/phút/IP.
  soLanDangNhap += 1;
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: EMAIL, password: PW },
    remoteAddress: `10.61.0.${soLanDangNhap}`,
  });
  assert.equal(res.statusCode, 200, res.body);
  return {
    access: layCookie(res, 'accessToken')!,
    refresh: layCookie(res, 'refreshToken')!,
  };
}

async function lamMoi(refreshToken: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    cookies: { refreshToken },
  });
  return {
    status: res.statusCode,
    refresh: layCookie(res, 'refreshToken'),
  };
}

async function dangXuat(ve: Partial<Ve>) {
  const cookies: Record<string, string> = {};
  if (ve.access) cookies.accessToken = ve.access;
  if (ve.refresh) cookies.refreshToken = ve.refresh;
  return app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies });
}

test('đăng xuất rồi: refresh token của phiên đó KHÔNG làm mới được nữa (401)', async () => {
  const ve = await dangNhap();

  assert.equal((await dangXuat(ve)).statusCode, 200);
  assert.equal((await lamMoi(ve.refresh)).status, 401);
});

test('đăng xuất chỉ thu hồi ĐÚNG phiên đó — phiên ở máy khác vẫn làm mới được', async () => {
  const mayA = await dangNhap();
  const mayB = await dangNhap();

  await dangXuat(mayA);
  assert.equal((await lamMoi(mayB.refresh)).status, 200);
});

test('đăng xuất khi chỉ còn access cookie (refresh cookie đã mất) vẫn thu hồi được phiên', async () => {
  const ve = await dangNhap();

  await dangXuat({ access: ve.access });
  assert.equal((await lamMoi(ve.refresh)).status, 401);
});

test('refresh token CŨ (đã bị xoay) dùng lại sau cửa sổ ân hạn -> 401 và CẢ PHIÊN bị thu hồi', async (t) => {
  const ve = await dangNhap();
  const lan1 = await lamMoi(ve.refresh);
  assert.equal(lan1.status, 200);
  assert.ok(lan1.refresh);

  // Kẻ giữ token cũ dùng lại nó 5 phút sau lượt xoay của người dùng thật.
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  t.mock.timers.tick(5 * 60_000);

  assert.equal((await lamMoi(ve.refresh)).status, 401);
  // Không phân biệt được ai là chủ thật -> hủy cả phiên: token mới nhất cũng hết dùng được.
  assert.equal((await lamMoi(lan1.refresh!)).status, 401);
});

test('hai tab cùng làm mới bằng MỘT refresh token cùng lúc -> cả hai 200, phiên vẫn sống', async () => {
  const ve = await dangNhap();

  const [tab1, tab2] = await Promise.all([
    lamMoi(ve.refresh),
    lamMoi(ve.refresh),
  ]);
  assert.deepEqual([tab1.status, tab2.status], [200, 200]);
  assert.equal((await lamMoi(tab2.refresh!)).status, 200);
});

test('đổi công ty bằng access token của phiên ĐÃ đăng xuất -> 401, không cấp lại phiên', async () => {
  const ve = await dangNhap();
  await dangXuat(ve);

  const doi = await app.inject({
    method: 'POST',
    url: `/api/v1/companies/${donViId}/switch`,
    cookies: { accessToken: ve.access },
  });
  assert.equal(doi.statusCode, 401);
});

test('refresh token ký TRƯỚC khi có phiên (không sid) vẫn làm mới được một lần -> chuyển sang phiên mới thu hồi được', async () => {
  // Người đang đăng nhập lúc triển khai không bị đá ra; token mới họ nhận đã gắn phiên phía server.
  const owner = await sysPrisma.user.findUniqueOrThrow({
    where: { email: EMAIL },
  });
  const jwtRefresh = (
    app.jwt as unknown as Record<string, { sign: (p: object) => string }>
  ).refresh;
  const veCu = jwtRefresh.sign({
    userId: owner.id,
    donViId: null,
    role: 'OWNER',
    tokenVersion: owner.tokenVersion,
  });

  const lan1 = await lamMoi(veCu);
  assert.equal(lan1.status, 200);
  assert.ok(lan1.refresh);

  await dangXuat({ refresh: lan1.refresh });
  assert.equal((await lamMoi(lan1.refresh!)).status, 401);
});

test('đăng xuất không có cookie nào vẫn 200 (idempotent)', async () => {
  assert.equal((await dangXuat({})).statusCode, 200);
});

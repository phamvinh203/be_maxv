import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';

/**
 * vbsec 2026-09-10 (LOW, taiLieu.controller.ts:268): callback OAuth Google Drive (route miễn đăng nhập) chỉ
 * tin `state` ký HMAC mang `donViId` — không biết AI xin vé, nên không kiểm lại được gì ở thời điểm dùng
 * vé (trễ tới 10 phút):
 *  - người xin vé vừa bị thu quyền vào công ty / bị khóa tài khoản vẫn nối được Drive của CÔNG TY;
 *  - quy tắc "đổi sang tài khoản Google khác chỉ OWNER" chỉ xét lúc PHÁT vé: nhân viên xin vé khi công ty
 *    chưa nối, chủ tài khoản nối xong, rồi nhân viên nộp vé -> kho tài liệu cả công ty chuyển sang Drive
 *    của nhân viên.
 * Sửa: ký `userId` vào state; callback nạp lại người đó từ DB và kiểm lại cả hai điều trên.
 *
 * Controller + ký/đọc state THẬT; DB control plane + service Drive thay bằng bản giả.
 */

process.env.GOOGLE_CLIENT_ID ||= 'client-id-test';
process.env.GOOGLE_CLIENT_SECRET ||= 'client-secret-test';
process.env.GOOGLE_REDIRECT_URI ||=
  'http://localhost:4000/api/v1/hrm/tai-lieu/drive/callback';

const nguoiDung = new Map<string, { role: string; isActive: boolean }>();
const quyenVao = new Set<string>(); // `${userId}|${donViId}`
let daKetNoi = false;
const daNoi: string[] = [];

let app: FastifyInstance;

before(async () => {
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        user: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            nguoiDung.get(where.id) ?? null,
        },
        donVi: {
          findFirst: async ({
            where,
          }: {
            where: {
              id: string;
              ownerId?: string;
              access?: { some: { userId: string } };
            };
          }) => {
            const userId = where.ownerId ?? where.access?.some.userId ?? '';
            return quyenVao.has(`${userId}|${where.id}`)
              ? { id: where.id }
              : null;
          },
        },
      },
    },
  });
  mock.module(
    '../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service',
    {
      namedExports: {
        GIOI_HAN_FILE_BYTE: 10 * 1024 * 1024,
        trangThaiDrive: async () => ({
          may_chu_san_sang: true,
          da_ket_noi: daKetNoi,
          email: null,
        }),
        luuKetNoiDrive: async (donViId: string) => {
          daNoi.push(donViId);
          return { email: 'nv@congty.vn' };
        },
        dinhKemFile: async () => ({}),
        goFile: async () => ({}),
        ngatKetNoiDrive: async () => {},
        taiFileVe: async () => ({}),
      },
    },
  );
  const ctrl =
    await import('../../controllers/client/hrm/du_lieu_ca_nhan/taiLieu.controller');
  const { default: errorHandlerPlugin } =
    await import('../../plugins/errorHandler.plugin');

  app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(cookie);
  app.get('/lien-ket', {
    onRequest: async (req: FastifyRequest) => {
      req.user = {
        userId: String(req.headers['x-user']),
        donViId: 'dv-1',
        role: String(req.headers['x-role']),
        tokenVersion: 0,
      };
    },
    handler: ctrl.driveLienKet,
  });
  app.get('/callback', ctrl.driveCallback);
  await app.ready();
});

beforeEach(() => {
  nguoiDung.clear();
  quyenVao.clear();
  daKetNoi = false;
  daNoi.length = 0;
  nguoiDung.set('nv-1', { role: 'OWNER_EMPLOYEE', isActive: true });
  nguoiDung.set('owner-1', { role: 'OWNER', isActive: true });
  quyenVao.add('nv-1|dv-1');
  quyenVao.add('owner-1|dv-1');
});

/** Xin vé (như FE bấm "thêm file") -> trả state + cookie đi kèm của đúng trình duyệt đó. */
async function xinVe(userId: string, role: string) {
  const res = await app.inject({
    url: '/lien-ket',
    headers: { 'x-user': userId, 'x-role': role },
  });
  assert.equal(res.statusCode, 200, res.body);
  const state = new URL(res.json().data.url).searchParams.get('state')!;
  return state;
}

const nopVe = (state: string) =>
  app.inject({
    url: `/callback?code=ma-google&state=${encodeURIComponent(state)}`,
    headers: { cookie: `driveOauthState=${encodeURIComponent(state)}` },
  });

test('bình thường: nhân viên còn quyền nối Drive lần đầu -> nối được', async () => {
  const state = await xinVe('nv-1', 'OWNER_EMPLOYEE');
  const res = await nopVe(state);
  assert.match(res.body, /Đã kết nối Google Drive/);
  assert.deepEqual(daNoi, ['dv-1']);
});

test('bị thu quyền vào công ty sau khi xin vé -> callback từ chối, không nối', async () => {
  const state = await xinVe('nv-1', 'OWNER_EMPLOYEE');
  quyenVao.delete('nv-1|dv-1');
  const res = await nopVe(state);
  assert.doesNotMatch(res.body, /Đã kết nối/);
  assert.deepEqual(daNoi, []);
});

test('tài khoản bị khóa sau khi xin vé -> callback từ chối, không nối', async () => {
  const state = await xinVe('nv-1', 'OWNER_EMPLOYEE');
  nguoiDung.set('nv-1', { role: 'OWNER_EMPLOYEE', isActive: false });
  const res = await nopVe(state);
  assert.doesNotMatch(res.body, /Đã kết nối/);
  assert.deepEqual(daNoi, []);
});

test('nhân viên xin vé lúc chưa nối, chủ tài khoản nối xong trước -> vé nhân viên không được đổi tài khoản Drive', async () => {
  const state = await xinVe('nv-1', 'OWNER_EMPLOYEE');
  daKetNoi = true; // chủ tài khoản vừa nối Drive của công ty
  const res = await nopVe(state);
  assert.doesNotMatch(res.body, /Đã kết nối/);
  assert.deepEqual(daNoi, []);

  // Chủ tài khoản thì vẫn đổi được.
  const stateOwner = await xinVe('owner-1', 'OWNER');
  const resOwner = await nopVe(stateOwner);
  assert.match(resOwner.body, /Đã kết nối Google Drive/);
  assert.deepEqual(daNoi, ['dv-1']);
});

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * vbsec 2026-09-10 (LOW, gdt-dvc.controller.ts:63): `phienDvc` ghép khóa phiên cổng với `donViId` LẤY TỪ
 * JWT. Vé sống 15 phút và không đối chiếu DB -> nhân viên vừa bị thu quyền vào công ty (hoặc công ty vừa
 * bị admin khóa) vẫn mở captcha / đăng nhập / tải file trên cổng thuế bằng phiên của công ty đó tới khi vé
 * hết hạn. Sửa: nhóm route `/dvc` kiểm lại quyền vào công ty đang chọn mỗi request.
 *
 * Route + controller THẬT; DB control plane, guard module gói và dịch vụ gọi cổng thay bằng bản giả.
 */

let conQuyen = true;
const goiCong: string[] = [];
let dvcRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: {
          findFirst: async () =>
            conQuyen
              ? { id: 'dv-1', dbName: 'db', maSoThue: '0100000001', access: [] }
              : null,
        },
      },
    },
  });
  mock.module('../../services/shared/modules.service', {
    namedExports: { requireModule: () => async () => {} },
  });
  mock.module('../../services/client/dich_vu_cong/gdt-dvc.service', {
    namedExports: {
      getCaptcha: async () => {
        goiCong.push('getCaptcha');
        return { key: 'k', image: 'data:' };
      },
      getTchsCaptcha: async () => {
        goiCong.push('getTchsCaptcha');
        return { key: 'k', image: 'data:' };
      },
      toUserMessage: (_e: unknown, macDinh: string) => macDinh,
      DvcAutoLoginFailedError: class extends Error {},
      DvcSessionExpiredError: class extends Error {},
      MA_LOI_TU_DANG_NHAP_HONG: 'x',
    },
  });
  ({ default: dvcRoutes } =
    await import('../../routes/dich_vu_cong/gdt-dvc.route'));
});

beforeEach(() => {
  conQuyen = true;
  goiCong.length = 0;
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = {
      userId: 'nv-1',
      donViId: 'dv-1',
      role: 'OWNER_EMPLOYEE',
      tokenVersion: 0,
    };
  });
  await app.register(dvcRoutes);
  await app.ready();
  return app;
}

test('còn quyền vào công ty đang chọn -> mở phiên cổng bình thường', async () => {
  const app = await taoApp();
  const res = await app.inject({ url: '/captcha' });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(goiCong, ['getCaptcha']);
  await app.close();
});

test('vừa bị thu quyền (vé JWT vẫn còn hạn) -> 403, không chạm cổng thuế', async () => {
  const app = await taoApp();
  conQuyen = false;
  for (const url of ['/captcha', '/tchs/captcha?key=k']) {
    const res = await app.inject({ url });
    assert.equal(res.statusCode, 403, url);
  }
  assert.deepEqual(goiCong, []);
  await app.close();
});

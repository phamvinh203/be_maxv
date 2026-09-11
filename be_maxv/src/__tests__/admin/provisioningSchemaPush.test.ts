import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayTenantSchema,
  type ChayLenh,
} from '../../services/shared/provisioning.service';
import { tenantUrl } from '../../utils/dbName';

/**
 * Đẩy schema lên DB tenant (`dayTenantSchema`, provisioning.service.ts) — chạy mỗi lần tạo công ty,
 * cấp lại DB và trong script `sync-tenants`.
 *
 * vbsec 2026-09-10 (MEDIUM, provisioning.service.ts:86 + sync-tenants.ts:37): URL DB kèm MẬT KHẨU tài
 * khoản chủ Postgres nằm trên dòng lệnh `npx prisma db push --url=...` — lộ qua danh sách tiến trình, và
 * khi lệnh lỗi thì `err.message`/`err.cmd` (chứa nguyên lệnh) bị ghi thẳng vào log PM2.
 *
 * Kiểm bằng bộ chạy lệnh giả (thứ được kiểm là lệnh + môi trường mà code giao cho tiến trình con).
 */

const DB = 'maxv_9960000031_app';
const URL_DB = tenantUrl(DB);
const MAT_KHAU = decodeURIComponent(new URL(URL_DB).password);

test('URL/mật khẩu DB KHÔNG nằm trên dòng lệnh — đi qua biến môi trường của tiến trình con', async () => {
  const daGoi: Array<{ args: string[]; env?: NodeJS.ProcessEnv }> = [];
  const chayGia: ChayLenh = async (_file, args, opts) => {
    daGoi.push({ args, env: opts.env });
  };

  await dayTenantSchema(DB, chayGia);

  assert.equal(daGoi.length, 1);
  // Thông điệp assert CỐ Ý không in dòng lệnh/lỗi ra: nếu hỏng thì chính log test sẽ làm lộ mật khẩu.
  const dongLenh = daGoi[0].args.join(' ');
  assert.ok(!dongLenh.includes(URL_DB), 'URL DB nằm trên dòng lệnh');
  assert.ok(!dongLenh.includes(`:${MAT_KHAU}@`), 'mật khẩu DB nằm trên dòng lệnh');
  assert.ok(daGoi[0].args.includes('push'));
  assert.equal(daGoi[0].env?.PRISMA_TENANT_PUSH_URL, URL_DB);
});

test('prisma lỗi (thông điệp có chứa URL DB) -> lỗi ném ra đã che mật khẩu', async () => {
  const chayGia: ChayLenh = async () => {
    throw Object.assign(new Error(`Command failed: prisma db push ${URL_DB}`), {
      cmd: `prisma db push --url=${URL_DB}`,
      stderr: `Error: P1001: Can't reach database server at ${URL_DB}`,
    });
  };

  const loi = await dayTenantSchema(DB, chayGia).then(
    () => assert.fail('phải ném lỗi'),
    (e: unknown) => e as Error & { cmd?: string; stderr?: string },
  );

  const toanBo = `${loi.message} ${loi.cmd ?? ''} ${loi.stderr ?? ''}`;
  assert.ok(!toanBo.includes(`:${MAT_KHAU}@`), 'lộ mật khẩu DB trong lỗi');
  assert.ok(loi.message.includes(DB), 'vẫn phải biết DB nào lỗi');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import errorHandlerPlugin from '../plugins/errorHandler.plugin';
import { MULTIPART_OPTS } from '../config/multipart';

/**
 * vbsec 2026-09-10 (LOW, app.ts:65): multipart chỉ đặt `fileSize`/`files`; `fields`/`fieldSize`/`parts`
 * để mặc định (không giới hạn số trường, mỗi trường 1MB) -> một request upload HRM kèm hàng nghìn trường
 * text giữ cả GB RAM nếu proxy không chặn cỡ body.
 */

function thanMultipart(soTruong: number, coFile = true) {
  const ranh = '----vbsec';
  const phan: string[] = [];
  for (let i = 0; i < soTruong; i++) {
    phan.push(`--${ranh}\r\nContent-Disposition: form-data; name="t${i}"\r\n\r\ngia-tri\r\n`);
  }
  if (coFile) {
    phan.push(
      `--${ranh}\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\r\n`,
    );
  }
  phan.push(`--${ranh}--\r\n`);
  return { payload: phan.join(''), headers: { 'content-type': `multipart/form-data; boundary=${ranh}` } };
}

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(multipart, MULTIPART_OPTS);
  app.post('/tai-len', async (req) => {
    const file = await req.file();
    await file?.toBuffer();
    return { ok: true };
  });
  await app.ready();
  return app;
}

test('có trần số trường text, cỡ mỗi trường, số phần và số header', () => {
  const gh = MULTIPART_OPTS.limits;
  assert.equal(gh.files, 1);
  assert.ok(gh.fields !== undefined && gh.fields <= 10);
  assert.ok(gh.fieldSize !== undefined && gh.fieldSize <= 4096);
  assert.ok(gh.parts !== undefined && gh.parts <= 20);
  assert.ok(gh.headerPairs !== undefined && gh.headerPairs <= 200);
});

test('request nhồi hàng trăm trường text bị từ chối (4xx), không xử lý tiếp', async () => {
  const app = await taoApp();
  const res = await app.inject({ method: 'POST', url: '/tai-len', ...thanMultipart(500) });
  assert.ok(res.statusCode >= 400 && res.statusCode < 500, `${res.statusCode} ${res.body}`);
  await app.close();
});

test('upload 1 file bình thường vẫn chạy', async () => {
  const app = await taoApp();
  const res = await app.inject({ method: 'POST', url: '/tai-len', ...thanMultipart(0) });
  assert.equal(res.statusCode, 200, res.body);
  await app.close();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:net';
import { fetchUpstream } from '../../services/client/hddt/traCuuGoc/shared';
import { TraCuuGocError } from '../../services/client/hddt/traCuuGoc/types';

/**
 * vbsec 2026-09-10 (LOW, traCuuGoc/shared.ts:56): lỗi mạng khi gọi cổng NCC được ghép NGUYÊN chuỗi nguyên
 * nhân (`describeErrorChain`: mã lỗi hệ thống, IP:cổng đích, lỗi DNS/TLS) vào thông điệp 502 trả về trình
 * duyệt — lộ hạ tầng mạng phía máy chủ, giúp dò SSRF. Sửa: người dùng nhận câu chung; chi tiết chỉ nằm ở
 * `chiTiet` để ghi log máy chủ.
 */
/** Cổng vừa được cấp rồi đóng lại -> kết nối tới đó bị từ chối ngay (ECONNREFUSED). */
async function congDaDong(): Promise<number> {
  const srv = createServer();
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  const { port } = srv.address() as AddressInfo;
  await new Promise<void>((ok) => srv.close(() => ok()));
  return port;
}

test('lỗi kết nối tới cổng NCC: thông điệp trả client không lộ IP/cổng/mã lỗi hệ thống, chi tiết để log', async () => {
  const port = await congDaDong();
  const loi = await fetchUpstream(
    `http://127.0.0.1:${port}/tra-cuu`,
    {},
    'cổng MISA',
  ).then(
    () => assert.fail('phải lỗi kết nối'),
    (e: unknown) => e,
  );

  assert.ok(loi instanceof TraCuuGocError);
  assert.equal(loi.code, 'UPSTREAM');
  assert.match(loi.message, /cổng MISA/);
  assert.doesNotMatch(
    loi.message,
    new RegExp(`127\\.0\\.0\\.1|ECONNREFUSED|${port}|fetch failed`),
  );
  assert.match(String(loi.chiTiet), /ECONNREFUSED/);
});

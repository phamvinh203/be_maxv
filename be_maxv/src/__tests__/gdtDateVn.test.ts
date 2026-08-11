import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toVctData,
  toVnWallClock,
  normalizeDetailDates,
} from '../services/client/hddt/gdt.service';

/**
 * Khóa QUY ƯỚC NGÀY GIỜ GDT -> DB -> FE (phát biểu hợp đồng: mục "Quy ước ngày giờ" trong
 * `docs/14-hop-dong-api.md`). Bất biến cần giữ:
 *  - chuỗi ngày KHÔNG hậu tố múi giờ = GIỜ VN, không phải giờ máy chủ;
 *  - ngày giờ trả ra FE luôn là giờ VN không hậu tố, kể cả khi GDT gửi UTC có `Z`.
 *
 * Vì đây là test về múi giờ, phải xanh Y HỆT ở mọi TZ:
 *   npx tsx --test src/__tests__/gdtDateVn.test.ts
 *   TZ=UTC npx tsx --test src/__tests__/gdtDateVn.test.ts
 */

test('toVctData: tdlap KHÔNG mang múi giờ được hiểu là giờ VN, không theo giờ máy chủ', () => {
  // Hóa đơn lập 00:00 ngày 01/07 giờ VN -> instant 17:00Z ngày 30/06, bất kể máy chủ chạy múi giờ nào.
  assert.equal(
    toVctData({ tdlap: '2025-07-01T00:00:00' }).tdlap.toISOString(),
    '2025-06-30T17:00:00.000Z',
  );
});

test('toVctData: tdlap có hậu tố Z giữ nguyên instant', () => {
  assert.equal(
    toVctData({ tdlap: '2025-06-30T17:00:00Z' }).tdlap.toISOString(),
    '2025-06-30T17:00:00.000Z',
  );
});

test('toVctData: nky có Z vẫn đúng instant (không bị ghim nhầm +07:00)', () => {
  assert.equal(
    toVctData({ nky: '2025-07-01T09:47:02Z' }).nky?.toISOString(),
    '2025-07-01T09:47:02.000Z',
  );
});

test('toVnWallClock: Date từ DB -> chuỗi giờ VN không hậu tố', () => {
  assert.equal(
    toVnWallClock(new Date('2025-06-30T17:00:00Z')),
    '2025-07-01T00:00:00',
  );
});

test('toVnWallClock: chuỗi UTC của GDT -> giờ VN', () => {
  assert.equal(toVnWallClock('2025-06-30T17:00:00Z'), '2025-07-01T00:00:00');
});

test('toVnWallClock: chuỗi đã là giờ VN -> giữ nguyên (idempotent)', () => {
  assert.equal(toVnWallClock('2025-07-01T00:00:00'), '2025-07-01T00:00:00');
  assert.equal(
    toVnWallClock(toVnWallClock('2025-06-30T17:00:00Z')),
    '2025-07-01T00:00:00',
  );
});

test('toVnWallClock: rỗng/không đọc được thành ngày -> undefined (nơi gọi tự lo dự phòng)', () => {
  assert.equal(toVnWallClock(undefined), undefined);
  assert.equal(toVnWallClock(''), undefined);
  assert.equal(toVnWallClock(null), undefined);
  assert.equal(toVnWallClock('không-phải-ngày'), undefined);
  assert.equal(toVnWallClock(new Date('không-phải-ngày')), undefined);
});

test('normalizeDetailDates: tdlap UTC -> ngày VN (ca lỗi tờ hóa đơn hiện lùi 1 ngày)', () => {
  const out = normalizeDetailDates({
    shdon: '123',
    tdlap: '2025-06-30T17:00:00Z',
    nky: '2025-07-01T09:47:02Z',
    tdlhdgoc: '2025-05-31T17:00:00Z',
  });
  // Cắt chuỗi `yyyy-MM-dd` (đúng cách `invoiceDateLine` bên FE làm) giờ ra ngày trên chứng từ.
  assert.equal(out.tdlap, '2025-07-01T00:00:00');
  assert.equal(out.nky, '2025-07-01T16:47:02');
  assert.equal(out.tdlhdgoc, '2025-06-01T00:00:00');
  assert.equal(out.shdon, '123');
});

test('normalizeDetailDates: chuỗi không đọc được thành ngày -> giữ nguyên, không nuốt mất', () => {
  const out = normalizeDetailDates({ tdlap: 'ngày-hỏng', nky: '' });
  assert.equal(out.tdlap, 'ngày-hỏng');
  assert.equal(out.nky, '');
});

test('normalizeDetailDates: không sửa payload gốc đang nằm trong bộ nhớ', () => {
  const src: Record<string, unknown> = { tdlap: '2025-06-30T17:00:00Z' };
  const out = normalizeDetailDates(src);
  assert.equal(src.tdlap, '2025-06-30T17:00:00Z');
  assert.equal(out.tdlap, '2025-07-01T00:00:00');
});

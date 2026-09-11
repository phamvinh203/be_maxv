import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../generated/tenant';
import { khachHangListQuerySchema } from '../../validators/accounting/banHang/khachHang.validator';
import { listKhachHang } from '../../services/client/accounting/banHang/danh_muc/khachHang.service';

/**
 * vbsec 2026-09-10 (LOW, khachHang.service.ts:22): danh sách khách hàng trả TOÀN BỘ `dmkh` không phân trang.
 * Sửa: phân trang phía server `{ items, total, page, pageSize }`, trần 100 dòng/trang, ô tìm chung `q`.
 */

function taoDbGia() {
  const goi: { findMany?: Record<string, unknown>; count?: Record<string, unknown> } = {};
  const db = {
    dmkh: {
      findMany: async (args: Record<string, unknown>) => {
        goi.findMany = args;
        return [{ ma_kh: 'KH01', ten_kh: 'Cty A' }];
      },
      count: async (args: Record<string, unknown>) => {
        goi.count = args;
        return 321;
      },
    },
  } as unknown as PrismaClient;
  return { db, goi };
}

test('mặc định chỉ lấy trang đầu (25 dòng) kèm tổng số, không kéo cả bảng', async () => {
  const { db, goi } = taoDbGia();

  const kq = await listKhachHang(db, khachHangListQuerySchema.parse({}));

  assert.deepEqual(
    { total: kq.total, page: kq.page, pageSize: kq.pageSize, soDong: kq.items.length },
    { total: 321, page: 1, pageSize: 25, soDong: 1 },
  );
  assert.equal(goi.findMany?.take, 25);
  assert.equal(goi.findMany?.skip, 0);
});

test('trang 3 cỡ 50 -> bỏ qua 100 dòng đầu; tổng đếm cùng bộ lọc với trang', async () => {
  const { db, goi } = taoDbGia();

  await listKhachHang(db, khachHangListQuerySchema.parse({ page: '3', pageSize: '50', q: 'abc' }));

  assert.equal(goi.findMany?.skip, 100);
  assert.equal(goi.findMany?.take, 50);
  assert.deepEqual(goi.count?.where, goi.findMany?.where);
  assert.ok(JSON.stringify(goi.findMany?.where).includes('abc'));
});

test('pageSize có trần 100', () => {
  assert.equal(khachHangListQuerySchema.safeParse({ pageSize: '100' }).success, true);
  assert.equal(khachHangListQuerySchema.safeParse({ pageSize: '10000' }).success, false);
});

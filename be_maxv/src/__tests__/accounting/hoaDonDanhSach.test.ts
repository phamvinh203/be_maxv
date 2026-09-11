import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { env } from '../../config/env';
import { tenantDbName } from '../../utils/dbName';
import {
  dayTenantSchema,
  dropTenant,
} from '../../services/shared/provisioning.service';
import { getTenantDb } from '../../helpers/tenantClient';
import { hoaDonListQuerySchema } from '../../validators/accounting/banHang/hoaDonBanHang.validator';
import { listHoaDon } from '../../services/client/accounting/banHang/chung_tu/hoaDonBanHang.service';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Danh sách hóa đơn bán hàng có PHÂN TRANG phía server (hoaDonBanHang.service.ts:44).
 *
 * vbsec 2026-09-10 (MEDIUM): `GET /hoa-don-ban-hang` tải TOÀN BỘ header `m81` không phân trang rồi lọc
 * `ten_kh` trong bộ nhớ -> tenant nhiều năm dữ liệu là mỗi lượt mở màn hình kéo cả bảng về RAM.
 *
 * Postgres THẬT, DB tenant riêng của test: MST 9960000053, tạo + đẩy schema trước, DROP sau.
 */

const DB = tenantDbName('9960000053');
const db = () => getTenantDb(DB);
const SO_HOA_DON = 30;

async function voiAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: env.adminUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

before(async () => {
  batBuocDbKiemThu();
  await dropTenant(DB);
  await voiAdmin((c) => c.query(`CREATE DATABASE "${DB}"`));
  await dayTenantSchema(DB);
  await db().dmkh.createMany({
    data: [
      { ma_kh: 'KH-A', ten_kh: 'Công ty Hoa Sen' },
      { ma_kh: 'KH-B', ten_kh: 'Cửa hàng Bình Minh' },
    ],
  });
  await db().m81.createMany({
    data: Array.from({ length: SO_HOA_DON }, (_, i) => ({
      stt_rec: `DS${String(i).padStart(20, '0')}`,
      so_ct: String(i + 1),
      // 3 hóa đơn đầu của khách Bình Minh, còn lại của Hoa Sen.
      ma_kh: i < 3 ? 'KH-B' : 'KH-A',
      ngay_ct: new Date(Date.UTC(2026, 0, 1 + i)),
    })),
  });
});

after(async () => {
  await dropTenant(DB);
});

const danhSach = (query: Record<string, string>) =>
  listHoaDon(db(), hoaDonListQuerySchema.parse(query));

test('mặc định chỉ trả trang đầu (25 dòng) kèm tổng số — không kéo cả bảng', async () => {
  const kq = await danhSach({});

  assert.equal(kq.items.length, 25);
  assert.equal(kq.total, SO_HOA_DON);
  assert.deepEqual([kq.page, kq.pageSize], [1, 25]);
});

test('trang 2 nối tiếp trang 1, không trùng, không sót', async () => {
  const t1 = await danhSach({ page: '1', pageSize: '25' });
  const t2 = await danhSach({ page: '2', pageSize: '25' });

  assert.equal(t2.items.length, SO_HOA_DON - 25);
  const tatCa = new Set([...t1.items, ...t2.items].map((r) => r.stt_rec));
  assert.equal(tatCa.size, SO_HOA_DON);
});

test('pageSize có trần 100', () => {
  assert.equal(
    hoaDonListQuerySchema.safeParse({ pageSize: '100' }).success,
    true,
  );
  assert.equal(
    hoaDonListQuerySchema.safeParse({ pageSize: '5000' }).success,
    false,
  );
});

test('tìm theo TÊN khách lọc dưới DB — tổng số đếm đúng theo bộ lọc, kèm tên khách', async () => {
  const kq = await danhSach({ q: 'bình minh' });

  assert.equal(kq.total, 3);
  assert.ok(
    kq.items.every(
      (r) => r.ma_kh === 'KH-B' && r.ten_kh === 'Cửa hàng Bình Minh',
    ),
  );
});

test('ô tìm chung khớp cả số chứng từ', async () => {
  const kq = await danhSach({ q: '30' });

  assert.deepEqual(
    kq.items.map((r) => r.so_ct),
    ['30'],
  );
});

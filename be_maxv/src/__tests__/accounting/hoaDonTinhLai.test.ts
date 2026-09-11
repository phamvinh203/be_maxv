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
import { ConflictError } from '../../helpers/errors';
import { hoaDonBodySchema } from '../../validators/accounting/banHang/hoaDonBanHang.validator';
import {
  createHoaDon,
  deleteHoaDon,
  updateHoaDon,
} from '../../services/client/accounting/banHang/chung_tu/hoaDonBanHang.service';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Số tiền hóa đơn bán hàng do SERVER tính (hoaDonBanHang.service.ts:120).
 *
 * vbsec 2026-09-10 (MEDIUM, MASS-ASSIGNMENT): tổng tiền, chiết khấu, thuế, tổng thanh toán (header và từng
 * dòng) lưu nguyên giá trị client gửi; `status` client đặt tùy ý; sửa/xóa không kiểm chứng từ đã ghi sổ.
 * FE (fe_maxv hoa_don_ban_hang) đã chỉ gửi input thô và trông vào backend tính lại — công thức ở đây phải
 * KHỚP `calc.ts` của FE.
 *
 * Postgres THẬT, DB tenant riêng của test: MST 9960000052, tạo + đẩy schema trước, DROP sau.
 */

const DB = tenantDbName('9960000052');
const db = () => getTenantDb(DB);

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
  await db().dmthue.create({
    data: { ma_thue: '10', ten_thue: 'Thuế GTGT 10%', ty_le: 10 },
  });
  // Mã khách / mã hàng phải có trong danh mục (hoaDonBanHang.service.ts `kiemMaDanhMuc`).
  await db().dmkh.create({ data: { ma_kh: 'KH01', ten_kh: 'Khách test' } });
  await db().dmvt.create({
    data: { ma_vt: 'VT01', ten_vt: 'Hàng test', dvt: 'Cái' },
  });
});

after(async () => {
  await dropTenant(DB);
});

/** Dòng hàng: 2 × 100.000, chiết khấu 10%, mã thuế 10 — kèm các số "đã tính" GIẢ client tự gửi. */
const dongGia = {
  ma_vt: 'VT01',
  so_luong: 2,
  gia_nt2: 100_000,
  tl_ck: 10,
  ma_thue: '10',
  thue_suat: 0, // client khai thuế suất 0 cho mã 10%
  so_luong2: 3,
  so_luong2_nl: 1,
  gia_khay_nt: 5_000,
  tien_nt2: 1,
  ck_nt: 0,
  thue_nt: 0,
  tien2: 1,
  thue: 0,
};

const hoaDon = (so_ct: string, them: Record<string, unknown> = {}) =>
  hoaDonBodySchema.parse({
    so_ct,
    ma_kh: 'KH01',
    t_tien_nt2: 1,
    t_thue_nt: 0,
    t_tt_nt: 1,
    t_tt: 1,
    chi_tiet: [dongGia],
    ...them,
  });

const so = (v: unknown) => Number(v);

test('client gửi tổng/thuế giả -> server tính lại từ số lượng × giá, chiết khấu, thuế suất danh mục', async () => {
  const { stt_rec } = await createHoaDon(db(), hoaDon('TL-1'), 'user-1');

  const m = await db().m81.findUniqueOrThrow({ where: { stt_rec } });
  // Tiền 200.000 − CK 20.000 + thuế (180.000 × 10%) 18.000 = 198.000
  assert.deepEqual(
    [
      so(m.t_so_luong),
      so(m.t_tien_nt2),
      so(m.t_ck_nt),
      so(m.t_thue_nt),
      so(m.t_tt_nt),
    ],
    [2, 200_000, 20_000, 18_000, 198_000],
  );
  assert.deepEqual(
    [so(m.t_tien2), so(m.t_ck), so(m.t_thue), so(m.t_tt)],
    [200_000, 20_000, 18_000, 198_000],
  );

  const [d] = await db().d81.findMany({ where: { stt_rec } });
  assert.deepEqual(
    [so(d.thue_suat), so(d.tien_nt2), so(d.ck_nt), so(d.thue_nt)],
    [10, 200_000, 20_000, 18_000],
  );
  // Tiền khay = (SL2 − SL2 nhận lại) × giá khay; tiền tính nợ = tiền + tiền khay (khớp calc.ts FE).
  assert.deepEqual([so(d.tien_khay_nt), so(d.tien_no_nt)], [10_000, 210_000]);
});

test('ngoại tệ: số quy đổi = số nguyên tệ × tỷ giá', async () => {
  const { stt_rec } = await createHoaDon(
    db(),
    hoaDon('TL-USD', {
      ma_nt: 'USD',
      ty_gia: 25_000,
      chi_tiet: [{ ...dongGia, gia_nt2: 10 }],
    }),
    'user-1',
  );

  const m = await db().m81.findUniqueOrThrow({ where: { stt_rec } });
  // 2 × 10 = 20 − 2 + 1,8 = 19,8 USD
  assert.equal(so(m.t_tt_nt), 19.8);
  assert.equal(so(m.t_tt), 495_000);
  const [d] = await db().d81.findMany({ where: { stt_rec } });
  assert.deepEqual(
    [so(d.gia2), so(d.tien2), so(d.thue)],
    [250_000, 500_000, 45_000],
  );
});

test('sửa hóa đơn cũng tính lại (không nhận số client gửi)', async () => {
  const { stt_rec } = await createHoaDon(db(), hoaDon('TL-SUA'), 'user-1');
  await updateHoaDon(
    db(),
    stt_rec,
    hoaDon('TL-SUA', { chi_tiet: [{ ...dongGia, so_luong: 1 }] }),
    'user-1',
  );

  const m = await db().m81.findUniqueOrThrow({ where: { stt_rec } });
  assert.equal(so(m.t_tt_nt), 99_000);
});

test('client KHÔNG tự đặt được trạng thái "Đã ghi sổ" (1); chỉ Lập CT (2) hoặc Hủy (0)', () => {
  assert.equal(
    hoaDonBodySchema.safeParse({ so_ct: 'X', ma_kh: 'K', status: '1' }).success,
    false,
  );
  assert.equal(
    hoaDonBodySchema.safeParse({ so_ct: 'X', ma_kh: 'K', status: '9' }).success,
    false,
  );
  assert.equal(
    hoaDonBodySchema.safeParse({ so_ct: 'X', ma_kh: 'K', status: '0' }).success,
    true,
  );
});

test('chứng từ đã ghi sổ không sửa, không xóa được (409)', async () => {
  const ghiSo = await db().m81.create({
    data: {
      stt_rec: 'GHISO000000000000000001',
      so_ct: 'TL-GHISO',
      ma_kh: 'KH01',
      status: '1',
    },
  });

  await assert.rejects(
    updateHoaDon(db(), ghiSo.stt_rec, hoaDon('TL-GHISO'), 'user-1'),
    ConflictError,
  );
  await assert.rejects(deleteHoaDon(db(), ghiSo.stt_rec), ConflictError);
  assert.equal(
    (await db().m81.findUniqueOrThrow({ where: { stt_rec: ghiSo.stt_rec } }))
      .status,
    '1',
  );
});

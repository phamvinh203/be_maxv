import { before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CT_TAGS,
  type ChiTieuTncn05,
} from '../../constants/hrm/to_khai_thue/chiTieuTncn05';
import type { ToKhaiThueErrorCode } from '../../constants/hrm/to_khai_thue/toKhaiThueErrors';
import { Prisma, type PrismaClient } from '../../generated/tenant';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';
import { COT_TIEN_BANG_THUE } from '../../services/client/hrm/to_khai_thue/taxDeclarationCalc';

/**
 * Tờ khai quý 05/KK-TNCN — vòng đời 4 trạng thái và thứ tự kiểm lỗi (api-contract Mục 5, BR-tkt-014/015).
 *
 * Số chỉ tiêu đã kiểm ở `hrmTaxDeclarationCalc.test.ts`. Ở đây kiểm các NHÁNH quyết định trạng thái trên
 * DB giả lập, kể cả thứ tự "khóa đọc 3 tháng rồi mới ghi". Ngữ nghĩa khóa hàng thật (FOR SHARE /
 * FOR UPDATE) là việc của Postgres — để test HTTP ở Phase B.
 */

let svc: typeof import('../../services/client/hrm/to_khai_thue/taxDeclaration.service');

before(async () => {
  // Họ tên người xuất/nộp đọc từ control plane — thay bằng bảng tên giả để không chạm DB thật.
  mock.module(
    '../../services/client/hrm/du_lieu_tinh_luong/payrollActivity.service',
    {
      namedExports: {
        layHoTenNguoiDung: async (ids: (string | null | undefined)[]) =>
          new Map(
            ids
              .filter((id): id is string => !!id)
              .map((id) => [id, `Tên ${id}`]),
          ),
      },
    },
  );
  svc =
    await import('../../services/client/hrm/to_khai_thue/taxDeclaration.service');
});

const NNT = {
  maSoThue: '0106861880',
  ten: 'Công ty A',
  diaChi: 'Hà Nội',
  coQuanThueQuanLy: '',
};
const LY_DO = 'loại trừ khoản kê nhầm kỳ trước';
const KY_Q3 = [7, 8, 9].map((month) => ({
  id: `ky-2026-0${month}`,
  month,
  status: 'LOCKED',
}));

const loiMa = (ma: ToKhaiThueErrorCode) => (e: unknown) =>
  e instanceof ToKhaiThueError && e.code === ma;

/** Một dòng snapshot tháng: NV0001 chịu thuế 20tr, thuế 475.000. */
function dongThang(periodId: string) {
  return {
    periodId,
    recipientKey: 'NV0001',
    ma_nv: 'NV0001',
    ho_ten: 'Nguyễn Văn A',
    mst_ca_nhan: null,
    so_cccd: null,
    loai_lao_dong: 'HOP_DONG_3_THANG_TRO_LEN',
    cu_tru: true,
    ...Object.fromEntries(
      COT_TIEN_BANG_THUE.map((c) => [c, new Prisma.Decimal(0)]),
    ),
    // Dữ liệu thật luôn có tổng thu nhập ≥ thu nhập chịu thuế; [16] chỉ đếm người được trả thu nhập.
    tong_thu_nhap: new Prisma.Decimal(20_000_000),
    thu_nhap_chiu_thue: new Prisma.Decimal(20_000_000),
    tong_thue_tncn: new Prisma.Decimal(475_000),
  };
}

const CT_MAU = {
  ...Object.fromEntries(CT_TAGS.map((t) => [t, 0])),
  ct16: 1,
} as ChiTieuTncn05;

function dongToKhai(trang_thai: string, g: Record<string, unknown> = {}) {
  const daXuat = trang_thai !== 'READY_TO_EXPORT';
  return {
    nam: 2026,
    ky_loai: 'quy',
    ky_so: 3,
    so_lan: 0,
    trang_thai,
    ct: CT_MAU,
    ct_may: CT_MAU,
    ghi_de: {},
    canh_bao: [],
    ct16: 1,
    ct21: new Prisma.Decimal(0),
    ct29: new Prisma.Decimal(0),
    nguoi_ky: null,
    ngay_ky: null,
    tinh_luc: new Date('2026-10-05T03:00:00.000Z'),
    khoa_so_boi: daXuat ? 'u-1' : null,
    khoa_so_luc: daXuat ? new Date('2026-10-05T03:00:00.000Z') : null,
    nop_boi: trang_thai === 'SUBMITTED' ? 'u-2' : null,
    nop_luc:
      trang_thai === 'SUBMITTED' ? new Date('2026-10-06T03:00:00.000Z') : null,
    ...g,
  };
}

interface TuyChon {
  ky?: typeof KY_Q3;
  /** periodId đã có khóa `TAX_SHEET`; bỏ trống = cả 3 tháng đã chốt. */
  daChot?: string[];
  toKhai?: Record<string, unknown> | null;
  dong?: Array<Record<string, unknown>>;
}

function giaLapDb(tc: TuyChon = {}) {
  const ky = tc.ky ?? KY_Q3;
  const daChot = new Set(tc.daChot ?? ky.map((k) => k.id));
  let toKhai: Record<string, unknown> | null = tc.toKhai ?? null;
  const goi: string[] = [];

  const db = {
    payrollPeriod: { findMany: async () => ky },
    payrollModuleLock: {
      findMany: async () => [...daChot].map((periodId) => ({ periodId })),
    },
    $queryRaw: async (sql: TemplateStringsArray) => {
      if (sql.join('?').includes('hrm_payroll_module_locks')) {
        goi.push('khoaDoc');
        return ky
          .filter((k) => daChot.has(k.id))
          .map((k) => ({ periodId: k.id }));
      }
      goi.push('khoaGhi');
      return [];
    },
    taxCalculationLine: { findMany: async () => tc.dong ?? [] },
    hrm_to_khai_tncn05: {
      findUnique: async () => toKhai,
      findUniqueOrThrow: async () => {
        if (!toKhai) throw new Error('Không có dòng tờ khai');
        return toKhai;
      },
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        goi.push('toKhai.createMany');
        // skipDuplicates: có dòng rồi thì bỏ qua.
        if (!toKhai) toKhai = { ...dongToKhai('READY_TO_EXPORT'), ...data[0] };
        return { count: toKhai ? 1 : 0 };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        goi.push('toKhai.update');
        toKhai = { ...toKhai, ...data };
        return toKhai;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { trang_thai: string };
        data: Record<string, unknown>;
      }) => {
        goi.push('toKhai.updateMany');
        if (!toKhai || toKhai.trang_thai !== where.trang_thai)
          return { count: 0 };
        toKhai = { ...toKhai, ...data };
        return { count: 1 };
      },
      deleteMany: async () => {
        goi.push('toKhai.deleteMany');
        return { count: 0 };
      },
    },
    $transaction: async (
      fn: (tx: unknown) => Promise<unknown>,
    ): Promise<unknown> => fn(db),
  };
  return { db: db as unknown as PrismaClient, goi };
}

const Q3 = { nam: 2026, quy: 3 };
const DU_3_THANG = () => KY_Q3.map((k) => dongThang(k.id));

/* ── Xem tờ khai (5.1) ─────────────────────────────────────────────── */

test('AC-tkt-022: T7, T8 đã chốt, T9 còn Nháp -> CHUA_SAN_SANG, KHÔNG tạo dòng, chỉ rõ tháng thiếu', async () => {
  const { db, goi } = giaLapDb({ daChot: ['ky-2026-07', 'ky-2026-08'] });
  const dto = await svc.getToKhai(db, 2026, 3, NNT);

  assert.equal(dto.trangThai, 'CHUA_SAN_SANG');
  assert.equal(dto.ct, null);
  assert.equal(dto.ctMay, null);
  assert.deepEqual(
    dto.cacThang.map((t) => [t.month, t.daChot]),
    [
      [7, true],
      [8, true],
      [9, false],
    ],
  );
  assert.ok(!goi.includes('toKhai.createMany'));
});

test('TC-tkt-081: tháng thứ 3 chưa từng có kỳ lương -> CHUA_SAN_SANG, periodId null', async () => {
  const { db } = giaLapDb({ ky: KY_Q3.slice(0, 2) });
  const dto = await svc.getToKhai(db, 2026, 3, NNT);
  assert.equal(dto.trangThai, 'CHUA_SAN_SANG');
  assert.deepEqual(dto.cacThang[2], {
    month: 9,
    periodId: null,
    daChot: false,
    payrollStatus: null,
  });
});

test('TC-tkt-077: đủ 3 tháng -> tự tạo READY_TO_EXPORT từ snapshot; khóa đọc 3 tháng TRƯỚC mọi lệnh ghi', async () => {
  const { db, goi } = giaLapDb({ dong: DU_3_THANG() });
  const dto = await svc.getToKhai(db, 2026, 3, NNT);

  assert.equal(dto.trangThai, 'READY_TO_EXPORT');
  assert.equal(dto.ct?.ct16, 1, 'một người có mặt cả 3 tháng');
  assert.equal(dto.ct?.ct22, 60_000_000);
  assert.equal(dto.ct?.ct30, 1_425_000);
  assert.equal(dto.ctGocSuaDuoc.length, 13);
  assert.deepEqual(dto.thongTinNguoiNopThue, { ...NNT, nguoiKy: null });
  assert.deepEqual(goi, [
    'khoaDoc',
    'toKhai.createMany',
    'khoaGhi',
    'toKhai.update',
  ]);
});

test('Tờ khai đã xuất: xem và tải lại chỉ ĐỌC — không khóa, không tính lại, không ghi', async () => {
  const { db, goi } = giaLapDb({ toKhai: dongToKhai('EXPORTED') });
  const xem = await svc.getToKhai(db, 2026, 3, NNT);
  const taiLai = await svc.layToKhaiDaXuat(db, 2026, 3, NNT);

  assert.equal(xem.trangThai, 'EXPORTED');
  assert.equal(xem.xuatBoiTen, 'Tên u-1');
  assert.deepEqual(taiLai.ct, CT_MAU);
  assert.deepEqual(goi, []);
});

test('Tải lại file khi tờ khai chưa xuất -> E-tkt-013', async () => {
  for (const toKhai of [null, dongToKhai('READY_TO_EXPORT')]) {
    const { db } = giaLapDb({ toKhai });
    await assert.rejects(
      svc.layToKhaiDaXuat(db, 2026, 3, NNT),
      loiMa('E-tkt-013'),
    );
  }
});

/* ── Ghi đè (5.3, 5.4) ─────────────────────────────────────────────── */

test('AC-tkt-026: ghi đè thiếu lý do bị chặn TRƯỚC khi mở giao dịch', async () => {
  const { db, goi } = giaLapDb();
  await assert.rejects(
    svc.putGhiDe(db, 2026, 3, { ct22: { gia: 1 } }, NNT),
    loiMa('E-tkt-011'),
  );
  assert.deepEqual(goi, []);
});

test('Ghi đè khi quý chưa đủ 3 tháng chốt -> E-tkt-010', async () => {
  const { db, goi } = giaLapDb({ daChot: ['ky-2026-07'] });
  await assert.rejects(
    svc.putGhiDe(db, 2026, 3, { ct22: { gia: 1, lyDo: LY_DO } }, NNT),
    loiMa('E-tkt-010'),
  );
  assert.deepEqual(goi, ['khoaDoc']);
});

test('TC-tkt-090/091: ghi đè hoặc xóa ghi đè khi đã xuất / đã nộp -> E-tkt-019', async () => {
  for (const trangThai of ['EXPORTED', 'SUBMITTED']) {
    const { db, goi } = giaLapDb({
      dong: DU_3_THANG(),
      toKhai: dongToKhai(trangThai),
    });
    await assert.rejects(
      svc.putGhiDe(db, 2026, 3, { ct22: { gia: 1, lyDo: LY_DO } }, NNT),
      loiMa('E-tkt-019'),
      trangThai,
    );
    await assert.rejects(
      svc.deleteGhiDe(db, 2026, 3, undefined, NNT),
      loiMa('E-tkt-019'),
      trangThai,
    );
    assert.ok(!goi.includes('toKhai.update'), trangThai);
  }
});

test('AC-tkt-025: ghi đè GỘP vào ghi đè cũ, [21] tính lại; xóa một chỉ tiêu giữ nguyên chỉ tiêu khác', async () => {
  const { db } = giaLapDb({
    dong: DU_3_THANG(),
    toKhai: dongToKhai('READY_TO_EXPORT', {
      ghi_de: { ct23: { gia: 5_000_000, lyDo: LY_DO } },
    }),
  });

  const sau = await svc.putGhiDe(
    db,
    2026,
    3,
    { ct22: { gia: 48_000_000, lyDo: LY_DO } },
    NNT,
  );
  assert.deepEqual(Object.keys(sau.ghiDe).sort(), ['ct22', 'ct23']);
  assert.equal(sau.ct?.ct21, 53_000_000);
  assert.equal(sau.ctMay?.ct22, 60_000_000, 'số máy không bị ghi đè làm bẩn');

  const xoa = await svc.deleteGhiDe(db, 2026, 3, 'ct22', NNT);
  assert.deepEqual(Object.keys(xoa.ghiDe), ['ct23']);
  assert.equal(xoa.ct?.ct22, 60_000_000);

  await assert.rejects(
    svc.deleteGhiDe(db, 2026, 3, 'ct21', NNT),
    loiMa('E-tkt-012'),
  );
});

/* ── Xuất (5.5) ────────────────────────────────────────────────────── */

test('AC-tkt-022: xuất khi chưa đủ 3 tháng chốt -> E-tkt-010, không ghi gì', async () => {
  const { db, goi } = giaLapDb({ daChot: ['ky-2026-07'] });
  await assert.rejects(svc.xuatToKhai(db, Q3, 'u-1', NNT), loiMa('E-tkt-010'));
  assert.deepEqual(goi, ['khoaDoc']);
});

test('TC-tkt-080: xuất lần hai -> E-tkt-020, bộ số đã xuất không bị ghi lại', async () => {
  const { db, goi } = giaLapDb({
    dong: DU_3_THANG(),
    toKhai: dongToKhai('EXPORTED'),
  });
  await assert.rejects(svc.xuatToKhai(db, Q3, 'u-2', NNT), loiMa('E-tkt-020'));
  assert.ok(!goi.includes('toKhai.update'));
});

test('AC-tkt-023: xuất -> EXPORTED; ghi người/lúc xuất, người ký; bộ số chốt gồm ghi đè hiện hành', async () => {
  const { db } = giaLapDb({
    dong: DU_3_THANG(),
    toKhai: dongToKhai('READY_TO_EXPORT', {
      ghi_de: { ct22: { gia: 48_000_000, lyDo: LY_DO } },
    }),
  });
  const dto = await svc.xuatToKhai(
    db,
    { ...Q3, nguoiKy: 'Nguyễn Kế Toán' },
    'u-1',
    NNT,
  );

  assert.equal(dto.trangThai, 'EXPORTED');
  assert.equal(dto.xuatBoi, 'u-1');
  assert.equal(dto.xuatBoiTen, 'Tên u-1');
  assert.ok(dto.xuatLuc);
  assert.equal(dto.nguoiKy, 'Nguyễn Kế Toán');
  assert.match(
    dto.ngayKy ?? '',
    /^\d{4}-\d{2}-\d{2}$/,
    'ngày ký mặc định = ngày xuất',
  );
  assert.equal(dto.ct?.ct22, 48_000_000);
  assert.equal(dto.ct?.ct21, 48_000_000);
});

/* ── Đánh dấu đã nộp (5.7) ─────────────────────────────────────────── */

test('AC-tkt-028 / TC-tkt-094: đánh dấu đã nộp khi chưa xuất hoặc đã nộp -> E-tkt-013', async () => {
  for (const toKhai of [
    null,
    dongToKhai('READY_TO_EXPORT'),
    dongToKhai('SUBMITTED'),
  ]) {
    const { db } = giaLapDb({ toKhai });
    await assert.rejects(
      svc.danhDauDaNop(db, Q3, 'u-9', NNT),
      loiMa('E-tkt-013'),
      String(toKhai?.trang_thai),
    );
  }
});

test('TC-tkt-093: đã xuất -> SUBMITTED, ghi đúng người và thời điểm đánh dấu', async () => {
  const { db } = giaLapDb({ toKhai: dongToKhai('EXPORTED') });
  const dto = await svc.danhDauDaNop(db, Q3, 'u-9', NNT);
  assert.equal(dto.trangThai, 'SUBMITTED');
  assert.equal(dto.nopBoi, 'u-9');
  assert.equal(dto.nopBoiTen, 'Tên u-9');
  assert.ok(dto.nopLuc);
});

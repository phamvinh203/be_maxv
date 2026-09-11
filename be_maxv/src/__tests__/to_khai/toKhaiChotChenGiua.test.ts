import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../generated/tenant';
import {
  BanDaChotError,
  luuGhiDe,
  luuTenHangPhuLuc,
  tinhVaLuu,
} from '../../services/client/to_khai/application/toKhaiGtgt01.service';

/**
 * Ghi vào bản tờ khai 01/GTGT khi "Chốt" CHEN GIỮA lượt đọc trạng thái và lượt ghi.
 *
 * vbsec 2026-09-10 (MEDIUM, toKhaiGtgt01.service.ts:225): `tinhVaLuu` kiểm `trang_thai` một lần ở đầu,
 * tính lâu (đọc hóa đơn cả kỳ), rồi `upsert` không điều kiện — "Chốt" bấm trong lúc đó thì số của bản
 * VỪA CHỐT (số đem nộp) bị đè lặng lẽ, trạng thái vẫn là chốt. `luuGhiDe` / `luuTenHangPhuLuc` cùng kiểu.
 *
 * DB giả tái hiện đúng khe chen giữa một cách tất định: lượt ĐỌC trả trạng thái cũ, còn trạng thái THẬT
 * trong kho đã là chốt. `upsert`/`update` ghi không điều kiện như Prisma (where chỉ có khóa duy nhất),
 * `updateMany` áp đúng điều kiện `trang_thai` như Postgres.
 */

const KY = { nam: 2026, kyLoai: 'thang' as const, kySo: 8 };
type TrangThai = 'nhap' | 'chot';

/** Số của bản đã nộp — lượt ghi nào đè lên là hỏng. */
const CT_DA_NOP = Object.freeze({ ct40: 123_456 });
const GHI_DE_DA_NOP = Object.freeze({ ct25: Object.freeze({ gia: 1 }) });
const PHU_LUC_DA_NOP = Object.freeze({
  muaVao: Object.freeze({ tenHang: 'Hàng mua đã nộp' }),
  banRa: Object.freeze({ tenHang: 'Hàng bán đã nộp' }),
});

function khopTrangThai(thuc: unknown, dieuKien: unknown): boolean {
  if (dieuKien === undefined) return true;
  if (typeof dieuKien === 'string') return thuc === dieuKien;
  if (dieuKien && typeof dieuKien === 'object' && 'not' in dieuKien) {
    return thuc !== (dieuKien as { not: string }).not;
  }
  throw new Error(
    `DB giả chưa hỗ trợ điều kiện trang_thai: ${JSON.stringify(dieuKien)}`,
  );
}

type Where = Record<string, unknown> & {
  nam_ky_loai_ky_so?: Record<string, unknown>;
};

/** Khóa kỳ nằm lồng trong `nam_ky_loai_ky_so` (findUnique/update) hoặc phẳng (updateMany). */
function laKyNay(where: Where): boolean {
  const k = (where.nam_ky_loai_ky_so ?? where) as Record<string, unknown>;
  return k.nam === KY.nam && k.ky_loai === KY.kyLoai && k.ky_so === KY.kySo;
}

/**
 * `daDoc`: trạng thái service đọc được (đã cũ, `null` = đọc thấy chưa có bản);
 * `that`: trạng thái thật lúc ghi (`null` = chưa có bản).
 */
function taoDbGia(daDoc: TrangThai | null, that: TrangThai | null) {
  let kho: Record<string, unknown> | null =
    that === null
      ? null
      : {
          nam: KY.nam,
          ky_loai: KY.kyLoai,
          ky_so: KY.kySo,
          trang_thai: that,
          ct: CT_DA_NOP,
          ct_may: CT_DA_NOP,
          ghi_de: GHI_DE_DA_NOP,
          nguon_ct22: 'nhap_tay',
          so_hd_ban: 1,
          so_hd_mua: 1,
          so_hd_khong_ke_khai: 0,
          hd_thieu_detail: 0,
          phu_luc: PHU_LUC_DA_NOP,
          canh_bao: [],
          dieu_chinh: null,
          tinh_luc: new Date('2026-09-01T00:00:00Z'),
        };

  const hoaDon = {
    id: 'hd-1',
    tthai: '1',
    dvtte: 'VND',
    tgia: 1,
    tgtcthue: 1_000_000,
    tgtthue: 100_000,
    detail: {
      thttltsuat: [{ tsuat: '10%', thtien: 1_000_000, tthue: 100_000 }],
    },
  };

  const tokhai_gtgt01 = {
    findUnique: async ({ where }: { where: Where }) => {
      // Kỳ khác (kỳ trước, `layCt22KyTruoc` hỏi để nối [22]) chưa có bản.
      if (!laKyNay(where) || daDoc === null || kho === null) return null;
      return { ...kho, trang_thai: daDoc };
    },
    findMany: async () => [],
    update: async ({
      where,
      data,
    }: {
      where: Where;
      data: Record<string, unknown>;
    }) => {
      if (
        kho === null ||
        !laKyNay(where) ||
        !khopTrangThai(kho.trang_thai, where.trang_thai)
      ) {
        throw Object.assign(new Error('Record to update not found.'), {
          code: 'P2025',
        });
      }
      return Object.assign(kho, data);
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Where;
      data: Record<string, unknown>;
    }) => {
      if (
        kho === null ||
        !laKyNay(where) ||
        !khopTrangThai(kho.trang_thai, where.trang_thai)
      ) {
        return { count: 0 };
      }
      Object.assign(kho, data);
      return { count: 1 };
    },
    upsert: async ({
      create,
      update,
    }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      if (kho === null) {
        kho = { ...create };
        return kho;
      }
      return Object.assign(kho, update);
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (kho !== null)
        throw Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
        });
      kho = { ...data };
      return kho;
    },
    createMany: async ({
      data,
      skipDuplicates,
    }: {
      data: Record<string, unknown>[];
      skipDuplicates?: boolean;
    }) => {
      if (kho !== null) {
        if (skipDuplicates) return { count: 0 };
        throw Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
        });
      }
      kho = { ...data[0] };
      return { count: 1 };
    },
  };

  const db = {
    tokhai_gtgt01,
    tokhai_ky_hoa_don: {
      findMany: async () => [{ hoa_don_id: hoaDon.id, ke_khai: true }],
    },
    vct50view: { findMany: async () => [hoaDon] },
    vct60view: { findMany: async () => [hoaDon] },
    sync_log: { findMany: async () => [] },
    $queryRawUnsafe: async () => [],
  } as unknown as PrismaClient;

  return { db, doc: () => kho };
}

test('"Tính lại" chen sau "Chốt": đọc thấy nháp nhưng bản vừa chốt -> 409, số đã nộp giữ nguyên', async () => {
  const { db, doc } = taoDbGia('nhap', 'chot');

  await assert.rejects(tinhVaLuu(db, KY), BanDaChotError);
  assert.equal(doc()?.trang_thai, 'chot');
  assert.equal(doc()?.ct, CT_DA_NOP);
  assert.equal(doc()?.ct_may, CT_DA_NOP);
});

test('"Lưu ô sửa tay" chen sau "Chốt" -> 409, không đổi ghi_de lẫn số của bản đã chốt', async () => {
  const { db, doc } = taoDbGia('nhap', 'chot');

  await assert.rejects(
    luuGhiDe(db, KY, { ct25: { gia: 999 } }),
    BanDaChotError,
  );
  assert.equal(doc()?.ghi_de, GHI_DE_DA_NOP);
  assert.equal(doc()?.ct, CT_DA_NOP);
});

test('"Sửa mô tả phụ lục" chen sau "Chốt" -> 409, phụ lục đã nộp giữ nguyên', async () => {
  const { db, doc } = taoDbGia('nhap', 'chot');

  await assert.rejects(
    luuTenHangPhuLuc(db, KY, { banRa: 'Mô tả mới' }),
    BanDaChotError,
  );
  assert.equal(doc()?.phu_luc, PHU_LUC_DA_NOP);
});

test('không ai chen: bản nháp được tính lại bình thường, vẫn là nháp', async () => {
  const { db, doc } = taoDbGia('nhap', 'nhap');

  const ban = await tinhVaLuu(db, KY);
  assert.equal(ban.trangThai, 'nhap');
  assert.equal(doc()?.trang_thai, 'nhap');
  assert.notEqual(doc()?.ct, CT_DA_NOP);
  // ghi_de là dữ liệu kế toán nhập — lượt tính chỉ đọc, không ghi lại.
  assert.equal(doc()?.ghi_de, GHI_DE_DA_NOP);
});

test('kỳ chưa có bản: tạo bản nháp mới', async () => {
  const { db, doc } = taoDbGia(null, null);

  await tinhVaLuu(db, KY);
  assert.equal(doc()?.trang_thai, 'nhap');
  assert.notEqual(doc()?.ct, undefined);
});

test('đọc thấy chưa có bản nhưng lượt khác vừa tạo nháp: ghi số lên bản đó, không vỡ vì trùng khóa', async () => {
  const { db, doc } = taoDbGia(null, 'nhap');

  await tinhVaLuu(db, KY);
  assert.equal(doc()?.trang_thai, 'nhap');
  assert.notEqual(doc()?.ct, CT_DA_NOP);
});

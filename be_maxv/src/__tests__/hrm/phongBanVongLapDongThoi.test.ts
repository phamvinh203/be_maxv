import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updatePhongBan } from '../../services/client/hrm/du_lieu_ca_nhan/phongBan.service';

/**
 * vbsec 2026-09-10 (LOW, phongBan.service.ts:210): chống vòng lặp cây phòng ban là kiểm-rồi-ghi không khóa.
 * Hai người đổi "trực thuộc" CÙNG LÚC — A dưới B và B dưới A — mỗi lượt đi ngược chuỗi cha lúc bên kia chưa
 * ghi nên đều thấy hợp lệ, rồi cùng ghi -> A -> B -> A: cây mất gốc, mọi truy vấn đệ quy sau đó treo.
 * Sửa: kiểm + ghi trong giao dịch có khóa chung cho thao tác đổi cây.
 *
 * DB tenant giả: `$transaction` chạy LẦN LƯỢT (đúng tác dụng của khóa advisory); lệnh ghi có độ trễ để
 * hai lượt không khóa chắc chắn cùng qua bước kiểm trước khi ghi.
 */

type Dong = { ma_pb: string; ma_pb_me: string | null; da_xoa: boolean };

function taoDb(dong: Dong[]) {
  const bang = new Map(dong.map((d) => [d.ma_pb, { ...d }]));
  let hangDoi = Promise.resolve();
  const doc = (ma: string) => {
    const d = bang.get(ma);
    return d ? { ...d } : null;
  };
  const db = {
    bang,
    hrm_phong_ban: {
      findFirst: async ({
        where,
      }: {
        where: { ma_pb: string; da_xoa?: boolean };
      }) => {
        const d = doc(where.ma_pb);
        return d && (where.da_xoa === undefined || d.da_xoa === where.da_xoa)
          ? d
          : null;
      },
      findUnique: async ({ where }: { where: { ma_pb: string } }) =>
        doc(where.ma_pb),
      update: async ({
        where,
        data,
      }: {
        where: { ma_pb: string };
        data: Partial<Dong>;
      }) => {
        await new Promise((r) => setTimeout(r, 15));
        const d = bang.get(where.ma_pb)!;
        if (data.ma_pb_me !== undefined) d.ma_pb_me = data.ma_pb_me;
        return { ...d };
      },
    },
    $executeRaw: async () => 1,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const truoc = hangDoi;
      let mo!: () => void;
      hangDoi = new Promise<void>((r) => (mo = r));
      await truoc;
      try {
        return await fn(db);
      } finally {
        mo();
      }
    },
  };
  return db;
}

test('đổi trực thuộc chéo nhau cùng lúc (A dưới B, B dưới A): một lượt bị chặn, cây không có vòng', async () => {
  const db = taoDb([
    { ma_pb: 'PB01', ma_pb_me: null, da_xoa: false },
    { ma_pb: 'PB02', ma_pb_me: null, da_xoa: false },
  ]);

  const kq = await Promise.all([
    updatePhongBan(db as never, 'PB01', { ma_pb_me: 'PB02' } as never).then(
      () => 'ok',
      (e: Error) => e,
    ),
    updatePhongBan(db as never, 'PB02', { ma_pb_me: 'PB01' } as never).then(
      () => 'ok',
      (e: Error) => e,
    ),
  ]);

  assert.equal(
    kq.filter((k) => k === 'ok').length,
    1,
    `kết quả: ${kq.map(String).join(' | ')}`,
  );
  const loi = kq.find((k) => k !== 'ok') as Error;
  assert.equal(loi.name, 'ConflictError');
  const a = db.bang.get('PB01')!.ma_pb_me;
  const b = db.bang.get('PB02')!.ma_pb_me;
  assert.ok(!(a === 'PB02' && b === 'PB01'), 'cây đã thành vòng PB01 <-> PB02');
});

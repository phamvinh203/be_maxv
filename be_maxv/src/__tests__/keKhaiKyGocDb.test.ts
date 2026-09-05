import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "../generated/tenant";
import { danhDauKy } from "../services/client/to_khai/application/keKhaiKy.service";

const KY_Q1_2026 = { nam: 2026, kyLoai: "quy" as const, kySo: 1 };

interface RawCall {
  sql: string;
  params: unknown[];
}

/** Mock tối thiểu của DB: đủ đi qua đúng đường đọc/gán kỳ, không cần Postgres thật. */
function taoDbGia(ngayUngVien: Date[]) {
  const rawCalls: RawCall[] = [];
  const executeCalls: RawCall[] = [];
  const hoaDonThayThe = {
    id: "tt-1",
    tdlap: new Date("2026-01-15T00:00:00+07:00"),
    nbmst: "0100123456",
    khhdgoc: "C26ABC",
    shdgoc: "001",
    gchdgoc: null,
  };

  const db = {
    vct50view: { findMany: async () => [{ id: hoaDonThayThe.id }] },
    vct60view: { findMany: async () => [{ id: hoaDonThayThe.id }] },
    $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
      rawCalls.push({ sql, params });
      if (sql.includes("WHERE tthai = ANY")) return [hoaDonThayThe];
      if (sql.includes("SELECT tdlap")) return ngayUngVien.map((tdlap) => ({ tdlap }));
      assert.fail(`Truy vấn không nằm trong phạm vi test: ${sql}`);
    },
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      executeCalls.push({ sql, params });
      return 0;
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    tokhai_ky_hoa_don: { upsert: async () => ({}) },
  } as unknown as PrismaClient;

  return { db, rawCalls, executeCalls };
}

test("đọc khóa gốc từ detail/raw và tra hóa đơn gốc kèm MST", async () => {
  const { db, rawCalls } = taoDbGia([new Date("2026-01-10T00:00:00+07:00")]);

  const ketQua = await danhDauKy(db, KY_Q1_2026);

  assert.equal(ketQua.purchase, 1);
  assert.equal(ketQua.sold, 1);
  const queryHoaDonCoGoc = rawCalls.find((call) => call.sql.includes("WHERE tthai = ANY"));
  assert.match(queryHoaDonCoGoc?.sql ?? "", /BTRIM\(raw->>'khhdgoc'\)/);
  const queryHoaDonGoc = rawCalls.find((call) => call.sql.includes("SELECT tdlap"));
  assert.match(queryHoaDonGoc?.sql ?? "", /WHERE nbmst = \$1 AND khhdon = \$2 AND shdon = \$3/);
  assert.deepEqual(queryHoaDonGoc?.params, ["0100123456", "C26ABC", "001"]);
});

test("nhiều ứng viên gốc khác ngày: chặn hóa đơn và dọn gán kỳ cũ", async () => {
  const { db, executeCalls } = taoDbGia([
    new Date("2026-01-10T00:00:00+07:00"),
    new Date("2026-02-10T00:00:00+07:00"),
  ]);

  const ketQua = await danhDauKy(db, KY_Q1_2026);

  assert.equal(ketQua.purchase, 0);
  assert.equal(ketQua.sold, 0);
  assert.equal(ketQua.khongRoKyGoc, 2);
  const xoaGanCu = executeCalls.filter((call) => call.sql.includes('WHERE chieu = $1 AND hoa_don_id'));
  assert.equal(xoaGanCu.length, 2);
  assert.deepEqual(xoaGanCu.map((call) => call.params), [
    ["purchase", ["tt-1"]],
    ["sold", ["tt-1"]],
  ]);
});

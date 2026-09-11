import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "../../generated/tenant";
import { danhDauKy } from "../../services/client/to_khai/application/keKhaiKy.service";

const KY_Q1_2026 = { nam: 2026, kyLoai: "quy" as const, kySo: 1 };

interface RawCall {
  sql: string;
  params: unknown[];
}

/** Một dòng kỳ trong `tokhai_gtgt01` / `tokhai_ky_hoa_don` — dạng snake_case như Prisma trả. */
interface DongKy {
  nam: number;
  ky_loai: string;
  ky_so: number;
}

/**
 * Mock tối thiểu của DB: đủ đi qua đúng đường đọc/gán kỳ, không cần Postgres thật.
 *
 * - `kyChot`: các kỳ đang ở trạng thái chốt (`danhDauKy` đọc trước tiên để chặn/chừa);
 * - `kyChotSauLuotDauTien`: danh sách kỳ chốt từ lượt đọc thứ hai trở đi — mô phỏng "Chốt" bấm
 *   trong lúc lượt kê khai đang quét hóa đơn;
 * - `giuBoi`: kỳ chốt đang giữ sẵn hóa đơn `tt-1` — mô phỏng tờ đã nằm ở kỳ đã nộp.
 */
function taoDbGia(
  ngayUngVien: Date[],
  {
    kyChot = [],
    kyChotSauLuotDauTien,
    giuBoi = null,
  }: { kyChot?: DongKy[]; kyChotSauLuotDauTien?: DongKy[]; giuBoi?: DongKy | null } = {},
) {
  let soLanDocKyChot = 0;
  const rawCalls: RawCall[] = [];
  const executeCalls: RawCall[] = [];
  const upsertIds: string[] = [];
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
    tokhai_ky_hoa_don: {
      upsert: async (args: { where: { hoa_don_id_chieu: { hoa_don_id: string } } }) => {
        upsertIds.push(args.where.hoa_don_id_chieu.hoa_don_id);
        return {};
      },
      // Chỉ `tt-1` mới có khả năng đang nằm ở kỳ chốt — mock trả nó khi test dựng `giuBoi`.
      findMany: async () =>
        giuBoi === null ? [] : [{ hoa_don_id: hoaDonThayThe.id, ...giuBoi }],
    },
    tokhai_gtgt01: {
      findMany: async () => {
        soLanDocKyChot += 1;
        return soLanDocKyChot > 1 && kyChotSauLuotDauTien ? kyChotSauLuotDauTien : kyChot;
      },
    },
  } as unknown as PrismaClient;

  return { db, rawCalls, executeCalls, upsertIds };
}

const KY_Q1_2026_ROW: DongKy = { nam: 2026, ky_loai: "quy", ky_so: 1 };
const KY_T12_2025_ROW: DongKy = { nam: 2025, ky_loai: "thang", ky_so: 12 };

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

test("kỳ đã chốt: từ chối kê khai lại, không đụng vào bảng kê", async () => {
  const { db, rawCalls, executeCalls } = taoDbGia([new Date("2026-01-10T00:00:00+07:00")], {
    kyChot: [KY_Q1_2026_ROW],
  });

  await assert.rejects(() => danhDauKy(db, KY_Q1_2026), /đã chốt/);

  // Chặn phải xảy ra TRƯỚC mọi lượt đọc/ghi bảng kê — gỡ rồi mới báo lỗi là đã mất dữ liệu.
  assert.equal(rawCalls.length, 0);
  assert.equal(executeCalls.length, 0);
});

test("hóa đơn đang thuộc kỳ chốt khác: giữ nguyên ở đó và nêu tên kỳ", async () => {
  const { db, executeCalls, upsertIds } = taoDbGia([new Date("2026-01-10T00:00:00+07:00")], {
    kyChot: [KY_T12_2025_ROW],
    giuBoi: KY_T12_2025_ROW,
  });

  const ketQua = await danhDauKy(db, KY_Q1_2026);

  // Không kéo sang kỳ đang kê khai...
  assert.equal(upsertIds.length, 0);
  assert.equal(ketQua.purchase, 0);
  assert.equal(ketQua.sold, 0);
  // ...cũng không xóa khỏi kỳ chốt (`goHoaDonKhongRoKyGoc` chỉ chạy khi có id để gỡ).
  assert.equal(
    executeCalls.filter((c) => c.sql.includes("WHERE chieu = $1 AND hoa_don_id")).length,
    0,
  );
  // Và nói rõ vì sao kỳ mới thiếu tờ đó, kèm tên kỳ đang giữ.
  assert.equal(ketQua.giuKyChot, 2); // một tờ mỗi chiều
  assert.deepEqual(ketQua.kyChotDangGiu, ["T12/2025"]);
});

/*
 * vbsec 2026-09-10 (MEDIUM, cùng nhóm toKhaiGtgt01.service.ts:225): danh sách kỳ chốt chỉ đọc MỘT lần
 * trước lượt quét hóa đơn (N+1 truy vấn, có thể kéo dài). "Chốt" bấm trong lúc quét thì lượt ghi phía sau
 * vẫn gỡ/gán hóa đơn của kỳ vừa chốt — bảng kê lệch khỏi số đã nộp mà không ai thấy.
 */

test("kỳ đang kê khai bị chốt trong lúc quét: dừng trước khi ghi, bảng kê không bị đụng", async () => {
  const { db, executeCalls, upsertIds } = taoDbGia([new Date("2026-01-10T00:00:00+07:00")], {
    kyChotSauLuotDauTien: [KY_Q1_2026_ROW],
  });

  await assert.rejects(() => danhDauKy(db, KY_Q1_2026), /đã chốt/);
  assert.equal(executeCalls.length, 0);
  assert.equal(upsertIds.length, 0);
});

test("kỳ khác bị chốt trong lúc quét: hóa đơn nó đang giữ vẫn được chừa lại", async () => {
  const { db, upsertIds } = taoDbGia([new Date("2026-01-10T00:00:00+07:00")], {
    kyChotSauLuotDauTien: [KY_T12_2025_ROW],
    giuBoi: KY_T12_2025_ROW,
  });

  const ketQua = await danhDauKy(db, KY_Q1_2026);

  assert.equal(upsertIds.length, 0);
  assert.equal(ketQua.giuKyChot, 2);
  assert.deepEqual(ketQua.kyChotDangGiu, ["T12/2025"]);
});

test("kỳ chốt không liên quan: kê khai kỳ khác vẫn chạy bình thường", async () => {
  const { db } = taoDbGia([new Date("2026-01-10T00:00:00+07:00")], {
    kyChot: [KY_T12_2025_ROW],
  });

  const ketQua = await danhDauKy(db, KY_Q1_2026);

  assert.equal(ketQua.purchase, 1);
  assert.equal(ketQua.sold, 1);
  assert.equal(ketQua.giuKyChot, 0);
  assert.deepEqual(ketQua.kyChotDangGiu, []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { nguongLamTron, soatToKhai } from "../services/client/to_khai/soatToKhai";
import type { TongBanRa } from "../services/client/to_khai/gomHoaDonGtgt";
import type { CtGtgt01 } from "../services/client/to_khai/tinhGtgt01";
import type { Ky } from "../services/client/to_khai/kySoThue";

/** npx tsx --test src/__tests__/soatToKhai.test.ts */

const Q2: Ky = { nam: 2026, kyLoai: "quy", kySo: 2 };

function tong(p: Partial<TongBanRa> = {}): TongBanRa {
  return { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0, ...p };
}
function ct(p: Record<string, number> = {}): CtGtgt01 {
  return { ct31: 0, ct32: 0, ct33: 0, ...p };
}
/** Bản soát mặc định "mọi thứ đều ổn"; mỗi ca chỉ đổi phần mình quan tâm. */
function soat(p: Partial<Parameters<typeof soatToKhai>[0]> = {}) {
  return soatToKhai({
    ct: ct(),
    ctMay: ct(),
    tongBanRa: tong(),
    soHdBan: 0,
    giamThue10: 0,
    kyNay: Q2,
    kyNguonCt22: null,
    ...p,
  });
}

test("kỳ bình thường: không cảnh báo gì", () => {
  assert.deepEqual(soat(), []);
});

test("ca thật Q2/2026 không sinh cảnh báo giả", () => {
  // [33] công thức 31.299.994 vs bảng kê 31.299.993 — lệch 1 đồng, 3 hóa đơn.
  const kq = soat({
    ct: ct({ ct32: 391_249_917, ct33: 31_299_994 }),
    ctMay: ct({ ct32: 391_249_917, ct33: 31_299_994 }),
    tongBanRa: tong({ ct32: 391_249_917, ct33: 31_299_993 }),
    soHdBan: 3,
    giamThue10: 7_824_998,
    kyNguonCt22: { nam: 2026, kyLoai: "quy", kySo: 1 },
  });
  assert.deepEqual(kq, []);
});

test("lệch lớn hơn mức làm tròn -> cảnh báo, kèm số lệch", () => {
  const kq = soat({
    ctMay: ct({ ct32: 10_000_000, ct33: 1_000_000 }),
    ct: ct({ ct32: 10_000_000, ct33: 1_000_000 }),
    tongBanRa: tong({ ct32: 10_000_000, ct33: 800_000 }),
    soHdBan: 3,
  });
  assert.equal(kq.length, 1);
  assert.match(kq[0], /\[33\]/);
  assert.match(kq[0], /200\.000/);
});

test("ngưỡng nới theo số hóa đơn — kỳ nhiều tờ lệch vài chục đồng vẫn im", () => {
  // 100 hóa đơn, lệch 100 đồng: mỗi tờ 1 đồng làm tròn, chấp nhận được.
  const im = soat({
    ctMay: ct({ ct33: 1_000_100 }),
    ct: ct({ ct33: 1_000_100 }),
    tongBanRa: tong({ ct33: 1_000_000 }),
    soHdBan: 100,
  });
  assert.deepEqual(im, []);

  // Cùng số lệch nhưng chỉ 2 hóa đơn -> bất thường.
  const keu = soat({
    ctMay: ct({ ct33: 1_000_100 }),
    ct: ct({ ct33: 1_000_100 }),
    tongBanRa: tong({ ct33: 1_000_000 }),
    soHdBan: 2,
  });
  assert.equal(keu.length, 1);
});

test("ghi đè [33] KHÔNG bị báo là lệch bảng kê — sửa tay là cố ý", () => {
  const kq = soat({
    ct: ct({ ct32: 10_000_000, ct33: 500_000 }), // kế toán chốt tay
    ctMay: ct({ ct32: 10_000_000, ct33: 1_000_000 }),
    tongBanRa: tong({ ct32: 10_000_000, ct33: 1_000_000 }),
    soHdBan: 3,
  });
  assert.deepEqual(kq, []);
});

test("[32] sửa tay về 0 mà phụ lục giữ nguyên -> báo cả hai lỗi", () => {
  const kq = soat({
    ct: ct({ ct32: 0, ct33: -7_824_998 }),
    ctMay: ct({ ct32: 391_249_917, ct33: 31_299_994 }),
    tongBanRa: tong({ ct32: 391_249_917, ct33: 31_299_993 }),
    soHdBan: 3,
    giamThue10: 7_824_998,
  });
  assert.equal(kq.length, 2);
  assert.match(kq[0], /lớn hơn \[32\] × 10%/);
  assert.match(kq[1], /\[33\] đang âm/);
});

test("[31] cũng được soát, không chỉ [33]", () => {
  const kq = soat({
    ctMay: ct({ ct31: 500_000 }),
    ct: ct({ ct31: 500_000 }),
    tongBanRa: tong({ ct31: 100_000 }),
    soHdBan: 1,
  });
  assert.equal(kq.length, 1);
  assert.match(kq[0], /\[31\]/);
});

test("đổi kỳ khai quý -> tháng thì nhắc đối chiếu [22]", () => {
  const kq = soat({
    kyNay: { nam: 2026, kyLoai: "thang", kySo: 1 },
    kyNguonCt22: { nam: 2025, kyLoai: "quy", kySo: 4 },
  });
  assert.equal(kq.length, 1);
  assert.match(kq[0], /Q4\/2025/);
  assert.match(kq[0], /quý/);
});

test("kỳ nguồn cùng loại thì không nhắc", () => {
  assert.deepEqual(soat({ kyNguonCt22: { nam: 2026, kyLoai: "quy", kySo: 1 } }), []);
});

test("ngưỡng làm tròn không âm kể cả khi không có hóa đơn nào", () => {
  assert.equal(nguongLamTron(0), 1);
  assert.equal(nguongLamTron(-5), 1);
  assert.equal(nguongLamTron(120), 121);
});


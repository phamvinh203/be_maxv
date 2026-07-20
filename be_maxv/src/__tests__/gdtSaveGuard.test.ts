import { test } from "node:test";
import assert from "node:assert/strict";
import { findForeignOwnerMsts, saveInvoices } from "../services/client/hddt/gdt.service";

/**
 * Test GUARD chống ghi nhầm data MST khác vào DB tenant.
 *
 * Bối cảnh (bug thật): token GDT (quyết định fetch data của MST nào) tách rời khỏi công ty app
 * (quyết định ghi vào DB tenant nào). Nếu lệch, hóa đơn của MST khác bị ghi vào DB tenant hiện tại.
 * Chủ hóa đơn: mua vào = người mua (`nmmst`), bán ra = người bán (`nbmst`) — phải = MST tenant.
 *
 *   npx tsx --test src/__tests__/gdtSaveGuard.test.ts
 */

const OWN = "0106861880";
const FOREIGN = "0106097979";

test("findForeignOwnerMsts: mua vào — nmmst khớp tenant -> sạch", () => {
  const rows = [{ nmmst: OWN }, { nmmst: OWN }];
  assert.deepEqual(findForeignOwnerMsts("purchase", rows, OWN), []);
});

test("findForeignOwnerMsts: mua vào — nmmst là MST khác -> phát hiện", () => {
  const rows = [{ nmmst: OWN }, { nmmst: FOREIGN }];
  assert.deepEqual(findForeignOwnerMsts("purchase", rows, OWN), [FOREIGN]);
});

test("findForeignOwnerMsts: bán ra — chủ hóa đơn là NGƯỜI BÁN (nbmst)", () => {
  // Bán ra: nbmst phải = tenant. nmmst (người mua) là khách, khác MST là BÌNH THƯỜNG.
  const rows = [{ nbmst: OWN, nmmst: FOREIGN }];
  assert.deepEqual(findForeignOwnerMsts("sold", rows, OWN), []);
  assert.deepEqual(findForeignOwnerMsts("sold", [{ nbmst: FOREIGN }], OWN), [FOREIGN]);
});

test("findForeignOwnerMsts: MST chi nhánh (đuôi -001) khớp theo MST gốc", () => {
  const rows = [{ nmmst: `${OWN}-001` }];
  assert.deepEqual(findForeignOwnerMsts("purchase", rows, OWN), []);
});

test("findForeignOwnerMsts: thiếu MST chủ hóa đơn -> bỏ qua (không chặn nhầm)", () => {
  const rows = [{ nmmst: "" }, { nmmst: null }, {}];
  assert.deepEqual(findForeignOwnerMsts("purchase", rows as never, OWN), []);
});

test("saveInvoices: NÉM lỗi khi lô có hóa đơn của MST khác (không đụng DB)", async () => {
  // tenantDb giả: nếu guard KHÔNG chạy trước, $transaction/upsert sẽ bị gọi -> ném lỗi khác.
  const fakeDb = {
    vct60view: { upsert: () => assert.fail("không được ghi khi có data lạ") },
    $transaction: () => assert.fail("không được mở transaction khi có data lạ"),
  };
  await assert.rejects(
    () => saveInvoices(fakeDb as never, "purchase", [{ id: "1", nmmst: FOREIGN }], OWN),
    (err: Error) => err.message.includes(FOREIGN) && err.message.includes(OWN),
  );
});

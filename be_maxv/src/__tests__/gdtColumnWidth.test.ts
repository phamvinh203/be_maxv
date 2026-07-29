import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDienGiai,
  findOversizedKeyFields,
  saveInvoices,
  toVctData,
} from "../services/client/hddt/gdt.service";

/**
 * Test ĐỘ RỘNG CỘT khi ghi hóa đơn GDT vào vct50view/vct60view.
 *
 * Bối cảnh (bug thật, 29/07/2026 — đồng bộ mua vào 01/06..30/06 chết ở dòng 570/583):
 *   Invalid `prisma.vct60view.upsert()` invocation:
 *   The provided value for the column is too long for the column's type. Column: (not available)
 *
 * Dữ liệu GDT là dữ liệu NGOÀI do người bán tự nhập — không có gì bảo đảm nó vừa các cột
 * VarChar của mình. `toVctData` trước đây chép thẳng chuỗi vào cột nên 1 hóa đơn có field dài
 * quá cột làm Postgres ném 22001 -> Prisma P2000, cả trang trong `$transaction` bị rollback và
 * lượt đồng bộ dừng giữa chừng. Postgres KHÔNG cho biết cột nào -> phải tự cắt + tự log.
 *
 *   npx tsx --test src/__tests__/gdtColumnWidth.test.ts
 */

const long = (n: number) => "x".repeat(n);

test("toVctData: field mô tả dài hơn cột -> cắt về đúng độ rộng cột", () => {
  // thtttoan VarChar(32) — người bán hay ghi kiểu "Tiền mặt/Chuyển khoản/Bù trừ công nợ".
  const data = toVctData({ id: "hd1", thtttoan: long(60), gchu: long(2000) });
  assert.equal(data.thtttoan?.length, 32);
  assert.equal(data.gchu?.length, 1024);
});

test("toVctData: giá trị đầy đủ vẫn nằm nguyên trong cột raw (không mất dữ liệu)", () => {
  const row = { id: "hd1", nbten: long(300), nbdchi: long(700) };
  const data = toVctData(row);
  assert.equal(data.nbten.length, 254);
  assert.equal(data.nbdchi?.length, 512);
  // `raw` là payload GDT gốc -> tra cứu lại được toàn bộ giá trị bị cắt ở cột.
  assert.equal((data.raw as Record<string, unknown>).nbten, long(300));
  assert.equal((data.raw as Record<string, unknown>).nbdchi, long(700));
});

test("toVctData: giá trị vừa cột -> giữ nguyên, không cắt nhầm", () => {
  const data = toVctData({
    id: "hd1",
    thtttoan: "TM/CK",
    gchu: "Ghi chú bình thường",
    nbten: "CÔNG TY TNHH ABC",
  });
  assert.equal(data.thtttoan, "TM/CK");
  assert.equal(data.gchu, "Ghi chú bình thường");
  assert.equal(data.nbten, "CÔNG TY TNHH ABC");
});

test("findOversizedKeyFields: khóa bình thường -> rỗng", () => {
  const data = toVctData({
    id: "abc123",
    khmshdon: "1",
    khhdon: "C26TAA",
    shdon: "1234",
    nbmst: "0106861880",
    nmmst: "0106097979",
  });
  assert.deepEqual(findOversizedKeyFields({ ...data, id: "abc123" }), []);
});

test("findOversizedKeyFields: khóa vượt cột -> báo tên field + độ dài", () => {
  const data = toVctData({ nbmst: long(30), shdon: "1" });
  const found = findOversizedKeyFields({ ...data, id: long(70) });
  assert.deepEqual(found, ["id(70>64)", "nbmst(30>24)"]);
});

test("saveInvoices: bỏ dòng có khóa quá dài, vẫn lưu các dòng hợp lệ", async () => {
  const upserted: string[] = [];
  const fakeDb = {
    vct60view: {
      upsert: (a: { where: { id: string } }) => {
        upserted.push(a.where.id);
        return a;
      },
    },
    $transaction: async (ops: unknown[]) => ops,
  };
  const OWN = "0106861880";
  const saved = await saveInvoices(
    fakeDb as never,
    "purchase",
    [
      { id: "ok1", nmmst: OWN, shdon: "1" },
      // Khóa hỏng: cắt bớt sẽ làm sai định danh hóa đơn -> phải BỎ dòng, không phải cắt.
      { id: long(70), nmmst: OWN, shdon: "2" },
      { id: "ok2", nmmst: OWN, shdon: "3" },
    ],
    OWN,
  );
  assert.equal(saved, 2);
  assert.deepEqual(upserted, ["ok1", "ok2"]);
});

test("saveInvoices: dòng có field mô tả quá dài VẪN được lưu (đã cắt)", async () => {
  const upserted: { where: { id: string }; create: { gchu?: string } }[] = [];
  const fakeDb = {
    vct60view: {
      upsert: (a: { where: { id: string }; create: { gchu?: string } }) => {
        upserted.push(a);
        return a;
      },
    },
    $transaction: async (ops: unknown[]) => ops,
  };
  const OWN = "0106861880";
  const saved = await saveInvoices(
    fakeDb as never,
    "purchase",
    [{ id: "hd1", nmmst: OWN, gchu: long(5000) }],
    OWN,
  );
  assert.equal(saved, 1);
  assert.equal(upserted[0].create.gchu?.length, 1024);
});

test("buildDienGiai: message lỗi rất dài -> cắt vừa cột dien_giai VarChar(512)", () => {
  // Lỗi Prisma/GDT có thể dài hàng nghìn ký tự; trước đây làm chính dòng lịch sử ghi hỏng nốt.
  const text = buildDienGiai("Đồng bộ", "purchase", { partial: true, message: long(5000) });
  assert.equal(text.length, 512);
  assert.ok(text.startsWith("Đồng bộ hóa đơn đầu vào — "));
});

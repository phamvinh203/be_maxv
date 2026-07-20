import { test } from "node:test";
import assert from "node:assert/strict";
import { toVctData } from "../services/client/hddt/gdt.service";

/**
 * Test ánh xạ NGÀY KÝ (`nky`) của `toVctData`.
 *
 * Bối cảnh: GDT trả `nky: null` cho một phần hóa đơn (chủ yếu máy tính tiền, ttxly="8") nhưng
 * VẪN có ngày ký dưới tên `ntao` (dự phòng cuối: `ncnhat`). Không fallback -> dòng nào được
 * INSERT lần đầu từ nguồn đó sẽ có cột `nky` NULL và FE hiện "—" ở cột "Ngày ký".
 *
 *   npx tsx --test src/__tests__/gdtVctData.test.ts
 */

test("nky: dùng đúng nky khi GDT có trả (không bị ntao ghi đè)", () => {
  // Dòng thật (ttxly=8, endpoint thường): nky và ntao LỆCH nhau -> phải lấy nky.
  const data = toVctData({
    nky: "2025-07-01T09:47:02Z",
    ntao: "2025-07-02T02:46:53.103Z",
  });
  assert.equal(data.nky?.toISOString(), "2025-07-01T09:47:02.000Z");
});

test("nky: fallback sang ntao khi GDT trả nky = null", () => {
  // Dòng thật (shdon=2051, ttxly=8): raw.nky null, ngày ký nằm ở ntao.
  const data = toVctData({
    nky: null,
    ntao: "2026-01-24T16:40:13.154Z",
    ncnhat: "2026-01-24T16:40:13.154Z",
  });
  assert.equal(data.nky?.toISOString(), "2026-01-24T16:40:13.154Z");
});

test("nky: fallback sang ncnhat khi thiếu cả nky lẫn ntao", () => {
  const data = toVctData({ ncnhat: "2025-08-14T05:02:28.939Z" });
  assert.equal(data.nky?.toISOString(), "2025-08-14T05:02:28.939Z");
});

test("nky: undefined khi không nguồn nào có ngày ký (Prisma bỏ qua khi update)", () => {
  assert.equal(toVctData({ nky: null, ntao: null, ncnhat: "" }).nky, undefined);
});

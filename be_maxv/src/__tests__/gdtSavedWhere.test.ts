import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSavedWhere } from "../services/client/hddt/gdt.service";

/**
 * Test các field `buildSavedWhere` CÒN xử lý phía server sau khi chuyển phần lớn lọc (tên/địa chỉ
 * đối tác, đơn vị tiền tệ, trạng thái tải, khoảng tiền/tỷ giá) sang lọc phía client — bảng đã tải
 * toàn bộ hóa đơn trong khoảng ngày về client một lần, không cần vòng qua BE mỗi lần gõ nữa (xem
 * `matchesOverviewFilters`/`matchesDetailHeaderFilters` ở `InvoiceListTabs.tsx`).
 *
 * Còn lại đúng: khoảng ngày (bắt buộc) + mauHd/soSeri/soHd/MST đối tác (contains) +
 * trangThaiHd/ketQuaHd (khớp tuyệt đối, chọn từ dropdown).
 *
 *   npx tsx --test src/__tests__/gdtSavedWhere.test.ts
 */

const RANGE = { tuNgay: "2026-01-01", denNgay: "2026-01-31" };

/**
 * Trả kiểu Prisma `WhereInput` gắn nhãn model ("vct60view"/"vct50view") nên field lọc động
 * (spread theo `direction`) không suy luận đủ rõ để test index thẳng — ép về map thuần để so
 * runtime shape, đúng cái test này quan tâm.
 */
function asWhere(direction: "purchase" | "sold", query: Parameters<typeof buildSavedWhere>[1]) {
  return buildSavedWhere(direction, query) as unknown as Record<string, unknown>;
}

test("buildSavedWhere: mauHd/soSeri/soHd lọc contains — gõ 1 phần vẫn khớp (search sống)", () => {
  const where = asWhere("purchase", { ...RANGE, mauHd: "1", soSeri: "TAB", soHd: "23" });
  assert.deepEqual(where.khmshdon, { contains: "1", mode: "insensitive" });
  assert.deepEqual(where.khhdon, { contains: "TAB", mode: "insensitive" });
  assert.deepEqual(where.shdon, { contains: "23", mode: "insensitive" });
});

test("buildSavedWhere: MST đối tác lọc contains — gõ đầu số vẫn khớp", () => {
  assert.deepEqual(asWhere("purchase", { ...RANGE, mstNguoiBan: "0101" }).nbmst, {
    contains: "0101",
    mode: "insensitive",
  });
  assert.deepEqual(asWhere("sold", { ...RANGE, mstNguoiMua: "0101" }).nmmst, {
    contains: "0101",
    mode: "insensitive",
  });
});

test("buildSavedWhere: trangThaiHd/ketQuaHd (chọn từ dropdown) vẫn khớp tuyệt đối", () => {
  assert.equal(asWhere("purchase", { ...RANGE, trangThaiHd: "1" }).tthai, "1");
  assert.equal(asWhere("purchase", { ...RANGE, ketQuaHd: "5" }).ttxly, "5");
});

test("buildSavedWhere: field bỏ trống -> không xuất hiện trong where", () => {
  const where = asWhere("purchase", { ...RANGE });
  assert.equal("khmshdon" in where, false);
  assert.equal("khhdon" in where, false);
  assert.equal("shdon" in where, false);
  assert.equal("nbmst" in where, false);
  assert.equal("tthai" in where, false);
  assert.equal("ttxly" in where, false);
});

test("buildSavedWhere: luôn có khoảng ngày lập (bắt buộc)", () => {
  const where = asWhere("purchase", RANGE);
  assert.ok(where.tdlap);
});

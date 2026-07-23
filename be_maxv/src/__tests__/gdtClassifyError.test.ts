import { test } from "node:test";
import assert from "node:assert/strict";
import { GdtHttpError } from "../config/gdt-client";
import { classifyGdtError } from "../services/client/hddt/gdt.service";

/**
 * Phân loại lỗi GDT — quyết định retry hay dừng lượt.
 *   npx tsx --test src/__tests__/gdtClassifyError.test.ts
 */

const httpErr = (status: number, elapsedMs: number) =>
  new GdtHttpError(status, "Test", "{}", elapsedMs);

test("401/403 -> auth (token hết hạn, KHÔNG được đánh lỗi giả cho hóa đơn)", () => {
  assert.equal(classifyGdtError(httpErr(401, 50)), "auth");
  assert.equal(classifyGdtError(httpErr(403, 5000)), "auth");
});

test("429 -> transient dù nhanh hay chậm (rate-limit luôn đáng thử lại)", () => {
  assert.equal(classifyGdtError(httpErr(429, 20)), "transient");
  assert.equal(classifyGdtError(httpErr(429, 9000)), "transient");
});

test("5xx CHẬM -> transient (GDT quá tải thật, đáng retry)", () => {
  assert.equal(classifyGdtError(httpErr(500, 4000)), "transient");
  assert.equal(classifyGdtError(httpErr(503, 1200)), "transient");
});

test("5xx NHANH -> permanent (GDT từ chối tham số, retry vô ích)", () => {
  // Chính là ca đo được khi thử size=200: 500 trả về sau 63ms.
  assert.equal(classifyGdtError(httpErr(500, 63)), "permanent");
  assert.equal(classifyGdtError(httpErr(500, 499)), "permanent");
  // Ngay trên ngưỡng thì quay lại transient — biên phải rõ ràng.
  assert.equal(classifyGdtError(httpErr(500, 500)), "transient");
});

test("4xx khác -> permanent", () => {
  assert.equal(classifyGdtError(httpErr(400, 30)), "permanent");
  assert.equal(classifyGdtError(httpErr(404, 30)), "permanent");
});

test("lỗi tầng fetch (mạng/timeout/abort) -> transient", () => {
  assert.equal(classifyGdtError(new Error("fetch failed")), "transient");
  assert.equal(classifyGdtError(new Error("The operation was aborted")), "transient");
  assert.equal(classifyGdtError(new Error("ECONNRESET")), "transient");
});

test("lưới an toàn: Error thường mang chuỗi 'GDT API Error' vẫn phân loại được", () => {
  // Trường hợp lỗi mất kiểu khi đi qua ranh giới nào đó — không có elapsedMs nên 5xx coi là transient.
  assert.equal(classifyGdtError(new Error("GDT API Error: 401 Unauthorized")), "auth");
  assert.equal(classifyGdtError(new Error("GDT API Error: 500 Internal")), "transient");
  assert.equal(classifyGdtError(new Error("GDT API Error: 400 Bad Request")), "permanent");
});

test("lỗi lạ hoàn toàn -> permanent (đừng retry thứ không hiểu)", () => {
  assert.equal(classifyGdtError(new Error("chuyện gì đó khác")), "permanent");
  assert.equal(classifyGdtError("không phải Error"), "permanent");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, reportOk, reportRateLimited } from "../services/client/hddt/gdtPacer";

/**
 * Test pacer GDT: bất biến cốt lõi (không phụ thuộc thời lượng interval).
 *   npx tsx --test src/__tests__/gdtPacer.test.ts
 */

test("pacer: tuần tự (concurrency=1) + ưu tiên manual > background", async () => {
  const key = "test-serialize-priority";
  const order: string[] = [];
  let concurrent = 0;
  let maxConcurrent = 0;

  const task = (name: string) => async () => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    order.push(name);
    await new Promise((r) => setTimeout(r, 5));
    concurrent -= 1;
    return name;
  };

  // schedule(B1) chạy pump đồng bộ tới await đầu -> B1 bị "chốt" chạy trước khi B2/M1 được đẩy vào.
  // Sau đó M1 (manual) phải chen trước B2 (background).
  const results = await Promise.all([
    schedule(key, "background", task("B1")),
    schedule(key, "background", task("B2")),
    schedule(key, "manual", task("M1")),
  ]);

  assert.equal(maxConcurrent, 1, "phải tuần tự — không chạy chồng");
  assert.deepEqual(order, ["B1", "M1", "B2"], "manual chen trước background");
  assert.deepEqual(results, ["B1", "B2", "M1"], "schedule trả đúng kết quả từng fn");
});

test("pacer: lỗi của fn được ném lại cho nơi gọi", async () => {
  await assert.rejects(
    schedule("test-reject", "manual", async () => {
      throw new Error("boom");
    }),
    /boom/,
  );
});

test("pacer: report OK/RateLimited không ném lỗi (điều tiết interval)", () => {
  const key = "test-report";
  assert.doesNotThrow(() => {
    reportRateLimited(key);
    reportRateLimited(key);
    reportOk(key);
  });
});

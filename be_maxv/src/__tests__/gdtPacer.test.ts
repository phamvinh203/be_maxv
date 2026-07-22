import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, reportOk, reportRateLimited } from "../services/client/hddt/gdtPacer";

/**
 * Test pacer GDT: bất biến cốt lõi (không phụ thuộc thời lượng interval).
 *   npx tsx --test src/__tests__/gdtPacer.test.ts
 */

test("pacer: tuần tự (concurrency=1) + chạy đúng thứ tự FIFO", async () => {
  const key = "test-serialize-fifo";
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

  // Hàng đợi FIFO duy nhất: task chạy đúng thứ tự được xếp vào.
  const results = await Promise.all([
    schedule(key, task("T1")),
    schedule(key, task("T2")),
    schedule(key, task("T3")),
  ]);

  assert.equal(maxConcurrent, 1, "phải tuần tự — không chạy chồng");
  assert.deepEqual(order, ["T1", "T2", "T3"], "chạy theo thứ tự xếp hàng");
  assert.deepEqual(results, ["T1", "T2", "T3"], "schedule trả đúng kết quả từng fn");
});

test("pacer: lỗi của fn được ném lại cho nơi gọi", async () => {
  await assert.rejects(
    schedule("test-reject", async () => {
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

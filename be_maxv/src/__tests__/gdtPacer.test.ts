import { test } from "node:test";
import assert from "node:assert/strict";
import {
  schedule,
  reportOk,
  reportRateLimited,
  getIntervalMs,
} from "../services/client/hddt/gdtPacer";

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
    schedule(key, "detail", task("T1")),
    schedule(key, "detail", task("T2")),
    schedule(key, "detail", task("T3")),
  ]);

  assert.equal(maxConcurrent, 1, "phải tuần tự — không chạy chồng");
  assert.deepEqual(order, ["T1", "T2", "T3"], "chạy theo thứ tự xếp hàng");
  assert.deepEqual(results, ["T1", "T2", "T3"], "schedule trả đúng kết quả từng fn");
});

test("pacer: hai làn dùng CHUNG hàng đợi (vẫn concurrency=1 trên 1 MST)", async () => {
  const key = "test-lanes-serialize";
  let concurrent = 0;
  let maxConcurrent = 0;

  const task = async () => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 5));
    concurrent -= 1;
  };

  await Promise.all([
    schedule(key, "list", task),
    schedule(key, "detail", task),
    schedule(key, "list", task),
  ]);

  assert.equal(maxConcurrent, 1, "tách làn KHÔNG được làm tăng số call GDT song song");
});

test("pacer: lỗi của fn được ném lại cho nơi gọi", async () => {
  await assert.rejects(
    schedule("test-reject", "detail", async () => {
      throw new Error("boom");
    }),
    /boom/,
  );
});

test("pacer: giãn nhịp làn này KHÔNG lây sang làn kia", () => {
  const key = "test-lane-isolation";
  const detailBefore = getIntervalMs(key, "detail");

  // Pha danh sách bị GDT nuốt nhiều lần -> làn list bị đẩy lên trần.
  for (let i = 0; i < 6; i += 1) reportRateLimited(key, "list");

  assert.ok(
    getIntervalMs(key, "list") > detailBefore,
    "làn list phải bị giãn sau khi báo rate-limit",
  );
  assert.equal(
    getIntervalMs(key, "detail"),
    detailBefore,
    "làn detail KHÔNG được kế thừa hình phạt của làn list",
  );
});

test("pacer: co về sàn theo cấp số nhân, vài chục call chứ không vài trăm", () => {
  const key = "test-decay";
  for (let i = 0; i < 6; i += 1) reportRateLimited(key, "detail");
  const peak = getIntervalMs(key, "detail");
  assert.ok(peak >= 15_000, "6 lần rate-limit phải đẩy tới trần 15s");

  let calls = 0;
  while (getIntervalMs(key, "detail") > peak / 2 && calls < 1000) {
    reportOk(key, "detail");
    calls += 1;
  }
  assert.ok(calls <= 20, `giảm một nửa phải trong <=20 call trót lọt, đang mất ${calls}`);

  // Và có sàn: gọi mãi cũng không tụt xuống dưới 800ms.
  for (let i = 0; i < 500; i += 1) reportOk(key, "detail");
  assert.equal(getIntervalMs(key, "detail"), 800, "không được co xuống dưới sàn 800ms");
});

// ---------------- Làn `dvc`: cổng Dịch vụ công, hàng đợi riêng ----------------

test("pacer: làn dvc chạy TUẦN TỰ (một phiên cổng, cookie xoay vòng - không được chồng)", async () => {
  const key = "test-dvc-serialize";
  let concurrent = 0;
  let maxConcurrent = 0;

  const task = async () => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 5));
    concurrent -= 1;
  };

  await Promise.all([schedule(key, "dvc", task), schedule(key, "dvc", task)]);

  assert.equal(maxConcurrent, 1, "hai call DVC cùng công ty KHÔNG được chạy chồng");
});

test("pacer: hàng đợi dvc ĐỘC LẬP với hàng đợi main (hai cổng khác host)", async () => {
  const key = "test-dvc-queue-doc-lap";
  const chay: string[] = [];

  // `main` nhận một task chậm trước; `dvc` xếp sau nhưng KHÔNG được phải chờ nó.
  const cham = schedule(key, "list", async () => {
    await new Promise((r) => setTimeout(r, 60));
    chay.push("main");
  });
  const nhanh = schedule(key, "dvc", async () => {
    chay.push("dvc");
  });

  await nhanh;
  assert.deepEqual(chay, ["dvc"], "lượt DVC không được xếp sau lượt đồng bộ HĐĐT");
  await cham;
});

test("pacer: giãn nhịp làn dvc KHÔNG lây sang làn HĐĐT và ngược lại", () => {
  const key = "test-dvc-lane-isolation";
  const listTruoc = getIntervalMs(key, "list");

  for (let i = 0; i < 6; i += 1) reportRateLimited(key, "dvc");

  assert.ok(getIntervalMs(key, "dvc") > listTruoc, "làn dvc phải bị giãn sau khi cổng trả 429");
  assert.equal(getIntervalMs(key, "list"), listTruoc, "làn list KHÔNG kế thừa hình phạt của dvc");
});

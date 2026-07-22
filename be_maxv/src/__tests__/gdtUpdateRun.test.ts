import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startUpdateRunWith,
  getUpdateRunStatus,
} from "../services/client/hddt/gdt.service";

/**
 * Test VÒNG ĐỜI lượt "Cập nhật từ Thuế điện tử" chạy nền — dùng `work` giả nên KHÔNG đụng GDT/DB.
 * Đây là chỗ dễ sai nhất của luồng nền: thay lượt, đè trạng thái, treo `active`.
 *   npx tsx --test src/__tests__/gdtUpdateRun.test.ts
 */

/** Promise mở được từ bên ngoài — để test giữ lượt ở trạng thái đang chạy. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 10));

test("lượt xong -> active=false, phase rỗng, có finishedAt", async () => {
  const key = "test-tenant-done";
  const status = startUpdateRunWith(key, "sold", async (st) => {
    st.saved = 7;
  });
  assert.equal(status.active, true);
  assert.equal(status.phase, "list");

  await tick();

  assert.equal(status.active, false);
  assert.equal(status.phase, "");
  assert.equal(status.saved, 7);
  assert.ok(status.finishedAt && status.finishedAt >= status.startedAt);
});

test("work ném lỗi -> ghi error, lượt vẫn đóng", async () => {
  const key = "test-tenant-error";
  const status = startUpdateRunWith(key, "purchase", async () => {
    throw new Error("GDT chặn");
  });

  await tick();

  assert.equal(status.active, false);
  assert.equal(status.error, "GDT chặn");
});

test("lượt mới THAY lượt cũ; lượt cũ kết thúc sau không đè trạng thái lượt mới", async () => {
  const key = "test-tenant-replace";
  const first = deferred();
  const second = deferred();

  startUpdateRunWith(key, "sold", async () => first.promise);
  const newRun = startUpdateRunWith(key, "sold", async () => second.promise);

  // Lượt mới là lượt hiện tại ngay khi vừa bắt đầu.
  assert.equal(getUpdateRunStatus(key, "sold"), newRun);

  // Lượt CŨ kết thúc muộn -> không được đóng lượt mới.
  first.resolve();
  await tick();
  assert.equal(newRun.active, true, "lượt mới phải còn chạy");
  assert.equal(getUpdateRunStatus(key, "sold"), newRun);

  second.resolve();
  await tick();
  assert.equal(newRun.active, false);
});

test("khóa tách theo chiều: lượt bán ra không ảnh hưởng mua vào", async () => {
  const key = "test-tenant-direction";
  const hold = deferred();
  const sold = startUpdateRunWith(key, "sold", async () => hold.promise);

  assert.equal(getUpdateRunStatus(key, "purchase"), null);
  assert.equal(getUpdateRunStatus(key, "sold"), sold);

  hold.resolve();
  await tick();
});

test("chưa từng chạy -> getUpdateRunStatus trả null", () => {
  assert.equal(getUpdateRunStatus("test-tenant-chua-chay", "sold"), null);
});

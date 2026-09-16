import { test, before, after } from "node:test";
import assert from "node:assert/strict";

/**
 * Header `request-id` — ĐIỀU KIỆN BẮT BUỘC để cổng thuế nhận request (đo 16/09/2026).
 *
 * Thiếu nó thì mọi endpoint `/api/*` trừ `/captcha` bị lớp chống bot trả 403
 * "Hệ thống phát hiện hành vi không hợp lệ", trong khi phía trên lại hiện ra "sai tài khoản/mật
 * khẩu/captcha" — nghĩa là mất hẳn chức năng HĐĐT mà thông điệp chỉ sai chỗ khác. Vì vậy phải có
 * test khóa lại: xóa một dòng header trong `gdtSend` là đỏ ngay, không đợi tới lúc chạy thật.
 *
 *   npx tsx --test src/__tests__/hddt/gdtRequestId.test.ts
 */

const fetchGoc = globalThis.fetch;
const cacLuotGoi: Array<{ url: string; headers: Record<string, string> }> = [];
let client: typeof import("../../config/gdt-client");

before(async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    cacLuotGoi.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  client = await import("../../config/gdt-client");
});

after(() => {
  globalThis.fetch = fetchGoc;
});

test("mọi call GDT đều mang request-id, mỗi lần một giá trị khác nhau", async () => {
  cacLuotGoi.length = 0;
  await client.gdtFetch("/captcha");
  await client.gdtFetch("/query/invoices/purchase?size=15", { bearerToken: "t" });

  assert.equal(cacLuotGoi.length, 2);
  const ids = cacLuotGoi.map((g) => g.headers["request-id"]);
  for (const id of ids) {
    assert.ok(id, "thiếu header request-id -> cổng thuế sẽ chặn 403 chống bot");
  }
  assert.notEqual(ids[0], ids[1], "mỗi call phải là một id riêng để lần vết được");
});

test("caller vẫn ghi đè được request-id qua init.headers", async () => {
  cacLuotGoi.length = 0;
  await client.gdtFetch("/captcha", { headers: { "request-id": "id-cua-caller" } });

  assert.equal(cacLuotGoi[0].headers["request-id"], "id-cua-caller");
});

test("200 nhưng body là trang chặn HTML -> báo đúng nguyên nhân, không phải lỗi parse JSON", async () => {
  const fetchJson = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("<html><body>This page can't be displayed.</body></html>", {
      headers: { "content-type": "text/html" },
    })) as typeof fetch;

  await assert.rejects(
    () => client.gdtFetch("/security-taxpayer/authenticate", { method: "POST" }),
    /không phải JSON/,
  );

  globalThis.fetch = fetchJson;
});

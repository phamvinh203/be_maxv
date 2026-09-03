import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_KEYS, khongCoModule } from "../constants/modules";
import { moduleCuaGoi } from "../services/shared/modules.service";

/**
 * npx tsx --test src/__tests__/moduleTokhai.test.ts
 *
 * Module "Tờ khai" (`tokhai`) bán kèm gói như `dvc`/`hrm`/`accounting`. Quyền lưu trong
 * `SubscriptionPlan.features` (kiểu Json) nên thêm module KHÔNG cần migration — nhưng khóa phải
 * khớp ở CẢ BA app (`be_maxv`, `maxv`, `hdđt_maxv`), ba nơi không dùng chung package.
 */

test("MODULE_KEYS có khóa tokhai", () => {
  assert.ok((MODULE_KEYS as readonly string[]).includes("tokhai"));
});

test("khongCoModule() tắt cả tokhai", () => {
  assert.equal(khongCoModule().tokhai, false);
});

test("gói bật tokhai trong features thì moduleCuaGoi trả tokhai=true", () => {
  const sub = {
    status: "ACTIVE" as const,
    ketThuc: null,
    plan: { features: { tokhai: true } },
  };
  assert.equal(moduleCuaGoi(sub).tokhai, true);
});

test("gói hết hạn thì tokhai=false dù features bật", () => {
  const sub = {
    status: "ACTIVE" as const,
    ketThuc: new Date("2020-01-01"),
    plan: { features: { tokhai: true } },
  };
  assert.equal(moduleCuaGoi(sub).tokhai, false);
});

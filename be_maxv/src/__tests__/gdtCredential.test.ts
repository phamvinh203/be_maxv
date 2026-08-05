import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  encryptGdtPassword,
  decryptGdtPassword,
  isEncryptionConfigured,
} from "../services/client/hddt/gdtCredential";

/**
 * Test mã hóa mật khẩu cổng thuế (GDT) — lưu bền + điền sẵn lại.
 *
 *   npx tsx --test src/__tests__/gdtCredential.test.ts
 *
 * `getKey()` đọc thẳng `process.env.GDT_CRED_ENC_KEY` lúc GỌI, nên set/xóa env trong từng test là
 * bật/tắt được tính năng — không phải nạp lại module.
 */

const KEY = Buffer.alloc(32, 1).toString("base64"); // khóa 32 byte hợp lệ (base64)
const OTHER_KEY = Buffer.alloc(32, 2).toString("base64");

let savedEnv: string | undefined;
beforeEach(() => {
  savedEnv = process.env.GDT_CRED_ENC_KEY;
  process.env.GDT_CRED_ENC_KEY = KEY;
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.GDT_CRED_ENC_KEY;
  else process.env.GDT_CRED_ENC_KEY = savedEnv;
});

test("encrypt -> decrypt trả đúng mật khẩu gốc", () => {
  const blob = encryptGdtPassword("MatKhau@123");
  assert.ok(blob, "phải mã hóa được khi có khóa");
  assert.equal(decryptGdtPassword(blob), "MatKhau@123");
});

test("mỗi lần mã hóa dùng IV khác nhau (ciphertext khác nhau)", () => {
  const a = encryptGdtPassword("x");
  const b = encryptGdtPassword("x");
  assert.ok(a && b);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.cipher, b.cipher);
});

test("thiếu khóa -> tắt mềm (encrypt/decrypt null, isEncryptionConfigured false)", () => {
  const blob = encryptGdtPassword("x");
  assert.ok(blob); // đang có khóa
  delete process.env.GDT_CRED_ENC_KEY;
  assert.equal(isEncryptionConfigured(), false);
  assert.equal(encryptGdtPassword("x"), null);
  assert.equal(decryptGdtPassword(blob), null);
});

test("khóa sai độ dài -> tắt mềm", () => {
  process.env.GDT_CRED_ENC_KEY = Buffer.alloc(16, 1).toString("base64"); // 16 byte, không phải 32
  assert.equal(isEncryptionConfigured(), false);
  assert.equal(encryptGdtPassword("x"), null);
});

test("giải mã bằng khóa khác (tag không khớp) -> null, không ném", () => {
  const blob = encryptGdtPassword("secret");
  assert.ok(blob);
  process.env.GDT_CRED_ENC_KEY = OTHER_KEY;
  assert.equal(decryptGdtPassword(blob), null);
});

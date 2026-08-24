import { test } from "node:test";
import assert from "node:assert/strict";
import { laLoiCaptchaTdt, DvcHttpError } from "../services/client/dich_vu_cong/gdt-dvc.service";

/**
 * Test nhận diện lỗi captcha của tab Thuế điện tử.
 *
 * Khác Dịch vụ công: DVC trả mảnh HTML chứa câu lỗi (dò bằng `laLoiCaptcha`), còn ETAX trả HTTP
 * 400 nên ném `DvcHttpError` — dùng nhầm nhánh cũ là vòng thử lại captcha không bao giờ chạy và
 * lượt đồng bộ hỏng ngay lần OCR trượt đầu tiên.
 *
 *   npx tsx --test src/__tests__/dvcLoiCaptchaTdt.test.ts
 */

test("400 kèm câu báo captcha -> đúng là lỗi captcha", () => {
  const err = new DvcHttpError(400, "", "Mã captcha không chính xác, vui lòng thử lại!");
  assert.equal(laLoiCaptchaTdt(err), true);
});

test("400 vì lý do khác -> KHÔNG phải lỗi captcha, đừng thử lại vô ích", () => {
  assert.equal(laLoiCaptchaTdt(new DvcHttpError(400, "", "Thiếu tham số")), false);
});

test("500 kèm câu captcha -> vẫn không tính (sai mã trạng thái)", () => {
  assert.equal(laLoiCaptchaTdt(new DvcHttpError(500, "", "Mã captcha không chính xác")), false);
});

test("lỗi không phải DvcHttpError -> false", () => {
  assert.equal(laLoiCaptchaTdt(new Error("mất mạng")), false);
  assert.equal(laLoiCaptchaTdt(null), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { locGhiDeHopLe } from "../services/client/to_khai/toKhaiGtgt01.service";

/**
 * npx tsx --test src/__tests__/toKhaiGtgt01Ghide.test.ts
 *
 * `locGhiDeHopLe` là cửa DUY NHẤT dữ liệu người dùng đi vào bộ chỉ tiêu tờ khai — mọi thứ lọt qua
 * đây đều thành số trên tờ khai đem nộp, nên không tin gì cả, kể cả tên khóa.
 */

test("giữ đúng các ô hợp lệ", () => {
  const kq = locGhiDeHopLe({ ct22: { gia: 1000, lyDo: "kỳ trước" }, ct25: { gia: 500 } });
  assert.equal(kq.ct22.gia, 1000);
  assert.equal(kq.ct22.lyDo, "kỳ trước");
  assert.equal(kq.ct25.gia, 500);
});

test("bỏ khóa không phải chỉ tiêu 01/GTGT", () => {
  const kq = locGhiDeHopLe({ ct999: { gia: 1 }, trang_thai: { gia: 3 }, nam: { gia: 2026 } });
  assert.deepEqual(Object.keys(kq), []);
});

test("__proto__ không lọt qua được", () => {
  const kq = locGhiDeHopLe(JSON.parse('{"__proto__": {"gia": 999}, "ct22": {"gia": 5}}'));
  assert.deepEqual(Object.keys(kq), ["ct22"]);
  // Object.create(null) nên không có prototype để nhiễm; đọc khóa lạ phải ra undefined.
  assert.equal((kq as Record<string, unknown>).polluted, undefined);
});

test("bỏ giá trị không phải số hữu hạn", () => {
  const kq = locGhiDeHopLe({
    ct22: { gia: "abc" },
    ct25: { gia: Number.NaN },
    ct37: { gia: Number.POSITIVE_INFINITY },
    ct38: { gia: 7 },
  });
  assert.deepEqual(Object.keys(kq), ["ct38"]);
});

test("số 0 và số âm là giá trị hợp lệ", () => {
  // [37] điều chỉnh giảm có thể là 0; ô tiền vẫn phải nhận số âm nếu kế toán khai vậy.
  const kq = locGhiDeHopLe({ ct37: { gia: 0 }, ct38: { gia: -5000 } });
  assert.equal(kq.ct37.gia, 0);
  assert.equal(kq.ct38.gia, -5000);
});

test("ô máy tự tính vẫn ghi đè được — kế toán có quyền sửa", () => {
  assert.equal(locGhiDeHopLe({ ct26: { gia: 123 } }).ct26.gia, 123);
});

test("giá trị không phải object thì bỏ, không ném", () => {
  // So bằng `Object.keys` chứ không `deepEqual(kq, {})`: kết quả dựng bằng `Object.create(null)`
  // (chặn prototype pollution) nên không cùng prototype với object literal.
  assert.deepEqual(Object.keys(locGhiDeHopLe({ ct22: 1000, ct25: null, ct26: "x" })), []);
  assert.deepEqual(Object.keys(locGhiDeHopLe(null)), []);
  assert.deepEqual(Object.keys(locGhiDeHopLe("chuỗi lạ")), []);
});

test("lyDo quá dài bị cắt, không làm hỏng cả lượt lưu", () => {
  assert.equal(locGhiDeHopLe({ ct22: { gia: 1, lyDo: "x".repeat(1000) } }).ct22.lyDo?.length, 500);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { locQuyetDinh } from "../services/client/to_khai/application/keKhaiKy.service";

/**
 * npx tsx --test src/__tests__/quyetDinhKeKhai.test.ts
 *
 * `locQuyetDinh` là cửa DUY NHẤT dữ liệu người dùng đi vào bảng quyết định kê khai — hai cột nó
 * ghi ("Kê khai/không kê khai", "Chỉ tiêu tăng giảm") quyết định hóa đơn nào vào tờ khai, nên
 * không được tin bất cứ thứ gì FE gửi lên.
 */

test("giữ đúng ba field hợp lệ", () => {
  const kq = locQuyetDinh({ keKhai: false, chiTieuTangGiam: "giam", ghiChu: "hóa đơn hủy" });
  assert.deepEqual(kq, { keKhai: false, chiTieuTangGiam: "giam", ghiChu: "hóa đơn hủy" });
});

test("bỏ field lạ và giá trị sai kiểu", () => {
  const kq = locQuyetDinh({ keKhai: "yes", chiTieuTangGiam: "xoay", nam: 2026, ghiChu: 5 });
  assert.deepEqual(kq, {});
});

test("payload rỗng ra object rỗng, không ném", () => {
  assert.deepEqual(locQuyetDinh(null), {});
  assert.deepEqual(locQuyetDinh(undefined), {});
  assert.deepEqual(locQuyetDinh({}), {});
  assert.deepEqual(locQuyetDinh("chuỗi lạ"), {});
});

test("chiTieuTangGiam rỗng là giá trị hợp lệ (xóa lựa chọn cũ)", () => {
  assert.deepEqual(locQuyetDinh({ chiTieuTangGiam: "" }), { chiTieuTangGiam: "" });
});

test("field vắng mặt khác field rỗng — vắng nghĩa là không đổi", () => {
  const chiSuaKeKhai = locQuyetDinh({ keKhai: true });
  assert.deepEqual(Object.keys(chiSuaKeKhai), ["keKhai"]);
  assert.equal("chiTieuTangGiam" in chiSuaKeKhai, false);
  assert.equal("ghiChu" in chiSuaKeKhai, false);
});

test("ghi chú quá dài bị cắt, không làm hỏng cả lượt lưu", () => {
  assert.equal(locQuyetDinh({ ghiChu: "x".repeat(1000) }).ghiChu?.length, 512);
});

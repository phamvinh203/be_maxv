import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dienGiaiChiTieuTangGiam,
  locQuyetDinh,
} from "../../services/client/to_khai/application/keKhaiKy.service";

/**
 * npx tsx --test src/__tests__/to_khai/quyetDinhKeKhai.test.ts
 *
 * `locQuyetDinh` là cửa DUY NHẤT dữ liệu người dùng đi vào bảng quyết định kê khai — hai cột nó
 * ghi ("Kê khai/không kê khai", "Chỉ tiêu tăng giảm") quyết định hóa đơn nào vào tờ khai, nên
 * không được tin bất cứ thứ gì FE gửi lên.
 *
 * "Chỉ tiêu tăng giảm" ghi bằng mã "37"/"38" (khớp số chỉ tiêu mẫu 01/GTGT); mã cũ "tang"/"giam"
 * KHÔNG còn được chấp nhận khi GHI (TC-026/027) — `dienGiaiChiTieuTangGiam` mới là nơi diễn giải
 * chúng, và chỉ áp dụng khi ĐỌC (TC-024/025).
 */

test("giữ đúng ba field hợp lệ", () => {
  const kq = locQuyetDinh({ keKhai: false, chiTieuTangGiam: "37", ghiChu: "hóa đơn hủy" });
  assert.deepEqual(kq, { keKhai: false, chiTieuTangGiam: "37", ghiChu: "hóa đơn hủy" });
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

// TC-to-khai-gtgt01-026/027 — mã CŨ "tang"/"giam" bị loại khi GHI (đối lập rõ với hành vi ĐỌC).
test("mã cũ 'tang' bị loại khi ghi — không còn được chấp nhận sau khi đổi whitelist", () => {
  const kq = locQuyetDinh({ chiTieuTangGiam: "tang" });
  assert.equal("chiTieuTangGiam" in kq, false);
});

test("mã cũ 'giam' bị loại khi ghi", () => {
  const kq = locQuyetDinh({ chiTieuTangGiam: "giam" });
  assert.equal("chiTieuTangGiam" in kq, false);
});

// TC-028 (regression) — vẫn loại giá trị rác.
test("giá trị rác 'xoay' vẫn bị loại (regression sau khi đổi whitelist)", () => {
  assert.equal("chiTieuTangGiam" in locQuyetDinh({ chiTieuTangGiam: "xoay" }), false);
});

// TC-029 — số hợp lý nhưng ngoài tập ("39") cũng bị loại.
test("giá trị '39' (ngoài tập 37/38) bị loại", () => {
  assert.equal("chiTieuTangGiam" in locQuyetDinh({ chiTieuTangGiam: "39" }), false);
});

// TC-030 — field invalid (mã cũ) lẫn field valid khác: field valid vẫn được giữ.
test("payload có mã cũ lẫn field hợp lệ khác — field hợp lệ vẫn lưu, chiTieuTangGiam bị bỏ", () => {
  const kq = locQuyetDinh({ chiTieuTangGiam: "tang", ghiChu: "ghi chú hợp lệ" });
  assert.deepEqual(kq, { ghiChu: "ghi chú hợp lệ" });
});

// TC-031 (regression, edge case 6) — chuỗi rỗng vẫn hợp lệ sau khi đổi whitelist.
test("chuỗi rỗng vẫn hợp lệ sau khi đổi whitelist (regression)", () => {
  assert.deepEqual(locQuyetDinh({ chiTieuTangGiam: "" }), { chiTieuTangGiam: "" });
});

// TC-024/025 — helper diễn giải mã cũ khi ĐỌC (hàm thuần, không cần DB).
test("dienGiaiChiTieuTangGiam: 'tang' -> '38'", () => {
  assert.equal(dienGiaiChiTieuTangGiam("tang"), "38");
});

test("dienGiaiChiTieuTangGiam: 'giam' -> '37'", () => {
  assert.equal(dienGiaiChiTieuTangGiam("giam"), "37");
});

test("dienGiaiChiTieuTangGiam: mã mới '37'/'38' giữ nguyên", () => {
  assert.equal(dienGiaiChiTieuTangGiam("37"), "37");
  assert.equal(dienGiaiChiTieuTangGiam("38"), "38");
});

test("dienGiaiChiTieuTangGiam: null/undefined/rỗng -> ''", () => {
  assert.equal(dienGiaiChiTieuTangGiam(null), "");
  assert.equal(dienGiaiChiTieuTangGiam(undefined), "");
  assert.equal(dienGiaiChiTieuTangGiam(""), "");
});

test("dienGiaiChiTieuTangGiam: giá trị lạ giữ nguyên (không đoán, không ném)", () => {
  assert.equal(dienGiaiChiTieuTangGiam("xoay"), "xoay");
});

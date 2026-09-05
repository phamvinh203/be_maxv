import { test } from "node:test";
import assert from "node:assert/strict";
import { chiaLo } from "../services/client/to_khai/domain/chiaLo";
import { locGhiDeHopLe } from "../services/client/to_khai/application/toKhaiGtgt01.service";
import { catMoTa, DAI_TOI_DA_MO_TA } from "../services/client/to_khai/domain/phuLuc204";

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

/* ===== Chia lô truy vấn hóa đơn (thêm 2026-09-02) ===== */

test("chiaLo cắt đúng số phần tử mỗi lô, lô cuối ngắn hơn", () => {
  const lo = chiaLo([1, 2, 3, 4, 5, 6, 7], 3);
  assert.deepEqual(lo, [[1, 2, 3], [4, 5, 6], [7]]);
});

test("mảng rỗng ra danh sách rỗng, KHÔNG ra một lô rỗng", () => {
  // Ra `[[]]` thì vòng lặp gọi truy vấn với `IN ()` — Postgres trả 0 dòng nhưng vẫn tốn một lượt.
  assert.deepEqual(chiaLo([], 100), []);
});

test("mảng ngắn hơn lô thì gói trong một lô duy nhất", () => {
  assert.deepEqual(chiaLo([1, 2], 5000), [[1, 2]]);
});

test("chia vừa khít không sinh lô thừa ở cuối", () => {
  assert.deepEqual(chiaLo([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
});

test("giữ nguyên thứ tự và không mất phần tử nào", () => {
  const ds = Array.from({ length: 12_345 }, (_, i) => i);
  const lo = chiaLo(ds, 5_000);
  assert.equal(lo.length, 3);
  assert.deepEqual(lo.flat(), ds);
});

/* ===== Cắt mô tả phụ lục khi đọc bản cũ (thêm 2026-09-03) ===== */

test("catMoTa xử lý được mọi đầu vào mà bản phụ lục cũ có thể mang", () => {
  // Ngắn hơn trần -> giữ nguyên, không thêm dấu ...
  assert.equal(catMoTa("Cước vận chuyển"), "Cước vận chuyển");
  // Rỗng -> rỗng (bản cũ có thể chưa có mô tả).
  assert.equal(catMoTa(""), "");
  // Dài -> cắt và báo còn nữa.
  const dai = Array.from({ length: 30 }, (_, i) => `Mặt hàng số ${i}`).join(", ");
  const cat = catMoTa(dai);
  assert.ok(
    Array.from(cat).length <= DAI_TOI_DA_MO_TA,
    `dài ${Array.from(cat).length} code point, trần ${DAI_TOI_DA_MO_TA}`,
  );
  assert.ok(cat.endsWith(" ..."));
  assert.ok(dai.startsWith(cat.slice(0, -4)), "phải là tiền tố của chuỗi gốc");
});

test("catMoTa vẫn giữ dưới trần với ký tự ngoài mặt phẳng cơ bản và chữ có dấu tổ hợp (NFD)", () => {
  // Ký tự astral (surrogate pair trong UTF-16) rơi đúng ranh giới cắt — cắt theo code point để
  // không để lại một surrogate mồ côi, phá vỡ tính hợp lệ UTF-8 của file XML nộp thuế.
  const astral = "A".repeat(74) + "\u{20B9F}" + "B".repeat(50);
  const catAstral = catMoTa(astral);
  assert.ok(Array.from(catAstral).length <= DAI_TOI_DA_MO_TA);
  assert.equal(Buffer.from(catAstral, "utf8").toString("utf8"), catAstral);

  // Chuỗi không có khoảng trắng/dấu phẩy để cắt theo ranh giới — nhánh cũ từng cộng thêm đuôi mà
  // không trừ vào trần, ra 79 ký tự dù cap ghi 75.
  const khongKhoangTrang = catMoTa("Z".repeat(160));
  assert.ok(Array.from(khongKhoangTrang).length <= DAI_TOI_DA_MO_TA);
});

test("cắt hai lần cho kết quả y hệt cắt một lần", () => {
  // `docBan` cắt lúc đọc, `dungXmlGtgt01` cắt lại lúc xuất — hai lượt không được chồng thêm dấu.
  const dai = Array.from({ length: 30 }, (_, i) => `Mặt hàng số ${i}`).join(", ");
  assert.equal(catMoTa(catMoTa(dai)), catMoTa(dai));
});

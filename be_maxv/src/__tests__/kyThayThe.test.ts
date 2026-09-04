import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chonTheoKyGoc,
  coHoaDonGoc,
  ngayGocDuyNhat,
  ngayGocTuGhiChu,
} from "../services/client/to_khai/domain/kyThayThe";

/**
 * npx tsx --test src/__tests__/kyThayThe.test.ts
 *
 * Câu ghi chú trong các ca dưới đây lấy NGUYÊN VĂN từ hóa đơn thật của MST 0111142786.
 */

test("chỉ hóa đơn thay thế (2) và điều chỉnh (3) mới trỏ về hóa đơn gốc", () => {
  assert.equal(coHoaDonGoc("2"), true);
  assert.equal(coHoaDonGoc("3"), true);
  // 1 mới, 4 đã bị thay thế, 5 bị điều chỉnh, 6 đã bị hủy — không tờ nào trỏ về gốc.
  for (const tt of ["1", "4", "5", "6"]) assert.equal(coHoaDonGoc(tt), false, `tthai=${tt}`);
  assert.equal(coHoaDonGoc(null), false);
  assert.equal(coHoaDonGoc(undefined), false);
  assert.equal(coHoaDonGoc(" 2 "), true, "khoảng trắng thừa vẫn phải nhận");
});

test("bóc ngày gốc từ ghi chú hóa đơn THAY THẾ", () => {
  assert.equal(
    ngayGocTuGhiChu(
      "Hóa đơn thay thế cho hóa đơn điện tử mẫu 1 ký hiệu C25TLT số 1474 lập ngày 26/12/2025",
    ),
    "2025-12-26",
  );
});

test("bóc ngày gốc từ ghi chú hóa đơn ĐIỀU CHỈNH (câu có dấu phẩy, có số tiền)", () => {
  assert.equal(
    ngayGocTuGhiChu(
      "Hóa đơn điều chỉnh giảm 6.998.400 cho hóa đơn điện tử mẫu 1, ký hiệu C26TLT, số 451 lập ngày 31/01/2026",
    ),
    "2026-01-31",
  );
});

test("ngày một chữ số vẫn bóc được, trả về dạng có số 0 ở đầu", () => {
  assert.equal(ngayGocTuGhiChu("... số 12 lập ngày 5/3/2026"), "2026-03-05");
});

test("ghi chú không theo mẫu -> null, KHÔNG đoán bừa", () => {
  // Ghi chú bên MUA VÀO do nhà cung cấp tự viết; đo thật: 0/6 tờ bóc được.
  assert.equal(ngayGocTuGhiChu("Thay thế hóa đơn số 123"), null);
  assert.equal(ngayGocTuGhiChu(""), null);
  assert.equal(ngayGocTuGhiChu(null), null);
  assert.equal(ngayGocTuGhiChu(undefined), null);
});

test("ngày không có thật -> null, thà không biết còn hơn gán sai kỳ", () => {
  // `Date.UTC` cuộn 32/01 thành 01/02 — phải bắt được, không thì hóa đơn nhảy sang tháng khác.
  assert.equal(ngayGocTuGhiChu("... lập ngày 32/01/2026"), null);
  assert.equal(ngayGocTuGhiChu("... lập ngày 31/02/2026"), null);
  assert.equal(ngayGocTuGhiChu("... lập ngày 00/01/2026"), null);
});

test("ngày gốc tra DB: chỉ nhận khi một ngày duy nhất, không chọn tùy tiện ứng viên mơ hồ", () => {
  assert.equal(ngayGocDuyNhat(["2026-01-31"]), "2026-01-31");
  assert.equal(ngayGocDuyNhat(["2026-01-31", "2026-01-31"]), "2026-01-31");
  assert.equal(ngayGocDuyNhat(["2026-01-31", "2026-02-01"]), null);
  assert.equal(ngayGocDuyNhat([]), null);
});

test("ngày cuối tháng và năm nhuận vẫn hợp lệ", () => {
  assert.equal(ngayGocTuGhiChu("... lập ngày 31/12/2025"), "2025-12-31");
  assert.equal(ngayGocTuGhiChu("... lập ngày 29/02/2028"), "2028-02-29");
  assert.equal(ngayGocTuGhiChu("... lập ngày 29/02/2026"), null, "2026 không nhuận");
});



/* ===== Chọn hóa đơn theo kỳ của hóa đơn GỐC ===== */

const TU = "2026-01-01";
const DEN = "2026-03-31";

test("hóa đơn thay thế lập trong kỳ nhưng gốc kỳ TRƯỚC -> bị loại khỏi kỳ này", () => {
  // Ca thật: C26TLT 80 lập 07/01/2026 thay cho C25TLT 1474 ngày 26/12/2025 -> thuộc Q4/2025.
  const kq = chonTheoKyGoc(
    ["thuong-1", "tt-80"],
    [{ id: "tt-80", ngayGoc: "2025-12-26", lapTrongKy: true }],
    TU,
    DEN,
  );
  assert.deepEqual(kq.ids, ["thuong-1"]);
  assert.equal(kq.khongRoKyGoc, 0);
});

test("hóa đơn thay thế lập kỳ SAU nhưng gốc trong kỳ này -> được kéo vào", () => {
  // Ca thật: 8 tờ lập Q2/2026 có gốc Q1/2026.
  const kq = chonTheoKyGoc(
    ["thuong-1"],
    [{ id: "tt-1102", ngayGoc: "2026-03-31", lapTrongKy: false }],
    TU,
    DEN,
  );
  assert.deepEqual(kq.ids.sort(), ["thuong-1", "tt-1102"]);
});

test("gốc cùng kỳ thì giữ nguyên, không nhân đôi", () => {
  const kq = chonTheoKyGoc(
    ["a", "tt"],
    [{ id: "tt", ngayGoc: "2026-02-15", lapTrongKy: true }],
    TU,
    DEN,
  );
  assert.equal(kq.ids.length, 2);
  assert.ok(kq.ids.includes("tt"));
});

test("không suy được kỳ gốc: tờ TRONG kỳ bị chặn và đếm cảnh báo", () => {
  const kq = chonTheoKyGoc(
    ["a", "tt"],
    [{ id: "tt", ngayGoc: null, lapTrongKy: true }],
    TU,
    DEN,
  );
  assert.ok(!kq.ids.includes("tt"), "không được tự dùng ngày lập thay cho ngày gốc");
  assert.equal(kq.khongRoKyGoc, 1);
  assert.deepEqual(kq.idsKhongRoKyGoc, ["tt"], "phải dọn được cả lần gán sai trước đây");
});

test("không suy được kỳ gốc: tờ NGOÀI kỳ thì để yên, không cảnh báo nhầm", () => {
  const kq = chonTheoKyGoc(
    ["a"],
    [{ id: "tt", ngayGoc: null, lapTrongKy: false }],
    TU,
    DEN,
  );
  assert.deepEqual(kq.ids, ["a"]);
  assert.equal(kq.khongRoKyGoc, 0);
  assert.deepEqual(kq.idsKhongRoKyGoc, ["tt"]);
});

test("biên kỳ: gốc đúng ngày đầu và ngày cuối kỳ đều thuộc kỳ", () => {
  const kq = chonTheoKyGoc(
    [],
    [
      { id: "dau", ngayGoc: TU, lapTrongKy: false },
      { id: "cuoi", ngayGoc: DEN, lapTrongKy: false },
      { id: "truoc", ngayGoc: "2025-12-31", lapTrongKy: false },
      { id: "sau", ngayGoc: "2026-04-01", lapTrongKy: false },
    ],
    TU,
    DEN,
  );
  assert.deepEqual(kq.ids.sort(), ["cuoi", "dau"]);
});

test("nhiều tờ cùng lúc: vừa loại vừa kéo vào", () => {
  const kq = chonTheoKyGoc(
    ["thuong", "ra-khoi"],
    [
      { id: "ra-khoi", ngayGoc: "2025-12-26", lapTrongKy: true },
      { id: "vao-1", ngayGoc: "2026-03-31", lapTrongKy: false },
      { id: "vao-2", ngayGoc: "2026-02-11", lapTrongKy: false },
    ],
    TU,
    DEN,
  );
  assert.deepEqual(kq.ids.sort(), ["thuong", "vao-1", "vao-2"]);
});

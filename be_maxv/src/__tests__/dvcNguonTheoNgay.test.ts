import { test } from "node:test";
import assert from "node:assert/strict";
import { chiaDoanTheoNguon } from "../services/client/dich_vu_cong/nguonTheoNgay";

/**
 * Test CẮT KHOẢNG theo mốc 01/07/2025 — hồ sơ nộp trước mốc nằm ở cổng Thuế điện tử, từ mốc trở
 * đi nằm ở Dịch vụ công.
 *
 * Đáng khoá vì lệch một ngày là mất trọn một đoạn dữ liệu mà không có gì báo.
 *
 *   npx tsx --test src/__tests__/dvcNguonTheoNgay.test.ts
 */

test("trọn vẹn TRƯỚC mốc -> chỉ TDT", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-01-01", "2025-06-30"), [
    { nguon: "tdt", tuNgay: "2025-01-01", denNgay: "2025-06-30" },
  ]);
});

test("trọn vẹn TỪ mốc -> chỉ DVC", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-07-01", "2026-12-31"), [
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2026-12-31" },
  ]);
});

test("vắt qua mốc -> cắt đôi, TDT trước rồi DVC", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-01-01", "2026-12-31"), [
    { nguon: "tdt", tuNgay: "2025-01-01", denNgay: "2025-06-30" },
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2026-12-31" },
  ]);
});

test("đúng ngày mốc: 30/06 thuộc TDT, 01/07 thuộc DVC", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-06-30", "2025-06-30"), [
    { nguon: "tdt", tuNgay: "2025-06-30", denNgay: "2025-06-30" },
  ]);
  assert.deepEqual(chiaDoanTheoNguon("2025-07-01", "2025-07-01"), [
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2025-07-01" },
  ]);
});

test("khoảng ôm sát hai bên mốc -> hai đoạn một ngày", () => {
  assert.deepEqual(chiaDoanTheoNguon("2025-06-30", "2025-07-01"), [
    { nguon: "tdt", tuNgay: "2025-06-30", denNgay: "2025-06-30" },
    { nguon: "dvc", tuNgay: "2025-07-01", denNgay: "2025-07-01" },
  ]);
});

test("định dạng ngày sai -> NÉM, không so chuỗi bừa", () => {
  // So sánh chuỗi nên "01/07/2025" sắp dưới mốc và bị định tuyến sang ETAX, im lặng.
  assert.throws(() => chiaDoanTheoNguon("01/07/2025", "31/12/2026"), /yyyy-mm-dd/);
  assert.throws(() => chiaDoanTheoNguon("", ""), /yyyy-mm-dd/);
});

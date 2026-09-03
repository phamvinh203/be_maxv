import { test } from "node:test";
import assert from "node:assert/strict";
import { toDate, vnDayEnd, vnDayStart, vnDayString, toVnWallClock } from "../utils/ngayVn";

/**
 * npx tsx --test src/__tests__/ngayVn.test.ts
 *
 * Bộ test này canh đúng MỘT lỗi: đọc ngày lập hóa đơn theo mốc UTC thay vì giờ Việt Nam.
 *
 * Cổng thuế trả ngày lập lúc 00:00 GIỜ VN, tức 17:00 UTC HÔM TRƯỚC — đo trên MST 0111142786:
 * 2123/2123 hóa đơn bán ra đều mang giờ 17:00:00 UTC. Module Tờ khai từng tự dựng khoảng kỳ bằng
 * `new Date("2026-01-01T00:00:00.000Z")` nên quét nhầm sang 02/01–01/04, khiến [32] của Q1/2026
 * thừa 102.173.752 đồng và [23] của Q2 thừa 1.356.031.600 so với tờ khai đã nộp.
 */

/** Ngày lập 01/01/2026 như cổng thuế lưu: 00:00 giờ VN = 17:00 UTC ngày 31/12/2025. */
const HD_MUNG_MOT = new Date("2025-12-31T17:00:00.000Z");
/** Ngày lập 31/03/2026 — tờ cuối Q1. */
const HD_CUOI_QUY = new Date("2026-03-30T17:00:00.000Z");
/** Ngày lập 01/04/2026 — tờ ĐẦU Q2, tuyệt đối không được rơi vào Q1. */
const HD_DAU_Q2 = new Date("2026-03-31T17:00:00.000Z");

test("vnDayString: hóa đơn 00:00 giờ VN ra đúng ngày lịch, không lùi một ngày", () => {
  assert.equal(vnDayString(HD_MUNG_MOT), "2026-01-01");
  assert.equal(vnDayString(HD_CUOI_QUY), "2026-03-31");
  assert.equal(vnDayString(HD_DAU_Q2), "2026-04-01");
  // Đây chính là cách làm SAI trước đây — giữ lại để thấy rõ nó lệch đúng một ngày.
  assert.equal(HD_MUNG_MOT.toISOString().slice(0, 10), "2025-12-31");
});

test("vnDayString: đọc không ra ngày -> undefined, không bịa", () => {
  assert.equal(vnDayString(undefined), undefined);
  assert.equal(vnDayString(null), undefined);
  assert.equal(vnDayString(""), undefined);
  assert.equal(vnDayString("không-phải-ngày"), undefined);
});

test("biên kỳ Q1/2026: tờ đầu và tờ cuối kỳ nằm TRONG khoảng, tờ 01/04 nằm NGOÀI", () => {
  const gte = vnDayStart("2026-01-01").getTime();
  const lte = vnDayEnd("2026-03-31").getTime();
  const trongKy = (d: Date) => d.getTime() >= gte && d.getTime() <= lte;

  assert.equal(trongKy(HD_MUNG_MOT), true, "hóa đơn lập 01/01/2026 phải thuộc Q1");
  assert.equal(trongKy(HD_CUOI_QUY), true, "hóa đơn lập 31/03/2026 phải thuộc Q1");
  assert.equal(trongKy(HD_DAU_Q2), false, "hóa đơn lập 01/04/2026 KHÔNG được vào Q1");

  // Cách cũ (mốc UTC) sai cả hai đầu: nuốt mất tờ 01/01 và ăn thêm tờ 01/04 của quý sau.
  const gteUtc = new Date("2026-01-01T00:00:00.000Z").getTime();
  const lteUtc = new Date("2026-03-31T23:59:59.999Z").getTime();
  const trongKyUtc = (d: Date) => d.getTime() >= gteUtc && d.getTime() <= lteUtc;
  assert.equal(trongKyUtc(HD_MUNG_MOT), false);
  assert.equal(trongKyUtc(HD_DAU_Q2), true);
});

test("vnDayStart/vnDayEnd: mốc đúng 00:00 và 23:59:59.999 giờ VN", () => {
  assert.equal(vnDayStart("2026-01-01").toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(vnDayEnd("2026-03-31").toISOString(), "2026-03-31T16:59:59.999Z");
});

test("vnDayEnd không cắt mất hóa đơn lập buổi chiều ngày cuối kỳ", () => {
  // 17:30 giờ VN ngày 31/03 = 10:30 UTC cùng ngày.
  const chieuMuon = new Date("2026-03-31T10:30:00.000Z");
  assert.equal(vnDayString(chieuMuon), "2026-03-31");
  assert.ok(chieuMuon.getTime() <= vnDayEnd("2026-03-31").getTime());
});

test("toDate: chuỗi không hậu tố hiểu là giờ VN; chuỗi có hậu tố giữ nguyên instant", () => {
  assert.equal(toDate("2026-01-01")?.toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(toDate("2026-01-01T00:00:00")?.toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(toDate("2025-12-31T17:00:00Z")?.toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(toDate("không-phải-ngày"), undefined);
});

test("vnDayString và toVnWallClock nói cùng một ngày", () => {
  for (const d of [HD_MUNG_MOT, HD_CUOI_QUY, HD_DAU_Q2]) {
    assert.equal(vnDayString(d), toVnWallClock(d)?.slice(0, 10));
  }
});

test("năm nhuận và giao năm vẫn đúng", () => {
  // 29/02/2028 lập lúc 00:00 giờ VN.
  assert.equal(vnDayString(new Date("2028-02-28T17:00:00.000Z")), "2028-02-29");
  // 31/12/2025 -> vẫn là 2025, không nhảy sang 2026.
  assert.equal(vnDayString(new Date("2025-12-30T17:00:00.000Z")), "2025-12-31");
});

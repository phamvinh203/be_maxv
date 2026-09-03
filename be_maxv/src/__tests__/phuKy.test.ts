import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canhBaoPhuKy,
  phuChieuTuLog,
  type DongBoRef,
} from "../services/client/to_khai/phuKy";

/**
 * npx tsx --test src/__tests__/phuKy.test.ts
 *
 * Ca đầu tiên tái hiện đúng sự cố thật: công ty 0106861880 đồng bộ Q2/2026 từ 30/04 thay vì 01/04,
 * tờ khai hụt một hóa đơn bán ra mà màn hình không báo gì.
 */

const Q2 = { tuNgay: "2026-04-01", denNgay: "2026-06-30" };

/** `sync_log` ghi `den_ngay` ở mốc 12:00 của ngày — dựng test giống hệt để không lọt lỗi so giờ. */
function log(direction: string, tu: string, den: string): DongBoRef {
  return {
    direction,
    tu_ngay: new Date(`${tu}T12:00:00.000Z`),
    den_ngay: new Date(`${den}T12:00:00.000Z`),
  };
}

test("sự cố thật: đồng bộ từ 30/04 cho kỳ bắt đầu 01/04 -> chưa phủ", () => {
  const logs = [log("sold", "2026-04-30", "2026-06-30")];
  const phu = phuChieuTuLog(logs, "sold", Q2);
  assert.equal(phu.daPhu, false);
  assert.equal(phu.tuNgayDaCo, "2026-04-30");
  assert.equal(phu.denNgayDaCo, "2026-06-30");
});

test("câu cảnh báo nói rõ thiếu đoạn nào", () => {
  const logs = [log("all", "2026-04-30", "2026-06-30")];
  const p = phuChieuTuLog(logs, "purchase", Q2);
  const s = phuChieuTuLog(logs, "sold", Q2);
  const cb = canhBaoPhuKy(p, s, Q2);
  assert.ok(cb);
  assert.match(cb, /01\/04\/2026/);
  assert.match(cb, /30\/04\/2026/);
  assert.match(cb, /thiếu/i);
});

test("một lượt phủ trọn kỳ -> đã phủ, không cảnh báo", () => {
  const logs = [log("purchase", "2026-04-01", "2026-06-30"), log("sold", "2026-03-01", "2026-07-31")];
  const p = phuChieuTuLog(logs, "purchase", Q2);
  const s = phuChieuTuLog(logs, "sold", Q2);
  assert.equal(p.daPhu, true);
  assert.equal(s.daPhu, true);
  assert.equal(canhBaoPhuKy(p, s, Q2), null);
});

test("direction=all phủ cả hai chiều", () => {
  const logs = [log("all", "2026-04-01", "2026-06-30")];
  assert.equal(phuChieuTuLog(logs, "purchase", Q2).daPhu, true);
  assert.equal(phuChieuTuLog(logs, "sold", Q2).daPhu, true);
});

test("chỉ đồng bộ một chiều -> chiều kia vẫn thiếu", () => {
  const logs = [log("purchase", "2026-04-01", "2026-06-30")];
  const p = phuChieuTuLog(logs, "purchase", Q2);
  const s = phuChieuTuLog(logs, "sold", Q2);
  assert.equal(p.daPhu, true);
  assert.equal(s.daPhu, false);
  assert.match(canhBaoPhuKy(p, s, Q2) ?? "", /bán ra/i);
});

test("hai lượt rời nhau KHÔNG ghép lại thành đã phủ", () => {
  // Tháng 4 và tháng 6 có, tháng 5 thủng — ghép khoảng là kết luận sai "đã đủ".
  const logs = [log("all", "2026-04-01", "2026-04-30"), log("all", "2026-06-01", "2026-06-30")];
  const p = phuChieuTuLog(logs, "purchase", Q2);
  assert.equal(p.daPhu, false);
  assert.match(canhBaoPhuKy(p, p, Q2) ?? "", /nhiều đợt rời nhau/i);
});

test("chưa đồng bộ ngày nào trong kỳ", () => {
  const logs = [log("all", "2026-01-01", "2026-03-31")];
  const p = phuChieuTuLog(logs, "purchase", Q2);
  assert.equal(p.daPhu, false);
  assert.equal(p.tuNgayDaCo, null);
  assert.match(canhBaoPhuKy(p, p, Q2) ?? "", /chưa đồng bộ ngày nào/i);
});

test("thiếu đuôi kỳ cũng bị bắt", () => {
  const logs = [log("all", "2026-04-01", "2026-06-15")];
  const p = phuChieuTuLog(logs, "purchase", Q2);
  assert.equal(p.daPhu, false);
  assert.match(canhBaoPhuKy(p, p, Q2) ?? "", /15\/06\/2026–30\/06\/2026/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { duocTinh, gomBanRa, gomMuaVao } from "../services/client/to_khai/gomHoaDonGtgt";
import type { HoaDonGom } from "../services/client/to_khai/gomHoaDonGtgt";

/**
 * npx tsx --test src/__tests__/gomHoaDonGtgt.test.ts
 *
 * Đây là chỗ ra con số đem đi nộp thuế: gộp sai một mức thuế suất hay quên loại một hóa đơn đã bị
 * thay thế là sai tờ khai mà nhìn bảng không phát hiện được.
 */

/** Dựng một hóa đơn với các nhóm thuế suất cho sẵn; tổng tiền suy từ chính các nhóm đó. */
function hd(
  id: string,
  tthai: string,
  nhom: { tsuat: string; thtien: number; tthue: number }[],
  them: Partial<HoaDonGom> = {},
): HoaDonGom {
  return {
    id,
    tthai,
    dvtte: "VND",
    tgia: 1,
    tgtcthue: nhom.reduce((s, n) => s + n.thtien, 0),
    tgtthue: nhom.reduce((s, n) => s + n.tthue, 0),
    detail: { thttltsuat: nhom },
    ...them,
  };
}

test("loại hóa đơn đã bị thay thế (4) và đã bị hủy (6)", () => {
  assert.equal(duocTinh("1"), true);
  assert.equal(duocTinh("2"), true);
  assert.equal(duocTinh("3"), true);
  assert.equal(duocTinh("4"), false);
  assert.equal(duocTinh("5"), true);
  assert.equal(duocTinh("6"), false);
});

test("gộp bán ra theo từng mức thuế suất", () => {
  const kq = gomBanRa([
    hd("a", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("b", "1", [{ tsuat: "5%", thtien: 2_000_000, tthue: 100_000 }]),
    hd("c", "1", [{ tsuat: "0%", thtien: 3_000_000, tthue: 0 }]),
    hd("d", "1", [{ tsuat: "KCT", thtien: 4_000_000, tthue: 0 }]),
    hd("e", "1", [{ tsuat: "KKKNT", thtien: 5_000_000, tthue: 0 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.tong.ct33, 100_000);
  assert.equal(kq.tong.ct30, 2_000_000);
  assert.equal(kq.tong.ct31, 100_000);
  assert.equal(kq.tong.ct29, 3_000_000);
  assert.equal(kq.tong.ct26, 4_000_000);
  assert.equal(kq.tong.ct32a, 5_000_000);
  assert.equal(kq.soHd, 5);
});

test("hàng 8% vào [32]/[33] với số thuế THỰC TẾ, không phải 10%", () => {
  const kq = gomBanRa([hd("a", "1", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }])]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.tong.ct33, 80_000);
  assert.notEqual(kq.tong.ct33, 100_000);
});

test("nhãn thuế suất nhận cả dạng không có dấu %", () => {
  const kq = gomBanRa([hd("a", "1", [{ tsuat: "10", thtien: 1_000_000, tthue: 100_000 }])]);
  assert.equal(kq.tong.ct32, 1_000_000);
});

test("một hóa đơn nhiều mức thuế suất tách đúng từng ô", () => {
  const kq = gomBanRa([
    hd("a", "1", [
      { tsuat: "10%", thtien: 1_000_000, tthue: 100_000 },
      { tsuat: "5%", thtien: 2_000_000, tthue: 100_000 },
    ]),
  ]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.tong.ct30, 2_000_000);
  assert.equal(kq.soHd, 1);
});

test("hóa đơn bị loại không được cộng vào tổng", () => {
  const kq = gomBanRa([
    hd("giu", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("bothaythe", "4", [{ tsuat: "10%", thtien: 9_000_000, tthue: 900_000 }]),
    hd("dahuy", "6", [{ tsuat: "10%", thtien: 8_000_000, tthue: 800_000 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.soHd, 1);
});

test("hóa đơn điều chỉnh vẫn cộng vào tổng nhưng gom riêng để hiển thị", () => {
  const kq = gomBanRa([
    hd("goc", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("dc", "3", [{ tsuat: "10%", thtien: 200_000, tthue: 20_000 }]),
  ]);
  assert.equal(kq.tong.ct32, 1_200_000);
  assert.equal(kq.dieuChinh.soHd, 1);
  assert.equal(kq.dieuChinh.giaTri, 200_000);
  assert.equal(kq.dieuChinh.thue, 20_000);
});

test("nhãn thuế suất lạ không cộng vào đâu, xếp vào nhóm treo", () => {
  const kq = gomBanRa([hd("la", "1", [{ tsuat: "???", thtien: 500_000, tthue: 0 }])]);
  assert.equal(kq.tong.ct32, 0);
  assert.equal(kq.tong.ct26, 0);
  assert.equal(kq.treo.length, 1);
  assert.equal(kq.treo[0].id, "la");
});

test("hóa đơn chưa tải chi tiết xếp vào nhóm treo", () => {
  const kq = gomBanRa([{ ...hd("x", "1", []), detail: null }]);
  assert.equal(kq.treo.length, 1);
  assert.match(kq.treo[0].lyDo, /chi tiết/i);
  assert.equal(kq.soHd, 0);
});

test("hóa đơn ngoại tệ quy đổi theo tỷ giá", () => {
  const kq = gomBanRa([
    hd("usd", "1", [{ tsuat: "10%", thtien: 100, tthue: 10 }], { dvtte: "USD", tgia: 25_000 }),
  ]);
  assert.equal(kq.tong.ct32, 2_500_000);
  assert.equal(kq.tong.ct33, 250_000);
});

test("ngoại tệ thiếu tỷ giá thì treo, không quy đổi bừa", () => {
  const kq = gomBanRa([
    hd("usd", "1", [{ tsuat: "10%", thtien: 100, tthue: 10 }], { dvtte: "USD", tgia: null }),
  ]);
  assert.equal(kq.tong.ct32, 0);
  assert.equal(kq.treo.length, 1);
});

test("mua vào cộng tổng chưa thuế và tiền thuế, vẫn loại hóa đơn hủy", () => {
  const kq = gomMuaVao([
    hd("a", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]),
    hd("b", "6", [{ tsuat: "10%", thtien: 7_000_000, tthue: 700_000 }]),
  ]);
  assert.equal(kq.ct23, 1_000_000);
  assert.equal(kq.ct24, 100_000);
  assert.equal(kq.soHd, 1);
});

test("mua vào KHÔNG cần chi tiết — chưa tải vẫn cộng được", () => {
  const kq = gomMuaVao([
    { ...hd("x", "1", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }]), detail: null },
  ]);
  assert.equal(kq.ct23, 1_000_000);
  assert.equal(kq.ct24, 100_000);
  assert.equal(kq.treo.length, 0);
});

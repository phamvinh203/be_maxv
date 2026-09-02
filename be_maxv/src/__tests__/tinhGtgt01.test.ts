import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhGtgt01 } from "../services/client/to_khai/tinhGtgt01";
import type { TongBanRa } from "../services/client/to_khai/gomHoaDonGtgt";

/**
 * npx tsx --test src/__tests__/tinhGtgt01.test.ts
 *
 * Công thức mẫu 01/GTGT (TT80/2021). Mọi con số đem đi nộp thuế đều đi qua đây, nên mỗi công thức
 * in trên mẫu có một ca test canh.
 */

const RONG: TongBanRa = { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };

test("[27] và [28] cộng đúng các dòng con", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct29: 1_000, ct30: 2_000, ct31: 100, ct32: 3_000, ct33: 300, ct32a: 4_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  // [27] = [29] + [30] + [32] + [32a]; [28] = [31] + [33]
  assert.equal(ct.ct27, 10_000);
  assert.equal(ct.ct28, 400);
});

test("[34] = [26] + [27] và [35] = [28]", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct26: 5_000, ct32: 3_000, ct33: 300 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct34, 8_000);
  assert.equal(ct.ct35, 300);
});

test("[25] mặc định bằng [24], nhập tay thì thắng", () => {
  const macDinh = tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 1_000 }, nhapTay: {} });
  assert.equal(macDinh.ct25, 1_000);

  const suaTay = tinhGtgt01({
    banRa: RONG,
    muaVao: { ct23: 0, ct24: 1_000 },
    nhapTay: { ct25: 600 },
  });
  assert.equal(suaTay.ct25, 600);
  assert.equal(suaTay.ct36, -600);
});

test("[25] nhập tay bằng 0 vẫn là 0, không rơi về mặc định", () => {
  // Bẫy `??` vs `||`: kế toán khai không được khấu trừ đồng nào là giá trị hợp lệ.
  const ct = tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 5_000 }, nhapTay: { ct25: 0 } });
  assert.equal(ct.ct25, 0);
});

test("phát sinh dương: [40a] mang số, [41] bằng 0", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 2_000_000, ct24: 200_000 },
    nhapTay: { ct22: 100_000 },
  });
  assert.equal(ct.ct36, 800_000);
  assert.equal(ct.ct40a, 700_000);
  assert.equal(ct.ct41, 0);
  assert.equal(ct.ct40, 700_000);
  assert.equal(ct.ct43, 0);
});

test("không phát sinh đầu ra: [41] = [22] + [25]", () => {
  // Dạng đã đối chiếu trên 5 hồ sơ 01/GTGT thật của MST 0106200129 (xem comment `toKhaiXml.ts`):
  // ct41 = ct22 + ct25 = 25.418.834 + 4.407.359 = 29.826.193.
  const ct = tinhGtgt01({
    banRa: RONG,
    muaVao: { ct23: 40_000_000, ct24: 4_407_359 },
    nhapTay: { ct22: 25_418_834 },
  });
  assert.equal(ct.ct41, 29_826_193);
  assert.equal(ct.ct40a, 0);
  assert.equal(ct.ct40, 0);
  assert.equal(ct.ct43, 29_826_193);
});

test("[40a] và [41] loại trừ nhau — không bao giờ cùng khác 0", () => {
  for (const ct24 of [0, 500, 1_000, 5_000]) {
    const ct = tinhGtgt01({
      banRa: { ...RONG, ct32: 10_000, ct33: 1_000 },
      muaVao: { ct23: 0, ct24 },
      nhapTay: {},
    });
    assert.ok(ct.ct40a === 0 || ct.ct41 === 0, `ct24=${ct24}`);
  }
});

test("điều chỉnh tăng giảm và bàn giao vào đúng công thức", () => {
  const ct = tinhGtgt01({
    banRa: { ...RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct22: 0, ct37: 50_000, ct38: 30_000, ct39a: 20_000 },
  });
  // X = [36] - [22] + [37] - [38] - [39a] = 1.000.000 - 0 + 50.000 - 30.000 - 20.000
  assert.equal(ct.ct40a, 1_000_000);
});

test("[43] = [41] - [42] và [40] = [40a] - [40b]", () => {
  const conKhauTru = tinhGtgt01({
    banRa: RONG,
    muaVao: { ct23: 0, ct24: 1_000_000 },
    nhapTay: { ct42: 400_000 },
  });
  assert.equal(conKhauTru.ct41, 1_000_000);
  assert.equal(conKhauTru.ct43, 600_000);

  const phaiNop = tinhGtgt01({
    banRa: { ...RONG, ct32: 10_000_000, ct33: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct40b: 300_000 },
  });
  assert.equal(phaiNop.ct40a, 1_000_000);
  assert.equal(phaiNop.ct40, 700_000);
});

test("ô nhập tay không tính được vẫn có mặt trong kết quả", () => {
  const ct = tinhGtgt01({
    banRa: RONG,
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct23a: 111, ct24a: 222 },
  });
  assert.equal(ct.ct23a, 111);
  assert.equal(ct.ct24a, 222);
});

test("kết quả luôn đủ mọi chỉ tiêu, kể cả khi không nhập gì", () => {
  const ct = tinhGtgt01({ banRa: RONG, muaVao: { ct23: 0, ct24: 0 }, nhapTay: {} });
  for (const khoa of ["ct22", "ct23a", "ct24a", "ct37", "ct38", "ct39a", "ct40b", "ct42"]) {
    assert.equal(ct[khoa], 0, `thiếu ${khoa}`);
  }
});

/* ===== Công thức [31]/[33] theo HTKK + ghi đè lan truyền (thêm 2026-09-02) ===== */

/** Bộ số bán ra rỗng, chỉ đặt các ô cần cho từng ca. */
function banRaRong() {
  return { ct26: 0, ct29: 0, ct30: 0, ct31: 0, ct32: 0, ct32a: 0, ct33: 0 };
}

test("[33] lấy công thức HTKK, khớp tờ khai Q2/2026 đã nộp", () => {
  // Bản thật MST 0106861880: [32]=391.249.917, phụ lục giảm 7.824.998, [33]=31.299.994.
  // Cộng thuế từng hóa đơn chỉ ra 31.299.993 — chênh một đồng chính là chỗ này.
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 391_249_917, ct33: 31_299_993 },
    muaVao: { ct23: 323_050_463, ct24: 5_102_437 },
    nhapTay: { ct22: 3_366_060 },
    giamThue: { ts10: 7_824_998 },
  });
  assert.equal(ct.ct33, 31_299_994);
  assert.equal(ct.ct28, 31_299_994);
  assert.equal(ct.ct35, 31_299_994);
  assert.equal(ct.ct36, 26_197_557);
  assert.equal(ct.ct40a, 22_831_497);
  assert.equal(ct.ct40, 22_831_497);
});

test("không có hàng được giảm thì [33] = [32] x 10%", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 1_000_005 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct33, 100_001); // làm tròn 100.000,5
});

test("[31] cũng theo công thức, trừ phần giảm của nhóm 5%", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct30: 2_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
    giamThue: { ts5: 10_000 },
  });
  assert.equal(ct.ct31, 90_000); // 100.000 - 10.000
});

test("ghi đè [26] CHẢY TIẾP vào [34] — không còn để tờ khai tự mâu thuẫn", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct26: 1_000, ct32: 5_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct26: 7_000 },
  });
  assert.equal(ct.ct26, 7_000);
  assert.equal(ct.ct34, ct.ct26 + ct.ct27);
  assert.equal(ct.ct34, 5_007_000);
});

test("ghi đè [33] thắng công thức, và [28] dùng số đã ghi đè", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 1_000_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct33: 99_999 },
  });
  assert.equal(ct.ct33, 99_999);
  assert.equal(ct.ct28, 99_999);
});

test("ghi đè [24] chảy vào [25] mặc định rồi vào [36]", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 1_000_000 },
    muaVao: { ct23: 500_000, ct24: 50_000 },
    nhapTay: { ct24: 30_000 },
  });
  assert.equal(ct.ct24, 30_000);
  assert.equal(ct.ct25, 30_000);
  assert.equal(ct.ct36, 100_000 - 30_000);
});

test("làm tròn đối xứng quanh 0 khi [32] âm — kỳ trả hàng nhiều hơn bán", () => {
  // -15 x 10% = -1,5. Math.round cho -1 (về phía +∞); quy ước tiền là -2.
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: -15 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct33, -2);
});

test("[30] âm cũng làm tròn đối xứng", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct30: -10 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct31, -1); // -10 x 5% = -0,5 -> -1
});

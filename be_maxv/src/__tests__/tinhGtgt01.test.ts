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

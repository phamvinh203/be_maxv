import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhGtgt01 } from "../services/client/to_khai/domain/tinhGtgt01";
import type { TongBanRa } from "../services/client/to_khai/domain/gomHoaDonGtgt";

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

test("[33] là TỔNG THUẾ TỪNG HÓA ĐƠN, khớp hai tờ khai đã nộp của MST 0111142786", () => {
  // Q1/2026: 8% 4.631.817.848 (thuế 370.545.427) + 10% 381.006.612 (thuế 38.100.664).
  // Cộng thuế từng hóa đơn = 408.646.091 — đúng số trên tờ khai đã nộp.
  // Công thức kiểm của HTKK ra 501.282.446 - 92.636.357 = 408.646.089, lệch 2 đồng.
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 5_012_824_460, ct33: 408_646_091 },
    muaVao: { ct23: 7_226_030_011, ct24: 598_816_081 },
    nhapTay: { ct22: 366_696_473 },
  });
  assert.equal(ct.ct33, 408_646_091);
  assert.equal(ct.ct28, 408_646_091);
  assert.equal(ct.ct35, 408_646_091);
  assert.equal(ct.ct36, -190_169_990);
  assert.equal(ct.ct41, 556_866_463);
  assert.equal(ct.ct43, 556_866_463);
});

test("[33] KHÔNG bị làm tròn lại theo [32] — số lẻ của bảng kê giữ nguyên", () => {
  // [32] x 10% = 100.000,5; nếu còn dùng công thức thì [33] ra 100.001.
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 1_000_005, ct33: 100_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct33, 100_000);
});

test("[31] cũng lấy thuế thực của nhóm 5% trên bảng kê", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct30: 2_000_000, ct31: 90_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct31, 90_000);
});

test("ghi đè [33] vẫn thắng số cộng từ bảng kê", () => {
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct32: 1_000_000, ct33: 100_000 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: { ct33: 99_000 },
  });
  assert.equal(ct.ct33, 99_000);
  assert.equal(ct.ct28, 99_000, "ghi đè phải CHẢY TIẾP xuống [28]");
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
    banRa: { ...banRaRong(), ct32: 1_000_000, ct33: 100_000 },
    muaVao: { ct23: 500_000, ct24: 50_000 },
    nhapTay: { ct24: 30_000 },
  });
  assert.equal(ct.ct24, 30_000);
  assert.equal(ct.ct25, 30_000);
  assert.equal(ct.ct36, 100_000 - 30_000);
});

test("kỳ ÂM (trả hàng nhiều hơn bán) đi thẳng từ bảng kê, không làm tròn lại", () => {
  // Làm tròn về đồng đã làm ở `gomHoaDonGtgt` theo TỪNG hóa đơn; ở đây chỉ cộng, không tròn lại
  // lần nữa — tròn hai lần là lệch thêm một đồng mà không ai truy ra được.
  const ct = tinhGtgt01({
    banRa: { ...banRaRong(), ct30: -10, ct31: -1, ct32: -15, ct33: -2 },
    muaVao: { ct23: 0, ct24: 0 },
    nhapTay: {},
  });
  assert.equal(ct.ct31, -1);
  assert.equal(ct.ct33, -2);
  assert.equal(ct.ct28, -3);
  assert.equal(ct.ct41, 3, "[36] âm -> còn được khấu trừ");
});

/* ===== [22] nhập tay: có chảy tiếp xuống các ô dưới không ===== */

test("nhập tay [22] kéo theo [40a] [41] [40] [43] — không phải sửa mỗi một ô", () => {
  // Ca thật Q1/2026 (MST 0111142786): [36] = -190.274.632.
  const nen = { banRa: { ...RONG, ct32: 5_011_516_460, ct33: 408_541_449 }, muaVao: { ct23: 7_226_030_011, ct24: 598_816_081 } };

  const chuaNhap = tinhGtgt01({ ...nen, nhapTay: { ct33: 408_541_449 } });
  assert.equal(chuaNhap.ct22, 0);
  assert.equal(chuaNhap.ct36, -190_274_632);
  assert.equal(chuaNhap.ct41, 190_274_632);
  assert.equal(chuaNhap.ct43, 190_274_632);

  // Kế toán gõ [22] theo tờ khai đã nộp của kỳ trước.
  const daNhap = tinhGtgt01({ ...nen, nhapTay: { ct33: 408_541_449, ct22: 366_696_473 } });
  assert.equal(daNhap.ct22, 366_696_473);
  assert.equal(daNhap.ct36, -190_274_632, "[36] không phụ thuộc [22], phải giữ nguyên");
  assert.equal(daNhap.ct41, 556_971_105, "[41] = -( [36] - [22] )");
  assert.equal(daNhap.ct43, 556_971_105, "[43] = [41] - [42]");
  assert.equal(daNhap.ct40a, 0);
  assert.equal(daNhap.ct40, 0);
});

test("[22] lớn hơn số phải nộp -> lật từ [40a] sang [41], không ra số âm", () => {
  const nen = { banRa: { ...RONG, ct32: 1_000_000_000, ct33: 100_000_000 }, muaVao: { ct23: 0, ct24: 20_000_000 } };
  // [36] = 100.000.000 - 20.000.000 = 80.000.000 -> phải nộp khi [22] = 0.
  const nop = tinhGtgt01({ ...nen, nhapTay: {} });
  assert.equal(nop.ct40a, 80_000_000);
  assert.equal(nop.ct41, 0);

  // [22] = 200.000.000 -> hết phải nộp, chuyển sang còn được khấu trừ 120.000.000.
  const khauTru = tinhGtgt01({ ...nen, nhapTay: { ct22: 200_000_000 } });
  assert.equal(khauTru.ct40a, 0);
  assert.equal(khauTru.ct40, 0);
  assert.equal(khauTru.ct41, 120_000_000);
  assert.equal(khauTru.ct43, 120_000_000);
});

test("nhập tay [22] = 0 là ý định thật, không bị coi như bỏ trống", () => {
  const nen = { banRa: { ...RONG }, muaVao: { ct23: 0, ct24: 10_000_000 } };
  assert.equal(tinhGtgt01({ ...nen, nhapTay: { ct22: 0 } }).ct41, 10_000_000);
  assert.equal(tinhGtgt01({ ...nen, nhapTay: { ct22: 4_000_000 } }).ct41, 14_000_000);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { nguongLamTron, soatToKhai } from "../services/client/to_khai/soatToKhai";
import type { CtGtgt01 } from "../services/client/to_khai/tinhGtgt01";
import type { Ky } from "../services/client/to_khai/kySoThue";

/** npx tsx --test src/__tests__/soatToKhai.test.ts */

const Q2: Ky = { nam: 2026, kyLoai: "quy", kySo: 2 };

function ct(p: Record<string, number> = {}): CtGtgt01 {
  return { ct31: 0, ct32: 0, ct33: 0, ...p };
}
/** Bản soát mặc định "mọi thứ đều ổn"; mỗi ca chỉ đổi phần mình quan tâm. */
function soat(p: Partial<Parameters<typeof soatToKhai>[0]> = {}) {
  return soatToKhai({
    ct: ct(),
    ctMay: ct(),
    soHdBan: 0,
    biLoai: { soHd: 0, giaTri: 0 },
    thayTheHut: [],
    giamThue10: 0,
    kyNay: Q2,
    thieuDuLieuKyNay: null,
    kyNguonCt22: null,
    thieuDuLieuKyNguonCt22: null,
    ...p,
  });
}

test("kỳ bình thường: không cảnh báo gì", () => {
  assert.deepEqual(soat(), []);
});

test("ca thật Q2/2026 không sinh cảnh báo giả", () => {
  // [33] công thức 31.299.994 vs bảng kê 31.299.993 — lệch 1 đồng, 3 hóa đơn.
  const kq = soat({
    ct: ct({ ct32: 391_249_917, ct33: 31_299_994 }),
    ctMay: ct({ ct32: 391_249_917, ct33: 31_299_994 }),
    soHdBan: 3,
    giamThue10: 7_824_998,
    kyNguonCt22: { nam: 2026, kyLoai: "quy", kySo: 1 },
  });
  assert.deepEqual(kq, []);
});

test("bảng kê lệch xa công thức kiểm HTKK -> cảnh báo, kèm số lệch", () => {
  // [32] = 10.000.000 nên HTKK kiểm [33] phải quanh 1.000.000; bảng kê chỉ cộng ra 800.000
  // -> có hóa đơn ghi sai mức thuế suất.
  const kq = soat({
    ctMay: ct({ ct32: 10_000_000, ct33: 800_000 }),
    ct: ct({ ct32: 10_000_000, ct33: 800_000 }),
    soHdBan: 3,
  });
  assert.equal(kq.length, 1);
  assert.match(kq[0], /\[33\]/);
  assert.match(kq[0], /200\.000/);
  assert.match(kq[0], /HTKK/);
});

test("ngưỡng nới theo số hóa đơn — kỳ nhiều tờ lệch vài chục đồng vẫn im", () => {
  // [32] = 10.000.000 -> công thức HTKK ra 1.000.000; bảng kê cộng ra 1.000.100.
  // 100 hóa đơn, lệch 100 đồng: mỗi tờ 1 đồng làm tròn, chấp nhận được.
  const o = { ct32: 10_000_000, ct33: 1_000_100 };
  assert.deepEqual(soat({ ctMay: ct(o), ct: ct(o), soHdBan: 100 }), []);

  // Cùng số lệch nhưng chỉ 2 hóa đơn -> bất thường.
  assert.equal(soat({ ctMay: ct(o), ct: ct(o), soHdBan: 2 }).length, 1);
});

test("ghi đè [33] KHÔNG bị báo là lệch bảng kê — sửa tay là cố ý", () => {
  const kq = soat({
    ct: ct({ ct32: 10_000_000, ct33: 500_000 }), // kế toán chốt tay
    ctMay: ct({ ct32: 10_000_000, ct33: 1_000_000 }),
    soHdBan: 3,
  });
  assert.deepEqual(kq, []);
});

test("[32] sửa tay về 0 mà phụ lục giữ nguyên -> báo cả hai lỗi", () => {
  const kq = soat({
    ct: ct({ ct32: 0, ct33: -7_824_998 }),
    ctMay: ct({ ct32: 391_249_917, ct33: 31_299_994 }),
    soHdBan: 3,
    giamThue10: 7_824_998,
  });
  assert.equal(kq.length, 2);
  assert.match(kq[0], /lớn hơn \[32\] × 10%/);
  assert.match(kq[1], /\[33\] đang âm/);
});

test("[31] cũng được soát, không chỉ [33]", () => {
  const kq = soat({
    ctMay: ct({ ct30: 2_000_000, ct31: 500_000 }),
    ct: ct({ ct30: 2_000_000, ct31: 500_000 }),
    soHdBan: 1,
  });
  assert.equal(kq.length, 1);
  assert.match(kq[0], /\[31\]/);
});

test("đổi kỳ khai quý -> tháng thì nhắc đối chiếu [22]", () => {
  const kq = soat({
    kyNay: { nam: 2026, kyLoai: "thang", kySo: 1 },
    kyNguonCt22: { nam: 2025, kyLoai: "quy", kySo: 4 },
  });
  assert.equal(kq.length, 1);
  assert.match(kq[0], /Q4\/2025/);
  assert.match(kq[0], /quý/);
});

test("kỳ nguồn cùng loại thì không nhắc", () => {
  assert.deepEqual(soat({ kyNguonCt22: { nam: 2026, kyLoai: "quy", kySo: 1 } }), []);
});

test("ngưỡng làm tròn không âm kể cả khi không có hóa đơn nào", () => {
  assert.equal(nguongLamTron(0), 1);
  assert.equal(nguongLamTron(-5), 1);
  assert.equal(nguongLamTron(120), 121);
});


const Q4_2025: Ky = { nam: 2025, kyLoai: "quy", kySo: 4 };

test("[22] nối từ kỳ chưa đồng bộ đủ -> cảnh báo, vì [41]/[43] sai theo mà không có dấu hiệu", () => {
  // Ca thật (MST 0111142786): Q4/2025 chỉ đồng bộ tháng 12 nên [43] ra 42.997.436 thay vì
  // 366.696.473 trên tờ khai đã nộp — [43] của Q1/2026 hụt 323.594.395 đồng.
  const cb = soat({
    kyNguonCt22: Q4_2025,
    thieuDuLieuKyNguonCt22: "Hóa đơn bán ra: mới đồng bộ 01/12/2025–31/12/2025, thiếu 01/10/2025–01/12/2025",
  });
  assert.equal(cb.length, 1);
  assert.match(cb[0], /\[22\] nối từ \[43\] của Q4\/2025/);
  assert.match(cb[0], /01\/10\/2025/, "phải nói rõ thiếu khoảng nào");
  assert.match(cb[0], /nhập tay \[22\]/, "phải chỉ ra đường thoát");
});

test("kỳ nguồn [22] đã đồng bộ trọn vẹn -> im lặng", () => {
  assert.deepEqual(soat({ kyNguonCt22: Q4_2025, thieuDuLieuKyNguonCt22: null }), []);
});

test("[22] nhập tay thì không soi kỳ nguồn — không có kỳ nào để soi", () => {
  assert.deepEqual(
    soat({ kyNguonCt22: null, thieuDuLieuKyNguonCt22: "Hóa đơn bán ra: chưa đồng bộ ngày nào" }),
    [],
  );
});

test("kỳ đang lập còn thiếu hóa đơn -> cảnh báo ngay trên màn tờ khai", () => {
  // Dialog "Kê khai" đã báo lúc gán kỳ, nhưng mở lại bản nháp hôm sau thì không còn dấu vết gì.
  const cb = soat({
    thieuDuLieuKyNay: "Hóa đơn bán ra: mới đồng bộ 01/05/2026–30/06/2026, thiếu 01/04/2026–01/05/2026",
  });
  assert.equal(cb.length, 1);
  assert.match(cb[0], /Q2\/2026 chưa đồng bộ đủ hóa đơn/);
  assert.match(cb[0], /01\/04\/2026/);
});

test("thiếu cả kỳ này lẫn kỳ nguồn [22] -> báo đủ hai câu, không nuốt câu nào", () => {
  const cb = soat({
    thieuDuLieuKyNay: "Hóa đơn bán ra: chưa đồng bộ ngày nào trong kỳ",
    kyNguonCt22: Q4_2025,
    thieuDuLieuKyNguonCt22: "Hóa đơn mua vào: chưa đồng bộ ngày nào trong kỳ",
  });
  assert.equal(cb.length, 2);
  assert.match(cb[0], /Q2\/2026 chưa đồng bộ/);
  assert.match(cb[1], /\[22\] nối từ \[43\] của Q4\/2025/);
});

test("hóa đơn đã bị thay thế / đã bị hủy -> nói ra, kèm số tiền", () => {
  // Đo thật Q1/2026: 11 tờ, 1.490.909.300 đồng, mà màn hình trước đây không đếm ở đâu cả.
  const cb = soat({ biLoai: { soHd: 11, giaTri: 1_490_909_300 } });
  assert.equal(cb.length, 1);
  assert.match(cb[0], /11 hóa đơn đã bị thay thế/);
  assert.match(cb[0], /1\.490\.909\.300/);
  assert.match(cb[0], /không hiện trên bảng kê/, "phải nói rõ vì sao không thấy chúng đâu");
  assert.match(cb[0], /Đúng quy định/, "phải nói rõ đây KHÔNG phải lỗi");
});

test("không có hóa đơn nào bị loại -> im lặng", () => {
  assert.deepEqual(soat({ biLoai: { soHd: 0, giaTri: 0 } }), []);
});

test("hóa đơn thay thế nhỏ hơn hóa đơn gốc -> cảnh báo, kèm tờ nào và hụt bao nhiêu", () => {
  // Ca thật: C26TLT|2122 thay cho |1056, tờ thay thế quên dòng bánh xe đẩy 540.000.
  const cb = soat({
    thayTheHut: [
      { hoaDon: "C26TLT|2122", soGoc: "1056", hut: 540_000 },
      { hoaDon: "C26TTM|98", soGoc: "90", hut: 263_460_500 },
    ],
  });
  assert.equal(cb.length, 1);
  assert.match(cb[0], /2 hóa đơn thay thế/);
  assert.match(cb[0], /264\.000\.500/, "phải cộng tổng phần hụt");
  assert.match(cb[0], /C26TLT\|2122 thay \|1056 hụt 540\.000/);
  assert.match(cb[0], /sót dòng hàng/, "phải chỉ ra chỗ cần kiểm");
});

test("nhiều hơn 3 tờ thì kể 3 tờ HỤT NHIỀU NHẤT, không cắt theo thứ tự đầu vào", () => {
  // Danh sách vào là bán ra nối mua vào; tờ hụt nhiều nhất thường nằm cuối.
  const cb = soat({
    thayTheHut: [
      { hoaDon: "C26TLT|1", soGoc: "1", hut: 1_000 },
      { hoaDon: "C26TLT|2", soGoc: "2", hut: 2_000 },
      { hoaDon: "C26TLT|3", soGoc: "3", hut: 3_000 },
      { hoaDon: "C26TLT|4", soGoc: "4", hut: 4_000 },
      { hoaDon: "C26TTM|98", soGoc: "90", hut: 263_460_500 },
    ],
  });
  assert.match(cb[0], /5 hóa đơn thay thế/);
  assert.match(cb[0], /…/);
  assert.equal((cb[0].match(/thay \|/g) ?? []).length, 3);
  assert.match(cb[0], /C26TTM\|98/, "tờ hụt nhiều nhất PHẢI được kể");
  assert.equal(cb[0].includes("C26TLT|1 "), false, "tờ hụt ít nhất bị giấu");
});

test("mọi tờ thay thế đều >= tờ gốc -> im lặng", () => {
  assert.deepEqual(soat({ thayTheHut: [] }), []);
});

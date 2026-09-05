import { test } from "node:test";
import assert from "node:assert/strict";
import { duocTinh, gomBanRa, gomMuaVao, vaNhomNhanBan } from "../services/client/to_khai/domain/gomHoaDonGtgt";
import type { HoaDonGom } from "../services/client/to_khai/domain/gomHoaDonGtgt";

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

test('nhãn rác chỉ có dấu "%" xếp vào treo, KHÔNG lặng lẽ thành "0%" vào [29]', () => {
  // `Number("")` của JS là `0`, không phải `NaN` — nhãn "%" bóc dấu % ra chuỗi rỗng, thiếu chặn là
  // `Number("") = 0` khớp luôn ô 0%, tiền chảy vào [29] mà không một dấu hiệu nào.
  const kq = gomBanRa([hd("rac", "1", [{ tsuat: "%", thtien: 500_000, tthue: 0 }])]);
  assert.equal(kq.tong.ct29, 0);
  assert.equal(kq.treo.length, 1);
  assert.equal(kq.treo[0].id, "rac");
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

/* ===== Quy đổi ngoại tệ về đồng (thêm 2026-09-02) ===== */

test("hóa đơn USD quy ra VND là số NGUYÊN đồng, không lẻ", () => {
  // 1.234,56 USD x 25.310,5 = 31.247.330,88 -> phải ra số nguyên.
  const kq = gomBanRa([
    hd("a", "1", [{ tsuat: "10%", thtien: 1_234.56, tthue: 123.456 }], {
      dvtte: "USD",
      tgia: 25_310.5,
    }),
  ]);
  assert.equal(Number.isInteger(kq.tong.ct32), true);
  assert.equal(Number.isInteger(kq.tong.ct33), true);
  assert.equal(kq.tong.ct32, 31_247_331);
});

test("mua vào ngoại tệ: [23]/[24] cũng nguyên đồng", () => {
  const kq = gomMuaVao([
    hd("m", "1", [{ tsuat: "10%", thtien: 1_234.56, tthue: 123.456 }], {
      dvtte: "USD",
      tgia: 25_310.5,
      tgtcthue: 1_234.56,
      tgtthue: 123.456,
    }),
  ]);
  assert.equal(Number.isInteger(kq.ct23), true);
  assert.equal(Number.isInteger(kq.ct24), true);
  assert.equal(kq.ct24, 3_124_733); // 123,456 x 25.310,5 = 3.124.733,088
});

test("hóa đơn VND không bị đổi số — hệ số 1, số đã nguyên", () => {
  const kq = gomBanRa([hd("v", "1", [{ tsuat: "8%", thtien: 391_249_917, tthue: 31_299_993 }])]);
  assert.equal(kq.tong.ct32, 391_249_917);
  assert.equal(kq.tong.ct33, 31_299_993);
});

test("ngoại tệ âm (điều chỉnh giảm) làm tròn đối xứng, không ra -0", () => {
  const kq = gomBanRa([
    hd("b", "1", [{ tsuat: "10%", thtien: -0.25, tthue: 0 }], { dvtte: "USD", tgia: 2 }),
  ]);
  assert.equal(kq.tong.ct32, -1); // -0,5 -> -1 (xa 0), không phải -0
  assert.equal(Object.is(kq.tong.ct33, -0), false);
});

/* ===== Hóa đơn cổng trả `thtien` nhân bản (thêm 2026-09-03) ===== */

test("hai nhãn khác nhau: phân bổ theo tiền thuế, tổng khớp tgtcthue", () => {
  // Ca thật C26TLT 1090: mỗi nhóm ghi thtien = 41.499.000 (bằng cả hóa đơn).
  // 3.096.880 / 8% = 38.711.000 ; 278.800 / 10% = 2.788.000 ; cộng = 41.499.000.
  const kq = vaNhomNhanBan(
    [
      { nhan: "8%", thtien: 41_499_000, tthue: 3_096_880 },
      { nhan: "10%", thtien: 41_499_000, tthue: 278_800 },
    ],
    41_499_000,
  );
  assert.deepEqual(kq.map((n) => n.thtien), [38_711_000, 2_788_000]);
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 41_499_000);
});

test("hai nhóm CÙNG nhãn: suy lại mức thật, nhóm sau hóa ra là 10%", () => {
  // Ca thật C26TLT 1108. Cổng ghi cả hai nhóm là 8%, nhưng 47.200 ÷ 8% = 590.000 thì tổng ra
  // 4.408.000, không khớp `tgtcthue`. Chỉ 47.200 ÷ 10% = 472.000 mới cho 3.818.000 + 472.000
  // = 4.290.000 — nhãn của nhóm sau bị chép nhầm từ nhóm đầu.
  const kq = vaNhomNhanBan(
    [
      { nhan: "8%", thtien: 4_290_000, tthue: 305_440 },
      { nhan: "8%", thtien: 4_290_000, tthue: 47_200 },
    ],
    4_290_000,
  );
  assert.deepEqual(
    kq.map((n) => [n.nhan, n.thtien]),
    [
      ["8%", 3_818_000],
      ["10%", 472_000],
    ],
  );
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 4_290_000, "tổng phải khớp từng đồng");
});

test("suy lại mức thuế suất khớp từng đồng với sổ kế toán — bốn ca thật", () => {
  // Bốn hóa đơn của MST 0111142786 quý 1/2026: cổng ghi cả hai nhóm là "8%", số bên phải là số
  // kế toán đã kê trên tờ khai đã nộp. Tin nhãn thì phụ lục giảm thuế lệch, kéo [33] lệch theo.
  const ca: [number, [number, number], [number, number]][] = [
    // tgtcthue, [thuế nhóm 1, thuế nhóm 2], [tiền 8% đúng, tiền 10% đúng]
    [786_000, [49_280, 17_000], [616_000, 170_000]],
    [1_022_000, [51_520, 37_800], [644_000, 378_000]],
    [13_690_000, [468_000, 784_000], [5_850_000, 7_840_000]],
    [2_670_000, [161_760, 64_800], [2_022_000, 648_000]],
  ];
  for (const [tong, [t1, t2], [mong8, mong10]] of ca) {
    const kq = vaNhomNhanBan(
      [
        { nhan: "8%", thtien: tong, tthue: t1 },
        { nhan: "8%", thtien: tong, tthue: t2 },
      ],
      tong,
    );
    assert.deepEqual(
      kq.map((n) => [n.nhan, n.thtien]),
      [
        ["8%", mong8],
        ["10%", mong10],
      ],
      `tgtcthue ${tong}`,
    );
  }
});

test("nhãn ĐÚNG sẵn thì suy lại vẫn ra chính nó, không xáo trộn", () => {
  // C26TLT 388: cổng ghi đúng 8% và 10%, chỉ `thtien` bị nhân bản.
  const kq = vaNhomNhanBan(
    [
      { nhan: "8%", thtien: 972_000, tthue: 68_480 },
      { nhan: "10%", thtien: 972_000, tthue: 11_600 },
    ],
    972_000,
  );
  assert.deepEqual(
    kq.map((n) => [n.nhan, n.thtien]),
    [
      ["8%", 856_000],
      ["10%", 116_000],
    ],
  );
});

test("không có tổ hợp mức nào khớp -> giữ nhãn cổng, chia theo trọng số, tổng vẫn đúng", () => {
  // Thuế lẻ (chiết khấu/làm tròn trên hóa đơn) nên không mức nào cộng ra đúng `tgtcthue`.
  const kq = vaNhomNhanBan(
    [
      { nhan: "8%", thtien: 1_000_000, tthue: 40_003 },
      { nhan: "10%", thtien: 1_000_000, tthue: 50_007 },
    ],
    1_000_000,
  );
  assert.deepEqual(kq.map((n) => n.nhan), ["8%", "10%"], "nhãn giữ nguyên khi không suy được");
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 1_000_000);
});

test("hai tổ hợp mức cùng khớp -> KHÔNG chọn bừa, giữ nhãn cổng", () => {
  // Hai nhóm thuế bằng nhau: (8%,10%) và (10%,8%) cho cùng một tổng, không có căn cứ chọn bên nào.
  const doiXung = [
    { nhan: "8%", thtien: 900_000, tthue: 40_000 },
    { nhan: "8%", thtien: 900_000, tthue: 40_000 },
  ];
  const kq = vaNhomNhanBan(doiXung, 900_000);
  assert.deepEqual(kq.map((n) => n.nhan), ["8%", "8%"]);
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 900_000);
});

test('nhãn "KHAC:08.00%" của cổng thuế được đọc là 8%, không treo hóa đơn', () => {
  // Ca thật (MST 0111142786, hóa đơn mua vào): nhóm 1.869.629.200 thuế 149.570.336 = đúng 8,00%.
  // Bên bán ra, nhãn không đọc được là cả hóa đơn rơi vào `treo` và mất khỏi [32].
  const kq = gomBanRa([hd("a", "1", [{ tsuat: "KHAC:08.00%", thtien: 1_000_000, tthue: 80_000 }])]);
  assert.equal(kq.treo.length, 0, "không được treo");
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.theoNhan["8%"]?.giaTri, 1_000_000, "phải vào đúng nhóm 8% của phụ lục");
});

test('"KHAC" không kèm mức thì vẫn treo — thà nói không biết còn hơn đoán', () => {
  const kq = gomBanRa([hd("a", "1", [{ tsuat: "KHAC", thtien: 1_000_000, tthue: 80_000 }])]);
  assert.equal(kq.treo.length, 1);
  assert.equal(kq.tong.ct32, 0);
});

test("hóa đơn LÀNH (tổng nhóm khớp) không bị đụng vào", () => {
  const lanh = [
    { nhan: "8%", thtien: 1_000_000, tthue: 80_000 },
    { nhan: "10%", thtien: 500_000, tthue: 50_000 },
  ];
  assert.deepEqual(vaNhomNhanBan(lanh, 1_500_000), lanh);
});

test("một nhóm duy nhất thì không vá, dù thtien bằng tgtcthue", () => {
  const mot = [{ nhan: "10%", thtien: 1_000_000, tthue: 100_000 }];
  assert.deepEqual(vaNhomNhanBan(mot, 1_000_000), mot);
});

test("có nhóm không suy được (thuế 0 / nhãn chữ) -> TRẢ NGUYÊN, không bịa cách chia", () => {
  const coKct = [
    { nhan: "KCT", thtien: 2_000_000, tthue: 0 },
    { nhan: "10%", thtien: 2_000_000, tthue: 100_000 },
  ];
  assert.deepEqual(vaNhomNhanBan(coKct, 2_000_000), coKct);
});

test("làm tròn không làm lệch tổng — nhóm cuối nhận phần còn lại", () => {
  // Tỉ lệ lẻ: 1/3 và 2/3 của 1.000.000 không chia hết.
  const kq = vaNhomNhanBan(
    [
      { nhan: "10%", thtien: 1_000_001, tthue: 33_333 },
      { nhan: "10%", thtien: 1_000_001, tthue: 66_667 },
    ],
    1_000_001,
  );
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 1_000_001);
});

test("gomBanRa dùng số ĐÃ VÁ, không cộng đôi nữa", () => {
  const hoaDon = hd("x", "1", [
    { tsuat: "8%", thtien: 41_499_000, tthue: 3_096_880 },
    { tsuat: "10%", thtien: 41_499_000, tthue: 278_800 },
  ], { tgtcthue: 41_499_000, tgtthue: 3_375_680 });
  const kq = gomBanRa([hoaDon]);
  assert.equal(kq.tong.ct32, 41_499_000, "trước khi vá số này là 82.998.000");
  assert.equal(kq.theoNhan["8%"]?.giaTri, 38_711_000);
  assert.equal(kq.theoNhan["10%"]?.giaTri, 2_788_000);
});

/* ===== Hóa đơn không có khối tách thuế suất ===== */

/** Hóa đơn chỉ có tổng, KHÔNG có `thttltsuat` — dạng cổng thuế trả cho hóa đơn điện/viễn thông. */
function hdChiTong(id: string, tgtcthue: number, tgtthue: number): HoaDonGom {
  return { id, tthai: "1", dvtte: "VND", tgia: 1, tgtcthue, tgtthue, detail: { hdhhdvu: [] } };
}

test("hóa đơn chỉ có tổng: suy được mức 8% từ tiền thuế", () => {
  // Ca thật: 122 hóa đơn mua vào (điện lực, Viettel, MobiFone) không có khối tách thuế suất.
  const kq = gomMuaVao([hdChiTong("a", 1_000_000, 80_000)]);
  assert.equal(kq.ct23, 1_000_000);
  assert.equal(kq.theoNhan["8%"]?.giaTri, 1_000_000, "phải vào nhóm 8% để phụ lục thấy");
  assert.equal(kq.treo.length, 0);
});

test("hóa đơn chỉ có tổng: suy được mức 10%, không lẫn sang 8%", () => {
  const kq = gomMuaVao([hdChiTong("a", 1_000_000, 100_000)]);
  assert.equal(kq.theoNhan["10%"]?.giaTri, 1_000_000);
  assert.equal(kq.theoNhan["8%"], undefined);
});

test("thuế bằng 0 thì KHÔNG suy — không phân biệt được KCT với thuế suất 0%", () => {
  // KCT vào [26], 0% vào [29] — hai ô khác nhau, đoán sai là chuyển tiền sang sai dòng.
  const kq = gomMuaVao([hdChiTong("a", 1_000_000, 0)]);
  assert.equal(kq.ct23, 1_000_000, "vẫn vào [23]");
  assert.deepEqual(kq.theoNhan, {}, "nhưng không xếp nhóm nào");
});

test("hóa đơn NHIỀU mức mà cổng chỉ trả tổng -> không suy, để nguyên", () => {
  // Ca thật: 7 hóa đơn FPT, 336.364 thuế 31.655 = 9,4109% — không phải mức nào.
  const kq = gomMuaVao([hdChiTong("a", 336_364, 31_655)]);
  assert.equal(kq.ct23, 336_364);
  assert.deepEqual(kq.theoNhan, {});
});

test("bán ra chỉ có tổng: vào [32] thay vì bị treo mất doanh thu", () => {
  const kq = gomBanRa([hdChiTong("a", 1_000_000, 80_000)]);
  assert.equal(kq.tong.ct32, 1_000_000);
  assert.equal(kq.treo.length, 0);
  assert.equal(kq.soHd, 1);
});

test("bán ra chỉ có tổng mà không suy được mức -> vẫn treo, KHÔNG cộng bừa vào [32]", () => {
  const kq = gomBanRa([hdChiTong("a", 336_364, 31_655)]);
  assert.equal(kq.tong.ct32, 0);
  assert.equal(kq.treo.length, 1);
});

test("hóa đơn có khối tách thuế suất thì KHÔNG suy từ tổng — khối gốc thắng", () => {
  const kq = gomMuaVao([
    hd("a", "1", [
      { tsuat: "8%", thtien: 500_000, tthue: 40_000 },
      { tsuat: "10%", thtien: 500_000, tthue: 50_000 },
    ]),
  ]);
  assert.equal(kq.theoNhan["8%"]?.giaTri, 500_000);
  assert.equal(kq.theoNhan["10%"]?.giaTri, 500_000);
});

test("tiền từng nhóm là thuế ÷ suất, phần lẻ của hóa đơn dồn vào nhóm cuối", () => {
  // Ca thật C26TLT 978: tgtcthue 3.959.273 nhưng thuế chỉ ứng với 3.959.270 — lẻ 3 đồng.
  // Sổ kế toán giữ 8% đúng 2.300.000 và dồn 3 đồng vào nhóm 10%.
  const kq = vaNhomNhanBan(
    [
      { nhan: "8%", thtien: 3_959_273, tthue: 184_000 },
      { nhan: "10%", thtien: 3_959_273, tthue: 165_927 },
    ],
    3_959_273,
  );
  assert.deepEqual(
    kq.map((n) => n.thtien),
    [2_300_000, 1_659_273],
    "8% phải đúng 184.000 ÷ 8%, không bị kéo lệch 2 đồng",
  );
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 3_959_273);
});

test("phần lẻ về nhóm có base KHÔNG nguyên đồng, không phải nhóm cuối", () => {
  // Ca thật C26TLT 364: tgtcthue 7.761.090, thuế 611.287 (8%) + 12.000 (10%).
  //   12.000 ÷ 10%  = 120.000     -> nguyên, base chắc, giữ nguyên
  //   611.287 ÷ 8%  = 7.641.087,5 -> lẻ, nhận phần còn lại
  const kq = vaNhomNhanBan(
    [
      { nhan: "8%", thtien: 7_761_090, tthue: 611_287 },
      { nhan: "10%", thtien: 7_761_090, tthue: 12_000 },
    ],
    7_761_090,
  );
  assert.deepEqual(
    kq.map((n) => n.thtien),
    [7_641_090, 120_000],
    "nhóm 10% chia hết phải giữ nguyên 120.000",
  );
  assert.equal(kq.reduce((s, n) => s + n.thtien, 0), 7_761_090);
});


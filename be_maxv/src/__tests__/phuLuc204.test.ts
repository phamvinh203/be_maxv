import { test } from "node:test";
import assert from "node:assert/strict";
import { dungPhuLuc204 } from "../services/client/to_khai/phuLuc204";
import { gomBanRa, gomMuaVao, type HoaDonGom } from "../services/client/to_khai/gomHoaDonGtgt";

/**
 * npx tsx --test src/__tests__/phuLuc204.test.ts
 *
 * Con số trong ca "khớp phụ lục thật" lấy từ tờ khai Q2/2026 của MST 0106861880 (Phát Thịnh) —
 * mục II ghi: Cước vận chuyển, giá trị 391.249.917, thuế suất 10% giảm còn 8%, thuế được giảm
 * 7.824.998.
 */

/** Hóa đơn có nhóm thuế suất + dòng hàng mang tên. */
function hd(
  id: string,
  nhom: { tsuat: string; thtien: number; tthue: number }[],
  tenHang: { ten: string; ltsuat: string }[] = [],
): HoaDonGom {
  return {
    id,
    tthai: "1",
    dvtte: "VND",
    tgia: 1,
    tgtcthue: nhom.reduce((s, n) => s + n.thtien, 0),
    tgtthue: nhom.reduce((s, n) => s + n.tthue, 0),
    detail: { thttltsuat: nhom, hdhhdvu: tenHang },
  };
}

test("mục II khớp phụ lục thật: thuế được giảm = giá trị × 2%", () => {
  const banRa = gomBanRa([
    hd("a", [{ tsuat: "8%", thtien: 391_249_917, tthue: 31_299_993 }], [
      { ten: "Cước vận chuyển", ltsuat: "8%" },
    ]),
  ]);
  const pl = dungPhuLuc204(banRa, gomMuaVao([]));
  assert.equal(pl.banRa.giaTri, 391_249_917);
  assert.equal(pl.banRa.thueSuatQuyDinh, 10);
  assert.equal(pl.banRa.thueSuatSauGiam, 8);
  assert.equal(pl.banRa.thueDuocGiam, 7_824_998);
  assert.equal(pl.banRa.tenHang, "Cước vận chuyển");
});

test("thuế được giảm tính theo CÔNG THỨC, không lấy thuế thực tế trên hóa đơn", () => {
  // Hóa đơn ghi thuế 31.299.993 (8% làm tròn xuống) nhưng phụ lục phải ra 2% × giá trị.
  const banRa = gomBanRa([hd("a", [{ tsuat: "8%", thtien: 391_249_917, tthue: 31_299_993 }])]);
  const pl = dungPhuLuc204(banRa, gomMuaVao([]));
  assert.equal(pl.banRa.thue, 31_299_993);
  assert.equal(pl.banRa.thueDuocGiam, 7_824_998);
  assert.notEqual(pl.banRa.thueDuocGiam, pl.banRa.thue);
});

test("mục III = thuế bán ra được giảm − thuế mua vào", () => {
  const banRa = gomBanRa([hd("b", [{ tsuat: "8%", thtien: 391_249_917, tthue: 31_299_993 }])]);
  const muaVao = gomMuaVao([hd("m", [{ tsuat: "8%", thtien: 63_518_043, tthue: 5_081_437 }])]);
  const pl = dungPhuLuc204(banRa, muaVao);
  assert.equal(pl.muaVao.giaTri, 63_518_043);
  assert.equal(pl.muaVao.thue, 5_081_437);
  assert.equal(pl.chenhLech, 7_824_998 - 5_081_437);
});

test("mục I gộp MỌI nhóm có thuế, bỏ nhóm không thuế", () => {
  // Bản kế toán đã nộp gộp cả 10% vào mục I (thuế 5.102.437 = 5.081.437 nhóm 8% + 21.000 nhóm
  // 10%), nên mục I lấy toàn bộ thuế đầu vào được khấu trừ. KKKNT thuế 0 -> không có gì khấu trừ.
  const muaVao = gomMuaVao([
    hd("a", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }]),
    hd("b", [{ tsuat: "10%", thtien: 210_000, tthue: 21_000 }]),
    hd("c", [{ tsuat: "KKKNT", thtien: 259_322_420, tthue: 0 }]),
  ]);
  const pl = dungPhuLuc204(gomBanRa([]), muaVao);
  assert.equal(pl.muaVao.giaTri, 1_210_000);
  assert.equal(pl.muaVao.thue, 101_000);
});

test("mục II CHỈ lấy nhóm 8%, không dính 10%", () => {
  // Mục II là phần ĐƯỢC GIẢM — hàng 10% không được giảm nên không được lọt vào.
  const banRa = gomBanRa([
    hd("a", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }]),
    hd("b", [{ tsuat: "10%", thtien: 5_000_000, tthue: 500_000 }]),
  ]);
  const pl = dungPhuLuc204(banRa, gomMuaVao([]));
  assert.equal(pl.banRa.giaTri, 1_000_000);
  assert.equal(pl.banRa.thueDuocGiam, 20_000);
});

test("có mua vào 8% nhưng không bán ra 8% -> vẫn không phải nộp phụ lục", () => {
  const muaVao = gomMuaVao([hd("m", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }])]);
  assert.equal(dungPhuLuc204(gomBanRa([]), muaVao).rong, true);
});

test("gom tên hàng của nhiều hóa đơn, khử trùng, đúng nhãn", () => {
  const muaVao = gomMuaVao([
    hd("a", [{ tsuat: "8%", thtien: 100, tthue: 8 }], [
      { ten: "Dầu Điêzen", ltsuat: "8%" },
      { ten: "Lốp xe", ltsuat: "8%" },
    ]),
    hd("b", [{ tsuat: "8%", thtien: 100, tthue: 8 }], [
      { ten: "Dầu Điêzen", ltsuat: "8%" },
      { ten: "Cước đường bộ", ltsuat: "8%" },
      // Dòng thuế suất khác KHÔNG được lọt vào mô tả của nhóm 8%.
      { ten: "Phí ngân hàng", ltsuat: "10%" },
    ]),
  ]);
  const pl = dungPhuLuc204(gomBanRa([]), muaVao);
  assert.equal(pl.muaVao.tenHang, "Dầu Điêzen, Lốp xe, Cước đường bộ");
});

test("kỳ không có hàng 8% -> phụ lục rỗng, không phải nộp", () => {
  const banRa = gomBanRa([hd("a", [{ tsuat: "10%", thtien: 1_000_000, tthue: 100_000 }])]);
  const pl = dungPhuLuc204(banRa, gomMuaVao([]));
  assert.equal(pl.rong, true);
  assert.equal(pl.banRa.giaTri, 0);
  assert.equal(pl.chenhLech, 0);
});

test("chênh lệch âm khi thuế đầu vào lớn hơn phần giảm đầu ra", () => {
  const banRa = gomBanRa([hd("b", [{ tsuat: "8%", thtien: 1_000_000, tthue: 80_000 }])]);
  const muaVao = gomMuaVao([hd("m", [{ tsuat: "8%", thtien: 10_000_000, tthue: 800_000 }])]);
  const pl = dungPhuLuc204(banRa, muaVao);
  assert.equal(pl.banRa.thueDuocGiam, 20_000);
  assert.equal(pl.chenhLech, 20_000 - 800_000);
});

test("thuế được giảm LÀM TRÒN THƯỜNG — chốt bằng hai phụ lục thật", () => {
  // MST 0111142786 (XNK Thành Công). Hai kỳ này phân định được tròn-thường với cắt-phần-lẻ, và
  // cả hai đều khớp tròn thường. Trước đây code dùng `Math.trunc` theo một suy luận ngược từ
  // [22] của kỳ sau — hai file này bác điều đó.
  const q1 = dungPhuLuc204(
    gomBanRa([hd("a", [{ tsuat: "8%", thtien: 4_631_817_848, tthue: 370_545_428 }])]),
    gomMuaVao([]),
  );
  assert.equal(q1.banRa.thueDuocGiam, 92_636_357); // 92.636.356,96 -> tròn LÊN

  const q2 = dungPhuLuc204(
    gomBanRa([hd("b", [{ tsuat: "8%", thtien: 7_093_463_577, tthue: 567_477_086 }])]),
    gomMuaVao([]),
  );
  assert.equal(q2.banRa.thueDuocGiam, 141_869_272); // 141.869.271,54 -> tròn LÊN
});

test("nhóm 8% ÂM: làm tròn đối xứng, không ra -0", () => {
  // Hóa đơn điều chỉnh giảm kéo nhóm 8% xuống âm. -25 x 2% = -0,5 -> -1 (nửa ra XA 0).
  const banRa = gomBanRa([hd("a", [{ tsuat: "8%", thtien: -25, tthue: -2 }])]);
  const pl = dungPhuLuc204(banRa, gomMuaVao([]));
  assert.equal(pl.banRa.thueDuocGiam, -1);
  assert.equal(Object.is(pl.banRa.thueDuocGiam, -0), false);
});

test("nhóm 8% âm lớn: làm tròn đúng phía, không xuống thêm một đồng", () => {
  // -1.234.567 x 2% = -24.691,34 -> -24.691 (phần lẻ 0,34 < nửa nên không đẩy xa thêm).
  const banRa = gomBanRa([hd("b", [{ tsuat: "8%", thtien: -1_234_567, tthue: -98_765 }])]);
  assert.equal(dungPhuLuc204(banRa, gomMuaVao([])).banRa.thueDuocGiam, -24_691);
});

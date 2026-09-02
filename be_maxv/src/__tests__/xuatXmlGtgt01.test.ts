import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MA_TKHAI_GTGT01,
  dungXmlGtgt01,
  tenFileXml,
} from "../services/client/to_khai/xuatXmlGtgt01";
import { layChiTieuToKhaiGtgt } from "../services/client/dich_vu_cong/toKhaiXml";
import type { Ky } from "../services/client/to_khai/kySoThue";

/**
 * npx tsx --test src/__tests__/xuatXmlGtgt01.test.ts
 *
 * Ca chính là ROUND-TRIP: dựng XML rồi đọc lại bằng `dich_vu_cong/toKhaiXml.ts` — parser đó đã
 * được đối chiếu với 5 hồ sơ 01/GTGT thật, nên nó đọc được file ta sinh ra nghĩa là cấu trúc khớp
 * mẫu thật, không phải khớp với chính tưởng tượng của mình.
 *
 * Số dùng trong test lấy từ tờ khai Q2/2026 đã nộp của MST 0106861880 (Phát Thịnh).
 */

const Q2: Ky = { nam: 2026, kyLoai: "quy", kySo: 2 };

/** Bộ chỉ tiêu Q2/2026 thật (bản máy tính, khớp 21/22 ô với tờ khai đã nộp). */
const CT_Q2: Record<string, number> = {
  ct22: 3_366_060,
  ct23: 323_050_463,
  ct24: 5_102_437,
  ct25: 5_102_437,
  ct26: 0,
  ct27: 391_249_917,
  ct28: 31_299_994,
  ct29: 0,
  ct30: 0,
  ct31: 0,
  ct32: 391_249_917,
  ct33: 31_299_994,
  ct34: 391_249_917,
  ct35: 31_299_994,
  ct36: 26_197_557,
  ct37: 0,
  ct38: 0,
  ct39a: 0,
  ct40a: 22_831_497,
  ct40b: 0,
  ct40: 22_831_497,
  ct41: 0,
  ct42: 0,
  ct43: 0,
};

const NNT = {
  mst: "0106861880",
  tenNnt: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ THƯƠNG MẠI SẢN XUẤT PHÁT THỊNH",
  diaChi: "Hà Nội",
  dienThoai: "0123456789",
};

function xmlQ2(): string {
  return dungXmlGtgt01({ ky: Q2, ct: CT_Q2, nnt: NNT, ngayLap: new Date(2026, 8, 2) });
}

test("parser của module Dịch vụ công đọc lại được file ta sinh ra", () => {
  const doc = layChiTieuToKhaiGtgt(xmlQ2());
  assert.equal(doc["Khấu trừ kỳ trước"], "3366060");
  assert.equal(doc["Giá trị HHDV mua vào"], "323050463");
  assert.equal(doc["Thuế GTGT HHDV mua vào"], "5102437");
  assert.equal(doc["Khấu trừ kỳ này"], "5102437");
  assert.equal(doc["Phải nộp trong kỳ"], "22831497");
  assert.equal(doc["Doanh thu HHDV bán ra"], "391249917");
});

test("[23]/[24] nằm TRONG nhóm bọc, không phẳng", () => {
  // Mẫu thật bọc hai ô này trong `GiaTriVaThueGTGTHHDVMuaVao`; để phẳng là cổng từ chối.
  const xml = xmlQ2();
  assert.match(
    xml,
    /<GiaTriVaThueGTGTHHDVMuaVao>\s*<ct23>323050463<\/ct23>\s*<ct24>5102437<\/ct24>\s*<\/GiaTriVaThueGTGTHHDVMuaVao>/,
  );
  assert.match(
    xml,
    /<HHDVBRaChiuTSuat10>\s*<ct32>391249917<\/ct32>\s*<ct33>31299994<\/ct33>\s*<\/HHDVBRaChiuTSuat10>/,
  );
});

test("mã mẫu và namespace đúng bản 01/GTGT của cổng", () => {
  const xml = xmlQ2();
  assert.equal(MA_TKHAI_GTGT01, "842");
  assert.match(xml, /<maTKhai>842<\/maTKhai>/);
  assert.match(xml, /xmlns="http:\/\/kekhaithue\.gdt\.gov\.vn\/TKhaiThue"/);
  assert.match(xml, /<HSoKhaiThue id="ID-NODETOSIGN">/);
});

test("kỳ quý ghi kieuKy=Q và đủ khoảng ngày", () => {
  const xml = xmlQ2();
  assert.match(xml, /<kieuKy>Q<\/kieuKy>/);
  assert.match(xml, /<kyKKhai>2\/2026<\/kyKKhai>/);
  assert.match(xml, /<kyKKhaiTuNgay>01\/04\/2026<\/kyKKhaiTuNgay>/);
  assert.match(xml, /<kyKKhaiDenNgay>30\/06\/2026<\/kyKKhaiDenNgay>/);
  assert.match(xml, /<kyKKhaiTuThang>4\/2026<\/kyKKhaiTuThang>/);
  assert.match(xml, /<kyKKhaiDenThang>6\/2026<\/kyKKhaiDenThang>/);
});

test("kỳ tháng ghi kieuKy=M, khoảng ngày gói trong đúng tháng", () => {
  const xml = dungXmlGtgt01({
    ky: { nam: 2026, kyLoai: "thang", kySo: 7 },
    ct: CT_Q2,
    nnt: NNT,
  });
  assert.match(xml, /<kieuKy>M<\/kieuKy>/);
  assert.match(xml, /<kyKKhai>7\/2026<\/kyKKhai>/);
  assert.match(xml, /<kyKKhaiTuNgay>01\/07\/2026<\/kyKKhaiTuNgay>/);
  assert.match(xml, /<kyKKhaiDenNgay>31\/07\/2026<\/kyKKhaiDenNgay>/);
});

test("tháng 2 năm nhuận ra đúng ngày cuối", () => {
  const xml = dungXmlGtgt01({
    ky: { nam: 2028, kyLoai: "thang", kySo: 2 },
    ct: {},
    nnt: NNT,
  });
  assert.match(xml, /<kyKKhaiDenNgay>29\/02\/2028<\/kyKKhaiDenNgay>/);
});

test("ô thiếu ghi 0 chứ không bỏ thẻ — cổng đối chiếu công thức giữa các ô", () => {
  const xml = dungXmlGtgt01({ ky: Q2, ct: {}, nnt: NNT });
  for (const tag of ["ct22", "ct23", "ct24", "ct32", "ct33", "ct40", "ct43", "ct23a", "ct39a"]) {
    assert.match(xml, new RegExp(`<${tag}>0</${tag}>`), `thiếu thẻ ${tag}`);
  }
});

test("số âm giữ nguyên dấu — [36] âm là chuyện bình thường", () => {
  const xml = dungXmlGtgt01({ ky: Q2, ct: { ct36: -1_446_670 }, nnt: NNT });
  assert.match(xml, /<ct36>-1446670<\/ct36>/);
});

test("số lẻ được làm tròn về đồng, không lọt phần thập phân vào file", () => {
  const xml = dungXmlGtgt01({ ky: Q2, ct: { ct32: 1_000_000.6 }, nnt: NNT });
  assert.match(xml, /<ct32>1000001<\/ct32>/);
  assert.doesNotMatch(xml, /<ct32>[^<]*\./);
});

test("tên công ty có ký tự đặc biệt được thoát, không làm hỏng XML", () => {
  const xml = dungXmlGtgt01({
    ky: Q2,
    ct: {},
    nnt: { mst: "0106861880", tenNnt: 'CTY "A&B" <TNHH>' },
  });
  assert.match(xml, /<tenNNT>CTY &quot;A&amp;B&quot; &lt;TNHH&gt;<\/tenNNT>/);
  // Nội dung thẻ không được còn `<`/`>` thô, và mọi `&` phải mở đầu một entity hợp lệ.
  const noiDung = /<tenNNT>([^<]*)<\/tenNNT>/.exec(xml)?.[1] ?? "";
  assert.doesNotMatch(noiDung, /[<>]/);
  assert.doesNotMatch(noiDung, /&(?!(amp|lt|gt|quot|apos);)/);
});

test("khai bổ sung ghi đúng số lần, mặc định là 0", () => {
  assert.match(dungXmlGtgt01({ ky: Q2, ct: {}, nnt: NNT }), /<soLan>0<\/soLan>/);
  assert.match(dungXmlGtgt01({ ky: Q2, ct: {}, nnt: NNT, soLan: 2 }), /<soLan>2<\/soLan>/);
  // Số lần âm/lẻ không được lọt vào file nộp thuế.
  assert.match(dungXmlGtgt01({ ky: Q2, ct: {}, nnt: NNT, soLan: -3 }), /<soLan>0<\/soLan>/);
});


test("tên file theo lối đặt tên của cổng", () => {
  assert.equal(
    tenFileXml(Q2, "0106861880"),
    "01_GTGT_TT80_2026_0106861880_01-04-2026_30-06-2026.xml",
  );
});

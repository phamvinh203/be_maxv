import { test } from "node:test";
import assert from "node:assert/strict";
import { taoKhoLuotChayNen, type LuotChayNen } from "../services/shared/luotChayNen";
import { tick, deferred } from "./_helpers";

/**
 * Test KHO LƯỢT CHẠY NỀN dùng chung — phần khó nhất của mọi luồng chạy nền: thay lượt, đè trạng
 * thái lượt mới, treo `active` vĩnh viễn. `work` giả nên KHÔNG đụng cổng thuế/DB.
 *
 * `gdtUpdateRun.test.ts` test cùng những bất biến này QUA `startUpdateRunWith` (đường HĐĐT thật) —
 * giữ cả hai: file này khóa hợp đồng của helper, file kia khóa việc HĐĐT còn dùng đúng helper.
 *
 *   npx tsx --test src/__tests__/luotChayNen.test.ts
 */

interface TrangThaiThu extends LuotChayNen {
  pha: string;
  soDaLam: number;
}



function khoThu() {
  return taoKhoLuotChayNen<TrangThaiThu>({
    loiMacDinh: "Lỗi mặc định.",
    khiDong: (st) => {
      st.pha = "";
    },
  });
}

const khoiTao = (): TrangThaiThu => ({
  active: true,
  startedAt: Date.now(),
  pha: "dang-chay",
  soDaLam: 0,
});

test("lượt xong -> active=false, chạy khiDong, có finishedAt", async () => {
  const kho = khoThu();
  const st = kho.batDau("t1", khoiTao, async (s) => {
    s.soDaLam = 7;
  });
  assert.equal(st.active, true);
  assert.equal(st.pha, "dang-chay");

  await tick();

  assert.equal(st.active, false);
  assert.equal(st.pha, "", "khiDong phải được gọi lúc đóng lượt");
  assert.equal(st.soDaLam, 7);
  assert.ok(st.finishedAt && st.finishedAt >= st.startedAt);
});

test("work ném lỗi -> ghi error, lượt vẫn đóng", async () => {
  const kho = khoThu();
  const st = kho.batDau("t2", khoiTao, async () => {
    throw new Error("cổng chặn");
  });

  await tick();

  assert.equal(st.active, false, "lỗi không được làm treo active");
  assert.equal(st.error, "cổng chặn");
});

test("work ném thứ KHÔNG phải Error -> dùng loiMacDinh", async () => {
  const kho = khoThu();
  const st = kho.batDau("t3", khoiTao, async () => {
    throw "chuỗi trần";
  });

  await tick();

  assert.equal(st.error, "Lỗi mặc định.");
});

test("lượt mới THAY lượt cũ; lượt cũ kết thúc sau không đè trạng thái lượt mới", async () => {
  const kho = khoThu();
  const cu = deferred();
  const moi = deferred();

  kho.batDau("t4", khoiTao, async () => cu.promise);
  const luotMoi = kho.batDau("t4", khoiTao, async () => moi.promise);

  assert.equal(kho.doc("t4"), luotMoi, "lượt mới là lượt hiện tại ngay khi bắt đầu");

  cu.resolve();
  await tick();
  assert.equal(luotMoi.active, true, "lượt cũ đóng muộn KHÔNG được đóng lượt mới");
  assert.equal(luotMoi.pha, "dang-chay");

  moi.resolve();
  await tick();
  assert.equal(luotMoi.active, false);
});

test("lượt cũ thấy daBiThay=true ngay khi có lượt mới, để tự thoát", async () => {
  const kho = khoThu();
  const giu = deferred();
  let thayLuc: boolean | undefined;

  kho.batDau("t5", khoiTao, async (_s, daBiThay) => {
    thayLuc = daBiThay();
    await giu.promise;
    thayLuc = daBiThay();
  });
  await tick();
  assert.equal(thayLuc, false);

  kho.batDau("t5", khoiTao, async () => {});
  giu.resolve();
  await tick();

  assert.equal(thayLuc, true);
});

test("khóa tách biệt: lượt khóa này không ảnh hưởng khóa kia", async () => {
  const kho = khoThu();
  const giu = deferred();
  const a = kho.batDau("A", khoiTao, async () => giu.promise);

  assert.equal(kho.doc("B"), null);
  assert.equal(kho.doc("A"), a);

  giu.resolve();
  await tick();
});

test("hai KHO khác nhau không dùng chung khóa", async () => {
  const kho1 = khoThu();
  const kho2 = khoThu();
  const giu = deferred();
  kho1.batDau("chung", khoiTao, async () => giu.promise);

  assert.equal(kho2.doc("chung"), null, "mỗi kho phải có không gian khóa riêng");

  giu.resolve();
  await tick();
});

test("chưa từng chạy -> doc trả null", () => {
  assert.equal(khoThu().doc("chua-chay"), null);
});

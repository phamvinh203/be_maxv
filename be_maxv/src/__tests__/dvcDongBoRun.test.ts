import { test } from "node:test";
import assert from "node:assert/strict";
import {
  batDauDongBoRun,
  docTienDoDongBo,
} from "../services/client/dich_vu_cong/dvc-dong-bo.service";
import { tick, deferred } from "./_helpers";

/**
 * Test lượt ĐỒNG BỘ DỊCH VỤ CÔNG chạy nền — `work` giả nên KHÔNG đụng cổng/DB.
 *
 * Vòng đời chung (thay lượt, không đè, không treo `active`) đã khóa ở `luotChayNen.test.ts`; file
 * này khóa phần RIÊNG của DVC: hình dạng tiến độ lúc khởi tạo, và CÔ LẬP THEO CÔNG TY.
 *
 *   npx tsx --test src/__tests__/dvcDongBoRun.test.ts
 */



test("tiến độ khởi tạo: đang chạy, mọi bộ đếm 0, chưa biết tổng", () => {
  const giu = deferred();
  const st = batDauDongBoRun("cty-khoi-tao", async () => giu.promise);

  assert.equal(st.active, true);
  assert.equal(st.tongHoSo, 0, "chưa tra cứu xong -> chưa có mẫu số, FE hiện thanh vô định");
  assert.equal(st.daCoSan, 0);
  assert.equal(st.dongBoXong, 0);
  assert.equal(st.loi, 0);
  assert.equal(st.maHoSoDangLam, "");
  assert.equal(st.error, undefined);
  giu.resolve();
});

test("CÔ LẬP THEO CÔNG TY: lượt của công ty này không lộ sang công ty khác", async () => {
  const giu = deferred();
  const cua_A = batDauDongBoRun("cty-A", async () => giu.promise);

  assert.equal(docTienDoDongBo("cty-A"), cua_A);
  assert.equal(docTienDoDongBo("cty-B"), null, "công ty khác KHÔNG được thấy lượt của A");

  giu.resolve();
  await tick();
});

test("work gắn code khi phiên chết hẳn -> FE đọc được để bỏ khóa", async () => {
  const st = batDauDongBoRun("cty-code", async (s) => {
    s.code = "DVC_AUTO_LOGIN_FAILED";
    throw new Error("vừa thử tự đăng nhập lại và không thành công");
  });

  await tick();

  assert.equal(st.active, false);
  assert.equal(st.code, "DVC_AUTO_LOGIN_FAILED");
  assert.equal(st.error, "vừa thử tự đăng nhập lại và không thành công");
});

test("bấm lại giữa chừng -> lượt mới thay lượt cũ trên cùng công ty", async () => {
  const cu = deferred();
  const moi = deferred();
  batDauDongBoRun("cty-thay", async () => cu.promise);
  const luotMoi = batDauDongBoRun("cty-thay", async () => moi.promise);

  assert.equal(docTienDoDongBo("cty-thay"), luotMoi);

  cu.resolve();
  await tick();
  assert.equal(luotMoi.active, true, "lượt cũ đóng muộn không được đóng lượt mới");

  moi.resolve();
  await tick();
  assert.equal(luotMoi.active, false);
});

test("chưa từng chạy -> docTienDoDongBo trả null", () => {
  assert.equal(docTienDoDongBo("cty-chua-chay"), null);
});

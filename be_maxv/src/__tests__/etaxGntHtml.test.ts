import { test } from "node:test";
import assert from "node:assert/strict";
import { bocDseState } from "../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml";

const HTML_MAU = `
<form name="dsForm" method="post" action="/etaxnnt/Request">
  <input type="hidden" name="dse_sessionId" value="jEZhKJuTYtSk8eEa1CbVjEa">
  <input type="hidden" name="dse_processorId" value="DXFNHBFHBXEIHKEQIPDTJPDCCZDTAOHJIPAQBGIV">
  <input type="hidden" name="dse_processorState" value="viewQueryPage">
  <input type="hidden" name="dse_pageId" value="22">
</form>`;

test("bocDseState đọc đủ 4 field từ input ẩn", () => {
  const state = bocDseState(HTML_MAU);
  assert.deepEqual(state, {
    sessionId: "jEZhKJuTYtSk8eEa1CbVjEa",
    processorId: "DXFNHBFHBXEIHKEQIPDTJPDCCZDTAOHJIPAQBGIV",
    processorState: "viewQueryPage",
    pageId: "22",
  });
});

test("bocDseState trả null khi thiếu field bắt buộc (dse_processorId)", () => {
  const html = HTML_MAU.replace(/dse_processorId[\s\S]*?>/, "");
  assert.equal(bocDseState(html), null);
});

test("bocDseState không quan tâm thứ tự field trong HTML", () => {
  const daoThuTu = `
    <input type="hidden" name="dse_pageId" value="4">
    <input type="hidden" name="dse_processorState" value="initial">
    <input type="hidden" name="dse_processorId" value="ABC">
    <input type="hidden" name="dse_sessionId" value="XYZ">
  `;
  assert.deepEqual(bocDseState(daoThuTu), {
    sessionId: "XYZ",
    processorId: "ABC",
    processorState: "initial",
    pageId: "4",
  });
});

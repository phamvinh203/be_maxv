import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bocDseState,
  bocVeSsoTicketUrl,
  bocDanhSachCtuId,
} from "../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml";

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

const VE_MAU =
  "https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=ABC123&module=330410";

test("bocVeSsoTicketUrl đọc được khi response là JSON {url}", () => {
  assert.equal(bocVeSsoTicketUrl(JSON.stringify({ url: VE_MAU })), VE_MAU);
});

test("bocVeSsoTicketUrl đọc được khi response là JSON {redirectUrl}", () => {
  assert.equal(bocVeSsoTicketUrl(JSON.stringify({ redirectUrl: VE_MAU })), VE_MAU);
});

test("bocVeSsoTicketUrl đọc được khi response là text thô (chỉ mỗi URL)", () => {
  assert.equal(bocVeSsoTicketUrl(`  ${VE_MAU}  `), VE_MAU);
});

test("bocVeSsoTicketUrl đọc được khi URL nằm giữa văn bản/markup khác", () => {
  assert.equal(bocVeSsoTicketUrl(`<script>location.href="${VE_MAU}";</script>`), VE_MAU);
});

test("bocVeSsoTicketUrl trả null khi không tìm thấy URL thuedientu nào", () => {
  assert.equal(bocVeSsoTicketUrl(JSON.stringify({ status: "error" })), null);
});

const BANG_MAU = `
<table><tbody>
<tr><td>1</td><td>REF-001</td>
  <td><a onclick="taiGnt(this); return false;" data-id="47504589">Tải file</a></td></tr>
<tr><td>2</td><td>REF-002</td>
  <td><a onclick="taiGnt(this); return false;" data-id="47504590">Tải file</a></td></tr>
</tbody></table>`;

test("bocDanhSachCtuId đọc đúng thứ tự các data-id trong bảng", () => {
  assert.deepEqual(bocDanhSachCtuId(BANG_MAU), ["47504589", "47504590"]);
});

test("bocDanhSachCtuId trả mảng rỗng khi không có dòng nào", () => {
  assert.deepEqual(bocDanhSachCtuId("<table><tbody></tbody></table>"), []);
});

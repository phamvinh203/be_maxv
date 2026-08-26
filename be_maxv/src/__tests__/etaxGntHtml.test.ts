import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bocDseState,
  bocVeSsoTicketUrl,
  bocDanhSachCtuId,
  bocTatCaInputAn,
  laTrangCanESigner,
} from "../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml";

const HTML_MAU = `
<form name="dsForm" method="post" action="/etaxnnt/Request">
  <input type="hidden" name="dse_sessionId" value="jEZhKJuTYtSk8eEa1CbVjEa">
  <input type="hidden" name="dse_processorId" value="DXFNHBFHBXEIHKEQIPDTJPDCCZDTAOHJIPAQBGIV">
  <input type="hidden" name="dse_processorState" value="viewQueryPage">
  <input type="hidden" name="dse_pageId" value="22">
  <input type="hidden" name="dse_operationName" value="corpQueryTaxProc">
  <input type="hidden" name="dse_nextEventName" value="query">
</form>`;

test("bocDseState đọc đủ 6 field từ input ẩn", () => {
  const state = bocDseState(HTML_MAU);
  assert.deepEqual(state, {
    sessionId: "jEZhKJuTYtSk8eEa1CbVjEa",
    processorId: "DXFNHBFHBXEIHKEQIPDTJPDCCZDTAOHJIPAQBGIV",
    processorState: "viewQueryPage",
    pageId: "22",
    operationName: "corpQueryTaxProc",
    nextEventName: "query",
  });
});

test("bocDseState đọc được với processorId rỗng khi trang ở trạng thái initial (chưa có input đó)", () => {
  // Xác nhận sống 2026-08-25: trang "initial" (chưa xử lý qua operation nào) không có input
  // dse_processorId — KHÔNG phải markup hỏng, xem docblock bocDseState.
  const html = HTML_MAU.replace(
    /<input type="hidden" name="dse_processorId" value="[^"]*">\s*/,
    "",
  );
  assert.deepEqual(bocDseState(html), {
    sessionId: "jEZhKJuTYtSk8eEa1CbVjEa",
    processorId: "",
    processorState: "viewQueryPage",
    pageId: "22",
    operationName: "corpQueryTaxProc",
    nextEventName: "query",
  });
});

test("bocDseState đọc được với operationName/nextEventName rỗng khi trang không khai (thiếu input đó)", () => {
  const html = HTML_MAU.replace(
    /<input type="hidden" name="dse_operationName" value="[^"]*">\s*<input type="hidden" name="dse_nextEventName" value="[^"]*">\s*/,
    "",
  );
  assert.deepEqual(bocDseState(html), {
    sessionId: "jEZhKJuTYtSk8eEa1CbVjEa",
    processorId: "DXFNHBFHBXEIHKEQIPDTJPDCCZDTAOHJIPAQBGIV",
    processorState: "viewQueryPage",
    pageId: "22",
    operationName: "",
    nextEventName: "",
  });
});

test("bocDseState trả null khi thiếu field bắt buộc (dse_sessionId)", () => {
  const html = HTML_MAU.replace(/dse_sessionId[\s\S]*?>/, "");
  assert.equal(bocDseState(html), null);
});

test("bocDseState không quan tâm thứ tự field trong HTML", () => {
  const daoThuTu = `
    <input type="hidden" name="dse_pageId" value="4">
    <input type="hidden" name="dse_processorState" value="initial">
    <input type="hidden" name="dse_processorId" value="ABC">
    <input type="hidden" name="dse_sessionId" value="XYZ">
    <input type="hidden" name="dse_nextEventName" value="startSSO_TTHC">
    <input type="hidden" name="dse_operationName" value="corpUserLoginProc">
  `;
  assert.deepEqual(bocDseState(daoThuTu), {
    sessionId: "XYZ",
    processorId: "ABC",
    processorState: "initial",
    pageId: "4",
    operationName: "corpUserLoginProc",
    nextEventName: "startSSO_TTHC",
  });
});

test("bocTatCaInputAn đọc mọi input ẩn, kể cả field lạ (vd toOpName) ngoài 6 field dse_* đã biết tên", () => {
  const html = `
    <form>
      <input type="hidden" name="dse_operationName" value="corpUserLoginProc">
      <input type="hidden" name="dse_nextEventName" value="startSSO_TTHC">
      <input type="hidden" name="toOpName" value="ssoTTHC">
      <input type="hidden" name="module" value="330410">
      <input type="text" name="khongPhaiAn" value="bo_qua_cai_nay">
    </form>`;
  assert.deepEqual(bocTatCaInputAn(html), {
    dse_operationName: "corpUserLoginProc",
    dse_nextEventName: "startSSO_TTHC",
    toOpName: "ssoTTHC",
    module: "330410",
  });
});

test("bocTatCaInputAn trả object rỗng khi không có input ẩn nào", () => {
  assert.deepEqual(bocTatCaInputAn("<form><input type=\"text\" name=\"a\" value=\"b\"></form>"), {});
});

test("laTrangCanESigner nhận diện đúng trang cảnh báo thiếu eSigner (xác nhận sống 2026-08-25)", () => {
  const html = `<p style="margin-top:10px;">Hiện tại máy tính của bạn chưa được cài đặt đầy
			đủ các công cụ để có thể thực hiện ký điện tử</p>`;
  assert.equal(laTrangCanESigner(html), true);
});

test("laTrangCanESigner trả false với trang bình thường", () => {
  assert.equal(laTrangCanESigner("<html><body>Kết quả tra cứu</body></html>"), false);
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

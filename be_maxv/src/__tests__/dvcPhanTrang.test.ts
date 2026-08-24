import { test } from "node:test";
import assert from "node:assert/strict";
import { bocPhanTrang } from "../services/client/dich_vu_cong/hoSoHtml";

/**
 * Test bóc khối PHÂN TRANG của trang tra cứu hồ sơ DVC.
 *
 * Markup dưới đây chép từ response THẬT của cổng (đã rút gọn phần bảng) — cổng chia 2 trang × 10
 * trên tổng 16 bản ghi, mà code cũ chỉ đọc trang 1 và báo "xong" nên âm thầm mất 6 hồ sơ.
 *
 *   npx tsx --test src/__tests__/dvcPhanTrang.test.ts
 */

const HTML_THAT = `<div> <div id="table-container"> <section class="main-section mt-5 mb-4">
 <div class="d-flex align-items-center gap-2"><span class="fw-bold"> Trang
 <input type="number" min="1" value="1" class="form-control" id="gotoPageInput"
 style="width: 60px; display: inline-block;" onchange="goToPage()" max="2"/>
 /<span id="totalPage">2</span> - Tổng số bản ghi: <span>16</span> </span></div>
 <nav aria-label="Page navigation example"> <ul class="pagination mb-0">
 <li class="page-item active"><a class="page-link" onclick="onChangePage(1,10)">1</a> </li>
 <li class="page-item"><a class="page-link" onclick="onChangePage(2,10)">2</a> </li>
 <li class="page-item"><a class="page-link" onclick="onChangePage(2,10)">»</a> </li>
 </ul> </nav> <table><thead><tr><th>STT</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
 </section></div></div>`;

test("bocPhanTrang: lấy đúng tổng số bản ghi và tổng số trang từ HTML thật", () => {
  assert.deepEqual(bocPhanTrang(HTML_THAT), { tongSoBanGhi: 16, tongSoTrang: 2 });
});

test("bocPhanTrang: chỉ một trang -> totalPage=1", () => {
  const html = `<span id="totalPage">1</span> - Tổng số bản ghi: <span>7</span>`;
  assert.deepEqual(bocPhanTrang(html), { tongSoBanGhi: 7, tongSoTrang: 1 });
});

test("bocPhanTrang: số có dấu phân cách nghìn vẫn đọc được", () => {
  const html = `<span id="totalPage">13</span> - Tổng số bản ghi: <span>1.234</span>`;
  assert.deepEqual(bocPhanTrang(html), { tongSoBanGhi: 1234, tongSoTrang: 13 });
});

test("bocPhanTrang: không có khối phân trang -> null, KHÔNG ném", () => {
  // Cổng bỏ khối này khi không có hồ sơ nào. `null` = "không biết", khác 0 = "biết là rỗng":
  // caller phải phân biệt được để không báo thiếu dữ liệu oan.
  assert.deepEqual(bocPhanTrang("<table><tbody></tbody></table>"), {
    tongSoBanGhi: null,
    tongSoTrang: null,
  });
});

test("bocPhanTrang: markup đổi một nửa -> phần đọc được vẫn trả, phần kia null", () => {
  assert.deepEqual(bocPhanTrang(`<span id="totalPage">3</span>`), {
    tongSoBanGhi: null,
    tongSoTrang: 3,
  });
});

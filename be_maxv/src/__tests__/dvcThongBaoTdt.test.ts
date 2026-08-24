import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseThongBaoTdt,
  parseDanhSachThongBao,
} from "../services/client/dich_vu_cong/hoSoHtml";

/**
 * Test bóc "Danh sách thông báo" của trang chi tiết nguồn ETAX.
 *
 * Khác hẳn nguồn Dịch vụ công về CẤU TRÚC, không phải về markup: DVC có modal liệt kê từng thông
 * báo (tiêu đề + ngày + `idTbao` riêng), còn ETAX chỉ có MỘT link tải cả gói, `data-id` chính là
 * mã hồ sơ. Nên phải hai bộ bóc, không phải một biểu thức nới rộng.
 *
 *   npx tsx --test src/__tests__/dvcThongBaoTdt.test.ts
 */

// Markup THẬT, chép từ trang chi tiết `?loai=ETAX`.
const HTML_TDT = `<div class="row mb-3 align-items-start"> <div class="col-md-2">
 <label class="col-form-label-sm fw-bold" style="min-width: 160px;">Danh sách thông báo</label>
 </div> <div class="col-md-4"> <input id="csrfToken" value="abc" type="hidden"/>
 <a class="link-opacity-50-hover px-4 bi bi-download" href="#"
 onclick="downloadThongBao(this); return false;" data-id="11320250320068493"
 data-loaitracuu="ETAX" data-is-thue-dien-tu="true">Tải xuống</a> </div> </div>`;

test("bóc được MỘT mục, idTbao chính là mã hồ sơ", () => {
  const ds = parseThongBaoTdt(HTML_TDT);
  assert.equal(ds.length, 1);
  assert.equal(ds[0]!.idTbao, "tdt:11320250320068493");
});

test("mục đó nói rõ là GÓI, và không bịa ngày gửi", () => {
  const ds = parseThongBaoTdt(HTML_TDT);
  // Cổng không cho tiêu đề/ngày riêng cho từng thông báo -> để trống ngày còn hơn bịa một giá trị.
  assert.match(ds[0]!.tieuDe, /gói|toàn bộ/i);
  assert.equal(ds[0]!.ngayGui, "");
});

test("trang không có link tải -> NÉM, không trả rỗng", () => {
  // Mọi trang chi tiết ETAX đều có đúng một link tải. Rỗng nghĩa là regex hỏng, không phải "hồ sơ
  // này không có thông báo" — trả rỗng là bật `da_dong_bo=true` rồi mất gói ZIP vĩnh viễn.
  assert.throws(() => parseThongBaoTdt("<div>Không có thông báo</div>"), /không bóc được|Không bóc được/i);
});

test("KHÔNG nhận nhầm markup của nguồn Dịch vụ công", () => {
  // Khối kiểu DVC: có `downloadThongBao` nhưng `data-id` nằm trong modal liệt kê từng thông báo.
  const htmlDvc =
    `<div class="fw-bold">V/v: Tiếp nhận</div> <div>06:58 29/07/2026</div>` +
    `<a onclick="downloadThongBao(this); return false;" data-id="10820260060111618">Tải</a>`;
  assert.throws(() => parseThongBaoTdt(htmlDvc));
  // ...và bộ bóc DVC vẫn đọc được nó như trước.
  assert.equal(parseDanhSachThongBao(htmlDvc).length, 1);
});

test("khoá cache có tiền tố tdt: — không đụng không gian idTbao của Dịch vụ công", () => {
  // `data-id` ETAX chính là mã hồ sơ; cả hai nguồn đều sinh chuỗi 17 chữ số nên dùng chung khoá
  // `dvc_tai_lieu(loai, khoa)` là có ngày đè nhau, im lặng và không cứu được.
  const ds = parseThongBaoTdt(HTML_TDT);
  assert.equal(ds[0]!.idTbao, "tdt:11320250320068493");
  assert.ok(!/^\d/.test(ds[0]!.idTbao));
});

# Tích hợp "Giấy nộp tiền" (eTax GNT) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho tab "Giấy nộp tiền" (hdđt_maxv, module Dịch vụ công) hoạt động thật: đồng bộ dữ liệu
từ cổng `thuedientu.gdt.gov.vn` (eTax GNT, module `330410`) về DB tenant, tìm kiếm/tải PDF đọc
thẳng dữ liệu đã đồng bộ — cùng khuôn UX với tab "Tờ khai" đã có.

**Architecture:** Backend thêm một client mới cho domain `thuedientu.gdt.gov.vn` (SSO ăn theo phiên
DVC đã đăng nhập, rồi pipeline 4 bước `dse_*` kiểu Struts cũ), một bảng DB mới
(`dvc_giay_nop_tien`), và một service đồng bộ mới TÁI DÙNG hạ tầng lượt-chạy-nền
(`batDauDongBoRun`/`khoDongBoRun`) đã có ở `dvc-dong-bo.service.ts` — một công ty chỉ chạy một lượt
"Đồng bộ" tại một thời điểm, bất kể đang đồng bộ Tờ khai hay GNT. Frontend gỡ khóa mục "Giấy nộp
tiền" trong dropdown loại giấy tờ và thêm nhánh gọi API mới cho tab này.

**Mọi file MỚI (không phải sửa file có sẵn) đều nằm trong một thư mục con `giay_nop_tien/`** ở đúng
tầng tương ứng (services/controllers/routes bên `be_maxv`, features bên `hdđt_maxv`) — tách hẳn
khỏi các file `dvc-*`/`gdt-dvc.*` hiện có đang phục vụ tab "Tờ khai", cho dễ đọc/dễ xóa nếu sau này
cần gỡ tính năng mà không đụng phần tờ khai. File CÓ SẴN chỉ thêm vài dòng (export thêm hàm, thêm
route, thêm field) vẫn ở nguyên vị trí cũ.

**Tech Stack:** Fastify + Prisma (tenant DB) + `node:test` (be_maxv); React 19 + TanStack Query +
MUI v7 (hdđt_maxv). Không thêm thư viện mới — dùng `fetch` thuần + regex parse HTML, cùng quy ước
`hoSoHtml.ts`/`gdt-dvc.service.ts` hiện có.

**Spec:** [docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md](../specs/2026-08-25-dvc-giay-nop-tien-etax-design.md)

## Global Constraints

- KHÔNG dùng thư viện parse HTML (cheerio/jsdom) — regex thuần, cùng lý do `hoSoHtml.ts`.
- Mọi call cổng đi qua `pacerSchedule` (module `../hddt/gdtPacer`) — làn RIÊNG `"etax-gnt"` cho
  domain `thuedientu.gdt.gov.vn`, tách khỏi làn `"dvc"` đang dùng cho `dichvucong.gdt.gov.vn`.
- Test backend bằng `node:test`: `npx tsx --test src/__tests__/<file>.test.ts` (chạy từ `be_maxv/`).
- Không cần captcha cho pipeline GNT (xem spec mục 2.3) — nếu xác minh sống phát hiện captcha thì
  quay lại dùng `docDvcCaptcha` (OCR sẵn có ở `captcha-ocr.ts`), KHÔNG nằm trong phạm vi plan này.
- FE: không có unit test cho component — bar chấp nhận là `npm run build` + `npm run lint` sạch
  (đúng quy ước module Kế toán/HRM trước đó trong `hdđt_maxv`).
- MST thử nghiệm sống: `0106200129` (đã xác nhận có dữ liệu GNT thật, xem spec mục 5).
- Mọi file MỚI đặt trong thư mục con `giay_nop_tien/` (xem Architecture) — file SỬA giữ nguyên vị trí.
- **KHÔNG tự `git add`/`git commit` bất kỳ lúc nào.** Làm xong một task (test/build đã pass) thì
  DỪNG LẠI, báo rõ đã xong task nào và những file nào đã đổi, rồi CHỜ người dùng tự xem diff và
  commit. Chỉ bắt đầu task tiếp theo sau khi người dùng xác nhận đã commit xong (hoặc bảo tiếp tục).

---

## Tổng quan file sẽ đụng tới

**Backend — file MỚI (tất cả trong thư mục con `giay_nop_tien/`):**
- `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml.ts` — parse THUẦN (dse state, vé SSO, ctuId).
- `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service.ts` — client I/O cho thuedientu.gdt.gov.vn.
- `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service.ts` — đồng bộ + đọc/ghi DB.
- `be_maxv/src/controllers/client/dich_vu_cong/giay_nop_tien/gnt.controller.ts` — 2 handler (tra cứu, tải file).
- `be_maxv/src/routes/dich_vu_cong/giay_nop_tien/gnt.route.ts` — 2 route, đăng ký qua sub-plugin.
- `be_maxv/src/__tests__/etaxGntHtml.test.ts` (test file giữ FLAT trong `__tests__/`, đúng quy ước
  hiện có — repo không chia thư mục con trong `__tests__/`).
- `be_maxv/src/__tests__/fixtures/giay_nop_tien/*` — fixture response thật (Task 1).

**Backend — file SỬA (giữ nguyên vị trí):**
- `be_maxv/prisma/tenant/schema.prisma` — thêm model `dvc_giay_nop_tien`.
- `be_maxv/src/services/client/dich_vu_cong/gdt-dvc.service.ts` — thêm hàm `xinVeSsoDichVuKhac`.
- `be_maxv/src/controllers/client/dich_vu_cong/gdt-dvc.controller.ts` — export thêm 4 helper nội bộ,
  `dongBo` đọc thêm `body.loai`.
- `be_maxv/src/routes/dich_vu_cong/gdt-dvc.route.ts` — đăng ký sub-plugin `giay_nop_tien/gnt.route.ts`.

**Frontend — file MỚI (tất cả trong thư mục con `giay_nop_tien/`):**
- `hdđt_maxv/src/features/dich_vu_cong/giay_nop_tien/api.ts` — API tra cứu + tải file GNT.
- `hdđt_maxv/src/features/dich_vu_cong/giay_nop_tien/taiFileGiayNopTien.ts` — helper tải PDF về máy.

**Frontend — file SỬA (giữ nguyên vị trí):**
- `hdđt_maxv/src/features/dich_vu_cong/config.ts` — thêm `khoaMaGiaoDich` cho `TabDvc`.
- `hdđt_maxv/src/features/dich_vu_cong/components/BangHoSo.tsx` — nhận `khoaMaGiaoDich` qua props.
- `hdđt_maxv/src/features/dich_vu_cong/components/DialogDongBo.tsx` — gỡ khóa GNT, gửi `loai`.
- `hdđt_maxv/src/features/dich_vu_cong/api/dvc.ts` — thêm `loai` vào `DvcDongBoParams`, export
  `qsBoQuaRong` để `giay_nop_tien/api.ts` dùng lại.
- `hdđt_maxv/src/pages/dich_vu_cong/DvcPage.tsx` — dispatch theo tab.

---

## Task 1: Bắt fixture thật từ cổng (BẮT BUỘC làm trước Task 4 trở đi)

Đây KHÔNG phải bước code — là bước lấy bằng chứng sống để các task sau viết đúng, thay vì đoán mù
(xem mục 7 của spec). Người thực hiện task này cần quyền truy cập cổng thật (tài khoản MST
0106200129 hoặc tương đương).

**Files:**
- Create: `be_maxv/src/__tests__/fixtures/giay_nop_tien/sso-redirect-to-service.txt` (response thô của bước A)
- Create: `be_maxv/src/__tests__/fixtures/giay_nop_tien/landing-after-sso.html` (response thô của bước D, hoặc
  trang cuối cùng chuỗi redirect dừng lại)
- Create: `be_maxv/src/__tests__/fixtures/giay_nop_tien/query-result.html` (response thô của bước F — "query")
- Create: `be_maxv/src/__tests__/fixtures/giay_nop_tien/download-response-headers.txt` (headers của bước H —
  đặc biệt `Content-Type`/`Content-Disposition`)

- [ ] **Bước 1:** Mở DevTools → Network, thực hiện lại đúng luồng: `dichvucong.gdt.gov.vn/tthc/dich-vu-khac`
  → bấm "Tra cứu GNT" → chờ bảng kết quả hiện ra → bấm "Tải file" một dòng bất kỳ.

- [ ] **Bước 2:** Tìm request `POST /tthc/sso/redirect-to-service?module=330410`. Tab Response →
  copy NGUYÊN VĂN nội dung → lưu vào `sso-redirect-to-service.txt`.

- [ ] **Bước 3:** Tìm request cuối cùng trước khi bảng "Tra cứu GNT" hiện lên có nội dung HTML (là
  trang mang sẵn form + `dse_sessionId` mới, tương ứng bước D hoặc ngay sau nó). Tab Response → copy
  → lưu vào `landing-after-sso.html`.

- [ ] **Bước 4:** Tìm request `dse_nextEventName=query` (POST `/etaxnnt/Request`). Tab Response →
  copy nguyên văn HTML → lưu vào `query-result.html`. Mở file này, tìm bằng mắt xem cột "Tải file"
  của mỗi dòng có `data-id`/`onclick`/`href` nào mang một số dài (id chứng từ) hay không — ghi chú
  lại pattern thật (sẽ dùng ở Task 3).

- [ ] **Bước 5:** Tìm request `dse_nextEventName=download`. Tab Headers → copy `Content-Type` +
  `Content-Disposition` (nếu có) → lưu vào `download-response-headers.txt`.

- [ ] **Bước 6:** Đối chiếu nhanh với các giả định ở mục 7 spec — ghi 1 dòng ghi chú ở đầu mỗi file
  fixture nếu thực tế khác với giả định (vd "response bước A là JSON, field `url`" hoặc "response
  bước A là text thô, chỉ chứa mỗi URL"). Task 3 sẽ đọc đúng các ghi chú này.

- [ ] **Bước 7: DỪNG LẠI.** Fixture KHÔNG chứa bí mật — cookie/token trong đó đã hết hạn ngay khi
  lưu, nhưng vẫn lướt qua bằng mắt trước khi báo xong để chắc chắn không dính số CCCD/thông tin
  nhạy cảm ngoài dữ liệu nghiệp vụ GNT test. Báo đã xong Task 1 (4 file fixture), chờ người dùng tự
  `git add`/`git commit` rồi mới sang Task 2.

---

## Task 2: `giay_nop_tien/etaxGntHtml.ts` — bóc trạng thái `dse_*` từ HTML

**Files:**
- Create: `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml.ts`
- Test: `be_maxv/src/__tests__/etaxGntHtml.test.ts`

**Interfaces:**
- Produces: `DseState { sessionId: string; processorId: string; processorState: string; pageId: string }`,
  `bocDseState(html: string): DseState | null`, `class EtaxGntKhongBocDuocDseStateError extends Error`

- [ ] **Bước 1: Viết test thất bại** — form ẩn kiểu Struts DSE luôn có dạng
  `<input type="hidden" name="dse_sessionId" value="...">` lặp lại cho từng field; viết fixture tay
  (KHÔNG cần chờ Task 1, đây là hình dạng framework chuẩn, không phụ thuộc nội dung nghiệp vụ):

```typescript
// be_maxv/src/__tests__/etaxGntHtml.test.ts
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
```

- [ ] **Bước 2: Chạy test, xác nhận lỗi** (module chưa tồn tại):

```bash
cd be_maxv && npx tsx --test src/__tests__/etaxGntHtml.test.ts
```
Expected: FAIL — `Cannot find module '../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml'`

- [ ] **Bước 3: Viết implementation tối thiểu**

```typescript
// be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml.ts
/**
 * Diễn giải RESPONSE của cổng eTax GNT (thuedientu.gdt.gov.vn/etaxnnt) — framework DSE (Struts cũ)
 * đóng gói trạng thái pipeline vào 4 input ẩn của mỗi trang trả về, thay vì cookie/CSRF token đơn
 * lẻ như `dichvucong.gdt.gov.vn`. Xem spec mục 2.3 (docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md).
 *
 * Cùng lý do KHÔNG dùng cheerio/jsdom như `hoSoHtml.ts`: chỉ cần bóc vài input ẩn cụ thể.
 */

/** Trạng thái pipeline DSE của MỘT trang trả về — phải mang nguyên vẹn sang request kế tiếp, xem
 * `gdt-etax-gnt.service.ts`. */
export interface DseState {
  sessionId: string;
  processorId: string;
  processorState: string;
  pageId: string;
}

export class EtaxGntKhongBocDuocDseStateError extends Error {
  constructor() {
    super("Không bóc được trạng thái dse_* từ response của cổng eTax GNT (cổng đổi markup?).");
    this.name = "EtaxGntKhongBocDuocDseStateError";
  }
}

/** Một input ẩn `dse_<tenField>` — bắt giá trị bất kể thứ tự thuộc tính `name=`/`value=` trong thẻ. */
function hiddenInput(html: string, tenField: string): string | null {
  const re = new RegExp(
    `<input[^>]*name="dse_${tenField}"[^>]*value="([^"]*)"|` +
      `<input[^>]*value="([^"]*)"[^>]*name="dse_${tenField}"`,
    "i",
  );
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? "") : null;
}

/** Bóc 4 input ẩn `dse_sessionId`/`dse_processorId`/`dse_processorState`/`dse_pageId` — `null` nếu
 * THIẾU BẤT KỲ field nào (trang không phải một bước pipeline hợp lệ, hoặc cổng đổi markup). */
export function bocDseState(html: string): DseState | null {
  const sessionId = hiddenInput(html, "sessionId");
  const processorId = hiddenInput(html, "processorId");
  const processorState = hiddenInput(html, "processorState");
  const pageId = hiddenInput(html, "pageId");
  if (sessionId === null || processorId === null || processorState === null || pageId === null) {
    return null;
  }
  return { sessionId, processorId, processorState, pageId };
}
```

- [ ] **Bước 4: Chạy test, xác nhận qua**

```bash
cd be_maxv && npx tsx --test src/__tests__/etaxGntHtml.test.ts
```
Expected: PASS — cả 3 test.

- [ ] **Bước 5: DỪNG LẠI** — báo đã xong Task 2 (`etaxGntHtml.ts` + test, 3/3 test pass), chờ
  người dùng tự `git add`/`git commit` rồi mới sang Task 3.

---

## Task 3: `giay_nop_tien/etaxGntHtml.ts` — bóc vé SSO + ctuId (dùng fixture Task 1)

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml.ts`
- Modify: `be_maxv/src/__tests__/etaxGntHtml.test.ts`

**Interfaces:**
- Consumes: fixture `be_maxv/src/__tests__/fixtures/giay_nop_tien/sso-redirect-to-service.txt`,
  `be_maxv/src/__tests__/fixtures/giay_nop_tien/query-result.html` (Task 1)
- Produces: `bocVeSsoTicketUrl(body: string): string | null`, `bocDanhSachCtuId(html: string): string[]`

- [ ] **Bước 1: Đọc fixture Task 1, mở đầu bằng ghi chú thật ở đó.** Nếu fixture ghi "response là
  JSON field `url`", viết test theo hình dạng ĐÓ. Nếu chưa có fixture (task 1 chưa chạy), viết test
  theo BA hình dạng khả dĩ (JSON `{url: "..."}`, text thô là chính URL, URL nằm giữa văn bản khác) —
  cả ba đều hợp lệ để implementation xử lý phòng hờ, và test sẽ được RÚT GỌN lại đúng 1 hình dạng
  ngay khi có fixture thật (đánh dấu bằng `// TODO xác nhận lại khi có fixture Task 1` KHÔNG được
  chấp nhận — viết đủ cả 3 nhánh code thật, không để trống nhánh nào):

```typescript
// Thêm vào be_maxv/src/__tests__/etaxGntHtml.test.ts
import { bocVeSsoTicketUrl, bocDanhSachCtuId } from "../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml";

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
```

- [ ] **Bước 2: Chạy test, xác nhận lỗi** (hàm chưa tồn tại).

- [ ] **Bước 3: Viết implementation**

```typescript
// Thêm vào be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml.ts

/**
 * Bóc URL vé SSO (`https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=...`) từ response
 * của `POST dichvucong.gdt.gov.vn/tthc/sso/redirect-to-service` — hình dạng response CHƯA xác nhận
 * lúc viết (xem spec mục 7.1), nên thử LẦN LƯỢT ba cách, dùng cách đầu tiên khớp:
 *   1. JSON có field `url` hoặc `redirectUrl` chứa domain thuedientu.
 *   2. Toàn bộ body (trim) CHÍNH LÀ url đó.
 *   3. URL nằm lẫn trong văn bản khác (JS/HTML) — regex quét toàn chuỗi.
 */
const VE_SSO_RE = /https:\/\/thuedientu\.gdt\.gov\.vn\/etaxnnt\/\?vnconnect=SSOTHUE[^"'\s<>]*/;

export function bocVeSsoTicketUrl(body: string): string | null {
  const trimmed = body.trim();

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    for (const field of ["url", "redirectUrl", "data"]) {
      const v = json[field];
      if (typeof v === "string" && VE_SSO_RE.test(v)) return VE_SSO_RE.exec(v)![0];
    }
  } catch {
    // Không phải JSON hợp lệ -> thử hai cách còn lại bên dưới.
  }

  if (VE_SSO_RE.test(trimmed) && trimmed === VE_SSO_RE.exec(trimmed)![0]) return trimmed;

  const m = VE_SSO_RE.exec(body);
  return m ? m[0] : null;
}

/**
 * Danh sách `ctuId` ("id chứng từ", dùng gọi bước `detail`/`download`) theo ĐÚNG thứ tự dòng của
 * bảng kết quả tra cứu GNT — bám vào `data-id="..."` của nút hành động, cùng mẫu `THONG_BAO_RE` ở
 * `hoSoHtml.ts` (cổng dùng chung quy ước gắn id ẩn kiểu này cho các nút tải file).
 *
 * `parseBangHoSo` (hoSoHtml.ts) KHÔNG giữ được giá trị này: nó strip mọi thẻ qua `htmlToText`, nên
 * phải bóc riêng từ HTML THÔ trước khi đưa qua `parseBangHoSo`. Người gọi ghép mảng này với
 * `BangHoSoDaBoc.rows` theo VỊ TRÍ (index cùng thứ tự) — xem `traCuuGnt`.
 */
const CTU_ID_RE = /data-id="(\d+)"/g;

export function bocDanhSachCtuId(html: string): string[] {
  return [...html.matchAll(CTU_ID_RE)].map((m) => m[1]!);
}
```

- [ ] **Bước 4: Chạy test, xác nhận qua.**

- [ ] **Bước 5: DỪNG LẠI** — báo đã xong Task 3 (`etaxGntHtml.ts` mở rộng + test), chờ người dùng
  tự `git add`/`git commit` rồi mới sang Task 4.

---

## Task 4: `gdt-dvc.service.ts` — xin vé SSO bằng phiên DVC đã đăng nhập

**Files:**
- Modify: `be_maxv/src/services/client/dich_vu_cong/gdt-dvc.service.ts` (file CÓ SẴN, không di chuyển
  — hàm này thuộc về "phiên DVC", đúng trách nhiệm file này đang giữ)

**Interfaces:**
- Consumes: `DvcPhien` (đã có), `requireSession`/`dvcSend` (nội bộ file, đã có)
- Produces: `xinVeSsoDichVuKhac(phien: DvcPhien, module: string): Promise<string>`

Không có bước TDD tách riêng cho task này — hàm chỉ ghép lại `requireSession`+`dvcSend` đã có sẵn
đầy đủ test gián tiếp qua các hàm khác trong file; thêm 1 test HTTP thật ở đây phải đụng cổng, không
hợp với `node:test` (không mock HTTP trong dự án này, xem cách `traCuuHoSo` cũng không có test đơn
vị riêng). Kiểm tra bằng Task 10 (chạy sống có DB).

- [ ] **Bước 1: Thêm hàm, đặt gần các hàm gọi cổng khác (sau `layTaiLieuDinhKem` chẳng hạn).** Mở
  file, tìm dòng cuối cùng có `export async function` gọi `dvcSend`, thêm hàm mới ngay sau:

```typescript
/**
 * Xin VÉ SSO để nhảy sang một dịch vụ khác của cổng thuế (vd `thuedientu.gdt.gov.vn/etaxnnt`) —
 * dùng phiên DVC ĐÃ ĐĂNG NHẬP, KHÔNG cần tài khoản/captcha riêng. Xem spec mục 2.1
 * (docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md): trang `dich-vu-khac` của
 * cổng gọi đúng endpoint này (`connectSSO`) trước khi nhúng iframe sang dịch vụ đích.
 *
 * Trả THÔ body response — hình dạng (JSON hay text) chưa xác nhận lúc viết hàm này, nên việc bóc
 * URL vé nằm ở `giay_nop_tien/etaxGntHtml.ts` (module lá, test được không cần cổng thật) thay vì
 * ở đây. Đặt tên chung "dịch vụ khác" chứ không riêng GNT: endpoint này của cổng dùng chung cho MỌI
 * mục ở trang `dich-vu-khac`, không riêng gì GNT — module khác dùng lại được hàm này thẳng.
 *
 * `module`: mã dịch vụ đích trên cổng (vd `"330410"` = Tra cứu GNT doanh nghiệp).
 */
export async function xinVeSsoDichVuKhac(phien: DvcPhien, module: string): Promise<string> {
  const session = requireSession(phien);
  const res = await dvcSend(`/sso/redirect-to-service?module=${encodeURIComponent(module)}`, session, {
    method: "POST",
    headers: { [session.csrfHeader]: session.csrfToken },
  });
  return res.text();
}
```

- [ ] **Bước 2: Kiểm tra biên dịch**

```bash
cd be_maxv && npx tsc --noEmit
```
Expected: không lỗi mới liên quan tới file này.

- [ ] **Bước 3: DỪNG LẠI** — báo đã xong Task 4 (`gdt-dvc.service.ts` +1 hàm export), chờ người
  dùng tự `git add`/`git commit` rồi mới sang Task 5.

---

## Task 5: `giay_nop_tien/gdt-etax-gnt.service.ts` — session + pipeline gọi cổng thuedientu

**Files:**
- Create: `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service.ts`

**Interfaces:**
- Consumes: `DvcService.xinVeSsoDichVuKhac` (Task 4), `bocDseState`/`bocVeSsoTicketUrl`/`bocDanhSachCtuId`
  (Task 2, 3, cùng thư mục `giay_nop_tien/`), `parseBangHoSo`/`bocPhanTrang`/`type BangHoSoDaBoc`/
  `type PhanTrangDaBoc` (`../hoSoHtml.ts`, đã có, LÙI một cấp vì file này nằm sâu hơn),
  `pacerSchedule`/`pacerReportOk`/`pacerReportRateLimited` (`../../hddt/gdtPacer`, đã có)
- Produces:
  - `interface EtaxGntSession { donViId: string; cookies: Map<string,string>; dse: DseState }`
  - `interface GntBoLoc { tuNgayLap?: string; denNgayLap?: string; maGiaoDich?: string; soGnt?: string }` (dd/MM/yyyy)
  - `ganPhienGnt(phien: DvcPhien, donViId: string): Promise<EtaxGntSession>`
  - `traCuuGnt(session: EtaxGntSession, boLoc: GntBoLoc, page: number): Promise<{ session: EtaxGntSession; bang: BangHoSoDaBoc; phanTrang: PhanTrangDaBoc; ctuIds: string[] }>`
  - `interface GntTepTaiVe { bytes: Buffer; contentType: string; fileName: string }`
  - `taiPdfGnt(session: EtaxGntSession, ctuId: string): Promise<{ session: EtaxGntSession; tep: GntTepTaiVe }>`
  - `class EtaxGntKhongLayDuocVeSsoError extends Error`
  - `class EtaxGntQuaNhieuRedirectError extends Error`

Không viết test đơn vị cho file này (mọi hàm đụng `fetch` thật) — cùng quy ước `gdt-dvc.service.ts`
(không test hàm gọi cổng, chỉ test lớp parse thuần bên dưới nó, đã làm ở Task 2/3). Kiểm tra bằng
chạy sống ở Task 10.

- [ ] **Bước 1: Viết file** — LƯU Ý đường dẫn import lùi thêm MỘT cấp `../` so với các file cũ, vì
  file này nằm trong `giay_nop_tien/` (con của `dich_vu_cong/`):

```typescript
// be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service.ts
import { describeErrorChain } from "../../../../config/gdt-client";
import {
  schedule as pacerSchedule,
  reportOk as pacerReportOk,
  reportRateLimited as pacerReportRateLimited,
} from "../../hddt/gdtPacer";
import type { DvcPhien } from "../gdt-dvc.service";
import * as DvcService from "../gdt-dvc.service";
import { parseBangHoSo, bocPhanTrang, type BangHoSoDaBoc, type PhanTrangDaBoc } from "../hoSoHtml";
import { bocDseState, bocVeSsoTicketUrl, bocDanhSachCtuId, type DseState } from "./etaxGntHtml";

/**
 * Client cho cổng eTax GNT cũ (`thuedientu.gdt.gov.vn/etaxnnt`) — framework DSE (Struts), KHÁC hẳn
 * `dichvucong.gdt.gov.vn` (HTMX) mà `gdt-dvc.service.ts` đang nói chuyện. Xem spec:
 * docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md.
 *
 * Không cần đăng nhập/captcha riêng: `ganPhienGnt` ăn theo phiên DVC đã đăng nhập qua vé SSO
 * (`DvcService.xinVeSsoDichVuKhac`).
 */

const GNT_ORIGIN = "https://thuedientu.gdt.gov.vn";
const GNT_TIMEOUT_MS = 30_000;
const MAX_SSO_REDIRECTS = 5;
/** module `330410` = "Tra cứu GNT" (doanh nghiệp) — CHỈ module này nằm trong phạm vi, xem spec mục 6. */
const GNT_MODULE = "330410";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

export class EtaxGntKhongLayDuocVeSsoError extends Error {
  constructor() {
    super("Không lấy được vé SSO sang cổng eTax GNT — cổng đổi hình dạng response?");
    this.name = "EtaxGntKhongLayDuocVeSsoError";
  }
}

export class EtaxGntQuaNhieuRedirectError extends Error {
  constructor() {
    super(`Chuỗi điều hướng SSO vượt quá ${MAX_SSO_REDIRECTS} bước — có thể cổng đã đổi luồng.`);
    this.name = "EtaxGntQuaNhieuRedirectError";
  }
}

export interface EtaxGntSession {
  /** Công ty sở hữu — dùng làm khóa pacer, cùng quy ước `DvcSession.donViId`. */
  donViId: string;
  cookies: Map<string, string>;
  dse: DseState;
}

export interface GntBoLoc {
  /** `dd/MM/yyyy` — form gốc cổng dùng định dạng này (xem spec mục 2.3), KHÔNG phải `yyyy-mm-dd`. */
  tuNgayLap?: string;
  denNgayLap?: string;
  maGiaoDich?: string;
  soGnt?: string;
}

function gntCookieHeader(session: EtaxGntSession): string {
  return [...session.cookies.values()].join("; ");
}

function gntMergeSetCookie(session: EtaxGntSession, response: Response) {
  const setCookie =
    (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const pair = raw.split(";")[0]?.trim();
    if (!pair) continue;
    const name = pair.split("=")[0];
    if (name) session.cookies.set(name, pair);
  }
}

/** Gửi 1 request thô qua pacer làn RIÊNG `"etax-gnt"` (tách khỏi làn `"dvc"` — khác server vật lý,
 * xem Global Constraints). KHÔNG tự theo redirect — dùng `gntSendTheoRedirect` cho chuỗi SSO. */
async function gntSend(url: string, session: EtaxGntSession, init: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const cookies = gntCookieHeader(session);
  if (cookies) headers.Cookie = cookies;

  let response: Response;
  try {
    response = await pacerSchedule(session.donViId, "etax-gnt", () =>
      fetch(url, {
        ...init,
        headers,
        redirect: "manual",
        signal: init.signal ?? AbortSignal.timeout(GNT_TIMEOUT_MS),
      }),
    );
  } catch (err) {
    pacerReportRateLimited(session.donViId, "etax-gnt");
    console.error(`[DEBUG-GNT] ${url} NÉM LỖI TẦNG FETCH: ${describeErrorChain(err)}`);
    throw err;
  }

  gntMergeSetCookie(session, response);
  if (response.status === 429) pacerReportRateLimited(session.donViId, "etax-gnt");
  else if (response.status < 400) pacerReportOk(session.donViId, "etax-gnt");
  return response;
}

/** Đi theo chuỗi redirect (3xx + `Location`) tới khi gặp response KHÔNG phải 3xx — dùng cho chuỗi
 * vé SSO (spec mục 2.2, bước B->C->D), nơi mỗi bước là một điều hướng trình duyệt thật. */
async function gntSendTheoRedirect(url: string, session: EtaxGntSession): Promise<Response> {
  let currentUrl = url;
  for (let hop = 0; hop < MAX_SSO_REDIRECTS; hop++) {
    const res = await gntSend(currentUrl, session, { method: "GET" });
    if (res.status < 300 || res.status >= 400) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    currentUrl = new URL(loc, currentUrl).toString();
  }
  throw new EtaxGntQuaNhieuRedirectError();
}

/**
 * Dựng phiên GNT mới: xin vé SSO bằng phiên DVC đã đăng nhập (`phien`), đi theo chuỗi redirect
 * sang `thuedientu.gdt.gov.vn`, rồi bóc trạng thái `dse_*` của trang hạ cánh cuối cùng.
 *
 * KHÔNG cache qua nhiều lượt — gọi lại từ đầu mỗi lần "Đồng bộ" (xem spec mục 3.1).
 */
export async function ganPhienGnt(phien: DvcPhien, donViId: string): Promise<EtaxGntSession> {
  const veBody = await DvcService.xinVeSsoDichVuKhac(phien, GNT_MODULE);
  const ticketUrl = bocVeSsoTicketUrl(veBody);
  if (!ticketUrl) throw new EtaxGntKhongLayDuocVeSsoError();

  const session: EtaxGntSession = {
    donViId,
    cookies: new Map(),
    dse: { sessionId: "", processorId: "", processorState: "", pageId: "" },
  };
  const landing = await gntSendTheoRedirect(ticketUrl, session);
  const html = await landing.text();
  const dse = bocDseState(html);
  if (!dse) throw new EtaxGntKhongLayDuocVeSsoError();
  session.dse = dse;
  return session;
}

/** POST `/etaxnnt/Request` với các field `dse_*` của session hiện tại + field bổ sung, trả HTML thô. */
async function guiRequest(
  session: EtaxGntSession,
  extra: Record<string, string>,
): Promise<{ html: string; dse: DseState }> {
  const body = new URLSearchParams({
    dse_sessionId: session.dse.sessionId,
    dse_applicationId: "-1",
    dse_pageId: session.dse.pageId,
    dse_processorState: session.dse.processorState,
    dse_errorPage: "error_page.jsp",
    ...extra,
  });

  const res = await gntSend(`${GNT_ORIGIN}/etaxnnt/Request`, session, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const html = await res.text();
  const dse = bocDseState(html);
  if (!dse) throw new EtaxGntKhongLayDuocVeSsoError();
  return { html, dse };
}

/** Bước "Khởi tạo tra cứu" (spec mục 2.3, bước E) — MỞ operation `corpQueryTaxProc` mới, phải gọi
 * đúng MỘT lần trước lượt `traCuuGnt` đầu tiên của một phiên. */
export async function khoiTaoTraCuuGnt(session: EtaxGntSession): Promise<EtaxGntSession> {
  const { dse } = await guiRequest(session, {
    dse_operationName: "corpQueryTaxProc",
    dse_processorState: "initial",
    dse_nextEventName: "start",
  });
  return { ...session, dse };
}

/**
 * Tra cứu MỘT trang kết quả GNT (bước F). `page` là số trang cổng dùng (tham số `pn`, bắt đầu từ 1).
 *
 * `ctuIds[i]` khớp `bang.rows[i]` theo VỊ TRÍ — `bocDanhSachCtuId` đọc từ HTML THÔ (trước khi
 * `parseBangHoSo` strip thẻ), xem chú thích ở `etaxGntHtml.ts`.
 */
export async function traCuuGnt(
  session: EtaxGntSession,
  boLoc: GntBoLoc,
  page: number,
): Promise<{ session: EtaxGntSession; bang: BangHoSoDaBoc; phanTrang: PhanTrangDaBoc; ctuIds: string[] }> {
  const { html, dse } = await guiRequest(session, {
    dse_operationName: "corpQueryTaxProc",
    dse_nextEventName: "query",
    pn: String(page),
    type_tax: "01",
    ngay_lap_tu_ngay: boLoc.tuNgayLap ?? "",
    ngay_lap_den_ngay: boLoc.denNgayLap ?? "",
    ma_giao_dich: boLoc.maGiaoDich ?? "",
    so_gnt: boLoc.soGnt ?? "",
  });
  return {
    session: { ...session, dse },
    bang: parseBangHoSo(html),
    phanTrang: bocPhanTrang(html),
    ctuIds: bocDanhSachCtuId(html),
  };
}

export interface GntTepTaiVe {
  bytes: Buffer;
  contentType: string;
  fileName: string;
}

/** Tải PDF của một GNT theo `ctuId` (bước G "detail" rồi bước H "download" — spec mục 2.3/3.2: giả
 * định `download` cần đi qua `detail` trước để cổng cấp processorId mới, dựa trên bằng chứng hai
 * bước mang processorId KHÁC nhau). */
export async function taiPdfGnt(
  session: EtaxGntSession,
  ctuId: string,
): Promise<{ session: EtaxGntSession; tep: GntTepTaiVe }> {
  const chiTiet = await guiRequest(session, {
    dse_operationName: "corpQueryTaxProc",
    dse_nextEventName: "detail",
    ctuId,
    isReport: "N",
    type: "pdf",
  });

  const res = await gntSend(`${GNT_ORIGIN}/etaxnnt/Request`, { ...session, dse: chiTiet.dse }, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      dse_sessionId: chiTiet.dse.sessionId,
      dse_applicationId: "-1",
      dse_pageId: chiTiet.dse.pageId,
      dse_processorState: chiTiet.dse.processorState,
      dse_errorPage: "error_page.jsp",
      dse_operationName: "corpQueryTaxProc",
      dse_nextEventName: "download",
      ctuId,
      isReport: "N",
      type: "pdf",
    }).toString(),
  });

  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/pdf";
  const disposition = res.headers.get("content-disposition") ?? "";
  const fileNameMatch = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]!) : `gnt-${ctuId}.pdf`;

  return { session: { ...session, dse: chiTiet.dse }, tep: { bytes, contentType, fileName } };
}
```

- [ ] **Bước 2: Kiểm tra biên dịch**

```bash
cd be_maxv && npx tsc --noEmit
```
Expected: không lỗi mới liên quan tới file này — chú ý đúng số cấp `../` trong import (file nằm ở
`services/client/dich_vu_cong/giay_nop_tien/`, sâu hơn `gdt-dvc.service.ts` một cấp).

- [ ] **Bước 3: DỪNG LẠI** — báo đã xong Task 5 (`gdt-etax-gnt.service.ts`), chờ người dùng tự
  `git add`/`git commit` rồi mới sang Task 6.

---

## Task 6: Schema DB — bảng `dvc_giay_nop_tien`

**Files:**
- Modify: `be_maxv/prisma/tenant/schema.prisma`

- [ ] **Bước 1: Thêm model** (đặt cạnh `model dvc_dong_bo_log` cho gọn — cùng khu Dịch vụ công):

```prisma
/// Một Giấy nộp tiền (GNT) đã đồng bộ từ cổng eTax GNT (thuedientu.gdt.gov.vn) — xem spec
/// docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md.
model dvc_giay_nop_tien {
  /// "Số tham chiếu / Mã giao dịch" — PK, dùng làm định danh dòng cho FE (khớp cột hiển thị,
  /// xem `BangHoSo.khoaMaGiaoDich`). Giả định UNIQUE dựa trên tên cột cổng ("... / Mã giao dịch")
  /// — xác minh lại khi có dữ liệu thật, xem mục 7.3 của spec.
  so_tham_chieu String @id @db.VarChar(64)

  /// "id chứng từ" nội bộ cổng — dùng gọi bước detail/download (xem `taiPdfGnt`). KHÔNG lộ ra FE.
  ctu_id String @unique @db.VarChar(64)

  so_giay_nop_tien String? @db.VarChar(128)
  so_tien Decimal? @db.Decimal(18, 2)
  loai_tien String? @db.VarChar(8)
  trang_thai String? @db.VarChar(254)
  so_chung_tu String? @db.VarChar(128)
  ngay_lap_gnt String? @db.VarChar(32)
  /// Suy từ "Ngày lập GNT" (best-effort) CHỈ để lọc/sắp theo khoảng ngày — cột nào đúng nhất trong
  /// 4 cột ngày của GNT (lập/gửi/nộp thuế/nộp DS chi tiết) cần xác minh, xem mục 7.6 của spec.
  ngay_nop_date DateTime? @db.Date
  ngan_hang String? @db.VarChar(254)
  tai_khoan_ngan_hang String? @db.VarChar(64)

  /// PDF cache — mẫu giống `dvc_ho_so.xml_to_khai_bin`, null = chưa tải.
  file_pdf_bin Bytes?
  content_type String? @db.VarChar(128)
  ten_file String? @db.VarChar(254)

  /// Nguyên dòng cổng trả ({tiêu đề cột: giá trị}) — cổng thêm cột không cần migration.
  raw Json
  da_dong_bo Boolean @default(false)

  datetime0 DateTime @default(now())
  datetime2 DateTime @updatedAt

  @@index([ngay_nop_date])
}
```

- [ ] **Bước 2: Generate + push schema** (theo đúng quy trình dự án — xem `dvc-thay-doi-2026-08.md`
  nếu có sẵn quy trình `sync:tenants`, nếu không thì chạy trực tiếp trên DB dev):

```bash
cd be_maxv && npx prisma generate --schema prisma/tenant/schema.prisma
```

- [ ] **Bước 3: Kiểm tra biên dịch toàn repo** (client Prisma vừa generate lại phải khớp mọi chỗ
  dùng `generated/tenant`):

```bash
cd be_maxv && npx tsc --noEmit
```

- [ ] **Bước 4: DỪNG LẠI** — báo đã xong Task 6 (schema + `prisma generate` đã chạy), chờ người
  dùng tự `git add`/`git commit` rồi mới sang Task 7.

---

## Task 7: `giay_nop_tien/dvc-gnt-dong-bo.service.ts` — đồng bộ + đọc DB

**Files:**
- Create: `be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service.ts`

**Interfaces:**
- Consumes: `EtaxGntSession`/`ganPhienGnt`/`khoiTaoTraCuuGnt`/`traCuuGnt`/`taiPdfGnt`/`GntBoLoc`
  (Task 5, cùng thư mục), `getTenantDb` (`../../../../helpers/tenantClient`, đã có), `oTheoTieuDe`
  (`../hoSoHtml`, đã có), `DvcDongBo.DvcDongBoTienDo` KHÔNG cần khai lại — TÁI DÙNG type đã export
  sẵn từ `dvc-dong-bo.service.ts`
- Produces:
  - `dongBoGiayNopTien(dbName: string, params: { phien: DvcPhien; donViId: string; tuNgay: string; denNgay: string; tienDo: DvcDongBo.DvcDongBoTienDo; daBiThay: () => boolean }): Promise<void>`
  - `timGiayNopTienDaDongBo(tenantDb: PrismaClient, boLoc: { tuNgay?: string; denNgay?: string; maGiaoDich?: string; soGnt?: string }): Promise<BangHoSoDaBoc>`
  - `layFileGntDaLuu(tenantDb: PrismaClient, soThamChieu: string): Promise<{ bytes: Buffer; contentType: string; fileName: string } | null>`
  - `luuFileGntVaoCache(tenantDb: PrismaClient, soThamChieu: string, tep: { bytes: Buffer; contentType: string; fileName: string }): Promise<void>`
  - `layCtuIdDaLuu(tenantDb: PrismaClient, soThamChieu: string): Promise<string | null>`

Không viết test đơn vị (đụng DB + cổng thật) — kiểm tra bằng chạy sống (Task 10).

- [ ] **Bước 1: Viết file** — LƯU Ý đường dẫn import lùi thêm MỘT cấp so với `dvc-dong-bo.service.ts`
  gốc, vì file này nằm trong `giay_nop_tien/`:

```typescript
// be_maxv/src/services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service.ts
import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "../../../../generated/tenant";
import { getTenantDb } from "../../../../helpers/tenantClient";
import { oTheoTieuDe, type BangHoSoDaBoc } from "../hoSoHtml";
import * as EtaxGnt from "./gdt-etax-gnt.service";
import type { DvcPhien } from "../gdt-dvc.service";
import * as DvcDongBo from "../dvc-dong-bo.service";

/**
 * Đồng bộ Giấy nộp tiền (GNT) từ cổng eTax GNT về DB tenant (`dvc_giay_nop_tien`), và đọc lại dữ
 * liệu đã lưu cho ô tìm kiếm chính. Vai trò tương tự `dvc-dong-bo.service.ts` (tab "Tờ khai") nhưng
 * tách file riêng vì nguồn (`thuedientu.gdt.gov.vn`, khác domain) và hình dạng dữ liệu khác hẳn.
 *
 * TÁI DÙNG hạ tầng lượt-chạy-nền của `dvc-dong-bo.service.ts`
 * (`batDauDongBoRun`/`docTienDoDongBo`) thay vì tự dựng một kho riêng: một công ty chỉ chạy MỘT lượt
 * "Đồng bộ" tại một thời điểm dù đang đồng bộ loại nào — khớp đúng UI hiện có (một nút "Đồng bộ",
 * một toast tiến độ), xem spec mục 3.1.
 */

const LOAI_GNT = "giay-nop-tien";
const NHAN_LOAI = "giấy nộp tiền";
/** GNT chỉ có MỘT nguồn/pipeline, form gốc dùng `dd/MM/yyyy` — khác `yyyy-mm-dd` mà API app dùng. */
function ngayIsoSangDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseNgayLap(ngayLap: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(ngayLap);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(`${y}-${mo}-${d}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Chạy TRỌN một lượt đồng bộ GNT: mở phiên -> khởi tạo tra cứu -> gộp mọi trang kết quả -> lưu từng
 * dòng vào DB. Lỗi tải PDF của MỘT dòng chỉ tính `loi++`, không huỷ cả lượt.
 */
export async function dongBoGiayNopTien(
  dbName: string,
  params: {
    phien: DvcPhien;
    donViId: string;
    /** `yyyy-mm-dd`. */
    tuNgay: string;
    denNgay: string;
    tienDo: DvcDongBo.DvcDongBoTienDo;
    daBiThay: () => boolean;
  },
): Promise<void> {
  const db = () => getTenantDb(dbName);
  const { tienDo } = params;

  const boLoc: EtaxGnt.GntBoLoc = {
    tuNgayLap: ngayIsoSangDdMmYyyy(params.tuNgay),
    denNgayLap: ngayIsoSangDdMmYyyy(params.denNgay),
  };

  let session = await EtaxGnt.ganPhienGnt(params.phien, params.donViId);
  session = await EtaxGnt.khoiTaoTraCuuGnt(session);

  let loi = 0;
  let dongBoXong = 0;
  const MAX_TRANG = 50;
  for (let page = 1; page <= MAX_TRANG; page++) {
    if (params.daBiThay()) return;

    const ket = await EtaxGnt.traCuuGnt(session, boLoc, page);
    session = ket.session;
    const { headers, rows } = ket.bang;
    tienDo.tongHoSo = Math.max(tienDo.tongHoSo, ket.phanTrang.tongSoBanGhi ?? rows.length);

    for (let i = 0; i < rows.length; i++) {
      if (params.daBiThay()) return;
      const row = rows[i]!;
      const ctuId = ket.ctuIds[i];
      const soThamChieu = oTheoTieuDe(headers, row, "Số tham chiếu / Mã giao dịch");
      if (!soThamChieu || !ctuId) {
        loi++;
        tienDo.loi = loi;
        continue;
      }
      tienDo.maHoSoDangLam = soThamChieu;

      const raw = Object.fromEntries(headers.map((h, idx) => [h, row[idx] ?? ""]));
      const ngayLap = oTheoTieuDe(headers, row, "Ngày lập GNT");
      const soTienRaw = oTheoTieuDe(headers, row, "Số tiền").replace(/[.,\s]/g, "");

      try {
        await db().dvc_giay_nop_tien.upsert({
          where: { so_tham_chieu: soThamChieu },
          create: {
            so_tham_chieu: soThamChieu,
            ctu_id: ctuId,
            so_giay_nop_tien: oTheoTieuDe(headers, row, "Số giấy nộp tiền") || null,
            so_tien: soTienRaw ? soTienRaw : null,
            loai_tien: oTheoTieuDe(headers, row, "Loại tiền") || null,
            trang_thai: oTheoTieuDe(headers, row, "Trạng thái") || null,
            so_chung_tu: oTheoTieuDe(headers, row, "Số chứng từ") || null,
            ngay_lap_gnt: ngayLap || null,
            ngay_nop_date: parseNgayLap(ngayLap),
            ngan_hang: oTheoTieuDe(headers, row, "Ngân hàng") || null,
            tai_khoan_ngan_hang: oTheoTieuDe(headers, row, "Tài khoản ngân hàng") || null,
            raw,
          },
          update: { trang_thai: oTheoTieuDe(headers, row, "Trạng thái") || null, raw },
        });
        dongBoXong++;
        tienDo.dongBoXong = dongBoXong;
      } catch (err) {
        loi++;
        tienDo.loi = loi;
        console.warn(
          `[DVC-GNT] Đồng bộ ${soThamChieu} lỗi: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (rows.length === 0) break;
    if (ket.phanTrang.tongSoTrang !== null && page >= ket.phanTrang.tongSoTrang) break;
  }

  tienDo.maHoSoDangLam = "";

  await db().dvc_dong_bo_log.create({
    data: {
      id: randomUUID(),
      loai: LOAI_GNT,
      tu_ngay: new Date(`${params.tuNgay}T12:00:00`),
      den_ngay: new Date(`${params.denNgay}T12:00:00`),
      tong_ho_so: tienDo.tongHoSo,
      da_co_san: 0,
      dong_bo_xong: dongBoXong,
      loi,
      trang_thai: loi > 0 ? "partial" : "done",
      dien_giai: `Đồng bộ ${NHAN_LOAI}` + (loi > 0 ? ` — ${loi} dòng lỗi` : ""),
    },
  });
}

export interface TimGntBoLoc {
  /** `yyyy-mm-dd`. */
  tuNgay?: string;
  denNgay?: string;
  maGiaoDich?: string;
  soGnt?: string;
}

const MAX_KET_QUA_TIM_KIEM = 500;

/** Đọc GNT ĐÃ ĐỒNG BỘ trong DB tenant, dựng lại hình dạng `{headers, rows}` từ cột `raw` — cùng
 * khuôn `timHoSoDaDongBo` bên `dvc-dong-bo.service.ts`. */
export async function timGiayNopTienDaDongBo(
  tenantDb: PrismaClient,
  boLoc: TimGntBoLoc,
): Promise<BangHoSoDaBoc> {
  const where: Prisma.dvc_giay_nop_tienWhereInput = {};
  if (boLoc.tuNgay || boLoc.denNgay) {
    where.ngay_nop_date = {
      ...(boLoc.tuNgay ? { gte: new Date(`${boLoc.tuNgay}T00:00:00`) } : {}),
      ...(boLoc.denNgay ? { lte: new Date(`${boLoc.denNgay}T23:59:59`) } : {}),
    };
  }
  if (boLoc.maGiaoDich) where.so_tham_chieu = { contains: boLoc.maGiaoDich, mode: "insensitive" };
  if (boLoc.soGnt) where.so_giay_nop_tien = { contains: boLoc.soGnt, mode: "insensitive" };

  const daLuu = await tenantDb.dvc_giay_nop_tien.findMany({
    where,
    orderBy: { ngay_nop_date: "desc" },
    take: MAX_KET_QUA_TIM_KIEM,
    select: { raw: true },
  });

  if (daLuu.length === 0) return { headers: [], rows: [] };

  const headers: string[] = [];
  for (const dong of daLuu) {
    for (const k of Object.keys(dong.raw as Record<string, unknown>)) {
      if (!headers.includes(k)) headers.push(k);
    }
  }
  const rows = daLuu.map((dong) =>
    headers.map((h) => String((dong.raw as Record<string, unknown>)[h] ?? "")),
  );
  return { headers, rows };
}

/** File PDF đã lưu của một GNT — `null` nếu chưa có (kể cả khi chưa tồn tại trong DB). */
export async function layFileGntDaLuu(
  tenantDb: PrismaClient,
  soThamChieu: string,
): Promise<{ bytes: Buffer; contentType: string; fileName: string } | null> {
  const row = await tenantDb.dvc_giay_nop_tien.findUnique({
    where: { so_tham_chieu: soThamChieu },
    select: { file_pdf_bin: true, content_type: true, ten_file: true, ctu_id: true },
  });
  if (!row?.file_pdf_bin) return null;
  return {
    bytes: Buffer.from(row.file_pdf_bin),
    contentType: row.content_type ?? "application/pdf",
    fileName: row.ten_file ?? `${row.ctu_id}.pdf`,
  };
}

/** Ghi PDF vừa tải trực tiếp từ cổng vào cache — `updateMany` (không upsert): dòng phải đã tồn tại
 * từ một lượt đồng bộ trước, cùng quy ước `luuFileHoSoVaoCache` bên `dvc-dong-bo.service.ts`. */
export async function luuFileGntVaoCache(
  tenantDb: PrismaClient,
  soThamChieu: string,
  tep: { bytes: Buffer; contentType: string; fileName: string },
): Promise<void> {
  await tenantDb.dvc_giay_nop_tien.updateMany({
    where: { so_tham_chieu: soThamChieu },
    data: { file_pdf_bin: tep.bytes, content_type: tep.contentType, ten_file: tep.fileName },
  });
}

/** `ctuId` đã lưu của một GNT — cần để gọi `taiPdfGnt` khi cache miss. `null` nếu chưa có trong DB. */
export async function layCtuIdDaLuu(
  tenantDb: PrismaClient,
  soThamChieu: string,
): Promise<string | null> {
  const row = await tenantDb.dvc_giay_nop_tien.findUnique({
    where: { so_tham_chieu: soThamChieu },
    select: { ctu_id: true },
  });
  return row?.ctu_id ?? null;
}
```

- [ ] **Bước 2: Kiểm tra biên dịch**

```bash
cd be_maxv && npx tsc --noEmit
```

- [ ] **Bước 3: DỪNG LẠI** — báo đã xong Task 7 (`dvc-gnt-dong-bo.service.ts`), chờ người dùng tự
  `git add`/`git commit` rồi mới sang Task 8.

---

## Task 8: Controller — export helper dùng chung + `giay_nop_tien/gnt.controller.ts`

**Files:**
- Modify: `be_maxv/src/controllers/client/dich_vu_cong/gdt-dvc.controller.ts` (export thêm 4 hàm nội
  bộ, sửa `dongBo` rẽ nhánh theo `loai`)
- Create: `be_maxv/src/controllers/client/dich_vu_cong/giay_nop_tien/gnt.controller.ts`

**Interfaces:**
- Consumes (từ `gdt-dvc.controller.ts`, MỚI export): `phienDvc(request, key): DvcPhien | null`,
  `voiPhienTuPhucHoi<T>(ng, phien, thaoTac): Promise<T>`, `nguCanhTuRequest(request): NguCanhPhucHoi`,
  `thanLoi(err, macDinh): { message; code? }`
- Produces (từ `gnt.controller.ts`): `traCuuGiayNopTien`, `taiFileGiayNopTien` (Fastify handler)

Bốn hàm `phienDvc`/`voiPhienTuPhucHoi`/`nguCanhTuRequest`/`thanLoi` hiện là hàm module-private
(không `export`) của `gdt-dvc.controller.ts`. Vì file GNT mới cần dùng lại NGUYÊN VẸN (không chép
lại — chép lại là hai bản logic phiên/lỗi lệch nhau dần), bước 1 chỉ đơn giản thêm từ khóa `export`
trước 4 khai báo đó, KHÔNG đổi nội dung hàm.

- [ ] **Bước 1: Thêm `export` cho 4 hàm trong `gdt-dvc.controller.ts`.** Tìm từng dòng khai báo,
  thêm `export` phía trước:

```typescript
export function thanLoi(err: unknown, macDinh: string): { message: string; code?: string } {
```
```typescript
export function phienDvc(request: FastifyRequest, key: string | undefined): DvcService.DvcPhien | null {
```
```typescript
export function nguCanhTuRequest(request: FastifyRequest): NguCanhPhucHoi {
```
```typescript
export async function voiPhienTuPhucHoi<T>(
  ng: NguCanhPhucHoi,
  phien: DvcService.DvcPhien,
  thaoTac: () => Promise<T>,
): Promise<T> {
```
Và `export` cho `interface NguCanhPhucHoi` (tham số kiểu của `nguCanhTuRequest`/`voiPhienTuPhucHoi`,
GNT controller cần khai kiểu tham số đúng nó):
```typescript
export interface NguCanhPhucHoi {
```

- [ ] **Bước 2: Thêm import + sửa `dongBo` rẽ nhánh.** Đầu file, thêm:

```typescript
import * as DvcGnt from "../../../services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service";
```

Tìm hàm `dongBo` hiện có (khoảng dòng 386), sửa signature + phần thân cuối:

```typescript
export async function dongBo(
  request: FastifyRequest<{ Body: { key?: string; tuNgay?: string; denNgay?: string; loai?: string } }>,
  reply: FastifyReply,
) {
  const body = request.body;
  if (!body?.key || !body?.tuNgay || !body?.denNgay) {
    return reply.status(400).send({ message: "Thiếu khóa phiên hoặc khoảng ngày đồng bộ." });
  }
  const { tuNgay, denNgay } = body;
  const phien = phienDvc(request, body.key);
  if (!phien) {
    return reply.status(400).send({ message: "Chưa chọn công ty để đồng bộ Dịch vụ công." });
  }

  const dbName = await resolveTenantDbName(request);
  const nguCanh = nguCanhTuRequest(request);
  const loai = body.loai === "giay-nop-tien" ? "giay-nop-tien" : "to-khai-dvc";

  const tienDo = DvcDongBo.batDauDongBoRun(phien.donViId, (st, daBiThay) =>
    loai === "giay-nop-tien"
      ? DvcGnt.dongBoGiayNopTien(dbName, {
          phien,
          donViId: phien.donViId,
          tuNgay,
          denNgay,
          tienDo: st,
          daBiThay,
        })
      : DvcDongBo.dongBoHoSo(dbName, {
          phien,
          tuNgay,
          denNgay,
          tienDo: st,
          daBiThay,
          voiPhucHoi: (thaoTac) => voiPhienTuPhucHoi(nguCanh, phien, thaoTac),
        }),
  );

  return reply.send(tienDo);
}
```

- [ ] **Bước 3: Kiểm tra biên dịch** (chỉ hai thay đổi trên, chưa có file GNT controller):

```bash
cd be_maxv && npx tsc --noEmit
```
Expected: lỗi CHỈ ở dòng `import * as DvcGnt from ".../giay_nop_tien/dvc-gnt-dong-bo.service"` nếu
Task 7 chưa chạy — nếu Task 7 đã xong thì sạch hoàn toàn.

- [ ] **Bước 4: Viết `giay_nop_tien/gnt.controller.ts`** — 2 handler, dùng lại 4 hàm vừa export:

```typescript
// be_maxv/src/controllers/client/dich_vu_cong/giay_nop_tien/gnt.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import * as DvcGnt from "../../../../services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service";
import * as EtaxGnt from "../../../../services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service";
import { resolveTenantDb } from "../../../../helpers/resolveTenantDb";
import {
  phienDvc,
  voiPhienTuPhucHoi,
  nguCanhTuRequest,
  thanLoi,
} from "../gdt-dvc.controller";

/** GET /dvc/giay-nop-tien — tra cứu GNT ĐÃ ĐỒNG BỘ, đọc thẳng DB tenant (cùng khuôn `traCuuHoSo`
 * bên `gdt-dvc.controller.ts`). */
export async function traCuuGiayNopTien(
  request: FastifyRequest<{ Querystring: DvcGnt.TimGntBoLoc }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const tenantDb = await resolveTenantDb(request);
  try {
    const bang = await DvcGnt.timGiayNopTienDaDongBo(tenantDb, {
      tuNgay: q?.tuNgay,
      denNgay: q?.denNgay,
      maGiaoDich: q?.maGiaoDich,
      soGnt: q?.soGnt,
    });
    return reply.send(bang);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({
      message: err instanceof Error ? err.message : "Tra cứu Giấy nộp tiền thất bại.",
    });
  }
}

/**
 * GET /dvc/giay-nop-tien/file?maGiaoDich=<số tham chiếu> — tải PDF một GNT, đọc cache trước.
 *
 * Cache miss cần MỞ PHIÊN GNT MỚI ngay tại đây (khác `taiFileHoSo` bên DVC, vốn dùng lại `key`
 * phiên đã đăng nhập sẵn) vì phiên GNT không cache qua nhiều lượt (xem spec mục 3.1) — chỉ cần
 * phiên DVC (`key`) còn sống là đủ, không cần `key` GNT riêng nào từ FE.
 */
export async function taiFileGiayNopTien(
  request: FastifyRequest<{ Querystring: { key?: string; maGiaoDich?: string } }>,
  reply: FastifyReply,
) {
  const q = request.query;
  const maGiaoDich = q?.maGiaoDich;
  if (!maGiaoDich) {
    return reply.status(400).send({ message: "Thiếu số tham chiếu / mã giao dịch." });
  }

  const tenantDb = await resolveTenantDb(request);
  try {
    const daLuu = await DvcGnt.layFileGntDaLuu(tenantDb, maGiaoDich);
    if (daLuu) {
      return reply
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(daLuu.fileName)}`)
        .type(daLuu.contentType)
        .send(daLuu.bytes);
    }

    const phien = phienDvc(request, q.key);
    if (!phien) {
      return reply.status(400).send({
        message: 'Giấy nộp tiền chưa đồng bộ — bấm "Đăng nhập cổng Dịch vụ công" rồi thử lại.',
      });
    }
    const ctuId = await DvcGnt.layCtuIdDaLuu(tenantDb, maGiaoDich);
    if (!ctuId) {
      return reply.status(404).send({ message: "Không tìm thấy Giấy nộp tiền này." });
    }

    const ket = await voiPhienTuPhucHoi(nguCanhTuRequest(request), phien, async () => {
      let session = await EtaxGnt.ganPhienGnt(phien, phien.donViId);
      session = await EtaxGnt.khoiTaoTraCuuGnt(session);
      return EtaxGnt.taiPdfGnt(session, ctuId);
    });

    await DvcGnt.luuFileGntVaoCache(tenantDb, maGiaoDich, ket.tep);
    return reply
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(ket.tep.fileName)}`)
      .type(ket.tep.contentType)
      .send(ket.tep.bytes);
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send(thanLoi(err, "Tải file Giấy nộp tiền thất bại."));
  }
}
```

- [ ] **Bước 5: Kiểm tra biên dịch**

```bash
cd be_maxv && npx tsc --noEmit
```

- [ ] **Bước 6: DỪNG LẠI** — báo đã xong Task 8 (`gdt-dvc.controller.ts` sửa + `gnt.controller.ts`
  mới), chờ người dùng tự `git add`/`git commit` rồi mới sang Task 9.

---

## Task 9: Route — `giay_nop_tien/gnt.route.ts` + đăng ký sub-plugin

**Files:**
- Create: `be_maxv/src/routes/dich_vu_cong/giay_nop_tien/gnt.route.ts`
- Modify: `be_maxv/src/routes/dich_vu_cong/gdt-dvc.route.ts`

- [ ] **Bước 1: Viết route file mới** — plugin Fastify RIÊNG, cùng guard (`authenticate` + module
  `dvc`) với route DVC hiện có:

```typescript
// be_maxv/src/routes/dich_vu_cong/giay_nop_tien/gnt.route.ts
import { FastifyInstance } from "fastify";
import {
  traCuuGiayNopTien,
  taiFileGiayNopTien,
} from "../../../controllers/client/dich_vu_cong/giay_nop_tien/gnt.controller";
import { requireModule } from "../../../services/shared/modules.service";

/** Route Giấy nộp tiền (eTax GNT) — sub-plugin của `gdt-dvc.route.ts`, đăng ký ở đó nên thừa hưởng
 * cùng prefix `/dvc`. Tách file riêng theo đúng quy ước "mọi file MỚI nằm trong `giay_nop_tien/`". */
export default async function (fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireModule("dvc")];

  fastify.get("/giay-nop-tien", {
    preHandler: guard,
    handler: traCuuGiayNopTien,
  });

  fastify.get("/giay-nop-tien/file", {
    preHandler: guard,
    handler: taiFileGiayNopTien,
  });
}
```

- [ ] **Bước 2: Đăng ký sub-plugin trong `gdt-dvc.route.ts`.** Thêm import ở đầu file:

```typescript
import gntRoutes from "./giay_nop_tien/gnt.route";
```

Thêm dòng cuối cùng bên trong `export default async function (fastify: FastifyInstance) { ... }`
(sau route `xoaTatCaLichSuDongBo`, trước dấu `}` đóng hàm):

```typescript
  await fastify.register(gntRoutes);
```

- [ ] **Bước 3: Kiểm tra biên dịch**

```bash
cd be_maxv && npx tsc --noEmit
```

- [ ] **Bước 4: DỪNG LẠI** — báo đã xong Task 9 (`gnt.route.ts` mới + `gdt-dvc.route.ts` đăng ký
  sub-plugin), chờ người dùng tự `git add`/`git commit` rồi mới sang Task 10.

---

## Task 10: Xác nhận sống trên cổng thật (MST 0106200129)

Không phải task code — bước gate trước khi sang phần FE, để chắc Task 5-9 THẬT SỰ nói chuyện được
với cổng (mọi giả định ở Task 5/7 dựa trên suy luận từ curl, xem spec mục 7).

- [ ] **Bước 1:** Chạy backend dev (`npm run dev` trong `be_maxv`), đăng nhập cổng DVC bằng tài
  khoản MST 0106200129 qua flow hiện có (`POST /dvc/login`), lấy `key`.

- [ ] **Bước 2:** Gọi thẳng `POST /dvc/dong-bo` với `{ key, tuNgay: "2026-01-01", denNgay: "2026-12-31", loai: "giay-nop-tien" }`
  (dùng Postman/curl/REST client bất kỳ, KHÔNG cần đợi FE).

- [ ] **Bước 3:** Poll `GET /dvc/dong-bo/tien-do` tới khi `active: false`. Kiểm tra `dong_bo_xong > 0`
  hoặc `loi` có ý nghĩa (không phải crash).

- [ ] **Bước 4: Nếu lỗi** — đọc log `[DEBUG-GNT]`/`[DVC-GNT]`, đối chiếu với giả định trong Task 5/7
  (đặc biệt: `dse_pageId` có cần tăng thủ công không, `download` có thật cần processorId của `detail`
  không, tên cột thật của bảng kết quả có khớp `oTheoTieuDe` đang dùng không). SỬA TRỰC TIẾP vào
  file của Task 5/7 (`services/client/dich_vu_cong/giay_nop_tien/`) cho tới khi lượt đồng bộ chạy
  được hết — đây là bước "vá theo bằng chứng sống" đúng tinh thần mục 7 của spec, không mở task mới.

- [ ] **Bước 5:** Gọi `GET /dvc/giay-nop-tien?tuNgay=2026-01-01&denNgay=2026-12-31`, xác nhận trả về
  đúng số dòng vừa đồng bộ.

- [ ] **Bước 6:** Gọi `GET /dvc/giay-nop-tien/file?maGiaoDich=<một số tham chiếu thật>`, xác nhận
  tải về PDF hợp lệ (mở được, không phải trang lỗi HTML).

- [ ] **Bước 7: DỪNG LẠI** — báo kết quả xác nhận sống (đồng bộ được bao nhiêu dòng, có sửa gì ở
  Bước 4 không), chờ người dùng tự `git add`/`git commit` các sửa đổi phát sinh (nếu có) rồi mới
  sang Task 11.

---

## Task 11: FE — `config.ts` + `BangHoSo.tsx` nhận diện cột định danh theo tab

**Files:**
- Modify: `hdđt_maxv/src/features/dich_vu_cong/config.ts`
- Modify: `hdđt_maxv/src/features/dich_vu_cong/components/BangHoSo.tsx`

**Vấn đề cụ thể cần sửa:** `BangHoSo.tsx:166` hiện hardcode
`cot.findIndex((c) => c.key === "maGiaoDich")` để tìm cột định danh dòng (giá trị gửi cho
`onAction`/`onXemToKhai`). `COT_GIAY_NOP_TIEN` không có cột nào key `"maGiaoDich"` — cột đóng vai
trò đó là `soThamChieu` ("Số tham chiếu / Mã giao dịch", PK của `dvc_giay_nop_tien` theo Task 6).
Không sửa thì mọi icon hành động (kể cả "Tải file") ở tab GNT bị khóa vĩnh viễn.

- [ ] **Bước 1: Thêm field vào `TabDvc`** trong `config.ts` (đặt cạnh `cotBang`):

```typescript
export interface TabDvc {
  value: string;
  label: string;
  tieuDeBoLoc: string;
  nhanBoLoc: NhanBoLoc;
  cotBang: CotBang[];
  /**
   * Cột nào đóng vai trò định danh dòng (giá trị gửi cho `onAction`/`onXemToKhai` ở `BangHoSo`) —
   * mặc định `"maGiaoDich"` nếu bỏ trống. Tab Giấy nộp tiền không có cột `key: "maGiaoDich"`, dùng
   * `soThamChieu` thay thế (PK `dvc_giay_nop_tien.so_tham_chieu`).
   */
  khoaMaGiaoDich?: string;
}
```

- [ ] **Bước 2: Gán giá trị cho tab GNT** — tìm entry `value: "giay-nop-tien"` trong `TAB_DVC`, thêm:

```typescript
    khoaMaGiaoDich: "soThamChieu",
```

- [ ] **Bước 3: Sửa `BangHoSo.tsx` nhận prop mới.** Thêm vào interface `Props` (cạnh `onXemToKhai`):

```typescript
  /** Cột đóng vai trò định danh dòng — mặc định `"maGiaoDich"`, xem `TabDvc.khoaMaGiaoDich`. */
  khoaMaGiaoDich?: string;
```

- [ ] **Bước 4: Đọc prop trong tham số hàm + dùng thay hardcode.** Sửa dòng khai tham số hàm
  component (thêm `khoaMaGiaoDich = "maGiaoDich"` vào destructure), và dòng 166:

```typescript
  khoaMaGiaoDich = "maGiaoDich",
```

```typescript
  const idxMaGiaoDich = cot.findIndex((c) => c.key === khoaMaGiaoDich);
  if (idxMaGiaoDich === -1 && cot.some((c) => c.action)) {
    console.warn(`BangHoSo: có cột action nhưng thiếu cột key "${khoaMaGiaoDich}" để lấy mã hồ sơ.`);
  }
```

- [ ] **Bước 5: Chạy build + lint**

```bash
cd hdđt_maxv && npm run build && npm run lint
```
Expected: sạch, không lỗi TypeScript mới (prop optional nên `DvcPage.tsx` chưa truyền vẫn biên
dịch được — sẽ truyền ở Task 15).

- [ ] **Bước 6: DỪNG LẠI** — báo đã xong Task 11 (`config.ts` + `BangHoSo.tsx`), chờ người dùng tự
  `git add`/`git commit` rồi mới sang Task 12.

---

## Task 12: FE — `api/dvc.ts` mở đường + `giay_nop_tien/api.ts` mới

**Files:**
- Modify: `hdđt_maxv/src/features/dich_vu_cong/api/dvc.ts`
- Create: `hdđt_maxv/src/features/dich_vu_cong/giay_nop_tien/api.ts`

**Interfaces:**
- Produces (từ `api/dvc.ts`, MỚI export): `qsBoQuaRong(params: object): URLSearchParams`
- Produces (từ `giay_nop_tien/api.ts`): `traCuuGiayNopTienDvc`, `taiFileGiayNopTienDvc`,
  `DvcGntTraCuuParams`, `DvcGntFileParams`

- [ ] **Bước 1: Export `qsBoQuaRong` trong `api/dvc.ts`.** Hàm này hiện là hàm module-private đầu
  file — thêm `export` phía trước, KHÔNG đổi nội dung:

```typescript
export function qsBoQuaRong(params: object): URLSearchParams {
```

- [ ] **Bước 2: Thêm `loai` vào `DvcDongBoParams`** (interface đã có, cùng file):

```typescript
export interface DvcDongBoParams {
  key: string;
  tuNgay: string;
  denNgay: string;
  /** Khớp `TAB_DVC[].value` — BE mặc định `"to-khai-dvc"` nếu bỏ trống, xem `gdt-dvc.controller.ts`. */
  loai: string;
}
```

- [ ] **Bước 3: Viết `giay_nop_tien/api.ts`** — API riêng cho tab GNT, tái dùng `qsBoQuaRong` +
  `type DvcBangHoSo` từ `api/dvc.ts` (LÙI một cấp `../` vì nằm trong thư mục con):

```typescript
// hdđt_maxv/src/features/dich_vu_cong/giay_nop_tien/api.ts
import { apiFetch, apiFetchBlob } from "../../../lib/http";
import { qsBoQuaRong, type DvcBangHoSo } from "../api/dvc";

export interface DvcGntTraCuuParams {
  /** `yyyy-mm-dd`. */
  tuNgay?: string;
  denNgay?: string;
  maGiaoDich?: string;
  soGnt?: string;
}

/**
 * GET /api/v1/dvc/giay-nop-tien → `{ headers, rows }` — cùng hình dạng `DvcBangHoSo`, đọc thẳng dữ
 * liệu đã đồng bộ. Dùng: `DvcPage` (tra cứu tab "Giấy nộp tiền").
 */
export async function traCuuGiayNopTienDvc(params: DvcGntTraCuuParams): Promise<DvcBangHoSo> {
  return apiFetch<DvcBangHoSo>(`/dvc/giay-nop-tien?${qsBoQuaRong(params).toString()}`);
}

export interface DvcGntFileParams {
  /** Khóa phiên — CHỈ cần khi GNT chưa từng tải file (cache miss), cùng quy ước `DvcHoSoDaDongBoParams`. */
  key?: string;
  /** "Số tham chiếu / Mã giao dịch" của dòng — khớp PK `dvc_giay_nop_tien.so_tham_chieu`. */
  maGiaoDich: string;
}

/**
 * GET /api/v1/dvc/giay-nop-tien/file → tải PDF một Giấy nộp tiền, qua BE proxy. Dùng: cột "Tải
 * file" tab "Giấy nộp tiền".
 */
export function taiFileGiayNopTienDvc({ key, maGiaoDich }: DvcGntFileParams): Promise<Blob> {
  return apiFetchBlob(`/dvc/giay-nop-tien/file?${qsBoQuaRong({ key, maGiaoDich }).toString()}`);
}
```

- [ ] **Bước 4: Chạy build**

```bash
cd hdđt_maxv && npm run build
```
Expected: LỖI ở `DialogDongBo.tsx` (gọi `dongBoDvc` thiếu field `loai` bắt buộc) — Task 13 sửa.

- [ ] **Bước 5: DỪNG LẠI** — báo đã xong Task 12 (`api/dvc.ts` sửa + `giay_nop_tien/api.ts` mới),
  chờ người dùng tự `git add`/`git commit` rồi mới sang Task 13.

---

## Task 13: FE — `DialogDongBo.tsx` gỡ khóa "Giấy nộp tiền"

**Files:**
- Modify: `hdđt_maxv/src/features/dich_vu_cong/components/DialogDongBo.tsx`

- [ ] **Bước 1: Đổi `LOAI_DA_HO_TRO` từ hằng đơn sang tập hợp.** Tìm dòng khai báo:

```typescript
const LOAI_DA_HO_TRO = "to-khai-dvc";
```
Đổi thành:

```typescript
/** Hai loại giấy tờ đã có backend đồng bộ thật — xem `dvc-dong-bo.service.ts` (tờ khai) và
 * `giay_nop_tien/dvc-gnt-dong-bo.service.ts` (giấy nộp tiền). */
const LOAI_DA_HO_TRO = new Set(["to-khai-dvc", "giay-nop-tien"]);
```

- [ ] **Bước 2: Sửa 2 chỗ dùng `!== LOAI_DA_HO_TRO`.** Tìm `if (loai !== LOAI_DA_HO_TRO)` trong
  `handleDongBo`, đổi thành:

```typescript
    if (!LOAI_DA_HO_TRO.has(loai)) {
```

Tìm dòng JSX `disabled={muc.value !== LOAI_DA_HO_TRO}` trong `MenuItem`, đổi thành:

```typescript
              <MenuItem key={muc.value} value={muc.value} disabled={!LOAI_DA_HO_TRO.has(muc.value)}>
                {muc.label}
                {!LOAI_DA_HO_TRO.has(muc.value) ? " (chưa hỗ trợ)" : ""}
              </MenuItem>
```

- [ ] **Bước 3: Truyền `loai` vào `dongBoDvc`.** Tìm `dongBoMutation`:

```typescript
  const dongBoMutation = useMutation({
    mutationFn: (vars: { tuNgay: string; denNgay: string }) =>
      dongBoDvc({ key: dvcKey!, tuNgay: vars.tuNgay, denNgay: vars.denNgay }),
```
Đổi thành:

```typescript
  const dongBoMutation = useMutation({
    mutationFn: (vars: { tuNgay: string; denNgay: string }) =>
      dongBoDvc({ key: dvcKey!, tuNgay: vars.tuNgay, denNgay: vars.denNgay, loai }),
```

- [ ] **Bước 4: Chạy build**

```bash
cd hdđt_maxv && npm run build && npm run lint
```
Expected: sạch.

- [ ] **Bước 5: DỪNG LẠI** — báo đã xong Task 13 (`DialogDongBo.tsx`), chờ người dùng tự
  `git add`/`git commit` rồi mới sang Task 14.

---

## Task 14: FE — `giay_nop_tien/taiFileGiayNopTien.ts` (helper tải file)

**Files:**
- Create: `hdđt_maxv/src/features/dich_vu_cong/giay_nop_tien/taiFileGiayNopTien.ts`

- [ ] **Bước 1: Viết file** — mirror `taiFileHoSo.ts` (file gốc nằm ở `dich_vu_cong/`, file này nằm
  sâu hơn một cấp trong `giay_nop_tien/` nên `duoiTuContentType`/`lib` lùi thêm `../`):

```typescript
// hdđt_maxv/src/features/dich_vu_cong/giay_nop_tien/taiFileGiayNopTien.ts
import { taiFileGiayNopTienDvc } from "./api";
import { luuVeMay } from "../../../lib/downloadFile";
import { duoiTuContentType } from "../duoiTuContentType";

/**
 * Tải PDF của một Giấy nộp tiền về máy — nguồn cho icon cột "Tải file" ở `BangHoSo` khi đang mở
 * tab "Giấy nộp tiền". `maGiaoDich` là "Số tham chiếu / Mã giao dịch" của dòng đang bấm (PK
 * `dvc_giay_nop_tien.so_tham_chieu`).
 */
export async function taiFileGiayNopTien(key: string | null, maGiaoDich: string): Promise<void> {
  const blob = await taiFileGiayNopTienDvc({ key: key ?? undefined, maGiaoDich });
  const duoi = duoiTuContentType(blob.type, "pdf");
  luuVeMay(blob, `${maGiaoDich}.${duoi}`);
}
```

- [ ] **Bước 2: Chạy build**

```bash
cd hdđt_maxv && npm run build
```

- [ ] **Bước 3: DỪNG LẠI** — báo đã xong Task 14 (`giay_nop_tien/taiFileGiayNopTien.ts`), chờ
  người dùng tự `git add`/`git commit` rồi mới sang Task 15.

---

## Task 15: FE — `DvcPage.tsx` dispatch theo tab

**Files:**
- Modify: `hdđt_maxv/src/pages/dich_vu_cong/DvcPage.tsx`

- [ ] **Bước 1: Thêm import** (từ thư mục `giay_nop_tien/` mới):

```typescript
import { traCuuGiayNopTienDvc } from "../../features/dich_vu_cong/giay_nop_tien/api";
import { taiFileGiayNopTien } from "../../features/dich_vu_cong/giay_nop_tien/taiFileGiayNopTien";
```

- [ ] **Bước 2: Sửa `traCuuMutation` để rẽ nhánh theo tab.** Tìm khối hiện có:

```typescript
  const traCuuMutation = useMutation({
    mutationFn: (vars: { mst: string; values: BoLocHoSoValues }) =>
      traCuuHoSoDvc({
        tuNgay: vars.values.tuNgay,
        denNgay: vars.values.denNgay,
        maHoSo: vars.values.hoSo,
        maToKhai: vars.values.loaiHoSo,
      }),
```
Đổi thành (tham số `vars` thêm `loai`):

```typescript
  const traCuuMutation = useMutation({
    mutationFn: (vars: { mst: string; loai: string; values: BoLocHoSoValues }) =>
      vars.loai === "giay-nop-tien"
        ? traCuuGiayNopTienDvc({
            tuNgay: vars.values.tuNgay,
            denNgay: vars.values.denNgay,
            maGiaoDich: vars.values.hoSo,
            soGnt: vars.values.loaiHoSo,
          })
        : traCuuHoSoDvc({
            tuNgay: vars.values.tuNgay,
            denNgay: vars.values.denNgay,
            maHoSo: vars.values.hoSo,
            maToKhai: vars.values.loaiHoSo,
          }),
```

- [ ] **Bước 3: Sửa `handleSearch` truyền `tab` hiện tại.** Tìm:

```typescript
  const handleSearch = (values: BoLocHoSoValues) => {
    if (!activeMst) return;
    traCuuMutation.mutate({ mst: activeMst, values });
  };
```
Đổi thành:

```typescript
  const handleSearch = (values: BoLocHoSoValues) => {
    if (!activeMst) return;
    traCuuMutation.mutate({ mst: activeMst, loai: tab, values });
  };
```

- [ ] **Bước 4: Sửa `handleTaiFile` rẽ nhánh theo tab.** Tìm:

```typescript
  const handleTaiFile = async (maHoSo: string) => {
    setDangChayAction({ key: "taiFile", maHoSo });
    const toastId = toast.loading(`Đang tải file hồ sơ ${maHoSo}…`);
    try {
      await taiFileHoSo(dvcKey, maHoSo);
```
Đổi thành:

```typescript
  const handleTaiFile = async (maHoSo: string) => {
    setDangChayAction({ key: "taiFile", maHoSo });
    const toastId = toast.loading(`Đang tải file ${maHoSo}…`);
    try {
      if (tab === "giay-nop-tien") {
        await taiFileGiayNopTien(dvcKey, maHoSo);
      } else {
        await taiFileHoSo(dvcKey, maHoSo);
      }
```

- [ ] **Bước 5: Truyền `khoaMaGiaoDich` cho `BangHoSo`.** Tìm chỗ render `<BangHoSo ... cot={dangMo.cotBang} ...>` (phía dưới cùng file, chưa đọc ở lượt khảo sát — tìm bằng cách grep `<BangHoSo` trong file), thêm prop:

```typescript
          khoaMaGiaoDich={dangMo.khoaMaGiaoDich}
```

- [ ] **Bước 6: Chạy build + lint**

```bash
cd hdđt_maxv && npm run build && npm run lint
```
Expected: sạch.

- [ ] **Bước 7: DỪNG LẠI** — báo đã xong Task 15 (`DvcPage.tsx`), chờ người dùng tự
  `git add`/`git commit` rồi mới sang Task 16.

---

## Task 16: Xác nhận sống trên UI thật (MST 0106200129)

- [ ] **Bước 1:** Chạy `be_maxv` (`npm run dev`) và `hdđt_maxv` (`npm run dev`), đăng nhập app, chọn
  công ty MST 0106200129.

- [ ] **Bước 2:** Vào "Dịch vụ công" → "Đăng nhập cổng Dịch vụ công" (nếu chưa có phiên) → mở dialog
  "Đồng bộ dữ liệu thuế điện tử" → chọn "Giấy nộp tiền" (giờ đã unlock) → chọn khoảng ngày có dữ
  liệu thật → bấm "Đồng bộ".

- [ ] **Bước 3:** Theo dõi toast tiến độ tới khi xong. Kiểm tra dòng lịch sử mới trong bảng "Lịch sử
  đồng bộ" của dialog (nhãn "giấy nộp tiền").

- [ ] **Bước 4:** Đóng dialog, chuyển sang tab "Giấy nộp tiền", bấm "Tìm kiếm" với đúng khoảng ngày
  vừa đồng bộ — xác nhận bảng hiện đủ 17 cột đúng như liệt kê của người dùng, dữ liệu khớp cổng.

- [ ] **Bước 5:** Bấm icon "Tải file" một dòng — xác nhận PDF tải về mở được.

- [ ] **Bước 6: Nếu có lệch** (cột trống dù cổng có dữ liệu, tên cột sai vị trí, nút tải file bị
  khóa) — đối chiếu lại Task 6/11, sửa trực tiếp (khả năng cao nhất: tên cột thật trên cổng khác chữ
  đang giả định trong `oTheoTieuDe`/`COT_GIAY_NOP_TIEN.header`, xem mục 7.2 spec — thêm `srcHeader`
  cho đúng cột bị lệch, theo đúng mẫu `COT_TO_KHAI` đã làm).

- [ ] **Bước 7: DỪNG LẠI** — báo kết quả xác nhận UI (ảnh chụp màn hình nếu tiện), chờ người dùng
  tự `git add`/`git commit` các sửa đổi phát sinh (nếu có). Đây là task cuối — plan hoàn tất sau
  bước này.

---

## Self-Review (đã chạy khi viết plan này)

**1. Spec coverage:**
- Mục 2 (SSO + pipeline) → Task 4, 5.
- Mục 3.1 (phiên không cache) → Task 5 (`ganPhienGnt` gọi mới mỗi lượt, không có TTL/cache map).
- Mục 3.2 (pipeline hàm-theo-bước) → Task 5.
- Mục 3.3 (schema) → Task 6 (tinh chỉnh: PK đổi từ `ctu_id` sang `so_tham_chieu` — quyết định LẤY Ở
  Task 11 khi phát hiện `BangHoSo` cần một cột định danh HIỂN THỊ ĐƯỢC, không thể dùng `ctu_id` ẩn).
- Mục 3.4 (wiring FE) → Task 11-15.
- Mục 4 (xử lý lỗi) → không-captcha (Task 5 không có vòng OCR), một-dòng-lỗi-không-huỷ-lượt (Task 7
  `try/catch` trong vòng lặp dòng), pacer lane riêng (Task 5 `"etax-gnt"`).
- Mục 5 (kiểm thử) → Task 10, 16 (MST 0106200129).
- Mục 6 (ngoài phạm vi) → plan không đụng module SSO khác, không thêm cột "Xem chi tiết" ở FE.
- Mục 7 (chưa kiểm chứng) → Task 1 (bắt fixture) + Task 10/16 (gate xác nhận sống, sửa tại chỗ).

**2. Placeholder scan:** Không còn "TBD"/"implement later". Task 3 có nhánh code ĐẦY ĐỦ cho cả 3
hình dạng response khả dĩ (không phải placeholder — là xử lý phòng hờ có thật, thu hẹp lại được sau
Task 1 nếu cần). Task 10/16 là gate xác nhận + sửa-tại-chỗ, không phải "để sau".

**3. Type consistency:** `EtaxGntSession`/`GntBoLoc`/`GntTepTaiVe` khai ở Task 5, dùng lại Y NGUYÊN
tên ở Task 7 (`giay_nop_tien/dvc-gnt-dong-bo.service.ts`) và Task 8 (`giay_nop_tien/gnt.controller.ts`).
`DvcGnt.TimGntBoLoc` (Task 7) khớp field với `DvcGntTraCuuParams` (Task 12, FE) và query của
`traCuuGiayNopTien` (Task 8). Cột PK `so_tham_chieu` (Task 6) khớp `khoaMaGiaoDich: "soThamChieu"`
(Task 11, FE key) và tham số `maGiaoDich` xuyên suốt Task 8/12/14/15 (đặt tên tham số API là
`maGiaoDich` dù cột DB là `so_tham_chieu` — CỐ Ý khớp quy ước tên tham số cũ
`DvcHoSoDaDongBoParams.maHoSo`/`maGiaoDich` bên tab Tờ khai, để FE dùng chung mental model "tham số
nhận dạng dòng luôn tên `maGiaoDich`").

**4. Foldering (yêu cầu bổ sung của người dùng):** Mọi file MỚI nằm trong `giay_nop_tien/` ở đúng
tầng (`services/client/dich_vu_cong/giay_nop_tien/`, `controllers/client/dich_vu_cong/giay_nop_tien/`,
`routes/dich_vu_cong/giay_nop_tien/` bên `be_maxv`; `features/dich_vu_cong/giay_nop_tien/` bên
`hdđt_maxv`) — trừ file test (`be_maxv/src/__tests__/etaxGntHtml.test.ts`, giữ FLAT theo đúng quy
ước hiện có của thư mục `__tests__/`, không có tiền lệ chia thư mục con ở đó) và fixture (đặt trong
`__tests__/fixtures/giay_nop_tien/` — CÓ chia thư mục con vì `fixtures/` vốn chưa tồn tại, không phá
quy ước nào). Việc export thêm 4 hàm nội bộ của `gdt-dvc.controller.ts` (Task 8, bước 1) là thay đổi
TỐI THIỂU cần thiết để `giay_nop_tien/gnt.controller.ts` dùng lại logic phiên/lỗi có sẵn mà không
chép lại — đánh đổi hợp lý để giữ file mới đúng trong thư mục yêu cầu.

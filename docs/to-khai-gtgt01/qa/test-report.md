---
type: test-report
feature: to-khai-gtgt01
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/qa/test-matrix.md
  - docs/to-khai-gtgt01/qa/test-cases.md
  - docs/to-khai-gtgt01/qa/issues-and-bugs.md
  - docs/to-khai-gtgt01/architecture/api-contract.md
  - docs/to-khai-gtgt01/work-log.md
---

# Test report: Xuất Excel kèm chi tiết hóa đơn & đổi mã "Chỉ tiêu tăng giảm"

## Vòng Backend 2026-09-16

**Phạm vi**: chỉ `be_maxv/`. Frontend (`hdđt_maxv/`) chưa code — TC thuộc tầng `FE-manual`/`FE-build`/
`Excel-manual` thuần túy đánh **Chưa chạy — chờ vòng FE**, không phải fail. Không ghi/sửa DB (không
INSERT/UPDATE/DELETE, không seed, không migrate).

**Môi trường**: Windows 10, Node (qua `tsx`), repo local `C:\Users\Admin\Desktop\maxv_v2\be_maxv`,
không có kết nối Postgres dev khả dụng trong môi trường chạy QA (không có `psql`, `.env` không có
`DATABASE_URL` set sẵn cho phiên này) — mọi test BE trong đợt này chạy qua **mock Prisma client**
(`mock.module`), không chạm DB thật. TC nào bắt buộc DB Postgres thật bị đánh "Chưa chạy — cần DB dev +
seed" (xem Mục "Issues còn tồn đọng" ở `issues-and-bugs.md`).

### Lệnh đã chạy độc lập (không tin báo cáo của backend-engineer) + số liệu thật

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `cd be_maxv && npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 lỗi |
| 2 | `cd be_maxv && npm run lint` (`eslint src`) | **PASS** — `✖ 467 problems (0 errors, 467 warnings)`; 0 warning nằm trong bất kỳ file `to_khai/*` nào (xác nhận bằng `grep -i "to_khai"` trên output lint) |
| 3 | `cd be_maxv && npm test` (`tsx --experimental-test-module-mocks --test src/__tests__/**/*.test.ts`) | `tests 1223`, `pass 1206`, `fail 4`, `skipped 13`, `cancelled 0` |
| 4 | `npx tsx --experimental-test-module-mocks --test src/__tests__/to_khai/*.test.ts` (chỉ mô-đun to_khai) | `tests 221`, `pass 221`, `fail 0` |
| 5 | `npx tsx --experimental-test-module-mocks --test src/__tests__/to_khai/bangKeChiTiet.test.ts src/__tests__/to_khai/toKhaiChiTietRoute.test.ts src/__tests__/to_khai/quyetDinhKeKhai.test.ts` (3 file mới/sửa của đợt này) | `tests 30`, `pass 30`, `fail 0` — 7 (`bangKeChiTiet`) + 6 (`toKhaiChiTietRoute`) + 17 (`quyetDinhKeKhai`, gồm 6 test cũ + 11 test mới) |
| 6 | `npx tsx --experimental-test-module-mocks --test src/__tests__/to_khai/tinhGtgt01.test.ts` (xác nhận TC-041 riêng) | `tests 22`, `pass 22`, `fail 0` |

**4 fail của lệnh #3 — xác nhận đúng là baseline có sẵn, KHÔNG liên quan `to-khai-gtgt01`:**

Cả 4 đều nằm trong `src/__tests__/hrm/hrmSettingsShiftsHolidaysApi.test.ts` (mô-đun HRM — Ca làm
việc/Lịch ngày lễ, không đụng tới `to_khai`, không nằm trong diff của đợt này):

| Test | Lý do fail |
|---|---|
| `TC-hrm-301 — lọc search + status` | `search=chinh` không khớp "Ca hành chính" — tìm kiếm hiện không bỏ dấu tiếng Việt |
| `TC-hrm-316 — GET ?year=2026&filter=THIS_YEAR` | Payload response không có trường "thứ trong tuần" mà test đòi hỏi |
| 2 suite cha `7.2 Ca làm việc` / `7.3 Lịch ngày lễ` | Bị đánh fail dây chuyền vì có subtest fail bên trong (Node test runner), không phải lỗi riêng |

Xác nhận: `git diff --stat -- be_maxv` chỉ động tới 4 file
(`quyetDinhKeKhai.test.ts`, `keKhaiKy.controller.ts`, `toKhai.route.ts`, `keKhaiKy.service.ts`) +
2 file test mới (`bangKeChiTiet.test.ts`, `toKhaiChiTietRoute.test.ts`) — không file nào thuộc `hrm/`.
Kết luận: **4 fail là môi trường/test-data issue có sẵn của mô-đun HRM, không phải regression của đợt
này.**

### Đối chiếu code với `api-contract.md` Mục 2.4 (bất biến) — xác nhận qua đọc code, không chỉ tin comment

- Bất biến #1 (gọi nguyên `layBangKeTheoKy`, không lọc lại/lọc thêm): `layBangKeChiTietTheoKy` gọi
  `layBangKeTheoKy(db, ky, chieu)` rồi chỉ `.map()` gắn thêm `chiTiet` — không có `filter` nào khác.
  Xác nhận đúng.
- Bất biến #2 (mọi phần tử có key `chiTiet`): `.map()` luôn set `chiTiet: chiTietTheoId.get(...) ?? null`
  — không có nhánh nào bỏ field. Xác nhận đúng, có test trực tiếp.
- Bất biến #3 (ghép theo `id`, không theo vị trí): dùng `Map<string, ...>` khóa bằng `id`, không dùng
  index mảng. Xác nhận đúng.
- Bất biến #4 (đọc theo lô ≤ 1000 qua `chiaLo`): `CO_LO_DOC_DETAIL = 1000`, dùng `chiaLo(ids, ...)`.
  Xác nhận đúng, có test trực tiếp (1001 → 2 lượt gọi 1000+1).
- Bất biến #6 (`GET /to-khai/hoa-don` không đổi gì ngoài diễn giải mã cũ): `git diff` cho thấy dòng
  duy nhất đổi trong `layBangKeTheoKy` là `chiTieuTangGiam: dienGiaiChiTieuTangGiam(gan.chi_tieu_tang_giam)`
  thay cho `gan.chi_tieu_tang_giam ?? ""` — không đổi gì khác trong hàm này. Xác nhận đúng.
- Mapping `chieu → view` (`purchase → vct60view`, `sold → vct50view`) trong `locChiTietTheoId` khớp
  đúng chiều với mọi chỗ khác dùng cùng quy ước trong `gdt.service.ts` (grep xác nhận, không bị đảo
  ngược).
- Route mới `/hoa-don/chi-tiet` dùng đúng `guard()` (authenticate + `requireModule("tokhai")`) — y hệt
  mảng dùng cho mọi route khác trong `toKhai.route.ts`, không có guard rút gọn/thiếu.
- `tinhGtgt01.ts` (công thức chỉ tiêu 01/GTGT, gồm `ct37`/`ct38`) — grep xác nhận KHÔNG có tham chiếu
  nào tới `chiTieuTangGiam`/`chi_tieu_tang_giam`; `ct37`/`ct38` chỉ đọc từ `CT_NHAP_TAY` (ghi đè tay).
  Xác nhận BR-to-khai-gtgt01-002 (hai cơ chế độc lập) đúng bằng đọc code, không chỉ bằng test.

### Bảng TC → kết quả (tầng Backend)

Chỉ liệt kê TC có phần việc thuộc tầng BE trong đợt này. TC thuần `FE-manual`/`FE-build`/`Excel-manual`
(001, 002, 003, 011, 011b, 013, 015, 016, 021, 022 phần FE, 023 phần FE, 033, 034, 039, 040) đánh
**Chưa chạy — chờ vòng FE**, không lặp lại chi tiết ở đây (xem `test-matrix.md` cho đầy đủ).

| TC ID | Kết quả | Ghi chú |
|---|---|---|
| TC-004 | 🟡 Pass gián tiếp | Bất biến #1 (tập+thứ tự trùng `layBangKeTheoKy`) xác nhận bằng test `"tập id + thứ tự trùng bảng kê..."` trong `bangKeChiTiet.test.ts` — đảm bảo 2 sheet không thể lệch tập vì cùng 1 response. Phần dựng Excel thật (Excel-manual) chưa chạy |
| TC-005 | 🟡 Pass gián tiếp | Tương tự TC-004, đối xứng `chieu=sold` |
| TC-006 | ✅ Pass | Test trực tiếp: hóa đơn `tthai=4` không lọt `datas` |
| TC-007 | ✅ Pass | Test trực tiếp: hóa đơn `tthai=6` không lọt `datas` |
| TC-008 | ⛔ Chưa chạy | Cần DB Postgres thật với hóa đơn thay thế có `tdlap` ngoài ranh giới kỳ nhưng đã gán — mock hiện tại không mô phỏng `khoangDocBangKe` nới khoảng thật (luôn trả `tu=null, den=null`). Code review: hành vi kế thừa nguyên vẹn từ `layBangKeTheoKy` (không đổi trong đợt này) nên rủi ro thấp, nhưng chưa có bằng chứng test |
| TC-009 | ⛔ Chưa chạy | Hành vi kế thừa từ `layBangKeTheoKy` (lọc theo `daGan`, không theo khoảng ngày) — không đổi trong đợt này, không có test riêng trong 2 file mới. Rủi ro thấp (code không đổi) nhưng chưa có bằng chứng test trực tiếp cho endpoint mới |
| TC-010 | ✅ Pass | Test trực tiếp: `keKhai=false` vẫn có mặt kèm `chiTiet` |
| TC-012 | ⛔ Chưa chạy | Cần build Excel thật (FE) để xác nhận sheet vẫn tạo đủ tiêu đề; phần BE (response `200` rỗng cho 1 chiều) cùng code path với TC-012b đã pass |
| TC-012b | ✅ Pass (phần BE) | Test trực tiếp: kỳ chưa từng "Kê khai" → `{ total: 0, datas: [], thayThe: [] }`, không gọi `findMany` đọc detail (`loGoi.length === 0`) |
| TC-017 | 🟡 Pass gián tiếp | Helper `dienGiaiChiTieuTangGiam` (nguồn diễn giải DUY NHẤT, dùng chung `GET /hoa-don` và `/hoa-don/chi-tiet`) có 5 test trực tiếp pass. Phần so sánh web ↔ Excel (Excel-manual) chưa chạy |
| TC-018 | ✅ Pass (phần BE) | Test trực tiếp: hóa đơn `chiTiet: null` khi chưa tải chi tiết — key `chiTiet` vẫn có mặt, giá trị `null`. Phần render cột Excel (Excel-manual) chưa chạy |
| TC-019 | ⛔ Chưa chạy | Cần 2 tenant DB thật (không có Postgres dev trong môi trường này). Code review: `resolveTenantDb(request)` lấy DB từ `req.user.donViId` đã xác thực phía server (không nhận tham số tenant từ client) — **kiến trúc giống hệt** mọi route khác trong `toKhai.route.ts` (đã có tenant isolation từ trước, không phải logic mới của đợt này). Rủi ro thấp nhưng chưa có bằng chứng test trực tiếp cho route mới |
| TC-020 | ✅ Pass (code review) | `git diff` xác nhận dòng thay đổi DUY NHẤT trong `layBangKeTheoKy` là công thức diễn giải `chiTieuTangGiam` — không route/controller/query nào khác của `GET /to-khai/hoa-don` bị đụng. Không đo hiệu năng thực tế (cần môi trường có traffic) |
| TC-022/023 (phần BE) | ✅ Pass | Happy-path PATCH `"37"`/`"38"` được `locQuyetDinh` giữ nguyên — test `"giữ đúng ba field hợp lệ"` (dùng `"37"`). Vòng roundtrip đầy đủ (PATCH → DB → GET lại) cần DB thật, chưa chạy |
| TC-024 | ✅ Pass | `dienGiaiChiTieuTangGiam("tang") === "38"` |
| TC-025 | ✅ Pass | `dienGiaiChiTieuTangGiam("giam") === "37"` |
| TC-026 | ✅ Pass | `locQuyetDinh({ chiTieuTangGiam: "tang" })` → không có key `chiTieuTangGiam` |
| TC-027 | ✅ Pass | Tương tự TC-026, `"giam"` |
| TC-028 | ✅ Pass | Regression: `"xoay"` vẫn bị loại sau khi đổi whitelist |
| TC-029 | ✅ Pass | `"39"` (ngoài tập `{"","37","38"}`) bị loại |
| TC-030 | ✅ Pass | Combo mã cũ + field hợp lệ khác — field hợp lệ vẫn giữ, `chiTieuTangGiam` bị bỏ |
| TC-031 | ✅ Pass | Regression: chuỗi rỗng vẫn hợp lệ |
| TC-032 | 🟡 Pass gián tiếp | Grep xác nhận `tinhGtgt01.ts` không đọc `chiTieuTangGiam`/`chi_tieu_tang_giam` — cách ly cơ chế đúng BR-002. Vòng tích hợp thật (đổi giá trị rồi soi form tờ khai) cần DB + FE, chưa chạy |
| TC-035 | ⛔ Chưa chạy | Cần DB thật để kiểm giá trị cột `chi_tieu_tang_giam` sau khi PATCH — logic ghi (`locQuyetDinh`/`capNhatQuyetDinh`) đã unit-test đúng, nhưng chưa xác nhận trên dữ liệu thật |
| TC-036 | ✅ Pass | Toàn bộ `quyetDinhKeKhai.test.ts` pass sau khi sửa whitelist (17/17) |
| TC-037 | ✅ Pass | `npm test` — không có fail mới ngoài 4 fail baseline đã xác nhận không liên quan |
| TC-038 | ✅ Pass | `typecheck` + `lint` đều 0 lỗi |
| TC-041 | ✅ Pass | `tinhGtgt01.test.ts` 22/22 pass — không đổi hành vi |
| TC-042 | ✅ Pass | Test trực tiếp: mọi phần tử `datas` có `"chiTiet" in item === true` |
| TC-043 | 🟡 Pass gián tiếp | `layBangKeChiTietTheoKy` gọi `layBangKeTheoKy` nguyên vẹn (không sort/filter lại) — về mặt code, 2 endpoint cùng tham số kỳ luôn ra cùng tập+thứ tự vì gọi CHUNG một hàm. Chưa có test gọi thật 2 request HTTP riêng rồi so `id[]` (cần DB thật để có dữ liệu ổn định giữa 2 lượt gọi) |
| TC-044 | ✅ Pass | Route test: `nam=abc` → `400` đúng message; test thêm case thiếu `kySo` cũng `400` đúng message |
| TC-045 | ✅ Pass | Route test: `chieu=xyz` → `400` đúng message |
| TC-046 | ⚠️ Chưa chạy trực tiếp cho route mới | Route test mock `authenticate` luôn thành công (không test case thiếu JWT cho riêng route này). Guard dùng chung `fastify.authenticate` — plugin đã có test coverage ở nơi khác của hệ thống, không phải logic mới. Rủi ro thấp nhưng nên bổ sung 1 case 401 trực tiếp cho route này để khép kín |
| TC-047 | ⚠️ Chưa chạy trực tiếp cho route mới | Tương tự TC-046: route test mock `requireModule` luôn cho qua. Guard dùng chung pattern `guard()` với mọi route khác trong file. Rủi ro thấp, nên bổ sung 1 case 403 |
| TC-048 | ✅ Pass | Route test: 20 lượt đầu `200`, lượt 21 `429` |

**Chú giải**: ✅ Pass (test tự động trực tiếp) · 🟡 Pass gián tiếp (suy ra chắc chắn từ code review + test
liên quan, không phải test trực tiếp đúng kịch bản TC) · ⚠️ Gap nhỏ (rủi ro thấp, có pattern tương tự đã
test ở nơi khác nhưng route mới chưa có test riêng) · ⛔ Chưa chạy (cần DB Postgres thật hoặc FE, ghi rõ
lý do).

### Kết luận vòng Backend

**Backend PASS để sang code-review.** Căn cứ:

- `typecheck`/`lint` sạch tuyệt đối (0 lỗi) cho toàn repo; 0 warning mới trong `to_khai/`.
- Suite `to_khai/` 221/221 pass; suite toàn repo 1206/1210 pass thật sự (loại 13 skip không liên quan)
  — 4 fail còn lại xác nhận độc lập là baseline có sẵn ở mô-đun HRM, KHÔNG phải regression của đợt này.
- 24 test mới/sửa (7 + 6 + 11) đều pass, phủ đúng các bất biến quan trọng nhất theo `api-contract.md`
  Mục 2.4 (tập/thứ tự, key `chiTiet` tường minh, loại tthai=4/6, lô ≤1000) và whitelist ghi Task 2.
- Code review đối chiếu từng dòng diff với bất biến hợp đồng — không phát hiện sai lệch nào (mapping
  chiều↔view đúng, guard đúng, `tinhGtgt01` không bị đụng, response `GET /to-khai/hoa-don` chỉ đổi đúng
  1 biểu thức).
- **0 bug được tìm thấy** trong đợt kiểm thử này (xem `issues-and-bugs.md`).

**Không chặn merge nhưng cần theo dõi** (không phải bug — do giới hạn môi trường QA, không phải lỗi
code): TC-008, TC-009, TC-019, TC-020 (đo hiệu năng thật), TC-035, TC-043 (E2E thật) cần DB Postgres
dev có seed dữ liệu mới chạy được; TC-046/TC-047 nên có thêm 1 test route trực tiếp mỗi cái dù rủi ro
thấp. Chi tiết + dữ liệu cần seed liệt kê ở `issues-and-bugs.md` Mục "Issues còn tồn đọng".

**Ngoài phạm vi vòng này** (đã xác nhận đúng phân công theo `work-log.md`): toàn bộ Task 1 (4/6 sheet
Excel, nút "Xuất Excel", double-click guard) và phần FE của Task 2 (dropdown, hiển thị) chưa có code —
sẽ kiểm ở vòng Frontend riêng khi `frontend-engineer` hoàn thành.

## Vòng Frontend 2026-09-16

**Phạm vi**: `hdđt_maxv/` (8 file đã sửa theo `work-log.md` mục frontend-engineer). Không mở trình
duyệt trong phiên này (yêu cầu điều phối: phần kiểm tay do user tự làm — xem checklist cuối mục này).
Không ghi DB, không sửa production code.

### Lệnh đã chạy độc lập + số liệu thật

| # | Lệnh | Kết quả thật |
|---|---|---|
| 1 | `cd hdđt_maxv && npm run lint` (`eslint .`) | **PASS** — 0 lỗi, 0 warning (output rỗng), chạy lại sau fix RVW-T09/T10/T11 vẫn 0 lỗi |
| 2 | `cd hdđt_maxv && npm run build` (`tsc -b && vite build`) | **PASS** — exit code 0, `grep -c "error TS"` trên log = 0. Chunk `ToKhai-*.js` = 28.17 kB (lần chạy sau fix; lần đầu 28.11 kB); `exceljs.min-*.js` (~930 kB) vẫn tách chunk lazy riêng, KHÔNG nằm trong `ToKhai-*.js` — xác nhận RVW-T02 (lazy-load exceljs) không bị phá |

**Không có test runner trong `hdđt_maxv`** (đúng ghi nhận `test-matrix.md`) — không có `npm test` để chạy.

### ⚠️ Sai sót ở lần chạy script đầu tiên — assertion #4 (thứ tự sheet) kỳ vọng SAI

Lần chạy đầu, script tự **dựng lại** trình tự gọi (`themSheetHd`/`themSheetChitiết` mô phỏng theo cặp
purchase-HĐ+purchase-CT rồi sold-HĐ+sold-CT liền nhau) thay vì gọi hàm export thật, và assertion #4 kỳ
vọng đúng theo trình tự ĐÓ (`"HĐ mua vào", "Chi tiết mua vào", "HĐ bán ra", "Chi tiết bán ra"`) — trình
tự này **trái FR-to-khai-gtgt01-001/AC-001** (đúng phải là 2 sheet "HĐ..." liền nhau rồi mới tới 2 sheet
"Chi tiết..."). Vì script tự đặt ra kỳ vọng khớp với chính cách nó dựng lại (thay vì đối chiếu với code
thật), assertion "PASS" đó **không có giá trị phát hiện lỗi** — code-reviewer mới là người bắt được
sai lệch thật này (RVW-T09 🔴, xem `review-findings.md`), không phải QA. Bài học: khi hàm dựng workbook
không export được, KHÔNG được tự suy trình tự gọi rồi tự chấm PASS theo trình tự tự suy đó.

frontend-engineer đã sửa (RVW-T09 FIXED 2026-09-16): tách `themSheetBangKeChiTiet` thành
`themSheetHd`/`themSheetChiTiet`; `xuatToKhaiGtgt01` (`xuatToKhaiExcel.ts`:251-254) gọi
`themSheetHd(purchase)` → `themSheetHd(sold)` → `themSheetChiTiet(purchase)` → `themSheetChiTiet(sold)`.

### Script kiểm Excel v2 — gọi THẲNG hàm export thật `xuatToKhaiGtgt01()`, không tự dựng lại trình tự

Theo yêu cầu điều phối sau khi phát hiện sai sót trên: viết lại script để gọi **hàm export thật**
(`xuatToKhaiGtgt01`) thay vì lắp ráp lại các hàm nội bộ theo trình tự tự chọn. Chỉ mock 2 điểm I/O
ngoài tầm (network, tải file DOM) qua loader `shim-loader.mjs`, để CHÍNH `xuatToKhaiGtgt01` (gồm cả
`Promise.all` 2 lượt song song, thứ tự gọi `themSheetHd`×2 rồi `themSheetChiTiet`×2, throw trước khi
dựng workbook khi 1 chiều lỗi) chạy 100% mã thật, không viết lại trong test:

- **`src/config/api.ts`**: như lần trước, `import.meta.env.VITE_API_URL` là `undefined` dưới Node
  thuần (Vite-only) → stub `API_BASE` cố định.
- **`src/lib/http.ts`** (MỚI, thay vì stub `api/toKhai.ts`/`api/traCuuGoc.ts` như dự tính ban đầu): đây
  là điểm nghẽn DUY NHẤT mọi module `api/*.ts` gọi qua — mock ở đây giữ `getBangKeChiTiet`
  (`api/toKhai.ts`) và `getDanhMucTraCuuGoc` (`api/traCuuGoc.ts`) là hàm THẬT, chỉ thay `apiFetch()` bên
  trong bằng route theo path đọc dữ liệu mẫu từ `globalThis.__QA_FIXTURES__` (set trước khi gọi). Tránh
  phải liệt kê thủ công toàn bộ export của `api/toKhai.ts` mà `OQuyetDinh.tsx` → `api/toKhaiQueries.ts`
  cũng cần (nếu stub riêng module đó, ESM sẽ `SyntaxError: does not provide an export named ...` khi
  thiếu 1 export nào bị nhánh khác dùng).
- **`src/lib/downloadFile.ts`**: `luuVeMay()` dùng `document`/`URL.createObjectURL` (DOM, không có
  trong Node) → stub ghi `blob.arrayBuffer()` vào `globalThis.__QA_CAPTURE__` thay vì tải file.
- **Giới hạn tooling phát sinh thêm (không phải bug sản phẩm)**: `xuatToKhaiExcel.ts` dùng
  `const { Workbook } = await import("exceljs")` (bare specifier, dynamic) — Vite pre-bundle CJS→ESM
  đúng cách nên hoạt động trong browser thật (8 chỗ khác trong repo cùng pattern, build đã pass); dưới
  Node ESM thuần, `cjs-module-lexer` KHÔNG suy được named export `Workbook` cho gói `exceljs` (thực
  nghiệm: `import("exceljs")` chỉ cho `{ default, "module.exports" }`) → `TypeError: ... is not a
  constructor`. Thêm 1 `resolve` hook trong loader CHỈ áp cho specifier `"exceljs"` gọi từ
  `xuatToKhaiExcel.ts`, trỏ sang 1 shim tự tay `export const Workbook = ExcelJS.Workbook` từ
  `default` — không đổi hành vi, chỉ vá giới hạn interop CJS/ESM của Node loader.

**Kịch bản dữ liệu mẫu**: giống lần trước (hóa đơn A/B/C/D, trùng ngày lập B/C, D `chiTiet:null`, mã
37/38/rỗng, chiều `sold` rỗng) + `ban.phuLuc` khác null (để xác nhận sheet "PL 204-2025" đúng vị trí) +
1 lượt gọi thứ hai với `throwOn: "sold"` để kiểm nhánh lỗi qua đúng `Promise.all` thật.

**Kết quả: 11/11 assertion pass** (script: `excelSheetCheckV2.ts`, gọi thẳng `xuatToKhaiGtgt01`):

| # | Assertion | Kết quả |
|---|---|---|
| 1 | `xuatToKhaiGtgt01()` gọi `luuVeMay()` đúng 1 lần (happy path) | PASS |
| 2 | **Thứ tự 6 sheet ĐÚNG FR-001/AC-001** — `01-GTGT, PL 204-2025, HĐ mua vào, HĐ bán ra, Chi tiết mua vào, Chi tiết bán ra` — xác minh bằng CHẠY hàm thật, không tự dựng lại | PASS |
| 3 | STT sheet "HĐ mua vào" = 1,2,3,4 đúng thứ tự A,B,C,D | PASS |
| 4 | Cột "Chỉ tiêu tăng giảm" ra mã thô `["37","38","","37"]` | PASS |
| 5 | Hóa đơn C ("Không kê khai") vẫn có mặt, STT=3 | PASS |
| 6 | Tổng dòng "Chi tiết mua vào" = 2(A)+1(B)+1(C)+1(D) = 5 — không đổi sau khi tách `themSheetHd`/`themSheetChiTiet` | PASS |
| 7-8 | Chiều rỗng: "HĐ bán ra" và "Chi tiết bán ra" có tiêu đề, 0 dòng dữ liệu | PASS |
| 9 | 1 chiều lỗi (sold) → `xuatToKhaiGtgt01()` reject thật (không nuốt lỗi) | PASS |
| 10 | Message lỗi nêu đúng chiều hỏng ("Không tải được dữ liệu hóa đơn bán ra: ...") | PASS |
| 11 | 1 chiều lỗi → KHÔNG gọi `luuVeMay()` (không tải file dở dang) | PASS |

**CỐ Ý KHÔNG assert** trong v2: nội dung/cột của sheet "Chi tiết..." (đặc biệt STT) — xem mục kế tiếp.

### ✅ RVW-T12 đã fix — chạy lại TC-011/TC-011b PASS + phát hiện thêm 1 bug (MST/Tên đối tác trống)

Vòng trước, QA ghi nhận ISSUE-004 (Low): sheet "Chi tiết mua vào/bán ra" không có cột "STT" riêng.
Code-reviewer nâng thành RVW-T12 🔴 BLOCKING (FR-to-khai-gtgt01-004/AC-to-khai-gtgt01-007 yêu cầu cột STT
tường minh). **frontend-engineer đã sửa**: thêm hằng `COT_STT_CHI_TIET` (`xuatToKhaiExcel.ts`, key
`"stt"`, header `"STT"`, `value: (r) => r.stt` — đọc STT hóa đơn CHA do `toDetailRows` gán, KHÔNG phải
tham số thứ 2 của `value` là số dòng); `themSheetChiTiet` dựng sheet với
`[COT_STT_CHI_TIET, ...detailColumns(chieu)]` — cột STT ở đầu, nguyên `detailColumns` phía sau, KHÔNG
đụng module `hddt` dùng chung (tab "Chi tiết hoá đơn" của HĐĐT không có cột này).

**Đồng thời, frontend-engineer sửa 1 bug khác user báo cùng lúc**: cột MST/Tên đối tác trống trên bảng
kê web VÀ sheet "HĐ..." — xem BUG-001 ở `qa/issues-and-bugs.md`.

**Chạy lại `excelSheetCheckV2.ts`** (mở rộng thêm assertion cột STT sheet Chi tiết + cột đối tác sheet
HĐ + 1 hóa đơn thật cho chiều bán ra, tách riêng lượt "chiều rỗng" — script vẫn gọi THẲNG hàm export
thật `xuatToKhaiGtgt01()`, không tự dựng lại). **Kết quả: 25/25 assertion pass**:

| # | Assertion | Kết quả |
|---|---|---|
| 1 | `luuVeMay()` gọi đúng 1 lần (happy path) | PASS |
| 2 | Thứ tự 6 sheet đúng FR-001/AC-001 (regression) | PASS |
| 3 | STT sheet "HĐ mua vào" = 1,2,3,4 | PASS |
| 4 | Cột "Chỉ tiêu tăng giảm" mã thô 37/38/rỗng | PASS |
| 5 | Hóa đơn "Không kê khai" vẫn có mặt | PASS |
| 6 | **TC-049**: cột "MST người bán/MST người xuất hàng" đúng `nbmst` từng hóa đơn (A/B/C/D 4 giá trị khác nhau) dù fixture KHÔNG có `mstDoiTac` | PASS |
| 7 | **TC-049**: cột "Tên người bán/Tên người xuất hàng" đúng `nbten` từng hóa đơn | PASS |
| 8 | **TC-050**: sheet "HĐ bán ra" cột "MST người mua/MST người nhận hàng" đúng `nmmst`, KHÔNG trống | PASS |
| 9 | **TC-050**: cột "Tên người mua/Tên người nhận hàng" đúng `nmten`, KHÔNG trống | PASS |
| 10 | Sheet "Chi tiết mua vào" có cột "STT" ở cột 1 (RVW-T12) | PASS |
| 11 | **TC-011**: cột "STT" = `[1,1,2,3,4]` — 2 dòng hàng hóa đơn A cùng STT=1, khớp STT hóa đơn cha ở sheet "HĐ..." | PASS |
| 12 | **TC-011**: 2 dòng hóa đơn A cùng "Số hóa đơn"=101, STT bằng nhau | PASS |
| 13 | **TC-011b**: hóa đơn D (`chiTiet:null`) — STT=4 đúng vị trí, "Mã VT"/"Tên hàng hóa, dịch vụ" trống, "Số hóa đơn" vẫn =104 | PASS |
| 14 | Tổng dòng "Chi tiết mua vào" = 5 (không đổi sau khi thêm cột STT) | PASS |
| 15 | Sheet "Chi tiết bán ra" cũng có cột "STT" | PASS |
| 16 | **TC-011** (chiều bán ra): STT hóa đơn E = 1 | PASS |
| 17-19 | Nhánh lỗi 1 chiều (sold) — reject thật, message đúng chiều, không tải file (regression E-001) | PASS |
| 20 | Chiều rỗng cả 2 chiều: vẫn gọi `luuVeMay()`, không lỗi (regression) | PASS |
| 21 | Chiều rỗng: vẫn đủ 6 sheet đúng thứ tự | PASS |
| 22-25 | Chiều rỗng: cả 4 sheet "HĐ.../Chi tiết..." có tiêu đề cột, 0 dòng dữ liệu (regression AC-004/BR-005) | PASS |

**TC-to-khai-gtgt01-011 và TC-to-khai-gtgt01-011b: ✅ PASS** (assertion #11-13 ở trên). **TC-049/TC-050:
✅ PASS** (assertion #6-9).

`lint`/`build` chạy lại lần 3 (sau fix RVW-T12 + bug MST/Tên đối tác): **PASS**, 0 lỗi cả hai — chunk
`ToKhai-*.js` = 28.17 kB (không đổi so với lần 2).

### Đối chiếu code (đọc, không chỉ tin work-log)

- **E-to-khai-gtgt01-001** (1 chiều lỗi → hủy toàn bộ, không tải file, toast đúng chiều): xác nhận qua
  đọc `xuatToKhaiExcel.ts` — `Promise.all([taiChiTietTheoChieu(ky,"purchase"), taiChiTietTheoChieu(ky,"sold"), getDanhMucTraCuuGoc().catch(()=>undefined)])`
  chạy TRƯỚC `await import("exceljs")` — một lượt lỗi thì `Promise.all` reject ngay, không chạm tới
  exceljs, không tải file dở dang. `taiChiTietTheoChieu` bọc lỗi thành
  `Error("Không tải được dữ liệu hóa đơn {chiều}: {message gốc}")`, và `getErrorMessage()` (dùng ở
  `bamXuatExcel`'s catch) đọc đúng `.message` này kể cả khi lỗi gốc là mất mạng (`TypeError` được
  `taiChiTietTheoChieu` tự đổi sang câu tiếng Việt "Không kết nối được máy chủ..." TRƯỚC khi bọc thêm
  tên chiều) — nên toast luôn có cả tên chiều lẫn message dễ hiểu, đúng ví dụ ở api-contract Mục 2.6.3.
- **FR-to-khai-gtgt01-005/NFR-001** (khóa nút, mở lại trong `finally`): `ToKhaiGtgt01Editor.tsx` —
  `setDangXuatExcel(true)` chạy NGAY đầu `bamXuatExcel` (trước `await`), `finally { setDangXuatExcel(false) }`
  đảm bảo mở lại dù thành công hay lỗi; nút `disabled={!ban || dangChay || chuaLuu || dangXuatExcel}`.
  Race-condition thật của double-click cực nhanh (2 click trong cùng khung hình trước khi React commit
  `disabled`) là hành vi trình duyệt/React, KHÔNG kiểm được bằng Node script — chuyển sang checklist tay
  (TC-016), kiểm qua tab Network đếm đúng 2 request `/to-khai/hoa-don/chi-tiet` thay vì 4.
- **Dropdown "Chỉ tiêu tăng giảm"** (`OQuyetDinh.tsx`): `CHI_TIEU_OPTIONS` đúng 3 mục `""`/`"37"`/`"38"`
  với nhãn "—"/"37 — Giảm"/"38 — Tăng"; `onChange` gửi thẳng `e.target.value` (đã typed
  `"" | "37" | "38"`) vào PATCH — không có bước chuyển đổi/label nào chen giữa có thể gửi sai giá trị.
- **Dùng chung logic dựng dòng bảng kê** (không nhân đôi, Constraint mục 7 api-contract): cả
  `BangKeMotChieu.tsx` (bảng web) và `xuatToKhaiExcel.ts` (sheet "HĐ...") cùng gọi
  `toKhaiRowsFromBangKe()` (`ky.ts`) — xác nhận qua diff, không có bản sao logic ánh xạ nào khác.
- **Lỗi lấy danh mục tra cứu NCC bị nuốt** (`getDanhMucTraCuuGoc().catch(() => undefined)`): đúng thiết
  kế — spec KHÔNG yêu cầu chặn cả lượt xuất khi danh mục NCC lỗi (E-to-khai-gtgt01-001 chỉ áp cho 2
  lượt `/chi-tiet`); lỗi này chỉ làm cột "URL tra cứu hóa đơn gốc" lùi về registry FE tĩnh
  (`traCuuNcc.ts`), không ảnh hưởng cột nào khác, không chặn export — chấp nhận được theo spec.
- **BUG-001 (MST/Tên đối tác trống, xem `issues-and-bugs.md`)**: `getBangKe`/`getBangKeChiTiet`
  (`features/to_khai/api/toKhai.ts`) nay `await apiFetch(...)` rồi `mapInvoiceDatas(chieu, raw.datas)`
  trước khi trả về — `mapInvoiceDatas` (export mới từ `hddt/api/gdt.ts`, TÁI DÙNG đúng hàm
  `getInvoices`/`getSavedInvoices` bên HĐĐT đã dùng, không viết bản thứ hai) gộp `mstDoiTac`/
  `tenDoiTac` từ `PARTNER_FIELD[direction]` (`purchase → nbmst/nbten`, `sold → nmmst/nmten`). Vì
  `getBangKe` cũng đi qua đường này, bảng kê WEB và sheet "HĐ..." dùng chung 1 nguồn gộp field — không
  thể lệch nhau về 2 cột này.

### Kết luận vòng Frontend

**Frontend PASS phần tự động, gồm cả RVW-T12 và BUG-001.** `lint`/`build` sạch tuyệt đối (3 lần chạy: gốc,
sau fix RVW-T09/T10/T11, sau fix RVW-T12+BUG-001). Script v2 gọi thẳng hàm export thật
`xuatToKhaiGtgt01()` — 25/25 assertion pass, xác nhận đúng thứ tự 6 sheet (FR-001/AC-001), cột "STT"
mới ở sheet "Chi tiết..." (RVW-T12/TC-011/TC-011b), cột MST/Tên đối tác có dữ liệu đúng cả 2 chiều
(TC-049/TC-050/BUG-001), và nhánh lỗi E-001 + chiều rỗng vẫn đúng sau các lần sửa (regression). Code
review đối chiếu diff với FR-005/dropdown/dùng-chung-logic đều khớp thiết kế.

**Không còn treo** — TC-to-khai-gtgt01-011/011b và TC-049/050 đều đã PASS.

**Phần BẮT BUỘC kiểm tay trên trình duyệt (chưa làm trong vòng này)** — xem checklist chi tiết bên
dưới. Đây là hành vi UI/network-timing (spinner, double-click race, DevTools Offline, F5 reload) mà
Node script không mô phỏng được.

### Checklist kiểm tay cho user

> Mở `hdđt_maxv` (`npm run dev`), vào màn Tờ khai, chọn 1 kỳ đã có hóa đơn gán ở cả hai chiều. Với mỗi
> bước: tick Đạt/Không đạt + ghi chú nếu có bất thường.

| # | Bước làm | Kỳ vọng | Đạt / Không đạt | Ghi chú |
|---|---|---|---|---|
| 1 | Mở dropdown "Chỉ tiêu tăng giảm" trên 1 dòng bảng kê | Đúng 3 mục: "—", "37 — Giảm", "38 — Tăng" | ☐ | |
| 2 | Chọn "38 — Tăng" cho 1 hóa đơn, đợi lưu xong, bấm F5 (reload trang) | Dropdown vẫn hiển thị "38 — Tăng" sau khi tải lại (không rơi về "—") | ☐ | |
| 3 | (Nếu tenant có sẵn hóa đơn cũ `chi_tieu_tang_giam = "tang"`/`"giam"` trước đợt đổi mã) Mở bảng kê | Hóa đơn đó hiển thị đúng "38 — Tăng"/"37 — Giảm" (không hiện rỗng, không lỗi) — bỏ qua bước này nếu tenant test không có dữ liệu cũ | ☐ | |
| 4 | Bấm nút "Xuất Excel" | Icon nút đổi thành spinner ngay lập tức (không có độ trễ "đứng im"), nút chuyển xám/disabled | ☐ | |
| 5 | Mở file `.xlsx` vừa tải, đếm sheet | Đúng 6 sheet (hoặc 5 nếu kỳ không có phụ lục): "01-GTGT", ("PL 204-2025"), "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra" — đúng thứ tự | ☐ | |
| 6 | Trong sheet "HĐ mua vào"/"HĐ bán ra": đếm số dòng dữ liệu | Bằng đúng tổng số hóa đơn của kỳ trên bảng kê web (không chỉ số dòng đang xem 1 trang màn hình) | ☐ | |
| 7 | **[BUG-001, đã fix]** Trên BẢNG KÊ WEB tại tab Tờ khai (KHÔNG phải Excel): xem cột "MST người bán/MST người xuất hàng" + "Tên người bán/Tên người xuất hàng" ở tab mua vào, và "MST người mua/MST người nhận hàng" + "Tên người mua/Tên người nhận hàng" ở tab bán ra | Cả 4 cột có dữ liệu (MST/tên đối tác), KHÔNG trống ở bất kỳ dòng nào | ☐ | |
| 8 | Trong sheet "HĐ mua vào"/"HĐ bán ra" của file Excel vừa tải: xem đúng 4 cột đối tác nêu ở bước 7 | Có dữ liệu, KHÔNG trống; đối chiếu vài dòng với bảng kê web (bước 7) — giá trị phải khớp nhau (cùng nguồn `mapInvoiceDatas`) | ☐ | |
| 9 | Trong sheet "HĐ...": tìm 1 hóa đơn "Không kê khai" | Vẫn có mặt, cột "Kê khai/không kê khai" ghi đúng "Không kê khai" | ☐ | |
| 10 | Trong sheet "HĐ...": xem cột "Chỉ tiêu tăng giảm" | Hiện đúng "37"/"38"/rỗng (mã thô), KHÔNG phải "tang"/"giam"/"Tăng"/"Giảm" | ☐ | |
| 11 | So khớp STT: chọn 1 hóa đơn bất kỳ ở sheet "HĐ...", ghi lại cột STT (cột A) | (tiếp bước 12) | ☐ | |
| 12 | Sang sheet "Chi tiết..." tương ứng: xem cột "STT" ở CỘT A (cột đầu tiên, đứng trước cả "Mẫu số HD") | Giá trị cột "STT" của MỌI dòng thuộc hóa đơn đó (kể cả hóa đơn nhiều dòng hàng) bằng đúng STT ghi ở bước 11 | ☐ | |
| 13 | Tìm 1 hóa đơn CHƯA "Tải chi tiết" ở module Hóa đơn điện tử (nếu tenant có) trong sheet "Chi tiết..." | Vẫn có đúng 1 dòng, cột "STT" đúng vị trí, cột "Mã VT"/"Tên hàng hóa, dịch vụ" để trống, các cột thông tin hóa đơn (số HĐ, ngày lập, MST...) vẫn đầy đủ | ☐ | |
| 14 | Mở DevTools → tab Network → bật "Offline" → bấm "Xuất Excel" | KHÔNG có file nào được tải về; toast lỗi hiện đúng câu nêu rõ chiều hỏng (vd "Không tải được dữ liệu hóa đơn bán ra: ..."); nút "Xuất Excel" trở lại bình thường (hết spinner) | ☐ | |
| 15 | Tắt "Offline", double-click thật nhanh vào nút "Xuất Excel" (2 click liên tiếp < 300ms) | Chỉ 1 file `.xlsx` được tải về; tab Network chỉ thấy ĐÚNG 2 request `GET /to-khai/hoa-don/chi-tiet` (không phải 4); không có lỗi console | ☐ | |
| 16 | Ghi lại giá trị ô nhập tay chỉ tiêu [37] hoặc [38] trên form tờ khai đang mở, đổi "Chỉ tiêu tăng giảm" của 1-2 hóa đơn trong kỳ đó, đợi lưu xong, refresh dữ liệu tờ khai | Giá trị ô [37]/[38] KHÔNG đổi — hai cơ chế hoàn toàn độc lập | ☐ | |

**Điều kiện PASS toàn bộ vòng FE**: tất cả 16 bước trên đều "Đạt". Bất kỳ bước nào "Không đạt" → báo lại
kèm ảnh chụp màn hình/Network tab để mở BUG mới trong `issues-and-bugs.md`.

### Kết quả kiểm tay của user — 2026-09-16

User chạy checklist 16 bước ở trên trên trình duyệt thật (BE + FE dev, dữ liệu tenant thật): **16/16 Đạt**. Vòng Frontend PASS toàn bộ (tự động + kiểm tay).

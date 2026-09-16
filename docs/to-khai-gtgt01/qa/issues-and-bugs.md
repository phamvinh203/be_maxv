---
type: issues-and-bugs
feature: to-khai-gtgt01
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/qa/test-report.md
  - docs/to-khai-gtgt01/qa/test-matrix.md
  - docs/to-khai-gtgt01/architecture/api-contract.md
---

# Issues & Bugs: Xuất Excel kèm chi tiết hóa đơn & đổi mã "Chỉ tiêu tăng giảm"

## Bugs — Vòng Backend 2026-09-16

**Không có bug mở.**

Đã soát: 24 test BE mới/sửa (7 `bangKeChiTiet.test.ts` + 6 `toKhaiChiTietRoute.test.ts` + 11 bổ sung
`quyetDinhKeKhai.test.ts`) đều pass; đối chiếu từng dòng diff (`keKhaiKy.service.ts`,
`keKhaiKy.controller.ts`, `toKhai.route.ts`) với 6 bất biến ở `api-contract.md` Mục 2.4 — không phát
hiện sai lệch. `typecheck`/`lint` sạch (0 lỗi). 4 fail trong `npm test` xác nhận thuộc mô-đun HRM
(`hrmSettingsShiftsHolidaysApi.test.ts`), có sẵn từ trước, không nằm trong diff của đợt này. Chi tiết
số liệu ở `docs/to-khai-gtgt01/qa/test-report.md`.

## Issues còn tồn đọng (không phải bug — cần theo dõi/tiếp tục)

### ISSUE-001 — TC-008/009/019/020/035/043: cần DB Postgres dev thật để đóng hoàn toàn

- **Severity**: Low (rủi ro nghiệp vụ thấp — logic liên quan hoặc đã unit-test đủ, hoặc kế thừa
  nguyên vẹn từ code không đổi trong đợt này)
- **Mô tả**: Môi trường chạy QA đợt này không có kết nối Postgres dev khả dụng (không có `psql`,
  không set `DATABASE_URL` cho phiên chạy). 6 TC sau cần dữ liệu thật/2-tenant thật mới chạy được:
  - **TC-008** — hóa đơn thay thế có `tdlap` ngoài ranh giới lịch của kỳ nhưng đã gán kỳ đó, vẫn
    phải xuất hiện đủ ở `/chi-tiet`. Cần seed: 1 kỳ (vd T7/2026) có 1 hóa đơn gốc + 1 hóa đơn thay thế
    lập ngày T8/2026 nhưng gán vào kỳ T7.
  - **TC-009** — hóa đơn CHƯA gán kỳ (chưa bấm "Kê khai") dù `tdlap` nằm trong khoảng kỳ, không được
    xuất hiện ở `/chi-tiet`. Cần seed: 1 hóa đơn có `tdlap` trong kỳ nhưng KHÔNG có dòng
    `tokhai_ky_hoa_don` tương ứng.
  - **TC-019** — tenant isolation cho route mới `/hoa-don/chi-tiet`. Cần seed: 2 công ty (2 DB tenant
    khác nhau) cùng có kỳ trùng `nam/kyLoai/kySo` nhưng hóa đơn khác nhau; gọi endpoint với token của
    từng công ty, đối chiếu không rò rỉ chéo.
  - **TC-020** — đo thời gian phản hồi thật của `GET /to-khai/hoa-don` trước/sau khi thêm endpoint
    mới (hiện chỉ xác nhận bằng code review — không đo hiệu năng thực tế).
  - **TC-035** — sau khi PATCH đổi giá trị `chi_tieu_tang_giam` từ mã cũ (`"tang"`) sang mã mới
    (`"37"`), kiểm trực tiếp cột trong DB đã chuyển hẳn sang mã mới. Cần seed: 1 hóa đơn có sẵn
    `chi_tieu_tang_giam = 'tang'`.
  - **TC-043** — gọi thật 2 request HTTP (`GET /to-khai/hoa-don` và `GET /to-khai/hoa-don/chi-tiet`)
    liên tiếp trên cùng kỳ, so sánh mảng `id[]` đúng thứ tự. Cần seed: 1 kỳ có ≥ 5 hóa đơn.
- **Đề xuất seed chung**: 1 kỳ (vd T8/2026, `kyLoai=thang`, `kySo=8`) trên 1 tenant dev, ≥ 5 hóa đơn
  mua vào + ≥ 5 bán ra, trộn: có/chưa "Tải chi tiết" (`detail` null/non-null), có/không "Kê khai", có
  1 cặp `tthai=4`/`tthai=6`, 1 hóa đơn thay thế ngoài ranh giới lịch kỳ, 1 hóa đơn `chi_tieu_tang_giam
  = 'tang'` (dữ liệu cũ). Cộng thêm 1 tenant thứ 2 tối thiểu (1 công ty demo khác) cho riêng TC-019.
- **Trạng thái**: Open — chờ user/dev cấp môi trường DB dev có seed, hoặc chấp nhận rủi ro thấp (đã có
  code review + test gián tiếp) và bỏ qua khi merge.

### ISSUE-002 — TC-046/TC-047: route mới chưa có test 401/403 riêng

- **Severity**: Low
- **Mô tả**: `toKhaiChiTietRoute.test.ts` mock `authenticate` (luôn gán `req.user`) và `requireModule`
  (luôn cho qua `async () => async () => {}`) cho MỌI test — không có case nào thật sự thiếu JWT hoặc
  thiếu module `tokhai` cho riêng route `/hoa-don/chi-tiet`. Route dùng đúng mảng `guard()` chung với
  mọi route khác trong `toKhai.route.ts` (đã xác nhận qua code review, không phải guard rút gọn), nên
  rủi ro thực tế thấp — nhưng chưa có bằng chứng test trực tiếp khép kín Error Matrix cho route mới.
- **Đề xuất fix**: Backend-engineer (hoặc QA) bổ sung 2 test nhỏ vào `toKhaiChiTietRoute.test.ts`:
  1. Không set header `x-user` (hoặc mock `authenticate` ném lỗi/không set `req.user`) → mong đợi
     `401 { success: false, message }`.
  2. Mock `requireModule` trả preHandler ném `ForbiddenError` → mong đợi `403 { success: false, message }`.
- **Trạng thái**: Open — không chặn merge (đúng theo test-matrix TC-046/047 priority P1, không phải
  P0; hành vi đã đúng theo kiến trúc dùng chung, chỉ thiếu bằng chứng test trực tiếp).

### ISSUE-003 — Task 1 (Excel) và phần FE của Task 2 chưa có code

- **Severity**: N/A (không phải bug — đúng phân công theo `work-log.md`, backend chỉ làm endpoint
  nguồn dữ liệu `/hoa-don/chi-tiet`)
- **Mô tả**: Toàn bộ 4 sheet Excel, nút "Xuất Excel" (khóa/mở nút, double-click guard, toast lỗi theo
  chiều), dropdown "Chỉ tiêu tăng giảm" trên bảng kê web, và mọi TC thuộc tầng `FE-manual`/`FE-build`/
  `Excel-manual` trong `test-matrix.md` (001, 002, 003, 011, 011b, 012 phần FE, 013, 015, 016, 017 phần
  Excel, 018 phần Excel, 021, 022/023 phần FE, 033, 034, 039, 040) đều **Chưa chạy — chờ vòng FE**.
- **Trạng thái**: **CẬP NHẬT 2026-09-16 (vòng FE, chạy lại lần 2)** — `frontend-engineer` đã hoàn thành
  toàn bộ code (RVW-T09/T10/T11/T12 + BUG-001). Phần tự động (lint/build/script Excel, 25/25 assertion
  pass) đã PASS (xem `qa/test-report.md` mục "Vòng Frontend 2026-09-16"). Phần còn lại (TC-manual trên
  trình duyệt thật — spinner, DevTools Offline, double-click race, F5 reload, đối chiếu cột đối tác trên
  bảng kê web) do giới hạn phiên QA không mở được trình duyệt — đã bàn giao checklist kiểm tay chi tiết
  (16 bước, cập nhật thêm bước kiểm cột đối tác + cột STT mới) cho user tự thực hiện, xem
  `qa/test-report.md` mục "Checklist kiểm tay cho user".
- **ĐÓNG 2026-09-16**: user kiểm tay trên trình duyệt với dữ liệu thật — **16/16 bước Đạt**. ISSUE-003 closed.

## Bugs — Vòng Frontend 2026-09-16

**1 bug user báo (BUG-001, đã fix, xem chi tiết bên dưới) + 1 finding QA phát hiện (ISSUE-004, đã nâng
thành RVW-T12, đã fix)**. Cả hai đã có bằng chứng test lại PASS trong vòng chạy lại lần 2 (25/25
assertion, script gọi thẳng hàm export thật) — KHÔNG lặp lại chi tiết code ở đây, xem
`docs/to-khai-gtgt01/review-findings.md` cho RVW-T12 và mục BUG-001 ngay dưới.

Đã đối chiếu: `lint` (0 lỗi/warning, chạy 3 lần), `build` (`tsc -b && vite build`, exit 0, 0 lỗi TS, 3
lần), 2 script Node dựng + đọc lại file `.xlsx` thật bằng `exceljs`:
- Vòng 1 (`excelSheetCheck.ts`, gọi trực tiếp các hàm dựng sheet — **có sai sót**: assertion thứ tự
  sheet tự dựng lại trình tự nên không bắt được RVW-T09, xem `qa/test-report.md` mục "⚠️ Sai sót...").
- Vòng 2 lần 1 (`excelSheetCheckV2.ts`, gọi THẲNG hàm export thật `xuatToKhaiGtgt01()` sau khi RVW-T09
  fix — 11/11 assertion pass, CỐ Ý chưa assert cột STT sheet Chi tiết vì RVW-T12 đang sửa).
- Vòng 2 lần 2 (cùng script, mở rộng thêm assertion STT + cột đối tác + tách lượt "chiều rỗng" riêng,
  sau khi RVW-T12 + BUG-001 fix — **25/25 assertion pass**).

Và đọc code đối chiếu E-to-khai-gtgt01-001/FR-to-khai-gtgt01-005/dropdown/dùng-chung-logic-dựng-dòng
(chi tiết xem `qa/test-report.md`).

### BUG-001 — ✅ ĐÃ FIX — Cột MST/Tên đối tác trống trên bảng kê web + sheet "HĐ..." (user báo)

- **Severity**: High (dữ liệu nghiệp vụ cốt lõi bị trống — kế toán không đối chiếu được người mua/bán
  trên bảng kê lẫn Excel, dù không chặn hoàn toàn thao tác xuất file)
- **Environment**: `hdđt_maxv/` — màn Tờ khai, cả bảng kê web và sheet Excel "HĐ mua vào"/"HĐ bán ra"
- **Preconditions**: Kỳ có ≥ 1 hóa đơn đã gán (mua vào hoặc bán ra)
- **Steps to reproduce (trước fix)**:
  1. Mở tab Tờ khai, xem bảng kê mua vào hoặc bán ra.
  2. Quan sát cột "MST người bán/MST người xuất hàng" + "Tên người bán/Tên người xuất hàng" (mua vào)
     hoặc "MST người mua/MST người nhận hàng" + "Tên người mua/Tên người nhận hàng" (bán ra).
- **Expected result**: 4 cột trên có dữ liệu (MST/tên đối tác của từng hóa đơn).
- **Actual result (trước fix)**: Cả 4 cột trống trơn ở mọi dòng, cả trên web lẫn sheet "HĐ..." khi xuất
  Excel.
- **Suspected root cause**: `getBangKe`/`getBangKeChiTiet` (`features/to_khai/api/toKhai.ts`) gọi
  `apiFetch` rồi trả THẲNG kết quả — response BE (`GET /to-khai/hoa-don`, `GET /to-khai/hoa-don/
  chi-tiet`) chỉ có field GDT gốc `nbmst/nbten`/`nmmst/nmten`, KHÔNG có field gộp `mstDoiTac`/
  `tenDoiTac`. Trong khi đó `toDisplayRow` (`hddt/invoiceRow.ts`, dùng chung cho cả web và Excel qua
  `toKhaiRowsFromBangKe`) đọc TRỰC TIẾP `r.mstDoiTac`/`r.tenDoiTac` — hai field này `undefined` nên cột
  đối tác trống ở mọi nơi dùng `toDisplayRow`.
- **Fix**: `getBangKe`/`getBangKeChiTiet` nay đi qua `mapInvoiceDatas(chieu, raw.datas)` (hàm export
  MỚI từ `features/hddt/api/gdt.ts`, TÁI DÙNG đúng hàm `getInvoices`/`getSavedInvoices` bên module HĐĐT
  đã dùng lâu nay cho mục đích tương tự — không viết logic gộp field lần 2) trước khi trả kết quả. Vì
  `getBangKe` (bảng kê web) và `getBangKeChiTiet` (nguồn sheet "HĐ...") CÙNG đi qua 1 hàm, bảng kê web
  và Excel không thể lệch nhau về 2 cột này.
- **Evidence (đã kiểm chứng lại)**: TC-to-khai-gtgt01-049 (chiều mua vào) và TC-to-khai-gtgt01-050
  (chiều bán ra) trong `qa/test-cases.md`. Script `excelSheetCheckV2.ts` gọi THẲNG `xuatToKhaiGtgt01()`
  thật với fixture dữ liệu CHỈ có `nbmst/nbten`/`nmmst/nmten` (KHÔNG có `mstDoiTac`/`tenDoiTac` — đúng
  shape response BE thật, không để sót field gộp làm che bug lần nữa) — 4/4 assertion liên quan PASS:
  cột "MST người bán/MST người xuất hàng" = `["0300111222","0300111333","0300111444","0300111555"]`
  (4 hóa đơn khác nhau, không lặp/không trống), cột "Tên người bán/Tên người xuất hàng" đúng theo từng
  hóa đơn, cột "MST người mua/MST người nhận hàng" + "Tên người mua/Tên người nhận hàng" (chiều bán ra)
  đúng dữ liệu hóa đơn E, không trống.
- **Chưa kiểm chứng trên trình duyệt thật** (chỉ script Node) — checklist kiểm tay đã thêm bước 7-8
  (`qa/test-report.md`) để user xác nhận trên UI thật + dữ liệu tenant thật.
- **Trạng thái**: FIXED [2026-09-16] — `frontend-engineer`, commit "chưa commit". `lint`/`build` pass.

### ISSUE-004 — ✅ ĐÃ FIX (RVW-T12) — Sheet "Chi tiết mua vào/bán ra" không có cột "STT" riêng

- **Severity**: Đã ~~Low~~ → nâng 🔴 Blocking bởi code-reviewer (RVW-T12) → **nay đã FIXED**.
- **Mô tả gốc (QA phát hiện, vòng Frontend lần 1)**: `detailColumns(chieu)` (hạ tầng HĐĐT có sẵn) không
  khai báo cột nào tên "STT" cho bảng Chi tiết — số thứ tự hóa đơn chỉ lộ gián tiếp qua token đầu cột
  "Tên file hóa đơn (XML/HTML/PDF)". Code-reviewer đối chiếu FR-to-khai-gtgt01-004/AC-to-khai-gtgt01-007
  và nâng thành RVW-T12 🔴 BLOCKING (yêu cầu cột STT tường minh) — xem `review-findings.md`.
- **Fix đã áp dụng**: hằng `COT_STT_CHI_TIET` (`xuatToKhaiExcel.ts`, header `"STT"`, `value: (r) =>
  r.stt` — đọc STT hóa đơn CHA do `toDetailRows` gán). `themSheetChiTiet` dựng sheet với
  `[COT_STT_CHI_TIET, ...detailColumns(chieu)]` — cột STT ở đầu (cột A), nguyên `detailColumns` phía
  sau. KHÔNG đụng module `hddt` dùng chung (tab "Chi tiết hoá đơn" của HĐĐT không có cột này, đúng ý
  đồ ban đầu chỉ thêm riêng cho `to_khai`).
- **Evidence (đã kiểm chứng lại)**: TC-to-khai-gtgt01-011 và TC-to-khai-gtgt01-011b — script
  `excelSheetCheckV2.ts` (gọi thẳng `xuatToKhaiGtgt01()` thật) đọc lại file `.xlsx` thật: header cột 1
  sheet "Chi tiết mua vào"/"Chi tiết bán ra" = `"STT"`; cột "STT" 5 dòng của chiều mua vào =
  `[1,1,2,3,4]` (2 dòng hàng hóa đơn A cùng STT=1, khớp đúng STT hóa đơn cha ở sheet "HĐ mua vào");
  hóa đơn D (`chiTiet:null`) có STT=4 đúng vị trí, cột "Mã VT"/"Tên hàng hóa, dịch vụ" trống.
- **Trạng thái**: FIXED [2026-09-16] — `frontend-engineer`, commit "chưa commit". TC-to-khai-gtgt01-011/
  011b: ✅ **PASS**, xem `qa/test-report.md`.

## Tóm tắt

| Mục | Số lượng |
|---|---|
| Bug mở (cả 2 vòng Backend + Frontend) | 0 |
| Bug đã fix + đã kiểm chứng lại (BUG-001, RVW-T12/ISSUE-004) | 2 |
| Issue Low severity — Backend (cần DB dev / test bổ sung, không chặn merge) | 2 (ISSUE-001, ISSUE-002) |
| Việc tồn đọng — phần kiểm tay trình duyệt (bàn giao user) | 1 (ISSUE-003, cập nhật) |

**Khuyến nghị**: Backend PASS hoàn toàn. Frontend PASS phần tự động — RVW-T12 và BUG-001 đều đã fix +
kiểm chứng lại bằng script gọi hàm thật (25/25 assertion pass), không còn finding nào chặn merge. Phần
kiểm tay trên trình duyệt (checklist 16 bước ở `qa/test-report.md`, đã bổ sung bước kiểm cột đối tác +
cột STT) cần user tự xác nhận trước khi coi vòng FE hoàn tất 100%.

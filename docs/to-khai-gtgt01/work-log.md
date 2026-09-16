## [2026-09-16 00:00] backend-engineer — code mới
- Nhiệm vụ: Endpoint mới `GET /to-khai/hoa-don/chi-tiet` (bảng kê kỳ kèm chi tiết hóa đơn) + đổi mã "Chỉ tiêu tăng giảm" `tang/giam` → `37/38` theo `architecture/api-contract.md`.
- Đã sửa:
  - `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts`:13 (import `normalizeDetailDates`), :357-372 (type `ChiTieuTangGiam` = `"" | "37" | "38"` + hàm thuần `dienGiaiChiTieuTangGiam`), :397-399 (whitelist ghi `locQuyetDinh` chỉ nhận `""/"37"/"38"`), :542 (dùng `dienGiaiChiTieuTangGiam` khi đọc bảng kê), :551-604 (hàm mới `locChiTietTheoId` + interface `DongBangKeChiTiet` + hàm mới `layBangKeChiTietTheoKy` gọi nguyên `layBangKeTheoKy` rồi gắn `chiTiet` theo `id`, đọc theo lô ≤1000 qua `chiaLo`)
  - `be_maxv/src/controllers/client/to_khai/keKhaiKy.controller.ts`:107-127 (handler mới `bangKeChiTietTheoKy`, cùng mẫu `bangKeTheoKy`)
  - `be_maxv/src/routes/to_khai/toKhai.route.ts`:2-8 (import `bangKeChiTietTheoKy`), :44-50 (route mới `GET /hoa-don/chi-tiet`, rate limit `gioiHanTheoNguoiDung(20, "1 minute")`)
  - `be_maxv/src/__tests__/to_khai/quyetDinhKeKhai.test.ts` (toàn bộ file — literal `"giam"`/`"tang"` cũ trong test hợp lệ đổi sang `"37"`, thêm 11 test mới: mã cũ bị loại khi ghi TC-026/027, regression TC-028/031, giá trị ngoài tập TC-029, combo field TC-030, và 5 test cho `dienGiaiChiTieuTangGiam` TC-024/025)
  - `be_maxv/src/__tests__/to_khai/bangKeChiTiet.test.ts` (file mới, 7 test cho `layBangKeChiTietTheoKy`: kỳ rỗng, tập+thứ tự trùng bảng kê + ghép theo id, key `chiTiet` tường minh, loại tthai=4/6, hóa đơn "Không kê khai" vẫn có mặt, batch 1001→1000+1)
  - `be_maxv/src/__tests__/to_khai/toKhaiChiTietRoute.test.ts` (file mới, 6 test route+rate-limit: 200 đúng hình dạng, 400 kỳ sai/thiếu TC-044, 400 chieu sai/thiếu TC-045, 429 lượt 21 TC-048, không nhiễm trần 10 của `/ke-khai`)
- Liên kết: FR-to-khai-gtgt01-001..010 · BR-to-khai-gtgt01-001..006 · NFR-to-khai-gtgt01-002 · E-to-khai-gtgt01-003 · TC-to-khai-gtgt01-004,005,006,007,009,010,024,025,026,027,028,029,030,031,036,042,043,044,045,048 · ADR-001
- Kiểm chứng:
  - `npm run typecheck` — pass, 0 lỗi.
  - `npm run lint` — pass, 0 lỗi (467 warning pre-existing, không thuộc file đã sửa).
  - `npm test` — baseline (trước khi sửa, đã `git stash` để đo lại): 1199 test, 1182 pass, 4 fail (đều `hrmSettingsShiftsHolidaysApi.test.ts`, không liên quan tính năng này). Sau khi sửa: 1223 test, 1206 pass, 4 fail (cùng 4 fail baseline, KHÔNG có fail mới) — 24 test mới đều pass.
- Commit: chưa commit

### Chưa làm / lệch phạm vi (báo lại)

- Không đụng `hdđt_maxv/` — đúng phạm vi giao (frontend làm sau).
- Task 1 (4 sheet Excel) hoàn toàn thuộc frontend-engineer theo `CONTEXT_SUMMARY.md` Mục 5 — backend chỉ cung cấp endpoint `/hoa-don/chi-tiet` làm nguồn dữ liệu, không có việc backend nào khác cho Task 1.
- OQ-arch-001/002 trong `api-contract.md` Mục 5 vẫn còn mở (thuộc phạm vi BA/frontend: cách sheet Excel hiển thị hóa đơn `chiTiet: null`, và cập nhật `flows.md` từ 4 lượt gọi xuống 2 lượt) — không phải việc backend, không tự quyết.
- Test tầng BE-integration (DB Postgres thật) trong `qa/test-cases.md` (TC-006/007/008/011/011b/012/012b/018/019/043 bản đầy đủ) CHƯA chạy — môi trường này không có Postgres sẵn. Đã thay bằng test tầng BE-unit (mock Prisma client trực tiếp, cùng mẫu `keKhaiKyGocDb.test.ts`) phủ đúng các bất biến nghiệp vụ tương ứng. Tester-QA Phase B cần chạy lại trên DB thật để đóng các TC còn lại (đặc biệt TC-019 tenant isolation, TC-008 hóa đơn thay thế ngoài ranh giới kỳ).

## [2026-09-16 01:00] backend-engineer — fix RVW-T06/RVW-T07/RVW-T08
- Nhiệm vụ: Sửa 3 finding non-blocking từ code review (`docs/to-khai-gtgt01/review-findings.md`, mục "Review 2026-09-16"). Theo yêu cầu điều phối: CHỈ thêm/sửa test, KHÔNG đổi production code. RVW-T05 không thuộc phạm vi (ràng buộc phát hành, frontend-engineer xử lý riêng).
- Đã sửa (toàn bộ trong `be_maxv/src/__tests__/to_khai/`, không đụng `services/controllers/routes`):
  - `be_maxv/src/__tests__/to_khai/bangKeChiTiet.test.ts` — RVW-T06: thêm test `"diễn giải mã cũ 'tang'/'giam' khi đọc qua layBangKeChiTietTheoKy (và layBangKeTheoKy nó gọi)"` (daGan 3 dòng "tang"/"giam"/null, assert `chiTieuTangGiam` ra `["38","37",""]`). RVW-T07: đổi `taoDbGia` tham số 2 từ `Map` dùng chung sang `{ purchase?: Map, sold?: Map }` riêng mỗi view (cập nhật 2 call site cũ: "tập id + thứ tự trùng bảng kê", "Không kê khai"); thêm test `"chọn đúng view theo chiều: purchase đọc vct60view, sold đọc vct50view — không lẫn nhánh"`.
  - `be_maxv/src/__tests__/to_khai/toKhaiChiTietRoute.test.ts` — RVW-T08: import `ForbiddenError`/`UnauthorizedError` từ `../../helpers/errors`; `taoApp`'s `authenticate` đổi từ luôn-pass sang ném `UnauthorizedError` khi thiếu header `x-user` (cùng mẫu `gdtRouteBaoMat.test.ts`); mock `requireModule` thêm nhánh ném `ForbiddenError` khi có header `x-khong-goi`; thêm 2 test 401 (thiếu `x-user`) và 403 (`x-khong-goi`), cả hai assert `{ success: false }`.
- Liên kết: RVW-T06 · RVW-T07 · RVW-T08 (RVW-T05 không đổi — không thuộc phạm vi backend)
- Bằng chứng test đỏ khi tạm đảo production code (đã hoàn nguyên ngay sau, xác nhận bằng `git diff --stat -- be_maxv/src/services be_maxv/src/controllers be_maxv/src/routes` giống hệt trước/sau: 3 file, 113 insertions/4 deletions):
  - RVW-T06: tạm sửa `keKhaiKy.service.ts`:542 về `gan.chi_tieu_tang_giam ?? ""` → `bangKeChiTiet.test.ts` 8 pass/1 fail (đúng test mới, `actual ['tang','giam',''] vs expected ['38','37','']`).
  - RVW-T07: tạm đảo nhánh `keKhaiKy.service.ts`:564-566 (purchase đọc `vct50view`, sold đọc `vct60view`) → `bangKeChiTiet.test.ts` 6 pass/3 fail (test mới + 2 test cũ cũng đỏ theo, xác nhận sức bắt lỗi rộng hơn dự kiến).
- Kiểm chứng (sau khi hoàn nguyên production code):
  - `npx tsx --experimental-test-module-mocks --test src/__tests__/to_khai/*.test.ts` — 225/225 pass (221 cũ + 4 test mới: 1 RVW-T06, 1 RVW-T07, 2 RVW-T08).
  - `npm run typecheck` — pass, 0 lỗi.
  - `npm run lint` (2 file sửa) — 0 lỗi, 0 warning.
  - `npm test` (toàn repo) — 1227 test, 1210 pass, 4 fail (cùng 4 fail pre-existing `hrmSettingsShiftsHolidaysApi.test.ts`, không liên quan) — không có fail mới.
- Commit: chưa commit

## [2026-09-16 02:00] frontend-engineer — code mới (Task 1 + Task 2, Phase 3 FE)
- Nhiệm vụ: Xuất Excel tại tab Tờ khai thêm 4 sheet ("HĐ mua vào/bán ra", "Chi tiết mua vào/bán ra") + đổi mã "Chỉ tiêu tăng giảm" FE `tang/giam` → `37/38` theo `architecture/api-contract.md` Mục 2.6, 3.1, 4 (F1-F8). Chỉ sửa `hdđt_maxv/`.
- Đã sửa:
  - `hdđt_maxv/src/features/to_khai/ky.ts`:1-15 (type `ChiTieuTangGiam` = `"" | "37" | "38"`, import `InvoiceRaw`/`toDisplayRow`/`ReplacedByMap`), :37-59 (hàm mới `toKhaiRowsFromBangKe` — tách từ `BangKeMotChieu.tsx`, dùng chung cho bảng web và sheet Excel "HĐ...")
  - `hdđt_maxv/src/features/to_khai/components/OQuyetDinh.tsx`:21-27 (`CHI_TIEU_OPTIONS`: `""` → "—", `"37"` → "37 — Giảm", `"38"` → "38 — Tăng")
  - `hdđt_maxv/src/features/to_khai/templates/cotBangKe.ts`:113-117 (sửa comment nhắc "tang"/"giam" cũ thành "37"/"38")
  - `hdđt_maxv/src/features/to_khai/api/toKhai.ts`:60-83 (interface `BangKeChiTietResult` + hàm `getBangKeChiTiet(ky, chieu)` gọi `GET /to-khai/hoa-don/chi-tiet`, cùng mẫu `getBangKe`)
  - `hdđt_maxv/src/features/hddt/exportXlsx.ts`:89 (thêm `export` cho `addStyledSheet`, không đổi thân hàm)
  - `hdđt_maxv/src/features/to_khai/components/bang_ke/BangKeMotChieu.tsx`:16-18, 53-56 (đổi sang gọi `toKhaiRowsFromBangKe`, bỏ import `toDisplayRow` không còn dùng trực tiếp)
  - `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts` — sửa gần như toàn bộ: import `addStyledSheet`/`buildReplacedByMap`/`toDetailRows`/`detailColumns`/`getDanhMucTraCuuGoc`/`getBangKeChiTiet`/`toKhaiRowsFromBangKe`/`overviewToKhai`/`getErrorMessage`; hàm mới `taiChiTietTheoChieu` (gọi `/chi-tiet`, lỗi thì ném `Error` gắn tên chiều + `{cause: err}`); hàm mới `themSheetBangKeChiTiet` (dựng cặp sheet "HĐ.../Chi tiết..." của 1 chiều từ 1 response); `xuatToKhaiGtgt01` tải 2 lượt `/chi-tiet` (purchase+sold) + danh mục NCC song song bằng `Promise.all` TRƯỚC khi `import("exceljs")`/dựng workbook — 1 trong 2 lượt lỗi thì ném ngay, không chạm tới exceljs, không tải file; thêm 2 sheet mỗi chiều sau `themSheetPhuLuc`
  - `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`:72-73 (state `dangXuatExcel`), :178-197 (`bamXuatExcel` đổi sang `async`/`try-finally`, cùng mẫu `bamXuatXml` đã có), :383-406 (nút "Xuất Excel": `startIcon` đổi `CircularProgress` khi đang xuất, `disabled` thêm `dangXuatExcel`)
  - `docs/to-khai-gtgt01/review-findings.md` — RVW-T05: thêm dòng FIXED (FE đã gửi "37"/"38", ràng buộc deploy BE+FE cùng lượt)
- Liên kết: FR-to-khai-gtgt01-001,002,004,005,006,007,008,009,010,011 · BR-to-khai-gtgt01-001,002 · E-to-khai-gtgt01-001 · AC-to-khai-gtgt01-005,006,007,011,014 · TC-to-khai-gtgt01-013,015,016,017,018,022,023,033,034 · RVW-T02 (giữ nguyên lazy-load exceljs, không phá) · RVW-T05
- Kiểm chứng:
  - Baseline (trước khi sửa): `npm run lint` — 0 lỗi. `npm run build` (= `tsc -b && vite build`) — pass, không lỗi TypeScript/Vite.
  - Sau khi sửa: `npm run lint` — 0 lỗi, 0 warning (1 lỗi `preserve-caught-error` phát sinh giữa chừng ở `xuatToKhaiExcel.ts`, đã sửa bằng `{ cause: err }`). `npm run build` — pass, không lỗi TypeScript/Vite; chunk `ToKhai-*.js` tăng nhẹ (~27.4kB → ~28.0kB), `exceljs.min-*.js` (~930kB) vẫn tách chunk lazy riêng, KHÔNG lọt vào chunk route `/to-khai` (không phá RVW-T02).
  - KHÔNG có test runner trong `hdđt_maxv` — không tự nhận đã kiểm thử trên trình duyệt (chưa mở).
- Chưa làm / lệch phạm vi (báo lại):
  - Chưa kiểm tay trên trình duyệt (browser) — cần Tester-QA hoặc phiên sau mở thật để xác nhận file Excel + luồng lỗi mạng.
  - Không đụng `be_maxv/` theo đúng phạm vi giao.
  - Không gọi `useDanhMucTraCuuGocQuery` (hook) vì `xuatToKhaiExcel.ts` không phải component/hook — gọi thẳng `getDanhMucTraCuuGoc()` (hàm async thuần cùng file) trong `Promise.all`, lỗi thì `.catch(() => undefined)` (không chặn cả lượt xuất, chỉ làm cột "URL tra cứu" lùi về registry FE — xem dev-notes).
- Commit: chưa commit

## [2026-09-16 03:00] frontend-engineer — fix RVW-T09/RVW-T10/RVW-T11
- Nhiệm vụ: Sửa 3 finding từ code review FE (`docs/to-khai-gtgt01/review-findings.md`, mục "Review 2026-09-16 (frontend: 4 sheet Excel + select 37/38)"). Chỉ sửa `hdđt_maxv/` + docs liên quan, không đụng `docs/to-khai-gtgt01/qa/` (Tester-QA đang chạy song song).
- Đã sửa:
  - `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:1-14 (import: `addStyledSheet` từ `../hddt/exportXlsx`; `CELL_BORDER/HEADER_FILL/HEADER_HEIGHT` trực tiếp từ `../hddt/xlsxStyle`, không qua re-export — RVW-T11; gộp import `traCuuGoc` thành 1 dòng; thêm `type ReplacedByMap`), :24 (sửa comment trỏ đúng `xlsxStyle.ts`), :49-84 (RVW-T09: tách `themSheetBangKeChiTiet` thành `themSheetHd` + `themSheetChiTiet`, mỗi hàm nhận `replacedBy` đã dựng sẵn thay vì tự gọi `buildReplacedByMap` bên trong), :246-254 (`xuatToKhaiGtgt01` gọi `buildReplacedByMap` 2 lần rồi `themSheetHd(purchase)` → `themSheetHd(sold)` → `themSheetChiTiet(purchase)` → `themSheetChiTiet(sold)` — CẢ HAI sheet "HĐ..." trước, CẢ HAI sheet "Chi tiết..." sau)
  - `hdđt_maxv/src/features/to_khai/api/toKhai.ts`:65-70 (RVW-T10: `BangKeChiTietResult` đổi từ chép lại shape sang `extends Omit<BangKeResult, "datas">` + `datas` mở rộng từ `BangKeResult["datas"][number]`)
  - `docs/to-khai-gtgt01/architecture/dev-notes.md`:105-111,149-152 (cập nhật luồng dữ liệu + "Chỗ dễ nhầm" khớp `themSheetHd`/`themSheetChiTiet` và thứ tự sheet thật)
  - `docs/to-khai-gtgt01/review-findings.md` — RVW-T09/T10/T11: thêm dòng FIXED kèm bằng chứng
- Liên kết: RVW-T09 · RVW-T10 · RVW-T11 · FR-to-khai-gtgt01-001 · AC-to-khai-gtgt01-001
- Bằng chứng thứ tự sheet (không có test runner trong `hdđt_maxv`): script `exceljs` tạm trong scratchpad (`order-fixed.cjs`, KHÔNG thêm vào repo) mô phỏng đúng trình tự `addWorksheet` đọc trực tiếp từ code đã sửa (01-GTGT → PL 204-2025 → themSheetHd×2 → themSheetChiTiet×2), `writeBuffer` rồi `load` lại, in `worksheets.map(w => w.name)`:
  ```
  01-GTGT | PL 204-2025 | HĐ mua vào | HĐ bán ra | Chi tiết mua vào | Chi tiết bán ra
  ```
  Khớp đúng FR-to-khai-gtgt01-001/AC-001/contract Mục 2.6.4.
- Kiểm chứng: `npm run lint` (`hdđt_maxv`) — 0 lỗi, 0 warning. `npm run build` (`tsc -b && vite build`) — pass, không lỗi TypeScript/Vite; `exceljs.min-*.js` vẫn tách chunk lazy riêng (RVW-T02 không bị phá).
- Commit: chưa commit

## [2026-09-16 04:00] frontend-engineer — fix RVW-T12
- Nhiệm vụ: Sửa finding mới từ re-review FE (`docs/to-khai-gtgt01/review-findings.md`, RVW-T12 🔴): sheet "Chi tiết mua vào/bán ra" thiếu cột STT (AC-to-khai-gtgt01-007 không đạt). Chỉ sửa `hdđt_maxv/` + docs liên quan, không đụng `docs/to-khai-gtgt01/qa/`, không sửa `api-contract.md`.
- Đã sửa:
  - `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:5,7 (import thêm `type InvoiceColumn` từ `../hddt/templates`, `type DetailRow` từ `../hddt/types`), :37-49 (hằng mới `COT_STT_CHI_TIET: InvoiceColumn<DetailRow>` — `{ key: "stt", header: "STT", width: 8, value: (r) => r.stt }`, đọc `r.stt` KHÔNG dùng tham số thứ 2 của `value`), :97-103 (`themSheetChiTiet` gọi `addStyledSheet(wb, TEN_SHEET_CHI_TIET[chieu], [COT_STT_CHI_TIET, ...detailColumns(chieu)], detailRows)` — cột STT chèn ĐẦU, KHÔNG sửa `detailColumns`/module `hddt`)
  - `docs/to-khai-gtgt01/architecture/dev-notes.md`:110-112 (luồng dữ liệu khớp `[COT_STT_CHI_TIET, ...detailColumns(chieu)]`), :135-140 (mục "nhân đôi logic" #3: nêu rõ `to_khai` chèn thêm cột STT chứ không sửa `detailColumns`)
  - `docs/to-khai-gtgt01/review-findings.md` — RVW-T12: thêm dòng FIXED kèm bằng chứng chạy thật
- Liên kết: RVW-T12 · FR-to-khai-gtgt01-004 · AC-to-khai-gtgt01-007
- Bằng chứng chạy THẬT (không có test runner trong `hdđt_maxv`): tái dùng script scratchpad `verify-export.mjs` (do code-reviewer để lại, KHÔNG thêm vào repo) — gọi thật `xuatToKhaiGtgt01` qua Vite SSR với `fetch` giả, đọc lại file `.xlsx` sinh ra:
  - `Chi tiết mua vào`/`Chi tiết bán ra`: `cols=46` (45 cũ + 1 STT), `cot STT=true`.
  - Hóa đơn nhiều dòng hàng (mua vào 101 có 2 dòng, bán ra 901 có 3 dòng): mọi dòng hàng CÙNG `stt=1`, khớp đúng STT của hóa đơn đó ở sheet "HĐ...".
  - Hóa đơn `chiTiet: null` (102): vẫn đúng 1 dòng, `stt=2`, cột hàng để trống.
  - Regression (không đổi hành vi đã Verified trước đó): chiều rỗng (`empty-purchase`) → sheet Chi tiết vẫn `cols=46, cot STT=true`, không dòng dữ liệu; lỗi 1 chiều (`fail-sold`) → `THROW: Không tải được dữ liệu hóa đơn bán ra: ... | cause: ApiError`, không tải file (RVW-T09/E-001 vẫn đúng); thứ tự sheet vẫn `01-GTGT | PL 204-2025 | HĐ mua vào | HĐ bán ra | Chi tiết mua vào | Chi tiết bán ra`.
- Kiểm chứng: `npm run lint` (`hdđt_maxv`) — 0 lỗi, 0 warning. `npm run build` (`tsc -b && vite build`) — pass, chunk `ToKhai-*.js` 28.17 kB, `exceljs.min-*.js` vẫn `import()` động riêng.
- Commit: chưa commit

## [2026-09-16 05:00] frontend-engineer — fix cột MST/Tên đối tác trống ở bảng kê tờ khai
- Nhiệm vụ: User báo lỗi (không phải review-finding) — trên bảng kê tờ khai (và cả sheet Excel "HĐ mua vào"/"HĐ bán ra"), cột "MST/Tên người bán" (mua vào) và "MST/Tên người mua" (bán ra) trống. Lỗi CÓ TỪ TRƯỚC đợt tính năng này (bảng kê tờ khai `getBangKe` chưa từng gộp field đối tác), chỉ mới LAN sang Excel vì đợt này thêm sheet "HĐ..." tái dùng đúng cột đó. Điều phối viên đã truy gốc, giao đúng chỗ sửa.
- Gốc lỗi: `toDisplayRow` (`hddt/invoiceRow.ts`:38-45) đọc `r.mstDoiTac`/`r.tenDoiTac` — 2 field này chỉ được BE gán tên GỐC (`nbmst/nbten` hoặc `nmmst/nmten` theo chiều), FE phải tự gộp qua `mapInvoiceDatas` (`hddt/api/gdt.ts`, trước đây `private`, chỉ `getInvoices`/`getSavedInvoices` bên HĐĐT gọi). `to_khai/api/toKhai.ts` (`getBangKe`/`getBangKeChiTiet`) trả thẳng `datas` từ `apiFetch`, KHÔNG qua bước gộp này → `mstDoiTac`/`tenDoiTac` luôn `undefined`.
- Đã sửa (đúng 1 chỗ gốc, không nhân đôi logic, không sửa BE, không sửa `toDisplayRow`):
  - `hdđt_maxv/src/features/hddt/api/gdt.ts`:130 (thêm `export` cho `mapInvoiceDatas`, không đổi thân hàm), comment cập nhật nêu rõ `to_khai` cũng dùng hàm này.
  - `hdđt_maxv/src/features/to_khai/api/toKhai.ts`:2 (import `mapInvoiceDatas` từ `../../hddt/api/gdt`), :55-64 (`getBangKe` đổi sang đọc `raw` rồi `return { ...raw, datas: mapInvoiceDatas(chieu, raw.datas) as BangKeResult["datas"] }`), :80-92 (`getBangKeChiTiet` cùng mẫu, cast `as BangKeChiTietResult["datas"]`) — spread `...d` bên trong `mapInvoiceDatas` giữ nguyên `keKhai`/`chiTieuTangGiam`/`chiTiet` và thứ tự mảng, chỉ thêm 2 field `mstDoiTac`/`tenDoiTac`.
- Xác nhận không còn nơi nào trong `features/to_khai/` bỏ qua 2 hàm này: `grep -rn "to-khai/hoa-don"` chỉ ra 3 chỗ — định nghĩa `getBangKe`/`getBangKeChiTiet` (đã sửa) và `patchQuyetDinh` (PATCH, không có `datas`); `grep -rln "getBangKe\b"`/`"getBangKeChiTiet"` chỉ ra `toKhaiQueries.ts` (`useBangKeQuery` gọi thẳng `getBangKe`, không tự đọc `datas` thô) và `xuatToKhaiExcel.ts` (đã dùng `getBangKeChiTiet`) — không có đường vòng nào khác.
- Bằng chứng chạy THẬT (script scratchpad `verify-export-partner.mjs`, KHÔNG thêm vào repo): dữ liệu API giả CHỈ có `nbmst/nbten/nmmst/nmten` (đúng shape BE thật, KHÔNG có `mstDoiTac`/`tenDoiTac`), mock tầng `fetch` (dưới `apiFetch`), gọi thật `getBangKeChiTiet` → `xuatToKhaiGtgt01`, đọc lại `.xlsx`:
  ```
  SHEETS: 01-GTGT | HĐ mua vào | HĐ bán ra | Chi tiết mua vào | Chi tiết bán ra
  HĐ mua vào: "MST người bán/MST người xuất hàng"="0312345678" | "Tên người bán/Tên người xuất hàng"="CÔNG TY NGUOI BAN"
  HĐ bán ra: "MST người mua/MST người nhận hàng"="0109876543" | "Tên người mua/Tên người nhận hàng"="CÔNG TY NGUOI MUA"
  ```
  Trước khi sửa (đối chứng bằng `git stash` tạm thời đúng 2 file rồi chạy lại, sau đó `git stash pop` khôi phục ngay): script ném `TypeError: getBangKeChiTiet is not a function` vì bản stash lùi về commit HEAD (trước cả đợt tính năng này, chưa có hàm) — không dùng được làm đối chứng trực tiếp cho lỗi field trống; bằng chứng chính là kết quả SAU khi sửa ở trên (4 cột đối tác có giá trị dù API giả không có `mstDoiTac`/`tenDoiTac`, tức phải đi qua `mapInvoiceDatas` mới ra được).
- Kiểm chứng: `npm run lint` (`hdđt_maxv`) — 0 lỗi, 0 warning. `npm run build` (`tsc -b && vite build`) — pass, không lỗi TypeScript/Vite.
- Liên kết: lỗi user báo 2026-09-16 (không có mã BUG/RVW — phát hiện ngoài luồng review), liên quan gián tiếp AC-to-khai-gtgt01-001/004 (sheet "HĐ..." phải khớp bảng kê web).
- Commit: chưa commit

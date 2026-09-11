---
type: review-findings
feature: hddt
updated: 2026-09-11
---

## Review 2026-09-11 — Nhóm 2/9 (audit toàn bộ `hdđt_maxv/src`) — Verdict: ❌ Request changes

> Phạm vi: `hdđt_maxv/src/features/hddt/**` (51 file — invoice sync, GDT integration, captcha, export). Review bởi code-reviewer agent, đối chiếu chéo `be_maxv/src/routes/hddt/gdt.route.ts`.

### RVW-H2-001 🔴 BLOCKING — `formatMoney` làm tròn số lượng/đơn giá trên hóa đơn xuất ra, sai lệch với XML gốc đã ký số
- Vị trí: `hdđt_maxv/src/features/hddt/format.ts`:7-12 · dùng tại `hdđt_maxv/src/features/hddt/invoiceHtml.ts`:195-197
- Vấn đề: JSDoc ghi "KHÔNG làm tròn: 9,69 hiện đúng '9,69'" nhưng thân hàm `Math.round(n)`. `renderInvoiceHtml` dùng hàm này cho Số lượng/Đơn giá/Chiết khấu trên bản thể hiện hóa đơn GTGT (xuất HTML/PDF giao kế toán) — 9,69 lít in ra 10; đơn giá 20.909,09 in ra 20.909. Sai lệch chứng từ so với XML gốc đã ký số nằm cạnh nó.
- Đề xuất fix: tách `formatMoney` (tiền VND, làm tròn đồng) và `formatSoLieu` (số lượng/đơn giá/chiết khấu, giữ nguyên phần lẻ, `toLocaleString("vi-VN", {maximumFractionDigits: 10})`). `invoiceHtml.ts`:195-197 chuyển sang `formatSoLieu`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm `formatSoLieu` (giữ nguyên phần lẻ) trong `hdđt_maxv/src/features/hddt/format.ts`:14-21; `invoiceHtml.ts`:195-197 (cột Số lượng/Đơn giá/Chiết khấu) chuyển từ `formatMoney` sang `formatSoLieu`, các cột Thành tiền/tổng cộng giữ nguyên `formatMoney`, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-002 🔴 BLOCKING — CSV injection (formula injection) trong file sao lưu hóa đơn
- Vị trí: `hdđt_maxv/src/features/hddt/exportInvoices.ts`:8-11 (`csvCell`), dùng tại :43-48
- Vấn đề: `csvCell` chỉ bọc nháy khi ô chứa `"`, `,`, `\r`, `\n` — không vô hiệu hóa ô bắt đầu bằng `=`, `+`, `-`, `@`. Dữ liệu đổ vào là tên/MST người bán lấy từ cổng thuế (bên thứ ba, không tin được). Người bán đặt tên `=HYPERLINK(...)` sẽ chạy công thức khi kế toán mở CSV bằng Excel.
- Đề xuất fix: trong `csvCell`, thêm `if (/^[=+\-@\t\r]/.test(s)) s = \`'${s}\`;` trước khi bọc nháy.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `csvCell` trong `hdđt_maxv/src/features/hddt/exportInvoices.ts`:8-13 chèn tiền tố `'` khi ô bắt đầu bằng `=`/`+`/`-`/`@`/tab/CR trước khi áp quy tắc bọc nháy kép hiện có, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-003 🟡 NON-BLOCKING — Effect reset dialog "Tải hóa đơn gốc" xóa trạng thái giữa lúc đang tải
- Vị trí: `hdđt_maxv/src/features/hddt/components/DownloadOriginalDialog.tsx`:220-230
- Vấn đề: effect deps `[open, suppliers]` chạy lại mỗi khi `rows` đổi định danh (kể cả khi dialog đang mở và đang tải, do vòng poll invalidate mỗi 10s) → reset `downloading`/`progress`/`ketQua`/`checked` giữa chừng. Người dùng bấm tải lần hai, chạy song song 2 vòng tải cùng ghi vào 1 thư mục.
- Đề xuất fix: tách effect, chỉ reset khi `open` chuyển `false → true` (deps `[open]` với eslint-disable có chú thích lý do).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — effect early-return khi `!open`, deps còn mỗi `[open]` (bỏ `suppliers`) kèm `eslint-disable-next-line react-hooks/exhaustive-deps` có chú thích lý do, `hdđt_maxv/src/features/hddt/components/DownloadOriginalDialog.tsx`:219-234, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-004 🟡 NON-BLOCKING — `pollDetailRun` không có dung sai nhịp poll như 2 vòng poll anh em
- Vị trí: `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`:693-714
- Vấn đề: gọi `getDetailRunStatus` trần trong vòng lặp, một nhịp mạng chập là nhảy thẳng catch, bỏ theo dõi dù BE vẫn chạy tiếp. `api/updateRun.ts`:137-146 và `api/invoiceDetail.ts`:234-242 đã có dung sai `MAX_POLL_NEN_HONG`, đây là bản bị sót.
- Đề xuất fix: áp cùng khuôn dung sai, hoặc dùng lại `pollDetailRunToast` đã có sẵn.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — áp cùng khuôn dung sai (không đổi sang `pollDetailRunToast`: hàm đó không có hook `onProgress` per-tick mà `pollDetailRun` cần để điền dần cột "T.thái tải"): bọc `getDetailRunStatus` trong try/catch với bộ đếm `pollFails`, ngưỡng `MAX_POLL_NEN_HONG` (import từ `lib/toastChayNen`), `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`:707, 727-737, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-005 🟡 NON-BLOCKING — Cột "Tên file xuất hóa đơn" không khớp tên file thật khi bảng đang lọc/sắp xếp
- Vị trí: `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`:1308-1309 · `hdđt_maxv/src/features/hddt/templates/dauVao.ts`:225-230 · `hdđt_maxv/src/features/hddt/exportBundle.ts`:379-383, 412
- Vấn đề: STT hiển thị trên web tính từ `rows` (đã lọc + sắp xếp); STT dùng để đặt tên file khi xuất tính từ `overviewRows` (thứ tự DB thô). Lọc/sắp xếp bảng là hai con số lệch nhau → cột "Tên file" chỉ tên một file không tồn tại trên đĩa.
- Đề xuất fix: tính STT một lần từ nguồn không lọc/sắp xếp, tra theo khóa (`invoiceKey`) cho cả bảng lẫn export.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm memo `overviewRows` (mapped, KHÔNG lọc/sắp xếp) + `sttOf = invoiceSttMap(overviewRows)` dùng CHUNG cho bảng Tổng quát và bảng Chi tiết; dòng render tra `sttOf.get(invoiceKey(...))` thay vì `safePage*rowsPerPage+i+1` theo vị trí, `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`:468-503, 1334-1338, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-006 🟡 NON-BLOCKING — `sttOf.get(...) ?? 0` phá vỡ cơ chế chống trùng tên file
- Vị trí: `hdđt_maxv/src/features/hddt/exportBundle.ts`:412 · `hdđt_maxv/src/features/hddt/components/DownloadOriginalDialog.tsx`:326
- Vấn đề: khi STT tra không ra (endpoint danh sách bị cắt dòng), fallback `?? 0` gán CÙNG số 0 cho mọi hóa đơn trượt → các hóa đơn đó ghi đè lẫn nhau im lặng (`writeFile` luôn `create: true`).
- Đề xuất fix: cấp STT nối tiếp riêng cho hóa đơn không tra được (`++sttPhu`, khởi tạo từ `sttOf.size`), không dùng chung 0.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `exportBundle.ts` thêm helper `sttFor(key)` (biến thể của `++sttPhu` đề xuất): cấp số nối tiếp từ `sttOf.size` cho khóa trượt RỒI GHI NGƯỢC vào `sttOf`, để sheet Chi tiết (dòng 390) và tên file từng hóa đơn (dòng 412, cũng dùng `sttFor`) nhận CÙNG một số cho cùng 1 hóa đơn thay vì 2 bộ đếm phụ lệch nhau — `hdđt_maxv/src/features/hddt/exportBundle.ts`:399-413, 420, 442; `DownloadOriginalDialog.tsx` (chỉ 1 điểm dùng) áp `?? ++sttPhu` đúng như đề xuất, `hdđt_maxv/src/features/hddt/components/DownloadOriginalDialog.tsx`:292-297, 333-340, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-007 🟡 NON-BLOCKING — Gõ ô lọc trạng thái xóa lựa chọn dropdown, 3 nơi hiển thị 3 bộ lọc khác nhau
- Vị trí: `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`:593-602 (`applyStatusLabelFilter`)
- Vấn đề: gõ text mơ hồ (chưa đủ rõ) khiến `resolveUniqueOptionCode` trả `""`, xóa sạch mã chính xác đã chọn ở panel. Panel vẫn hiện lựa chọn cũ, nút "Cập nhật từ Thuế điện tử" lại gọi GDT theo `filterDraft` — ba nơi nói ba chuyện khác nhau về cùng một bộ lọc.
- Đề xuất fix: chỉ ghi đè mã khi suy ra được; text mơ hồ thì giữ nguyên lựa chọn panel (`if (code || !text.trim()) setAppliedFilters(...)`).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — áp đúng đề xuất `if (code || !text.trim()) setAppliedFilters(...)`, `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`:606-615, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-008 🟡 NON-BLOCKING — Gộp PDF nạp toàn bộ file vào RAM, không có trần
- Vị trí: `hdđt_maxv/src/features/hddt/exportBundle.ts`:185-215 (`mergeInvoicePdfs`), gọi ở :635-652
- Vấn đề: giữ mọi trang của mọi hóa đơn trong 1 `PDFDocument` tới lúc `save()`. Lượt xuất hàng nghìn hóa đơn × ~200KB/tờ → vài trăm MB heap, dễ crash tab.
- Đề xuất fix: đặt trần `MAX_MERGE = 500`, vượt trần thì chia lô (`0.1-`, `0.2-`...).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm hằng `MAX_MERGE_PER_FILE = 500`, `mergeInvoicePdfs` chia `tasks` thành nhiều lô, mỗi lô 1 `PDFDocument` riêng (giải phóng heap giữa các lô), vượt 1 lô thì tên file đổi `0.` → `0.{n}-`; giữ nguyên chữ ký hàm/tổng trả về nên chỗ gọi không đổi, `hdđt_maxv/src/features/hddt/exportBundle.ts`:185-231, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-009 🟡 NON-BLOCKING — `getAllSavedInvoices` kéo toàn bộ lịch sử hóa đơn về trình duyệt, không đối chiếu số lượng thiếu
- Vị trí: `hdđt_maxv/src/features/hddt/api/gdt.ts`:179-185
- Vấn đề: query `2000-01-01 → 2100-12-31` không phân trang. Endpoint có giới hạn dòng (comment tự thừa nhận) nhưng `exportSavedBackupCsv` không đối chiếu `total` với `datas.length` — bản sao lưu có thể thiếu dữ liệu mà không ai biết.
- Đề xuất fix: đối chiếu `result.total` với số dòng nhận được, cảnh báo khi lệch.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `getAllSavedInvoices` (api/gdt.ts) giữ nguyên (chỉ đọc dữ liệu, không có state để cảnh báo); phương án tương đương tại nơi TIÊU THỤ duy nhất (`SystemDataTab.handleExport`, ngoài phạm vi review nhưng là chỗ duy nhất gọi `exportSavedBackupCsv`): cảnh báo hiện có chỉ so `purchase.length` với `stats?.purchase` (thống kê DB riêng) — bổ sung `Math.max(p.total ?? 0, stats?.purchase ?? 0)` để bắt CẢ trường hợp chính endpoint `/saved` tự cắt dòng (giá trị `total` nó tự trả) lẫn trường hợp khoảng ngày hẹp hơn toàn hệ thống, `hdđt_maxv/src/pages/settings/SystemDataTab.tsx`:153-167, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-010 🟡 NON-BLOCKING — Cột Số lượng/Đơn giá/Chiết khấu (%) trong Excel dùng định dạng số nguyên
- Vị trí: `hdđt_maxv/src/features/hddt/templates/dauVao.ts`:296-322 (và `dauRa.ts` tương ứng) · `types.ts`:71-73, 88
- Vấn đề: `numFmt: "#,##0"` cho 3 cột này. Web mất hẳn phần lẻ (RVW-H2-001). `tlCktm` (tỷ lệ chiết khấu %) không có ký hiệu `%`, dễ đọc nhầm thành tiền.
- Đề xuất fix: `QTY_FMT = "#,##0.####"`, `PCT_FMT = "0.##%"` áp cho 2 file `dauVao.ts`/`dauRa.ts`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `QTY_FMT = "#,##0.####"` áp đúng đề xuất cho cột `soLuong`/`gia`. `PCT_FMT` đổi khác đề xuất: đọc `detailRow.ts`:326 + `tinhTienHoaDon.ts`:51 xác nhận `tlCktm` lưu SỐ PHẦN TRĂM THÔ (vd `10` = 10%, cùng quy ước `TLCK/100` toàn app) — mã `%` chuẩn Excel TỰ NHÂN 100 khi hiển thị nên `"0.##%"` sẽ ra "1000%" sai; dùng `PCT_FMT = '0.##"%"'` (bọc `%` trong nháy kép, in CHỮ không tính lại) để vừa hiện đúng số vừa có ký hiệu %. Thêm 2 hằng vào `templates/types.ts`:76-86, áp cho cột `soLuong`/`gia`/`tlCktm` ở cả `dauVao.ts`:8-19, 297-322 và `dauRa.ts`:21-32, 313-340, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-011 🟡 NON-BLOCKING — Log debug còn nguyên trong mã production
- Vị trí: `InvoiceListTabs.tsx`:825-827 · `SyncInvoiceDialog.tsx`:172-173,183,189-192,225,239 · `api/updateRun.ts`:144
- Vấn đề: `console.log("[DEBUG-...]")` chạy mỗi lần bấm nút/mỗi nhịp poll, in MST + khoảng ngày ra console máy người dùng. Không log credential.
- Đề xuất fix: bọc `if (import.meta.env.DEV)` hoặc xóa.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — bọc `if (import.meta.env.DEV)` (theo đúng tiền lệ `DialogLoginDVC.tsx`:231) cho cả 7 log: `InvoiceListTabs.tsx`:849-853 · `SyncInvoiceDialog.tsx`:172-176, 183-189, 191-198, 231-233, 247 · `api/updateRun.ts`:144-146, tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-H2-012 🟢 SUGGESTION — `dauVao.ts`/`dauRa.ts` trùng ~89%
- Vị trí: `templates/dauVao.ts` (589 dòng), `templates/dauRa.ts` (610 dòng)
- Đề xuất fix: rút ~40 cột giống hệt vào `templates/cotChung.ts` dạng factory nhận `direction`.

### RVW-H2-013 🟢 SUGGESTION — `onafterprint` gỡ iframe thiếu guard
- Vị trí: `components/InvoiceViewDialog.tsx`:74 vs 78-80
- Đề xuất fix: dùng chung `iframe.remove()` (idempotent) cho cả 2 nhánh.

### RVW-H2-014 🟢 SUGGESTION — `centerXOf` có thể trả `NaN` làm sai thứ tự captcha im lặng
- Vị trí: `captcha/solveCaptcha.ts`:46-51, 93
- Đề xuất fix: `if (xs.length === 0 || xs.some(Number.isNaN)) return NaN;` + kiểm `Number.isNaN` ở dòng 95.

### RVW-H2-015 🟢 SUGGESTION — Mutation cache giữ mật khẩu cổng thuế
- Vị trí: `hdđt_maxv/src/components/dialogLoginHddt.tsx`:71, 159-165
- Vấn đề: `loginMutation.variables` (gồm password plaintext) sống trong React Query cache/Devtools tới khi GC.
- Đề xuất fix: `loginMutation.reset()` trong `onSuccess`/`onError`.

### RVW-H2-016 🟢 SUGGESTION — `detailRows` tính lại toàn bộ mỗi lần sắp xếp bảng Tổng quát
- Vị trí: `InvoiceListTabs.tsx`:486-500
- Đề xuất fix: dùng nguồn dữ liệu thô (sau khi sửa RVW-H2-005) làm deps thay vì `rows` đã sắp xếp.

---

**Security findings:** đạt — mật khẩu GDT không lưu/không log, third-party isolation đúng (fetch trần, không cookie), không XSS trong `invoiceHtml`/`invoiceView`, captcha giải client không phải lỗ hổng (BE vẫn xác thực + rate limit 10 lần/10 phút). Duy nhất lỗ: RVW-H2-002 (CSV injection).

**Performance findings:** RVW-H2-008 (gộp PDF không trần bộ nhớ) và RVW-H2-009 (sao lưu CSV kéo toàn bộ lịch sử) là 2 điểm nặng nhất. Phần lazy-load `exceljs`/`pdf-lib`, dựng thân hóa đơn 1 lần dùng chung HTML+PDF, `runPool` giới hạn đồng thời đều làm tốt.

**Final recommendation:** ❌ Request changes — bắt buộc sửa RVW-H2-001 và RVW-H2-002 trước khi merge.

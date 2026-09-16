---
type: review-findings
feature: to-khai-gtgt01
updated: 2026-09-16
---

## Review 2026-09-11 — Nhóm 9/9 (audit toàn bộ `hdđt_maxv/src`): phần tờ khai GTGT — Verdict: ❌ Request changes

> Phạm vi: `features/to_khai/**` (phần liên quan tờ khai GTGT, tách từ báo cáo gộp DVC+to_khai — xem `docs/dich-vu-cong/review-findings.md` cho phần DVC). Kết luận trọng tâm: FE **không tự tính** công thức GTGT (đúng quyết định, mọi chỉ tiêu do BE trả), không tìm thấy lỗi làm tròn tiền. Vấn đề nằm ở khâu validate trước khi xuất/chốt.

### RVW-T01 🔴 BLOCKING — "Chốt" / "Xuất XML" / "Xuất Excel" không kiểm tra ô sửa tay chưa lưu → tờ khai nộp đi khác số kế toán đang nhìn
- Vị trí: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`:121, 229-238, 326, 338, 348
- Vấn đề — tái hiện được theo 3 bước:
  1. Gõ chuỗi không đọc được vào 1 ô sửa được rồi Tab → `onBlur` gặp `docSoTien` trả `undefined` → return im lặng, không lưu không báo.
  2. Gõ số hợp lệ vào ô khác rồi Tab → `luuVaTinhLai()` gom cả `nhap`, thấy `oHong` khác rỗng → `if (gom.oHong.length > 0) return;` bỏ lưu TOÀN BỘ, cũng không toast (cố ý im lặng theo comment).
  3. Bấm Chốt/Xuất XML/Xuất Excel — cả 3 nút chỉ xét `disabled={dangChay || !ban}`, không xét `nhap` — chạy với số CŨ trên server trong khi màn hình đang hiện số MỚI.
  - XML xuất ra nạp thẳng vào HTKK để ký số và nộp thuế → số đã nộp ≠ số kế toán tin là đã nhập, không cảnh báo nào.
- Đề xuất fix: `const chuaLuu = Object.keys(nhap).length > 0;` thêm `|| chuaLuu` vào `disabled` của Chốt/Xuất Excel/Xuất XML kèm Tooltip lý do; khi `oHong.length > 0` phải đánh `error`/`helperText` lên đúng ô trong `oHong` thay vì im lặng tuyệt đối. Gộp luôn: `bamTinh` (:73-79) `setNhap({})` khi "Tính lại" cũng nên confirm nếu `chuaLuu`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm `chuaLuu` + Tooltip disable Chốt/Xuất Excel/Xuất XML; state `oLoi` đánh `error`/`helperText` lên đúng ô hỏng thay vì `return` im lặng (cả ở `luuVaTinhLai`, `bamLuu`, và `onBlur` khi `docSoTien` trả `undefined`); `bamTinh` mở `Dialog` xác nhận trước khi xóa nháp nếu `chuaLuu`. File: `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx`, tsc+eslint pass (0 lỗi/0 warning), commit "chưa commit" *(frontend-engineer)*

### RVW-T02 🟡 NON-BLOCKING — `xuatToKhaiExcel.ts` import tĩnh `exceljs` (~1MB) vào chunk route `/to-khai`
- Vị trí: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:1
- Vấn đề: duy nhất file này trong toàn app dùng value-import; 8 chỗ khác đều `import type` + `await import("exceljs")` lazy. `ToKhaiGtgt01Editor` import tĩnh file này nên mọi lần vào màn Tờ khai đều kéo ExcelJS dù không ai bấm Xuất.
- Đề xuất fix: đổi thành `import type ExcelJS from "exceljs"` + `const { Workbook } = await import("exceljs")` trong hàm xuất (đã là `async`).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — đổi sang `import type { Workbook } from "exceljs"` (khớp pattern `exportXlsx.ts` — named type import, không phải default `ExcelJS` namespace) + `const { Workbook: LopWorkbook } = await import("exceljs")` lazy trong `xuatToKhaiGtgt01` (khớp alias-pattern của `buTruExcel.ts` và 7 chỗ khác). `themSheetPhuLuc` đổi tham số `wb: ExcelJS.Workbook` → `wb: Workbook`. File: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:1, 39, 109-111, tsc+eslint pass (0 lỗi/0 warning), commit "chưa commit" *(frontend-engineer)*

### RVW-T03 🟡 NON-BLOCKING — Đổi 1 ô "Kê khai"/"Chỉ tiêu tăng giảm" làm invalidate toàn bộ cache module tờ khai
- Vị trí: `hdđt_maxv/src/features/to_khai/api/toKhaiQueries.ts`:67-75 · `components/OQuyetDinh.tsx`:29-37
- Vấn đề: mỗi lần đổi select → `invalidateQueries({queryKey: toKhaiKeys.byCompany})` → refetch cả 2 bảng kê (mua+bán, có thể hàng nghìn dòng) + bản tờ khai. Sửa 20 dòng = 20 lượt tải lại toàn bộ.
- Đề xuất fix: truyền thêm `ky` vào biến thể mutation, chỉ invalidate `toKhaiKeys.bangKe(companyId, ky, chieu)` + `gtgt01Keys.ban(companyId, ky)`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm field `ky: Ky` vào `ToKhaiRow` (`ky.ts`) để mỗi dòng bảng kê tự mang theo kỳ đang xem; `BangKeMotChieu.tsx` gán `ky` khi build rows; `useSuaQuyetDinhMutation` nhận thêm `ky` trong biến thể mutation, `onSuccess` đổi từ `invalidateQueries(toKhaiKeys.byCompany)` sang `toKhaiKeys.bangKe(companyId, ky, chieu)` + `gtgt01Keys.ban(companyId, ky)`; `OQuyetDinh.tsx` truyền `row.ky` khi gọi `luu()`. File: `hdđt_maxv/src/features/to_khai/ky.ts`, `components/bang_ke/BangKeMotChieu.tsx`, `api/toKhaiQueries.ts`:67-81, `components/OQuyetDinh.tsx`:29-38, tsc+eslint pass (0 lỗi/0 warning), commit "chưa commit" *(frontend-engineer)*

### RVW-T04 🟢 SUGGESTION — File Excel đối soát thiếu hàng "A — chỉ tiêu [21]"
- Vị trí: `xuatToKhaiExcel.ts`:136-156
- Vấn đề: vòng lặp chỉ chạy `HANG_GTGT01`, thiếu hàng "Không phát sinh hoạt động mua, bán trong kỳ" mà màn hình có (`ToKhaiGtgt01Form.tsx`:137-143).
- Đề xuất fix: thêm hàng A vào vòng lặp xuất.

---

**Trọng tâm được hỏi — trả lời trực tiếp:**
- Third-party isolation, timeout/lỗi mạng khi đồng bộ: không áp dụng cho `to_khai` (module này không nộp online, chỉ xuất XML để nạp HTKK).
- Công thức tổng hợp + làm tròn: FE cố ý không tự tính; `docSoTien`/`fmtSoTien` đọc/ghi đồng bộ, khớp `numFmt` Excel. **Không tìm thấy lỗi làm tròn ở FE** — verify công thức thật cần làm ở nhóm review `be_maxv`.
- State machine: `"nhap" | "chot"` — union đúng nghĩa, không phải boolean rời rạc. Thiếu trạng thái "đã nộp" thật (chỉ có "đã chốt", mở khóa lại được) — nên ghi vào SRS nếu cần track.
- Validate dữ liệu bắt buộc trước khi nộp: đây là chỗ yếu nhất → **RVW-T01**.

**Final recommendation:** ❌ Request changes — bắt buộc RVW-T01 trước khi merge (~15 dòng fix).

---

## Review 2026-09-16 (backend: chi tiết theo kỳ + mã 37/38) — Verdict: ⚠️ Approve with comments

> Phạm vi: diff chưa commit trong `be_maxv` — `services/client/to_khai/application/keKhaiKy.service.ts`, `controllers/client/to_khai/keKhaiKy.controller.ts`, `routes/to_khai/toKhai.route.ts`, `__tests__/to_khai/quyetDinhKeKhai.test.ts` + 2 file test mới `bangKeChiTiet.test.ts`, `toKhaiChiTietRoute.test.ts`. Đối chiếu `architecture/api-contract.md` Mục 2-3, `ADR-001`, `qa/test-report.md`, `qa/issues-and-bugs.md`.
>
> Bằng chứng tự chạy: `npm run typecheck` pass (0 lỗi) · `npm run lint` 0 lỗi (467 warning có sẵn, 6 file trong diff 0 warning) · `npx tsx --experimental-test-module-mocks --test src/__tests__/to_khai/*.test.ts` 221/221 pass.

**Đã kiểm, đạt (không thành finding):**
- Bất biến api-contract Mục 2.4: `layBangKeChiTietTheoKy` (`keKhaiKy.service.ts`:593) gọi nguyên `layBangKeTheoKy`, không lọc lại; mọi dòng có key `chiTiet` (`?? null`); ghép theo `id` qua `Map`, giữ thứ tự của `layBangKeTheoKy`; đọc theo lô 1000 qua `chiaLo`; `normalizeDetailDates` dùng lại, không viết bản thứ hai.
- `select: { id, detail }` tối thiểu (không kéo `raw`); không N+1 (1 truy vấn/lô). Nhánh `vct60view`/`vct50view` theo chiều khớp `tenViewHoaDon` và mẫu sẵn có ở `keKhaiKy.service.ts`:146.
- Bảo mật/tenant: route dùng `guard()` MỚI (`authenticate` + `requireModule("tokhai")`); DB lấy từ `resolveTenantDb` (kiểm quyền `donViId` ở control plane, gọi ngoài `try` nên 403/404 đi qua errorHandler đúng contract); query validate bằng `docKy`/`docChieu` trước khi chạm DB; 400 qua `thongDiepLoiAnToan` che lỗi Prisma/TypeError.
- Rate limit: `@fastify/rate-limit` 11.1.0 tạo `LocalStore.child` riêng cho mỗi route, khóa `u:userId` → 20/phút của `/hoa-don/chi-tiet` không dùng chung bộ đếm với `/ke-khai` hay `/gtgt01/tinh`; test "11 lượt đều 200" chứng minh preHandler không lây trần 10.
- 37/38: whitelist ghi chỉ ở `locQuyetDinh` (:397); diễn giải khi đọc chỉ ở `dienGiaiChiTieuTangGiam` (:368), gọi 1 chỗ (:542). Grep toàn `be_maxv`: không nơi nào khác đọc `chi_tieu_tang_giam` → engine `ct37`/`ct38` (`tinhGtgt01`, `gomHoaDonGtgt`, XML) không bị động tới.
- Test `bangKeChiTiet.test.ts` chứng minh thật: `getSavedInvoices` giả trả thứ tự khác `tokhai_ky_hoa_don` và chỉ `hd-1` có detail → nếu ghép theo vị trí thì `datas[0].chiTiet` sai, test đỏ; dòng `keKhai=false` và `tthai` 4/6 kiểm bằng `duocTinh` thật.

### RVW-T05 🟡 NON-BLOCKING — Đổi whitelist sang "37"/"38" là breaking với FE đang chạy: không được deploy BE trước FE
- Vị trí: `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts`:397, :542 · FE hiện tại: `hdđt_maxv/src/features/to_khai/components/OQuyetDinh.tsx`:24-25, `hdđt_maxv/src/features/to_khai/ky.ts`:7
- Vấn đề: FE hiện vẫn gửi `"tang"`/`"giam"`. Nếu bản BE này lên production trước FE (F1/F2 của contract): (1) kế toán chọn "Tăng/Giảm" → `locQuyetDinh` bỏ field → PATCH vẫn `200 { ok: true }` nhưng KHÔNG lưu, không báo gì; (2) GET trả `"37"`/`"38"` (kể cả dữ liệu cũ đã diễn giải) không có trong `CHI_TIEU_OPTIONS` → ô hiện trống, MUI cảnh báo out-of-range. Code BE đúng contract Mục 3.2, rủi ro nằm ở thứ tự phát hành.
- Đề xuất fix: không đổi code. Ghi ràng buộc phát hành vào `CONTEXT_SUMMARY.md`/ghi chú merge: BE + FE (F1-F3) của đợt này merge và deploy CÙNG lượt; nếu buộc phải tách lượt thì giữ BE lại tới khi vòng FE qua QA + review.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — FE đã gửi "37"/"38" (`hdđt_maxv/src/features/to_khai/ky.ts`:11, `components/OQuyetDinh.tsx`:24-25); BẮT BUỘC deploy BE + FE cùng lượt *(frontend-engineer)*

### RVW-T06 🟡 NON-BLOCKING — Chỗ gọi diễn giải mã cũ khi ĐỌC chưa có test nào giữ
- Vị trí: `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts`:542 · `be_maxv/src/__tests__/to_khai/quyetDinhKeKhai.test.ts`:84-106 · `be_maxv/src/__tests__/to_khai/bangKeChiTiet.test.ts`:86-102
- Vấn đề: TC-024/025 chỉ test hàm thuần `dienGiaiChiTieuTangGiam`. Không test nào đưa `chi_tieu_tang_giam = "tang"` qua `layBangKeTheoKy`/`layBangKeChiTietTheoKy` rồi assert `chiTieuTangGiam` của dòng trả ra (test ở `bangKeChiTiet.test.ts`:93 có dữ liệu `"38"` nhưng không assert cột này). Ai đó đổi :542 về `gan.chi_tieu_tang_giam ?? ""` thì cả suite vẫn xanh, mọi dữ liệu cũ hiện ô trống trên bảng kê lẫn Excel — đúng loại lỗi AC-to-khai-gtgt01-011 muốn chặn.
- Đề xuất fix: thêm 1 test vào `bangKeChiTiet.test.ts`: `daGan` gồm `{ hoa_don_id: "hd-1", chi_tieu_tang_giam: "tang" }`, `{ hoa_don_id: "hd-2", chi_tieu_tang_giam: "giam" }`, `{ hoa_don_id: "hd-3", chi_tieu_tang_giam: null }` → assert `datas.map(d => d.chiTieuTangGiam)` = `["38", "37", ""]` theo thứ tự `getSavedInvoices` giả. Một test phủ cả `/hoa-don` lẫn `/hoa-don/chi-tiet` vì cùng đi qua :542.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — thêm test `"diễn giải mã cũ 'tang'/'giam' khi đọc qua layBangKeChiTietTheoKy (và layBangKeTheoKy nó gọi)"` trong `be_maxv/src/__tests__/to_khai/bangKeChiTiet.test.ts` (đúng data/assert đề xuất). Chứng minh đỏ: tạm sửa `keKhaiKy.service.ts`:542 về `gan.chi_tieu_tang_giam ?? ""`, chạy `npx tsx --experimental-test-module-mocks --test src/__tests__/to_khai/bangKeChiTiet.test.ts` → 8 pass/1 fail đúng test này (`actual ['tang','giam',''] vs expected ['38','37','']`), rồi hoàn nguyên (`git diff --stat` production code giống hệt trước/sau, 86 insertions/4 deletions không đổi). Test sau khi hoàn nguyên: pass 9/9. Không sửa production code. Commit: chưa commit *(backend-engineer)*

### RVW-T07 🟢 SUGGESTION — Mock DB dùng chung một hàm cho hai view nên việc chọn đúng view theo chiều chưa được test
- Vị trí: `be_maxv/src/__tests__/to_khai/bangKeChiTiet.test.ts`:67-68 · code được bảo vệ: `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts`:564-566
- Vấn đề: `vct60view.findMany` và `vct50view.findMany` cùng trỏ `docDetail`. Đảo nhầm nhánh (purchase đọc `vct50view`) thì id mua vào không có trong bảng bán ra → mọi `chiTiet` thành `null`, sheet "Chi tiết..." chỉ còn dòng trống, mà test vẫn xanh.
- Đề xuất fix: trong `taoDbGia` cho mỗi view một map detail riêng (vd `vct60view` trả `{ nguon: "mua" }`, `vct50view` trả `{ nguon: "ban" }`), thêm 1 test gọi `"purchase"` và `"sold"` cùng id, assert `chiTiet.nguon` đúng chiều.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — `taoDbGia` trong `be_maxv/src/__tests__/to_khai/bangKeChiTiet.test.ts` đổi tham số 2 từ `Map` dùng chung sang `{ purchase?: Map, sold?: Map }` riêng mỗi view (2 call site cũ cập nhật theo, không đổi hành vi); thêm test `"chọn đúng view theo chiều: purchase đọc vct60view, sold đọc vct50view — không lẫn nhánh"`. Chứng minh đỏ: tạm đảo nhánh tại `keKhaiKy.service.ts`:564-566 (`purchase` đọc `vct50view`, `sold` đọc `vct60view`), chạy lại file test → 6 pass/3 fail (gồm đúng test mới + 2 test cũ "tập id + thứ tự..." và "Không kê khai..." cũng đỏ theo — bằng chứng view sai ảnh hưởng rộng hơn 1 test), rồi hoàn nguyên (`git diff --stat` production code khớp lại 86 insertions/4 deletions). Test sau khi hoàn nguyên: pass 9/9. Không sửa production code. Commit: chưa commit *(backend-engineer)*

### RVW-T08 🟢 SUGGESTION — (ISSUE-002) Chưa có test 401/403 cho route mới
- Vị trí: `be_maxv/src/__tests__/to_khai/toKhaiChiTietRoute.test.ts`:49-51, :56-58 · route: `be_maxv/src/routes/to_khai/toKhai.route.ts`:47-51
- Vấn đề: `authenticate` và `requireModule` luôn cho qua trong mọi test. Rủi ro hiện tại thấp: route dùng đúng `guard()` như 12 route còn lại, và cả mô-đun `to_khai` chưa route nào có test 401/403 (ngang mặt bằng repo) → không chặn merge. Giá trị còn lại là chặn hồi quy khi ai đó sửa khai báo route mà rơi mất `preHandler: guard()` — khi đó endpoint trả toàn bộ chi tiết hóa đơn cho người không có gói `tokhai`.
- Đề xuất fix: trong `taoApp`, `authenticate` ném `UnauthorizedError` khi thiếu header `x-user`; `requireModule` mock trả preHandler ném `ForbiddenError` khi header `x-khong-goi` có mặt. Thêm 2 test: không header → 401 `{ success: false }`; có `x-khong-goi` → 403 `{ success: false }`. Không cần DB.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — `be_maxv/src/__tests__/to_khai/toKhaiChiTietRoute.test.ts`: import `ForbiddenError`/`UnauthorizedError` từ `helpers/errors` (cùng mẫu `gdtRouteBaoMat.test.ts`); `authenticate` trong `taoApp` đổi từ luôn-pass sang ném `UnauthorizedError` khi thiếu `x-user`; mock `requireModule` thêm nhánh ném `ForbiddenError` khi có header `x-khong-goi`; thêm 2 test `"chưa đăng nhập (thiếu x-user) -> 401 { success: false }"` và `"gói không có mô-đun tokhai -> 403 { success: false }"`. Đã hạ tầng được guard thật (không phải đề mở OPEN vì thiếu harness). Không sửa production code — route vẫn dùng `guard()` thật, chỉ test double của `authenticate`/`requireModule` chặt hơn. Test: 8/8 pass (6 cũ + 2 mới). Commit: chưa commit *(backend-engineer)*

**Security findings:** không có lỗ hổng. Tenant, guard gói, validate query, che lỗi nội bộ, rate limit đều đúng (xem mục "Đã kiểm, đạt"). Không đụng GDT credential/cookie/`api.xinvoice.vn`.

**Performance findings:** không có finding. Response giữ `detail` của cả kỳ (tối đa 1 quý) trong RAM, gấp ~2 lúc serialize. Mức này nhẹ hơn tiền lệ `/gdt/invoices/:direction/saved-details` (366 ngày, không rate limit), và endpoint mới đã có 20 lượt/phút/người dùng. Đọc `detail` lặp với `readDetailExtras` đã được ADR-001 chấp nhận. Chỉ xem lại khi một kỳ lên cỡ vài chục nghìn hóa đơn (ADR-001 Consequences: dựng xlsx dạng stream ở BE).

**Final recommendation:** ⚠️ Approve with comments — không có 🔴. RVW-T06 nên làm ngay (1 test, ~10 dòng). RVW-T05 là ràng buộc phát hành, không phải sửa code. RVW-T07/T08 làm khi tiện.

---

## Review 2026-09-16 (frontend: 4 sheet Excel + select 37/38) — Verdict: ❌ Request changes

**Re-review 2026-09-16 — Verdict: ❌ Request changes** — RVW-T09/T10/T11 xác nhận đã sửa đúng; mở RVW-T12 🔴 (sheet "Chi tiết..." không có cột STT, AC-007 không đạt).

**Re-review 2 2026-09-16 — Verdict: ⚠️ Approve with comments** — RVW-T12 Verified; ghi nhận RVW-T13 (cột MST/Tên đối tác trống, lỗi user báo) đã FIXED + Verified. Không còn 🔴 nào mở ở vòng frontend. Còn ràng buộc phát hành RVW-T05 và việc QA kiểm file thật trên trình duyệt.

> Phạm vi: diff chưa commit trong `hdđt_maxv`, 8 file: `features/hddt/exportXlsx.ts`, `features/to_khai/api/toKhai.ts`, `components/OQuyetDinh.tsx`, `components/ToKhaiGtgt01Editor.tsx`, `components/bang_ke/BangKeMotChieu.tsx`, `ky.ts`, `templates/cotBangKe.ts`, `xuatToKhaiExcel.ts`. Đối chiếu `srs/to-khai-gtgt01-spec.md`, `architecture/api-contract.md` Mục 2.6 + Mục 4, `ADR-001`, `architecture/dev-notes.md` (Frontend), `work-log.md`, `qa/test-cases.md` (TC-001/002).
>
> Bằng chứng tự chạy: `npm run lint` 0 lỗi/0 warning · `npm run build` pass; `ToKhai-*.js` 28.03 kB, `exceljs.min-*.js` 929.90 kB tách chunk riêng, chunk ToKhai chỉ gọi `import("./exceljs.min-…")` động (RVW-T02 giữ nguyên) · script exceljs (scratchpad): thêm sheet đúng trình tự code hiện tại, `writeBuffer` rồi `load` lại → `01-GTGT | PL 204-2025 | HĐ mua vào | Chi tiết mua vào | HĐ bán ra | Chi tiết bán ra`.

**Đã kiểm, đạt (không thành finding):**
- Contract Mục 2.6: 2 lượt `/to-khai/hoa-don/chi-tiet` (purchase + sold) song song trong `Promise.all` (`xuatToKhaiExcel.ts`:171-175), TRƯỚC `import("exceljs")` (:178); không gọi thêm `GET /to-khai/hoa-don`. Một lượt lỗi → `taiChiTietTheoChieu` (:38-47) ném `Error` mang tên chiều + `{ cause }`, không chạm exceljs, không tải file. `getErrorMessage` đọc `.message` của Error đã bọc (không còn là `TypeError`) nên toast ra đúng "Không tải được dữ liệu hóa đơn bán ra: …", kể cả khi lỗi gốc là mất mạng.
- `getDanhMucTraCuuGoc().catch(() => undefined)` (:174): cùng mẫu `hddt/exportBundle.ts`:366; route `/gdt/tra-cuu-goc/nha-cung-cap` chỉ cần JWT; lỗi chỉ làm cột "URL tra cứu" lùi về registry FE. Không nuốt lỗi quan trọng — 401 thật thì 2 lượt `/chi-tiet` cũng ném.
- Không nhân đôi logic: `toKhaiRowsFromBangKe` (`ky.ts`:50) tách nguyên văn từ `BangKeMotChieu` (cùng field, cùng thứ tự), dùng chung bảng web + sheet "HĐ..."; sheet "Chi tiết..." gọi nguyên `toDetailRows` + `detailColumns(chieu)` + `addStyledSheet`. Không có nhánh `if (chiTiet === null)` riêng — `d.chiTiet ?? d` rơi vào `EMPTY_LINE` của `toDetailRows` → đúng 1 dòng, cột hàng trống (FR-011/AC-014). STT chi tiết = `i + 1` trên cùng mảng `datas` của sheet "HĐ..." (FR-004/AC-007). `toDisplayRow` dựng object tường minh nên `rows` không giữ thêm `chiTiet`.
- Kỳ/chiều rỗng: `datas: []` → `addStyledSheet` vẫn ghi hàng tiêu đề, bỏ hàng tổng, autoFilter `Math.max(-1, 0)` an toàn (FR-006).
- Nút "Xuất Excel" (`ToKhaiGtgt01Editor.tsx`:184-197, :399-411): `setDangXuatExcel(true)` trước `await`, `finally` mở lại, `disabled` thêm `dangXuatExcel`, cùng mẫu `bamXuatXml`. Click là discrete event, React flush ngay → bấm đúp không lọt lượt 2. React 19 không cảnh báo setState sau unmount.
- 37/38: `ChiTieuTangGiam = "" | "37" | "38"` (`ky.ts`:14); grep toàn `hdđt_maxv/src` không còn literal `"tang"`/`"giam"` ngoài comment; `CHI_TIEU_OPTIONS` gửi đúng `"37"`/`"38"`, nhãn khớp FR-007; cột Excel ra mã thô qua `value`. Không `any`, không ép kiểu.

### RVW-T09 🔴 BLOCKING — Thứ tự sheet sai FR-to-khai-gtgt01-001: "Chi tiết mua vào" đứng trước "HĐ bán ra"
- Vị trí: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:59-74 (`themSheetBangKeChiTiet` thêm cặp HĐ + Chi tiết của MỘT chiều liền nhau), :236-239 (gọi purchase rồi sold) · tài liệu ghi lại thứ tự sai: `docs/to-khai-gtgt01/architecture/dev-notes.md`:106
- Vấn đề: exceljs giữ sheet theo thứ tự `addWorksheet`, nên file ra `01-GTGT, PL 204-2025, HĐ mua vào, Chi tiết mua vào, HĐ bán ra, Chi tiết bán ra` (đã chạy thử, xem đầu mục). FR-001, AC-001, contract Mục 2.6.4 và QA TC-001/TC-002 đều yêu cầu `HĐ mua vào, HĐ bán ra, Chi tiết mua vào, Chi tiết bán ra`. Comment :236-237 lại ghi đúng thứ tự spec, nên đọc code dễ tưởng đã khớp. Sai requirement đã chốt; TC-001/002 sẽ fail.
- Đề xuất fix: thêm sheet thành hai lượt, giữ nguyên nguồn dữ liệu, ví dụ:
  ```ts
  const theoChieu = [["purchase", muaVao], ["sold", banRa]] as const;
  const replacedBy = { purchase: buildReplacedByMap(muaVao.thayThe), sold: buildReplacedByMap(banRa.thayThe) };
  for (const [c, kq] of theoChieu)
    addStyledSheet(wb, TEN_SHEET_HD[c], overviewToKhai(c), toKhaiRowsFromBangKe(kq.datas, c, ky, replacedBy[c]));
  for (const [c, kq] of theoChieu)
    addStyledSheet(wb, TEN_SHEET_CHI_TIET[c], detailColumns(c),
      kq.datas.flatMap((d, i) => toDetailRows(d.chiTiet ?? d, i + 1, replacedBy[c], danhMucNcc)));
  ```
  (hoặc tách `themSheetBangKeChiTiet` thành `themSheetHd` + `themSheetChiTiet`, gọi HĐ-mua, HĐ-bán, CT-mua, CT-bán). Sửa `dev-notes.md`:106 cho khớp. Kiểm bằng cách mở file xuất thật (TC-001/002).
- Trạng thái: OPEN
  → FIXED [2026-09-16] — tách `themSheetBangKeChiTiet` thành `themSheetHd` (`xuatToKhaiExcel.ts`:54-63) + `themSheetChiTiet` (:73-84); `xuatToKhaiGtgt01` (:251-254) gọi `themSheetHd(purchase)` → `themSheetHd(sold)` → `themSheetChiTiet(purchase)` → `themSheetChiTiet(sold)` — CẢ HAI sheet "HĐ..." trước, CẢ HAI sheet "Chi tiết..." sau, nguồn dữ liệu/`replacedBy`/STT giữ nguyên (không đổi `toKhaiRowsFromBangKe`/`toDetailRows`). Sửa `docs/to-khai-gtgt01/architecture/dev-notes.md`:106. Bằng chứng: script `exceljs` scratchpad mô phỏng đúng trình tự `addWorksheet` mới (01-GTGT → PL 204-2025 → 2×HĐ → 2×Chi tiết), `writeBuffer` rồi `load` lại → `01-GTGT | PL 204-2025 | HĐ mua vào | HĐ bán ra | Chi tiết mua vào | Chi tiết bán ra` — khớp đúng FR-to-khai-gtgt01-001/AC-001. `npm run lint`/`npm run build` (`hdđt_maxv`) pass, 0 lỗi. Commit "chưa commit" *(frontend-engineer)*
  ✔ Verified [2026-09-16] — chạy THẬT `xuatToKhaiGtgt01` qua Vite SSR với fetch giả (script scratchpad `verify-export.mjs`, không thêm vào repo), đọc lại file xlsx: thứ tự `01-GTGT | PL 204-2025 | HĐ mua vào | HĐ bán ra | Chi tiết mua vào | Chi tiết bán ra`, khớp FR-001/AC-001. Tách hàm không đổi nguồn: mỗi chiều truyền cùng `ketQua` + `replacedBy` cho cả `themSheetHd` và `themSheetChiTiet` (`xuatToKhaiExcel.ts`:249-254) — sheet mua vào chỉ chứa HĐ 101/102/103, bán ra chỉ chứa 901, không lẫn chiều; tiền tố STT trong cột "Tên file" của sheet Chi tiết (1/2/3) khớp STT sheet HĐ; hóa đơn `chiTiet: null` ra đúng 1 dòng, cột hàng trống; chiều rỗng → 2 sheet chỉ có tiêu đề; lượt `sold` trả 400 → ném "Không tải được dữ liệu hóa đơn bán ra: …" (`cause` = `ApiError`), không tải file. `dev-notes.md`:105-111, :149-152 khớp code. `npm run lint` 0 lỗi, `npm run build` pass, chunk ToKhai 28.11 kB vẫn `import()` động exceljs *(code-reviewer)*

### RVW-T10 🟢 SUGGESTION — `BangKeChiTietResult` chép lại hình dạng `BangKeResult` thay vì mở rộng
- Vị trí: `hdđt_maxv/src/features/to_khai/api/toKhai.ts`:65-74 (bản chép) · gốc :41-45
- Vấn đề: contract Mục 2.3 quy định response `/chi-tiet` = đúng response `/hoa-don` cộng đúng một field `chiTiet`. Hai interface khai độc lập: thêm field vào `BangKeResult` (vd một cột quyết định mới) sẽ không tự có ở `BangKeChiTietResult`, sheet "HĐ..." lệch bảng web mà tsc vẫn xanh.
- Đề xuất fix: `export interface BangKeChiTietResult extends Omit<BangKeResult, "datas"> { datas: (BangKeResult["datas"][number] & { chiTiet: Record<string, unknown> | null })[] }`.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — `BangKeChiTietResult` (`api/toKhai.ts`:65-70) đổi đúng theo đề xuất: `extends Omit<BangKeResult, "datas">`, `datas` mở rộng từ `BangKeResult["datas"][number]` + `chiTiet`. Thêm field vào `BangKeResult` sau này tự có mặt ở đây. `npm run lint`/`npm run build` pass, 0 lỗi. Commit "chưa commit" *(frontend-engineer)*
  ✔ Verified [2026-09-16] — `api/toKhai.ts`:65-70: `total`/`thayThe` kế thừa từ `BangKeResult`; mỗi phần tử `datas` = `InvoiceRaw & { keKhai; chiTieuTangGiam } & { chiTiet: Record<string, unknown> | null }`, đúng shape contract Mục 2.3. `toKhaiRowsFromBangKe(ketQua.datas, …)` và `d.chiTiet ?? d` vẫn qua `tsc -b` (build pass) *(code-reviewer)*

### RVW-T11 🟢 SUGGESTION — Ba hằng style chuyển sang import qua re-export của `exportXlsx.ts`, ngược chiều đã tách `xlsxStyle.ts`
- Vị trí: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:2, :5-6, :24
- Vấn đề: trước diff, file import `CELL_BORDER/HEADER_FILL/HEADER_HEIGHT` từ `../hddt/xlsxStyle` (nguồn chung đã tách riêng); `exportXlsx.ts`:18-22 ghi rõ re-export chỉ để "chỗ gọi cũ khỏi phải đổi đường import". Không đổi bundle (file vẫn cần `addStyledSheet`), nhưng code mới đi vòng qua re-export và comment :24 vẫn nói hằng "của `hddt/exportXlsx.ts`". Kèm: :5-6 hai dòng import cùng module `traCuuGoc`.
- Đề xuất fix: giữ `import { CELL_BORDER, HEADER_FILL, HEADER_HEIGHT } from "../hddt/xlsxStyle"`, chỉ lấy `addStyledSheet` từ `../hddt/exportXlsx`; gộp thành `import { getDanhMucTraCuuGoc, type DanhMucTraCuuGoc } from "../hddt/api/traCuuGoc"`; sửa comment :24 trỏ `xlsxStyle.ts`.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — `xuatToKhaiExcel.ts`:2-6 đổi đúng theo đề xuất: `CELL_BORDER/HEADER_FILL/HEADER_HEIGHT` import trực tiếp từ `../hddt/xlsxStyle`, `addStyledSheet` từ `../hddt/exportXlsx`; gộp 2 dòng `traCuuGoc` thành 1 (`getDanhMucTraCuuGoc, type DanhMucTraCuuGoc`); comment :24 sửa thành "hằng định dạng của `hddt/xlsxStyle.ts`". `npm run lint`/`npm run build` pass, 0 lỗi. Commit "chưa commit" *(frontend-engineer)*
  ✔ Verified [2026-09-16] — `xuatToKhaiExcel.ts`:2-3 (hằng từ `../hddt/xlsxStyle`, `addStyledSheet` từ `../hddt/exportXlsx`), :6 (import `traCuuGoc` gộp 1 dòng), :24 (comment trỏ `xlsxStyle.ts`). lint 0 lỗi *(code-reviewer)*

### RVW-T12 🔴 BLOCKING — Sheet "Chi tiết mua vào/bán ra" không có cột STT → AC-to-khai-gtgt01-007 không đạt
- Vị trí: `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts`:83 (`addStyledSheet(..., detailColumns(chieu), detailRows)`) · nguồn cột: `hdđt_maxv/src/features/hddt/templates/dauVao.ts`:235 (`detailDauVao`), `dauRa.ts`:251 (`detailDauRa`) · chỗ tài liệu mâu thuẫn: `docs/to-khai-gtgt01/architecture/api-contract.md`:174-177 (Mục 2.6.6) với `srs/to-khai-gtgt01-spec.md`:68 (FR-004), :147 (AC-007)
- Vấn đề: `detailColumns` của HĐĐT KHÔNG có cột "STT" (chỉ bảng Tổng quát có). `DetailRow.stt` chỉ lộ ra dưới dạng tiền tố trong cột "Tên file hóa đơn" (`invoiceFileBase` → `2.2026-07-15_102_…`). Chạy thật hàm xuất: sheet "HĐ..." có cột STT, sheet "Chi tiết..." 45 cột, không cột nào tên "STT". FR-004 và AC-007 ("toàn bộ các dòng chi tiết đó có cột STT = k") cùng TC-011/011b của QA ("kiểm cột STT") đòi một cột STT thật — kế toán lọc/tra theo STT được, không phải bóc từ tên file. Giá trị `stt` truyền vào `toDetailRows` đúng (xác nhận qua tiền tố tên file), chỉ thiếu cột hiển thị. FE làm đúng câu chữ contract ("dùng nguyên `detailColumns(chieu)`"), nhưng contract ngầm giả định bộ cột đó có STT — tức spec và contract đã chốt mâu thuẫn nhau.
- Đính chính: mục "Đã kiểm, đạt" của vòng review trước ghi STT chi tiết đạt FR-004/AC-007 là thiếu — khi đó chỉ kiểm giá trị `stt` truyền vào `toDetailRows`, chưa kiểm cột có ra file. Lỗi này có từ trước, không phát sinh do bản sửa RVW-T09.
- Đề xuất fix: (khuyến nghị) thêm đúng 1 cột ở đầu sheet Chi tiết của `to_khai`, vẫn dùng lại nguyên `detailColumns`, không đụng HĐĐT:
  ```ts
  const COT_STT_CHI_TIET: InvoiceColumn<DetailRow> = { key: "stt", header: "STT", width: 8, value: (r) => r.stt };
  addStyledSheet(wb, TEN_SHEET_CHI_TIET[chieu], [COT_STT_CHI_TIET, ...detailColumns(chieu)], detailRows);
  ```
  BẮT BUỘC đọc `r.stt`, KHÔNG dùng tham số thứ hai của `value` — `addStyledSheet` truyền vào đó số thứ tự DÒNG chi tiết (`i + 1`), không phải STT hóa đơn. Architect/BA ghi bổ sung contract Mục 2.6.6 thành "`detailColumns(chieu)` + cột STT đầu". Phương án còn lại (BA sửa FR-004/AC-007 chấp nhận STT nằm trong tên file) không khuyến nghị vì không lọc được theo STT.
- Trạng thái: OPEN
  → FIXED [2026-09-16] — thêm hằng `COT_STT_CHI_TIET` (`xuatToKhaiExcel.ts`:44-49, đúng đề xuất: `{ key: "stt", header: "STT", width: 8, value: (r) => r.stt }`, đọc `r.stt` — KHÔNG dùng tham số thứ hai của `value`); `themSheetChiTiet` (:87-103) gọi `addStyledSheet(wb, TEN_SHEET_CHI_TIET[chieu], [COT_STT_CHI_TIET, ...detailColumns(chieu)], detailRows)` — cột STT chèn ĐẦU danh sách, `detailColumns(chieu)`/module `hddt` giữ nguyên, không đụng tab "Chi tiết hoá đơn" của HĐĐT. Bằng chứng chạy THẬT `xuatToKhaiGtgt01` qua Vite SSR (scratchpad `verify-export.mjs`, không thêm repo), đọc lại xlsx:
  ```
  SHEETS: 01-GTGT | PL 204-2025 | HĐ mua vào | HĐ bán ra | Chi tiết mua vào | Chi tiết bán ra
  Chi tiết mua vào [cols=46, cot STT=true]
     stt=1 so=101 hang=Hang 101-1   (HĐ 101 có 2 dòng hàng -> cả 2 dòng CÙNG stt=1, khớp sheet "HĐ mua vào" stt=1)
     stt=1 so=101 hang=Hang 101-2
     stt=2 so=102 hang=-            (HĐ 102 chiTiet:null -> đúng 1 dòng, cột hàng trống, vẫn có stt=2 khớp sheet HĐ)
     stt=3 so=103 hang=Hang 103-1
  Chi tiết bán ra [cols=46, cot STT=true]
     stt=1 so=901 hang=Hang 901-1   (HĐ 901 có 3 dòng hàng -> cả 3 dòng CÙNG stt=1, khớp sheet "HĐ bán ra" stt=1)
     stt=1 so=901 hang=Hang 901-2
     stt=1 so=901 hang=Hang 901-3
  ```
  Regression: chiều rỗng (`empty-purchase`) → "Chi tiết mua vào" vẫn `cols=46, cot STT=true`, không dòng dữ liệu, không lỗi. Lỗi 1 chiều (`fail-sold`) → `THROW: Không tải được dữ liệu hóa đơn bán ra: ... | cause: ApiError`, `NO FILE DOWNLOADED` — không đổi hành vi RVW-T09/E-001. `npm run lint`/`npm run build` (`hdđt_maxv`) pass, 0 lỗi, `exceljs.min` vẫn chunk riêng. `docs/to-khai-gtgt01/architecture/dev-notes.md` không có câu "dùng nguyên detailColumns" cần sửa (đã rà, chỉ nói "`detailColumns(chieu)` của HĐĐT" ở mục nhân đôi logic — vẫn đúng, `to_khai` chỉ THÊM 1 cột trước, không sửa bản gốc). Commit "chưa commit" *(frontend-engineer)*
  ✔ Verified [2026-09-16] — `xuatToKhaiExcel.ts`:44-49 `COT_STT_CHI_TIET` đọc `r.stt`; :97-103 chèn đầu `[COT_STT_CHI_TIET, ...detailColumns(chieu)]`, `detailColumns`/module HĐĐT không đổi. Chạy THẬT qua Vite SSR (scratchpad `verify-export2.mjs`, không thêm repo), đọc lại xlsx: "Chi tiết mua vào/bán ra" 46 cột, STT ở cột 1; HĐ 101 (2 dòng hàng) đều `stt=1`, HĐ 102 `chiTiet: null` 1 dòng `stt=2` cột hàng trống, HĐ 103 `stt=3`, HĐ 901 (3 dòng hàng) đều `stt=1` — khớp STT sheet "HĐ..." (AC-007, AC-014). Style nhất quán với cột STT sheet "HĐ...": cùng cột 1, `width` 8, ô kiểu number, không `numFmt`; nhãn "TỔNG CỘNG" rơi vào cột STT như sheet "HĐ...", freeze tới hàng tổng như nhau. `api-contract.md` Mục 2.6.6 (đã đính chính: cột STT đặt đầu, sau đó nguyên `detailColumns`) và `dev-notes.md`:110-112, :135-140 khớp code. `npm run lint` 0 lỗi, `npm run build` pass, chunk ToKhai 28.17 kB vẫn `import()` động exceljs *(code-reviewer)*

### RVW-T13 🔴 BLOCKING — Cột MST/Tên đối tác trống ở bảng kê tờ khai và sheet "HĐ mua vào/bán ra" (lỗi user báo, có từ trước đợt này)
- Vị trí: `hdđt_maxv/src/features/to_khai/api/toKhai.ts` (`getBangKe`, `getBangKeChiTiet` trả thẳng `datas` từ `apiFetch`) · nơi đọc: `hdđt_maxv/src/features/hddt/invoiceRow.ts`:38-45 (`toDisplayRow` đọc `mstDoiTac`/`tenDoiTac`) · hàm gộp sẵn có: `hdđt_maxv/src/features/hddt/api/gdt.ts`:132 (`mapInvoiceDatas`)
- Vấn đề: BE `/to-khai/hoa-don(/chi-tiet)` chỉ trả `nbmst/nbten/nmmst/nmten` (grep `be_maxv/src` không nơi nào dựng `mstDoiTac`). HĐĐT gộp hai field đối tác ở tầng API qua `mapInvoiceDatas`, còn `to_khai` bỏ qua bước này, nên `toDisplayRow` đọc `undefined`. Đối chứng dựng trong scratchpad (không `git stash`): đưa dữ liệu thô vào `toKhaiRowsFromBangKe` → mua vào `seller=undefined/undefined`, bán ra `buyer=undefined/""`. Hậu quả: cột "MST/Tên người bán" (mua vào) và "MST/Tên người mua" (bán ra) trống trên bảng web lẫn sheet "HĐ...", cột "Tên file" của sheet "HĐ mua vào" ra đuôi `_undefined`, lệch với cùng cột ở sheet Chi tiết. Đây là hai cột chính để kế toán đối chiếu thuế theo đối tác, nên xếp 🔴. Vòng review frontend trước không bắt được vì dữ liệu giả của reviewer có sẵn `mstDoiTac`.
- Đề xuất fix: áp `mapInvoiceDatas(chieu, raw.datas)` ngay trong `getBangKe`/`getBangKeChiTiet` — đúng tầng HĐĐT đang làm, một chỗ cho cả bảng web lẫn Excel; không sửa `toDisplayRow` (dùng chung với HĐĐT).
- Trạng thái: OPEN
  → FIXED [2026-09-16] — `hddt/api/gdt.ts`:130-132 thêm `export` cho `mapInvoiceDatas` (thân hàm không đổi); `to_khai/api/toKhai.ts`:2 import, :62-64 `getBangKe` và :84-91 `getBangKeChiTiet` trả `{ ...raw, datas: mapInvoiceDatas(chieu, raw.datas) as ...["datas"] }`. Chi tiết: `docs/to-khai-gtgt01/work-log.md` mục [2026-09-16 05:00] *(frontend-engineer)*
  ✔ Verified [2026-09-16] — Sửa đúng gốc, một chỗ: grep `features/to_khai` chỉ có 2 lối đọc bảng kê (`useBangKeQuery` → `getBangKe`, `xuatToKhaiExcel` → `getBangKeChiTiet`), cả hai đã qua `mapInvoiceDatas`; không nơi nào còn dùng `datas` thô. `PARTNER_FIELD` đúng chiều (purchase → `nbmst/nbten`, sold → `nmmst/nmten`). Chạy THẬT (scratchpad `verify-export2.mjs`, dữ liệu API giả KHÔNG có `mstDoiTac`): bảng web `getBangKe` → mua vào `seller=0311111111/NCC A`, bán ra `buyer=0322222222/KH B`; sheet "HĐ mua vào" cột đối tác `0311111111/NCC A`, "HĐ bán ra" `0322222222/KH B`; "Tên file" sheet HĐ mua vào hết `_undefined`, khớp sheet Chi tiết. Cast `as BangKeResult["datas"]` không che lỗi runtime: spread `...d` giữ `keKhai`/`chiTieuTangGiam`/`chiTiet` (đã in ra: `keKhai=false chiTieu="37" chiTiet=null` với HĐ 102), cast chỉ khôi phục kiểu mà `apiFetch<T>` vốn đã khẳng định. HĐĐT không đổi hành vi: diff `gdt.ts` chỉ thêm từ khóa `export` + comment. `npm run lint` 0 lỗi, `npm run build` pass *(code-reviewer)*

**Security findings:** không có. Không đụng credential GDT, cookie, `api.xinvoice.vn`; query dựng từ `kyToQuery` + union `InvoiceDirection`; toast chỉ hiện message BE đã qua `thongDiepLoiAnToan`.

**Performance findings:** không có finding. Không có vòng O(n²): mỗi chiều 1 `map` + 1 `flatMap` + `buildReplacedByMap` O(n); `traCuuNcc` tra registry theo `msttcgp`, danh mục NCC chỉ vài phần tử. Đã biết, không mới: exceljs dựng sheet đồng bộ trên main thread — một quý vài nghìn hóa đơn × nhiều dòng hàng × 40+ cột sẽ làm tab đứng vài giây sau khi dữ liệu về (spinner đứng theo); cùng mức `buildSummaryWorkbookBuffer` của HĐĐT, ADR-001 đã chốt hướng dựng xlsx dạng stream ở BE khi kỳ lên vài chục nghìn hóa đơn.

**Ghi chú kiểm thử:** `hdđt_maxv` không có test runner, nên thứ tự sheet và STT chỉ được giữ bằng QA tay (TC-001/002, TC-011/011b). RVW-T09 lọt qua lint + build là ví dụ — sau khi sửa, QA phải mở file thật.

**Final recommendation:** ❌ Request changes — RVW-T09 bắt buộc sửa trước merge (~10 dòng + 1 dòng dev-notes). RVW-T10/T11 làm khi tiện. Ràng buộc RVW-T05 vẫn giữ: deploy BE + FE cùng lượt.

**Final recommendation (re-review 2026-09-16):** ❌ Request changes — RVW-T09/T10/T11 đã Verified. Còn RVW-T12 🔴: thêm cột STT cho sheet "Chi tiết..." (~2 dòng, đọc `r.stt`) + Architect/BA ghi bổ sung contract Mục 2.6.6; sau khi sửa, QA chạy lại TC-011/011b trên file thật. Security/Performance: không có gì mới.

**Final recommendation (re-review 2 2026-09-16):** ⚠️ Approve with comments — RVW-T09..T13 đều FIXED + Verified, không còn 🔴 mở ở vòng frontend. Comments: (1) RVW-T05 — BE + FE deploy cùng lượt; (2) `hdđt_maxv` không có test runner, reviewer kiểm bằng script scratchpad với API giả — QA vẫn phải mở file Excel thật từ dữ liệu tenant (TC-001/002, TC-011/011b, TC-018) và xem bảng kê trên trình duyệt cho cột đối tác. Security/Performance: không có gì mới (`mapInvoiceDatas` thêm 1 lượt `map` O(n) mỗi response).

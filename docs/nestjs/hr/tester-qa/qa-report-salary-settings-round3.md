# BÁO CÁO KIỂM THỬ CHẤT LƯỢNG (QA TEST REPORT) — PHÂN HỆ CÀI ĐẶT LƯƠNG — ĐỢT 15 (ROUND 3 — RÀ SOÁT ĐỘC LẬP)

## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

> **Báo cáo này BỔ SUNG, KHÔNG thay thế** `qa-report-salary-settings.md` (Round 1) và `qa-report-salary-settings-round2.md` (Round 2) — giữ nguyên làm lịch sử. Đây là kết quả rà soát ĐỘC LẬP sau khi Backend Engineer Round 3 (`docs/hr/CONTEXT_SUMMARY.md` Mục 17) vá 3 Non-blocking finding mà Code Reviewer Round 2 phát hiện (Bug #2 race sinh mã `KLxx`, Finding 5.2 duplicate `salaryItemId`, Finding 5.3 race double-submit `setSalary()`). **KHÔNG tin suông báo cáo tự khai của Backend Engineer** — mọi số liệu dưới đây do chính Agent QA tự chạy lại từ đầu; toàn bộ test case Mục 4 được tự thiết kế TRƯỚC khi đọc `test/salary-settings.e2e-spec.ts` của Backend Engineer (tránh bias).

- **Người thực hiện**: Agent Tester-QA (rà soát độc lập, round 3)
- **Thời gian thực hiện**: 2026-09-06
- **Mã đợt kiểm thử**: QA-HR-SALARY-SETTINGS-ROUND3
- **Trạng thái tổng thể**: ✅ **3/3 finding Round 2 xác nhận ĐÃ VÁ ĐÚNG cho phạm vi được giao** (E-sal-011 dedupe, upsert atomic double-submit, retry-on-conflict ở concurrency thấp/vừa). ⚠️ **Known Limitation Backend tự báo (retry-on-conflict KHÔNG an toàn ở concurrency cao) ĐƯỢC XÁC NHẬN CÓ THẬT — và mức độ rủi ro thực tế CAO HƠN Backend Engineer mô tả**: rà soát của tôi phát hiện thêm bằng chứng MỚI mà báo cáo Backend không có — retry-on-conflict có thể gây `500` ngay cả ở tải đồng thời THỰC TẾ (nhiều tiến trình/route cùng tạo `SalaryItem` gần cùng thời điểm, không cần 1 request cụ thể gửi ≥8 lần gọi đồng thời) — xem Mục 6. Khuyến nghị: **GO CÓ ĐIỀU KIỆN** — xem Mục 8.

---

## 1. Mục tiêu & phạm vi rà soát đợt này

1. Đọc code thật Round 3: `salary-items.service.ts` (retry-on-conflict), `set-employee-salary.schema.ts` (dedupe + `E-sal-011`), `employee-salaries.service.ts` (`upsert`), `hr-errors.ts`.
2. Tự chạy lại `lint`/`build`/unit/e2e toàn bộ Backend, đối chiếu số liệu THẬT với báo cáo tự khai Backend Engineer (290/290 unit, 262/262 e2e).
3. Tự thiết kế và chạy test ĐỘC LẬP qua HTTP thật (NestJS app thật + supertest + Postgres thật port 5435) cho cả 3 finding, KHÔNG đọc test Backend Engineer trước khi thiết kế case.
4. Test concurrency thật cho Finding 5.3 (double-submit) và Bug #2 (retry-on-conflict), bao gồm THỬ VƯỢT quy mô Backend đã test để tự xác minh độc lập Known Limitation — không tin suông claim "N=8 gây 500".
5. Regression 2 gap CHẶN Round 2 (E-sal-009, E-sal-010) + toàn bộ suite HR liên quan.
6. Xác nhận KHÔNG có migration mới qua `git status` thật.
7. Không tự sửa production code — chỉ báo cáo.

## 2. Đọc tài liệu & code trước khi test (evidence)

Đã đọc trực tiếp:
- `docs/hr/CONTEXT_SUMMARY.md` Mục 17 (Backend Round 3 — báo cáo tự nhận, dùng để đối chiếu SAU KHI tự kiểm chứng).
- `docs/hr/code-reviewer/code-review-report-salary-settings-round2.md` Mục 3 (Bug #2), Mục 5.2, Mục 5.3, Mục 10 (đặc tả gốc của 3 finding cần verify).
- `docs/hr/srs/salary-settings-spec.md` Mục 9 (Error Matrix, `E-sal-011` mới).
- `docs/hr/architecture/salary-settings-api-contract.md` Mục 4.4.
- Code thật: `Backend/src/hr/salary/salary-items/salary-items.service.ts`, `Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts`, `Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts`, `Backend/src/common/hr-errors.ts`.

**Xác nhận code khớp đúng mô tả Backend Round 3**:
- `SalaryItemsService.create()`: nhánh `code` tự sinh có vòng lặp `for (attempt < SALARY_ITEM_CODE_MAX_RETRY=5)` gọi lại `generateNextCode()` (đọc `findMany` snapshot MỚI mỗi lần) rồi `insertSalaryItem()`; chỉ retry khi `isSalaryItemCodeConflict()` (P2002 đọc `meta.driverAdapterError.cause.constraint.index === 'salary_items_code_key'`) đúng; nhánh `code` nhập tay KHÔNG retry.
- `setEmployeeSalarySchema`: có `.refine()` MỚI kiểm tra `new Set(ids).size === ids.length` với `path: ['items', 'duplicate']`, đăng ký `E-sal-011` trong `fieldPriority` với thứ tự `amount (E-sal-007) > items.duplicate (E-sal-011) > items (E-sal-008)`.
- `EmployeeSalariesService.setSalary()`: đã đổi từ `findUnique` + rẽ nhánh `create`/`update` sang `tx.employeeSalary.upsert({ where: { employeeId }, create, update })`, nhánh update dùng `setupVersion: { increment: 1 }` (atomic ở DB). Idempotent qua `deleteMany` + `createMany` cho `EmployeeSalaryItem` áp dụng cho CẢ 2 nhánh.
- `HR_ERRORS`/`HR_ERROR_STATUS`: `E-sal-011` đã đăng ký, message đúng, status 400.
- **Xác nhận KHÔNG có migration mới**: `git status` chỉ liệt kê 2 migration folder untracked đã tồn tại từ Round 1/Round 2 (`20260906014946_add_salary_settings`, `20260906030741_add_salary_item_name_ci_unique`) — không có migration folder mới nào cho Round 3. Khớp đúng báo cáo Backend Mục 17.4.

## 3. Kết quả chạy lại lint/build/unit/e2e (THẬT, tự chạy)

| Lệnh | Kết quả tự chạy (2026-09-06) | Đối chiếu báo cáo Backend Engineer (Mục 17.7) |
|---|---|---|
| `npm run lint` (oxlint `src/ test/ prisma/`) | **0 lỗi** | Khớp |
| `npm run build` (nest build) | **0 lỗi** | Khớp |
| `npm test` (unit, vitest) | **290/290 pass, 24 file** | Khớp CHÍNH XÁC |
| `npm run test:e2e` (Postgres thật port 5435, suite gốc KHÔNG kèm file QA mới) | **262/262 pass, 10 file** — chạy lại 4 lần liên tiếp, ổn định 100% cả 4 lần | Khớp CHÍNH XÁC (262/262, 10 file) |

Môi trường: container `hrm_accounting` (Postgres 17, port 5435) và `project-api-1` chạy sẵn (healthy).

## 4. Test case ĐỘC LẬP tự thiết kế (không đọc test Backend Engineer trước khi viết)

File mới: `Backend/test/salary-settings-qa-round3-independent.e2e-spec.ts` — 7 test case (Case 5 là bài stress thăm dò, không phải PASS/FAIL nghiệp vụ đơn thuần), chạy qua NestJS app thật + supertest, Postgres thật port 5435.

| Test Case ID | Requirement ID | Scenario | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| QA-R3-01 | Finding 5.2 / E-sal-011 | `items[]` chứa 2 phần tử cùng `salaryItemId` | 1 employee active, 2 item cùng ID khác amount | 400 `E-sal-011`, KHÔNG tạo `EmployeeSalary` | 400 `E-sal-011`; DB row = null | ✅ PASS |
| QA-R3-02 | Regression | `items[]` KHÔNG trùng lặp (2 ID khác nhau) | 2 salaryItemId hợp lệ trong khung (tự bổ sung item thứ 2 vào khung nếu DB chỉ còn 1 do state chia sẻ giữa các file e2e) | 200 OK, `setupVersion=1`, `totalAmount` đúng tổng | 200 OK, đúng như kỳ vọng | ✅ PASS |
| QA-R3-03 | Finding 5.3 | 3 request PUT đồng thời, CÙNG 1 employeeId CHƯA từng có `EmployeeSalary` | `Promise.all` 3 request, amount khác nhau | Không request nào 500; đúng 1 row `EmployeeSalary`; `setupVersion` trong [1,3]; đúng 1 `EmployeeSalaryItem` (không mồ côi/trùng) | Cả 3 trả 200; 1 row duy nhất; `setupVersion` hợp lệ; 1 item | ✅ PASS |
| QA-R3-04 | Bug #2 (baseline) | 3 request `POST /salary-items` đồng thời, KHÔNG truyền `code` | `Promise.all` 3 request | Cả 3 trả 201; 3 mã `KLxx` duy nhất | Cả 3 trả 201; mã duy nhất | ✅ PASS |
| QA-R3-05 | Bug #2 (stress, tự kiểm chứng Known Limitation) | 10 request `POST /salary-items` đồng thời, KHÔNG truyền `code` | `Promise.all` 10 request (chạy CÔ LẬP file này riêng) | Đo thực tế 201 vs 500; bất biến bắt buộc: mã thành công KHÔNG trùng, không lộ stack trace nếu có 500 | **5/5 lần chạy CÔ LẬP: 10/10 thành công, 0 lỗi 500** (khác biệt với claim gốc N=8 của Backend — xem Mục 6) | ✅ PASS (đúng bất biến bắt buộc; số liệu concurrency chi tiết ở Mục 6) |
| QA-R3-06 | Regression thứ tự ưu tiên | Nhân viên đã nghỉ việc (0 Contract) + item ngoài khung CÙNG LÚC | 1 employee không Contract, 1 item ngoài khung | 400 `E-sal-009` (ưu tiên cao hơn `E-sal-010`) | 400 `E-sal-009` | ✅ PASS |
| QA-R3-07 | Regression E-sal-010 | Nhân viên active + item ngoài khung (không có vi phạm khác) | 1 employee active, 1 item ngoài khung | 400 `E-sal-010`, không tạo `EmployeeSalary` | 400 `E-sal-010`; DB row = null | ✅ PASS |

**Kết quả chạy file độc lập**: 7/7 PASS, ổn định qua nhiều lần chạy cô lập.

## 5. Regression 2 gap CHẶN Round 2

- `E-sal-009` (BR-sal-008, nhân viên nghỉ việc) — vẫn hoạt động đúng sau patch Round 3 (QA-R3-06).
- `E-sal-010` (BR-sal-005, item ngoài khung) — vẫn hoạt động đúng, không bị ảnh hưởng bởi việc chèn `.refine()` dedupe MỚI ở tầng Zod trước nó (QA-R3-07).
- Thứ tự ưu tiên `E-sal-009 > E-sal-010` khi vi phạm đồng thời — giữ nguyên đúng như Architect Round 2 đã chốt (QA-R3-06).
- Toàn bộ 262 test e2e gốc (10 file, gồm `app`/`auth`/`hr`/`hr-qa`/`contracts`/`documents`/`google-drive`/`settings-shifts-holidays`/`salary-settings`/`salary-settings-qa-round2-independent`) pass 100% khi chạy KHÔNG kèm file QA Round 3 mới, xác nhận qua 4 lần chạy lặp lại liên tiếp — **không có baseline flakiness pre-existing**.

## 6. PHÁT HIỆN QUAN TRỌNG — Tự kiểm chứng độc lập Known Limitation (Bug #2 retry-on-conflict)

Đây là phần trọng tâm nhất theo yêu cầu nhiệm vụ: **không tin suông** claim "Known limitation" mà Backend Engineer tự báo (Mục 17.9 điểm 1 CONTEXT_SUMMARY.md: "đã tái hiện THẬT 8-way concurrency vẫn có thể 500 sau 5 lần retry").

### 6.1 Thăm dò trong 1 tiến trình (cùng cách Backend đã làm) — XÁC NHẬN claim tổng quát ĐÚNG, nhưng NGƯỠNG CỤ THỂ SAI

Chạy `Promise.all` N request `POST /salary-items` đồng thời, không truyền `code`, CÔ LẬP (chỉ 1 file test, không suite khác chạy song song):

| N (concurrency) | Số lần chạy | Kết quả |
|---|---|---|
| 3 | 1 | 3/3 thành công, 0 lỗi 500 |
| 8 | 5 | **5/5 lần: 8/8 thành công, 0 lỗi 500** |
| 10 | 5 | **5/5 lần: 10/10 thành công, 0 lỗi 500** |
| 15 | 3 | **3/3 lần: có lỗi 500** (9/15, 8/15, 13/15 thành công — 2 đến 7 lỗi 500 mỗi lần) |
| 25 | 3 | **3/3 lần: có lỗi 500 nhiều** (6/25, 10/25, 8/25 thành công — 15 đến 19 lỗi 500 mỗi lần) |

**Kết luận 6.1**: Claim tổng quát của Backend Engineer ("retry-on-conflict KHÔNG an toàn ở MỌI mức concurrency") là **ĐÚNG, xác nhận độc lập** — tôi tự tái hiện được lỗi 500 thật ở N=15 và N=25 trong môi trường của mình. TUY NHIÊN, con số cụ thể "N=8 gây 500" mà Backend Engineer báo cáo **KHÔNG tái hiện được trong môi trường/lần chạy của tôi** (5/5 lần N=8 và 5/5 lần N=10 đều 0 lỗi) — ngưỡng thực tế phụ thuộc timing/máy/tải hệ thống tại thời điểm chạy, KHÔNG phải một con số cố định. Đây không phải mâu thuẫn về bản chất bug (bug có thật, đã xác nhận) mà là mâu thuẫn về **độ chính xác của ngưỡng cụ thể** mà Backend Engineer nêu — cần lưu ý khi Backend dùng con số này để "hạ test xuống 3-way vì an toàn" (Mục 17.9): con số 3 an toàn hơn nhưng KHÔNG có nghĩa "ngưỡng nguy hiểm bắt đầu từ 8" là chính xác.

### 6.2 PHÁT HIỆN MỚI (không có trong báo cáo Backend/Code Reviewer) — Bug tái hiện qua tải đồng thời THỰC TẾ khi chạy TOÀN BỘ e2e suite

Khi thêm file `salary-settings-qa-round3-independent.e2e-spec.ts` (test case QA-R3-04 + QA-R3-05, tạo thêm 13 `SalaryItem` không truyền `code`) vào bộ chạy `npm run test:e2e` đầy đủ (11 file, `vitest` mặc định chạy các file test **song song đa tiến trình**, mỗi file tự `app.init()` riêng nhưng TẤT CẢ cùng ghi vào MỘT Postgres DB dùng chung port 5435):

| Điều kiện | Số lần chạy | Kết quả |
|---|---|---|
| Suite gốc (10 file, KHÔNG kèm file QA Round 3 mới) | 4 lần liên tiếp | **4/4 lần: 262/262 PASS, không flake** |
| Suite đầy đủ (11 file, CÓ kèm file QA Round 3 mới) | 8 lần liên tiếp (rải trong nhiều lượt kiểm tra) | **2/8 lần (25%) THẤT BẠI thật** — 1 request `POST /salary-items` ĐƠN LẺ (không nằm trong `Promise.all` nào, ở 1 test HOÀN TOÀN KHÁC, file `salary-settings-qa-round2-independent.e2e-spec.ts`, case "OQ-sal-02 trùng tên case-insensitive") nhận **500** thay vì 201 kỳ vọng, do va chạm `code` với 1 request đồng thời ở FILE KHÁC chạy song song |

Bằng chứng lỗi thật (đã xem log server, KHÔNG suy đoán):
```
AssertionError: expected 500 to be 201
- Expected: 201
+ Received: 500
❯ test/salary-settings-qa-round2-independent.e2e-spec.ts:314:28
```
Console log server (khi chạy N=25 cô lập, cùng loại lỗi) xác nhận nguyên nhân gốc chính xác là race sinh mã:
```
Unique constraint failed on the constraint: `salary_items_code_key`
```
(lặp lại nhiều lần liên tiếp, đúng hành vi retry thất bại sau khi vượt `SALARY_ITEM_CODE_MAX_RETRY=5`).

**Ý nghĩa của phát hiện này (quan trọng hơn phát hiện 6.1)**: Known Limitation KHÔNG chỉ là rủi ro lý thuyết "1 request cụ thể gửi ≥N cuộc gọi đồng thời trong CÙNG 1 test/route" như cách Backend Engineer đã kiểm chứng (Mục 17.9 chỉ test trong CHÍNH 1 file, 1 tiến trình) — nó có thể biểu hiện qua **tải đồng thời chéo giữa các luồng nghiệp vụ hoàn toàn KHÔNG liên quan tới nhau** (ở đây là 2 file test độc lập, tương tự 2 tính năng/2 người dùng khác nhau trong production cùng tạo `SalaryItem` gần cùng lúc mà không hề biết tới nhau) — MIỄN LÀ tổng số request tạo `SalaryItem` không-truyền-`code` cùng lúc trên toàn hệ thống đủ lớn. Đây là mô hình rủi ro THỰC TẾ HƠN cho production (nhiều người dùng/tiến trình độc lập, không phối hợp) so với kịch bản "1 admin bấm submit nhiều lần" mà Code Review Round 2 mô tả ban đầu ("2 HR/Admin cùng thao tác").

**Xác nhận KHÔNG mất toàn vẹn dữ liệu dù có 500**: qua toàn bộ lần thăm dò N=15/25 và lần thất bại thật trong full-suite, **không có bất kỳ mã `KLxx` trùng lặp nào lọt qua** UNIQUE constraint (đã assert cứng trong Case 5 và tự kiểm tra qua Postgres) — retry-on-conflict vẫn đúng vai trò "an toàn dữ liệu" của nó, chỉ không đúng vai trò "luôn trả kết quả thành công".

**Phát hiện phụ (Low, thuộc vệ sinh test, không phải production bug)**: khi race condition này xảy ra GIỮA CÁC PHẦN TỬ của 1 mảng `Promise.all` trong CHÍNH file `salary-settings.e2e-spec.ts` (test 3-way baseline của Backend Engineer), pattern `results.forEach((res, i) => { expect(...).toBe(201); createdItemIds.push(...) })` sẽ DỪNG NGAY khi gặp phần tử đầu tiên có status khác 201 — các phần tử tạo THÀNH CÔNG ở vị trí SAU phần tử lỗi trong mảng sẽ KHÔNG được push vào `createdItemIds`, dẫn tới **mồ côi dữ liệu test** (`SalaryItem` tạo thành công nhưng không được `afterAll` dọn dẹp). Tôi đã xác nhận thật qua Postgres (5 dòng `KL20/KL21/KL23/KL24/KL25` "Phụ cấp đồng thời E2E" còn sót lại từ các lần chạy thất bại trong phiên rà soát của tôi) và đã tự dọn dẹp về đúng 19 dòng seed gốc trước khi kết thúc phiên. Đây KHÔNG phải bug nghiệp vụ, chỉ là gợi ý cải thiện cleanup pattern (dùng `Promise.allSettled` + push id trước khi assert, hoặc try/finally) cho các test concurrency tương lai — Suggestion, không chặn.

## 7. Bug ghi nhận

### BUG-QA-R3-01 — [Medium, nâng mức tin cậy] Retry-on-conflict sinh mã `KLxx` (Bug #2) vẫn gây 500 dưới tải đồng thời thực tế đa nguồn — rủi ro CAO HƠN đánh giá ban đầu

- **Severity**: Medium (giữ nguyên phân loại của Code Reviewer/Backend — không phải Blocking vì không mất/sai dữ liệu, có workaround retry thủ công của người dùng) nhưng **Priority nên nâng lên cao hơn** so với "backlog để sau" hiện tại, vì bằng chứng mới cho thấy khả năng xảy ra thực tế cao hơn mô tả gốc.
- **Environment**: Backend NestJS + Postgres 17 thật (port 5435), xác nhận qua cả app test lẫn full e2e suite.
- **Preconditions**: Nhiều request `POST /salary-items` KHÔNG truyền `code` xảy ra gần đồng thời — CÓ THỂ đến từ các nguồn ĐỘC LẬP không phối hợp (không cần 1 người dùng cụ thể cố ý gửi N request).
- **Steps to reproduce**: (1) Chạy `npm run test:e2e` đầy đủ (bao gồm 2 file test tạo `SalaryItem` đồng thời: `salary-settings.e2e-spec.ts` case 3-way và file QA Round 3 case 3-way + 10-way) nhiều lần liên tiếp; HOẶC (2) tự gọi `Promise.all` ≥15 request `POST /salary-items` không `code` trong 1 tiến trình.
- **Expected result**: Mọi request hợp lệ về hình thức đều trả 201 (retry-on-conflict đảm bảo thành công) hoặc bị từ chối có kiểm soát (400/409), KHÔNG BAO GIỜ 500.
- **Actual result**: Ở tải đủ cao (N≥15 cùng tiến trình, HOẶC tải chéo giữa nhiều tiến trình/test file cộng dồn), 1 số request "thua cuộc" vượt quá `SALARY_ITEM_CODE_MAX_RETRY=5` lần thử vẫn nhận `500 Internal Server Error` (`error.code: INTERNAL`, không lộ stack trace).
- **Evidence**: log `Unique constraint failed on the constraint: salary_items_code_key` lặp lại; `AssertionError: expected 500 to be 201` tại `test/salary-settings-qa-round2-independent.e2e-spec.ts:314` khi chạy full-suite (2/8 lần chạy full-suite thất bại theo kiểu này — xem bảng Mục 6.2).
- **Suspected area**: `Backend/src/hr/salary/salary-items/salary-items.service.ts` — `SALARY_ITEM_CODE_MAX_RETRY = 5` không đủ lớn cho tải đồng thời thực tế đa nguồn; nguyên nhân gốc là `generateNextCode()` tính mã trong JS (không atomic ở Postgres), khác hẳn `EmployeeCodeService` (Postgres SEQUENCE, an toàn ở MỌI mức concurrency).
- **Không phải regression Round 3** — đây là giới hạn CỐ HỮU của chính phương án (a) mà Backend Engineer chọn để vá Bug #2, đã được Backend Engineer TỰ BÁO TRƯỚC (Mục 17.9) — QA xác nhận claim này CÓ THẬT nhưng bổ sung bằng chứng cho thấy mức độ rủi ro cao hơn ("tải đồng thời đa nguồn" dễ đạt tới hơn "1 request gửi N cuộc gọi" như cách đóng khung ban đầu).

### BUG-QA-R3-02 — [Low, test hygiene, không phải production bug] Cleanup test 3-way concurrency của Backend Engineer không idempotent khi có phần tử lỗi giữa mảng

- **Severity**: Low.
- **Suspected area**: `Backend/test/salary-settings.e2e-spec.ts` — pattern `results.forEach((res,i)=>{expect(...).toBe(201); createdItemIds.push(...)})` bỏ sót push id khi 1 phần tử TRƯỚC đó trong mảng fail assertion. Không ảnh hưởng code production, chỉ để lại dữ liệu test mồ côi trong DB dev khi test tự nó gặp đúng Bug #2 (BUG-QA-R3-01) giữa lúc chạy.
- Đã tự dọn dẹp 5 dòng mồ côi phát sinh trong phiên rà soát của tôi (`KL20/KL21/KL23/KL24/KL25`) — DB dev đã về đúng 19 dòng seed gốc trước khi kết thúc.

## 8. Đánh giá rủi ro nghiệp vụ & QA Recommendation

### 8.1 Đánh giá rủi ro nghiệp vụ cho BUG-QA-R3-01 (theo yêu cầu nhiệm vụ)

Câu hỏi được giao: case thực tế nghiệp vụ (admin tạo khoản lương mới) có khả năng xảy ra ≥ mức nguy hiểm hay không?

- Nếu chỉ xét kịch bản "1 admin/HR bấm submit nhiều lần liên tiếp thủ công" (đúng khung Code Review Round 2 mô tả) — khả năng xảy ra THẤP, N thực tế hiếm khi vượt 2-3 (một người không thể bấm 15 lần trong vài mili-giây). Ở mức này, test của tôi (N=3, N=8, N=10) xác nhận **0 lỗi 500 qua nhiều lần chạy** — an toàn cho kịch bản này.
- NHƯNG bằng chứng Mục 6.2 cho thấy rủi ro thực tế rộng hơn: **bất kỳ lúc nào có ≥2 nguồn ĐỘC LẬP** (2 người dùng khác nhau, HOẶC 1 script bulk-import chạy song song với 1 người dùng thủ công, HOẶC — như 19 `SalaryItem` seed ban đầu gợi ý — 1 kịch bản khởi tạo hệ thống ban đầu cần tạo NHIỀU khoản lương liên tiếp/hàng loạt) cùng tạo `SalaryItem` không truyền `code` gần thời điểm nhau, tổng tải cộng dồn CÓ THỂ vượt ngưỡng an toàn — và ngưỡng đó, theo bằng chứng của tôi, THẤP HƠN và KHÓ DỰ ĐOÁN HƠN so với con số "N=8" mà Backend Engineer nêu.
- **Kết luận QA**: Mức rủi ro chấp nhận được **CHO PHIÊN BẢN HIỆN TẠI CỦA QUY TRÌNH NGHIỆP VỤ ĐÃ BIẾT** (tạo lẻ tẻ, không có tính năng bulk-import qua UI) — nhưng **KHÔNG nên coi là mức rủi ro chấp nhận được vô điều kiện lâu dài**, đặc biệt nếu tương lai có: (a) tính năng nhập hàng loạt khoản lương qua UI/import Excel, (b) script khởi tạo dữ liệu ban đầu chạy nhiều luồng, hoặc (c) nhiều chi nhánh/phòng ban tự cấu hình khoản lương riêng cùng lúc trong giai đoạn triển khai hệ thống. Khuyến nghị: **escalate lên Architect/PO để quyết định tường minh** — chấp nhận rủi ro có ghi nhận (accept-with-documentation) hay bắt buộc Round 4 chuyển sang phương án (b) Postgres SEQUENCE (theo đề xuất gốc Code Reviewer Mục 3.3) — KHÔNG để mặc định "Non-blocking, để sau" trôi qua mà không có quyết định rõ ràng từ người có thẩm quyền nghiệp vụ.

### 8.2 QA Recommendation

✅ **GO cho Finding 5.2** (`E-sal-011` dedupe `items[]`) — xác nhận độc lập vá đúng, không regression, không có concurrency risk (chặn ở tầng Zod Pipe đơn luồng, không phải race condition).

✅ **GO cho Finding 5.3** (race double-submit `setSalary()`, `upsert` atomic) — xác nhận độc lập vá đúng ở quy mô 3-way concurrency, không mất dữ liệu, `setupVersion` nhất quán, không regression cho 2 gap CHẶN Round 2.

⚠️ **GO CÓ ĐIỀU KIỆN cho Bug #2 (retry-on-conflict sinh mã `KLxx`)** — xác nhận hoạt động đúng ở quy mô thực tế "vài người dùng thao tác thủ công" (N ≤ 10 trong môi trường của tôi, ổn định 100%), nhưng **Known Limitation Backend tự báo là CÓ THẬT** và bằng chứng của tôi cho thấy nó dễ xảy ra hơn qua tải đồng thời đa nguồn (không cần 1 request cụ thể cố ý gửi nhiều lần) — xem Mục 6.2, 7, 8.1. Điều kiện: cần Architect/PO xác nhận tường minh mức độ chấp nhận rủi ro này TRƯỚC KHI coi phân hệ Salary Settings sẵn sàng production không điều kiện cho MỌI kịch bản sử dụng tương lai (không chỉ kịch bản hiện tại).

**Không phát hiện regression nào** cho 2 gap CHẶN Round 2 (E-sal-009, E-sal-010) hay bất kỳ chức năng HR khác (262/262 e2e gốc pass ổn định qua 4 lần chạy).

## 9. Security findings

- Xác nhận lại (đồng thuận Code Reviewer Round 2): mọi response 500 (kể cả các lần tôi tái hiện thật ở Mục 6) đều trả `error.code: 'INTERNAL'` với message chung chung, KHÔNG lộ stack trace/thông tin nội bộ qua HTTP response — đã kiểm tra trực tiếp body JSON của các response 500 thu được trong test stress.
- Không phát hiện injection/lỗ hổng bảo mật mới trong phạm vi thay đổi Round 3 (dedupe items và upsert đều dùng Prisma parameterized query).
- RBAC không đổi, không có endpoint nào thiếu decorator `@Roles`.

## 10. Files đã tạo/sửa trong phiên rà soát này

- **MỚI**: `Backend/test/salary-settings-qa-round3-independent.e2e-spec.ts` (7 test case độc lập, gồm 1 bài stress thăm dò N=10).
- **MỚI**: `docs/hr/tester-qa/qa-report-salary-settings-round3.md` (file này).
- **Cập nhật**: `docs/hr/CONTEXT_SUMMARY.md` — thêm Mục "Tester-QA Rà soát Độc lập Round 3".
- **KHÔNG sửa bất kỳ production code nào** — đúng nguyên tắc "Tester QA không sửa code chỉ để test pass".
- **Dọn dẹp dữ liệu test mồ côi**: xoá 5 dòng `SalaryItem` mồ côi (`KL20/KL21/KL23/KL24/KL25`) phát sinh từ các lần chạy thất bại trong chính phiên rà soát của tôi — DB dev về đúng 19 dòng seed gốc.

## 11. Người review tiếp theo

Đề xuất: **Architect/PO** ra quyết định tường minh cho Mục 8.1 (chấp nhận rủi ro Bug #2 có ghi nhận, hay yêu cầu Round 4 Postgres SEQUENCE) trước khi **Code-Reviewer** re-verify Round 3 cuối cùng và trước khi bàn giao DevOps/Frontend không điều kiện.

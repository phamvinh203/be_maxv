# Báo Cáo Nghiệm Thu Kiểm Thử Phân Hệ Bảng Lương (Payroll Test Execution Report)

> **Mã tài liệu**: `TR-PAY-001`
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)
> **Giai đoạn**: Phase B — Dynamic Test Execution & Quality Verification (RE-RUN lần 2)
> **Tác giả**: QA/Tester Engineer
> **Thời điểm thực thi**: 2026-09-06 (lần chạy lại 21:31, đối soát lại toàn bộ số liệu)
> **Phiên bản**: `2.0.0` — thay thế hoàn toàn `v1.0.0`
> **Tài liệu tham chiếu**:
> - `docs/payroll/qa/test-cases.md` (Bộ ca kiểm thử BDD Gherkin)
> - `docs/payroll/qa/issues-and-bugs.md` (Danh mục lỗi & việc tồn đọng)
> - `docs/payroll/qa/test-matrix.md` (Ma trận truy vết)
> - `docs/payroll/srs/payroll-spec.md` · `docs/payroll/architecture/api-contract.md`

---

## 0. Ghi Chú Về Phiên Bản v1.0.0 (Đính Chính Bắt Buộc)

Bản báo cáo `v1.0.0` phát hành lúc 20:51 ngày 2026-09-06 chứa **số liệu và kết luận không được kiểm chứng**. Lần chạy lại này đính chính các điểm sau — đây là điều kiện tiên quyết để hồ sơ có giá trị nghiệm thu:

| # | Nội dung sai ở `v1.0.0` | Thực tế đo được ở `v2.0.0` |
|:--:|---|---|
| 1 | Toàn dự án `413` tests | **`414` tests** (lệch 1) |
| 2 | Payroll `121` tests | **`122` tests** (lệch 1) |
| 3 | Bảng phân bổ 8 test suites (18/14/14/8/14/6/22/25) | **Sai 7/8 dòng** — số thật: 22/18/9/14/17/8/21/13 |
| 4 | Mục 3 ghi `E-pay-008` "hiện ném `ForbiddenException`, cần chuyển" | **Đã vá rồi** (`payroll-periods.service.ts:271`) — báo cáo mâu thuẫn với `issues-and-bugs.md` cùng thư mục |
| 5 | Mục 3 ghi `E-pay-006` "Last-Write-Wins" | **Đã vá rồi** (`payroll-periods.service.ts:218`) |
| 6 | `E-pay-004` đánh 🟢 **PASS** | **KHÔNG có bất kỳ test nào** chạm tới `E-pay-004` |
| 7 | Bảng bao phủ tuyên bố **100%** BR / Error code / Edge case | Thực tế **26/41 ca kiểm thử (63,4%)** có test code; 8 ca **hoàn toàn chưa có test**; `EC-pay-010` **chưa được hiện thực trong code sản phẩm** |
| 8 | Kết luận `PASSED — ĐẠT 100% TIÊU CHUẨN NGHIỆM THU` | Không có căn cứ. Xem Mục 6. |

> Nguyên tắc QA: **không đánh dấu PASS cho ca kiểm thử chưa có test chạy thật**. Các dòng 🟢 PASS ở `v1.0.0` gán cho `TC-PAY-013 / 040 / 051 / 052 / 054 / 064 / 065 / 073 / 076 / 080` đều là tuyên bố không kiểm chứng.

---

## 1. Số Liệu Thực Thi Thật (Executed Evidence)

Lệnh chạy, ngày 2026-09-06, môi trường local Windows, Node + Vitest v4.1.11:

| Phạm vi | Lệnh | Test Files | Tests | Fail | Exit code |
|---|---|:---:|:---:|:---:|:---:|
| Toàn bộ Backend | `npm run test` | **33 / 33 PASS** | **414 / 414 PASS** | **0** | 0 |
| Riêng phân hệ payroll | `npx vitest run src/hr/payroll` | **8 / 8 PASS** | **122 / 122 PASS** | **0** | 0 |
| Static analysis | `npm run lint` (oxlint) | — | — | 0 error / 0 warning | 0 |
| Typecheck + build | `npm run build` (nest build) | — | — | — | 0 |

### 1.1. Phân Bổ Thật 122 Tests Theo 8 Test Suites

| # | Test suite | Số tests thật | Ghi chú |
|:--:|---|:---:|---|
| 1 | `calculation/payroll-calculation.pipeline.spec.ts` | **22** | BDD pipeline 6 stage, mang mã `TC-PAY-*` |
| 2 | `inputs/inputs.service.spec.ts` | **21** | Validation 8 phân hệ nhập liệu (`E-dltl-*`) |
| 3 | `periods/payroll-periods.service.spec.ts` | **18** | Vòng đời kỳ lương, reopen, lock, audit |
| 4 | `excel/payroll-excel.service.spec.ts` | **17** | Import/export xlsx, validate-then-commit |
| 5 | `common/payroll-scope.dto.spec.ts` | **14** | Lọc NV còn hợp đồng hiệu lực (`BR-dltl-002`) |
| 6 | `calculation/payroll-calculation.service.spec.ts` | **13** | Unit: biểu thuế 7 bậc, chặn sàn, snapshot |
| 7 | `catalogs/payroll-catalogs.service.spec.ts` | **9** | CRUD 4 danh mục + RESTRICT |
| 8 | `guards/payroll-period-lock.guard.spec.ts` | **8** | Chặn ghi khi kỳ LOCKED/APPROVED/PAID/ARCHIVED |
| | **TỔNG** | **122** | |

> **Không có test file nào cho tầng Controller trong phân hệ payroll.** `find src/hr/payroll -name "*controller*.spec.ts"` trả về rỗng. Toàn bộ 122 tests đều ở tầng service/guard/dto. Hệ quả trực tiếp: các lỗi ở tầng controller (xem `BUG-PAY-03`, `BUG-PAY-04`) lọt qua toàn bộ test suite.

---

## 2. Bảng Đối Soát Bao Phủ: 41 Ca `TC-PAY-*` → Test Code Thật

Nguồn: `docs/payroll/qa/test-cases.md` khai báo **41 ca** (không phải 40). Đối chiếu với tên `it(...)` thực tế trong `Backend/src/hr/payroll/**/*.spec.ts`.

Chú giải: ✅ có test code đúng ca · ⚠️ có test tương đương nhưng khác mã / chỉ phủ một phần · ❌ chưa có test code nào.

| Mã TC | Nội dung | Test code (file:line) | Trạng thái |
|:---|---|---|:---:|
| `TC-PAY-001` | Lương chuẩn HĐLĐ đủ 26 công | `pipeline.spec.ts:68` | ✅ |
| `TC-PAY-002` | OT hỗn hợp 150/200/300% | `pipeline.spec.ts:163` | ✅ |
| `TC-PAY-003` | Đủ 8 phân hệ dữ liệu biến động | `pipeline.spec.ts:231` | ✅ |
| `TC-PAY-010` | Thử việc ≥2tr, khấu trừ 10% | `pipeline.spec.ts:338` | ✅ |
| `TC-PAY-011` | HĐ dịch vụ ≥2tr, khấu trừ 10% | `pipeline.spec.ts:380` | ✅ |
| `TC-PAY-012` | Thử việc <2tr, thuế = 0 | `pipeline.spec.ts:415` | ✅ |
| `TC-PAY-013` | Chuyển HĐ thử việc → chính thức giữa kỳ | *(không có)* — logic tồn tại `payroll-calculation.service.ts:168-170,275` | ❌ |
| `TC-PAY-020` | Bóc tách miễn thuế OT 150% | Gộp trong `pipeline.spec.ts:226` (assert tổng 3 hệ số `2_900_000`) | ⚠️ |
| `TC-PAY-021` | Bóc tách miễn thuế OT 200% | Gộp như trên, không có assert riêng hệ số | ⚠️ |
| `TC-PAY-022` | Bóc tách miễn thuế OT 300% | Gộp như trên, không có assert riêng hệ số | ⚠️ |
| `TC-PAY-023` | OT đêm lễ Tết 390% | `pipeline.spec.ts:462` | ✅ |
| `TC-PAY-030` | BH 30tr dưới cả 2 trần | `pipeline.spec.ts:516` | ✅ |
| `TC-PAY-031` | BH 60tr vượt trần BHXH | `pipeline.spec.ts:555` | ✅ |
| `TC-PAY-032` | BH 120tr vượt cả 2 trần | `pipeline.spec.ts:597` | ✅ |
| `TC-PAY-033` | Trần đoàn phí 234.000đ | `pipeline.spec.ts:636` | ✅ |
| `TC-PAY-040` | Ăn trưa **trong** định mức (600k) | *(không có)* — chỉ có nhánh vượt trần; `TC-PAY-001` dùng mức bị kẹp về 730k | ❌ |
| `TC-PAY-041` | Ăn trưa vượt định mức 1.5tr | `pipeline.spec.ts:679` | ✅ |
| `TC-PAY-042` | Ăn trưa vượt trần + thiếu công 50% | `pipeline.spec.ts:729` | ✅ |
| `TC-PAY-043` | Nghỉ không lương cả tháng (0 công) | `pipeline.spec.ts:782` | ✅ |
| `TC-PAY-050` | Khóa sổ + snapshot nguyên tử đa tầng | `pipeline.spec.ts:841` | ✅ |
| `TC-PAY-051` | Đóng băng dữ liệu nguồn khi LOCKED | Chỉ có `payroll-period-lock.guard.spec.ts` chặn **ghi** (`E-dltl-001`); chưa test **đọc từ snapshot** | ⚠️ |
| `TC-PAY-052` | Bất biến snapshot khi sửa cài đặt lương | *(không có)* | ❌ |
| `TC-PAY-053` | Reopen thành công bởi ADMIN kèm lý do | `payroll-periods.service.spec.ts:230` nhưng mang mã `TC-DLTL-005` | ⚠️ |
| `TC-PAY-054` | Rollback toàn bộ khi lưu snapshot lỗi | *(không có)* | ❌ |
| `TC-PAY-060` | Thực lĩnh âm không clamp | `pipeline.spec.ts:907` | ✅ |
| `TC-PAY-061` | Chặn sàn chuyên cần | `pipeline.spec.ts:962` | ✅ |
| `TC-PAY-062` | Giảm trừ > thu nhập → thuế 0 | `pipeline.spec.ts:1028` | ✅ |
| `TC-PAY-063` | ROUND_HALF_UP về 1 đồng | `pipeline.spec.ts:1073` | ✅ |
| `TC-PAY-064` | Vào làm / nghỉ việc giữa kỳ | `payroll-calculation.service.spec.ts:305` + `payroll-scope.dto.spec.ts` chỉ phủ nhánh **nghỉ việc**; nhánh **vào làm giữa kỳ** chưa test | ⚠️ |
| `TC-PAY-065` | Cảnh báo lương BH dưới tối thiểu vùng | *(không có test — và **chưa hiện thực trong code sản phẩm**)* | ❌ |
| `TC-PAY-070` | `E-pay-001` khóa sổ khi chưa tính | `payroll-periods.service.spec.ts:155` | ✅ |
| `TC-PAY-071` | `E-pay-002` tính lại khi đã khóa | `pipeline.spec.ts:1088` | ✅ |
| `TC-PAY-072` | `E-pay-003` cấu hình không hợp lệ | `pipeline.spec.ts:1103` | ✅ |
| `TC-PAY-073` | `E-pay-004` không thấy dòng lương | *(không có)* — code ném tại `payroll-calculation.controller.ts:132` nhưng không có controller spec | ❌ |
| `TC-PAY-074` | `E-pay-005` không có NV đủ điều kiện | `pipeline.spec.ts:1125` | ✅ |
| `TC-PAY-075` | `E-pay-006` xung đột khóa sổ | `payroll-periods.service.spec.ts:210` | ✅ |
| `TC-PAY-076` | `E-pay-007` sai lệch checksum snapshot | *(không có)* — mã lỗi **chưa bao giờ được throw** trong code | ❌ |
| `TC-PAY-077` | `E-pay-008` non-ADMIN reopen | `payroll-periods.service.spec.ts:254` nhưng mang mã `TC-DLTL-006`; chỉ phủ tầng service | ⚠️ |
| `TC-PAY-078` | `E-pay-009` lý do <20 ký tự | `payroll-periods.service.spec.ts:290` | ✅ |
| `TC-PAY-079` | `E-pay-010` chi trả khi chưa duyệt | `payroll-periods.service.spec.ts:330` | ✅ |
| `TC-PAY-080` | Phân quyền xem phiếu lương cá nhân | *(không có)* — và kiểm tra thủ công phát hiện **`BUG-PAY-03` rò rỉ phiếu lương** | ❌ |

### 2.1. Tổng Kết Bao Phủ Thật

| Trạng thái | Số ca | Tỷ lệ |
|---|:---:|:---:|
| ✅ Có test code đúng ca | **26 / 41** | **63,4%** |
| ⚠️ Có test tương đương / phủ một phần | **7 / 41** | 17,1% |
| ❌ Chưa có test code nào | **8 / 41** | 19,5% |

Danh sách 8 ca chưa có test: `TC-PAY-013`, `TC-PAY-040`, `TC-PAY-052`, `TC-PAY-054`, `TC-PAY-065`, `TC-PAY-073`, `TC-PAY-076`, `TC-PAY-080`.

---

## 3. Đối Soát 10 Mã Lỗi `E-pay-001` .. `E-pay-010` (Grep Toàn Bộ `src/`)

| Mã lỗi | HTTP | Nơi **throw** trong code sản phẩm | Test chạm tới | Kết luận |
|:---:|:---:|---|---|:---:|
| `E-pay-001` | 400 | `payroll-periods.service.ts:202` | `TC-PAY-070` | 🟢 Có throw + có test |
| `E-pay-002` | 400 | `payroll-calculation.service.ts:128` | `TC-PAY-071` | 🟢 Có throw + có test |
| `E-pay-003` | 400 | `payroll-calculation.service.ts:141` | `TC-PAY-072` | 🟢 Có throw + có test |
| `E-pay-004` | 404 | `payroll-calculation.controller.ts:132` | **KHÔNG CÓ** | 🟠 Có throw, **0 test** |
| `E-pay-005` | 400 | `payroll-calculation.service.ts:160` | `TC-PAY-074` | 🟢 Có throw + có test |
| `E-pay-006` | 409 | `payroll-periods.service.ts:218` | `TC-PAY-075` | 🟡 Có throw + có test, nhưng cơ chế còn khe hở TOCTOU (xem `ISSUE-PAY-05`) |
| `E-pay-007` | 400 | **KHÔNG NƠI NÀO** — chỉ khai báo tại `common/payroll-errors.ts:49` và bảng status `:93` | **KHÔNG CÓ** | 🔴 **Dead error code** |
| `E-pay-008` | 403 | `payroll-periods.service.ts:271` | `TC-DLTL-006` (`payroll-periods.service.spec.ts:254`) | 🟢 Có throw + có test (đã vá `BUG-PAY-01`) |
| `E-pay-009` | 400 | `payroll-periods.service.ts:275` | `TC-PAY-078` | 🟢 Có throw + có test |
| `E-pay-010` | 400 | `payroll-periods.service.ts:379` | `TC-PAY-079` | 🟢 Có throw + có test |

**Kết luận Mục 3**: 8/10 mã lỗi có throw + test. `E-pay-004` có throw nhưng không test. `E-pay-007` là **mã lỗi chết** — được định nghĩa, được gán HTTP status, nhưng không có một dòng code nào ném ra. Điều này xác nhận `ISSUE-PAY-01` **CÒN TỒN ĐỌNG**, ngược lại với dòng 🟢 PASS mà `v1.0.0` từng ghi.

---

## 4. Đối Soát 11 Business Rules `BR-pay-001` .. `BR-pay-011`

| Mã BR | Hiện thực trong code | Test trực tiếp | Kết luận |
|:---:|---|---|:---:|
| `BR-pay-001` | Stage 1 — `payroll-calculation.service.ts:291` | `TC-PAY-001/002/003` | 🟢 Có |
| `BR-pay-002` | Stage 1 & 5 — cờ `isTaxable`/`isSocialInsurance` | `TC-PAY-001/003/041` (gián tiếp qua assert `taxableIncome`) | 🟡 Gián tiếp |
| `BR-pay-003` | Stage 5 — `:682` | `TC-PAY-041/042/043` | 🟢 Có |
| `BR-pay-004` | Stage 2 — `:403` | `TC-PAY-002/023` | 🟢 Có |
| `BR-pay-005` | Stage 5 — `:682` | `TC-PAY-010/011/012` | 🟢 Có |
| `BR-pay-006` | Stage 4 — `:643` | `TC-PAY-030/031/032` | 🟢 Có |
| `BR-pay-007` | Stage 4 — `:643` | `TC-PAY-001/033` | 🟢 Có |
| `BR-pay-008` | Stage 6 — `:757` | `TC-PAY-060` | 🟢 Có |
| `BR-pay-009` | Stage 3 — `:475`, `:575` | `TC-PAY-061` + unit `service.spec.ts:141` | 🟢 Có |
| `BR-pay-010` | `snapshotPayrollSheetLines` — `:834` | `TC-PAY-050` phủ **ghi** snapshot; phần **bất biến khi sửa master data** (`TC-PAY-052`) **chưa có test** | 🟠 Một phần |
| `BR-pay-011` | `reopen()` — `:261-275`, audit `:322` | `TC-DLTL-005/006`, `TC-PAY-078` ở tầng service | 🔴 **VI PHẠM ở tầng runtime** — xem `BUG-PAY-04`: `actorId` luôn `null` và audit `PERMISSION_DENIED` không bao giờ được ghi khi đi qua controller thật |

**BR chưa có test trực tiếp riêng**: `BR-pay-002` (chỉ suy ra gián tiếp từ `taxableIncome`), `BR-pay-010` (nửa sau), `BR-pay-011` (test tồn tại nhưng không phản ánh hành vi runtime — xem Mục 5).

---

## 5. Phát Hiện Trọng Yếu Của Lần Chạy Lại

### 5.1. Hai bug cũ đã được vá thật — có bằng chứng

| Bug | Vá tại | Test bảo vệ | Xác nhận |
|---|---|---|:---:|
| `BUG-PAY-01` (`E-pay-008` thay `ForbiddenException`) | `payroll-periods.service.ts:271` | `payroll-periods.service.spec.ts:254-262` assert `{ code: 'E-pay-008' }` | ✅ Đã vá + có test |
| `BUG-PAY-02` (optimistic check ném `E-pay-006`) | `payroll-periods.service.ts:207-220` | `payroll-periods.service.spec.ts:210-226` assert `{ code:'E-pay-006', httpStatus:409 }` | ✅ Đã vá + có test |

### 5.2. Bug mới phát hiện trong lần chạy lại (chi tiết ở `issues-and-bugs.md`)

| Bug | Severity | Tóm tắt |
|---|:---:|---|
| `BUG-PAY-03` | **Critical** | `GET /payroll/payslips/my` đọc `req.user?.email` — trường **không tồn tại** trong principal do `JwtAuthGuard` gắn. Prisma bỏ qua filter `undefined` → trả về phiếu lương của **nhân viên đầu bảng**, không phải người gọi. Rò rỉ dữ liệu lương. |
| `BUG-PAY-04` | **High** | `payroll-periods.controller.ts:89,100,105` truyền `req.user?.id` (không tồn tại; đúng là `userId`) → `lockedByUserId`/`approvedByUserId` luôn `null`, audit `PERMISSION_DENIED` khi non-ADMIN reopen **không bao giờ được ghi**. Vi phạm `BR-pay-011`. |
| `BUG-PAY-05` | **Medium** | `test-report.md v1.0.0` công bố số liệu sai và gắn PASS cho 10 ca không có test (đã đính chính bằng chính tài liệu này). |
| `BUG-PAY-06` | **Low** | Test tồn dư `payroll-periods.service.spec.ts:177` vẫn khẳng định *"lock() dùng last-write-wins, E-pay-006 chưa được implement ở bất kỳ đâu"* — mâu thuẫn với code đã vá và với `TC-PAY-075` ngay bên dưới. |

### 5.3. Bằng chứng thực nghiệm cho `BUG-PAY-03` và `BUG-PAY-04`

QA đã dựng **spec tạm thời** (chạy xong đã xóa, không commit vào repo) để chứng minh, không suy diễn:

- **Repro 1** — gọi `PayrollCalculationController.getMyPayslip('per-1', { user: { userId, sessionId, role: EMPLOYEE } })` với mock Prisma mô phỏng đúng ngữ nghĩa "field `undefined` bị loại khỏi WHERE": khẳng định `where` truyền xuống Prisma đúng bằng `{ email: undefined }`, và kết quả trả về `employeeId = 'emp-B-FIRST-ROW'` — **không phải** người gọi. Test PASS.
- **Repro 2** — gọi `PayrollPeriodsService.reopen(id, userId, Role.HR, dto)` hai lần với DI đúng thứ tự `(prisma, auditService, calculationService)`:
  - `userId = 'hr-id'` (giống unit test hiện có) → `auditService.log` được gọi **1 lần**.
  - `userId = undefined` (giống giá trị controller thật truyền vào) → `auditService.log` được gọi **0 lần**, trong khi vẫn ném đúng `E-pay-008`.
  Cả 2 test PASS → chứng minh unit test hiện tại cho cảm giác an toàn sai vì nó nạp thủ công `userId` mà controller thật không bao giờ cung cấp.

### 5.4. Ba issue tồn đọng — kiểm chứng lại từng cái

| Issue | Kết luận | Bằng chứng |
|---|:---:|---|
| `ISSUE-PAY-01` — checksum guard `E-pay-007` | **CÒN TỒN ĐỌNG** | `grep -rn "E-pay-007" src/` chỉ ra 2 vị trí khai báo (`common/payroll-errors.ts:49`, `:93`). Không có `throw` nào. |
| `ISSUE-PAY-02` — chunking `createMany` | **CÒN TỒN ĐỌNG** | `payroll-calculation.service.ts:929` gọi `payrollSheetItemBreakdown.createMany({ data: breakdownsToInsert })` một lần cho toàn bộ mảng, không chia batch. |
| `ISSUE-PAY-03` — `support-allowances` trả rỗng khi DRAFT | **CÒN TỒN ĐỌNG** | `grep -n "try\|catch" payroll-calculation.controller.ts` → **không match dòng nào** trong cả 360 dòng file. Nhánh `else` tại `:235` gọi thẳng `calculatePeriodPayroll(periodId)` nên vẫn văng `E-pay-005`. |

---

## 6. Kết Luận & Khuyến Nghị QA (QA Recommendation)

### 6.1. Điều đã được kiểm chứng là tốt

- **Lõi tính toán tài chính vững**: 414/414 tests toàn dự án PASS, 122/122 tests payroll PASS, lint sạch, build exit 0. Không có test nào fail, không có regression.
- Các công thức Gross, 2 trần bảo hiểm độc lập, bóc tách miễn thuế OT, thuế 10% tại nguồn, chặn sàn chuyên cần, dung nạp thực lĩnh âm, `ROUND_HALF_UP` đều có assert số tiền cụ thể tới từng đồng.
- Hai bug đã báo ở vòng trước (`BUG-PAY-01`, `BUG-PAY-02`) đã được vá và **có test bảo vệ thật**.

### 6.2. Điều chặn nghiệm thu

| # | Vấn đề | Mức |
|:--:|---|:---:|
| 1 | `BUG-PAY-03` — rò rỉ phiếu lương cá nhân qua `GET /payroll/payslips/my` | **Critical / Blocker** |
| 2 | `BUG-PAY-04` — mất danh tính người thực hiện trên toàn bộ hành động khóa sổ / duyệt / reopen; audit `PERMISSION_DENIED` không ghi → vi phạm `BR-pay-011` | **High** |
| 3 | Tầng controller payroll **không có một test nào**; 8/41 ca kiểm thử chưa hiện thực | **High** |
| 4 | `E-pay-007` là mã lỗi chết; `EC-pay-010` (cảnh báo lương tối thiểu vùng) chưa có trong code | **Medium** |

### 6.3. Quyết định của QA Engineer

- **KẾT QUẢ**: 🔴 **KHÔNG ĐẠT NGHIỆM THU (BLOCKED)** cho tới khi `BUG-PAY-03` và `BUG-PAY-04` được vá và có test bảo vệ.
- **Không** chuyển hồ sơ sang Code Reviewer với trạng thái "PASSED". Trả về **Backend Engineer** xử lý 2 bug chặn, sau đó QA chạy lại Phase B vòng 3.
- Test suite hiện tại **PASS 100% nhưng không đủ để kết luận chất lượng**: cả 2 bug chặn đều nằm ngoài vùng phủ của 122 tests vì không có test tầng controller.
- Yêu cầu tối thiểu để mở khóa nghiệm thu: (a) vá `BUG-PAY-03`, `BUG-PAY-04`; (b) bổ sung `payroll-calculation.controller.spec.ts` + `payroll-periods.controller.spec.ts` phủ `TC-PAY-073`, `TC-PAY-080`, và đường dẫn principal thật; (c) gỡ hoặc viết lại test tồn dư `payroll-periods.service.spec.ts:177`.

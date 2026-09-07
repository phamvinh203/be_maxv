# Danh Mục Lỗi & Việc Tồn Đọng Phân Hệ Bảng Lương (Payroll Issues and Bugs)

> **Mã tài liệu**: `BUG-PAY-001`
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)
> **Giai đoạn**: Phase B — Dynamic Test Execution & Quality Verification (RE-RUN lần 2)
> **Tác giả**: QA/Tester Engineer
> **Thời điểm thẩm tra**: 2026-09-06 (lần chạy lại 21:31)
> **Phiên bản**: `2.0.0` — thay thế `v1.0.0`

---

## 0. TÌNH TRẠNG KHẮC PHỤC (cập nhật cuối ngày 2026-09-06)

> Toàn bộ lỗi chặn ghi nhận trong tài liệu này **đã được khắc phục** sau khi QA và Code Reviewer bàn giao. Bảng dưới là trạng thái chốt; phần mô tả chi tiết bên dưới **giữ nguyên** để làm hồ sơ truy vết.

| Mã lỗi | Mô tả ngắn | Trạng thái | Bằng chứng |
|---|---|:---:|---|
| `BUG-PAY-01` / `BLK-PAY-08` | `E-pay-008` bị nuốt bởi `ForbiddenException` | ✅ Đã vá (từ trước) | `payroll-periods.service.ts:271` |
| `BUG-PAY-02` | `lock()` thiếu optimistic lock `E-pay-006` | ✅ Đã vá (từ trước) | `payroll-periods.service.ts:218` |
| `BUG-PAY-03` / `BLK-PAY-02` | **Rò rỉ phiếu lương người khác (IDOR)** | ✅ Đã vá | Thêm `Employee.userId` unique FK; controller tra theo `req.user.userId`, fail-closed. Test: `payroll-calculation.controller.spec.ts` (3 ca) |
| `BUG-PAY-04` / `BLK-PAY-07` | Mất dấu vết kiểm toán do `req.user?.id` | ✅ Đã vá | `payroll-periods.controller.ts:89,100,106` → `userId`. Test: `payroll-periods.controller.spec.ts` (3 ca) |
| `BLK-PAY-01` | Cộng trùng lương gốc → **Gross nhân đôi** | ✅ Đã vá | Cờ `SalaryItem.isBaseSalary`; Stage 1 bỏ qua. Test hồi quy Nhóm 9 |
| `BLK-PAY-03` | Miễn thuế OT **luôn = 0** trên dữ liệu thật | ✅ Đã vá | Đọc đúng `hours`/`ratePercent`/`convertedHours`; **gỡ bỏ** nhánh fallback viết cho mock |
| `BLK-PAY-04` | Phân loại khoản lương bằng dò tên tiếng Việt | ✅ Đã vá | `calculationMethod` đọc từ `SalaryStructureItem`; ăn ca nhận diện bằng cờ `isMealAllowance` |
| `BLK-PAY-05` | Hợp đồng không lọc theo kỳ | ✅ Đã vá | `where: { effectiveFrom: { lte: period.endDate } }` |
| `BLK-PAY-06` | Trừ đoàn phí khỏi thu nhập tính thuế | ✅ Đã vá | Bỏ `- employeeUnionFee` khỏi căn cứ tính thuế (`BR-pay-005`) |
| `ISSUE-PAY-04` | Không có test tầng controller | ✅ Đã xử lý | Thêm 2 file controller spec (6 ca) |
| `ISSUE-PAY-06` | `EC-pay-010` lương tối thiểu vùng chưa có trong code | 🔶 Còn tồn đọng | Ghi nhận backlog |
| `ISSUE-PAY-01` | Checksum guard `E-pay-007` (dead error code) | 🔶 Còn tồn đọng | Chưa có `throw E-pay-007` |
| `ISSUE-PAY-02` | `createMany` snapshot chưa chunk | 🔶 Còn tồn đọng | Rủi ro khi > 5.000 NV |
| `ISSUE-PAY-03` | `support-allowances` ném `E-pay-005` ở kỳ DRAFT rỗng | 🔶 Còn tồn đọng | Ghi nhận backlog |

**Bổ sung ngoài phạm vi QA báo cáo**: cập nhật **8/9 tham số pháp lý đã lỗi thời** (giảm trừ gia cảnh 15,5tr/6,2tr, biểu thuế 5 bậc, trần BHTN 106,2tr, đoàn phí 0,5%...) và chuyển sang mô hình **tham số có hiệu lực theo thời gian** (`BR-pay-012`). Xem `CONTEXT_SUMMARY.md` Mục 11.

**Kết quả kiểm chứng sau khắc phục**: **36 test files · 454 tests PASS · 0 fail** · lint exit 0 · build exit 0. (Trước khắc phục: 33 files / 414 tests.)
> **Tài liệu tham chiếu**:
> - `docs/payroll/qa/test-report.md` (Báo cáo nghiệm thu v2.0.0)
> - `docs/payroll/qa/test-cases.md` · `docs/payroll/qa/test-matrix.md`
> - `docs/payroll/srs/payroll-spec.md` (Mục 4 Business Rules, Mục 5 Ma trận mã lỗi)
> - `docs/payroll/architecture/api-contract.md`

---

## 1. Tổng Quan Tình Trạng Chất Lượng

Kết quả chạy lại toàn bộ Phase B ngày 2026-09-06:

- **Test suite**: 414/414 tests toàn Backend PASS · 122/122 tests payroll PASS · lint exit 0 · build exit 0. **0 regression.**
- **Hai bug vòng trước đã được vá thật và có test bảo vệ**: `BUG-PAY-01`, `BUG-PAY-02`.
- **Phát hiện mới 4 bug**, trong đó **1 Critical (rò rỉ dữ liệu lương)** và **1 High (mất dấu vết kiểm toán)**. Cả hai đều **không bị bắt bởi 122 tests hiện có** vì phân hệ payroll **không có bất kỳ test nào ở tầng controller**.
- **3 issue tồn đọng cũ**: cả 3 vẫn **CÒN TỒN ĐỌNG**, không cái nào được xử lý.
- **Bao phủ thật**: 26/41 ca `TC-PAY-*` có test code (63,4%), không phải 100% như `v1.0.0` công bố.

### Bảng Thống Kê

| Phân loại | Critical (P0) | High (P1) | Medium (P2) | Low (P3) | TỔNG |
|---|:---:|:---:|:---:|:---:|:---:|
| Bug đã vá & kiểm chứng | 0 | 0 | 1 | 1 | **2** |
| Bug đang mở | **1** | **1** | 1 | 1 | **4** |
| Issue / task tồn đọng | 0 | 1 | 4 | 3 | **8** |
| **TỔNG CỘNG** | **1** | **2** | **6** | **5** | **14** |

---

## 2. Bug Đã Khắc Phục & Kiểm Chứng (Closed)

### 2.1. `BUG-PAY-01` — `E-pay-008` bị nuốt bởi `ForbiddenException` chuẩn

* **Severity**: Medium · **Priority**: P1
* **Trạng thái**: ✅ **ĐÃ VÁ & CÓ TEST BẢO VỆ (CLOSED)**
* **Bằng chứng vá**: `Backend/src/hr/payroll/periods/payroll-periods.service.ts:270-271`

  ```typescript
  // BUG-PAY-01: Chuẩn hóa phản hồi mã lỗi E-pay-008 (403 Forbidden)
  throw new PayrollError({ code: 'E-pay-008' });
  ```

* **Bằng chứng test**: `payroll-periods.service.spec.ts:254-262` — test `TC-DLTL-006` assert `rejects.toMatchObject({ code: 'E-pay-008', httpStatus: 403 })`. Chạy PASS ngày 2026-09-06.
* **Tồn dư cần lưu ý**: test này mang mã `TC-DLTL-006` trong khi `test-cases.md` đặc tả ca này là `TC-PAY-077` → lệch truy vết, ghi nhận ở `ISSUE-PAY-07`. Đồng thời test chỉ phủ **tầng service**, không phủ đường đi thật từ controller — chính khe hở này để lọt `BUG-PAY-04`.

### 2.2. `BUG-PAY-02` — `lock()` thiếu optimistic concurrency check

* **Severity**: Low · **Priority**: P2
* **Trạng thái**: ✅ **ĐÃ VÁ & CÓ TEST BẢO VỆ (CLOSED — kèm cảnh báo kỹ thuật)**
* **Bằng chứng vá**: `payroll-periods.service.ts:207-220` — bên trong `$transaction` đọc lại kỳ lương rồi ném `E-pay-006` nếu trạng thái đã bất biến.
* **Bằng chứng test**: `payroll-periods.service.spec.ts:210-226` (`TC-PAY-075`) — mock lần đọc ngoài `PENDING_REVIEW`, lần đọc trong transaction `LOCKED`; assert `{ code: 'E-pay-006', httpStatus: 409 }`. PASS.
* **Cảnh báo kỹ thuật**: cơ chế hiện tại là **đọc lại rồi mới update**, không phải conditional update (`where: { id, status }`) cũng không có cột `version`. Ở mức cô lập mặc định READ COMMITTED của PostgreSQL, hai transaction đồng thời vẫn có thể **cùng đọc ra `PENDING_REVIEW`** rồi cùng update → khe hở TOCTOU vẫn tồn tại. Test `TC-PAY-075` chỉ chứng minh guard hoạt động khi trạng thái đã đổi **trước** lần đọc trong transaction, không chứng minh tính nguyên tử thật. Ghi nhận thành `ISSUE-PAY-05`.

---

## 3. Bug Đang Mở (Open Defects)

### 3.1. `BUG-PAY-03` — Rò rỉ phiếu lương: `GET /payroll/payslips/my` trả về phiếu lương của người khác

* **Mã Bug**: `BUG-PAY-03`
* **Severity**: 🔴 **Critical** · **Priority**: **P0 (Blocker)**
* **Loại**: Broken Access Control (OWASP A01) — rò rỉ dữ liệu tiền lương cá nhân
* **Môi trường**: Backend NestJS 12 + Prisma, mọi môi trường (dev/staging/prod)
* **Mô-đun**: `Backend/src/hr/payroll/calculation/payroll-calculation.controller.ts:326-329`
* **Quy tắc vi phạm**: `TC-PAY-080` (Payslip Isolation, P0), ma trận RBAC trong `api-contract.md`

#### Nguyên nhân cốt lõi

`JwtAuthGuard` gắn principal vào request với **đúng 3 trường**:

```typescript
// Backend/src/common/guards/jwt-auth.guard.ts:81-85
(request as Request & { user?: RequestUser }).user = {
  userId: session.userId,
  sessionId: session.id,
  role: session.user.role,
};
```

Interface `RequestUser` (`src/common/decorators/current-user.decorator.ts:5-9`) cũng chỉ có `userId` / `sessionId` / `role`. **Không có `email`, không có `id`.**

Nhưng controller đọc:

```typescript
// payroll-calculation.controller.ts:326-329
const userEmail = req.user?.email;          // → LUÔN undefined
const employee = await this.prisma.employee.findFirst({
  where: { email: userEmail },              // → { email: undefined }
});
```

Prisma bỏ qua field có giá trị `undefined` khi dựng WHERE → câu truy vấn trở thành `findFirst()` **không điều kiện** → trả về **bản ghi Employee đầu tiên trong bảng**. Tham số `@Req() req: any` khiến TypeScript không bắt được lỗi này lúc compile.

#### Steps to reproduce

1. Đăng nhập bằng tài khoản vai trò `EMPLOYEE` bất kỳ (nhân viên A).
2. Chọn một kỳ lương đã ở trạng thái `PAID` hoặc `ARCHIVED`.
3. Gọi `GET /payroll/payslips/my?periodId={id}` với Bearer token của A.

#### Expected vs Actual

* **Expected**: trả về phiếu lương của **chính nhân viên A**; nếu không xác định được nhân sự tương ứng thì từ chối.
* **Actual**: trả về phiếu lương của **nhân viên đầu tiên trong bảng `employees`** — bao gồm `netTakeHomeSalary`, `personalIncomeTax`, `insuranceSalaryBase` và toàn bộ `breakdowns`. Mọi nhân viên đăng nhập đều nhìn thấy cùng một phiếu lương của người khác.

#### Evidence (thực nghiệm)

QA dựng spec tạm (đã xóa, không commit) gọi thẳng `controller.getMyPayslip('per-1', { user: { userId:'user-A', sessionId:'s1', role: EMPLOYEE } })` với mock Prisma mô phỏng đúng ngữ nghĩa Prisma (loại field `undefined` khỏi WHERE). Kết quả test **PASS** với 2 assert:

```
expect(capturedWhere[0]).toEqual({ email: undefined });   // where rỗng thật
expect(res.data.employeeId).toBe('emp-B-FIRST-ROW');      // trả về NV khác
expect(res.data.employeeId).not.toBe('emp-A-CALLER');
```

#### Vấn đề nền tảng đi kèm

Kể cả khi `req.user.email` được sửa cho đúng, cách tra cứu này **vẫn không an toàn**: `prisma/schema.prisma:291-292` ghi rõ `Employee.email` **KHÔNG unique** (`BR-hr-010`) và nullable. Schema **không có quan hệ `User ↔ Employee`** nào. Xem `ISSUE-PAY-08`.

#### Khuyến nghị khắc phục (Backend + Architect)

1. Trước mắt (hotfix chặn rò rỉ): dùng `@CurrentUser() user: RequestUser` thay `@Req() req: any`; nếu không giải được `employeeId` thì **từ chối** thay vì `findFirst` không điều kiện.
2. Căn cơ: bổ sung liên kết `User ↔ Employee` (`Employee.userId` unique, FK tới `User.id`) và tra cứu theo `userId` — cần Architect quyết định (xem `ISSUE-PAY-08`).
3. Bổ sung `payroll-calculation.controller.spec.ts` hiện thực `TC-PAY-080` (nhân viên A không thấy phiếu của B; kỳ chưa `PAID` bị chặn).

---

### 3.2. `BUG-PAY-04` — Mất danh tính người thực hiện; audit `PERMISSION_DENIED` không bao giờ được ghi

* **Mã Bug**: `BUG-PAY-04`
* **Severity**: 🟠 **High** · **Priority**: **P1**
* **Loại**: Sai contract nội bộ → mất dấu vết kiểm toán tài chính
* **Mô-đun**: `Backend/src/hr/payroll/periods/payroll-periods.controller.ts:89, 100, 105`
* **Quy tắc vi phạm**: `BR-pay-011` (Bảo mật Reopen Kỳ lương **có Kiểm toán**)

#### Nguyên nhân cốt lõi

Controller truyền `req.user?.id`, nhưng principal chỉ có `userId`:

```typescript
// payroll-periods.controller.ts:89
return this.periodsService.lock(id, req.user?.id);        // undefined
// :100
return this.periodsService.reopen(id, req.user?.id, req.user?.role, dto);  // userId undefined
// :105
return this.periodsService.approve(id, req.user?.id);     // undefined
```

Hệ quả trong service:

| Vị trí | Hệ quả thực tế |
|---|---|
| `payroll-periods.service.ts:225-227` | `lockedByUserId` ghi vào DB luôn là `null` — không biết ai khóa sổ |
| `payroll-periods.service.ts:262` | `if (userId) { auditService.log(PERMISSION_DENIED) }` → điều kiện **luôn false** → **không bao giờ ghi log** hành vi non-ADMIN cố reopen |
| `payroll-periods.service.ts:323` | `actorId: userId ?? null` → audit `PAYROLL_PERIOD_REOPENED` ghi actor **null** — biết có người mở lại kỳ lương nhưng không biết ai |
| `approve()` | `approvedByUserId` luôn `null` |

`req.user?.role` cũng không bị lỗi này (trường `role` có thật), nên guard RBAC vẫn chặn đúng — chỉ **danh tính** bị mất.

#### Vì sao 122 tests không bắt được

Unit test gọi thẳng service với `userId` nạp tay: `service.reopen('p-1', 'hr-id', Role.HR, {...})`. Controller thật không bao giờ cung cấp giá trị đó. Test cho **cảm giác an toàn sai**.

#### Evidence (thực nghiệm)

Spec tạm (đã xóa) dựng `PayrollPeriodsService` đúng thứ tự DI `(prisma, auditService, calculationService)`, chạy 2 nhánh — **cả 2 test PASS**:

| Nhánh | `userId` truyền vào | `auditService.log` được gọi | Lỗi ném ra |
|---|---|:---:|---|
| A (giống unit test hiện có) | `'hr-id'` | **1 lần** | `E-pay-008` |
| B (giống controller thật) | `undefined` | **0 lần** | `E-pay-008` |

#### Expected vs Actual

* **Expected**: mọi thao tác `lock` / `reopen` / `approve` ghi nhận đúng `userId` người thực hiện; mọi lần non-ADMIN cố reopen đều để lại bản ghi `AuditLog` với `event = PERMISSION_DENIED`.
* **Actual**: `lockedByUserId` / `approvedByUserId` / `actorId` đều `null`; log `PERMISSION_DENIED` không tồn tại.

#### Khuyến nghị khắc phục

1. Đổi `req.user?.id` → `req.user?.userId` tại 3 vị trí, hoặc tốt hơn dùng `@CurrentUser() user: RequestUser` để TypeScript bắt lỗi.
2. Trong `reopen()`, bỏ điều kiện `if (userId)` bao quanh audit `PERMISSION_DENIED` — hành vi bị từ chối phải được ghi log **kể cả khi** không xác định được actor (ghi `actorId: null` kèm ghi chú).
3. Bổ sung `payroll-periods.controller.spec.ts` khẳng định service nhận đúng `userId` từ principal.

---

### 3.3. `BUG-PAY-05` — Báo cáo nghiệm thu `v1.0.0` công bố số liệu và kết luận không kiểm chứng

* **Severity**: 🟡 **Medium** · **Priority**: P2 · **Loại**: Documentation / Process defect
* **Trạng thái**: ✅ **ĐÃ ĐÍNH CHÍNH** bằng `test-report.md v2.0.0` (Mục 0)
* **Chi tiết sai lệch**: tổng tests 413 (thật 414); payroll 121 (thật 122); bảng phân bổ 8 suites sai 7/8 dòng; Mục 3 vẫn mô tả `E-pay-006`/`E-pay-008` là **chưa vá** trong khi `issues-and-bugs.md` cùng thư mục ghi **đã vá** (2 tài liệu mâu thuẫn nhau); gắn 🟢 PASS cho `TC-PAY-013 / 040 / 051 / 052 / 054 / 064 / 065 / 073 / 076 / 080` — **không ca nào có test code**; tuyên bố bao phủ **100%** trong khi thực tế **63,4%**.
* **Tác động**: BA / Code Reviewer đọc `v1.0.0` sẽ tin phân hệ đã đạt nghiệm thu và bỏ qua 2 bug chặn.
* **Phòng ngừa**: mọi dòng PASS trong report bắt buộc kèm `file:line` của test code; số tests lấy từ output lệnh chạy thật, không viết tay.

---

### 3.4. `BUG-PAY-06` — Test tồn dư mô tả sai hành vi hiện tại của `lock()`

* **Severity**: 🟢 **Low** · **Priority**: P3 · **Loại**: Test debt
* **Vị trí**: `Backend/src/hr/payroll/periods/payroll-periods.service.spec.ts:177-208`
* **Mô tả**: test tên *"E-dltl-026 reserved (RETRO-10): lock() hiện dùng last-write-wins, KHÔNG có version check"* với comment khẳng định *"mã lỗi này chưa được implement ở bất kỳ đâu trong service. Đây là bằng chứng cho RETRO-10"*. Khẳng định đó **đã sai** kể từ khi `BUG-PAY-02` được vá (`payroll-periods.service.ts:218` ném `E-pay-006`).
* **Vì sao vẫn PASS**: test mock `findUnique` trả `PENDING_REVIEW` cho **mọi** lần gọi, nên guard trong transaction không kích hoạt; các assert `where` không chứa `status`/`updatedAt` vẫn đúng về mặt kỹ thuật vì guard được cài bằng **đọc lại**, không phải conditional update.
* **Rủi ro**: test này nằm ngay trên `TC-PAY-075` và nói ngược lại — người đọc sau sẽ hiểu nhầm là hệ thống chưa có kiểm soát đồng thời.
* **Khuyến nghị**: viết lại tiêu đề + comment thành mô tả đúng ("guard là re-read trong transaction, không phải conditional update — khe hở TOCTOU còn tồn tại, xem `ISSUE-PAY-05`"), hoặc gỡ bỏ và thay bằng test cho `ISSUE-PAY-05`.

---

## 4. Issues & Tasks Tồn Đọng

### 4.1. `ISSUE-PAY-01` — Checksum guard `E-pay-007` cho snapshot

* **Trạng thái**: 🔴 **CÒN TỒN ĐỌNG** (không thay đổi so với vòng trước)
* **Mức**: Medium — an toàn tài chính (defensive programming)
* **Bằng chứng**: `grep -rn "E-pay-007" Backend/src/` chỉ ra **2 vị trí, cả 2 đều là khai báo**:
  - `src/common/payroll-errors.ts:49` — thông điệp lỗi
  - `src/common/payroll-errors.ts:93` — ánh xạ HTTP 400

  **Không có một lệnh `throw new PayrollError({ code: 'E-pay-007' })` nào trong toàn bộ code sản phẩm.** Đây là **dead error code**: được đặc tả, được cấp mã, được ghi vào API contract, nhưng không bao giờ xảy ra. Client nào xử lý nhánh `E-pay-007` là code chết.
* **Việc cần làm**: trước `createMany` trong `snapshotPayrollSheetLines`, đối chiếu `Σ breakdowns.calculatedAmount` với `line.grossIncome` cho từng dòng; lệch ≥ 1đ thì ném `E-pay-007` để rollback transaction. Sau đó hiện thực `TC-PAY-076`.

### 4.2. `ISSUE-PAY-02` — Chunking `createMany` khi số nhân viên lớn

* **Trạng thái**: 🔴 **CÒN TỒN ĐỌNG**
* **Mức**: Medium — scalability
* **Bằng chứng**: `Backend/src/hr/payroll/calculation/payroll-calculation.service.ts:928-931`

  ```typescript
  if (breakdownsToInsert.length > 0) {
    await (client as any).payrollSheetItemBreakdown.createMany({
      data: breakdownsToInsert,        // toàn bộ mảng, KHÔNG chia batch
    });
  }
  ```

  `payrollSheetLine.createMany` tại `:858` cũng chèn một phát toàn bộ danh sách.
* **Rủi ro**: 5.000 NV × ~8 cấu phần ≈ 40.000 bản ghi con, mỗi bản ghi ~18 cột → vượt giới hạn 65.535 tham số của PostgreSQL protocol. Khi vượt, lệnh khóa sổ sẽ fail và rollback toàn bộ kỳ lương.
* **Việc cần làm**: chia batch ~1.000 bản ghi cho cả `payrollSheetLine` lẫn `payrollSheetItemBreakdown`; cân nhắc nâng `timeout` transaction (hiện `30000ms` tại `:942`).

### 4.3. `ISSUE-PAY-03` — `GET /payroll/support-allowances` văng lỗi khi kỳ DRAFT chưa có nhân viên

* **Trạng thái**: 🔴 **CÒN TỒN ĐỌNG**
* **Mức**: Low — UX / API usability
* **Bằng chứng**: `grep -n "try\|catch" Backend/src/hr/payroll/calculation/payroll-calculation.controller.ts` → **không match dòng nào** trên toàn bộ 360 dòng file. Nhánh `else` (kỳ chưa khóa) tại `:235` gọi thẳng `await this.calculationService.calculatePeriodPayroll(periodId)`, nên `E-pay-005` (400) vẫn bắn thẳng ra client.
* **Việc cần làm**: bọc `try/catch`, bắt riêng `E-pay-005` và trả `{ success: true, data: { periodId, categories: [], rows: [] } }`.

### 4.4. `ISSUE-PAY-04` — Phân hệ payroll không có test tầng Controller

* **Trạng thái**: 🔴 MỚI · **Mức**: High
* **Bằng chứng**: `find Backend/src/hr/payroll -name "*controller*.spec.ts"` → **rỗng**. 122/122 tests đều ở tầng service / guard / dto.
* **Tác động**: đây là nguyên nhân gốc khiến cả `BUG-PAY-03` (Critical) và `BUG-PAY-04` (High) lọt qua toàn bộ test suite mà vẫn "PASS 100%". Các ca `TC-PAY-073` (`E-pay-004`) và `TC-PAY-080` (payslip isolation) không thể hiện thực nếu thiếu tầng test này.
* **Việc cần làm**: tạo `payroll-calculation.controller.spec.ts` và `payroll-periods.controller.spec.ts`; tối thiểu phủ: principal thật `{ userId, sessionId, role }`, `TC-PAY-073`, `TC-PAY-080`, và ma trận RBAC 4 vai trò.

### 4.5. `ISSUE-PAY-05` — `E-pay-006` mới là re-read guard, chưa nguyên tử thật

* **Trạng thái**: 🟡 MỚI · **Mức**: Medium
* **Bằng chứng**: `payroll-periods.service.ts:207-220` đọc lại bằng `tx.payrollPeriod.findUnique({ where: { id } })` rồi mới `update({ where: { id } })` tại `:222`. Không có conditional update (`where: { id, status }`), không có cột `version`.
* **Rủi ro**: dưới READ COMMITTED, hai transaction đồng thời có thể cùng đọc `PENDING_REVIEW` → cùng ghi `LOCKED` → snapshot bị ghi 2 lần (lần sau `deleteMany` rồi `createMany` lại). `TC-PAY-075` không phủ được kịch bản này vì nó mock sẵn trạng thái đã đổi.
* **Việc cần làm**: chuyển sang `updateMany({ where: { id, status: { in: [DRAFT, PENDING_REVIEW] } } })` và kiểm tra `count === 0` → ném `E-pay-006`; hoặc thêm cột `version` optimistic. Kèm test kiểm chứng số bản ghi bị ảnh hưởng.

### 4.6. `ISSUE-PAY-06` — `EC-pay-010` (cảnh báo lương BH dưới tối thiểu vùng) chưa được hiện thực

* **Trạng thái**: 🔴 MỚI · **Mức**: Medium — lệch giữa đặc tả và code
* **Bằng chứng**: grep toàn bộ `Backend/src/hr/payroll/` với các từ khóa `minimum` / `min_region` / `tối thiểu` / mức lương vùng → **không match**. Không có bất kỳ logic cảnh báo nào.
* **Tác động**: `TC-PAY-065` không thể hiện thực; `test-report.md v1.0.0` từng đánh `EC-pay-010` là 🟢 PASS — sai.
* **Việc cần làm**: BA/Architect chốt nguồn dữ liệu mức lương tối thiểu vùng và hình thức cảnh báo (field cảnh báo trên response hay bản ghi riêng), sau đó Backend hiện thực và QA bổ sung `TC-PAY-065`.

### 4.7. `ISSUE-PAY-07` — Lệch mã truy vết giữa `test-cases.md` và tên test trong code

* **Trạng thái**: 🟡 MỚI · **Mức**: Low — traceability
* **Bằng chứng**: `TC-PAY-053` (reopen thành công) hiện thực dưới tên `TC-DLTL-005` (`payroll-periods.service.spec.ts:230`); `TC-PAY-077` (`E-pay-008`) hiện thực dưới tên `TC-DLTL-006` (`:254`). Grep theo mã `TC-PAY-*` không tìm ra 2 ca này → dễ bị đếm nhầm thành "chưa có test".
* **Việc cần làm**: đổi tên test thành `TC-PAY-053` / `TC-PAY-077` (giữ chú thích mã cũ), hoặc cập nhật `test-matrix.md` ánh xạ 2 chiều.

### 4.8. `ISSUE-PAY-08` — Không có liên kết `User ↔ Employee` trong data model

* **Trạng thái**: 🔴 MỚI · **Mức**: Medium — data model gap, cần **Architect** quyết định
* **Bằng chứng**: `Backend/prisma/schema.prisma:282-312` — model `Employee` **không có** trường `userId` hay quan hệ tới `User`; `:291-292` ghi rõ `Employee.email` **KHÔNG unique** (`BR-hr-010`) và nullable, kèm chú thích *"khác email đăng nhập ở feature auth (`User.email` là định danh)"*.
* **Tác động**: không có cách đúng để một tài khoản đăng nhập tra ra hồ sơ nhân sự của chính mình. Đây là gốc rễ khiến `payslips/my` phải "chữa cháy" bằng `findFirst` theo email — sinh ra `BUG-PAY-03`. Ngay cả khi vá `req.user.email`, việc match theo email không unique vẫn có thể trả nhầm người.
* **Việc cần làm**: Architect bổ sung `Employee.userId String? @unique` + FK tới `User.id` (kèm migration và quy trình gán cho dữ liệu hiện có), cập nhật `docs/payroll/architecture/data-model.md`; Backend chuyển `payslips/my` sang tra theo `userId`.

### 4.9. Danh mục ca kiểm thử cần bổ sung (test debt)

| Ca | Nội dung | Chặn bởi |
|---|---|---|
| `TC-PAY-013` | Chuyển HĐ thử việc → chính thức giữa kỳ | Không — logic đã có (`payroll-calculation.service.ts:168-170`), chỉ thiếu test |
| `TC-PAY-040` | Ăn trưa **trong** định mức | Không — chỉ thiếu test nhánh dưới trần |
| `TC-PAY-052` | Bất biến snapshot khi sửa master data | Không |
| `TC-PAY-054` | Rollback khi lưu snapshot lỗi | Không |
| `TC-PAY-064` | Nhánh **vào làm** giữa kỳ (nhánh nghỉ việc đã có) | Không |
| `TC-PAY-065` | Cảnh báo dưới lương tối thiểu vùng | `ISSUE-PAY-06` (chưa có code) |
| `TC-PAY-073` | `E-pay-004` | `ISSUE-PAY-04` (chưa có controller spec) |
| `TC-PAY-076` | `E-pay-007` | `ISSUE-PAY-01` (chưa có code throw) |
| `TC-PAY-080` | Payslip isolation | `BUG-PAY-03` + `ISSUE-PAY-04` |
| `TC-PAY-020/021/022` | Tách assert miễn thuế OT theo từng hệ số | Không — hiện gộp trong `TC-PAY-002` |

---

## 5. Kế Hoạch Bàn Giao & Thứ Tự Ưu Tiên

1. **Không chuyển sang Code Reviewer với trạng thái PASSED.** Trả về **Backend Engineer**.
2. **Thứ tự xử lý bắt buộc trước khi nghiệm thu lại**:
   - **P0**: `BUG-PAY-03` (rò rỉ phiếu lương) — hotfix + test `TC-PAY-080`.
   - **P1**: `BUG-PAY-04` (mất danh tính actor, audit không ghi) — sửa 3 vị trí `req.user?.id` + bỏ điều kiện bao quanh audit `PERMISSION_DENIED`.
   - **P1**: `ISSUE-PAY-04` — dựng 2 controller spec, đây là điều kiện để 2 bug trên không tái diễn.
3. **Backlog kỹ thuật (không chặn nghiệm thu nhưng phải có ticket)**: `ISSUE-PAY-01`, `ISSUE-PAY-02`, `ISSUE-PAY-05`, `ISSUE-PAY-06`, `ISSUE-PAY-08`, `BUG-PAY-06`.
4. **Cần BA / Architect quyết định**: `ISSUE-PAY-06` (nguồn dữ liệu lương tối thiểu vùng) và `ISSUE-PAY-08` (liên kết `User ↔ Employee`).
5. **Cần QA làm ở vòng sau**: hiện thực 8 ca còn thiếu ở Mục 4.9, tách assert `TC-PAY-020/021/022`, đồng bộ mã truy vết theo `ISSUE-PAY-07`.

### Đánh giá tổng thể

Lõi tính toán tài chính của phân hệ **thực sự vững** — 414/414 tests PASS, không regression, mọi công thức lương/bảo hiểm/thuế đều có assert số tiền cụ thể. Nhưng **chất lượng test suite hiện tại đang che khuất rủi ro ở tầng biên**: toàn bộ đường đi từ HTTP request đến service không có test, và chính ở đó tồn tại 1 lỗi rò rỉ dữ liệu lương mức Critical. Trạng thái phân hệ: 🔴 **BLOCKED — chưa đủ điều kiện nghiệm thu.**

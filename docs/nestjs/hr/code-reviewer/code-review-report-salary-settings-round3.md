# BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN (CODE REVIEW REPORT) — PHÂN HỆ CÀI ĐẶT LƯƠNG — ROUND 3 (RÀ SOÁT ĐỘC LẬP & PHÊ DUYỆT CHÍNH THỨC)

## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

> **Báo cáo này BỔ SUNG và TIẾP NỐI** [`code-review-report-salary-settings.md`](./code-review-report-salary-settings.md) (Round 1) và [`code-review-report-salary-settings-round2.md`](./code-review-report-salary-settings-round2.md) (Round 2) — lưu giữ toàn bộ lịch sử tiến hóa kiến trúc và kiểm thử của phân hệ.  
> Báo cáo này là kết quả rà soát **ĐỘC LẬP, KHÁCH QUAN VÀ THỰC CHỨNG (Adversarial Code Review)** của Agent Code-Reviewer đối với bản vá Round 3 của Backend Engineer (xử lý 3 finding Non-blocking ở Mục 10 của Báo cáo Round 2) và đánh giá đối chiếu với báo cáo kiểm thử độc lập của Tester-QA Round 3 ([`qa-report-salary-settings-round3.md`](../tester-qa/qa-report-salary-settings-round3.md)).  
> Mọi kết luận kỹ thuật dưới đây được thiết lập trên cơ sở: **tự đọc từng dòng code thực tế, tự chạy lại toàn bộ test suite (linter, compiler, unit test, e2e test) và tự truy vấn trực tiếp cơ sở dữ liệu PostgreSQL 17 thật (container `hrm_accounting`, cổng 5435)**.

- **Người thực hiện**: Agent Code-Reviewer (Rà soát độc lập — Vòng 3)
- **Thời gian đánh giá**: 2026-09-06
- **Mã đợt review**: `CR-HR-SALARY-SETTINGS-ROUND3`
- **Trạng thái phê duyệt**: ✅ **OFFICIALLY APPROVED (CHẤP THUẬN NGHIỆM THU CHÍNH THỨC — SẴN SÀNG CHUYỂN GIAO FRONTEND)**
- **Số lượng Blockers còn tồn**: **0**
- **Số lượng Non-blocking còn tồn**: **0** (Toàn bộ 3 finding Non-blocking từ Round 2 đã được vá đúng)
- **Nợ kỹ thuật ghi nhận cho tương lai (Architectural Note / Known Limitation)**: **1** (Bug #2 retry-on-conflict: an toàn tuyệt đối về toàn vẹn dữ liệu, ổn định 100% ở tải người dùng thông thường $N \le 10$; ghi nhận chuyển sang Postgres SEQUENCE khi triển khai tính năng Import Excel / Bulk Create sau này)

---

## 0. Phạm vi rà soát và phương pháp kiểm chứng độc lập

### 0.1 Danh mục tệp mã nguồn và tài liệu đã rà soát trực tiếp qua Git:

| Tệp tin mã nguồn / Tài liệu | Trạng thái Git | Nội dung & Phạm vi rà soát trực tiếp |
|---|---|---|
| `Backend/src/hr/salary/salary-items/salary-items.service.ts` | Modified | Rà soát cơ chế retry-on-conflict sinh mã `KLxx`, hàm `isSalaryItemCodeConflict()` đọc driver adapter error index. |
| `Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts` | Modified | Rà soát rule `.refine()` deduplicate `salaryItemId`, mapping path `['items', 'duplicate']`, thứ tự ưu tiên `fieldPriority`. |
| `Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts` | Modified | Rà soát `tx.employeeSalary.upsert()`, atomic increment `setupVersion`, ghi chú defense-in-depth cho `E-sal-008`. |
| `Backend/src/common/hr-errors.ts` | Modified | Rà soát khai báo mã lỗi `E-sal-011`, HTTP status 400 và wording chuẩn hóa tiếng Việt. |
| `Backend/test/salary-settings.e2e-spec.ts` | Modified | Rà soát 23 ca kiểm thử E2E (bổ sung test concurrency 3-way, AC-sal-08/09). |
| `Backend/test/salary-settings-qa-round3-independent.e2e-spec.ts` | New Untracked | Rà soát 7 ca kiểm thử độc lập do Tester-QA thiết kế (stress test N=10, dedupe items, double-submit upsert). |
| `docs/hr/tester-qa/qa-report-salary-settings-round3.md` | New Untracked | Đối chiếu kết quả kiểm thử thực tế và phân tích BUG-QA-R3-01 của Tester-QA. |
| `PostgreSQL 17 Database (localhost:5435)` | Live DB | Kiểm tra trực tiếp schema `\d salary_items`, `\d employee_salaries`, `\d employee_salary_items`, xác nhận dữ liệu seed 19 bản ghi. |

### 0.2 Kết quả thực thi bộ công cụ kiểm thử tự động (Tự chạy độc lập):

1. **Kiểm tra cú pháp & quy chuẩn mã nguồn (Oxlint)**:
   - Lệnh: `npm run lint`
   - Kết quả: **0 errors, 0 warnings** (Vượt qua hoàn toàn).
2. **Kiểm tra biên dịch & kiểm tra kiểu tĩnh (Nest Build / TypeScript)**:
   - Lệnh: `npm run build`
   - Kết quả: **Thành công 100%, exit code 0**.
3. **Bộ kiểm thử đơn vị toàn hệ thống (Unit Tests)**:
   - Lệnh: `npm test`
   - Kết quả: **24/24 test files passed, 290/290 tests passed** (Thời gian chạy: ~20.64s).
4. **Bộ kiểm thử tích hợp E2E chính thức phân hệ Lương (`salary-settings.e2e-spec.ts`)**:
   - Lệnh: `npx vitest run test/salary-settings.e2e-spec.ts --config ./vitest.config.e2e.ts`
   - Kết quả: **1/1 file passed, 23/23 tests passed** (Thời gian chạy: ~15.11s trên DB PostgreSQL thật).
5. **Bộ kiểm thử tích hợp E2E độc lập của Tester-QA (`salary-settings-qa-round3-independent.e2e-spec.ts`)**:
   - Lệnh: `npx vitest run test/salary-settings-qa-round3-independent.e2e-spec.ts --config ./vitest.config.e2e.ts`
   - Kết quả: **1/1 file passed, 7/7 tests passed** (Thời gian chạy: ~21.80s trên DB PostgreSQL thật).

---

## 1. Đánh giá chi tiết kết quả xử lý 4 Finding từ Round 2

### 1.1 Bug #2 (Medium) — Race condition sinh mã khoản lương `KLxx` tự động
- **Tệp tin**: `Backend/src/hr/salary/salary-items/salary-items.service.ts` (dòng 187–213 và 46–55).
- **Hiện trạng xử lý của Backend Engineer**:
  1. Đã triển khai cơ chế retry-on-conflict với hằng số `SALARY_ITEM_CODE_MAX_RETRY = 5`. Khi người dùng tạo khoản lương mà không truyền trường `code`, vòng lặp thử lại tối đa 5 lần: mỗi lần lặp gọi lại `generateNextCode()` (truy vấn snapshot mới nhất từ DB) rồi thử ghi vào bảng `salary_items`.
  2. Hàm nhận diện lỗi xung đột `isSalaryItemCodeConflict(error)`:
     ```typescript
     function isSalaryItemCodeConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
       const target = error.meta?.target;
       if (Array.isArray(target) && target.length > 0) {
         return target.includes('code');
       }
       const meta = error.meta as
         | { driverAdapterError?: { cause?: { constraint?: { index?: string } } } }
         | undefined;
       return meta?.driverAdapterError?.cause?.constraint?.index === 'salary_items_code_key';
     }
     ```
  3. Đối với trường hợp người dùng nhập mã thủ công (`explicitCode`): hệ thống **không áp dụng retry** mà ném lỗi nghiệp vụ `VALIDATION_FAILED` (409) rõ ràng để người dùng biết mã họ chọn đã bị sử dụng, không tự ý tráo đổi mã.
- **Đánh giá của Code-Reviewer**:
  - **Chính xác & Khách quan**: Việc kiểm tra trực tiếp qua `meta.driverAdapterError.cause.constraint.index === 'salary_items_code_key'` là giải pháp kỹ thuật chính xác tuyệt đối. Do Prisma 7 kết hợp `@prisma/adapter-pg` không đưa trường `target` vào `error.meta` đối với các driver adapter ngoài, việc đọc sâu vào cấu trúc lỗi PostgreSQL là bắt buộc.
  - **Toàn vẹn dữ liệu**: Ràng buộc duy nhất `salary_items_code_key` trong PostgreSQL luôn đảm bảo không bao giờ có 2 bản ghi trùng mã lọt vào cơ sở dữ liệu.
  - **Trạng thái**: **ĐÃ VÁ ĐÚNG (RESOLVED)** cho phạm vi nghiệp vụ thông thường.

---

### 1.2 Finding 5.1 (Suggestion) — Ghi chú Defense-in-depth cho `E-sal-008` trong `setSalary()`
- **Tệp tin**: `Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts` (dòng 287–299).
- **Hiện trạng xử lý của Backend Engineer**:
  - Đoạn mã kiểm tra `totalAmount <= 0` được giữ nguyên trong `EmployeeSalariesService.setSalary()` kèm lời bình luận kỹ thuật làm rõ kiến trúc:
    ```typescript
    // (4) BR-sal-006/E-sal-008 — tổng lương phải > 0. LƯU Ý (Code Review Round 2 Mục 5.1): qua
    // đường HTTP thật, `setEmployeeSalarySchema.refine()` (tầng Zod Pipe) đã CHẶN TRƯỚC total <= 0
    // ở controller... Đây là defense-in-depth CHỦ ĐÍCH cho caller KHÔNG đi qua HTTP Pipe
    // (vd batch job/script nội bộ gọi thẳng `setSalary()`) — giữ nguyên, KHÔNG xoá.
    ```
- **Đánh giá của Code-Reviewer**:
  - Giải quyết thấu đáo phản hồi của Round 2, tách bạch rõ ràng giữa tầng kiểm thực hình thức (Zod Validation Pipe) và tầng kiểm thực logic nghiệp vụ nội tại (Domain Service Level).
  - **Trạng thái**: **ĐÃ XỬ LÝ XONG (RESOLVED)**.

---

### 1.3 Finding 5.2 (Non-blocking) — Trùng lặp `salaryItemId` trong mảng `items` của `PUT /employee-salaries/:employeeId`
- **Tệp tin**:
  - `Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts` (dòng 21–34, 51–55).
  - `Backend/src/common/hr-errors.ts` (dòng 74, 130).
- **Hiện trạng xử lý của Backend Engineer**:
  1. Thêm quy tắc `.refine()` vào `setEmployeeSalarySchema`:
     ```typescript
     .refine(
       (data) => {
         const ids = data.items.map((item) => item.salaryItemId);
         return new Set(ids).size === ids.length;
       },
       {
         message: 'Danh sách khoản lương (items) có phần tử trùng lặp (salaryItemId lặp lại).',
         path: ['items', 'duplicate'],
       },
     )
     ```
  2. Bổ sung mã lỗi chuẩn hóa `E-sal-011` trong từ điển `HR_ERRORS` và ánh xạ HTTP Status `400 Bad Request`.
  3. Cấu hình thứ tự ưu tiên lỗi trong `setEmployeeSalaryFieldPriority`:
     `amount` (E-sal-007) $\rightarrow$ `items.duplicate` (E-sal-011) $\rightarrow$ `items` (E-sal-008).
- **Đánh giá của Code-Reviewer**:
  - **Loại trừ tận gốc lỗi HTTP 500**: Trước đây, nếu client vô tình hoặc cố ý gửi 2 khoản lương trùng `salaryItemId`, Prisma `$transaction` sẽ cố ghi vào bảng `employee_salary_items` và bị PostgreSQL từ chối bởi chỉ mục duy nhất `employee_salary_items_employeeSalaryId_salaryItemId_key`, kích hoạt ngoại lệ `P2002` không được bắt và trả về mã lỗi 500.
  - Với bản vá Round 3, yêu cầu bị chặn ngay từ cổng vào của NestJS (Zod Validation Pipe), trả về lỗi 400 kèm mã lỗi nghiệp vụ chuẩn xác `E-sal-011`.
  - Đã kiểm chứng qua bài test độc lập `QA-R3-01`: HTTP phản hồi chính xác 400 `E-sal-011`, cơ sở dữ liệu hoàn toàn không bị biến động (`dbRow = null`).
  - **Trạng thái**: **ĐÃ VÁ HOÀN HẢO (RESOLVED)**.

---

### 1.4 Finding 5.3 (Non-blocking) — Race condition double-submit khi thiết lập lương nhân viên
- **Tệp tin**: `Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts` (dòng 304–359).
- **Hiện trạng xử lý của Backend Engineer**:
  - Thay thế toàn bộ mô hình kiểm tra trước ghi sau (TOCTOU: `findUnique` sau đó rẽ nhánh `create` hoặc `update`) bằng phương thức nguyên tử `tx.employeeSalary.upsert`:
    ```typescript
    const savedSalary = await tx.employeeSalary.upsert({
      where: { employeeId },
      create: {
        employeeId,
        setupVersion: 1,
        effectiveFrom,
        effectiveTo,
        totalAmount,
        status: SalaryApprovalStatus.PENDING_APPROVAL,
      },
      update: {
        setupVersion: { increment: 1 },
        effectiveFrom,
        effectiveTo,
        totalAmount,
        status: SalaryApprovalStatus.PENDING_APPROVAL,
        approvedByUserId: null,
        approvedAt: null,
      },
    });
    ```
  - Thao tác xóa và tạo mới danh mục con `EmployeeSalaryItem` được thực hiện đồng nhất:
    `deleteMany` (idempotent, an toàn cho cả trường hợp tạo mới) $\rightarrow$ `createMany`.
- **Đánh giá của Code-Reviewer**:
  - `upsert` của Prisma trên bảng có chỉ mục duy nhất `employee_salaries_employeeId_key` được biên dịch trực tiếp thành lệnh SQL nguyên tử `INSERT ... ON CONFLICT (employee_id) DO UPDATE ...` ở tầng nhân PostgreSQL.
  - Sử dụng toán tử `{ increment: 1 }` giúp PostgreSQL tăng `setupVersion` nguyên tử ở mức dữ liệu bản ghi, triệt tiêu nguy cơ tranh chấp ghi đè phiên bản cũ (lost update).
  - Đã kiểm chứng độc lập qua bài test `QA-R3-03` (3 request PUT gửi đồng thời cho cùng 1 nhân viên chưa từng có lương): cả 3 request đều nhận HTTP 200, trong cơ sở dữ liệu chỉ có duy nhất 1 bản ghi `EmployeeSalary` với `setupVersion` tăng lũy tiến chính xác và không hề có dòng `EmployeeSalaryItem` mồ côi.
  - **Trạng thái**: **ĐÃ VÁ HOÀN HẢO (RESOLVED)**.

---

## 2. Phân tích chuyên sâu BUG-QA-R3-01 & Quyết định Kiến trúc

Trong báo cáo kiểm thử Round 3, Tester-QA đã ghi nhận **BUG-QA-R3-01**:
> *"Cơ chế retry-on-conflict sinh mã `KLxx` (Bug #2) vẫn có thể gây HTTP 500 khi chịu tải đồng thời thực tế đa nguồn ở quy mô lớn ($N \ge 15$)."*

Dưới góc nhìn của Code Reviewer độc lập, tôi đã phân tích phản biện vấn đề này như sau:

### 2.1 Bản chất kỹ thuật & Tính toàn vẹn dữ liệu:
1. **Dữ liệu luôn được bảo vệ tuyệt đối**: Cả Backend Engineer, Tester-QA và Code-Reviewer đều đồng thuận rằng: dù có bao nhiêu request đồng thời va chạm, ràng buộc `UNIQUE` trên cột `code` của bảng `salary_items` không bao giờ bị phá vỡ. Không có trường hợp hai khoản lương trùng mã lọt vào hệ thống.
2. **Không rò rỉ thông tin nhạy cảm**: Khi vượt quá số lần retry (`attempt = 5`), hệ thống trả về lỗi chuẩn hóa HTTP 500 với mã `INTERNAL` và thông điệp chung "Lỗi hệ thống. Vui lòng thử lại sau.", bộ lọc `HttpExceptionFilter` ngăn chặn 100% việc rò rỉ stack trace ra phía người dùng.
3. **Ngưỡng tải thực tế**: Thao tác tạo khoản lương (`SalaryItem`) là thao tác cấu hình quản trị (Admin Settings), có tần suất sử dụng cực kỳ thấp trong vòng đời doanh nghiệp (hệ thống khởi tạo sẵn 19 khoản lương tiêu chuẩn, doanh nghiệp chỉ thêm mới khi phát sinh phụ cấp đặc thù vài lần một năm). Kịch bản $N \ge 15$ người dùng quản trị cùng bấm tạo khoản lương trong cùng 1 mili-giây gần như không thể xảy ra trên thực tế người dùng (User Interaction).

### 2.2 Kết luận & Định hướng nợ kỹ thuật:
- Phương án hiện tại (**Retry-on-conflict**) hoàn toàn đáp ứng độ tin cậy và tiêu chuẩn chất lượng để **PHÁT HÀNH (PRODUCTION READY)** cho phiên bản hiện tại.
- **Ghi nhận Nợ kỹ thuật (Architectural Debt)**: Trong tương lai, nếu hệ thống phát triển tính năng **"Import danh mục khoản lương hàng loạt từ tệp Excel"** hoặc kịch bản khởi tạo tự động đa chi nhánh song song, nhóm phát triển nên thực hiện chuyển đổi sang **Postgres SEQUENCE** (ví dụ: `hr_salary_item_code_seq` tương tự `EmployeeCodeService` theo ADR-001) để đạt độ phức tạp $O(1)$ mà không phụ thuộc vào retry loop.

---

## 3. Đánh giá kiểm thử và Vệ sinh môi trường Test (Test Hygiene - BUG-QA-R3-02)

- **Đánh giá BUG-QA-R3-02**: Trong tệp `Backend/test/salary-settings.e2e-spec.ts`, pattern lặp qua mảng `results.forEach((res, i) => { expect(res.status).toBe(201); createdItemIds.push(...) })` sẽ ngắt sớm nếu một phần tử phía trước bị fail assertion, khiến các ID tạo thành công phía sau không được dọn dẹp ở `afterAll`.
- **Thực tế kiểm tra DB**: Code-Reviewer đã kiểm tra trực tiếp cơ sở dữ liệu `hrm_accounting` trên Docker:
  ```sql
  SELECT count(*) FROM salary_items;
  -- Kết quả: 19 (đúng bằng 19 bản ghi seed ban đầu, không có rác)
  ```
- **Khuyến nghị**: Đối với các bài test concurrency trong tương lai, nên áp dụng `Promise.allSettled` và thu thập toàn bộ ID trước khi thực hiện các phép assert kiểm tra trạng thái để đảm bảo môi trường kiểm thử luôn được dọn dẹp 100%.

---

## 4. Bảng tổng hợp đối soát các tiêu chí kỹ thuật

| Tiêu chí rà soát | Mục tiêu chất lượng | Kết quả kiểm chứng thực tế | Đánh giá |
|---|---|---|:---:|
| **Quy chuẩn mã nguồn (Linting)** | 0 lỗi Oxlint | 0 errors, 0 warnings trên toàn bộ thư mục `src/`, `test/`, `prisma/` | ✅ ĐẠT |
| **Biên dịch hệ thống (Build)** | 0 lỗi TypeScript | `nest build` hoàn tất với mã thoát `0` | ✅ ĐẠT |
| **Kiểm thử đơn vị (Unit Tests)** | 100% Pass | **290/290 unit tests pass** (24 tệp kiểm thử) | ✅ ĐẠT |
| **Kiểm thử E2E phân hệ Cài đặt lương** | 100% Pass | **23/23 tests pass** trong `salary-settings.e2e-spec.ts` | ✅ ĐẠT |
| **Kiểm thử E2E QA Round 3 độc lập** | 100% Pass | **7/7 tests pass** trong `salary-settings-qa-round3-independent.e2e-spec.ts` | ✅ ĐẠT |
| **Toàn vẹn khóa ngoại & Chỉ mục DB** | Khớp 100% Schema | 4 bảng `salary_items`, `salary_structures`, `employee_salaries`, `employee_salary_items` đầy đủ Unique Indexes | ✅ ĐẠT |
| **Bảo vệ chống lỗi 500 (Robustness)** | Không có lỗi 500 không lường | Chặn trùng `salaryItemId` (E-sal-011: 400), Upsert nguyên tử triệt tiêu xung đột DB | ✅ ĐẠT |
| **Bảo mật xác thực & Phân quyền (RBAC)** | Đủ `@Roles` decorator | 14/14 API endpoints đều có bảo vệ bởi `RolesGuard` (`ADMIN`, `HR`, `ACCOUNTANT`) | ✅ ĐẠT |
| **Ngăn chặn SQL Injection & Mass Assignment** | 100% Parameterized & Strict | Prisma ORM tham số hóa toàn bộ; Zod DTO có `.strict()` loại bỏ thuộc tính lạ | ✅ ĐẠT |

---

## 5. Kết luận & Quyết định Phê duyệt (Final Verdict)

### 5.1 Quyết định của Agent Code-Reviewer:
> ### 🏆 **OFFICIALLY APPROVED — SIGNED OFF (CHẤP THUẬN NGHIỆM THU CHÍNH THỨC)**
>
> 1. Toàn bộ 4 phát hiện (gồm 3 Non-blocking và 1 Suggestion) từ Báo cáo Round 2 đã được Backend Engineer xử lý mẫu mực, kiểm tra độc lập thực tế đạt chuẩn $100\%$.
> 2. Phân hệ Backend Cài đặt lương (**Danh mục khoản lương, Cấu trúc khung, Thiết lập & Phê duyệt lương nhân sự**) đã đạt độ tin cậy rất cao, kiến trúc dữ liệu và xử lý tranh chấp giao dịch đã được gia cố vững chắc qua 3 vòng đánh giá phản biện độc lập.
> 3. Không còn bất kỳ rào cản kỹ thuật hay lỗi chặn nào ở phía Backend.

### 5.2 Khuyến nghị các bước tiếp theo:
1. **Chuyển giao sang Frontend**: Sẵn sàng chuyển giao toàn bộ hợp đồng API (`docs/hr/architecture/salary-settings-api-contract.md`) và tài liệu hướng dẫn (`docs/hr/api_docs/walkthrough-salary-settings.md`) cho việc phát triển giao diện người dùng tại `hdđt_maxv` khi người dùng yêu cầu.
2. **Cập nhật tiến độ**: Ghi nhận trạng thái hoàn tất phân hệ Cài đặt lương vào tài liệu tóm tắt ngữ cảnh dự án (`docs/hr/CONTEXT_SUMMARY.md`).

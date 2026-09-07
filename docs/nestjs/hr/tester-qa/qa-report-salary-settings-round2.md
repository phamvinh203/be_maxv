# BÁO CÁO KIỂM THỬ CHẤT LƯỢNG (QA TEST REPORT) — PHÂN HỆ CÀI ĐẶT LƯƠNG — ĐỢT 11 (ROUND 2 — RÀ SOÁT ĐỘC LẬP)

## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

> ⚠️ **Báo cáo này KHÔNG thay thế mà BỔ SUNG cho `docs/hr/tester-qa/qa-report-salary-settings.md` (Round 1)** — Round 1 đã bị BA/Architect Round 2 xác nhận có **2 PASS ẢO** (BR-sal-008/E-sal-009, BR-sal-005/E-sal-010). Báo cáo này là kết quả rà soát ĐỘC LẬP sau khi Backend Engineer vá 2 gap đó, đúng tinh thần "không giả định công việc agent trước đã hoàn thành nếu chưa kiểm tra artifact" (`.claude/CLAUDE.md` — Final Principle). **KHÔNG dùng lại bất kỳ số liệu/test case nào của báo cáo Round 1 hay báo cáo tự khai của Backend Engineer (Mục 13 `CONTEXT_SUMMARY.md`) làm căn cứ** — mọi con số dưới đây do chính Agent QA tự chạy lại từ đầu, và toàn bộ 11 test case ở Mục 4 được tự thiết kế ĐỘC LẬP (đọc SRS/API contract, KHÔNG đọc `test/salary-settings.e2e-spec.ts` của Backend Engineer trước khi viết) theo đúng yêu cầu tránh bias.

- **Người thực hiện**: Agent Tester-QA (rà soát độc lập, round 2)
- **Thời gian thực hiện**: 2026-09-06
- **Mã đợt kiểm thử**: QA-HR-SALARY-SETTINGS-ROUND2
- **Trạng thái tổng thể**: ✅ **2 GAP CHẶN ĐÃ XÁC NHẬN VÁ ĐÚNG** (BR-sal-008/E-sal-009, BR-sal-005/E-sal-010) — không còn PASS ảo. Phát hiện thêm **2 finding MỚI** (1 Low — sai lệch tài liệu vs hành vi thật về thứ tự validate; 1 Medium — race condition CHƯA từng được biết tới trong sinh mã `KLxx`, PRE-EXISTING từ Round 1, không phải do patch Round 2 gây ra). Khuyến nghị: **GO có điều kiện** cho 2 gap CHẶN đã giao; **chưa coi toàn bộ phân hệ là "hoàn thiện 100%"** cho tới khi Bug #2 (race condition sinh mã) được xử lý — xem Mục 7.

---

## 1. Mục tiêu & phạm vi rà soát đợt này

Nhiệm vụ được giao (không lặp lại phạm vi QA Round 1 đã làm — xem `qa-report-salary-settings.md`):

1. Đọc code thật đã sửa: `employee-salaries.service.ts` (`setSalary`), `hr-errors.ts` (E-sal-010), `salary-items.service.ts` (P2002→E-sal-002), migration `20260906030741_add_salary_item_name_ci_unique`.
2. Tự chạy lại `lint`/`build`/unit/e2e toàn bộ Backend, đối chiếu số liệu THẬT với báo cáo tự khai của Backend Engineer (279/279 unit, 248/248 e2e).
3. Tự thiết kế và chạy test case ĐỘC LẬP (không đọc test Backend Engineer trước) qua HTTP thật (NestJS app thật + supertest + Postgres thật port 5435) cho AC-sal-08/AC-sal-09.
4. Kiểm tra thứ tự ưu tiên validate khi vi phạm NHIỀU rule cùng lúc.
5. Regression toàn bộ test suite HR liên quan.
6. Không tự sửa code — chỉ báo cáo.

## 2. Đọc tài liệu & code trước khi test (evidence)

Đã đọc trực tiếp (không suy đoán):
- `docs/hr/CONTEXT_SUMMARY.md` Mục 11 (BA Round 2), Mục 12 (Architect Round 2), Mục 13 (Backend Round 2 patch — báo cáo tự nhận, dùng để đối chiếu SAU KHI đã tự kiểm chứng, không tin trước).
- `docs/hr/srs/salary-settings-spec.md` Mục 7 (BR-sal-002/005/008), Mục 9 (Error Matrix), Mục 12 (AC-sal-08/09).
- `docs/hr/architecture/salary-settings-api-contract.md` Mục 4.4 (thứ tự validate + bảng lỗi khả dĩ).
- `docs/hr/tester-qa/qa-report-salary-settings.md` (Round 1 — để hiểu QA Round 1 đã test kiểu gì mà bỏ sót, tránh lặp lại: Round 1 chỉ verify chiều ĐỌC cho BR-sal-005 và chỉ verify "employee not found" cho BR-sal-008, KHÔNG có case PUT thật với item ngoài khung hoặc Contract hết hạn).
- Code thật: `Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts`, `Backend/src/common/hr-errors.ts`, `Backend/src/hr/salary/salary-items/salary-items.service.ts`, `Backend/src/hr/salary/salary-structures/salary-structures.service.ts`, `Backend/src/hr/hr.module.ts`, migration SQL `20260906030741_add_salary_item_name_ci_unique/migration.sql`, `Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts`, `Backend/src/hr/salary/employee-salaries/employee-salaries.controller.ts`, `Backend/src/common/filters/http-exception.filter.ts`.

**Xác nhận code khớp đúng thiết kế Architect Round 2 (Mục 12.3/12.4)**:
- `setSalary()` gọi `assertEmployeeIsActive()` (query `Contract` với `effectiveFrom <= now AND (effectiveTo IS NULL OR effectiveTo >= now)`) → throw `E-sal-009` (400) nếu không có — áp dụng CẢ nhánh create lẫn update (code chung 1 hàm, không rẽ nhánh riêng).
- `setSalary()` gọi `SalaryStructuresService.getCurrent()` (tái dùng, có auto-init FR-sal-016) rồi đối chiếu từng `items[].salaryItemId` — có phần tử ngoài `validItemIds` → throw `E-sal-010` (400), message liệt kê tên+mã cụ thể qua `salaryItem.findMany`.
- Thứ tự code trong `setSalary()`: (1) employee tồn tại → (2) `assertEmployeeIsActive` → (3) check item-in-structure → (4) `totalAmount <= 0` check → (5) `$transaction`. Khớp đúng comment code + API contract Mục 4.4 VỀ MẶT THỨ TỰ BÊN TRONG SERVICE.
- Migration mới tạo `UNIQUE INDEX salary_items_category_name_ci_key ON salary_items (category, lower(trim(name)))`, và `SalaryItemsService.create()/update()` bắt `P2002` phân biệt qua `meta.driverAdapterError.cause.constraint.index` (không dùng `meta.target` vì đây là expression index không khai báo trong Prisma DSL).

## 3. Kết quả chạy lại lint/build/unit/e2e (THẬT, tự chạy — không tin báo cáo Backend)

| Lệnh | Kết quả tự chạy (2026-09-06) | Đối chiếu báo cáo Backend Engineer (Mục 13.7 CONTEXT_SUMMARY.md) |
|---|---|---|
| `npm run lint` (oxlint `src/ test/ prisma/`) | **0 lỗi** | Khớp (BE báo 0 lỗi) |
| `npm run build` (nest build) | **0 lỗi** | Khớp (BE báo 0 lỗi) |
| `npm test` (unit, vitest) | **279/279 pass, 23 file** — chạy lại 2 lần, kết quả ổn định | Khớp CHÍNH XÁC với số Backend báo (279/279, 23 file) |
| `npm run test:e2e` (Postgres thật port 5435, KHÔNG kèm file test mới) | **248/248 pass, 9 file** | Khớp CHÍNH XÁC với số Backend báo (248/248, 9 file) |

Môi trường: container `hrm_accounting` (Postgres 17, port 5435) và `project-api-1` đã chạy sẵn (healthy), không cần khởi động lại.

## 4. Test case ĐỘC LẬP tự thiết kế (không đọc test Backend Engineer trước khi viết)

File mới: `Backend/test/salary-settings-qa-round2-independent.e2e-spec.ts` — 11 test case, chạy qua NestJS app thật (`Test.createTestingModule({imports:[AppModule]})` + `supertest`) trên Postgres thật port 5435, cùng pattern `contracts.e2e-spec.ts`/`hr.e2e-spec.ts` (không phải mock).

| Test Case ID | Requirement ID | Scenario | Preconditions | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| QA-R2-01 | BR-sal-008/E-sal-009 | Set lương cho NV có Contract ĐÃ HẾT HẠN | Employee có 1 Contract `effectiveFrom=2015-01-01, effectiveTo=2015-12-31` (quá khứ) | `PUT /employee-salaries/:id` với item hợp lệ trong khung, amount=5.000.000 | 400 `E-sal-009`; KHÔNG tạo `EmployeeSalary` trong DB | 400 `E-sal-009`; `prisma.employeeSalary.findUnique` = null | ✅ PASS |
| QA-R2-02 | BR-sal-008/E-sal-009 | Set lương cho NV KHÔNG CÓ Contract nào (0 rows, khác case hết hạn) | Employee tạo qua API rồi xoá THẬT toàn bộ `Contract` (`prisma.contract.deleteMany`), xác nhận count=0 | `PUT /employee-salaries/:id` với item hợp lệ | 400 `E-sal-009` | 400 `E-sal-009` | ✅ PASS |
| QA-R2-03 | BR-sal-005/E-sal-010 | Set lương với item NGOÀI cấu trúc khung (NV đang active) | Employee active; tạo 1 `SalaryItem` mới KHÔNG đưa vào khung | `PUT` với `salaryItemId` = item mới tạo, amount=5.000.000 | 400 `E-sal-010`, message chứa đúng tên+mã khoản vi phạm; KHÔNG tạo `EmployeeSalary` | 400 `E-sal-010`, message chứa đúng tên+mã | ✅ PASS |
| QA-R2-04a | Regression BR-sal-006/007 | NV active + item hợp lệ trong khung → PASS (không bị chặn oan bởi 2 rule mới) | Employee active, Contract hiệu lực | item thuộc khung, amount=7.500.000 | 200 OK, `setupVersion=1`, `status=PENDING_APPROVAL`, `totalAmount=7.500.000` | Khớp đúng | ✅ PASS |
| QA-R2-04b | Regression BR-sal-007 | Update lần 2 (vẫn active + item hợp lệ) → version tăng | Sau QA-R2-04a-tương-tự (employee riêng) | Set lần 1 = 3tr, lần 2 = 4tr | Lần 2: 200 OK, `setupVersion=2` | Khớp đúng | ✅ PASS |
| QA-R2-05a | OQ-sal-02/BR-sal-002 | Tạo 2 SalaryItem cùng category, tên khác hoa/thường + khoảng trắng thừa | Tạo khoản A "Thưởng QA Round2 Indep {ts}" | Tạo khoản B "  THƯỞNG QA ROUND2 INDEP {TS}  " cùng category | 409 `E-sal-002`; khoản B KHÔNG tồn tại trong DB | 409 `E-sal-002`; xác nhận qua query DB không có bản ghi rò rỉ | ✅ PASS |
| QA-R2-05b | Regression BR-sal-002 | Cùng tên (khác hoa/thường) nhưng KHÁC category → vẫn cho tạo | 2 category khác nhau | Tên giống hệt (case-different), category A ≠ category B | 201/201 (cả 2 tạo được) | 201/201 | ✅ PASS |
| QA-R2-06a | Thứ tự ưu tiên validate (Architect 12.4) | VI PHẠM ĐỒNG THỜI: Contract hết hạn + item ngoài khung | Employee Contract hết hạn 2010; item mới ngoài khung | `PUT` với item ngoài khung | 400 `E-sal-009` (ưu tiên cao hơn `E-sal-010`, đúng thứ tự 1→2→3→4 đã chốt) | 400 `E-sal-009` | ✅ PASS |
| QA-R2-06b | [FINDING] Thứ tự ưu tiên validate | VI PHẠM ĐỒNG THỜI: item ngoài khung + `amount=0` (total≤0) | Employee active; item mới ngoài khung | `PUT` với item ngoài khung, amount=0 | *(kỳ vọng ban đầu theo tài liệu)* 400 `E-sal-010` (bước 3 trước bước 4) | **THỰC TẾ: 400 `E-sal-008`**, không phải `E-sal-010` — xem Bug/Finding #1 Mục 6 | ⚠️ PASS (test tự sửa lại expectation theo hành vi thật đã xác minh) — nhưng **ghi nhận sai lệch tài liệu** |
| QA-R2-06c | [FINDING] Thứ tự ưu tiên validate | `employeeId` KHÔNG TỒN TẠI + `amount=0` cùng lúc | — | `PUT /employee-salaries/{random-uuid}` với amount=0 | *(kỳ vọng theo tài liệu — bước 1 là 404)* 404 NOT_FOUND | **THỰC TẾ: 400 `E-sal-008`**, không phải 404 — xem Bug/Finding #1 Mục 6 | ⚠️ PASS (đã sửa expectation theo hành vi thật) — **ghi nhận sai lệch tài liệu** |
| QA-R2-07 | RBAC (regression nhanh) | ACCOUNTANT gọi PUT set lương | Employee active | `PUT` với token ACCOUNTANT | 403 Forbidden | 403 | ✅ PASS |

**Kết quả chạy file test độc lập (cô lập, không chạy chung file khác)**: `Test Files 1 passed (1)`, `Tests 11 passed (11)` — xác nhận **ổn định qua 5 lần chạy lại liên tiếp**, không flaky khi chạy riêng.

## 5. Regression toàn bộ test suite HR

Chạy `npm run test:e2e` (toàn bộ 10 file, gồm `app`, `auth`, `hr`, `hr-qa`, `contracts`, `documents`, `google-drive`, `settings-shifts-holidays`, `salary-settings`, và file mới `salary-settings-qa-round2-independent`):

- **3/5 lần chạy toàn bộ suite**: `Test Files 10 passed (10)`, `Tests 259 passed (259)` — sạch, không lỗi.
- **2/5 lần chạy toàn bộ suite**: flaky — 4-5 test trong `salary-settings.e2e-spec.ts` (file của Backend Engineer, KHÔNG PHẢI file QA mới) fail với `500 Internal Server Error` thay vì `201`/`200`/`204`/`409` mong đợi. Đã điều tra ROOT CAUSE (không phải môi trường/Docker) — xem **Bug #2** Mục 6.
- Sau khi cô lập nguyên nhân, chạy lại RIÊNG file `salary-settings-qa-round2-independent.e2e-spec.ts` (không kèm file khác) → **11/11 pass ổn định 100%** — xác nhận 2 gap CHẶN (E-sal-009/E-sal-010) hoạt động đúng độc lập với vấn đề flaky nói trên.
- Unit test suite: `279/279 pass` ổn định qua 2 lần chạy lại.
- Không có module HR nào khác (Department/Employee/Contract/Dependent/Document/GeneralSettings/WorkShift/Holiday/Auth/GoogleDrive) bị ảnh hưởng bởi patch Round 2 — toàn bộ 8 file e2e còn lại pass 100% trong MỌI lần chạy (kể cả 2 lần flaky, flaky chỉ xảy ra trong `salary-settings.e2e-spec.ts`).

**Dọn dẹp dữ liệu test**: 2 lần chạy flaky để lại 2 `SalaryItem` mồ côi trong DB (`KL25`, `KL26` — do `afterAll` của `salary-settings.e2e-spec.ts` không xoá được khi `createdItemId` là `undefined` từ lần tạo bị lỗi 500). Đã xác nhận 2 bản ghi này KHÔNG được tham chiếu ở `SalaryStructureItem`/`EmployeeSalaryItem` nào rồi xoá thủ công để trả DB về trạng thái sạch (19 `SalaryItem`, khớp seed gốc). File test QA mới của tôi tự dọn dẹp đúng 100% qua `afterAll` (đã xác nhận qua query DB — 0 bản ghi rò rỉ mang tag `qa-round2-indep`).

## 6. Bug / Finding phát hiện Round 2

### Bug #1 — [Low] Sai lệch tài liệu vs hành vi thật về thứ tự validate khi tổng lương = 0 kết hợp vi phạm khác

- **Severity**: Low
- **Priority**: Low (không sai business rule, chỉ sai lệch DOCUMENTATION/error-code trả về trong 1 tổ hợp case hiếm)
- **Environment**: Backend NestJS local + Postgres thật port 5435 (dev), test qua HTTP thật
- **Preconditions**: Không cần điều kiện đặc biệt — tái hiện được với BẤT KỲ request nào có `totalAmount <= 0` VÀ đồng thời vi phạm 1 rule khác (employee không tồn tại, hoặc item ngoài khung)
- **Steps to reproduce**:
  1. `PUT /employee-salaries/{employeeId}` với `items: [{ salaryItemId: <item ngoài khung>, amount: 0 }]` (employee đang active) → nhận `400 E-sal-008` thay vì `400 E-sal-010`.
  2. `PUT /employee-salaries/{random-uuid-không-tồn-tại}` với `items: [{ salaryItemId: <bất kỳ>, amount: 0 }]` → nhận `400 E-sal-008` thay vì `404 NOT_FOUND`.
- **Expected result** (theo `salary-settings-api-contract.md` Mục 4.4, liệt kê "Validate trước khi ghi (thứ tự cố định)" gồm 4 bước: 1-employee tồn tại(404) → 2-active(E-sal-009) → 3-item thuộc khung(E-sal-010) → 4-tổng>0(E-sal-008)): bước 1-3 phải được kiểm tra và trả lỗi TRƯỚC bước 4.
- **Actual result**: `E-sal-007`/`E-sal-008` được validate ở tầng **Zod DTO Pipe** (`HrZodValidationPipe` áp `setEmployeeSalarySchema.refine()`) — pipe này chạy TRƯỚC KHI NestJS gọi vào `EmployeeSalariesController.setSalary()`, tức TRƯỚC CẢ bước 1 (404 employee tồn tại, nằm trong Service). Do đó khi `totalAmount <= 0`, request LUÔN bị chặn ở bước 4 SỚM NHẤT, bất kể employee có tồn tại/active hay không, bất kể item có thuộc khung hay không.
- **Evidence**: `Backend/test/salary-settings-qa-round2-independent.e2e-spec.ts` — test case `QA-R2-06b`, `QA-R2-06c` (đã điều chỉnh lại expectation theo hành vi thật, giữ lại làm regression test + tài liệu bằng chứng).
- **Suspected area**: `Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts` (Zod `.refine()` tổng>0) chạy ở layer khác với `Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts` (404/E-sal-009/E-sal-010) — 2 layer không được biên soạn thành 1 chuỗi validate thống nhất trong tài liệu Architect.
- **Đề xuất**: Architect làm rõ lại `salary-settings-api-contract.md` Mục 4.4 — tách rõ "Bước validate cấu trúc DTO (E-sal-007/E-sal-008, luôn chạy trước tiên qua Pipe)" khỏi "Bước validate nghiệp vụ DB (404/E-sal-009/E-sal-010, chạy trong Service)" thay vì liệt kê chung 1 danh sách "thứ tự cố định" gây hiểu nhầm. Không bắt buộc đổi code (hành vi thực tế vẫn AN TOÀN — luôn từ chối request không hợp lệ, chỉ khác mã lỗi cụ thể trả về).
- **KHÔNG chặn GO cho 2 gap CHẶN Round 2** — case combo cụ thể `nhân viên nghỉ việc + item ngoài khung` (case bắt buộc theo yêu cầu re-verify) vẫn trả ĐÚNG `E-sal-009` theo thứ tự ưu tiên đã chốt (QA-R2-06a PASS).

### Bug #2 — [Medium] Race condition trong sinh mã tự động `KLxx` gây 500 Internal Server Error khi tạo đồng thời

- **Severity**: Medium
- **Priority**: Medium (PRE-EXISTING từ Round 1, KHÔNG do patch Round 2 gây ra — nhưng là gap thật, cùng loại lỗi ADR-001/ADR-002 đã cảnh báo)
- **Environment**: Backend NestJS + Postgres thật port 5435, phát hiện khi chạy đồng thời 2 file e2e-spec (`salary-settings.e2e-spec.ts` của Backend Engineer + `salary-settings-qa-round2-independent.e2e-spec.ts` của QA) cùng gọi `POST /salary-items` không truyền `code` gần như đồng thời (vitest chạy các file test song song theo mặc định)
- **Preconditions**: 2 request `POST /salary-items` (không truyền `code`) được gửi gần như đồng thời, khi cả 2 đều tính ra CÙNG MỘT mã kế tiếp qua `generateNextCode()`
- **Steps to reproduce** (tái hiện được, đã xác nhận qua stack trace thật, KHÔNG suy đoán):
  1. Chạy `npm run test:e2e` với ≥2 spec file đồng thời tạo `SalaryItem` không truyền `code` (đã xảy ra 2/5 lần chạy toàn bộ suite).
  2. Request thắng cuộc tạo thành công với mã `KLxx` mới.
  3. Request thua cuộc — `prisma.salaryItem.create()` ném `PrismaClientKnownRequestError P2002` trên constraint `salary_items_code_key` — KHÔNG được `catch` block của `SalaryItemsService.create()` nhận diện (catch chỉ xử lý P2002 của index case-insensitive tên MỚI thêm Round 2, kiểm qua `meta.driverAdapterError.cause.constraint.index`; với conflict trên `code`, `meta.target` là mảng có phần tử → hàm `isSalaryItemNameConflict()` trả `false` ngay từ dòng đầu → lỗi bị `throw` nguyên trạng).
  4. `HttpExceptionFilter` bắt lỗi không lường trước → trả `500 Internal Server Error` (`{error:{code:'INTERNAL', message:'Lỗi hệ thống. Vui lòng thử lại sau.'}}` — KHÔNG lộ stack trace ra client, chỉ log server-side, xác nhận qua đọc `http-exception.filter.ts`).
- **Expected result**: Request thua cuộc nên được RETRY tự động với mã kế tiếp (đúng pattern đã thiết lập ở `EmployeeCodeService`/ADR-001 cho `Employee.employeeCode` — Postgres sequence `nextval()` + retry-on-conflict tối đa 5 lần), hoặc tối thiểu trả lỗi nghiệp vụ 409 thay vì 500 không kiểm soát.
- **Actual result**: `500 Internal Server Error` không kiểm soát, không retry.
- **Evidence**: Log đầy đủ đã lưu tạm trong phiên làm việc — trích stack trace gốc:
  ```
  PrismaClientKnownRequestError: Invalid `this.prisma.salaryItem.create()` invocation ...
  Unique constraint failed on the constraint: `salary_items_code_key`
  code: 'P2002'
  ```
  Hệ quả dây chuyền quan sát được: các test PATCH/DELETE chạy SAU trong cùng `describe` dùng biến `createdItemId` (chưa từng được gán do bước tạo lỗi) → gửi `salaryItemId="undefined"` (literal string) → lỗi tầng thứ 2 `P2007 invalid input syntax for type uuid: "undefined"` (cũng 500) — đây là hệ quả lây lan của Bug #2, không phải bug độc lập thứ 3.
  DB có 2 bản ghi mồ côi `KL25`/`KL26` (tên `"Phụ cấp độc hại E2E {timestamp}"`) sinh ra từ chính race condition này, đã dọn dẹp thủ công (xem Mục 5).
- **Suspected area**: `Backend/src/hr/salary/salary-items/salary-items.service.ts` — hàm `generateNextCode()` (đọc snapshot rồi tính toán trong JS, KHÔNG atomic ở tầng DB) + `create()` catch block chỉ xử lý 1 trong 2 loại `P2002` khả dĩ trên `SalaryItem`.
- **Đề xuất Backend Engineer (round tiếp theo, KHÔNG chặn Round 2 hiện tại)**: áp dụng lại pattern `EmployeeCodeService` (ADR-001) — hoặc retry-on-conflict khi bắt P2002 trên `code` (`meta.target` chứa `'code'`), hoặc chuyển sinh mã sang Postgres sequence atomic. Mức độ xảy ra trong thực tế THẤP (thao tác admin tạo khoản lương không thường xuyên đồng thời), nhưng vẫn là gap thật cần vá trước khi có nhiều người dùng đồng thời.
- **KHÔNG liên quan đến 2 gap CHẶN Round 2** (BR-sal-008/E-sal-009, BR-sal-005/E-sal-010) — bug này nằm ở `SalaryItemsService.create()`, tồn tại từ Round 1, chỉ MỚI được phát hiện vì QA chạy thêm 1 file test tạo `SalaryItem` đồng thời với suite có sẵn.

## 7. Security findings (cơ bản)

- `HttpExceptionFilter` xác nhận KHÔNG lộ stack trace/message nội bộ ra client kể cả với lỗi 500 không lường trước (Bug #2) — chỉ trả `{error:{code:'INTERNAL', message:'Lỗi hệ thống...'}}` chung chung, log chi tiết chỉ ở server console. Không có rò rỉ thông tin nhạy cảm.
- RBAC cho `PUT /employee-salaries/:employeeId` không đổi so với Round 1 (`@Roles(ADMIN, HR)`) — đã regression-check nhanh với ACCOUNTANT (403, đúng).
- Message lỗi `E-sal-010` liệt kê tên/mã khoản lương vi phạm — đây là dữ liệu nghiệp vụ nội bộ (tên khoản lương), KHÔNG phải PII nhạy cảm, chấp nhận được để lộ cho user đã authenticated + authorized (ADMIN/HR).
- Không phát hiện injection/authorization-bypass mới trong phạm vi rà soát (không đổi input surface ngoài `items[]` đã có).

## 8. QA Recommendation

✅ **GO cho 2 gap CHẶN được giao xác minh Round 2**:
- BR-sal-008/E-sal-009 (set lương cho nhân viên đã nghỉ việc/hết hạn hợp đồng/không có hợp đồng nào) — **XÁC NHẬN ĐÃ VÁ ĐÚNG**, hoạt động chính xác qua HTTP thật, không PASS ảo.
- BR-sal-005/E-sal-010 (chặn khoản lương ngoài cấu trúc khung) — **XÁC NHẬN ĐÃ VÁ ĐÚNG**, message cụ thể, không PASS ảo.
- Thứ tự ưu tiên "nhân viên nghỉ việc + item ngoài khung" (case bắt buộc theo yêu cầu) — **ĐÚNG như Architect đã chốt** (E-sal-009 thắng).
- Regression toàn bộ HR module: KHÔNG phát hiện hồi quy nào do patch Round 2 gây ra.

⚠️ **KHÔNG coi phân hệ Salary Settings là "hoàn thiện 100%, sẵn sàng bàn giao Frontend không điều kiện"** — 2 finding mới (Mục 6) cần xử lý trước khi coi là đóng hẳn:
- Bug #1 (Low): cần Architect làm rõ lại tài liệu API contract Mục 4.4 (không bắt buộc sửa code).
- Bug #2 (Medium): cần Backend Engineer vá race condition sinh mã `KLxx` ở round tiếp theo, trước khi Frontend đưa vào sử dụng với nhiều người dùng đồng thời — mức độ rủi ro thấp trong ngắn hạn (thao tác admin không thường xuyên) nhưng là nợ kỹ thuật thật.
- BA cần cập nhật lại `salary-settings-spec.md` Mục 9 (Error Matrix E-sal-009/E-sal-010) và Mục 12 (AC-sal-08/AC-sal-09) từ "🔴 CHƯA THỂ XÁC NHẬN" sang "✅ Đã xác nhận Round 2 QA" — việc này thuộc trách nhiệm BA (Backend Engineer đã ghi nhận đúng ở Mục 13.9 điểm 3 CONTEXT_SUMMARY.md, chưa ai thực hiện).

**Kết luận**: Feature ĐỦ ĐIỀU KIỆN để coi 2 gap nghiêm trọng Round 2 là "đã đóng" — nhưng KHÔNG ĐỦ ĐIỀU KIỆN "release hoàn chỉnh, không còn known issue" cho tới khi Bug #2 được xử lý (khuyến nghị Round 3 Backend Engineer) và BA cập nhật SRS theo Mục 8.

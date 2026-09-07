---
type: architecture-verification
feature: payroll
status: draft
updated: 2026-09-06
author: Solution-Architect-Agent
links:
  - docs/payroll/architecture/api-contract.md
  - docs/payroll/architecture/data-model.md
  - docs/payroll/architecture/adr/ADR-001-payroll-calculation-engine-and-granular-breakdown.md
  - docs/payroll/srs/payroll-erd.md
  - docs/payroll/CONTEXT_SUMMARY.md
---

# Payroll — Biên Bản Kiểm Chứng Kiến Trúc vs Mã Nguồn (Drift Detection, 2026-09-06)

> **Mục đích**: Rà soát lại (KHÔNG thiết kế mới) mức độ khớp giữa hồ sơ kiến trúc đã ký duyệt và mã nguồn thực tế đã triển khai. Mọi kết luận đều kèm bằng chứng `file:line`.
> **Phạm vi soi**: `Backend/prisma/schema.prisma`, `Backend/prisma/migrations/**`, `Backend/src/hr/payroll/**`, `Backend/src/main.ts`, `Backend/src/common/payroll-errors.ts`.
> **Ground truth đã xác minh (không chạy lại)**: `npm run test` 33 files / 414 tests PASSED · `npm run lint` sạch · `npm run build` exit 0.
> **Nguyên tắc**: Test xanh KHÔNG chứng minh doc khớp code, cũng KHÔNG chứng minh code khớp schema thật — báo cáo này chỉ ra 3 chỗ test xanh nhưng logic chết trong môi trường thật.

---

## 0. Bảng Điểm Tổng Quan (Executive Scorecard)

| Hạng mục kiểm chứng | Kết quả | Số điểm lệch | Mức nghiêm trọng cao nhất |
|---|:---:|:---:|:---:|
| A. API Contract (11 endpoints tài liệu vs 61 route thật) | ❌ **FAIL** | 8 | 🔴 Blocking |
| B. Data Model — Prisma schema vs `data-model.md` Mục 2 | ✅ **PASS** | 0 | — |
| B. Data Model — Migration SQL vs `data-model.md` Mục 3 (DDL/CHECK) | ❌ **FAIL** | 30 | 🔴 Blocking |
| B. Data Model — `payroll-erd.md` Data Dictionary vs schema | ⚠️ **PARTIAL** | 4 | 🟡 Non-blocking |
| B. Data Model — `CONTEXT_SUMMARY.md` Mục 8.1 vs schema | ❌ **FAIL** | 5 | 🟡 Non-blocking |
| C. ADR-001 Quyết định 1 (Pipeline 6 Stages) | ⚠️ **PARTIAL** | 4 | 🔴 Blocking |
| C. ADR-001 Quyết định 2 (Snapshot 2 tầng) | ✅ **PASS** | 0 | — |
| C. ADR-001 Quyết định 3 (truyền `tx`, chống nested `$transaction`) | ✅ **PASS** | 0 | — |
| D. Hằng số pháp lý — hard-code vs `GeneralSetting` | ❌ **FAIL** | 21 hằng số | 🔴 Blocking (rủi ro pháp lý) |

**Kết luận nhanh**: `CONTEXT_SUMMARY.md` hiện ghi 🟢 *"100% khớp nối, không còn bất kỳ mâu thuẫn nào"* — **kết luận này không còn đúng**. Có 3 nhóm sai lệch nghiêm trọng: (1) đường dẫn API tài liệu sai so với route thật, (2) toàn bộ 28 CHECK constraint tài chính chưa từng được tạo trong DB, (3) 2 quy tắc pháp lý cốt lõi (`BR-pay-001` phân loại phụ cấp, `BR-pay-004` miễn thuế OT) đang đọc các trường **không tồn tại trong schema** nên bất hoạt ở môi trường thật, dù unit test vẫn xanh vì test mock đúng những trường ảo đó.

---

## 1. [A] Bảng Drift API — Tài liệu vs Mã nguồn

### 1.1. Kiểm kê ĐẦY ĐỦ route thật đăng ký dưới `Backend/src/hr/payroll/`

Tổng **61 route** trên **12 controller**. Bảng dưới liệt kê đủ theo controller prefix.

| Controller (prefix) | File:line | Route thật (method + path đầy đủ) |
|---|---|---|
| `@Controller('payroll')` | `calculation/payroll-calculation.controller.ts:19` | `GET /payroll/calculate` (:30) · `GET /payroll/sheet-lines` (:82) · `GET /payroll/sheet-lines/:id` (:120) · `GET /payroll/support-allowances` (:145) · `GET /payroll/payslips/my` (:300) |
| `@Controller('payroll-periods')` | `periods/payroll-periods.controller.ts:30` | `GET /payroll-periods` (:35) · `POST /payroll-periods` (:44) · `GET /payroll-periods/:id` (:53) · `PATCH /payroll-periods/:id` (:59) · `DELETE /payroll-periods/:id` (:69) · `POST /payroll-periods/:id/submit` (:75) · `POST /payroll-periods/:id/reject` (:81) · `POST /payroll-periods/:id/lock` (:87) · `POST /payroll-periods/:id/reopen` (:93) · `POST /payroll-periods/:id/approve` (:104) · `POST /payroll-periods/:id/mark-paid` (:110) · `POST /payroll-periods/:id/archive` (:116) |
| `@Controller('payroll-data')` | `excel/payroll-excel.controller.ts:41` | `GET /payroll-data/:module/template` (:46) · `POST /payroll-data/:module/import-excel` (:71) · `GET /payroll-data/:module/export-excel` (:93) |
| `@Controller('payroll-data/attendance')` | `inputs/attendance/attendance.controller.ts:25` | `GET .../matrix` (:30) · `PUT .../cell` (:40) · `POST .../batch-override` (:50) |
| `@Controller('payroll-data/overtime')` | `inputs/overtime/overtime.controller.ts:27` | `GET` (:32) · `POST /apply` (:42) · `PUT /:employeeId` (:52) · `DELETE /:employeeId` (:63) |
| `@Controller('payroll-data/kpi')` | `inputs/kpi/kpi.controller.ts:26` | `GET` (:31) · `POST /apply` (:41) · `PUT /:employeeId` (:51) |
| `@Controller('payroll-data/bonus')` | `inputs/bonus/bonus.controller.ts:26` | `GET` (:31) · `POST /apply` (:41) · `PUT /:employeeId` (:51) |
| `@Controller('payroll-data/piecework')` | `inputs/piecework/piecework.controller.ts:26` | `GET` (:31) · `POST /apply` (:41) · `PUT /:employeeId` (:51) |
| `@Controller('payroll-data/commission')` | `inputs/commission/commission.controller.ts:26` | `GET` (:31) · `POST /apply` (:41) · `PUT /:employeeId` (:51) |
| `@Controller('payroll-data/diligence')` | `inputs/diligence/diligence.controller.ts:24` | `GET` (:29) · `POST /record` (:39) · `DELETE /:id` (:49) |
| `@Controller('payroll-data/adjustments')` | `inputs/adjustments/adjustments.controller.ts:26` | `GET` (:31) · `POST /apply` (:41) · `PUT /:employeeId` (:51) |
| `@Controller('payroll-catalogs')` | `catalogs/payroll-catalogs.controller.ts:42` | 16 route CRUD: `kpi-items` (:48/:54/:63/:73) · `products` (:80/:86/:95/:105) · `diligence-types` (:112/:118/:127/:137) · `adjustment-items` (:144/:150/:159/:169) |

### 1.2. Đối chiếu 11 endpoint trong `api-contract.md` Mục 2

| # | Endpoint theo `api-contract.md` | Trạng thái | Path THẬT trong code | Bằng chứng | Mức |
|:--:|---|:---:|---|---|:---:|
| 1 | `GET /payroll/calculate` | ✅ Khớp path | `GET /payroll/calculate` | `payroll-calculation.controller.ts:19,30` | — |
| 2 | `GET /payroll/sheet-lines` | ✅ Khớp path | `GET /payroll/sheet-lines` | `:19,82` | — |
| 3 | `GET /payroll/sheet-lines/:id` | ✅ Khớp path | `GET /payroll/sheet-lines/:id` | `:19,120` | — |
| 4 | `GET /payroll/support-allowances` | ✅ Khớp path | `GET /payroll/support-allowances` | `:19,145` | — |
| 5 | `GET /payroll/payslips/my` | ✅ Khớp path | `GET /payroll/payslips/my` | `:19,300` | — |
| 6 | `POST /payroll/periods/:id/lock` | ❌ **SAI PATH** | `POST /payroll-periods/:id/lock` | `payroll-periods.controller.ts:30,87` | 🔴 |
| 7 | `POST /payroll/periods/:id/reopen` | ❌ **SAI PATH** | `POST /payroll-periods/:id/reopen` | `:30,93` | 🔴 |
| 8 | `POST /payroll/periods/:id/approve` | ❌ **SAI PATH** | `POST /payroll-periods/:id/approve` | `:30,104` | 🔴 |
| 9 | `POST /payroll/periods/:id/mark-paid` | ❌ **SAI PATH** | `POST /payroll-periods/:id/mark-paid` | `:30,110` | 🔴 |
| 10 | `POST /payroll/periods/:id/archive` | ❌ **SAI PATH** | `POST /payroll-periods/:id/archive` | `:30,116` | 🔴 |
| 11 | `GET /payroll/export-excel` | ❌ **KHÔNG TỒN TẠI** | — (không route nào) | Excel controller chỉ có `payroll-data/:module/export-excel` với `module ∈ {attendance, overtime, kpi, bonus, piecework, commission, diligence, adjustments}` — `payroll-excel.service.ts:33-42` | 🔴 |

**Drift #A-1 (doc sai path, 5 endpoint)**: Prefix tài liệu là `payroll/periods/...` nhưng controller thật khai `@Controller('payroll-periods')` — dấu `-` thay vì `/`. FE gọi theo contract sẽ nhận `404` toàn bộ 5 hành động vòng đời kỳ lương.

**Drift #A-2 (doc thừa 1 endpoint)**: `GET /payroll/export-excel` cùng `ExportPayrollExcelQueryDto` + enum `PayrollExportType {SHEET_18_COLS, SUPPORT_ALLOWANCES}` (`api-contract.md` Mục 3.11) **chưa từng được triển khai**. Grep toàn `Backend/src` không có định danh `PayrollExportType` / `SHEET_18_COLS` / `SUPPORT_ALLOWANCES`. Tính năng xuất Excel bảng lương 18 cột và bảng lương hỗ trợ hiện **không có**; `payroll-data/:module/export-excel` chỉ xuất lại 8 bảng dữ liệu đầu vào, không phải bảng lương.

**Drift #A-3 (base URL sai)**: `api-contract.md` Mục 1.1 khai *"Base URL Prefix: `/api/v1`"*. `Backend/src/main.ts` **không gọi `app.setGlobalPrefix(...)`** (đã đọc toàn bộ 43 dòng file) — mọi route chạy ở gốc `/`. Ví dụ `POST /payroll-periods/:id/lock`, KHÔNG phải `/api/v1/payroll/periods/:id/lock`. Swagger mount ở `api/docs` (`main.ts:38`) là ngoại lệ duy nhất có prefix.

**Drift #A-4 (doc thiếu 50 route)**: 11 endpoint tài liệu che phủ 5/61 route thật ở đúng path. Riêng nhóm `payroll-periods` có **7 route CRUD/vòng đời chưa được đặc tả**: `GET /payroll-periods` (:35), `POST /payroll-periods` (:44), `GET /payroll-periods/:id` (:53), `PATCH /payroll-periods/:id` (:59), `DELETE /payroll-periods/:id` (:69), `POST /payroll-periods/:id/submit` (:75), `POST /payroll-periods/:id/reject` (:81). Trong đó `submit` (`DRAFT → PENDING_REVIEW`) và `reject` (`PENDING_REVIEW → DRAFT`) là **2 chuyển trạng thái bắt buộc của state machine 6 trạng thái** mà `api-contract.md` Mục 5 hoàn toàn không nhắc — ma trận RBAC vì thế thiếu 2 hàng. (44 route còn lại thuộc `payroll-data/*` + `payroll-catalogs/*`, đã được đặc tả ở contract của phân hệ `du_lieu_tinh_luong`, không tính là drift của contract này.)

### 1.3. Drift DTO Request/Response

| Vị trí doc | DTO tài liệu đặc tả | Hiện thực thật | Mức |
|---|---|---|:---:|
| Mục 3.1 | `CalculatePayrollQueryDto` với `@IsUUID('4')` + `@IsNotEmpty()` | **Không tồn tại**. Controller nhận `@Query('periodId') periodId: string` trần, chỉ `if (!periodId) throw E-dltl-025` (`payroll-calculation.controller.ts:31-34`). **Không validate UUID** → `periodId` rác đi thẳng xuống `findUnique` | 🟡 |
| Mục 3.2 | `GetSheetLinesQueryDto` với `@IsUUID('4')`, `@MaxLength(100)` cho `keyword` | **Không tồn tại**. `@Query` trần (`:83-87`), `keyword` không giới hạn độ dài | 🟡 |
| Mục 3.7 | `ReopenPayrollPeriodDto` dùng **`class-validator`**: `@MinLength(20)` **+ `@MaxLength(500)`** | Dùng **Zod**: `z.object({ reason: z.string().min(20) })` — `periods/dto/reopen-period.dto.ts:3-7`. **Thiếu `.max(500)`** → `reason` dài vô hạn ghi thẳng vào `audit_logs` | 🟡 |
| Mục 3.11 | `ExportPayrollExcelQueryDto` + enum `PayrollExportType` | **Không tồn tại** (kèm endpoint không tồn tại, xem #A-2) | 🔴 |
| Mục 1.3 (toàn bộ) | Khai *"phân quyền... `class-validator`"* | Dự án dùng **Zod + `PayrollZodValidationPipe`** (`payroll-periods.controller.ts:14,46,62,97`). Toàn bộ khối `class-validator` trong contract là **giả định sai về stack** | 🟡 |

**Drift #A-5 (envelope response)**: `api-contract.md` Mục 1.5 quy định **mọi** response thành công bọc `{ success, data, meta.timestamp }`. Thực tế không đồng nhất:

| Endpoint | Envelope thật | Bằng chứng |
|---|---|---|
| `GET /payroll/calculate` | `{ success, data }` — **thiếu `meta.timestamp`** | `payroll-calculation.controller.ts:66-75` |
| `GET /payroll/sheet-lines` | **Trả mảng trần**, KHÔNG có `success`/`data` | `:110-113` (`return this.prisma.payrollSheetLine.findMany(...)`) |
| `GET /payroll/sheet-lines/:id` | `{ success, data }` | `:135-138` |
| `GET /payroll/support-allowances` | `{ success, data }` | `:225-232`, `:285-292` |
| `GET /payroll/payslips/my` | `{ success, data }` | `:355-358` |
| `POST .../lock` | Object phẳng `{ success, periodId, status, ..., message }` — **không có lớp `data`** | `payroll-periods.service.ts:242-251` |
| `POST .../reopen` | Object phẳng tương tự | `payroll-periods.service.ts:332-340` |
| `POST .../approve` `/mark-paid` `/archive` | **Trả entity `PayrollPeriod` trần** | `payroll-periods.service.ts:359-366`, `382-387`, `403-408` |

Đặc biệt Mục 3.2 khai *"kèm thông tin tổng hợp quỹ lương của kỳ"* — code chỉ `findMany` thuần, **không có khối tổng hợp nào**.

**Drift #A-6 (không có `E-pay-004` cho sheet-lines/:id sai kỳ)**: Contract Mục 3.3 nói `E-pay-004` kích hoạt khi *"ID không tồn tại **hoặc không khớp với `periodId`**"*. Code chỉ `findUnique({where:{id}})` rồi kiểm `!line` (`payroll-calculation.controller.ts:122-133`) — **không kiểm chéo `periodId`**; endpoint cũng không nhận `periodId`. Nhánh "không khớp periodId" là bất khả thi trong hiện thực.

### 1.4. Drift Ma Trận RBAC (`api-contract.md` Mục 5)

| Endpoint | Doc: vai trò được phép | Code: `@Roles(...)` | Kết quả |
|---|---|---|:---:|
| `GET /payroll/calculate` | ADMIN, HR, ACCOUNTANT | ADMIN, HR, ACCOUNTANT (`:29`) | ✅ |
| `GET /payroll/sheet-lines` | ADMIN, HR, ACCOUNTANT | ADMIN, HR, ACCOUNTANT (`:81`) | ✅ |
| `GET /payroll/sheet-lines/:id` | ADMIN, HR, ACCOUNTANT | ADMIN, HR, ACCOUNTANT (`:119`) | ✅ |
| `GET /payroll/support-allowances` | ADMIN, HR, ACCOUNTANT | ADMIN, HR, ACCOUNTANT (`:144`) | ✅ |
| `GET /payroll/payslips/my` | EMPLOYEE (+ADMIN/HR/ACCT xem của mình) | EMPLOYEE, ADMIN, HR, ACCOUNTANT (`:299`) | ✅ |
| `POST .../lock` | ACCOUNTANT, ADMIN | ADMIN, ACCOUNTANT (`:86`) | ✅ |
| `POST .../reopen` | **CHỈ ADMIN** | **ADMIN, HR, ACCOUNTANT** (`payroll-periods.controller.ts:92`) | ❌ **Guard rộng hơn contract** |
| `POST .../approve` | CHỈ ADMIN | ADMIN (`:103`) | ✅ |
| `POST .../mark-paid` | ACCOUNTANT, ADMIN | ADMIN, ACCOUNTANT (`:109`) | ✅ |
| `POST .../archive` | CHỈ ADMIN | ADMIN (`:115`) | ✅ |
| `GET /payroll/export-excel` | ADMIN, HR, ACCOUNTANT | **Không có endpoint** | ❌ |

**Drift #A-7 (guard `reopen` không khớp contract — defense-in-depth thiếu 1 lớp)**: `RolesGuard` cho phép HR/ACCOUNTANT đi qua tầng guard; việc chặn nằm ở tầng service `payroll-periods.service.ts:261-272` (`if (userRole !== Role.ADMIN) → PayrollError E-pay-008` → HTTP 403). Kết quả HTTP **đúng contract** (403 + `E-pay-008`), nhưng lệ thuộc hoàn toàn vào 1 dòng service; guard không còn là lớp chặn thứ hai, và `req.user?.role` được truyền tay từ controller (`:100`) thay vì do guard đảm bảo. Đã ghi nhận là `BUG-PAY-01` và tuyên bố đã fix — **fix chỉ đúng phần mã lỗi, chưa siết `@Roles`**.

**Drift #A-8 (ma trận RBAC theo trạng thái không phản ánh đúng hành vi thật)**:
- Contract ghi `GET /payroll/sheet-lines` ở `DRAFT`/`PENDING_REVIEW` là *"⚠️ Đọc nháp"*. Thực tế code đọc thẳng bảng snapshot (`:110`) → **luôn trả mảng rỗng** ở DRAFT vì snapshot chỉ sinh khi `LOCKED`. Không có cơ chế "đọc nháp".
- Contract ghi `POST .../reopen` chỉ hợp lệ ở `LOCKED`. Code chỉ **chặn `PAID`/`ARCHIVED`** (`payroll-periods.service.ts:286-295`) → **`APPROVED` vẫn reopen được**, trái ma trận (`APPROVED` phải là ❌). Đây là lỗ hổng kiểm soát: kỳ đã được Ban Giám đốc phê duyệt có thể bị ADMIN mở lại và xóa snapshot mà không vi phạm ràng buộc nào trong code.
- 2 chuyển trạng thái `submit`/`reject` không có hàng trong ma trận (xem #A-4).

---

## 2. [B] Bảng Drift Data Model

### 2.1. `PayrollSheetLine` — schema.prisma ↔ data-model.md ↔ payroll-erd.md

**Kết quả so từng cột: 39/39 cột KHỚP TUYỆT ĐỐI về tên, kiểu, nullable, default.**

`schema.prisma:1064-1132` giống nguyên văn khối Prisma DSL trong `data-model.md:133-201` (kể cả comment `///`). `payroll-erd.md:45-84` liệt kê đúng 39 thuộc tính, cùng thứ tự, cùng ngữ nghĩa. Không có cột thừa/thiếu ở cả 3 nguồn. 4 cột bổ sung của đợt này (`fixedAllowanceSalary`, `otTaxExemptAmount`, `lunchTaxExemptAmount`, `otherTaxExemptAmount`) có mặt đầy đủ ở schema (`:1093,1097,1099,1101`) và migration (`migration.sql:3-6`).

### 2.2. `PayrollSheetItemBreakdown` — bảng lệch 4 nguồn

**Tên THẬT của cột tiền trong schema**: có **hai** cột tiền, `configuredAmount` (định mức tháng, `schema.prisma:1150`) và **`calculatedAmount`** (số tiền thực tính trong kỳ, `schema.prisma:1153`). **KHÔNG tồn tại cột tên `amount`.**

| Thuộc tính | `schema.prisma:1136-1177` | `data-model.md:213-254` | `payroll-erd.md:86-105` | `CONTEXT_SUMMARY.md:172` | Nguồn SAI |
|---|---|---|---|---|:---:|
| khóa ngoại dòng cha | `sheetLineId` | `sheetLineId` ✅ | `sheetLineId` ✅ | `payrollSheetLineId` ❌ | CONTEXT_SUMMARY |
| phân loại | `itemCategory String @db.VarChar(50)` | `itemCategory String VarChar(50)` ✅ | `enum itemCategory` ⚠️ (schema là String, không phải enum) | `itemType` ❌ | CONTEXT_SUMMARY + ERD |
| tiền định mức | `configuredAmount Int @default(0)` | ✅ | ✅ | *(không nhắc)* ❌ | CONTEXT_SUMMARY |
| **tiền thực tính** | **`calculatedAmount Int @default(0)`** | ✅ `calculatedAmount` | ✅ `calculatedAmount` | **`amount`** ❌ | **CONTEXT_SUMMARY** |
| tỷ lệ công | `workDaysRatio Decimal @default(1.0000) @db.Decimal(5,4)` | ✅ | ✅ | *(không nhắc)* ❌ | CONTEXT_SUMMARY |
| chính sách thuế | 3 cột `isTaxable Boolean @default(true)` + `taxableAmount Int` + `taxExemptAmount Int` | ✅ đủ 3 | ✅ đủ 3 | `taxTreatment` ❌ (1 cột enum) | CONTEXT_SUMMARY |
| chính sách BH | `isSocialInsurance Boolean @default(false)` + `insuranceAmount Int` | ✅ | ✅ | *(không nhắc)* ❌ | CONTEXT_SUMMARY |
| phương thức tính | **KHÔNG có cột này** | không có ✅ | không có ✅ | `calculationMethod` ❌ | CONTEXT_SUMMARY |
| `salaryItemId` | `String? @db.Uuid`, FK RESTRICT | ✅ | ✅ | ✅ | — |
| `itemCode` / `itemName` / `note` / `createdAt` | VarChar(50)/VarChar(200)/VarChar(500)?/Timestamptz(3) | ✅ | ✅ | ✅ | — |

**Kết luận câu hỏi #4**: Cột tiền thật là **`calculatedAmount`** (+ `configuredAmount`). Doc ghi SAI là **`docs/payroll/CONTEXT_SUMMARY.md` dòng 172** — nó mô tả model breakdown bằng 5 tên trường không tồn tại (`payrollSheetLineId`, `itemType`, `amount`, `taxTreatment`, `calculationMethod`) và bỏ sót 6 trường có thật. `data-model.md`, `payroll-erd.md` và `qa/issues-and-bugs.md:120` (dùng đúng `breakdowns.calculatedAmount`) đều CHÍNH XÁC. Nguyên nhân nhầm: `taxTreatment` + `calculationMethod` là 2 trường thật nhưng thuộc model **khác** — `SalaryStructureItem` (`schema.prisma:624,626`), không phải breakdown.

**Lệch phụ trong `payroll-erd.md`**:
- `payroll-erd.md:94` khai `enum itemCategory`, schema là `String @db.VarChar(50)` (`:1147`) — ERD gợi ý sai kiểu.
- `payroll-erd.md:102` mô tả `insurance_amount` = *"Số tiền làm căn cứ đóng BHXH"*, `data-model.md:114` mô tả *"Số tiền đóng BHXH thực tế"* — 2 doc **mâu thuẫn ngữ nghĩa** cho cùng 1 cột. Code (`payroll-calculation.service.ts:396`) gán `insuranceAmount = isSocialInsurance ? tienThucTe : 0` tức **căn cứ đóng**, khớp ERD, lệch data-model.
- `payroll-erd.md:193-196` chỉ liệt kê **3** index cho bảng breakdown, thiếu `@@index([sheetLineId, salaryItemId])` có thật ở `schema.prisma:1175`.

### 2.3. Migration SQL vs `data-model.md` Mục 3 — CHECK constraints

**Kết quả: 0/28 CHECK constraint tài liệu đặc tả được tạo trong migration.**

| Nhóm ràng buộc | `data-model.md` yêu cầu | Migration thật | Bằng chứng |
|---|:---:|:---:|---|
| CHECK trên `payroll_sheet_lines` | **24** constraint (`chk_psl_*`, `data-model.md:297-321`) | **0** | `migration.sql` mới (`20260906202000_...`) chỉ có `ALTER TABLE ... ADD COLUMN` (dòng 1-6), không có `ADD CONSTRAINT CHECK`. Migration tạo bảng (`20260906112206_.../migration.sql:222-259`) cũng không có |
| CHECK trên `payroll_sheet_item_breakdowns` | **4** constraint (`chk_psib_work_days_ratio`, `chk_psib_taxable_amount`, `chk_psib_tax_exempt_amount`, `chk_psib_insurance_amount`, `data-model.md:361-364`) | **0** | `20260906202000_.../migration.sql:9-30` — `CREATE TABLE` không kèm CHECK nào |
| CHECK toàn dự án | — | **16**, TẤT CẢ nằm ở bảng đầu vào (attendance/overtime/kpi/bonus/piecework/commission/diligence/adjustment) | `20260906112206_.../migration.sql:467-530` |

**Trả lời câu hỏi #5 (`netTakeHomeSalary` được phép âm)**: ✅ **XÁC NHẬN không có CHECK `>= 0` trên `net_take_home_salary`** — `BR-pay-008` không bị DB chặn, thực lĩnh âm lưu được. **NHƯNG** điều này đúng vì **lý do sai**: không phải do thiết kế cố ý bỏ 1 constraint trong 25, mà vì **không constraint nào được tạo cả**. Bất biến "chỉ riêng cột này được âm" hiện **không có gì bảo vệ**: `gross_income`, `personal_income_tax`, `taxable_income`, `employee_insurance_deduction`... đều có thể nhận số âm ở tầng DB nếu tầng ứng dụng lỗi.

**Drift phụ về quy ước đặt tên cột trong DDL**: `data-model.md` Mục 3 và `payroll-erd.md` Mục 2 viết DDL/Data Dictionary bằng **snake_case** (`fixed_allowance_salary`, `period_id`, `net_take_home_salary`, `work_days_ratio`...). Thực tế Prisma **không** có `@map` cấp field nên DB dùng **camelCase có nháy kép**: `"fixedAllowanceSalary"`, `"periodId"`, `"netTakeHomeSalary"`, `"workDaysRatio"` (`migration.sql:3-6,11-27`). Mọi câu SQL/DDL trong 2 doc chạy trực tiếp sẽ **fail `column does not exist`**. Tên constraint/index tài liệu (`chk_psl_*`, `idx_psib_*`) cũng khác tên Prisma sinh (`payroll_sheet_item_breakdowns_sheetLineId_idx`...).

### 2.4. Index vs 5 Access Patterns (câu hỏi #6)

| Pattern (`data-model.md` Mục 5) | Index tài liệu | Index THẬT trong migration | Kết quả |
|---|---|---|:---:|
| P1 Render bảng lương 18 cột | `idx_psl_period_id` + `UNIQUE(period_id, employee_id)` | `payroll_sheet_lines_periodId_idx` + `payroll_sheet_lines_periodId_employeeId_key` (schema `:1128-1129`; migration cũ `20260906112206`) | ✅ |
| P2 Chi tiết 1 nhân viên | `idx_psib_sheet_line_id` | `payroll_sheet_item_breakdowns_sheetLineId_idx` — `migration.sql:33` | ✅ (khác tên) |
| P3 Tab lương hỗ trợ | `idx_psib_period_category [period_id, item_category]` | `..._periodId_itemCategory_idx` — `migration.sql:39` | ✅ (khác tên) |
| P4 Phiếu lương cá nhân | `UNIQUE(period_id, employee_id)` | `payroll_sheet_lines_periodId_employeeId_key` | ✅ |
| P5 Đối soát danh mục | `idx_psib_sheet_line_item [sheet_line_id, salary_item_id]` | `..._sheetLineId_salaryItemId_idx` — `migration.sql:42` | ✅ (khác tên) |
| *(không có trong bảng 5 pattern)* | — | `..._periodId_employeeId_idx` — `migration.sql:36` | ➕ Thừa 1 index so với bảng Mục 5 (nhưng có trong Mục 2.2 & ERD) |

**Kết luận #6**: **5/5 access pattern đều có index hỗ trợ**. Chỉ lệch **tên** constraint (Prisma tự sinh vs tên tài liệu đặt tay). Doc nên ghi tên Prisma thật để DBA `EXPLAIN` đối chiếu được.

### 2.5. Foreign Key Cascade (câu hỏi #7)

| FK | Doc yêu cầu | Migration thật | Kết quả |
|---|:---:|---|:---:|
| `payroll_sheet_item_breakdowns.periodId → payroll_periods` | CASCADE | `ON DELETE CASCADE ON UPDATE CASCADE` — `migration.sql:45` | ✅ |
| `... .employeeId → employees` | CASCADE | `ON DELETE CASCADE` — `migration.sql:48` | ✅ |
| `... .sheetLineId → payroll_sheet_lines` | CASCADE | `ON DELETE CASCADE` — `migration.sql:51` | ✅ |
| `... .salaryItemId → salary_items` | **RESTRICT** | `ON DELETE RESTRICT ON UPDATE CASCADE` — `migration.sql:54` | ✅ |
| `payroll_sheet_lines.periodId → payroll_periods` | CASCADE | Cascade (migration `20260906112206`, khớp `schema.prisma:1122`) | ✅ |

**Kết luận #7**: **5/5 cascade rule khớp tuyệt đối.** Bất biến kế toán (RESTRICT trên `SalaryItem`) được DB bảo vệ thật.

Bổ sung kiểm chứng nghiệp vụ: xóa kỳ `DRAFT` được chặn đúng ở service — `payroll-periods.service.ts:130-132` chỉ cho `delete()` khi `status === DRAFT`, nên CASCADE không thể quét snapshot của kỳ đã khóa. ✅

---

## 3. [C] Kết Quả Tuân Thủ ADR-001

### 3.1. Quyết định 1 — Pipeline 6 Stages (câu hỏi #8): ⚠️ **PARTIAL**

**Về số lượng stage**: có đủ **6 mốc** đúng thứ tự và đúng nội dung ADR, xác nhận bằng comment banner trong `payroll-calculation.service.ts`:

| Stage | ADR-001 Mục 2 | Vị trí trong code | Khớp nội dung |
|:--:|---|---|:---:|
| 1 | Công & Phụ cấp cố định | `:290-400` | ⚠️ (xem #C-1, #C-2) |
| 2 | Tăng ca & Miễn thuế OT | `:402-472` | ❌ (xem #C-3) |
| 3 | Thu nhập biến động & Chặn sàn chuyên cần | `:474-640` | ✅ |
| 4 | Bảo hiểm 2 trần độc lập & Công đoàn | `:642-679` | ✅ |
| 5 | Thuế TNCN & Hạn mức ăn trưa | `:681-754` | ⚠️ (xem #C-4) |
| 6 | Bù trừ & Thực lĩnh (dung nạp âm) | `:756-779` | ✅ |

**Không có stage nào bị gộp hay tách sai thứ tự.** Nhưng có 4 sai lệch bên trong:

**#C-0 (cấu trúc — vi phạm ADR Mục 4.2)**: ADR yêu cầu *"Refactor toàn diện hàm `calculatePeriodPayroll` **chia tách thành 6 private methods** tương ứng 6 Stages"*. Thực tế 6 stage nằm **nguyên khối trong 1 hàm dài 719 dòng** (`:109-828`), phân tách chỉ bằng comment. Method duy nhất được tách là `calculatePersonalIncomeTax()` (`:84-104`). Hệ quả: không thể unit-test từng stage độc lập như ADR dự kiến ("6 pure function stages được bảo vệ bằng Unit Tests 100%" — ADR Mục 3, Phương án C); test hiện phải mock toàn bộ 8 bảng để chạm 1 stage.

**#C-1 🔴 (Stage 1 — `calculationMethod` là trường KHÔNG TỒN TẠI)**:
```
payroll-calculation.service.ts:350-351
  const method = (item as any).calculationMethod ?? (item as any).method;
```
`item` ở đây là bản ghi `EmployeeSalaryItem`. Model thật chỉ có **4 cột**: `id`, `employeeSalaryId`, `salaryItemId`, `amount` (`schema.prisma:664-677`). **Không có `calculationMethod`, không có `method`.** Quan hệ `salaryItem` (`SalaryItem`, `schema.prisma:578-600`) cũng không có. Trường `calculationMethod` chỉ tồn tại trên `SalaryStructureItem` (`schema.prisma:626`) — model mà pipeline **không hề query**.

→ Ở môi trường thật `method` **luôn `undefined`**, nhánh `MONTHLY_FIXED` (`:353`) và `WORK_DAYS` (`:355-358`) **không bao giờ chạy**. Code luôn rơi xuống fallback đoán theo tên (`:360-370`): chỉ khoản có tên chứa `"điện thoại"`/`"phone"` mới được coi là cố định tháng, **mọi khoản còn lại bị prorate theo ngày công**. Trong khi seed dữ liệu thật gán `MONTHLY_FIXED` cho `KL02`, `KL03`, `KL05`, `KL06`, `KL07`, `KL17` (`prisma/seed.ts:170-177`).

→ **Vi phạm trực tiếp ADR-001 Stage 1 và `BR-pay-001`** (lỗ hổng cốt lõi #1 mà cả dự án được lập ra để vá). Nhân viên nghỉ nửa tháng sẽ **bị cắt một nửa** các khoản đáng lẽ nhận trọn tháng.

→ **Vì sao test vẫn xanh**: `payroll-calculation.pipeline.spec.ts` **tự bơm** `calculationMethod` vào mock (`:100`, `:111`, `:122`, `:706`, `:756`, `:809`) — mock có hình dạng mà Prisma không bao giờ trả về. Test đang xác nhận một hợp đồng dữ liệu ảo.

**#C-2 (Stage 1 — công thức lương thời gian lệch ADR)**: ADR ghi `proratedWorkSalary = round(baseSalaryMonthly × workDaysRatio)` với `workDaysRatio = min(1.0, actual/standard)` (ADR dòng 77-79). Code tính `Math.round((baseSalaryMonthly / standardWorkDays) * actualWorkDays)` (`:307-310`) — **bỏ mất kẹp trần `min(1.0, ...)`**. Khi `actualWorkDays > 26` (tháng 31 ngày, chấm công đủ), lương thời gian **vượt lương hợp đồng**. `workDaysRatio` có kẹp trần (`:302-305`) nhưng chỉ dùng cho phụ cấp và hạn mức ăn trưa, không dùng cho lương chính.

**#C-3 🔴 (Stage 2 — đọc 3 trường OT KHÔNG TỒN TẠI, `BR-pay-004` bất hoạt)**:
```
payroll-calculation.service.ts:416-427
  const hours = Number((ot as any).actualHours ?? (ot as any).otHours ?? 0);
  const rate  = Number((ot as any).otRate ?? 100);
  ...
  if ((ot as any).totalAmount !== undefined && (ot as any).totalAmount !== null) { caAmount = (ot as any).totalAmount; }
```
Model `OvertimeRecord` thật chỉ có `hours`, `ratePercent`, `convertedHours` (`schema.prisma:805-828`). **`actualHours`, `otHours`, `otRate`, `totalAmount` đều không tồn tại** trên bảng này (lưu ý `actualHours` CÓ tồn tại nhưng ở `AttendanceRecord`, `schema.prisma:786` — nhầm bảng).

Suy diễn hành vi production:
1. `hours = 0`, `rate = 100`, `caAmount = 0` (không vào cả 2 nhánh `:427`/`:429`).
2. `converted = Number(ot.convertedHours)` — trường thật duy nhất đọc đúng.
3. Sau vòng lặp `otAmount === 0` và `otConvertedHours > 0` → kích hoạt fallback `:445-450`, gán `otAmount = round(base/26/8 × otConvertedHours)` **và `otStandardAmount = otAmount`**.
4. `otTaxExemptAmount = Math.max(0, otAmount - otStandardAmount)` (`:452`) = **0 vĩnh viễn**.

→ **`BR-pay-004` (lỗ hổng cốt lõi #3 — miễn thuế phần OT vượt giờ chuẩn theo Điểm i Khoản 1 Điều 3 TT 111/2013) hoàn toàn không hoạt động trong production.** Cột `otTaxExemptAmount` luôn bằng 0, người lao động vẫn chịu thuế oan đúng như hiện trạng cũ mà ADR-001 tuyên bố đã vá.
→ Số tiền OT (`otAmount`) vẫn ra đúng nhờ fallback, nên lỗi **âm thầm**, không ai thấy sai ở bảng lương tổng.
→ Test xanh vì mock bơm đủ `actualHours`/`otRate`/`totalAmount` (`pipeline.spec.ts:201-218`, `:287-289`, `:497-500`) — kể cả TC-PAY-023 (OT đêm lễ 390%) cũng chạy trên dữ liệu ảo.

**#C-4 (Stage 5 — thiếu điều kiện "HĐ dưới 3 tháng")**: ADR Mục 2 Stage 5 Trường hợp A và `BR-pay-005` quy định khấu trừ 10% cho `PROBATION`, `SERVICE_CONTRACT`, **hoặc HĐ dưới 3 tháng**. Code chỉ kiểm 2 enum `contractType` (`:732-735`), **không kiểm thời hạn hợp đồng** (`Contract.effectiveFrom`/`effectiveTo` có sẵn, `schema.prisma:358-359`). Một `LABOR_CONTRACT` kỳ hạn 2 tháng sẽ được hưởng lũy tiến + giảm trừ 11tr — **sai luật thuế**.

**#C-5 (phụ, chọn hợp đồng)**: `:168-171` lấy `contracts` `orderBy: { effectiveFrom: 'desc' }, take: 1` — luôn lấy hợp đồng có `effectiveFrom` mới nhất, **không lọc theo khoảng thời gian kỳ lương**. Hợp đồng ký trước cho kỳ tương lai sẽ ghi đè mức lương của kỳ đang tính.

### 3.2. Quyết định 2 — Snapshot Bất Biến Đa Tầng: ✅ **PASS**

`snapshotPayrollSheetLines()` (`payroll-calculation.service.ts:834-943`) thực hiện đúng 4 bước ADR: xóa breakdowns cũ (`:841-845`) → xóa lines cũ (`:846`) → `createMany` lines với `id` tự sinh giữ liên kết cha-con (`:849-902`) → `createMany` breakdowns tham chiếu `sheetLineId: line.id` (`:906-932`). Đủ 15 trường breakdown đúng tên schema. Ghi cả 2 tầng trong cùng 1 phạm vi `client`.

Reopen xóa đủ 2 tầng đúng thứ tự con-trước-cha: `payroll-periods.service.ts:301-310`. Audit log `PAYROLL_PERIOD_REOPENED` có ghi (`:321-330`). ✅

### 3.3. Quyết định 3 — Chiến lược truyền `tx`, chống nested `$transaction` (câu hỏi #9): ✅ **PASS**

Chữ ký khớp nguyên văn ADR: `snapshotPayrollSheetLines(periodId, calculatedLines, tx?: Prisma.TransactionClient)` (`payroll-calculation.service.ts:834-838`), pattern `runner` + `if (tx) return runner(tx); else return this.prisma.$transaction(runner, { timeout: 30000 })` (`:938-942`).

Phía gọi: `payroll-periods.service.ts:207` mở `$transaction`, `:231-235` truyền thẳng `tx` vào `snapshotPayrollSheetLines(id, calculatedLines, tx)`. **Không lồng.**

**Grep toàn `Backend/src` (loại trừ `generated/` và `*.spec.ts`) tìm `$transaction` — kết quả xác nhận không có chỗ nào lồng nhau:**

| File:line | Ngữ cảnh | Nested? |
|---|---|:---:|
| `payroll-periods.service.ts:207` (`lock`) | Gọi `calculatePeriodPayroll` **TRƯỚC** khi mở tx (`:198-199`, chỉ đọc); trong tx chỉ gọi `snapshotPayrollSheetLines(..., tx)` | ❌ Không |
| `payroll-periods.service.ts:299` (`reopen`) | Chỉ `deleteMany` + `update` + `auditService.log` | ❌ Không |
| `payroll-calculation.service.ts:941` | Chỉ chạy khi **không** nhận `tx` (đường độc lập) | ❌ Không |
| `payroll-excel.service.ts:334` | Comment `:24-26` ghi rõ **cố ý không gọi 8 service Input** vì chúng tự mở `$transaction`; Pass 2 ghi trực tiếp qua `tx` | ❌ Không (đã xử lý có chủ đích) |
| 8 service Input (`attendance:209`, `overtime`, `kpi`, `bonus:106,172`, `piecework:120,208`, `commission:108,185`, `adjustments`, `diligence`) | Mỗi hàm mở tx riêng, không service nào gọi service khác trong tx | ❌ Không |
| `employees.service.ts:153,163` · `salary-structures.service.ts:108` · `employee-salaries.service.ts:313` · `token.service.ts:134,165,183` | Ngoài phạm vi payroll, đều 1 tầng | ❌ Không |

**Kết luận #9**: ✅ Chiến lược `tx` được áp dụng nhất quán. **Không phát hiện `$transaction` lồng nhau ở bất kỳ đâu trong `Backend/src`.**

**Lưu ý vận hành (không phải drift)**: `lock()` chạy `calculatePeriodPayroll` **ngoài** transaction (`:198`) rồi mới mở tx. Đây là lựa chọn đúng (giữ tx ngắn), nhưng có nghĩa dữ liệu 8 phân hệ đọc ngoài tx — nếu có ghi xen giữa thì snapshot dùng ảnh chụp cũ hơn `lockedAt`. Optimistic check `:209-219` chỉ bảo vệ trạng thái kỳ, không bảo vệ dữ liệu nguồn.

---

## 4. [D] Bảng Kiểm Kê Hằng Số Pháp Lý Hard-Code

**Trả lời câu hỏi #10: TOÀN BỘ hằng số pháp lý đang HARD-CODE trong service. `GeneralSetting` chỉ được kiểm tra "có âm không", giá trị của nó KHÔNG BAO GIỜ được dùng để tính.**

Bằng chứng then chốt — đây là 100% những gì code làm với `GeneralSetting`:
```
payroll-calculation.service.ts:131-144
  if ((this.prisma as any).generalSetting) {
    const setting = await (this.prisma as any).generalSetting.findFirst();
    if (setting) {
      if ((setting.baseSalary !== undefined && setting.baseSalary < 0) || ... )
        throw new PayrollError({ code: 'E-pay-003' });
    }
  }
```
Sau khối này, biến `setting` **không được tham chiếu lần nào nữa** trong 719 dòng còn lại.

### 4.1. Kiểm kê 21 hằng số

| # | Hằng số | Giá trị | file:line | Nguồn giá trị hiện tại | Trường `GeneralSetting` tương ứng đã có sẵn | Căn cứ pháp lý |
|:--:|---|---:|---|:---:|---|---|
| 1 | Trần BHXH/BHYT | `46_800_000` | `payroll-calculation.service.ts:268` | **HARD-CODE** (`const CAP_BHXH_BHYT`) | *(dẫn xuất)* `baseSalary` × 20 — `schema.prisma:517` mặc định `2340000` | NĐ 73/2024 |
| 2 | Trần BHTN | `99_200_000` | `:269` | **HARD-CODE** (`const CAP_BHTN`) | *(dẫn xuất)* `regionMinSalary` × 20 — `schema.prisma:518` mặc định `4960000` | NĐ 74/2024 |
| 3 | Trần đoàn phí công đoàn | `234_000` | `:270` | **HARD-CODE** (`const CAP_UNION_FEE`) | **`unionFeeBaseCap`** — `schema.prisma:526` mặc định `234000` | QĐ 1908/QĐ-TLĐ |
| 4 | Trần miễn thuế ăn trưa | `730_000` | `:696` | **HARD-CODE inline** trong biểu thức | ❌ **Chưa có trường nào** | TT 26/2016 |
| 5 | Giảm trừ bản thân | `11_000_000` | `:744` | **HARD-CODE inline** | **`personalDeduction`** — `schema.prisma:528` mặc định `11000000` | NQ 954/2020 |
| 6 | Giảm trừ NPT | `4_400_000` | `:744` | **HARD-CODE inline** | **`dependentDeduction`** — `schema.prisma:529` mặc định `4400000` | NQ 954/2020 |
| 7 | Ngưỡng khấu trừ 10% tại nguồn | `2_000_000` | `:737` | **HARD-CODE inline** | ❌ Chưa có | Điểm i K1 Đ25 TT 111/2013 |
| 8 | Thuế suất khấu trừ tại nguồn | `0.1` | `:738` | **HARD-CODE inline** | ❌ Chưa có | Điểm i K1 Đ25 TT 111/2013 |
| 9 | Lương cơ sở `2.340.000` | *(không xuất hiện)* | — | **KHÔNG có trong code** — chỉ có tích số 46.8tr | `baseSalary` (`:517`) | NĐ 73/2024 |
| 10 | LTT vùng 1 `4.960.000` | *(không xuất hiện)* | — | **KHÔNG có trong code** — chỉ có tích số 99.2tr | `regionMinSalary` (`:518`) | NĐ 74/2024 |
| 11 | Tỷ lệ BHXH NLĐ | `0.08` | `:654` | **HARD-CODE** | `socialInsuranceEmpPercent` (`:519`, `8.0`) | Luật BHXH |
| 12 | Tỷ lệ BHYT NLĐ | `0.015` | `:655` | **HARD-CODE** | `healthInsuranceEmpPercent` (`:520`, `1.5`) | Luật BHYT |
| 13 | Tỷ lệ BHTN NLĐ | `0.01` | `:656` | **HARD-CODE** | `unemploymentInsuranceEmpPercent` (`:521`, `1.0`) | Luật Việc làm |
| 14 | Tỷ lệ BHXH DN | `0.175` | `:659` | **HARD-CODE** | `socialInsuranceCompPercent` (`:522`, `17.5`) | Luật BHXH |
| 15 | Tỷ lệ BHYT DN | `0.03` | `:660` | **HARD-CODE** | `healthInsuranceCompPercent` (`:523`, `3.0`) | Luật BHYT |
| 16 | Tỷ lệ BHTN DN | `0.01` | `:661` | **HARD-CODE** | `unemploymentInsuranceCompPercent` (`:524`, `1.0`) | Luật Việc làm |
| 17 | Tỷ lệ đoàn phí NLĐ | `0.01` | `:668` | **HARD-CODE** | `unionFeeEmpPercent` (`:525`, `1.0`) | QĐ 1908/QĐ-TLĐ |
| 18 | Tỷ lệ KPCĐ DN | `0.02` | `:678` | **HARD-CODE** | `unionFeeCompPercent` (`:527`, `2.0`) | NĐ 191/2013 |
| 19 | Biểu thuế lũy tiến 7 bậc (7 ngưỡng + 7 số trừ) | `5tr/10tr/18tr/32tr/52tr/80tr` + `0.05..0.35` + `250k/750k/1.65tr/3.25tr/5.85tr/9.85tr` | `:88-102` | **HARD-CODE 20 số** trong `calculatePersonalIncomeTax()` | **`taxBrackets Json @db.JsonB`** (`schema.prisma:530`) | Luật Thuế TNCN |
| 20 | Ngày công chuẩn | `26.0` | `:267` | **HARD-CODE** (`const standardWorkDays`) | `workDayMethod` enum `FIXED_26` (`:502`) | Nội quy DN |
| 21 | Giờ chuẩn/ngày | `8.0` | `:407` (và `:447`) | **HARD-CODE inline** | `standardHoursPerDay` (`:505`, `8.0`) | BLLĐ 2019 Đ105 |

**Số liệu đáng chú ý**: **18/21** hằng số đã có sẵn trường cấu hình tương ứng trong `GeneralSetting` (`schema.prisma:500-535`), kèm `GeneralSettingsService` + 3 endpoint quản trị (`src/hr/settings/general-settings.controller.ts:23,33,40`) và seed (`prisma/seed.ts:53-95`). **Hạ tầng cấu hình đã hoàn chỉnh, engine chỉ đơn giản là không đọc nó.** Chỉ 3 hằng số chưa có trường: trần ăn trưa `730.000`, ngưỡng `2.000.000`, thuế suất `10%`.

### 4.2. Đánh giá rủi ro

| Rủi ro | Mô tả | Xác suất | Tác động | Mức |
|---|---|:---:|:---:|:---:|
| **R1 — Đổi luật phải sửa code + redeploy** | Lương cơ sở đã đổi 4 lần trong 7 năm (1.21tr → 1.3 → 1.39 → 1.49 → 1.8 → 2.34tr). Mỗi lần đổi: sửa 2 hằng số dẫn xuất, build, test 414 ca, redeploy, downtime | **Cao** (≈1 lần/12-18 tháng) | Không tính được lương đúng hạn nếu chưa kịp release | 🔴 |
| **R2 — Giao diện cấu hình LỪA DỐI người dùng** | Kế toán vào màn Thiết lập chung sửa `baseSalary` = 2.600.000 → lưu DB thành công → bảng lương **vẫn tính theo 46.8tr cũ**. Không có cảnh báo, không có log | **Rất cao** (xảy ra ngay lần đầu ai đó dùng màn hình này) | Sai số bảo hiểm hàng loạt, phát hiện muộn ở khâu đối soát BHXH | 🔴 |
| **R3 — Số dẫn xuất mất dấu vết** | Code chỉ có `46_800_000`, không có `2.340.000 × 20`. Khi lương cơ sở đổi, dev phải tự nhớ hệ số 20 và tự nhân | **Cao** | Nhân sai hệ số → sai trần → sai toàn bộ nhân sự lương cao | 🟡 |
| **R4 — Không có hiệu lực theo thời gian** | Tính lại kỳ tháng 5/2024 (lương cơ sở 1.8tr) **sau** khi luật đổi sẽ dùng trần 46.8tr — sai hồi tố. Snapshot bảo vệ kỳ đã `LOCKED`, nhưng kỳ `DRAFT` bị tính lại thì sai | Trung bình | Sai số liệu quyết toán thuế/BHXH năm cũ | 🟡 |
| **R5 — `taxBrackets` JSONB chết** | Trường `Json @db.JsonB` đã seed dữ liệu nhưng không nơi nào đọc → dữ liệu rác, tạo ảo giác "biểu thuế đã cấu hình được" | Cao | Nhầm lẫn vận hành | 🟡 |
| **R6 — `E-pay-003` là kiểm tra rỗng** | `E-pay-003` (*"Cấu hình thiết lập chung không hợp lệ"*) chỉ bắt giá trị âm của các trường **không được dùng**. Cấu hình sai kiểu `baseSalary = 1` vẫn qua, mà có chặn cũng vô nghĩa vì engine không đọc | Cao | Mã lỗi tồn tại hình thức, không bảo vệ gì | 🟡 |

### 4.3. Đề xuất cấu hình hóa (3 giai đoạn, không over-engineering)

**Giai đoạn 1 — Gom hằng số về 1 nơi (0.5 ngày, rủi ro ~0, làm ngay)**
Tách file `Backend/src/hr/payroll/calculation/payroll-legal-constants.ts` chứa toàn bộ 21 hằng số dưới dạng `export const` có tên nghiệp vụ, kèm **công thức dẫn xuất tường minh** và trích dẫn văn bản luật:
```ts
export const BASE_SALARY = 2_340_000;                      // NĐ 73/2024
export const REGION_MIN_SALARY_ZONE_1 = 4_960_000;         // NĐ 74/2024
export const INSURANCE_CAP_MULTIPLIER = 20;                // Luật BHXH
export const CAP_BHXH_BHYT = BASE_SALARY * INSURANCE_CAP_MULTIPLIER;      // 46_800_000
export const CAP_BHTN = REGION_MIN_SALARY_ZONE_1 * INSURANCE_CAP_MULTIPLIER; // 99_200_000
```
Giải quyết R3 ngay. Không đổi hành vi → không rủi ro hồi quy. Thêm 1 unit test khóa cứng `CAP_BHXH_BHYT === 46_800_000` để mọi thay đổi phải cố ý.

**Giai đoạn 2 — Đọc `GeneralSetting` thật (2-3 ngày, khuyến nghị làm trước khi go-live)**
1. Thêm 3 trường còn thiếu vào `GeneralSetting`: `lunchAllowanceTaxExemptCap Int @default(730000)`, `withholdingTaxThreshold Int @default(2000000)`, `withholdingTaxPercent Float @default(10.0)`.
2. Đầu `calculatePeriodPayroll`, load 1 lần thành một object `PayrollLegalConfig` (dùng file Giai đoạn 1 làm **fallback mặc định** khi thiếu bản ghi):
```ts
const cfg = await this.loadLegalConfig();   // GeneralSetting → merge default
const CAP_BHXH_BHYT = cfg.baseSalary * cfg.insuranceCapMultiplier;
```
3. Thay 21 điểm hard-code bằng `cfg.*`. Bộ 414 test hiện có là lưới an toàn — nếu giá trị mặc định của `GeneralSetting` khớp hằng số cũ (đã kiểm: khớp 18/18), test phải xanh nguyên.
4. Nâng `E-pay-003` thành kiểm tra có nghĩa: tỷ lệ ∈ [0,100], `baseSalary > 0`, `taxBrackets` parse được và đủ 7 bậc tăng dần.
Giải quyết R1, R2, R5, R6.

**Giai đoạn 3 — Hiệu lực theo thời gian (chỉ làm khi có yêu cầu tính lại kỳ cũ, ~1 tuần)**
Chuyển `GeneralSetting` singleton thành bảng có `effectiveFrom`/`effectiveTo`, engine chọn bản ghi hiệu lực tại `period.startDate`. Giải quyết R4.
**Trade-off**: tăng độ phức tạp truy vấn + màn hình quản trị phải có khái niệm "phiên bản cấu hình". **Chưa nên làm ngay** — snapshot 2 tầng (`payroll_sheet_item_breakdowns`) đã bảo toàn số liệu kỳ đã `LOCKED`, nên rủi ro R4 chỉ hiện thực khi ai đó reopen kỳ cũ sau khi luật đổi. Ghi nhận vào Technical Debt, kích hoạt khi nghiệp vụ thực sự cần.

---

## 5. Danh Sách Sửa Đổi Đề Xuất (KHÔNG tự áp dụng — chờ main thread duyệt)

> Báo cáo này **không** chỉnh sửa `api-contract.md`, `data-model.md`, `payroll-erd.md`, `CONTEXT_SUMMARY.md` hay bất kỳ mã nguồn nào. Dưới đây là kiến nghị để chủ trì phê duyệt.

### 5.1. Đề xuất cho `docs/payroll/architecture/api-contract.md`

| # | Mục | Sửa đổi đề xuất | Lý do (drift) |
|:--:|---|---|:---:|
| D1 | Mục 1.1 | Bỏ *"Base URL Prefix: `/api/v1`"*, thay bằng *"Không có global prefix (`main.ts` không gọi `setGlobalPrefix`); Swagger ở `/api/docs`, chỉ bật ngoài production"* | #A-3 |
| D2 | Mục 2 + 3.6-3.10 | Đổi **5** path `/payroll/periods/:id/*` → `/payroll-periods/:id/*` | #A-1 |
| D3 | Mục 2 + 3.11 | **Xóa hoặc đánh dấu `NOT IMPLEMENTED`** endpoint `GET /payroll/export-excel` + `ExportPayrollExcelQueryDto` + enum `PayrollExportType`; nếu vẫn cần thì mở Issue triển khai | #A-2 |
| D4 | Mục 2 (bảng mới) | **Bổ sung 7 endpoint** `payroll-periods` chưa đặc tả, tối thiểu là `submit` + `reject` (2 chuyển trạng thái bắt buộc của state machine) | #A-4 |
| D5 | Mục 1.3 + 3.1/3.2/3.7/3.11 | Thay toàn bộ ví dụ `class-validator` bằng **Zod schema thật** (`PayrollZodValidationPipe`); ghi rõ 3 endpoint GET hiện **không validate UUID** — hoặc mở Issue thêm validation | Drift DTO |
| D6 | Mục 3.7 | Ghi đúng ràng buộc thật: `reason` chỉ có `.min(20)`, **không có `.max(500)`** — hoặc mở Issue thêm `.max(500)` | Drift DTO |
| D7 | Mục 1.5 | Ghi thực trạng envelope **không đồng nhất** (bảng ở Mục 1.3 báo cáo này) — hoặc mở Issue chuẩn hóa qua interceptor toàn cục | #A-5 |
| D8 | Mục 3.2 | Bỏ câu *"kèm thông tin tổng hợp quỹ lương của kỳ"* (code không có), hoặc mở Issue bổ sung | #A-5 |
| D9 | Mục 3.3 | Bỏ vế *"hoặc không khớp với `periodId`"* trong điều kiện `E-pay-004` | #A-6 |
| D10 | Mục 5 | Sửa ô `POST .../reopen` cột `APPROVED`: code **không chặn** `APPROVED` — hoặc (khuyến nghị) mở Issue chặn tại `payroll-periods.service.ts:286` | #A-8 |
| D11 | Mục 5 | Sửa ô `GET /payroll/sheet-lines` ở `DRAFT`/`PENDING_REVIEW`: không phải *"đọc nháp"* mà là **trả mảng rỗng** | #A-8 |
| D12 | Mục 5 | Thêm ghi chú: `@Roles` của `reopen` hiện là `ADMIN, HR, ACCOUNTANT`, việc chặn nằm ở service — hoặc (khuyến nghị) mở Issue siết `@Roles(Role.ADMIN)` tại `payroll-periods.controller.ts:92` | #A-7 |

### 5.2. Đề xuất cho `docs/payroll/architecture/data-model.md`

| # | Mục | Sửa đổi đề xuất | Lý do |
|:--:|---|---|:---:|
| D13 | Mục 3 (toàn bộ khối DDL) | **Viết lại tên cột theo camelCase có nháy kép** (`"fixedAllowanceSalary"`, `"periodId"`, `"netTakeHomeSalary"`...) đúng như Prisma sinh — DDL hiện tại chạy sẽ lỗi `column does not exist` | Mục 2.3 |
| D14 | Mục 3 | **Đánh dấu rõ 28 CHECK constraint là "CHƯA TRIỂN KHAI"**, hoặc mở migration bổ sung. Doc đang mô tả trạng thái DB **không có thật** | Mục 2.3 🔴 |
| D15 | Mục 3, dòng 323-325 | Giữ ghi chú *"net_take_home_salary KHÔNG CHECK >= 0"* nhưng đổi tên cột thành `"netTakeHomeSalary"` và bổ sung: *"hiện toàn bộ CHECK chưa tồn tại — bất biến này chưa được DB bảo vệ có chủ đích"* | Mục 2.3 |
| D16 | Mục 5 | Thay tên index tự đặt (`idx_psib_*`) bằng tên Prisma thật (`payroll_sheet_item_breakdowns_sheetLineId_idx`...) để DBA `EXPLAIN` đối chiếu được; bổ sung index thứ 4 `[periodId, employeeId]` vào bảng 5 pattern | Mục 2.4 |
| D17 | Mục 1 + 2.2, cột `insuranceAmount` | Thống nhất ngữ nghĩa với `payroll-erd.md`: là **"số tiền làm căn cứ đóng BHXH"** (đúng code `:396`), không phải *"số tiền đóng BHXH thực tế"* | Mục 2.2 |

### 5.3. Đề xuất cho các file khác (ngoài 2 file main thread duyệt)

| # | File | Sửa đổi đề xuất | Lý do |
|:--:|---|---|:---:|
| D18 | `CONTEXT_SUMMARY.md:172` | Sửa mô tả model breakdown: `sheetLineId` (không phải `payrollSheetLineId`), `itemCategory` (không phải `itemType`), `configuredAmount`+`calculatedAmount` (không phải `amount`), `isTaxable`/`taxableAmount`/`taxExemptAmount` (không phải `taxTreatment`), bỏ `calculationMethod`, bổ sung `workDaysRatio`/`isSocialInsurance`/`insuranceAmount` | Mục 2.2 |
| D19 | `CONTEXT_SUMMARY.md:5, 115, 150-152, 161-162, 277` | **Hạ trạng thái** từ 🟢 *"Completed & Signed Off / 100% khớp nối"* xuống ⚠️ *"Signed off with drift — cần đối soát lại"*; đặc biệt dòng 150 (*"Khớp 100% giữa ERD và Prisma Schema; DDL Check constraints chặt chẽ"*) và dòng 151 (*"11 Endpoints ... PASS"*) hiện **không đúng** | Mục 1, 2.3 |
| D20 | `payroll-erd.md:94` | `enum itemCategory` → `varchar_50 itemCategory` (schema là `String @db.VarChar(50)`) | Mục 2.2 |
| D21 | `payroll-erd.md:115-181` (Data Dictionary) | Đổi tên cột sang camelCase thật; đánh dấu cột `CHECK >= 0` là **chưa triển khai** | Mục 2.3 |
| D22 | `payroll-erd.md:193-196` | Bổ sung index thứ 4 `@@index([sheetLineId, salaryItemId])` | Mục 2.2 |
| D23 | `ADR-001` Mục 4.2 | Ghi nhận **chưa thực hiện** việc tách 6 private methods (hiện là 1 hàm 719 dòng), hoặc mở Issue refactor | #C-0 |

### 5.4. Bug/Issue mã nguồn đề xuất mở (KHÔNG sửa trong đợt này)

| ID đề xuất | Mô tả | file:line | Mức |
|---|---|---|:---:|
| **BUG-PAY-03** | Stage 1 đọc `calculationMethod` — trường **không tồn tại** trên `EmployeeSalaryItem`. `BR-pay-001` chạy bằng heuristic tên `"điện thoại"`. Cần bổ sung cột `calculationMethod` vào `EmployeeSalaryItem` (hoặc join `SalaryStructureItem`) rồi đọc thật. Test `pipeline.spec.ts:100,111,122,706,756,809` phải sửa mock theo schema thật | `payroll-calculation.service.ts:350-370` | 🔴 |
| **BUG-PAY-04** | Stage 2 đọc `actualHours`/`otRate`/`totalAmount` — **không tồn tại** trên `OvertimeRecord` (thật: `hours`/`ratePercent`/`convertedHours`). Hệ quả `otTaxExemptAmount` **luôn = 0** ở production → `BR-pay-004` bất hoạt. Test `pipeline.spec.ts:201-218,287-289,497-500` mock sai schema | `payroll-calculation.service.ts:416-452` | 🔴 |
| **BUG-PAY-05** | 28 CHECK constraint tài chính chưa từng được tạo trong DB | `migrations/20260906202000_*/migration.sql` | 🔴 |
| **BUG-PAY-06** | `GET /payroll/export-excel` (endpoint #11 của contract) chưa triển khai | — | 🔴 |
| **BUG-PAY-07** | `reopen()` không chặn trạng thái `APPROVED` (chỉ chặn `PAID`/`ARCHIVED`), trái ma trận RBAC | `payroll-periods.service.ts:286-295` | 🟡 |
| **BUG-PAY-08** | 21 hằng số pháp lý hard-code trong khi `GeneralSetting` đã có 18 trường tương ứng nhưng không được đọc; màn hình cấu hình không có tác dụng | `payroll-calculation.service.ts:88-102,267-270,654-678,696,737-744` | 🔴 |
| **BUG-PAY-09** | Stage 5 thiếu điều kiện "HĐ dưới 3 tháng" cho khấu trừ 10% (`BR-pay-005`) | `payroll-calculation.service.ts:732-735` | 🟡 |
| **BUG-PAY-10** | `proratedWorkSalary` thiếu kẹp `min(1.0, ratio)` → vượt lương HĐ khi công > 26 | `payroll-calculation.service.ts:307-310` | 🟡 |
| **ISSUE-PAY-04** | 3 endpoint GET không validate UUID `periodId`; `keyword` không giới hạn độ dài; `reason` thiếu `.max(500)` | `payroll-calculation.controller.ts:31,84-86`; `reopen-period.dto.ts:6` | 🟡 |
| **ISSUE-PAY-05** | Envelope response không đồng nhất (5 dạng khác nhau) — cân nhắc interceptor toàn cục | Mục 1.3 báo cáo này | 🟡 |
| **ISSUE-PAY-06** | Chọn hợp đồng bằng `orderBy effectiveFrom desc take 1`, không lọc theo khoảng kỳ lương | `payroll-calculation.service.ts:168-171` | 🟡 |
| **ISSUE-PAY-07** | `E-pay-007` (checksum snapshot) định nghĩa nhưng **không nơi nào throw** — cùng nội dung `ISSUE-PAY-01` đã ghi nhận | `common/payroll-errors.ts:49` (chỉ khai báo) | 🟢 |

---

## 6. Ghi Chú Phương Pháp & Giới Hạn

- Báo cáo dựa trên **đọc tĩnh mã nguồn + schema + migration**, không chạy lại test/lint/build (đã nhận ground truth từ chủ trì) và **không kết nối database thật** để `\d payroll_sheet_lines`. Kết luận "0 CHECK constraint" suy ra từ việc quét toàn bộ thư mục `prisma/migrations/` (chỉ 2 file chạm bảng payroll, 16 CHECK đều thuộc bảng đầu vào). Nếu môi trường có constraint thêm tay ngoài migration thì cần xác minh lại bằng `psql`.
- Các suy diễn hành vi production ở #C-1 và #C-3 dựa trên đối chiếu trường được đọc trong code với cột thật trong `schema.prisma`, cộng ngữ nghĩa Prisma Client (chỉ trả về cột đã khai báo). Đề nghị xác nhận cuối bằng 1 integration test chạm DB thật với 1 bản ghi `OvertimeRecord` và 1 `EmployeeSalaryItem` — sẽ cho bằng chứng runtime dứt điểm.
- **Không sửa mã nguồn production, không sửa test, không sửa `api-contract.md` / `data-model.md`** trong đợt rà soát này.

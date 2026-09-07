---
type: api-contract
feature: payroll
status: approved
updated: 2026-09-06
author: Solution-Architect-Agent
links:
  - docs/payroll/srs/payroll-spec.md
  - docs/payroll/srs/payroll-flows.md
  - docs/payroll/srs/payroll-states.md
  - docs/payroll/architecture/data-model.md
  - docs/payroll/architecture/adr/ADR-001-payroll-calculation-engine-and-granular-breakdown.md
  - docs/payroll/architecture/architecture-verification-2026-09-06.md
---

# Payroll Module — Hợp Đồng API: Bảng Lương & Bộ Tính Toán Lương (Payroll API Contract)

Hợp đồng giao tiếp RESTful cho phân hệ **Bảng lương & Bộ tính toán lương (`payroll`)**: **61 endpoint / 12 controller** dưới `Backend/src/hr/payroll/`, kèm ma trận phân quyền RBAC theo trạng thái kỳ lương và ma trận ánh xạ 10 mã lỗi nghiệp vụ (`E-pay-001` .. `E-pay-010`) sang HTTP Status Code.

> ## 🔄 Bản sửa đổi 2026-09-06 — đối chiếu lại với mã nguồn
>
> Bản trước của tài liệu này đặc tả **11 endpoint**, trong đó **6 điểm không khớp mã nguồn**. Frontend triển khai theo bản cũ sẽ nhận `404` trên toàn bộ nhóm hành động vòng đời kỳ lương. Danh mục đã sửa:
>
> | # | Bản cũ ghi | Thực tế trong mã nguồn |
> |:---:|---|---|
> | 1 | Base URL `/api/v1` | **Không có tiền tố** — `main.ts` không gọi `setGlobalPrefix` |
> | 2 | `POST /payroll/periods/:id/{lock,reopen,approve,mark-paid,archive}` | `@Controller('payroll-periods')` → **`/payroll-periods/:id/...`** (dấu `-`, không phải `/`) |
> | 3 | `GET /payroll/export-excel` (xuất bảng lương 18 cột) | **Chưa được hiện thực.** Excel chỉ phục vụ 8 module đầu vào qua `/payroll-data/:module/export-excel` |
> | 4 | Thiếu `submit` và `reject` | Có thật — là **2/8 chuyển trạng thái bắt buộc** của state machine |
> | 5 | Request DTO dùng `class-validator` | Dự án dùng **Zod** (`PayrollZodValidationPipe`) |
> | 6 | Envelope lỗi `{ success, errorCode, message, details, timestamp, path }` | Thực tế là **`{ error: { code, message, fields? } }`** |
>
> Ngoài ra bản cũ chỉ liệt kê 11/61 endpoint — thiếu toàn bộ nhóm **danh mục** (16), **dữ liệu đầu vào 8 phân hệ** (25) và **Excel** (3).

---

## 1. Tiêu Chuẩn Kiến Trúc & Quy Ước Chung

### 1.1. Base URL & Xác thực

1. **Base URL**: `http://localhost:8000` (dev) · `https://hrm-accounting.onrender.com` (prod).
   **KHÔNG có tiền tố `/api/v1`** — `Backend/src/main.ts` không gọi `setGlobalPrefix`. Mọi path dưới đây là path tuyệt đối.
2. **Authentication**: JWT Bearer bắt buộc cho **tất cả** endpoint.
   ```http
   Authorization: Bearer <access_token>
   ```
3. **Guard toàn cục**: `JwtAuthGuard → RolesGuard` đăng ký ở `app.module.ts:51-53`.
   `RolesGuard` **đọc role mới nhất từ DB**, không tin claim `role` trong JWT — thu hồi quyền có hiệu lực ngay, không cần chờ token hết hạn.
4. **Principal gắn vào request** (`RequestUser`, `common/decorators/current-user.decorator.ts`):
   ```typescript
   interface RequestUser { userId: string; sessionId: string; role: Role; }
   ```
   > ⚠️ Principal **không có** `id` và **không có** `email`. Controller phải dùng `req.user.userId`. Việc đọc nhầm `req.user.id` / `req.user.email` từng gây 2 lỗi nghiêm trọng (`BLK-PAY-02` rò rỉ phiếu lương, `BLK-PAY-07` mất dấu vết kiểm toán).

### 1.2. Validation

Dự án dùng **Zod** qua `PayrollZodValidationPipe`, **không dùng `class-validator`**.

```typescript
// Ví dụ thật: Backend/src/hr/payroll/periods/dto/reopen-period.dto.ts
export const reopenPayrollPeriodSchema = z.object({
  reason: z.string().min(20, { message: 'Lý do mở lại phải có ít nhất 20 ký tự giải trình' }),
});
export type ReopenPayrollPeriodDto = z.infer<typeof reopenPayrollPeriodSchema>;
```

> **Nợ kỹ thuật đã ghi nhận**: 3 endpoint `GET` của nhóm tính toán nhận `@Query()` trần **không validate định dạng UUID**; `reason` chỉ có `.min(20)` mà **thiếu `.max(500)`** như đặc tả nghiệp vụ yêu cầu.

### 1.3. Định dạng dữ liệu

- `Content-Type: application/json; charset=utf-8`, trừ endpoint Excel trả `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- **Tiền tệ**: số nguyên VNĐ (`INTEGER`), làm tròn `Math.round()` (`ROUND_HALF_UP`), không lưu thập phân.
- **Ngày công / giờ**: `Decimal(4,2)` — ví dụ `26.00` ngày, `12.50` giờ OT.

### 1.4. Envelope phản hồi — trạng thái thực tế

> ⚠️ **Hệ thống hiện có 3 dạng envelope khác nhau**, không thống nhất. Tài liệu ghi đúng hiện trạng để frontend không code sai; việc chuẩn hoá về một dạng đã ghi vào backlog (`ISSUE-PAY-09`).

| Dạng | Endpoint áp dụng | Hình dạng |
|:---:|---|---|
| **A** — bọc `data` | `/payroll/calculate`, `/payroll/sheet-lines/:id`, `/payroll/support-allowances`, `/payroll/payslips/my` | `{ "success": true, "data": { ... } }` |
| **B** — object phẳng | `/payroll-periods/:id/lock`, `/payroll-periods/:id/reopen` | `{ "success": true, "periodId": "...", "status": "LOCKED", ... }` |
| **C** — entity/mảng trần | `/payroll/sheet-lines`, toàn bộ `/payroll-periods` CRUD, `approve`, `mark-paid`, `archive`, nhóm danh mục, nhóm dữ liệu đầu vào | `[ { ... } ]` hoặc `{ ... }` — **không có lớp bọc** |

**Envelope lỗi (thống nhất, do `HttpExceptionFilter` sinh ra)**:

```json
{
  "error": {
    "code": "E-pay-008",
    "message": "Chỉ Quản trị viên (ADMIN) mới có quyền mở lại kỳ lương",
    "fields": { }
  }
}
```

---

## 2. Danh Mục 61 Endpoint

| Nhóm | Prefix | Số route | Controller |
|---|---|:---:|---|
| 1. Tính toán & bảng lương | `/payroll` | 5 | `calculation/payroll-calculation.controller.ts` |
| 2. Vòng đời kỳ lương | `/payroll-periods` | 12 | `periods/payroll-periods.controller.ts` |
| 3. Danh mục dùng chung | `/payroll-catalogs` | 16 | `catalogs/payroll-catalogs.controller.ts` |
| 4. Dữ liệu đầu vào 8 phân hệ | `/payroll-data/*` | 25 | 8 controller trong `inputs/` |
| 5. Excel (template / import / export) | `/payroll-data/:module/*` | 3 | `excel/payroll-excel.controller.ts` |
| | | **61** | **12 controller** |

### 2.1. Nhóm 1 — Tính toán & bảng lương (`/payroll`)

| # | Method | Path | Query / Param | Vai trò | Trạng thái kỳ cho phép |
|:---:|:---:|---|---|---|---|
| 1 | `GET` | `/payroll/calculate` | `periodId` (bắt buộc) | ADMIN, HR, ACCOUNTANT | `DRAFT`, `PENDING_REVIEW` |
| 2 | `GET` | `/payroll/sheet-lines` | `periodId`, `departmentId?`, `keyword?` | ADMIN, HR, ACCOUNTANT | Mọi trạng thái (đọc snapshot DB) |
| 3 | `GET` | `/payroll/sheet-lines/:id` | `id` = ID dòng lương | ADMIN, HR, ACCOUNTANT | Mọi trạng thái |
| 4 | `GET` | `/payroll/support-allowances` | `periodId` | ADMIN, HR, ACCOUNTANT | Mọi trạng thái |
| 5 | `GET` | `/payroll/payslips/my` | `periodId` | EMPLOYEE, ADMIN, HR, ACCOUNTANT | `PAID`, `ARCHIVED` (với EMPLOYEE) |

### 2.2. Nhóm 2 — Vòng đời kỳ lương (`/payroll-periods`)

| # | Method | Path | Vai trò | Chuyển trạng thái |
|:---:|:---:|---|---|---|
| 6 | `GET` | `/payroll-periods` (`year?`, `status?`) | ADMIN, HR, ACCOUNTANT | — |
| 7 | `POST` | `/payroll-periods` | ADMIN, HR | tạo mới → `DRAFT` |
| 8 | `GET` | `/payroll-periods/:id` | ADMIN, HR, ACCOUNTANT | — |
| 9 | `PATCH` | `/payroll-periods/:id` | ADMIN, HR | chỉ khi `DRAFT` |
| 10 | `DELETE` | `/payroll-periods/:id` | ADMIN, HR | chỉ khi `DRAFT` |
| 11 | `POST` | `/payroll-periods/:id/submit` | HR, ACCOUNTANT, ADMIN | `DRAFT` → `PENDING_REVIEW` |
| 12 | `POST` | `/payroll-periods/:id/reject` | ADMIN, HR, ACCOUNTANT | `PENDING_REVIEW` → `DRAFT` |
| 13 | `POST` | `/payroll-periods/:id/lock` | ADMIN, ACCOUNTANT | `DRAFT`/`PENDING_REVIEW` → `LOCKED` |
| 14 | `POST` | `/payroll-periods/:id/reopen` | ADMIN, HR, ACCOUNTANT¹ | `LOCKED` → `DRAFT` |
| 15 | `POST` | `/payroll-periods/:id/approve` | **CHỈ ADMIN** | `LOCKED` → `APPROVED` |
| 16 | `POST` | `/payroll-periods/:id/mark-paid` | ADMIN, ACCOUNTANT | `APPROVED` → `PAID` |
| 17 | `POST` | `/payroll-periods/:id/archive` | **CHỈ ADMIN** | `PAID` → `ARCHIVED` |

> ¹ **Guard cố ý mở cho 3 vai trò.** Việc chặn nằm ở tầng service (`payroll-periods.service.ts:270`), ném `E-pay-008` (403) **kèm ghi audit log `PERMISSION_DENIED`**. Nếu chặn ngay ở guard thì response vẫn 403 nhưng **mất dấu vết ai đã thử vượt quyền** — trái yêu cầu kiểm toán của `BR-pay-011`. Đây là thiết kế có chủ đích, không phải lỗ hổng.

### 2.3. Nhóm 3 — Danh mục dùng chung (`/payroll-catalogs`)

4 nhóm danh mục × 4 thao tác CRUD = **16 endpoint**. Mẫu chung:

```
GET    /payroll-catalogs/{resource}          → ADMIN, HR, ACCOUNTANT
POST   /payroll-catalogs/{resource}          → xem cột "Vai trò ghi"
PATCH  /payroll-catalogs/{resource}/:id      → xem cột "Vai trò ghi"
DELETE /payroll-catalogs/{resource}/:id      → xem cột "Vai trò ghi"
```

| `{resource}` | Nghiệp vụ | Vai trò ghi |
|---|---|---|
| `kpi-items` | Danh mục chỉ tiêu KPI | ADMIN, HR |
| `products` | Danh mục sản phẩm (lương sản phẩm / nghiệm thu) | ADMIN, HR |
| `diligence-types` | Danh mục loại chuyên cần & mức phạt | ADMIN, HR |
| `adjustment-items` | Danh mục khoản ứng / bù trừ | ADMIN, HR, **ACCOUNTANT** |

> `adjustment-items` mở quyền ghi cho `ACCOUNTANT` vì khoản tạm ứng và bù trừ do kế toán chủ động khai báo, không qua nhân sự.

### 2.4. Nhóm 4 — Dữ liệu đầu vào 8 phân hệ (`/payroll-data/*`)

Mẫu chung cho 6/8 phân hệ:

```
GET  /payroll-data/{module}              ?periodId=&departmentId=   → ADMIN, HR, ACCOUNTANT
POST /payroll-data/{module}/apply                                    → ADMIN, HR
PUT  /payroll-data/{module}/:employeeId                               → ADMIN, HR
```

| `{module}` | Nghiệp vụ | Route khác mẫu | Tổng |
|---|---|---|:---:|
| `attendance` | Chấm công | `GET /matrix` · `PUT /cell` · `POST /batch-override` | 3 |
| `overtime` | Tăng ca | thêm `DELETE /:employeeId` (`periodId`) | **4** |
| `kpi` | KPI | theo mẫu | 3 |
| `bonus` | Thưởng | theo mẫu | 3 |
| `piecework` | Lương sản phẩm | theo mẫu | 3 |
| `commission` | Lương hoa hồng / phần trăm | theo mẫu | 3 |
| `diligence` | Chuyên cần | `POST /record` · `DELETE /:id` | 3 |
| `adjustments` | Ứng / bù trừ | theo mẫu, nhưng **cả 3 route** mở cho **ACCOUNTANT** | 3 |
| | | | **25** |

**Bất biến chung**: mọi thao tác ghi đều đi qua `PayrollPeriodLockGuard` — kỳ lương đã `LOCKED` trở lên thì bị chặn với `E-dltl-001` (`BR-pay-010`).

### 2.5. Nhóm 5 — Excel (`/payroll-data/:module/*`)

| # | Method | Path | Vai trò | Mục đích |
|:---:|:---:|---|---|---|
| 59 | `GET` | `/payroll-data/:module/template` | ADMIN, HR, ACCOUNTANT | Tải file mẫu nhập liệu |
| 60 | `POST` | `/payroll-data/:module/import-excel` | ADMIN, HR, ACCOUNTANT | Nhập dữ liệu, **upload nguyên tử** |
| 61 | `GET` | `/payroll-data/:module/export-excel` | ADMIN, HR, ACCOUNTANT | Xuất dữ liệu phân hệ ra `.xlsx` |

`:module` ∈ `attendance` · `overtime` · `kpi` · `bonus` · `piecework` · `commission` · `diligence` · `adjustments`
(hằng số `PAYROLL_EXCEL_MODULE_NAMES` trong `payroll-excel.service.ts`).

**Import**: mọi lỗi validate (nhân viên không tồn tại/đã nghỉ, mã danh mục sai, trùng lặp, sai định dạng) gộp chung dưới một envelope `E-dltl-024` kèm mảng `details[]`; **không có lỗi con nào thoát khỏi transaction** — hoặc nhập trọn vẹn, hoặc rollback toàn bộ.

---

## 3. Đặc Tả Chi Tiết Các Endpoint Cốt Lõi

### 3.1. `GET /payroll/calculate` — Tính toán xem trước bảng lương động

Chạy Động cơ tính lương (Pipeline 6 Stages, `ADR-001`) thời gian thực trên dữ liệu 8 phân hệ nguồn. **Không ghi database**, chỉ trả kết quả tính động kèm breakdown cấu phần.

- **Query**: `periodId` (bắt buộc, UUID).
- **Guard nghiệp vụ**: kỳ đã `LOCKED` / `APPROVED` / `PAID` / `ARCHIVED` → `E-pay-002`.
- **Tham số pháp lý**: engine tra theo **`PayrollPeriod.endDate`** (`BR-pay-012`), không theo ngày hệ thống — nên tính lại kỳ cũ vẫn ra đúng số của thời điểm đó.
- **Response 200** (envelope dạng **A**):

```json
{
  "success": true,
  "data": {
    "periodId": "123e4567-e89b-12d3-a456-426614174000",
    "periodCode": "2026-08",
    "totalEmployees": 50,
    "summary": {
      "totalGrossIncome": 1250000000,
      "totalEmployeeInsurance": 131250000,
      "totalCompanyInsurance": 268750000,
      "totalPersonalIncomeTax": 45600000,
      "totalNetTakeHome": 1055150000,
      "totalCompanyCost": 1543750000
    },
    "lines": [
      {
        "employeeId": "e1111111-e89b-12d3-a456-426614174001",
        "employeeCode": "NV001",
        "fullName": "Nguyễn Văn A",
        "departmentName": "Phòng Kỹ thuật",
        "positionName": "Lập trình viên Senior",
        "contractType": "LABOR_CONTRACT",
        "salaryType": "GROSS",
        "dependentCount": 1,
        "baseSalaryMonthly": 25000000,
        "standardWorkDays": 26.0,
        "actualWorkDays": 26.0,
        "otConvertedHours": 10.0,
        "proratedWorkSalary": 25000000,
        "otAmount": 1802885,
        "otTaxExemptAmount": 601085,
        "pieceworkSalary": 0,
        "bonusSalary": 2000000,
        "kpiSalary": 3000000,
        "commissionSalary": 0,
        "diligenceSalary": 500000,
        "fixedAllowanceSalary": 2000000,
        "lunchTaxExemptAmount": 1200000,
        "otherTaxExemptAmount": 500000,
        "grossIncome": 34302885,
        "insuranceSalaryBase": 25000000,
        "taxableIncome": 32001800,
        "employeeInsuranceDeduction": 2625000,
        "companyInsuranceExpense": 5375000,
        "employeeUnionFee": 125000,
        "companyUnionExpense": 500000,
        "personalIncomeTax": 1420180,
        "adjustmentNetAmount": 0,
        "netTakeHomeSalary": 30132705,
        "totalCompanyCost": 40177885,
        "breakdowns": [ { "...": "xem 3.3" } ]
      }
    ]
  }
}
```

- **Error**: `E-pay-002` (400) · `E-pay-003` (400) · `E-pay-005` (400).

---

### 3.2. `GET /payroll/sheet-lines` — Bảng lương snapshot 18 cột

Đọc trực tiếp `payroll_sheet_lines`.

- **Query**: `periodId` (bắt buộc) · `departmentId?` · `keyword?` (tìm theo mã hoặc họ tên, `contains` + `insensitive`).
- **Response 200**: **mảng `PayrollSheetLine[]` trần** (envelope dạng **C** — không có lớp bọc `data`), sắp xếp `employeeCode: 'asc'`.

> **Nợ kỹ thuật**: endpoint **không phân trang**. Với quy mô > 5.000 nhân viên cần bổ sung `take`/`skip` (`ISSUE-PAY-10`).

---

### 3.3. `GET /payroll/sheet-lines/:id` — Chi tiết một dòng lương kèm breakdowns

- **Path**: `id` = ID của bản ghi `payroll_sheet_lines`.
- **Response 200** (envelope dạng **A**):

```json
{
  "success": true,
  "data": {
    "id": "line-uuid-1234",
    "periodId": "period-uuid-5678",
    "employeeCode": "NV001",
    "fullName": "Nguyễn Văn A",
    "grossIncome": 34302885,
    "netTakeHomeSalary": 30132705,
    "breakdowns": [
      {
        "id": "breakdown-uuid-001",
        "salaryItemId": "si-uuid-KL02",
        "itemCode": "KL02",
        "itemName": "Phụ cấp trách nhiệm",
        "itemCategory": "FIXED_ALLOWANCE",
        "configuredAmount": 2000000,
        "workDaysRatio": 1.0,
        "calculatedAmount": 2000000,
        "isTaxable": true,
        "taxableAmount": 2000000,
        "taxExemptAmount": 0,
        "isSocialInsurance": true,
        "insuranceAmount": 2000000,
        "note": "Tính theo ngày công"
      }
    ]
  }
}
```

> **Tên cột tiền trong `payroll_sheet_item_breakdowns` là `configuredAmount` và `calculatedAmount`** — **không có cột `amount`**. Bản tài liệu cũ trong `CONTEXT_SUMMARY.md` ghi sai 5 tên trường; `data-model.md` và `payroll-erd.md` ghi đúng.

- **Error**: `E-pay-004` (404).

> **Nợ kỹ thuật**: endpoint **không đối chiếu `periodId`**, nên biết ID dòng là đọc được bất kể kỳ nào (`ISSUE-PAY-11`).

---

### 3.4. `GET /payroll/support-allowances` — Ma trận bóc tách lương hỗ trợ (`luong-ho-tro`)

Dữ liệu cho tab **Lương hỗ trợ**: từng khoản phụ cấp/phúc lợi quy đổi theo ngày công thực tế (`BR-pay-001`, `BR-pay-003`).

- **Query**: `periodId` (bắt buộc).
- **Response 200** (envelope dạng **A**): `{ periodId, categories[], rows[] }`.
  - `categories[].taxExemptLimit` — trần miễn thuế của khoản, lấy theo **tham số pháp lý của kỳ** (`BR-pay-012`); khoản không phải ăn ca thì bằng `0`.
- **Error**: `E-dltl-025` (thiếu `periodId`) · `E-pay-005`.

> **Nợ kỹ thuật `ISSUE-PAY-03`**: ở kỳ `DRAFT` chưa có nhân viên đủ điều kiện, endpoint ném `E-pay-005` (400) thay vì trả danh sách rỗng → giao diện hiện cảnh báo đỏ không cần thiết.

---

### 3.5. `GET /payroll/payslips/my` — Phiếu lương điện tử cá nhân

- **Query**: `periodId` (bắt buộc).
- **Xác định người gọi** 🔄: qua **`Employee.userId`** (khoá ngoại unique tới `User`), tra bằng `req.user.userId`.
  > Bản cũ tra theo `Employee.email` lấy từ `req.user.email` — trường **không tồn tại** trong principal. Prisma loại bỏ điều kiện `undefined` khỏi `WHERE`, khiến `findFirst()` trả về **nhân viên đầu bảng**: bất kỳ ai gọi cũng đọc được phiếu lương người khác (`BLK-PAY-02`, IDOR). `Employee.email` cũng **không unique** và không phải định danh đăng nhập (`BR-hr-010`).
- **Fail-closed**: tài khoản chưa liên kết hồ sơ nhân sự → `404 Không tìm thấy thông tin nhân sự của tài khoản này`, **không** rơi về bất kỳ nhân viên nào khác.
- **Ràng buộc trạng thái**: vai trò `EMPLOYEE` chỉ xem được khi kỳ ở `PAID` hoặc `ARCHIVED`; ngược lại `403 Phiếu lương chưa được phát hành cho kỳ này`. `ADMIN` / `HR` / `ACCOUNTANT` xem được ở mọi trạng thái.
- **Response 200** (envelope dạng **A**): dòng lương cá nhân kèm `breakdowns[]`.

---

### 3.6. `POST /payroll-periods/:id/lock` — Khóa sổ & snapshot bất biến đa tầng

- **Body**: rỗng `{}`.
- **Tiền đề**: kỳ ở `DRAFT` hoặc `PENDING_REVIEW`; vai trò `ACCOUNTANT` hoặc `ADMIN`.
- **Xử lý nguyên tử**:
  1. Chạy tính lại toàn kỳ để lấy số mới nhất. Nếu **0 dòng** → `E-pay-001`.
  2. Mở Prisma Interactive Transaction:
     - **Optimistic concurrency check**: đọc lại trạng thái *bên trong* transaction; nếu đã chuyển sang trạng thái bất biến → `E-pay-006` (409).
     - Xóa snapshot cũ (bảo đảm tính lũy biến).
     - Ghi `payroll_sheet_lines` + `payroll_sheet_item_breakdowns`.
     - Cập nhật `status = LOCKED`, `lockedAt = now()`, `lockedByUserId = req.user.userId`.
- **Response 200** (envelope dạng **B** — object phẳng, **không** bọc `data`):

```json
{
  "success": true,
  "periodId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "LOCKED",
  "lockedAt": "2026-09-06T20:15:00.000Z",
  "lockedByUserId": "user-uuid-accountant",
  "snapshotLinesCount": 50,
  "snapshotBreakdownsCount": 485
}
```

- **Error**: `E-pay-001` (400) · `E-pay-002` (400) · `E-pay-006` (409).

> **Nợ kỹ thuật**: `calculatePeriodPayroll()` chạy **ngoài** transaction khóa sổ; kiểm tra đồng thời là *read-then-check* nên dưới mức cô lập READ COMMITTED vẫn còn khe TOCTOU hẹp. Khuyến nghị chuyển sang `updateMany({ where: { id, status: { in: [...] } } })` rồi kiểm `count === 0` (`ISSUE-PAY-05`).
> `E-pay-007` (checksum snapshot) **đã định nghĩa nhưng chưa được `throw` ở đâu** — mã lỗi chết (`ISSUE-PAY-01`).

---

### 3.7. `POST /payroll-periods/:id/reopen` — Mở lại kỳ lương có kiểm toán

- **Request body**:
  ```json
  { "reason": "Điều chỉnh bổ sung giờ tăng ca ca đêm ngày 28/08 cho bộ phận Kỹ thuật" }
  ```
  Zod: `reason: z.string().min(20)`. *(Chưa có `.max(500)` — nợ kỹ thuật.)*
- **Ràng buộc**:
  - Chỉ `ADMIN` được thực thi; `HR`/`ACCOUNTANT` gọi vào sẽ nhận `E-pay-008` (403) **và bị ghi audit `PERMISSION_DENIED`**.
  - Kỳ phải đang ở `LOCKED`. 🔄 **Chặn cả `APPROVED`**, `PAID`, `ARCHIVED` — bản cũ chỉ chặn `PAID`/`ARCHIVED`, nên kỳ đã được Ban Giám đốc phê duyệt vẫn mở lại được, phá vỡ chốt kiểm soát phê duyệt.
- **Xử lý**: ghi audit `PAYROLL_PERIOD_REOPENED` (kèm `actorId`, `reason`) → transaction xóa sạch snapshot 2 tầng → `status = DRAFT`, `lockedAt = null`, `lockedByUserId = null`.
- **Response 200** (envelope dạng **B**).
- **Error**: `E-pay-008` (403) · `E-pay-009` (400) · `VALIDATION_FAILED` (400) khi kỳ ở trạng thái không cho mở lại.

---

### 3.8. Các chuyển trạng thái còn lại

| Endpoint | Vai trò | Tiền đề | Hành vi |
|---|---|---|---|
| `POST /payroll-periods/:id/submit` | HR, ACCOUNTANT, ADMIN | `DRAFT` | → `PENDING_REVIEW`. Sai trạng thái → `E-dltl-001` |
| `POST /payroll-periods/:id/reject` | ADMIN, HR, ACCOUNTANT | `PENDING_REVIEW` | → `DRAFT` (trả lại C&B chỉnh sửa). Sai trạng thái → `E-dltl-001` |
| `POST /payroll-periods/:id/approve` | **CHỈ ADMIN** | `LOCKED` | → `APPROVED`, `approvedAt = now()`, `approvedByUserId = req.user.userId` |
| `POST /payroll-periods/:id/mark-paid` | ADMIN, ACCOUNTANT | `APPROVED` | → `PAID`, mở quyền xem phiếu lương cá nhân. Sai trạng thái → `E-pay-010` |
| `POST /payroll-periods/:id/archive` | **CHỈ ADMIN** | `PAID` | → `ARCHIVED`, đóng băng vĩnh viễn, cấm mọi sửa đổi kể cả `ADMIN` |

Ba endpoint `approve` / `mark-paid` / `archive` trả **entity `PayrollPeriod` trần** (envelope dạng **C**).

---

## 4. Ma Trận Ánh Xạ 10 Mã Lỗi Nghiệp Vụ (`E-pay-001` .. `E-pay-010`)

Hệ thống dùng lớp biệt lệ `PayrollError` (`Backend/src/common/payroll-errors.ts`), ánh xạ 1-1 sang HTTP Status Code:

| Mã lỗi | HTTP | Thông điệp | Căn cứ | Kích hoạt khi | Trạng thái hiện thực |
|:---:|:---:|---|---|---|:---:|
| **`E-pay-001`** | 400 | `Kỳ lương chưa được tính toán bảng lương` | `BR-pay-010` | Khóa sổ khi kỳ chưa có dòng lương nào | ✅ |
| **`E-pay-002`** | 400 | `Kỳ lương đã khóa sổ, không thể tính toán lại` | `BR-pay-010` | Gọi `/payroll/calculate` trên kỳ `LOCKED`+ | ✅ |
| **`E-pay-003`** | 400 | `Cấu hình thiết lập chung không hợp lệ` | `BR-pay-006` | `GeneralSetting` có tham số âm | ✅ |
| **`E-pay-004`** | 404 | `Không tìm thấy dòng bảng lương của nhân viên trong kỳ` | SRS Mục 6 | `GET /payroll/sheet-lines/:id` không khớp | ✅ (chưa có test) |
| **`E-pay-005`** | 400 | `Không có nhân viên nào đủ điều kiện tính lương trong kỳ` | `BR-dltl-002` | Toàn bộ NV đã chấm dứt HĐ trước kỳ | ✅ |
| **`E-pay-006`** | 409 | `Xung đột khóa sổ: Kỳ lương đang được xử lý đồng thời` | `BR-pay-010` | 2 yêu cầu khóa sổ đồng thời | ✅ |
| **`E-pay-007`** | 400 | `Dữ liệu snapshot bảng lương không khớp tổng kiểm tra` | `BR-pay-010` | Lệch tổng giữa `lines` và `breakdowns` | ⚠️ **Mã lỗi chết — chưa `throw` ở đâu** |
| **`E-pay-008`** | 403 | `Chỉ Quản trị viên (ADMIN) mới có quyền mở lại kỳ lương` | `BR-pay-011` | `HR`/`ACCOUNTANT` gọi `reopen` | ✅ |
| **`E-pay-009`** | 400 | `Lý do mở lại kỳ lương phải có ít nhất 20 ký tự` | `BR-pay-011` | `reason` ngắn hơn 20 ký tự | ✅ |
| **`E-pay-010`** | 400 | `Không thể thanh toán kỳ lương chưa được Ban Giám Đốc phê duyệt` | State Matrix | `mark-paid` khi kỳ chưa `APPROVED` | ✅ |

**Mã lỗi dùng chung từ phân hệ Dữ liệu tính lương**: `E-dltl-001` (kỳ đã khóa, chặn sửa dữ liệu nguồn) · `E-dltl-024` (lỗi nhập Excel, kèm `details[]`) · `E-dltl-025` (không tìm thấy kỳ lương / thiếu `periodId`) · `E-dltl-026` (xung đột đồng thời).

---

## 5. Ma Trận Phân Quyền RBAC Theo Trạng Thái Kỳ Lương

| Endpoint | Vai trò được phép | `DRAFT` | `PENDING_REVIEW` | `LOCKED` | `APPROVED` | `PAID` | `ARCHIVED` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /payroll/calculate` | ADMIN, HR, ACCOUNTANT | ✅ | ✅ | ❌ `E-pay-002` | ❌ | ❌ | ❌ |
| `GET /payroll/sheet-lines` | ADMIN, HR, ACCOUNTANT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /payroll/sheet-lines/:id` | ADMIN, HR, ACCOUNTANT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /payroll/support-allowances` | ADMIN, HR, ACCOUNTANT | ⚠️ `E-pay-005` nếu rỗng | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /payroll/payslips/my` | EMPLOYEE | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ **riêng mình** | ✅ **riêng mình** |
| `GET /payroll/payslips/my` | ADMIN, HR, ACCOUNTANT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /payroll-periods` | ADMIN, HR | — tạo mới | — | — | — | — | — |
| `PATCH` / `DELETE /payroll-periods/:id` | ADMIN, HR | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST /payroll-periods/:id/submit` | HR, ACCOUNTANT, ADMIN | ✅ | ❌ `E-dltl-001` | ❌ | ❌ | ❌ | ❌ |
| `POST /payroll-periods/:id/reject` | ADMIN, HR, ACCOUNTANT | ❌ `E-dltl-001` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /payroll-periods/:id/lock` | ADMIN, ACCOUNTANT | ✅ | ✅ | ❌ `E-pay-006` | ❌ | ❌ | ❌ |
| `POST /payroll-periods/:id/reopen` | **CHỈ ADMIN**¹ | ❌ | ❌ | ✅ **cần lý do ≥ 20 ký tự** | ❌ 🔄 | ❌ | ❌ |
| `POST /payroll-periods/:id/approve` | **CHỈ ADMIN** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `POST /payroll-periods/:id/mark-paid` | ADMIN, ACCOUNTANT | ❌ | ❌ | ❌ `E-pay-010` | ✅ | ❌ | ❌ |
| `POST /payroll-periods/:id/archive` | **CHỈ ADMIN** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ghi dữ liệu 8 phân hệ (`/payroll-data/*`) | ADMIN, HR² | ✅ | ✅ | ❌ `E-dltl-001` | ❌ | ❌ | ❌ |
| `POST /payroll-data/:module/import-excel` | ADMIN, HR, ACCOUNTANT | ✅ | ✅ | ❌ `E-dltl-001` | ❌ | ❌ | ❌ |
| `GET /payroll-data/:module/export-excel` | ADMIN, HR, ACCOUNTANT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ghi danh mục (`/payroll-catalogs/*`) | ADMIN, HR³ | — không phụ thuộc trạng thái kỳ | | | | | |

¹ Guard khai `@Roles(ADMIN, HR, ACCOUNTANT)` để service ném `E-pay-008` kèm audit — xem ghi chú Mục 2.2.
² `adjustments` mở cả `POST /apply` và `PUT /:employeeId` cho `ACCOUNTANT` — khoản tạm ứng và bù trừ do kế toán chủ động khai báo, không qua nhân sự.
³ `adjustment-items` mở thêm cho `ACCOUNTANT`.

---

## 6. Phụ Lục — Khoảng Trống So Với Nghiệp Vụ

### 6.1. Chưa được hiện thực

| Hạng mục | Ảnh hưởng | Ghi chú |
|---|---|---|
| **Xuất Excel bảng lương tổng hợp 18 cột** | 🔴 Cao | `BG-PAY-04` yêu cầu xuất file đối soát đa chiều. Hiện chỉ xuất được **dữ liệu đầu vào** của 8 phân hệ, **không xuất được chính bảng lương**. Bản hợp đồng cũ đặc tả `GET /payroll/export-excel` + enum `PayrollExportType{SHEET_18_COLS, SUPPORT_ALLOWANCES}` — chưa từng tồn tại trong mã nguồn. |
| **Checksum guard `E-pay-007`** | 🟡 Trung bình | Mã lỗi đã định nghĩa nhưng không có điểm `throw` (`ISSUE-PAY-01`). |
| **Phân trang `GET /payroll/sheet-lines`** | 🟡 Trung bình | Rủi ro khi quy mô lớn (`ISSUE-PAY-10`). |
| **Chunking `createMany` snapshot** | 🟡 Trung bình | ~40.000 bản ghi con với 5.000 NV có thể vượt giới hạn tham số của driver PostgreSQL (`ISSUE-PAY-02`). |

### 6.2. Nợ kỹ thuật về chất lượng hợp đồng

1. **Chuẩn hoá envelope** — hiện có 3 dạng (Mục 1.4). Nên thống nhất bằng một `TransformInterceptor` toàn cục.
2. **Validate query params** — 3 endpoint `GET` nhóm tính toán nhận `@Query()` trần, không kiểm định dạng UUID.
3. **`reason` thiếu `.max(500)`** trong `reopenPayrollPeriodSchema`.
4. **`GET /payroll/sheet-lines/:id` không đối chiếu `periodId`**.
5. **Chưa có rate limit riêng** cho các endpoint đọc bảng lương (dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023/NĐ-CP).

### 6.3. Tài liệu liên quan

- Danh mục đầy đủ 18 điểm lệch tài liệu ↔ mã nguồn: [`architecture-verification-2026-09-06.md`](./architecture-verification-2026-09-06.md)
- 24 lỗ hổng nghiệp vụ chưa đặc tả + đề xuất `BR-pay-013`+ và toàn bộ mục NFR: [`../srs/payroll-gap-analysis.md`](../srs/payroll-gap-analysis.md)
- Trạng thái khắc phục 7 lỗi chặn: [`../qa/issues-and-bugs.md`](../qa/issues-and-bugs.md) Mục 0

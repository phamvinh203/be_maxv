---
type: api-contract
feature: hr-salary-settings
status: approved
updated: 2026-09-06
author: Architect-Agent
links:
  - docs/hr/srs/salary-settings-spec.md
  - docs/hr/architecture/adr/ADR-006-salary-settings-and-assignment.md
  - docs/hr/architecture/salary-settings-data-model.md
---

# HR — Hợp đồng API: Cài đặt lương (Salary Settings API Contract)

Tài liệu đặc tả toàn bộ RESTful API endpoints, Request/Response DTOs, Query Parameters, Mã lỗi HTTP và Phân quyền RBAC cho phân hệ **Cài đặt lương**.

---

## 1. Danh sách Endpoints Tổng quan

| Method | Endpoint | Vai trò cho phép | Mục đích |
|---|---|---|---|
| `GET` | `/salary-items` | `ADMIN`, `HR`, `ACCOUNTANT` | Lấy danh sách danh mục khoản lương (lọc `q`, `category`, `status`) |
| `GET` | `/salary-items/count-by-category` | `ADMIN`, `HR`, `ACCOUNTANT` | Đếm số lượng khoản theo từng loại (phục vụ badge UI) |
| `GET` | `/salary-items/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | Chi tiết một khoản lương |
| `POST` | `/salary-items` | `ADMIN`, `HR` | Tạo mới một khoản lương (auto sinh mã `KLxx`) |
| `PATCH` | `/salary-items/:id` | `ADMIN`, `HR` | Sửa thông tin khoản lương |
| `DELETE` | `/salary-items/:id` | `ADMIN`, `HR` | Xóa khoản lương (kiểm tra ràng buộc không dùng) |
| `GET` | `/salary-structures/current` | `ADMIN`, `HR`, `ACCOUNTANT` | Lấy cấu trúc lương khung hiện hành của doanh nghiệp |
| `PUT` | `/salary-structures/current` | `ADMIN`, `HR` | Lưu / Cập nhật cấu trúc lương khung doanh nghiệp |
| `GET` | `/employee-salaries` | `ADMIN`, `HR`, `ACCOUNTANT` | Danh sách nhân viên kèm trạng thái set lương |
| `GET` | `/employee-salaries/counts` | `ADMIN`, `HR`, `ACCOUNTANT` | Đếm số lượng "Đã set lương" vs "Chưa set lương" |
| `GET` | `/employee-salaries/:employeeId` | `ADMIN`, `HR`, `ACCOUNTANT` | Xem chi tiết bảng lương của một nhân viên |
| `PUT` | `/employee-salaries/:employeeId` | `ADMIN`, `HR` | Set lương / Cập nhật mức lương cho một nhân viên |
| `DELETE` | `/employee-salaries/:employeeId` | `ADMIN`, `HR` | Xóa thiết lập lương của nhân viên |
| `POST` | `/employee-salaries/approve` | `ADMIN`, `HR` | Duyệt lương hàng loạt cho các nhân sự chờ duyệt |

---

## 2. Chi tiết API: Danh mục khoản lương (`/salary-items`)

### 2.1 `GET /salary-items`
- **Query Params**:
  - `q` (string, optional): Tìm kiếm theo mã (`code`), tên (`name`), hoặc ghi chú (`description`).
  - `category` (enum, optional): Lọc theo loại khoản (`FIXED_ALLOWANCE`, `BENEFIT_ALLOWANCE`...).
  - `status` (enum, optional): `ACTIVE` hoặc `INACTIVE`.
- **Response 200 OK**:
```json
[
  {
    "id": "c1f76d49-43c2-40f4-90a1-46061be746df",
    "code": "KL01",
    "name": "Lương cơ bản",
    "category": "FIXED_ALLOWANCE",
    "description": "Khoản gốc trên hợp đồng lao động",
    "isSocialInsurance": true,
    "isTaxable": true,
    "defaultRate": null,
    "status": "ACTIVE",
    "createdAt": "2026-09-06T08:00:00.000Z",
    "updatedAt": "2026-09-06T08:00:00.000Z"
  }
]
```

### 2.2 `GET /salary-items/count-by-category`
- **Response 200 OK**:
```json
{
  "FIXED_ALLOWANCE": 4,
  "BENEFIT_ALLOWANCE": 4,
  "DELIVERY_PIECEWORK": 3,
  "COMMISSION_PERCENTAGE": 3,
  "KPI_PERFORMANCE": 1,
  "PERIODIC_BONUS": 3,
  "ATTENDANCE_ALLOWANCE": 1,
  "TOTAL": 19
}
```

### 2.3 `POST /salary-items`
- **Request Body**:
```json
{
  "name": "Phụ cấp trách nhiệm dự án",
  "category": "FIXED_ALLOWANCE",
  "description": "Gắn với vị trí chủ nhiệm dự án",
  "isSocialInsurance": true,
  "isTaxable": true,
  "defaultRate": null
}
```
- **Response 201 Created**: Trả về bản ghi `SalaryItem` vừa tạo kèm `code` tự sinh (vd: `KL20`).
- **Lỗi 409 Conflict**: Trùng tên khoản trong cùng loại `category`.

### 2.4 `PATCH /salary-items/:id`
- **Request Body**: (Các trường tương tự POST, optional + `status`: `ACTIVE` / `INACTIVE`).
- **Response 200 OK**.

### 2.5 `DELETE /salary-items/:id`
- **Response 204 No Content**.
- **Lỗi 400 Bad Request**: Nếu khoản lương đã xuất hiện trong cấu trúc lương hoặc nhân viên đã được gán.

---

## 3. Chi tiết API: Cấu trúc lương khung (`/salary-structures`)

### 3.1 `GET /salary-structures/current`
- **Response 200 OK**:
```json
{
  "id": "e9b7a421-4f11-4f28-b0a3-bf2e8ec5d1b7",
  "effectiveFrom": "2026-01-01",
  "effectiveTo": "2026-12-31",
  "note": "Áp dụng từ kỳ lương tháng 01/2026 theo quy chế lương mới.",
  "isActive": true,
  "items": [
    {
      "id": "a1...",
      "salaryItemId": "c1f76d49-43c2-40f4-90a1-46061be746df",
      "salaryItem": {
        "code": "KL01",
        "name": "Lương cơ bản",
        "category": "FIXED_ALLOWANCE"
      },
      "taxTreatment": "TAXABLE",
      "isOvertimeBase": true,
      "calculationMethod": "ACTUAL_WORKDAYS",
      "defaultAmount": 10000000
    },
    {
      "id": "a2...",
      "salaryItemId": "c2...",
      "salaryItem": {
        "code": "KL08",
        "name": "Phụ cấp tiền cơm",
        "category": "BENEFIT_ALLOWANCE"
      },
      "taxTreatment": "EXEMPT",
      "isOvertimeBase": false,
      "calculationMethod": "ACTUAL_WORKDAYS",
      "defaultAmount": 730000
    }
  ]
}
```

### 3.2 `PUT /salary-structures/current`
- **Request Body**:
```json
{
  "effectiveFrom": "2026-01-01",
  "effectiveTo": "2026-12-31",
  "note": "Áp dụng từ kỳ lương tháng 01/2026 theo quy chế lương mới.",
  "items": [
    {
      "salaryItemId": "c1f76d49-43c2-40f4-90a1-46061be746df",
      "taxTreatment": "TAXABLE",
      "isOvertimeBase": true,
      "calculationMethod": "ACTUAL_WORKDAYS",
      "defaultAmount": 10000000
    }
  ]
}
```
- **Validation**:
  - `effectiveFrom` bắt buộc (date hợp lệ).
  - `effectiveTo >= effectiveFrom` nếu có.
  - `items` phải có ít nhất 1 dòng.
- **Response 200 OK**: Trả về cấu trúc lương đã lưu.

---

## 4. Chi tiết API: Set lương nhân viên (`/employee-salaries`)

### 4.1 `GET /employee-salaries`
- **Query Params**:
  - `q` (string): Tìm mã NV, họ tên, số tài khoản.
  - `departmentId` (UUID): Lọc theo phòng ban.
  - `contractType` (enum): Lọc theo loại hợp đồng hiện hành.
  - `hasSalary` (boolean, default: `true`): `true` = Đã set lương, `false` = Chưa set lương.
- **Response 200 OK**:
```json
[
  {
    "employeeId": "d0e12345-0001-4000-8000-000000000001",
    "employeeCode": "NV0001",
    "fullName": "Nguyễn Văn An",
    "position": "Trưởng phòng Kỹ thuật",
    "departmentName": "Phòng Công nghệ",
    "contractType": "LABOR_CONTRACT",
    "bankAccountNumber": "190333888999",
    "hasSalary": true,
    "setupVersion": 3,
    "effectiveFrom": "2026-01-01",
    "effectiveTo": "2026-12-31",
    "totalAmount": 52230000,
    "status": "APPROVED"
  }
]
```

### 4.2 `GET /employee-salaries/counts`
- **Response 200 OK**:
```json
{
  "hasSalary": 7,
  "missingSalary": 4,
  "totalActiveEmployees": 11
}
```

### 4.3 `GET /employee-salaries/:employeeId`
- **Response 200 OK**: Trả về chi tiết các khoản lương của nhân viên, đi kèm thông tin cấu trúc khung để giao diện render đúng thứ tự dòng.

### 4.4 `PUT /employee-salaries/:employeeId`
- **Request Body**:
```json
{
  "items": [
    { "salaryItemId": "c1f76d49-43c2-40f4-90a1-46061be746df", "amount": 40000000 },
    { "salaryItemId": "c2...", "amount": 8000000 },
    { "salaryItemId": "c3...", "amount": 730000 }
  ]
}
```
- **Validate trước khi ghi (thứ tự cố định — bổ sung Round 2, Architect 2026-09-06, xem `ADR-006` Addendum Mục A1/A2)**:
  1. Nhân viên (`employeeId`) tồn tại — không thoả trả `404 NOT_FOUND`.
  2. Nhân viên đang làm việc (BR-sal-008): tồn tại ít nhất 1 `Contract` với `effectiveFrom <= now AND (effectiveTo IS NULL OR effectiveTo >= now)` — không thoả trả `400 E-sal-009`. Áp dụng cho CẢ tạo mới lẫn cập nhật bản ghi đã có.
  3. Mọi phần tử `items[].salaryItemId` phải thuộc `SalaryStructureItem` của cấu trúc lương khung đang `isActive = true` (BR-sal-005) — có phần tử không thuộc, trả `400 E-sal-010` (từ chối TOÀN BỘ request, không chấp nhận một phần).
  4. `totalAmount = sum(items.amount) > 0` (BR-sal-006) — không thoả, trả `400 E-sal-008`.
  - **Lưu ý về 2 tầng validate (Round 3, vá Bug #1/tài liệu — code-review-report-salary-settings-round2.md Mục 2/4)**: bước 4 (`E-sal-008`) VÀ việc chặn `items[]` có `salaryItemId` trùng lặp (`E-sal-011`, xem bảng lỗi bên dưới) thực chất chạy Ở TẦNG **Zod Pipe** (`setEmployeeSalarySchema`), TRƯỚC KHI controller gọi `EmployeeSalariesService.setSalary()` — nghĩa là 2 lỗi này luôn được trả về TRƯỚC CẢ bước 1/2/3 (vốn nằm trong Service) nếu request vi phạm đồng thời nhiều điều kiện. Đoạn kiểm tra `E-sal-008` bên trong `setSalary()` vẫn còn (defense-in-depth cho caller không đi qua HTTP Pipe), nhưng không bao giờ chạm tới được qua đường HTTP thật.
- **Hành vi xử lý (khi qua hết validate)**:
  - Thực hiện trong `$transaction`.
  - Tự động cộng tổng `totalAmount = sum(items.amount)`.
  - Tăng `setupVersion = setupVersion + 1`.
  - Đặt `status = "PENDING_APPROVAL"`, reset `approvedByUserId`/`approvedAt` về `null`.
- **Response 200 OK**: Trả về bản ghi đã cập nhật.
- **Lỗi khả dĩ**:

| Status | Mã lỗi | Điều kiện |
|---|---|---|
| 404 | `NOT_FOUND` | `employeeId` không tồn tại |
| 400 | `E-sal-009` | Nhân viên không còn Hợp đồng hiệu lực tại thời điểm hiện tại (BR-sal-008) |
| 400 | `E-sal-010` *(mới, Round 2)* | Có `salaryItemId` không thuộc cấu trúc lương khung hiện hành (BR-sal-005). Message: `Khoản lương "{name}" ({code}) không thuộc cấu trúc lương khung hiện hành.` |
| 400 | `E-sal-008` | Tổng lương `<= 0` |

### 4.5 `DELETE /employee-salaries/:employeeId`
- **Response 204 No Content**: Xóa bản ghi `EmployeeSalary` của nhân viên đó, chuyển nhân viên về nhóm "Chưa set lương".

### 4.6 `POST /employee-salaries/approve`
- **Request Body** (optional):
```json
{
  "employeeIds": [
    "d0e12345-0001-4000-8000-000000000001",
    "d0e12345-0002-4000-8000-000000000002"
  ]
}
```
> Nếu body rỗng hoặc không truyền `employeeIds`, hệ thống tự động duyệt TẤT CẢ các nhân viên có `status != 'APPROVED'`.
- **Response 200 OK**:
```json
{
  "approvedCount": 2,
  "message": "Đã duyệt 2 bản set lương thành công."
}
```

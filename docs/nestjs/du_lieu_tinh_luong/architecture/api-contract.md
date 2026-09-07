---
type: api-contract
feature: payroll-input-data
status: approved
updated: 2026-09-06
author: Solution-Architect-Agent
links:
  - docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-spec.md
  - docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-flows.md
  - docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-states.md
  - docs/du_lieu_tinh_luong/architecture/data-model.md
  - docs/du_lieu_tinh_luong/architecture/adr/ADR-001-hybrid-catalog-and-snapshot.md
---

# Payroll Data — Hợp đồng API: Dữ liệu Tính Lương (Payroll Input API Contract)

Tài liệu đặc tả toàn bộ RESTful API endpoints, Request/Response DTOs (`class-validator`), Query Parameters, Phân quyền RBAC và Ma trận ánh xạ 26 mã lỗi chuẩn hóa (`E-dltl-001` .. `E-dltl-026`) cho phân hệ **Dữ liệu tính lương** (`du_lieu_tinh_luong`).

---

## 1. Tiêu chuẩn Kiến trúc & Quy ước Chung

1. **Base URL Prefix**: `/api/v1`
2. **Authentication**: JSON Web Token (JWT) Bearer Token qua header:  
   `Authorization: Bearer <access_token>`
3. **Phân quyền RBAC**: Sử dụng `@Roles(Role.ADMIN, Role.HR, Role.ACCOUNTANT, Role.EMPLOYEE)`:
   - `ADMIN`: Toàn quyền cấu hình, khóa sổ, mở lại kỳ lương (`reopen`), duyệt chi.
   - `HR` (Chuyên viên C&B / Trưởng phòng NS): Quản lý kỳ lương, nhập liệu chấm công, tăng ca, KPI, chuyên cần, thưởng.
   - `ACCOUNTANT` (Kế toán tiền lương): Nhập ứng bù trừ, rà soát đối soát, chạy tính lương, khóa sổ kỳ lương (`lock`).
   - `EMPLOYEE`: Chỉ xem phiếu lương cá nhân (`payslip`) của kỳ đã ở trạng thái `PAID`.
4. **Content-Type**: `application/json` (trừ các endpoint upload Excel sử dụng `multipart/form-data` và export Excel trả về `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
5. **Cơ chế Giao dịch (Transaction Integrity)**: Tất cả API áp dụng hàng loạt (`batch apply`) và chuyển đổi trạng thái kỳ lương (`lock`, `reopen`) bắt buộc phải bọc trong Prisma Interactive Transaction (`prisma.$transaction`) để đảm bảo tính nguyên tử (All-or-Nothing).

---

## 2. Danh mục Endpoints Tổng quan

| Phân hệ | Method | Endpoint URL | Vai trò (RBAC) | Mục đích nghiệp vụ |
|---|---|---|---|---|
| **Kỳ lương** | `GET` | `/payroll-periods` | `ADMIN, HR, ACC` | Lấy danh sách các kỳ lương (lọc năm, trạng thái) |
| | `POST` | `/payroll-periods` | `ADMIN, HR` | Tạo mới kỳ lương tháng (tự sinh lịch công chuẩn) |
| | `GET` | `/payroll-periods/:id` | `ADMIN, HR, ACC` | Chi tiết kỳ lương, thông tin tiến độ & người khóa/duyệt |
| | `PATCH` | `/payroll-periods/:id` | `ADMIN, HR` | Cập nhật thông tin kỳ (chỉ khi `DRAFT`) |
| | `DELETE` | `/payroll-periods/:id` | `ADMIN, HR` | Xóa kỳ lương nháp (chỉ khi `DRAFT`) |
| | `POST` | `/payroll-periods/:id/submit` | `HR, ACC` | Gửi đối soát kỳ lương (`DRAFT` -> `PENDING_REVIEW`) |
| | `POST` | `/payroll-periods/:id/reject` | `ADMIN, HR, ACC` | Từ chối đối soát (`PENDING_REVIEW` -> `DRAFT`) |
| | `POST` | `/payroll-periods/:id/lock` | `ADMIN, ACC` | Khóa sổ kỳ lương & chốt snapshot (`PENDING_REVIEW` -> `LOCKED`) |
| | `POST` | `/payroll-periods/:id/reopen` | **Chỉ `ADMIN`** | Mở lại kỳ lương kèm giải trình (`LOCKED` -> `DRAFT`) |
| | `POST` | `/payroll-periods/:id/approve` | **Chỉ `ADMIN`** | Giám đốc / CFO phê duyệt bảng lương (`LOCKED` -> `APPROVED`) |
| | `POST` | `/payroll-periods/:id/mark-paid`| `ADMIN, ACC` | Đánh dấu đã chi trả lương & mở phiếu lương (`APPROVED` -> `PAID`) |
| | `POST` | `/payroll-periods/:id/archive` | **Chỉ `ADMIN`** | Lưu trữ hồ sơ kế toán vĩnh viễn (`PAID` -> `ARCHIVED`) |
| **Danh mục** | `GET/POST` | `/payroll-catalogs/kpi-items` | `ADMIN, HR, ACC` | Danh mục chỉ tiêu KPI (`KPI01`..`KPI99`) |
| | `PATCH/DEL`| `/payroll-catalogs/kpi-items/:id` | `ADMIN, HR` | Sửa / Xóa chỉ tiêu KPI (Restrict khi có data) |
| | `GET/POST` | `/payroll-catalogs/products` | `ADMIN, HR, ACC` | Danh mục sản phẩm khoán (`SP01`..`SP99`) |
| | `PATCH/DEL`| `/payroll-catalogs/products/:id` | `ADMIN, HR` | Sửa / Xóa sản phẩm (Restrict khi có data) |
| | `GET/POST` | `/payroll-catalogs/diligence-types` | `ADMIN, HR, ACC` | Danh mục lỗi chuyên cần (`CC01`..`CC99`) |
| | `PATCH/DEL`| `/payroll-catalogs/diligence-types/:id`| `ADMIN, HR` | Sửa / Xóa lỗi chuyên cần (Restrict khi có data) |
| | `GET/POST` | `/payroll-catalogs/adjustment-items` | `ADMIN, HR, ACC` | Danh mục khoản ứng - bù trừ (`BT01`..`BT99`) |
| | `PATCH/DEL`| `/payroll-catalogs/adjustment-items/:id`| `ADMIN, HR, ACC`| Sửa / Xóa khoản bù trừ (Restrict khi có data) |
| **1. Chấm công**| `GET` | `/payroll-data/attendance/matrix` | `ADMIN, HR, ACC` | Ma trận chấm công tháng của nhân sự theo phòng ban |
| | `PUT` | `/payroll-data/attendance/cell` | `ADMIN, HR` | Ghi đè số giờ hoặc loại công một ô (Delta store) |
| | `POST` | `/payroll-data/attendance/batch-override` | `ADMIN, HR` | Chấm công hàng loạt theo ngày/khoảng ngày |
| **2. Tăng ca** | `GET` | `/payroll-data/overtime` | `ADMIN, HR, ACC` | Danh sách giờ tăng ca tháng kèm giờ quy đổi & cảnh báo trần |
| | `POST` | `/payroll-data/overtime/apply` | `ADMIN, HR` | Áp dụng bảng tăng ca hàng loạt (3 phạm vi) |
| | `PUT` | `/payroll-data/overtime/:employeeId` | `ADMIN, HR` | Cập nhật chi tiết giờ tăng ca của 1 nhân viên |
| | `DELETE` | `/payroll-data/overtime/:employeeId` | `ADMIN, HR` | Xóa dữ liệu tăng ca của 1 nhân viên trong kỳ |
| **3. KPI** | `GET` | `/payroll-data/kpi` | `ADMIN, HR, ACC` | Danh sách kết quả đánh giá KPI & hiệu suất % |
| | `POST` | `/payroll-data/kpi/apply` | `ADMIN, HR` | Áp dụng bảng chỉ tiêu KPI hàng loạt (3 phạm vi) |
| | `PUT` | `/payroll-data/kpi/:employeeId` | `ADMIN, HR` | Cập nhật mục tiêu & điểm thực thi KPI của 1 nhân viên |
| **4. Thưởng** | `GET` | `/payroll-data/bonus` | `ADMIN, HR, ACC` | Danh sách tiền thưởng trong kỳ |
| | `POST` | `/payroll-data/bonus/apply` | `ADMIN, HR` | Áp dụng khoản thưởng hàng loạt (3 phạm vi) |
| | `PUT` | `/payroll-data/bonus/:employeeId` | `ADMIN, HR` | Cập nhật khoản thưởng của 1 nhân viên |
| **5. Lương SP** | `GET` | `/payroll-data/piecework` | `ADMIN, HR, ACC` | Danh sách nghiệm thu sản phẩm & thành tiền |
| | `POST` | `/payroll-data/piecework/apply` | `ADMIN, HR` | Áp dụng bảng nghiệm thu sản phẩm (3 phạm vi) |
| | `PUT` | `/payroll-data/piecework/:employeeId` | `ADMIN, HR` | Cập nhật sản lượng nghiệm thu của 1 nhân viên |
| **6. Lương %** | `GET` | `/payroll-data/commission` | `ADMIN, HR, ACC` | Danh sách hoa hồng doanh số |
| | `POST` | `/payroll-data/commission/apply` | `ADMIN, HR` | Áp dụng hoa hồng phần trăm (3 phạm vi) |
| | `PUT` | `/payroll-data/commission/:employeeId` | `ADMIN, HR` | Cập nhật doanh số cơ sở & tỷ lệ % của 1 nhân viên |
| **7. Chuyên cần**| `GET` | `/payroll-data/diligence` | `ADMIN, HR, ACC` | Danh sách vi phạm chuyên cần & tiền trừ sau chặn sàn |
| | `POST` | `/payroll-data/diligence/record` | `ADMIN, HR` | Ghi nhận 1 lỗi vi phạm cho nhân viên |
| | `DELETE` | `/payroll-data/diligence/:id` | `ADMIN, HR` | Hủy 1 lần ghi nhận lỗi vi phạm |
| **8. Bù trừ** | `GET` | `/payroll-data/adjustments` | `ADMIN, HR, ACC` | Danh sách các khoản tạm ứng & bù trừ lương |
| | `POST` | `/payroll-data/adjustments/apply` | `ADMIN, HR, ACC`| Áp dụng khoản bù trừ hàng loạt (3 phạm vi) |
| | `PUT` | `/payroll-data/adjustments/:employeeId`| `ADMIN, HR, ACC`| Cập nhật khoản bù trừ của 1 nhân viên |
| **Excel IO** | `GET` | `/payroll-data/:module/template` | `ADMIN, HR, ACC` | Tải file Excel mẫu chuẩn hóa của phân hệ |
| | `POST` | `/payroll-data/:module/import-excel` | `ADMIN, HR, ACC`| Import dữ liệu từ file Excel (Atomic validation) |
| | `GET` | `/payroll-data/:module/export-excel` | `ADMIN, HR, ACC`| Xuất dữ liệu phân hệ ra file Excel |
| **Bảng lương** | `GET` | `/payroll/calculate` | `ADMIN, HR, ACC` | Tính thử bảng lương động (DRAFT / PENDING_REVIEW) |
| | `GET` | `/payroll/sheet-lines` | `ADMIN, HR, ACC` | Lấy bảng lương tổng hợp snapshot 18 cột (LOCKED/APPROVED/PAID) |
| | `GET` | `/payroll/payslips/my` | `EMPLOYEE` | Nhân viên xem phiếu lương cá nhân của mình |

---

## 3. Chi tiết API: Vòng đời Kỳ Lương (`/payroll-periods`)

### 3.1 `GET /payroll-periods`
Lấy danh sách các kỳ tính lương trong hệ thống.
- **Query Parameters**:
  - `year` (number, optional): Lọc theo năm (ví dụ `2026`).
  - `status` (enum, optional): `DRAFT`, `PENDING_REVIEW`, `LOCKED`, `APPROVED`, `PAID`, `ARCHIVED`.
- **Response 200 OK**:
```json
[
  {
    "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "code": "2026-08",
    "name": "Kỳ lương tháng 08/2026",
    "month": 8,
    "year": 2026,
    "startDate": "2026-08-01",
    "endDate": "2026-08-31",
    "status": "DRAFT",
    "lockedByUserId": null,
    "lockedAt": null,
    "approvedByUserId": null,
    "approvedAt": null,
    "totalEmployees": 45,
    "createdAt": "2026-08-01T00:00:00.000Z",
    "updatedAt": "2026-08-01T00:00:00.000Z"
  }
]
```

### 3.2 `POST /payroll-periods`
Tạo mới một kỳ tính lương. Hệ thống tự động tính ngày bắt đầu, ngày kết thúc và khởi tạo sẵn các ô công chuẩn từ `GeneralSetting` và `Holiday`.
- **Request Body DTO (`CreatePayrollPeriodDto`)**:
```json
{
  "month": 8,
  "year": 2026,
  "name": "Kỳ lương tháng 08/2026"
}
```
- **Validation Rules**:
  - `month`: `@IsInt()`, `@Min(1)`, `@Max(12)`
  - `year`: `@IsInt()`, `@Min(2020)`, `@Max(2100)`
  - `name`: `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)`
- **Response 201 Created**: Trả về bản ghi `PayrollPeriod` mới tạo với status `DRAFT`.
- **Lỗi nghiệp vụ**:
  - `409 Conflict`: Kỳ lương cho tháng/năm này đã tồn tại (`code = "2026-08"` đã có).

### 3.3 `POST /payroll-periods/:id/lock`
Khóa sổ kỳ lương. Kích hoạt tính toán bảng lương tổng hợp cuối cùng và lưu vào `payroll_sheet_lines`. Đóng băng toàn bộ 8 phân hệ dữ liệu.
- **Request Params**: `id` (UUID kỳ lương).
- **Guards**: Kỳ lương phải đang ở trạng thái `PENDING_REVIEW` (hoặc `DRAFT`).
- **Response 200 OK**:
```json
{
  "success": true,
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "status": "LOCKED",
  "lockedAt": "2026-09-06T14:30:00.000Z",
  "lockedByUserId": "9f8e7d6c-5b4a-3a2b-1c0d-e4f5a6b7c8d9",
  "snapshotLinesCount": 45
}
```
- **Lỗi nghiệp vụ**:
  - `400 Bad Request` (`E-dltl-001`): Kỳ lương đã ở trạng thái `LOCKED`, `APPROVED`, `PAID`, hoặc `ARCHIVED`.
  - `404 Not Found` (`E-dltl-025`): Không tìm thấy ID kỳ lương.
  - `409 Conflict` (`E-dltl-026`): Đang có tác vụ khóa sổ đồng thời.

### 3.4 `POST /payroll-periods/:id/reopen`
Mở lại kỳ lương đã khóa sổ để điều chỉnh sai sót. **Chỉ dành riêng cho vai trò `ADMIN`**. Bắt buộc nhập lý do giải trình để ghi Audit Log.
- **Request Body DTO (`ReopenPayrollPeriodDto`)**:
```json
{
  "reason": "Điều chỉnh bổ sung 15 giờ tăng ca thiếu của phân xưởng 2 do sự cố máy quét vân tay"
}
```
- **Validation Rules**:
  - `reason`: `@IsString()`, `@MinLength(20, { message: "Lý do mở lại phải có ít nhất 20 ký tự giải trình" })`
- **Response 200 OK**:
```json
{
  "success": true,
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "status": "DRAFT",
  "reopenedAt": "2026-09-06T14:45:00.000Z",
  "reopenedByUserId": "9f8e7d6c-5b4a-3a2b-1c0d-e4f5a6b7c8d9"
}
```
- **Lỗi nghiệp vụ**:
  - `400 Bad Request`: Kỳ lương đang ở trạng thái `PAID` hoặc `ARCHIVED` (không được phép mở lại).
  - `403 Forbidden`: Người thực hiện không có vai trò `ADMIN`.

---

## 4. Chi tiết API: 8 Phân hệ Dữ liệu Tính Lương (`/payroll-data`)

### 4.1 Quy ước DTO Phạm vi Áp dụng Chung (`BatchScopeDto`)
Các API áp dụng bảng mẫu hàng loạt ở 8 phân hệ kế thừa cấu trúc scope chung:

```typescript
export enum ApplyScope {
  TOAN_CONG_TY = 'toan_cong_ty',
  PHONG_BAN = 'phong_ban',
  NHAN_VIEN = 'nhan_vien',
}

export class BatchApplyScopeDto {
  @IsUUID()
  periodId: string;

  @IsEnum(ApplyScope)
  scope: ApplyScope;

  @ValidateIf(o => o.scope === ApplyScope.PHONG_BAN)
  @IsUUID(undefined, { message: 'E-dltl-003: Chưa chọn phòng ban khi áp dụng theo phạm vi phòng ban.' })
  departmentId?: string;

  @ValidateIf(o => o.scope === ApplyScope.NHAN_VIEN)
  @IsArray({ message: 'E-dltl-004: Danh sách nhân viên áp dụng không được để trống.' })
  @ArrayMinSize(1, { message: 'E-dltl-004: Danh sách nhân viên áp dụng không được để trống.' })
  @IsUUID('all', { each: true })
  employeeIds?: string[];
}
```

---

### 4.2 Phân hệ Chấm công (`/payroll-data/attendance`)

#### `GET /payroll-data/attendance/matrix`
- **Query Params**:
  - `periodId` (UUID, required)
  - `departmentId` (UUID, optional)
- **Response 200 OK**:
```json
{
  "period": { "id": "uuid", "code": "2026-08", "standardWorkDays": 26.0 },
  "dates": [
    { "date": "2026-08-01", "dayOfWeek": "SAT", "policy": "HALF_DAY", "isHoliday": false },
    { "date": "2026-08-02", "dayOfWeek": "SUN", "policy": "OFF", "isHoliday": false }
  ],
  "employees": [
    {
      "employeeId": "uuid-emp-1",
      "employeeCode": "NV0001",
      "fullName": "Nguyễn Văn A",
      "departmentName": "Kinh doanh",
      "totalActualWorkDays": 25.5,
      "records": {
        "2026-08-01": { "type": "nua_ngay", "actualHours": 4.0, "workDayValue": 0.5 },
        "2026-08-10": { "type": "lam_viec", "actualHours": 6.0, "workDayValue": 0.75, "note": "Về sớm có phép" }
      }
    }
  ]
}
```

#### `PUT /payroll-data/attendance/cell`
Cập nhật hoặc ghi đè một ô chấm công ngày cụ thể của một nhân sự (Delta store).
- **Request Body DTO (`UpdateAttendanceCellDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "employeeId": "e1f2a3b4-c5d6-4e5f-8a9b-0c1d2e3f4a5b",
  "workDate": "2026-08-10",
  "attendanceType": "lam_viec",
  "actualHours": 6.0,
  "note": "Về sớm 2 tiếng có giấy xin phép"
}
```
- **Validation**:
  - `actualHours`: `@Min(0)`, `@Max(24, { message: "E-dltl-005: Số giờ công không được âm hoặc vượt quá số giờ chuẩn trong ngày." })`
- **Response 200 OK**: Trả về bản ghi `AttendanceRecord` kèm `workDayValue` được tính toán tự động ($6.0 / 8.0 = 0.75$).

---

### 4.3 Phân hệ Tăng ca (`/payroll-data/overtime`)

#### `POST /payroll-data/overtime/apply`
Áp dụng danh sách giờ làm thêm cho các nhân viên thuộc phạm vi.
- **Request Body DTO (`ApplyOvertimeBatchDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "scope": "phong_ban",
  "departmentId": "d1e2f3a4-b5c6-4d5e-8f9a-0b1c2d3e4f5a",
  "items": [
    {
      "otType": "ngay_thuong_ngay",
      "hours": 10.0,
      "note": "Tăng ca hoàn thành đơn hàng xuất khẩu"
    },
    {
      "otType": "chu_nhat_ngay",
      "hours": 5.0,
      "note": "Hỗ trợ kiểm kê kho cuối tuần"
    }
  ]
}
```
- **Validation Rules**:
  - `items`: Không được trùng `otType` trong mảng (vi phạm báo lỗi `E-dltl-006`).
  - `hours`: `@Min(0.1, { message: "E-dltl-007: Số giờ tăng ca phải lớn hơn 0." })`.
- **Response 200 OK**:
```json
{
  "success": true,
  "appliedEmployeeCount": 12,
  "warnings": [
    {
      "employeeCode": "NV0003",
      "fullName": "Trần Thị B",
      "warningCode": "W-OT-LIMIT",
      "message": "Tổng giờ OT trong tháng đạt 42.0h, vượt trần tháng 40h theo Điều 107 BLLĐ."
    }
  ]
}
```

---

### 4.4 Phân hệ Đánh giá KPI (`/payroll-data/kpi`)

#### `POST /payroll-data/kpi/apply`
Áp dụng bảng chỉ tiêu KPI hàng loạt.
- **Request Body DTO (`ApplyKpiBatchDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "scope": "phong_ban",
  "departmentId": "d1e2f3a4-b5c6-4d5e-8f9a-0b1c2d3e4f5a",
  "items": [
    {
      "kpiItemId": "uuid-kpi-01",
      "weight": 60,
      "targetValue": 100.0,
      "actualValue": 95.0,
      "note": "Doanh số ký mới"
    },
    {
      "kpiItemId": "uuid-kpi-02",
      "weight": 40,
      "targetValue": 10.0,
      "actualValue": 10.0,
      "note": "Số khách hàng tiềm năng tiếp cận"
    }
  ]
}
```
- **Validation**:
  - `items`: Bắt buộc chọn `kpiItemId` (`E-dltl-008`), không trùng lặp (`E-dltl-009`).
  - Tổng `weight`: Phải $> 0$ (`E-dltl-010`).
  - `targetValue`: Phải $> 0$ (tránh chia cho 0).
- **Response 200 OK**:
```json
{
  "success": true,
  "appliedEmployeeCount": 8,
  "averageScore": 97.0
}
```

---

### 4.5 Phân hệ Thưởng (`/payroll-data/bonus`)

#### `POST /payroll-data/bonus/apply`
- **Request Body DTO (`ApplyBonusBatchDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "scope": "toan_cong_ty",
  "items": [
    {
      "salaryItemId": "uuid-salary-item-bonus-tet",
      "amount": 5000000,
      "note": "Thưởng Tết Dương lịch 2026"
    }
  ]
}
```
- **Validation**:
  - Không trùng `salaryItemId` (`E-dltl-011`).
  - `amount`: `@Min(0, { message: "E-dltl-012: Số tiền thưởng phải lớn hơn hoặc bằng 0." })`.
- **Response 200 OK**:
```json
{
  "success": true,
  "appliedEmployeeCount": 45,
  "totalBudgetAmount": 225000000
}
```

---

### 4.6 Phân hệ Lương Sản phẩm (`/payroll-data/piecework`)

#### `POST /payroll-data/piecework/apply`
- **Request Body DTO (`ApplyPieceworkBatchDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "scope": "nhan_vien",
  "employeeIds": ["uuid-emp-05", "uuid-emp-06"],
  "items": [
    {
      "productId": "uuid-sp-01",
      "unitPrice": 25000,
      "quantity": 150.0,
      "note": "Gia công áo sơ mi nam dài tay"
    }
  ]
}
```
- **Validation**:
  - Bắt buộc chọn `productId` (`E-dltl-013`), không trùng lặp (`E-dltl-014`).
  - `unitPrice >= 0` và `quantity >= 0` (`E-dltl-015`).
- **Response 200 OK**:
```json
{
  "success": true,
  "appliedEmployeeCount": 2,
  "totalPieceworkAmount": 7500000
}
```

---

### 4.7 Phân hệ Lương Phần trăm (`/payroll-data/commission`)

#### `POST /payroll-data/commission/apply`
- **Request Body DTO (`ApplyCommissionBatchDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "scope": "phong_ban",
  "departmentId": "uuid-dept-sales",
  "items": [
    {
      "salaryItemId": "uuid-salary-item-commission",
      "baseAmount": 250000000,
      "commissionRate": 3.5,
      "note": "Hoa hồng doanh số phần mềm tháng 08"
    }
  ]
}
```
- **Validation**:
  - Không trùng `salaryItemId` (`E-dltl-016`).
  - `commissionRate`: `@Min(0)`, `@Max(100, { message: "E-dltl-017: Tỷ lệ hoa hồng phải từ 0% đến 100%." })`.
- **Response 200 OK**: Trả về số nhân viên được áp dụng và tổng tiền hoa hồng tính toán ($250.000.000 \times 3.5\% = 8.750.000$ ₫/người).

---

### 4.8 Phân hệ Lương Chuyên cần (`/payroll-data/diligence`)

#### `POST /payroll-data/diligence/record`
Ghi nhận lỗi vi phạm kỷ luật/thời gian làm việc của nhân viên trong kỳ.
- **Request Body DTO (`CreateDiligenceRecordDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "employeeId": "uuid-emp-03",
  "violationTypeId": "uuid-cc-01",
  "violationDate": "2026-08-07",
  "violationHours": 1.5,
  "note": "Đi làm muộn do kẹt xe cầu vượt"
}
```
- **Validation**:
  - Bắt buộc có `violationTypeId` và `violationDate` (`E-dltl-018`).
  - Không trùng cặp `[violationTypeId, violationDate]` cho cùng 1 nhân viên (`E-dltl-019`).
  - `violationHours`: `@Min(0, { message: "E-dltl-020: Số giờ vi phạm chuyên cần không được âm." })`.
- **Response 201 Created**:
```json
{
  "id": "uuid-record-01",
  "employeeId": "uuid-emp-03",
  "violationDate": "2026-08-07",
  "deductionAmount": 75000,
  "remainingDiligenceAllowance": 225000
}
```

---

### 4.9 Phân hệ Ứng - Bù trừ Lương (`/payroll-data/adjustments`)

#### `POST /payroll-data/adjustments/apply`
- **Request Body DTO (`ApplyAdjustmentBatchDto`)**:
```json
{
  "periodId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "scope": "nhan_vien",
  "employeeIds": ["uuid-emp-04"],
  "items": [
    {
      "adjustmentItemId": "uuid-bt-01",
      "amount": 1500000,
      "note": "Tạm ứng lương giữa tháng ngày 15/08"
    },
    {
      "adjustmentItemId": "uuid-bt-02",
      "amount": 350000,
      "note": "Truy lĩnh tiền phụ cấp công tác phí tháng trước"
    }
  ]
}
```
- **Validation**:
  - Bắt buộc chọn `adjustmentItemId` (`E-dltl-021`), không trùng lặp (`E-dltl-022`).
  - `amount`: `@Min(1, { message: "E-dltl-023: Số tiền bù trừ phải lớn hơn 0 (chiều bù hoặc trừ do danh mục quy định)." })`.
- **Response 200 OK**: Trả về tổng tiền bị trừ ròng (`tongBiTru = 1.500.000 - 350.000 = 1.150.000` ₫).

---

## 5. Chi tiết API: Import / Export Excel Chuẩn hóa

### 5.1 `GET /payroll-data/:module/template`
Tải file Excel mẫu rỗng có sẵn header cột, định dạng dữ liệu và danh sách nhân sự hiện hành.
- **Path Params**: `module` $\in$ `['attendance', 'overtime', 'kpi', 'bonus', 'piecework', 'commission', 'diligence', 'adjustments']`.
- **Query Params**: `periodId` (UUID, required).
- **Response 200 OK**: File binary Excel stream.

### 5.2 `POST /payroll-data/:module/import-excel`
Import dữ liệu từ file Excel người dùng đã điền.
- **Content-Type**: `multipart/form-data`.
- **Body**: `file` (File Excel `.xlsx`, tối đa 5MB), `periodId` (UUID).
- **Cơ chế Atomic Validation**: Kiểm tra toàn bộ các dòng trước khi lưu. Nếu phát hiện bất kỳ dòng nào sai format hoặc mã nhân viên không tồn tại, lập tức Rollback toàn bộ và trả về danh sách dòng lỗi.
- **Response 200 OK**:
```json
{
  "success": true,
  "importedRowsCount": 42,
  "skippedRowsCount": 0
}
```
- **Response 400 Bad Request** (`E-dltl-024`):
```json
{
  "statusCode": 400,
  "errorCode": "E-dltl-024",
  "message": "File Excel nhập vào không đúng cấu trúc mẫu quy định.",
  "errors": [
    { "row": 5, "column": "Mã nhân viên", "value": "NV9999", "reason": "Nhân viên không tồn tại trong hệ thống." },
    { "row": 12, "column": "Số giờ", "value": "-3.5", "reason": "Số giờ tăng ca phải lớn hơn 0." }
  ]
}
```

---

## 6. Chi tiết API: Bảng Lương Tổng Hợp & Snapshot (`/payroll`)

### 6.1 `GET /payroll/calculate?periodId=...`
Xem trước kết quả bảng lương thời gian thực (Live Preview) khi kỳ lương đang ở `DRAFT` hoặc `PENDING_REVIEW`.
- **Response 200 OK**: Trả về mảng 18 cột lương của toàn bộ nhân sự trong kỳ.

### 6.2 `GET /payroll/sheet-lines?periodId=...`
Lấy dữ liệu bảng lương snapshot đóng băng khi kỳ lương đã ở trạng thái `LOCKED`, `APPROVED`, `PAID`, hoặc `ARCHIVED`.
- **Response 200 OK**:
```json
[
  {
    "id": "uuid-line-01",
    "periodId": "uuid-period",
    "employeeId": "uuid-emp-01",
    "employeeCode": "NV0001",
    "fullName": "Nguyễn Văn A",
    "departmentName": "Phòng Kinh doanh",
    "positionName": "Trưởng nhóm kinh doanh",
    "contractType": "LABOR_CONTRACT",
    "salaryType": "GROSS",
    "dependentCount": 1,
    "baseSalaryMonthly": 15000000,
    "standardWorkDays": 26.0,
    "actualWorkDays": 26.0,
    "otConvertedHours": 15.0,
    "otAmount": 1625000,
    "proratedWorkSalary": 15000000,
    "pieceworkSalary": 0,
    "bonusSalary": 5000000,
    "kpiSalary": 2500000,
    "commissionSalary": 8750000,
    "diligenceSalary": 500000,
    "grossIncome": 33375000,
    "taxableIncome": 13475000,
    "insuranceSalaryBase": 15000000,
    "employeeInsuranceDeduction": 1575000,
    "companyInsuranceExpense": 3225000,
    "employeeUnionFee": 150000,
    "companyUnionExpense": 300000,
    "adjustmentNetAmount": 1150000,
    "personalIncomeTax": 1445000,
    "netTakeHomeSalary": 27555000,
    "totalCompanyCost": 36900000
  }
]
```

---

## 7. Ma trận Mã Lỗi Chuẩn Hóa Toàn Diện (`E-dltl-001` .. `E-dltl-026`)

Mọi lỗi trả về từ API đều tuân theo chuẩn cấu trúc JSON thống nhất:

```json
{
  "statusCode": 400,
  "errorCode": "E-dltl-001",
  "message": "Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu.",
  "timestamp": "2026-09-06T14:50:00.000Z",
  "path": "/api/v1/payroll-data/overtime/apply",
  "details": null
}
```

Bảng tra cứu chi tiết 26 mã lỗi:

| Mã lỗi | HTTP Status | Thông điệp tiếng Việt | Phân hệ vi phạm | Điều kiện kích hoạt & Cách xử lý |
|---|---|---|---|---|
| `E-dltl-001` | 400 Bad Request | Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu. | Chung (Vòng đời) | Gọi API ghi (POST/PUT/PATCH/DELETE) khi kỳ $\ne$ `DRAFT`. Phải Reopen kỳ trước nếu là ADMIN. |
| `E-dltl-002` | 400 Bad Request | Nhân viên không tồn tại hoặc đã nghỉ việc. | Chung (Nhân sự) | Mã `employeeId` không tìm thấy hoặc `Employee.status != ACTIVE`. |
| `E-dltl-003` | 400 Bad Request | Chưa chọn phòng ban khi áp dụng theo phạm vi phòng ban. | Chung (Phạm vi) | `scope = "phong_ban"` nhưng `departmentId` để trống hoặc null. |
| `E-dltl-004` | 400 Bad Request | Danh sách nhân viên áp dụng không được để trống. | Chung (Phạm vi) | `scope = "nhan_vien"` nhưng mảng `employeeIds` rỗng. |
| `E-dltl-005` | 400 Bad Request | Số giờ công không được âm hoặc vượt quá số giờ chuẩn trong ngày. | 1. Chấm công | Nhập `actualHours < 0` hoặc `actualHours > 24.0` (hoặc `> standardHoursPerDay`). |
| `E-dltl-006` | 400 Bad Request | Loại tăng ca bị lặp lại trong bảng của nhân viên. | 2. Tăng ca | Trong cùng 1 kỳ của 1 NV có $\ge 2$ dòng cùng `otType`. Cần cộng dồn số giờ. |
| `E-dltl-007` | 400 Bad Request | Số giờ tăng ca phải lớn hơn 0. | 2. Tăng ca | `hours <= 0`. Giờ OT phải là số dương. |
| `E-dltl-008` | 400 Bad Request | Còn dòng chưa chọn chỉ tiêu KPI hoặc mã chỉ tiêu không hợp lệ. | 3. KPI | `kpiItemId` null hoặc không tồn tại trong `kpi_items`. |
| `E-dltl-009` | 400 Bad Request | Chỉ tiêu KPI bị lặp lại trong bảng. | 3. KPI | Một nhân viên có $\ge 2$ dòng cùng `kpiItemId`. |
| `E-dltl-010` | 400 Bad Request | Tổng trọng số KPI phải lớn hơn 0. | 3. KPI | Tổng $\sum \text{weight} \le 0$, không tính được hiệu suất bình quân. |
| `E-dltl-011` | 400 Bad Request | Khoản thưởng bị lặp lại trong bảng của nhân viên. | 4. Thưởng | Trùng `salaryItemId` trong bảng thưởng của 1 nhân viên trong kỳ. |
| `E-dltl-012` | 400 Bad Request | Số tiền thưởng phải lớn hơn hoặc bằng 0. | 4. Thưởng | `amount < 0`. Tiền thưởng không được âm. |
| `E-dltl-013` | 400 Bad Request | Còn dòng sản phẩm chưa chọn mã sản phẩm hợp lệ. | 5. Lương SP | `productId` null hoặc không tồn tại trong `piecework_products`. |
| `E-dltl-014` | 400 Bad Request | Sản phẩm bị lặp lại trong bảng lương sản phẩm. | 5. Lương SP | Một nhân viên nghiệm thu $\ge 2$ dòng cùng `productId`. |
| `E-dltl-015` | 400 Bad Request | Đơn giá hoặc số lượng sản phẩm không được âm. | 5. Lương SP | `unitPrice < 0` hoặc `quantity < 0`. |
| `E-dltl-016` | 400 Bad Request | Khoản lương phần trăm bị lặp lại trong bảng. | 6. Lương % | Trùng `salaryItemId` trong bảng hoa hồng của 1 nhân viên. |
| `E-dltl-017` | 400 Bad Request | Tỷ lệ hoa hồng phải từ 0% đến 100%. | 6. Lương % | `commissionRate < 0` hoặc `commissionRate > 100`. |
| `E-dltl-018` | 400 Bad Request | Còn dòng chuyên cần chưa chọn loại lỗi hoặc chưa điền ngày. | 7. Chuyên cần | `violationTypeId` hoặc `violationDate` null. |
| `E-dltl-019` | 400 Bad Request | Lỗi chuyên cần bị khai báo trùng lặp cho cùng một ngày. | 7. Chuyên cần | Trùng cặp `[violationTypeId, violationDate]` cho cùng 1 nhân viên. |
| `E-dltl-020` | 400 Bad Request | Số giờ vi phạm chuyên cần không được âm. | 7. Chuyên cần | `violationHours < 0`. |
| `E-dltl-021` | 400 Bad Request | Còn dòng bù trừ chưa chọn khoản hoặc mã khoản không hợp lệ. | 8. Bù trừ | `adjustmentItemId` null hoặc không tồn tại. |
| `E-dltl-022` | 400 Bad Request | Khoản bù trừ bị lặp lại trong bảng của nhân viên. | 8. Bù trừ | Trùng `adjustmentItemId` cho 1 nhân viên trong kỳ. |
| `E-dltl-023` | 400 Bad Request | Số tiền bù trừ phải lớn hơn 0 (chiều bù hoặc trừ do danh mục quy định). | 8. Bù trừ | `amount <= 0`. Người dùng phải nhập số dương. |
| `E-dltl-024` | 400 Bad Request | File Excel nhập vào không đúng cấu trúc mẫu quy định. | Excel IO | File Excel sai tiêu đề cột, thiếu cột bắt buộc hoặc chứa dữ liệu hỏng. |
| `E-dltl-025` | 404 Not Found | Kỳ lương không tồn tại trong hệ thống. | Chung | ID kỳ lương không tìm thấy trong database. |
| `E-dltl-026` | 409 Conflict | Đang có thao tác khóa sổ kỳ lương đồng thời, vui lòng thử lại. | Concurrency | Xung đột phiên bản hoặc Transaction Lock khi 2 user cùng bấm khóa kỳ. |

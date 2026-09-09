---
type: api-contract
feature: hrm-cai-dat-luong
status: approved
updated: 2026-09-09
author: Backend-Architect & BA
links:
  - docs/hrm/cai_dat_luong/srs-cai-dat-luong.md
  - docs/hrm/cai_dat_luong/data-model-cai-dat-luong.md
---

# HR — Hợp đồng API: Cài đặt lương (Salary Settings API Contract)

Tài liệu đặc tả toàn bộ REST API endpoints của tính năng Cài đặt lương (`cai_dat_luong`) trong `be_maxv`.

- **Base URL Prefix**: `/api/v1/hrm`
- **Authentication**: Bearer JWT (Tenant Context Header / Cookie)
- **Multi-tenancy**: Xử lý tự động qua `resolveTenantDb`

---

## 1. Danh mục Khoản lương & Phụ cấp (`/salary-items`)

### 1.1. Danh sách khoản lương
- **Method**: `GET /api/v1/hrm/salary-items`
- **Query Parameters**:
  - `category` (optional): `SalaryItemCategory`
  - `status` (optional): `SalaryItemStatus` (`ACTIVE` / `INACTIVE`)
  - `search` (optional): string (tìm theo mã hoặc tên)
- **Response 200 OK**:
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "code": "KL01",
      "name": "Lương cơ bản",
      "category": "LUONG_PHU_CAP_CO_DINH",
      "description": "Lương chính theo hợp đồng",
      "defaultRate": 100,
      "hasInsurance": true,
      "isTaxable": true,
      "status": "ACTIVE",
      "createdAt": "2026-09-09T08:00:00.000Z",
      "updatedAt": "2026-09-09T08:00:00.000Z"
    }
  ]
}
```

### 1.2. Đếm số lượng theo nhóm
- **Method**: `GET /api/v1/hrm/salary-items/count-by-category`
- **Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "LUONG_PHU_CAP_CO_DINH": 3,
    "LUONG_HO_TRO_PHUC_LOI": 2,
    "LUONG_NGHIEM_THU": 0,
    "LUONG_HOA_HONG": 1,
    "LUONG_KPI": 1,
    "LUONG_THUONG": 1,
    "LUONG_CHUYEN_CAN": 1
  }
}
```

### 1.3. Chi tiết khoản lương
- **Method**: `GET /api/v1/hrm/salary-items/:id`
- **Response 200 OK**: `{ "success": true, "data": { ...SalaryItem } }`
- **Response 404 Not Found**: `{ "success": false, "message": "Khoản lương không tồn tại.", "errorCode": "E-sal-001" }`

### 1.4. Tạo mới khoản lương
- **Method**: `POST /api/v1/hrm/salary-items`
- **Request Body**:
```json
{
  "code": "KL01", // optional (nếu thiếu, hệ thống tự sinh KL01..KL99)
  "name": "Lương cơ bản",
  "category": "LUONG_PHU_CAP_CO_DINH",
  "description": "Lương ký HĐLĐ",
  "defaultRate": 100,
  "hasInsurance": true,
  "isTaxable": true,
  "status": "ACTIVE"
}
```
- **Response 201 Created**: `{ "success": true, "data": { ...SalaryItem } }`
- **Response 400 Bad Request**:
  - Tên trùng: `{ "success": false, "message": "Tên khoản lương đã tồn tại...", "errorCode": "E-sal-002" }`

### 1.5. Cập nhật khoản lương
- **Method**: `PUT /api/v1/hrm/salary-items/:id`
- **Request Body**: Các trường cần cập nhật (name, category, defaultRate, hasInsurance, isTaxable, status, description).
- **Response 200 OK**: `{ "success": true, "data": { ...SalaryItem } }`
- **Response 400 Bad Request**: Trùng tên với khoản khác.

### 1.6. Xóa khoản lương
- **Method**: `DELETE /api/v1/hrm/salary-items/:id`
- **Response 200 OK**: `{ "success": true, "message": "Xóa khoản lương thành công." }`
- **Response 400 Bad Request**: Khoản lương đang được dùng trong cấu trúc khung (`E-sal-003`).

---

## 2. Cấu trúc Lương khung (`/salary-structures`)

### 2.1. Lấy danh sách cấu trúc khung
- **Method**: `GET /api/v1/hrm/salary-structures`
- **Response 200 OK**: `{ "success": true, "data": [ ...SalaryStructure with items ] }`

### 2.2. Lấy cấu trúc đang áp dụng (Active Structure)
- **Method**: `GET /api/v1/hrm/salary-structures/active`
- **Response 200 OK**: `{ "success": true, "data": { ...SalaryStructure with items & salaryItem } }`

### 2.3. Tạo / Lưu cấu trúc lương khung
- **Method**: `POST /api/v1/hrm/salary-structures`
- **Request Body**:
```json
{
  "name": "Khung lương tiêu chuẩn 2026",
  "description": "Áp dụng toàn công ty",
  "effectiveFrom": "2026-01-01T00:00:00.000Z",
  "effectiveTo": null,
  "isActive": true,
  "items": [
    {
      "salaryItemId": "clx...",
      "taxTreatment": "TAXABLE",
      "isOvertimeBase": true,
      "calculationMethod": "FIXED_MONTHLY",
      "defaultAmount": 10000000
    },
    {
      "salaryItemId": "cly...",
      "taxTreatment": "NON_TAXABLE",
      "isOvertimeBase": false,
      "calculationMethod": "ACTUAL_WORKDAY",
      "defaultAmount": 730000
    }
  ]
}
```
- **Response 201 Created**: `{ "success": true, "data": { ...SalaryStructure } }`

---

## 3. Thiết lập Lương Nhân viên (`/employee-salaries`)

### 3.1. Danh sách nhân viên & tình trạng lương
- **Method**: `GET /api/v1/hrm/employee-salaries`
- **Query Parameters**:
  - `departmentId` / `ma_pb`: Lọc theo phòng ban
  - `contractType`: Lọc theo loại hợp đồng
  - `hasSalary`: `true` | `false` (Lọc nhân viên đã / chưa set lương)
  - `search`: Họ tên, mã nhân viên
- **Response 200 OK**:
```json
{
  "success": true,
  "data": [
    {
      "id": "NV0001",
      "ma_nv": "NV0001",
      "ho_ten": "Nguyễn Văn A",
      "email": "vana@example.com",
      "ma_pb": "PB01",
      "phong_ban": { "ten_pb": "Phòng Kỹ thuật" },
      "hop_dong": [{ "loai_hd": "XAC_DINH_THOI_HAN", "trang_thai": "CON_HIEU_LUC" }],
      "daSet": true,
      "hasSalary": true,
      "tong_luong": 10730000,
      "totalAmount": 10730000,
      "status": "APPROVED",
      "setupVersion": 1,
      "effectiveDate": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3.2. Lấy thông tin thiết lập lương của 1 nhân viên
- **Method**: `GET /api/v1/hrm/employee-salaries/:employeeId`
- **Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "employee": {
      "ma_nv": "NV0001",
      "ho_ten": "Nguyễn Văn A",
      "phong_ban": { "ten_pb": "Phòng Kỹ thuật" },
      "chuc_vu": { "ten_cv": "Kỹ sư phần mềm" }
    },
    "salary": {
      "id": "clz...",
      "ma_nv": "NV0001",
      "totalAmount": 10730000,
      "setupVersion": 1,
      "status": "APPROVED",
      "effectiveDate": "2026-01-01T00:00:00.000Z",
      "note": "Lương khởi điểm",
      "items": [
        {
          "salaryItemId": "clx...",
          "amount": 10000000,
          "salaryItem": { "code": "KL01", "name": "Lương cơ bản" }
        },
        {
          "salaryItemId": "cly...",
          "amount": 730000,
          "salaryItem": { "code": "KL02", "name": "Phụ cấp ăn trưa" }
        }
      ]
    },
    "hasActiveContract": true
  }
}
```

### 3.3. Thiết lập / Cập nhật mức lương nhân viên
- **Method**: `POST /api/v1/hrm/employee-salaries/:employeeId`
- **Request Body (Hỗ trợ 2 định dạng linh hoạt)**:
  - **Định dạng 1 (Mảng chuẩn)**:
  ```json
  {
    "effectiveDate": "2026-01-01T00:00:00.000Z",
    "note": "Thiết lập lương đợt 1",
    "items": [
      { "salaryItemId": "clx...", "amount": 10000000 },
      { "salaryItemId": "cly...", "amount": 730000 }
    ]
  }
  ```
  - **Định dạng 2 (Map đối tượng tương thích Mock UI `khoan`)**:
  ```json
  {
    "effectiveDate": "2026-01-01T00:00:00.000Z",
    "khoan": {
      "clx...": 10000000,
      "cly...": 730000
    }
  }
  ```
- **Response 200 OK / 201 Created**: `{ "success": true, "data": { ...EmployeeSalary } }`
- **Response 400 Bad Request**:
  - Không có hợp đồng còn hiệu lực: `E-sal-009`
  - Không có cấu trúc lương active: `E-sal-007`
  - Khoản gán không thuộc cấu trúc: `E-sal-010`
  - Tổng lương <= 0: `E-sal-008`

### 3.4. Phê duyệt lương nhân viên đơn lẻ
- **Method**: `POST /api/v1/hrm/employee-salaries/:employeeId/approve`
- **Response 200 OK**: `{ "success": true, "data": { ...EmployeeSalary, "status": "APPROVED" } }`

### 3.5. Phê duyệt lương hàng loạt
- **Method**: `POST /api/v1/hrm/employee-salaries/approve`
- **Request Body**:
```json
{
  "employeeIds": ["NV0001", "NV0002", "NV0003"]
}
```
- **Response 200 OK**: `{ "success": true, "data": { "count": 3 } }`
- **Response 400 Bad Request**: Mảng rỗng (`E-sal-011`).

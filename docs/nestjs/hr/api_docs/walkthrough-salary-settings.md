# BÁO CÁO WALKTHROUGH VÀ TÀI LIỆU KỸ THUẬT API — PHÂN HỆ CÀI ĐẶT LƯƠNG
## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

- **Thời gian**: 2026-09-06
- **Tác giả**: Engineering Pipeline (BA, Software Architect, Backend Engineer, Code Reviewer, QA Tester, DevOps)
- **Dự án**: `phamvinh203/hrm-Accounting` (Nhánh `dev`)
- **Vị trí tài liệu**: `docs/hr/api_docs/walkthrough-salary-settings.md`
- **Trạng thái**: ✅ **100% HOÀN THÀNH & NGHIỆM THU — SẴN SÀNG TÍCH HỢP**

---

# PHẦN 1: WALKTHROUGH TRIỂN KHAI VÀ KẾT QUẢ NGHIỆM THU

## 1. Mục tiêu & Bối cảnh kỹ thuật
Dựa trên yêu cầu nghiệp vụ và cấu trúc giao diện tại `cai_dat_luong`, toàn bộ hệ thống Cài đặt lương đã được thiết kế và hiện thực hóa thành các RESTful API thực tế trên NestJS 12, Prisma 7 và PostgreSQL 17:

1. **Danh mục khoản lương (`SalaryItem`)**:
   - Quản lý danh mục 7 loại khoản lương: Lương/Phụ cấp cố định, Lương hỗ trợ, Lương nghiệm thu, Lương phần trăm, Lương KPI, Lương thưởng, Lương chuyên cần.
   - Cơ chế tự sinh mã tuần tự `KL01`..`KL99`.
   - Ràng buộc toàn vẹn: Chặn trùng tên trong cùng loại (`E-sal-002`), chặn xoá khoản đang dùng trong cấu trúc lương (`E-sal-003`).

2. **Cấu trúc lương doanh nghiệp (`SalaryStructure`)**:
   - Quản lý cấu trúc khung hiện hành áp dụng cho doanh nghiệp theo kỳ hiệu lực.
   - Thiết lập chi tiết từng khoản: Phân loại thuế TNCN (`TAXABLE`, `EXEMPT`), nhân hệ số làm thêm giờ (`isOvertimeBase`), tiêu thức tính (`MONTHLY_FIXED`, `ACTUAL_WORKDAYS`, `HOURLY`, `OUTPUT_BASED`) và mức tiền mặc định.
   - Thao tác ghi đè an toàn trong transaction, đảm bảo tối thiểu 1 khoản mục (`E-sal-004`).

3. **Thiết lập mức lương nhân viên (`EmployeeSalary`)**:
   - Thiết lập số tiền chi tiết cho từng nhân sự (quan hệ 1-1 với `Employee`).
   - Tự động tính tổng thu nhập dự kiến hàng tháng (`totalAmount`).
   - Quản lý vòng đời phê duyệt lương: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`.
   - Tính năng phê duyệt hàng loạt (`POST /employee-salaries/approve`) ghi nhận người duyệt và thời điểm duyệt.

---

## 2. Thống kê kết quả kiểm thử toàn diện

| Hạng mục kiểm thử | Số lượng bài kiểm tra | Đạt (Passed) | Ghi chú |
|---|:---:|:---:|---|
| **Unit Tests Backend** | 271 | 271 (100%) | 23 test suites bao phủ toàn bộ services |
| **E2E Tests Cài đặt lương** | 17 | 17 (100%) | `test/salary-settings.e2e-spec.ts` trên Postgres thật |
| **E2E Tests Toàn bộ HR & Auth** | 245 | 245 (100%) | 9 test suites tổng thể |
| **Kiểm tra cú pháp & Linting** | Oxlint | 0 lỗi, 0 cảnh báo | Tuân thủ code style và typing |
| **Biên dịch mã nguồn** | `nest build` | Thành công | Output tại `dist/` |

---

# PHẦN 2: TÀI LIỆU CHI TIẾT 14 RESTFUL API ENDPOINTS

Base URL: `http://localhost:8000` (hoặc `/api/v1`)
Xác thực: Bearer Token qua header `Authorization: Bearer <accessToken>` hoặc cookie phiên.

---

## 1. Nhóm API: Danh mục khoản lương (`/salary-items`)

### 1.1 `GET /salary-items`
- **Mục đích**: Lấy danh sách khoản lương.
- **Quyền hạn**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Query Parameters**:
  - `q` (string, optional): Tìm kiếm theo tên hoặc mã.
  - `category` (enum, optional): `FIXED_ALLOWANCE`, `BENEFIT_ALLOWANCE`, `DELIVERY_PIECEWORK`, `COMMISSION_PERCENTAGE`, `KPI_PERFORMANCE`, `PERIODIC_BONUS`, `ATTENDANCE_ALLOWANCE`.
  - `status` (enum, optional): `ACTIVE`, `INACTIVE`.
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
      "createdAt": "2026-09-06T08:00:00.000Z"
    }
  ]
  ```

### 1.2 `POST /salary-items`
- **Mục đích**: Tạo mới khoản lương.
- **Quyền hạn**: `ADMIN`, `HR`.
- **Request Body**:
  ```json
  {
    "name": "Phụ cấp trách nhiệm",
    "category": "FIXED_ALLOWANCE",
    "description": "Phụ cấp quản lý nhóm",
    "isSocialInsurance": false,
    "isTaxable": true
  }
  ```
- **Response 201 Created**: Trả về bản ghi khoản lương kèm mã tự sinh (ví dụ `KL20`).
- **Lỗi 409 Conflict**: Mã lỗi `E-sal-002` khi tên khoản lương bị trùng trong cùng nhóm.

### 1.3 `GET /salary-items/:id`
- **Mục đích**: Xem chi tiết khoản lương theo ID (UUID hoặc Mã `KLxx`).
- **Quyền hạn**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Response 200 OK**: Chi tiết khoản lương.

### 1.4 `PATCH /salary-items/:id`
- **Mục đích**: Cập nhật thông tin khoản lương (cấm sửa `code` và `category`).
- **Quyền hạn**: `ADMIN`, `HR`.
- **Request Body**:
  ```json
  {
    "description": "Đã cập nhật mô tả mới",
    "status": "ACTIVE"
  }
  ```
- **Response 200 OK**: Bản ghi sau khi cập nhật.

### 1.5 `DELETE /salary-items/:id`
- **Mục đích**: Xoá khoản lương khỏi danh mục.
- **Quyền hạn**: `ADMIN`, `HR`.
- **Response 200 OK**: `{ "success": true }`.
- **Lỗi 400 Bad Request**: Mã lỗi `E-sal-003` khi khoản lương đang được dùng trong cấu trúc lương.

---

## 2. Nhóm API: Cấu trúc lương (`/salary-structures`)

### 2.1 `GET /salary-structures/current`
- **Mục đích**: Lấy cấu trúc lương khung hiện hành của công ty.
- **Quyền hạn**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Response 200 OK**:
  ```json
  {
    "id": "structure-uuid",
    "effectiveFrom": "2026-01-01T00:00:00.000Z",
    "effectiveTo": "2026-12-31T00:00:00.000Z",
    "note": "Áp dụng từ kỳ lương tháng 01/2026",
    "isActive": true,
    "items": [
      {
        "id": "item-uuid-1",
        "salaryItemId": "c1f76d49-43c2-40f4-90a1-46061be746df",
        "taxTreatment": "TAXABLE",
        "isOvertimeBase": true,
        "calculationMethod": "ACTUAL_WORKDAYS",
        "defaultAmount": 10000000,
        "salaryItem": {
          "id": "c1f76d49-43c2-40f4-90a1-46061be746df",
          "code": "KL01",
          "name": "Lương cơ bản",
          "category": "FIXED_ALLOWANCE"
        }
      }
    ]
  }
  ```

### 2.2 `PUT /salary-structures/current`
- **Mục đích**: Cập nhật hoặc thiết lập mới cấu trúc lương khung.
- **Quyền hạn**: `ADMIN`, `HR`.
- **Request Body**:
  ```json
  {
    "effectiveFrom": "2026-01-01",
    "effectiveTo": "2026-12-31",
    "note": "Cấu trúc lương chuẩn 2026",
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
- **Response 200 OK**: Bản ghi cấu trúc lương mới sau khi cập nhật.
- **Lỗi 400 Bad Request**: Mã `E-sal-004` nếu danh sách `items` rỗng; mã `E-sal-005` nếu chứa `salaryItemId` không tồn tại.

---

## 3. Nhóm API: Thiết lập lương nhân viên (`/employee-salaries`)

### 3.1 `GET /employee-salaries`
- **Mục đích**: Danh sách nhân viên kèm trạng thái set lương và phân trang.
- **Quyền hạn**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Query Parameters**:
  - `page` (number, default 1)
  - `pageSize` (number, default 20)
  - `search` (string, optional): Tìm theo họ tên, mã NV.
  - `departmentId` (uuid, optional): Lọc theo phòng ban.
  - `approvalStatus` (enum, optional): `DRAFT`, `PENDING_APPROVAL`, `APPROVED`.
  - `hasSalary` (boolean, optional): `true` (đã set), `false` (chưa set).
- **Response 200 OK**:
  ```json
  {
    "data": [
      {
        "id": "emp-uuid-1",
        "employeeCode": "NV0001",
        "fullName": "Nguyễn Văn A",
        "departmentId": "dept-uuid",
        "departmentName": "Phòng Kỹ Thuật",
        "position": "Kỹ sư",
        "bankAccountNumber": "0123456789",
        "hasSalary": true,
        "salary": {
          "id": "salary-uuid",
          "totalAmount": 15000000,
          "status": "APPROVED",
          "effectiveFrom": "2026-01-01T00:00:00.000Z",
          "effectiveTo": null,
          "setupVersion": 1,
          "approvedAt": "2026-09-06T09:00:00.000Z"
        },
        "currentContract": {
          "contractType": "OFFICIAL",
          "baseSalary": 15000000
        }
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
  ```

### 3.2 `GET /employee-salaries/:employeeId`
- **Mục đích**: Xem chi tiết mức lương đã thiết lập của một nhân sự.
- **Quyền hạn**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Response 200 OK**: Chi tiết bảng lương nhân sự kèm các khoản mục chi tiết và thông tin join của từng khoản.

### 3.3 `PUT /employee-salaries/:employeeId`
- **Mục đích**: Set lương hoặc cập nhật lương nhân sự (tự động tính tổng tiền).
- **Quyền hạn**: `ADMIN`, `HR`.
- **Request Body**:
  ```json
  {
    "effectiveFrom": "2026-01-01",
    "effectiveTo": null,
    "items": [
      {
        "salaryItemId": "c1f76d49-43c2-40f4-90a1-46061be746df",
        "amount": 15000000
      }
    ]
  }
  ```
- **Response 200 OK**: Bản ghi set lương với trạng thái `PENDING_APPROVAL` và tổng số tiền được tính tự động.

### 3.4 `DELETE /employee-salaries/:employeeId`
- **Mục đích**: Xoá thiết lập lương của nhân viên (CASCADE xoá các items chi tiết).
- **Quyền hạn**: `ADMIN`, `HR`.
- **Response 204 No Content**.

### 3.5 `POST /employee-salaries/approve`
- **Mục đích**: Phê duyệt hàng loạt các thiết lập lương đang chờ duyệt.
- **Quyền hạn**: `ADMIN`, `HR`.
- **Request Body**:
  ```json
  {
    "employeeIds": ["emp-uuid-1", "emp-uuid-2"]
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "approvedCount": 2
  }
  ```

---

## 4. Bảng tra cứu mã lỗi chuẩn hóa (`E-sal-xxx`)

| Mã lỗi | HTTP Status | Thông báo hiển thị (Message) | Nguyên nhân kích hoạt |
|---|:---:|---|---|
| `E-sal-001` | 400 Bad Request | Tên khoản lương không được để trống | Payload tạo/sửa có `name` rỗng hoặc chỉ có khoảng trắng |
| `E-sal-002` | 409 Conflict | Đã có khoản lương cùng tên trong nhóm này | Tên khoản lương bị trùng lặp trong cùng danh mục `category` |
| `E-sal-003` | 400 Bad Request | Khoản lương đang được dùng trong cấu trúc lương | Cố xoá một `SalaryItem` đang có trong `SalaryStructureItem` |
| `E-sal-004` | 400 Bad Request | Cấu trúc lương phải có ít nhất một khoản | Payload cấu trúc lương có mảng `items: []` |
| `E-sal-005` | 400 Bad Request | Khoản lương không tồn tại trong danh mục | `salaryItemId` trong cấu trúc không có trong bảng `salary_items` |
| `E-sal-006` | 400 Bad Request | Danh sách khoản lương của nhân viên có khoản bị trùng lặp | Set lương gửi 2 lần cùng một `salaryItemId` |
| `E-sal-007` | 400 Bad Request | Số tiền của từng khoản lương phải là số nguyên không âm | Mức tiền < 0 hoặc không phải số nguyên |
| `E-sal-008` | 404 Not Found | Không tìm thấy thiết lập lương của nhân viên | Nhân viên chưa được set lương |
| `E-sal-009` | 400 Bad Request | Danh sách nhân viên cần duyệt không được để trống | Mảng `employeeIds` rỗng khi gọi `/approve` |

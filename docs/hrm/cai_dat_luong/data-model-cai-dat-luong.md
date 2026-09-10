---
type: architecture-data-model
feature: hrm-cai-dat-luong
status: approved
updated: 2026-09-09
author: Backend-Architect
links:
  - docs/hrm/cai_dat_luong/srs-cai-dat-luong.md
  - docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md
---

# HR — Mô hình Dữ liệu: Cài đặt lương (Salary Settings Data Model)

Tài liệu mô tả mô hình dữ liệu quan hệ (Relational Data Model & Prisma Schema) của tính năng Cài đặt lương (`cai_dat_luong`) trong schema cơ sở dữ liệu Tenant của `be_maxv`.

---

## 1. Biểu đồ Thực thể Liên kết (Entity Relationship Diagram - ERD)

```
+--------------------------+          +--------------------------------+
|      hrm_nhan_vien       | 1      1 |      hrm_employee_salaries     |
| (ma_nv [PK], ho_ten...)  |----------| (id [PK], ma_nv [FK, UNIQUE])  |
+--------------------------+          |  setup_version, status, total  |
                                      +--------------------------------+
                                                      | 1
                                                      |
                                                      | N
                                      +--------------------------------+
                                      |   hrm_employee_salary_items    |
                                      | (id [PK], employee_salary_id)  |
                                      |  salary_item_id [FK], amount   |
                                      +--------------------------------+
                                                      | N
                                                      |
                                                      | 1
+--------------------------+ 1      N +--------------------------------+
|    hrm_salary_items      |----------|   hrm_salary_structure_items   |
| (id [PK], code, name...) |          | (id [PK], salary_structure_id) |
+--------------------------+          |  salary_item_id [FK], options  |
                                      +--------------------------------+
                                                      | N
                                                      |
                                                      | 1
                                      +--------------------------------+
                                      |     hrm_salary_structures      |
                                      | (id [PK], name, is_active...)  |
                                      +--------------------------------+
```

---

## 2. Kiểu Liệt Kê (Enums)

### 2.1. `SalaryItemCategory`
Phân nhóm 7 loại danh mục thu nhập theo mock UI:
- `LUONG_PHU_CAP_CO_DINH`: Lương/phụ cấp cố định
- `LUONG_HO_TRO_PHUC_LOI`: Lương hỗ trợ/phúc lợi
- `LUONG_NGHIEM_THU`: Lương nghiệm thu
- `LUONG_HOA_HONG`: Lương phần trăm/hoa hồng
- `LUONG_KPI`: Lương KPI
- `LUONG_THUONG`: Lương thưởng
- `LUONG_CHUYEN_CAN`: Lương chuyên cần

### 2.2. `SalaryItemStatus`
- `ACTIVE`: Đang sử dụng
- `INACTIVE`: Ngừng sử dụng

### 2.3. `TaxTreatment`
- `TAXABLE`: Thu nhập chịu thuế TNCN
- `NON_TAXABLE`: Thu nhập miễn thuế TNCN (trong hạn mức)

### 2.4. `CalculationMethod`
- `FIXED_MONTHLY`: Cố định theo tháng
- `ACTUAL_WORKDAY`: Theo ngày công thực tế
- `HOURLY`: Theo giờ
- `PERFORMANCE`: Theo hiệu suất / hoa hồng / KPI

### 2.5. `SalaryApprovalStatus`
- `DRAFT`: Nháp
- `PENDING_APPROVAL`: Chờ duyệt
- `APPROVED`: Đã duyệt
- `REJECTED`: Từ chối

---

## 3. Chi tiết Các Bảng CSDL (Tables Definition)

### 3.1. Bảng `hrm_salary_items` (Danh mục khoản lương & phụ cấp)
```prisma
model SalaryItem {
  id           String             @id @default(cuid()) @db.VarChar(36)
  code         String             @unique @db.VarChar(50)
  name         String             @db.VarChar(255)
  category     SalaryItemCategory
  description  String?            @db.Text
  defaultRate  Decimal?           @map("default_rate") @db.Decimal(5, 2)
  hasInsurance Boolean            @default(false) @map("has_insurance")
  isTaxable    Boolean            @default(true) @map("is_taxable")
  status       SalaryItemStatus   @default(ACTIVE)
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt @map("updated_at")

  structureItems     SalaryStructureItem[]
  employeeSalaryItem EmployeeSalaryItem[]

  @@map("hrm_salary_items")
}
```

### 3.2. Bảng `hrm_salary_structures` (Cấu trúc lương khung)
```prisma
model SalaryStructure {
  id            String    @id @default(cuid()) @db.VarChar(36)
  name          String    @db.VarChar(255)
  description   String?   @db.Text
  effectiveFrom DateTime  @map("effective_from") @db.Date
  effectiveTo   DateTime? @map("effective_to") @db.Date
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  items SalaryStructureItem[]

  @@map("hrm_salary_structures")
}
```

### 3.3. Bảng `hrm_salary_structure_items` (Khoản trong cấu trúc khung)
```prisma
model SalaryStructureItem {
  id                String            @id @default(cuid()) @db.VarChar(36)
  salaryStructureId String            @map("salary_structure_id") @db.VarChar(36)
  salaryItemId      String            @map("salary_item_id") @db.VarChar(36)
  taxTreatment      TaxTreatment      @default(TAXABLE) @map("tax_treatment")
  isOvertimeBase    Boolean           @default(false) @map("is_overtime_base")
  calculationMethod CalculationMethod @default(FIXED_MONTHLY) @map("calculation_method")
  defaultAmount     Decimal?          @map("default_amount") @db.Decimal(15, 2)

  salaryStructure SalaryStructure @relation(fields: [salaryStructureId], references: [id], onDelete: Cascade)
  salaryItem      SalaryItem      @relation(fields: [salaryItemId], references: [id], onDelete: Restrict)

  @@unique([salaryStructureId, salaryItemId])
  @@map("hrm_salary_structure_items")
}
```

### 3.4. Bảng `hrm_employee_salaries` (Lương thiết lập của nhân viên)
```prisma
model EmployeeSalary {
  id            String               @id @default(cuid()) @db.VarChar(36)
  ma_nv         String               @unique @db.VarChar(24)
  totalAmount   Decimal              @default(0) @map("total_amount") @db.Decimal(15, 2)
  setupVersion  Int                  @default(1) @map("setup_version")
  status        SalaryApprovalStatus @default(PENDING_APPROVAL)
  effectiveDate DateTime             @default(now()) @map("effective_date") @db.Date
  note          String?              @db.Text
  createdAt     DateTime             @default(now()) @map("created_at")
  updatedAt     DateTime             @updatedAt @map("updated_at")

  nhan_vien hrm_nhan_vien        @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  items     EmployeeSalaryItem[]

  @@map("hrm_employee_salaries")
}
```

### 3.5. Bảng `hrm_employee_salary_items` (Chi tiết khoản lương của nhân viên)
```prisma
model EmployeeSalaryItem {
  id               String  @id @default(cuid()) @db.VarChar(36)
  employeeSalaryId String  @map("employee_salary_id") @db.VarChar(36)
  salaryItemId     String  @map("salary_item_id") @db.VarChar(36)
  amount           Decimal @default(0) @db.Decimal(15, 2)

  employeeSalary EmployeeSalary @relation(fields: [employeeSalaryId], references: [id], onDelete: Cascade)
  salaryItem     SalaryItem     @relation(fields: [salaryItemId], references: [id], onDelete: Restrict)

  @@unique([employeeSalaryId, salaryItemId])
  @@map("hrm_employee_salary_items")
}
```

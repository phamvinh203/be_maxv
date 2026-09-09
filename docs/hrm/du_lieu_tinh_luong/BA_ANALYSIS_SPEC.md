# BÁO CÁO PHÂN TÍCH NGHIỆP VỤ & ĐỐI CHIẾU HỆ THỐNG (BA SPECIFICATION & GAP ANALYSIS)
## PHÂN HỆ: DỮ LIỆU TÍNH LƯƠNG (PAYROLL INPUT DATA) — ERP MAXV_V2

> **Người thực hiện**: Senior Business Analyst (BA) Agent  
> **Ngày báo cáo**: 2026-09-09  
> **Dự án**: ERP maxv_v2 (`be_maxv` Multi-tenant Fastify & `hdđt_maxv` React/MUI Frontend)  
> **Tài liệu nguồn nghiên cứu**:
> - Đặc tả gốc tại `docs/nestjs/du_lieu_tinh_luong/` (SRS, Flows, States, ERD, Data Model, API Contract, Test Cases, Context Summary)
> - Frontend Mock Components tại `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/` (8 phân hệ)
> - Frontend Mock Hooks tại `hdđt_maxv/src/features/hrm/mock/hooks/`
> - Mã nguồn Backend hiện tại tại `be_maxv` (Fastify multi-tenant, Prisma tenant schema, routes, controllers, services, validators)
> **Đường dẫn lưu trữ**: `docs/hrm/du_lieu_tinh_luong/BA_ANALYSIS_SPEC.md`

---

## 1. TỔNG QUAN & BỐI CẢNH DỰ ÁN (EXECUTIVE SUMMARY)

Phân hệ **Dữ liệu tính lương (`du_lieu_tinh_luong`)** là "trái tim" thu thập và chuẩn hóa dữ liệu biến động phát sinh trong kỳ lương của hệ thống HRM ERP maxv_v2. Toàn bộ 8 khối dữ liệu nhập liệu:
1. **Chấm công (`cham_cong`)**: Ma trận ngày công, vắng, nghỉ phép, nghỉ ốm, lễ tết.
2. **Tăng ca (`tang_ca`)**: 6 loại giờ làm thêm giờ (150% - 390%), kiểm soát trần 40h/tháng & 300h/năm.
3. **Đánh giá KPI (`kpi`)**: Tỷ lệ hoàn thành mục tiêu theo trọng số, tính hiệu suất % bình quân.
4. **Thưởng (`thuong`)**: Thưởng định kỳ, hiệu quả, dự án (tái sử dụng `SalaryItem` loại `PERIODIC_BONUS`).
5. **Lương sản phẩm (`luong_san_pham`)**: Khối lượng công việc nghiệm thu × đơn giá snapshot theo kỳ.
6. **Lương phần trăm (`luong_phan_tram`)**: Doanh số cơ sở × tỷ lệ hoa hồng snapshot theo kỳ.
7. **Lương chuyên cần (`chuyen_can`)**: Phụ cấp chuyên cần trừ vi phạm (theo giờ, theo lần, mất toàn bộ), chặn sàn không âm.
8. **Ứng - Bù trừ (`bu_tru`)**: Tạm ứng, truy thu, phạt (chiều trừ) và truy lĩnh, hoàn bảo hiểm (chiều bù).

Tất cả 8 nguồn này hội tụ vào **Bộ tính toán bảng lương tổng hợp 18 cột** (`PayrollCalculationEngine`), kết hợp với Master Data nhân sự (`hrm_nhan_vien`), Hợp đồng lao động (`hrm_hop_dong`), Người phụ thuộc (`hrm_nguoi_phu_thuoc`), Cấu hình mặc định (`hrm_general_settings` - biểu thuế 7 bậc, tỷ lệ bảo hiểm, đoàn phí, ngày công chuẩn) và Lịch ngày lễ (`hrm_holidays`).

### Hiện trạng đối chiếu kỹ thuật:
- **Tài liệu thiết kế trước đây (`docs/nestjs/...`)**: Được viết trên giả định hệ thống dùng NestJS với UUID cho khóa chính (`employeeId`, `departmentId`).
- **Thực tế hệ thống hiện tại (`be_maxv`)**:
  * Chạy trên nền tảng **Node.js Fastify + TypeScript**, hỗ trợ kiến trúc **PostgreSQL Multi-tenant** động (`db_<MST>`).
  * Thực thể Nhân viên là `hrm_nhan_vien` với Primary Key là mã ký tự tự nhiên `ma_nv String @db.VarChar(24)` (VD: "NV0001"), KHÔNG phải UUID.
  * Thực thể Phòng ban là `hrm_phong_ban` với Primary Key là `ma_pb String @db.VarChar(24)`.
  * Thực thể Khoản lương đã có sẵn: `hrm_salary_items` với `id String @id @default(uuid()) @db.VarChar(64)` và `code String @unique @db.VarChar(20)`.
  * Toàn bộ 14 models dữ liệu cho `du_lieu_tinh_luong` và bảng lương tổng hợp **CHƯA CÓ TRONG TENANT SCHEMA** của `be_maxv`.
  * Frontend `hdđt_maxv` đã xây dựng hoàn chỉnh 8 màn hình mock component cực kỳ chi tiết, thanh lọc kỳ lương dùng chung (`ThanhLocKyLuong`), dialogs quản lý danh mục con, dialogs tái sử dụng và bộ tiện ích xử lý Excel.

---

## 2. KHOẢNG TRỐNG THỰC THỂ & MÔ HÌNH DỮ LIỆU CẦN THÊM VÀO `schema.prisma`

### 2.1. Phân tích Khoảng trống (Gap Analysis)
1. **Khóa ngoại Nhân viên (`ma_nv` vs `employeeId`)**:
   - Tài liệu NestJS: Dùng `employeeId UUID` liên kết `Employee.id`.
   - **Thực tế `be_maxv`**: Phải dùng `ma_nv String @db.VarChar(24)` tham chiếu khóa chính của `hrm_nhan_vien(ma_nv)`.
2. **Quy ước đặt tên bảng và ánh xạ (Table Mapping Convention)**:
   - Mọi bảng trong tenant database của `be_maxv` thuộc HRM đều có tiền tố `hrm_` (như `hrm_nhan_vien`, `hrm_phong_ban`, `hrm_general_settings`, `hrm_salary_items`).
   - Tên model Prisma đặt dạng PascalCase chuẩn mực và dùng `@@map("hrm_...")` để ánh xạ xuống PostgreSQL.
3. **Triết lý Danh mục lai (ADR-001 Hybrid Catalog)**:
   - **Thưởng**: Tái sử dụng bảng `SalaryItem` (`hrm_salary_items`) có sẵn, lọc loại `PERIODIC_BONUS` (ở FE gọi là `luong_thuong`).
   - **Lương phần trăm**: Tái sử dụng bảng `SalaryItem` (`hrm_salary_items`) có sẵn, lọc loại `COMMISSION_PERCENTAGE` (ở FE gọi là `luong_phan_tram`), đọc `defaultRate` làm tỷ lệ mặc định.
   - **4 Danh mục chuyên biệt cần tạo mới**:
     * `KpiItem` (`hrm_kpi_items`): `code` (`KPI01..KPI99`), `name`, `unit`, `defaultWeight`, `status`.
     * `PieceworkProduct` (`hrm_piecework_products`): `code` (`SP01..SP99`), `name`, `unit`, `unitPrice`, `status`.
     * `DiligenceViolationType` (`hrm_diligence_violation_types`): `code` (`CC01..CC99`), `name`, `deductionMethod` (`theo_gio`, `theo_lan`, `mat_toan_bo`), `penaltyRate`, `status`.
     * `SalaryAdjustmentItem` (`hrm_salary_adjustment_items`): `code` (`BT01..BT99`), `name`, `direction` (`tru`, `bu`), `status`.

### 2.2. Chi tiết 6 Enums cần thêm vào `be_maxv/prisma/tenant/schema.prisma`

```prisma
// ============================================================
// HRM › DỮ LIỆU TÍNH LƯƠNG: CÁC ENUM NGHIỆP VỤ
// ============================================================

/// Vòng đời 6 trạng thái của Kỳ tính lương (BR-dltl-001)
enum PayrollPeriodStatus {
  DRAFT          // Đang soạn thảo, mở toàn quyền chỉnh sửa 8 phân hệ
  PENDING_REVIEW // Đã gửi đối soát, chờ Kế toán trưởng duyệt
  LOCKED         // Đã khóa sổ, dữ liệu 8 phân hệ đóng băng (Immutable), chốt snapshot bảng lương
  APPROVED       // Ban Giám Đốc ký duyệt, sẵn sàng giải ngân
  PAID           // Đã thanh toán chuyển khoản ngân hàng & phát hành phiếu lương
  ARCHIVED       // Đã lưu trữ kế toán & quyết toán năm, bất biến vĩnh viễn
}

/// 8 loại ngày công theo chuẩn chấm công doanh nghiệp (SRS Mục 3.1)
enum AttendanceType {
  lam_viec    // Làm việc cả ngày (1.0 công)
  nua_ngay    // Làm việc nửa ngày (0.5 công)
  cong_tac    // Đi công tác hưởng 100% lương (1.0 công)
  nghi_phep   // Nghỉ phép năm hưởng lương (1.0 công)
  nghi_le     // Nghỉ lễ/tết hưởng lương (1.0 công)
  om          // Nghỉ ốm đau hưởng chế độ BHXH (0 công doanh nghiệp)
  khong_luong // Nghỉ việc riêng không hưởng lương (0 công)
  khac        // Nghỉ lý do khác (0 công)
}

/// 6 loại làm thêm giờ theo Điều 98 & 107 Bộ luật Lao động 2019 (SRS Mục 3.2)
enum OvertimeType {
  ngay_thuong_ngay // Ngày thường - Ban ngày (150%)
  ngay_thuong_dem  // Ngày thường - Ban đêm (200%)
  chu_nhat_ngay    // Nghỉ hàng tuần - Ban ngày (200%)
  chu_nhat_dem     // Nghỉ hàng tuần - Ban đêm (270%)
  ngay_le_ngay     // Nghỉ lễ/tết - Ban ngày (300%)
  ngay_le_dem      // Nghỉ lễ/tết - Ban đêm (390%)
}

/// Phương thức khấu trừ lỗi chuyên cần (SRS Mục 3.7)
enum DiligenceDeductionMethod {
  theo_gio    // Trừ theo số giờ vi phạm: mucTru * soGio (đi trễ, về sớm)
  theo_lan    // Trừ cố định theo số lần vi phạm: mucTru (quên chấm công, sai đồng phục)
  mat_toan_bo // Mất toàn bộ khoản phụ cấp chuyên cần trong kỳ (nghỉ không phép)
}

/// Chiều điều chỉnh của khoản ứng - bù trừ lương (SRS Mục 3.8)
enum AdjustmentDirection {
  tru // Khấu trừ: Tạm ứng lương, phạt nội quy, trừ tiền ăn
  bu  // Cộng bù: Truy lĩnh kỳ trước, hoàn trả chênh lệch bảo hiểm/công đoàn
}

/// Trạng thái hoạt động của danh mục (KPI, Sản phẩm, Chuyên cần, Bù trừ)
enum CatalogStatus {
  ACTIVE   // Đang sử dụng
  INACTIVE // Ngừng sử dụng
}
```

### 2.3. Chi tiết 14 Models cần thêm vào `be_maxv/prisma/tenant/schema.prisma`

```prisma
// ============================================================
// HRM › DỮ LIỆU TÍNH LƯƠNG: KỲ LƯƠNG, 8 PHÂN HỆ BIẾN ĐỘNG & BẢNG LƯƠNG
// ============================================================

/// 1. Kỳ tính lương (PayrollPeriod)
model PayrollPeriod {
  id               String              @id @default(uuid()) @db.VarChar(64)
  code             String              @unique @db.VarChar(20) // Định dạng YYYY-MM
  name             String              @db.VarChar(100)
  month            Int
  year             Int
  startDate        DateTime            @db.Date
  endDate          DateTime            @db.Date
  status           PayrollPeriodStatus @default(DRAFT)

  lockedByUserId   String?             @db.VarChar(64)
  lockedAt         DateTime?
  approvedByUserId String?             @db.VarChar(64)
  approvedAt       DateTime?

  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @default(now()) @updatedAt

  attendanceRecords   AttendanceRecord[]
  overtimeRecords     OvertimeRecord[]
  kpiRecords          KpiRecord[]
  bonusRecords        BonusRecord[]
  pieceworkRecords    PieceworkRecord[]
  commissionRecords   CommissionRecord[]
  diligenceRecords    DiligenceRecord[]
  adjustmentRecords   SalaryAdjustmentRecord[]
  payrollSheetLines   PayrollSheetLine[]

  @@index([status])
  @@index([year, month])
  @@map("hrm_payroll_periods")
}

/// 2. Bảng Chấm công chi tiết theo ngày (AttendanceRecord)
model AttendanceRecord {
  id             String         @id @default(uuid()) @db.VarChar(64)
  periodId       String         @db.VarChar(64)
  ma_nv          String         @db.VarChar(24)
  workDate       DateTime       @db.Date
  attendanceType AttendanceType
  actualHours    Decimal        @default(8.00) @db.Decimal(4, 2)
  workDayValue   Decimal        @default(1.00) @db.Decimal(3, 2)
  note           String?        @db.VarChar(500)

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @default(now()) @updatedAt

  period         PayrollPeriod  @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien      hrm_nhan_vien  @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)

  @@unique([periodId, ma_nv, workDate])
  @@index([periodId, ma_nv])
  @@index([workDate])
  @@map("hrm_attendance_records")
}

/// 3. Bảng Tăng ca ngoài giờ (OvertimeRecord)
model OvertimeRecord {
  id             String        @id @default(uuid()) @db.VarChar(64)
  periodId       String        @db.VarChar(64)
  ma_nv          String        @db.VarChar(24)
  otType         OvertimeType
  hours          Decimal       @db.Decimal(5, 2)
  ratePercent    Decimal       @db.Decimal(5, 2) // Snapshot hệ số từ GeneralSetting
  convertedHours Decimal       @db.Decimal(6, 2) // Giờ quy đổi = hours * ratePercent / 100
  note           String?       @db.VarChar(500)

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @default(now()) @updatedAt

  period         PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien      hrm_nhan_vien @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)

  @@unique([periodId, ma_nv, otType])
  @@index([periodId, ma_nv])
  @@map("hrm_overtime_records")
}

/// 4. Danh mục Chỉ tiêu KPI (KpiItem)
model KpiItem {
  id            String        @id @default(uuid()) @db.VarChar(64)
  code          String        @unique @db.VarChar(20) // KPI01..KPI99
  name          String        @db.VarChar(200)
  unit          String        @db.VarChar(50)
  defaultWeight Int           @default(100)
  status        CatalogStatus @default(ACTIVE)

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @default(now()) @updatedAt

  records       KpiRecord[]

  @@index([status])
  @@map("hrm_kpi_items")
}

/// 5. Bảng Đánh giá KPI nhân viên theo kỳ (KpiRecord)
model KpiRecord {
  id             String        @id @default(uuid()) @db.VarChar(64)
  periodId       String        @db.VarChar(64)
  ma_nv          String        @db.VarChar(24)
  kpiItemId      String        @db.VarChar(64)
  weight         Int           @default(100)
  targetValue    Decimal       @db.Decimal(12, 2)
  actualValue    Decimal       @db.Decimal(12, 2)
  completionRate Decimal       @db.Decimal(6, 2) // actualValue / targetValue * 100
  note           String?       @db.VarChar(500)

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @default(now()) @updatedAt

  period         PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien      hrm_nhan_vien @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  kpiItem        KpiItem       @relation(fields: [kpiItemId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, kpiItemId])
  @@index([periodId, ma_nv])
  @@index([kpiItemId])
  @@map("hrm_kpi_records")
}

/// 6. Bảng Thưởng nhân viên theo kỳ (BonusRecord)
model BonusRecord {
  id           String        @id @default(uuid()) @db.VarChar(64)
  periodId     String        @db.VarChar(64)
  ma_nv        String        @db.VarChar(24)
  salaryItemId String        @db.VarChar(64) // FK tới hrm_salary_items
  amount       Decimal       @default(0) @db.Decimal(18, 2) // Mức tiền thưởng (VND >= 0)
  note         String?       @db.VarChar(500)

  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @default(now()) @updatedAt

  period       PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien    hrm_nhan_vien @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  salaryItem   SalaryItem    @relation(fields: [salaryItemId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, salaryItemId])
  @@index([periodId, ma_nv])
  @@index([salaryItemId])
  @@map("hrm_bonus_records")
}

/// 7. Danh mục Sản phẩm / Công việc khoán (PieceworkProduct)
model PieceworkProduct {
  id        String        @id @default(uuid()) @db.VarChar(64)
  code      String        @unique @db.VarChar(20) // SP01..SP99
  name      String        @db.VarChar(200)
  unit      String        @db.VarChar(50)
  unitPrice Decimal       @default(0) @db.Decimal(18, 2)
  status    CatalogStatus @default(ACTIVE)

  createdAt DateTime      @default(now())
  updatedAt DateTime      @default(now()) @updatedAt

  records   PieceworkRecord[]

  @@index([status])
  @@map("hrm_piecework_products")
}

/// 8. Bảng Lương sản phẩm nghiệm thu theo kỳ (PieceworkRecord)
model PieceworkRecord {
  id          String           @id @default(uuid()) @db.VarChar(64)
  periodId    String           @db.VarChar(64)
  ma_nv       String           @db.VarChar(24)
  productId   String           @db.VarChar(64)
  unitPrice   Decimal          @db.Decimal(18, 2) // Snapshot đơn giá theo kỳ
  quantity    Decimal          @db.Decimal(10, 2) // Sản lượng nghiệm thu >= 0
  totalAmount Decimal          @db.Decimal(18, 2) // round(unitPrice * quantity)
  note        String?          @db.VarChar(500)

  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @default(now()) @updatedAt

  period      PayrollPeriod    @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien   hrm_nhan_vien    @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  product     PieceworkProduct @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, productId])
  @@index([periodId, ma_nv])
  @@index([productId])
  @@map("hrm_piecework_records")
}

/// 9. Bảng Lương phần trăm / Hoa hồng doanh số theo kỳ (CommissionRecord)
model CommissionRecord {
  id             String        @id @default(uuid()) @db.VarChar(64)
  periodId       String        @db.VarChar(64)
  ma_nv          String        @db.VarChar(24)
  salaryItemId   String        @db.VarChar(64) // FK tới hrm_salary_items
  baseAmount     Decimal       @db.Decimal(18, 2) // Doanh số cơ sở >= 0
  commissionRate Decimal       @db.Decimal(5, 2)  // Snapshot tỷ lệ % theo kỳ (0..100)
  totalAmount    Decimal       @db.Decimal(18, 2) // round(baseAmount * rate / 100)
  note           String?       @db.VarChar(500)

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @default(now()) @updatedAt

  period         PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien      hrm_nhan_vien @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  salaryItem     SalaryItem    @relation(fields: [salaryItemId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, salaryItemId])
  @@index([periodId, ma_nv])
  @@index([salaryItemId])
  @@map("hrm_commission_records")
}

/// 10. Danh mục Loại vi phạm chuyên cần (DiligenceViolationType)
model DiligenceViolationType {
  id              String                   @id @default(uuid()) @db.VarChar(64)
  code            String                   @unique @db.VarChar(20) // CC01..CC99
  name            String                   @db.VarChar(200)
  deductionMethod DiligenceDeductionMethod
  penaltyRate     Decimal                  @default(0) @db.Decimal(18, 2)
  status          CatalogStatus            @default(ACTIVE)

  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @default(now()) @updatedAt

  records         DiligenceRecord[]

  @@index([status])
  @@map("hrm_diligence_violation_types")
}

/// 11. Bảng Vi phạm Chuyên cần theo kỳ (DiligenceRecord)
model DiligenceRecord {
  id              String                 @id @default(uuid()) @db.VarChar(64)
  periodId        String                 @db.VarChar(64)
  ma_nv           String                 @db.VarChar(24)
  violationTypeId String                 @db.VarChar(64)
  violationDate   DateTime               @db.Date
  violationHours  Decimal?               @db.Decimal(4, 2) // Giờ vi phạm nếu là theo_gio
  note            String?                @db.VarChar(500)

  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @default(now()) @updatedAt

  period          PayrollPeriod          @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien       hrm_nhan_vien          @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  violationType   DiligenceViolationType @relation(fields: [violationTypeId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, violationTypeId, violationDate])
  @@index([periodId, ma_nv])
  @@index([violationTypeId])
  @@index([violationDate])
  @@map("hrm_diligence_records")
}

/// 12. Danh mục Khoản ứng - bù trừ lương (SalaryAdjustmentItem)
model SalaryAdjustmentItem {
  id        String              @id @default(uuid()) @db.VarChar(64)
  code      String              @unique @db.VarChar(20) // BT01..BT99
  name      String              @db.VarChar(200)
  direction AdjustmentDirection
  status    CatalogStatus       @default(ACTIVE)

  createdAt DateTime            @default(now())
  updatedAt DateTime            @default(now()) @updatedAt

  records   SalaryAdjustmentRecord[]

  @@index([direction])
  @@index([status])
  @@map("hrm_salary_adjustment_items")
}

/// 13. Bảng Chi tiết Ứng - Bù trừ theo kỳ (SalaryAdjustmentRecord)
model SalaryAdjustmentRecord {
  id               String               @id @default(uuid()) @db.VarChar(64)
  periodId         String               @db.VarChar(64)
  ma_nv            String               @db.VarChar(24)
  adjustmentItemId String               @db.VarChar(64)
  amount           Decimal              @db.Decimal(18, 2) // Luôn là số dương > 0
  note             String?              @db.VarChar(500)

  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @default(now()) @updatedAt

  period           PayrollPeriod        @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien        hrm_nhan_vien        @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)
  adjustmentItem   SalaryAdjustmentItem @relation(fields: [adjustmentItemId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, adjustmentItemId])
  @@index([periodId, ma_nv])
  @@index([adjustmentItemId])
  @@map("hrm_salary_adjustment_records")
}

/// 14. Bảng Lương Tổng hợp Snapshot (PayrollSheetLine)
model PayrollSheetLine {
  id                          String        @id @default(uuid()) @db.VarChar(64)
  periodId                    String        @db.VarChar(64)
  ma_nv                       String        @db.VarChar(24)

  // Thông tin nhân sự snapshot tại thời điểm chốt sổ
  employeeCode                String        @db.VarChar(24)
  fullName                    String        @db.VarChar(254)
  departmentName              String?       @db.VarChar(254)
  positionName                String?       @db.VarChar(100)
  contractType                String?       @db.VarChar(24)
  salaryType                  String?       @db.VarChar(8)  // GROSS | NET
  dependentCount              Int           @default(0)

  // Dữ liệu công & OT
  baseSalaryMonthly           Decimal       @default(0) @db.Decimal(18, 2)
  standardWorkDays            Decimal       @db.Decimal(4, 2)
  actualWorkDays              Decimal       @db.Decimal(4, 2)
  otConvertedHours            Decimal       @db.Decimal(6, 2)

  // 8 thành phần thu nhập phát sinh trong kỳ
  otAmount                    Decimal       @default(0) @db.Decimal(18, 2)
  proratedWorkSalary          Decimal       @default(0) @db.Decimal(18, 2)
  pieceworkSalary             Decimal       @default(0) @db.Decimal(18, 2)
  bonusSalary                 Decimal       @default(0) @db.Decimal(18, 2)
  kpiSalary                   Decimal       @default(0) @db.Decimal(18, 2)
  commissionSalary            Decimal       @default(0) @db.Decimal(18, 2)
  diligenceSalary             Decimal       @default(0) @db.Decimal(18, 2)
  grossIncome                 Decimal       @default(0) @db.Decimal(18, 2)

  // Giảm trừ, bảo hiểm & thuế
  taxableIncome               Decimal       @default(0) @db.Decimal(18, 2)
  insuranceSalaryBase         Decimal       @default(0) @db.Decimal(18, 2)
  employeeInsuranceDeduction  Decimal       @default(0) @db.Decimal(18, 2)
  companyInsuranceExpense     Decimal       @default(0) @db.Decimal(18, 2)
  employeeUnionFee            Decimal       @default(0) @db.Decimal(18, 2)
  companyUnionExpense         Decimal       @default(0) @db.Decimal(18, 2)

  // Bù trừ & Thực lĩnh (netTakeHomeSalary có thể âm phản ánh công nợ)
  adjustmentNetAmount         Decimal       @default(0) @db.Decimal(18, 2)
  personalIncomeTax           Decimal       @default(0) @db.Decimal(18, 2)
  netTakeHomeSalary           Decimal       @default(0) @db.Decimal(18, 2)
  totalCompanyCost            Decimal       @default(0) @db.Decimal(18, 2)

  createdAt                   DateTime      @default(now())
  updatedAt                   DateTime      @default(now()) @updatedAt

  period                      PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien                   hrm_nhan_vien @relation(fields: [ma_nv], references: [ma_nv], onDelete: Cascade)

  @@unique([periodId, ma_nv])
  @@index([periodId])
  @@index([ma_nv])
  @@map("hrm_payroll_sheet_lines")
}
```

---

## 3. ĐỐI CHIẾU 8 MOCK COMPONENTS & HOOKS FRONTEND VỚI BACKEND

| STT | Phân hệ Frontend | Tệp Component & Hooks UI | Hành vi Frontend hiện tại | Yêu cầu Xử lý Backend Fastify tương ứng |
|:---:|---|---|---|---|
| **1** | **Chấm công** | `cham_cong/ChamCongPanel.tsx`<br>`cham_cong/OChamCongPopover.tsx`<br>`mock/hooks/chamCong.ts` | Hiển thị ma trận 31 ngày; tính tự động công chuẩn từ lịch nghỉ; click ô mở Popover chọn loại công hoặc nhập giờ lẻ; nút "Đặt lại theo lịch chuẩn". | - `GET /hrm/payroll-data/attendance/matrix`: Trả về thông tin tháng, lịch công chuẩn & ma trận delta của nhân viên.<br>- `PUT /hrm/payroll-data/attendance/cell`: Lưu delta ô công (tính `workDayValue = actualHours / 8.0`).<br>- `POST /hrm/payroll-data/attendance/batch-override`: Ghi đè nhiều ngày. |
| **2** | **Tăng ca** | `tang_ca/TangCaPanel.tsx`<br>`tang_ca/BangTangCaCard.tsx`<br>`tang_ca/DanhSachTangCaCard.tsx`<br>`tang_ca/QuanLyTangCaDialog.tsx`<br>`tang_ca/TaiSuDungTangCaDialog.tsx`<br>`tang_ca/tangCaExcel.ts` | Soạn bảng nháp tăng ca; chọn 6 loại OT; cảnh báo vượt trần 40h/tháng & 300h/năm; áp dụng cho danh sách nhân viên; tái sử dụng bảng của NV khác; Excel IO. | - `GET /hrm/payroll-data/overtime`: Danh sách tăng ca kèm giờ quy đổi & cảnh báo trần.<br>- `POST /hrm/payroll-data/overtime/apply`: Áp dụng bảng OT cho danh sách `ma_nv` theo 3 phạm vi.<br>- Snapshot hệ số từ `GeneralSetting`. |
| **3** | **KPI** | `kpi/KpiPanel.tsx`<br>`kpi/BangChiTieuKpiCard.tsx`<br>`kpi/DanhSachKpiCard.tsx`<br>`kpi/QuanLyKpiDialog.tsx`<br>`kpi/TaiSuDungKpiDialog.tsx`<br>`kpi/kpiExcel.ts` | Quản lý danh mục chỉ tiêu (`KPI01..KPI99`); soạn bảng mục tiêu & thực thi; tính hiệu suất % bình quân; nhân mức lương KPI từ Set lương; tái sử dụng; Excel IO. | - CRUD `/hrm/payroll-catalogs/kpi-items`.<br>- `GET /hrm/payroll-data/kpi`: Danh sách đánh giá & hiệu suất.<br>- `POST /hrm/payroll-data/kpi/apply`: Áp dụng bảng KPI hàng loạt.<br>- Validate tổng trọng số $> 0$, mục tiêu $> 0$. |
| **4** | **Thưởng** | `thuong/ThuongPanel.tsx`<br>`thuong/BangKhoanThuongCard.tsx`<br>`thuong/DanhSachThuongCard.tsx`<br>`thuong/QuanLyThuongDialog.tsx`<br>`thuong/TaiSuDungThuongDialog.tsx`<br>`thuong/thuongExcel.ts` | Chọn khoản thưởng từ `SalaryItem` (`PERIODIC_BONUS`); tính tổng quỹ nhóm; áp dụng theo 3 phạm vi; tái sử dụng; Excel IO. | - Lấy danh mục qua `/hrm/salary-items?category=PERIODIC_BONUS`.<br>- `GET /hrm/payroll-data/bonus`.<br>- `POST /hrm/payroll-data/bonus/apply`.<br>- Chặn tiền thưởng âm (`E-dltl-012`), không trùng khoản (`E-dltl-011`). |
| **5** | **Lương sản phẩm** | `luong_san_pham/LuongSanPhamPanel.tsx`<br>`luong_san_pham/BangSanPhamCard.tsx`<br>`luong_san_pham/DanhSachLuongSanPhamCard.tsx`<br>`luong_san_pham/QuanLySanPhamDialog.tsx`<br>`luong_san_pham/TaiSuDungSanPhamDialog.tsx`<br>`luong_san_pham/luongSanPhamExcel.ts` | Quản lý danh mục sản phẩm (`SP01..SP99`); cho phép sửa đơn giá snapshot trên bảng nháp; nhập số lượng; tính thành tiền; áp dụng theo 3 phạm vi; tái sử dụng; Excel IO. | - CRUD `/hrm/payroll-catalogs/products`.<br>- `GET /hrm/payroll-data/piecework`.<br>- `POST /hrm/payroll-data/piecework/apply`.<br>- Snapshot `unitPrice` độc lập theo kỳ (`BR-dltl-012`). |
| **6** | **Lương phần trăm** | `luong_phan_tram/LuongPhanTramPanel.tsx`<br>`luong_phan_tram/BangPhanTramCard.tsx`<br>`luong_phan_tram/DanhSachLuongPhanTramCard.tsx`<br>`luong_phan_tram/QuanLyPhanTramDialog.tsx`<br>`luong_phan_tram/TaiSuDungPhanTramDialog.tsx`<br>`luong_phan_tram/luongPhanTramExcel.ts` | Chọn khoản hoa hồng từ `SalaryItem` (`COMMISSION_PERCENTAGE`); snapshot tỷ lệ %; nhập doanh số cơ sở; tính thành tiền hoa hồng; áp dụng 3 phạm vi; tái sử dụng; Excel IO. | - Lấy danh mục qua `/hrm/salary-items?category=COMMISSION_PERCENTAGE`.<br>- `GET /hrm/payroll-data/commission`.<br>- `POST /hrm/payroll-data/commission/apply`.<br>- Snapshot `commissionRate` độc lập theo kỳ (`BR-dltl-015`). |
| **7** | **Chuyên cần** | `chuyen_can/ChuyenCanPanel.tsx`<br>`chuyen_can/BangChuyenCanCard.tsx`<br>`chuyen_can/DanhSachChuyenCanCard.tsx`<br>`chuyen_can/QuanLyChuyenCanDialog.tsx`<br>`chuyen_can/TaiSuDungChuyenCanDialog.tsx`<br>`chuyen_can/chuyenCanExcel.ts` | Quản lý danh mục lỗi (`CC01..CC99`, 3 cách trừ); tra đơn giá từ Set lương; cho phép ghi nhận trùng lỗi nhưng khác ngày; tính tổng phạt; chặn sàn không âm; bảng rỗng hưởng 100%. | - CRUD `/hrm/payroll-catalogs/diligence-types`.<br>- `GET /hrm/payroll-data/diligence`.<br>- `POST /hrm/payroll-data/diligence/record`.<br>- Bắt buộc chặn sàn $\text{tong\_tru} = \min(\sum \text{phat}, \text{don\_gia})$ (`BR-dltl-016`). |
| **8** | **Ứng - Bù trừ** | `bu_tru/BuTruPanel.tsx`<br>`bu_tru/BangBuTruCard.tsx`<br>`bu_tru/DanhSachBuTruCard.tsx`<br>`bu_tru/QuanLyBuTruDialog.tsx`<br>`bu_tru/TaiSuDungBuTruDialog.tsx`<br>`bu_tru/buTruExcel.ts` | Quản lý danh mục bù trừ (`BT01..BT99`, chiều trừ/bù); nhập số tiền dương $>0$; tính tổng bị trừ ròng (âm là nhận thêm); áp dụng 3 phạm vi; tái sử dụng; Excel IO. | - CRUD `/hrm/payroll-catalogs/adjustment-items`.<br>- `GET /hrm/payroll-data/adjustments`.<br>- `POST /hrm/payroll-data/adjustments/apply`.<br>- `tongBiTru = sum(tru) - sum(bu)` tác động trực tiếp vào Thực lĩnh. |
| **Chung** | **Thanh lọc & Bảng lương** | `ThanhLocKyLuong.tsx`<br>`DuLieuLuongNav.tsx`<br>`mock/hooks/kyLuong.ts`<br>`mock/hooks/bangLuong.ts` | Chọn phạm vi (`toan_cong_ty`, `phong_ban`, `nhan_vien`); bộ lọc `q`, `ma_pb`, `loai_hd`; tính toán thử nghiệm bảng lương 18 cột; khóa sổ kỳ; mở lại kỳ lương (`reopen`). | - `GET /hrm/payroll-periods`.<br>- `POST /hrm/payroll-periods/:id/lock`.<br>- `POST /hrm/payroll-periods/:id/reopen`.<br>- `GET /hrm/payroll/calculate` (Preview).<br>- `GET /hrm/payroll/sheet-lines` (Snapshot). |

---

## 4. QUY HOẠCH DANH MỤC API ENDPOINTS CHO `be_maxv` (FASTIFY)

Toàn bộ route được đặt dưới plugin `hrmRoutes` với tiền tố chung `/api/v1/hrm` (theo `be_maxv/src/routes/index.route.ts`), được bảo vệ tự động bằng hook `app.authenticate` và `requireModule('hrm')`.

### 4.1. Nhóm Kỳ Lương (`/api/v1/hrm/payroll-periods`)
- `GET /api/v1/hrm/payroll-periods`: Danh sách các kỳ lương (Query: `year`, `status`).
- `POST /api/v1/hrm/payroll-periods`: Tạo mới kỳ lương (Body: `{ month, year, name }`). Tự động sinh lịch công chuẩn từ `GeneralSetting` và `Holiday`.
- `GET /api/v1/hrm/payroll-periods/:id`: Chi tiết kỳ lương, trạng thái, người duyệt/khóa.
- `DELETE /api/v1/hrm/payroll-periods/:id`: Xóa kỳ lương nháp (chỉ khi `DRAFT`).
- `POST /api/v1/hrm/payroll-periods/:id/submit`: Gửi đối soát (`DRAFT` -> `PENDING_REVIEW`).
- `POST /api/v1/hrm/payroll-periods/:id/reject`: Từ chối đối soát (`PENDING_REVIEW` -> `DRAFT`).
- `POST /api/v1/hrm/payroll-periods/:id/lock`: Khóa sổ kỳ lương, kích hoạt chốt snapshot vào `hrm_payroll_sheet_lines` (`PENDING_REVIEW` -> `LOCKED`).
- `POST /api/v1/hrm/payroll-periods/:id/reopen`: Mở lại kỳ lương đã khóa (chỉ `ADMIN`, yêu cầu `reason` $\ge 20$ ký tự, ghi Audit Log).
- `POST /api/v1/hrm/payroll-periods/:id/approve`: Phê duyệt bảng lương (`LOCKED` -> `APPROVED`).
- `POST /api/v1/hrm/payroll-periods/:id/mark-paid`: Đánh dấu đã chi trả (`APPROVED` -> `PAID`).
- `POST /api/v1/hrm/payroll-periods/:id/archive`: Lưu trữ kế toán (`PAID` -> `ARCHIVED`).

### 4.2. Nhóm Danh mục Chuyên biệt (`/api/v1/hrm/payroll-catalogs`)
- `GET/POST /api/v1/hrm/payroll-catalogs/kpi-items`: Danh mục chỉ tiêu KPI.
- `PUT/DELETE /api/v1/hrm/payroll-catalogs/kpi-items/:id`: Sửa/Xóa chỉ tiêu KPI (RESTRICT nếu có data).
- `GET/POST /api/v1/hrm/payroll-catalogs/products`: Danh mục sản phẩm khoán.
- `PUT/DELETE /api/v1/hrm/payroll-catalogs/products/:id`: Sửa/Xóa sản phẩm (RESTRICT).
- `GET/POST /api/v1/hrm/payroll-catalogs/diligence-types`: Danh mục lỗi chuyên cần.
- `PUT/DELETE /api/v1/hrm/payroll-catalogs/diligence-types/:id`: Sửa/Xóa lỗi chuyên cần (RESTRICT).
- `GET/POST /api/v1/hrm/payroll-catalogs/adjustment-items`: Danh mục khoản bù trừ.
- `PUT/DELETE /api/v1/hrm/payroll-catalogs/adjustment-items/:id`: Sửa/Xóa khoản bù trừ (RESTRICT).

### 4.3. Nhóm 8 Phân hệ Nhập liệu (`/api/v1/hrm/payroll-data`)
*(Được bảo vệ bằng `PayrollPeriodLockGuard`: chặn mọi tác vụ ghi POST/PUT/DELETE khi kỳ $\ne$ `DRAFT` / `PENDING_REVIEW`, trả về mã lỗi `E-dltl-001`)*
1. **Chấm công**:
   - `GET /api/v1/hrm/payroll-data/attendance/matrix?periodId=...&ma_pb=...`: Ma trận công tháng.
   - `PUT /api/v1/hrm/payroll-data/attendance/cell`: Cập nhật 1 ô (Delta store).
   - `POST /api/v1/hrm/payroll-data/attendance/batch-override`: Ghi đè hàng loạt theo ngày.
2. **Tăng ca**:
   - `GET /api/v1/hrm/payroll-data/overtime?periodId=...`: Bảng tổng hợp tăng ca.
   - `POST /api/v1/hrm/payroll-data/overtime/apply`: Áp dụng bảng tăng ca hàng loạt (`scope`, `ma_pb`, `employeeIds`, `items`).
   - `DELETE /api/v1/hrm/payroll-data/overtime/:ma_nv?periodId=...`: Xóa dữ liệu tăng ca của 1 NV.
3. **KPI**:
   - `GET /api/v1/hrm/payroll-data/kpi?periodId=...`
   - `POST /api/v1/hrm/payroll-data/kpi/apply`
4. **Thưởng**:
   - `GET /api/v1/hrm/payroll-data/bonus?periodId=...`
   - `POST /api/v1/hrm/payroll-data/bonus/apply`
5. **Lương sản phẩm**:
   - `GET /api/v1/hrm/payroll-data/piecework?periodId=...`
   - `POST /api/v1/hrm/payroll-data/piecework/apply`
6. **Lương phần trăm**:
   - `GET /api/v1/hrm/payroll-data/commission?periodId=...`
   - `POST /api/v1/hrm/payroll-data/commission/apply`
7. **Lương chuyên cần**:
   - `GET /api/v1/hrm/payroll-data/diligence?periodId=...`
   - `POST /api/v1/hrm/payroll-data/diligence/record`
   - `DELETE /api/v1/hrm/payroll-data/diligence/:id`
8. **Ứng - Bù trừ**:
   - `GET /api/v1/hrm/payroll-data/adjustments?periodId=...`
   - `POST /api/v1/hrm/payroll-data/adjustments/apply`

### 4.4. Nhóm Bảng Lương & Snapshot (`/api/v1/hrm/payroll`)
- `GET /api/v1/hrm/payroll/calculate?periodId=...`: Tính toán bảng lương động thời gian thực (Live Preview khi kỳ ở `DRAFT`/`PENDING_REVIEW`).
- `GET /api/v1/hrm/payroll/sheet-lines?periodId=...`: Lấy bảng lương snapshot đóng băng 18 cột (khi kỳ ở `LOCKED`/`APPROVED`/`PAID`/`ARCHIVED`).
- `GET /api/v1/hrm/payroll/payslips/my?periodId=...`: Phiếu lương cá nhân cho nhân viên xem (khi kỳ ở `PAID`).

---

## 5. QUY TẮC NGHIỆP VỤ CỐT LÕI & CÁC BẤT BIẾN TÀI CHÍNH (INVARIANTS)

Hệ thống phải tuân thủ nghiêm ngặt **22 Business Rules (`BR-dltl-001` .. `022`)** và **5 Bất biến tài chính cốt lõi**:

1. **Bất biến Khóa sổ & Đóng băng Dữ liệu (`BR-dltl-001`, `E-dltl-001`)**:
   - Khi kỳ lương chuyển sang `LOCKED`, toàn bộ 8 phân hệ nhập liệu bị đóng băng vĩnh viễn (Read-only).
   - Một bản ghi snapshot tổng hợp đầy đủ 18 cột lương được chốt vào bảng `hrm_payroll_sheet_lines`. Mọi sự thay đổi về hồ sơ nhân sự, hợp đồng hay danh mục sau ngày khóa sổ KHÔNG làm lệch số liệu của kỳ đã chốt.
   - Thao tác Reopen kỳ lương: Chỉ dành riêng cho quyền `ADMIN`, bắt buộc cung cấp lý do giải trình $\ge 20$ ký tự và tự động ghi sự kiện `PAYROLL_PERIOD_REOPENED` vào Audit Log.

2. **Bất biến Chặn sàn Chuyên cần (`BR-dltl-016`)**:
   - Tổng tiền phạt vi phạm chuyên cần tối đa chỉ bằng mức chuyên cần được hưởng trong kỳ:
     $$\text{tong\_tru} = \min(\sum \text{phat}, \text{don\_gia})$$
   - Thành tiền chuyên cần: $\text{thanh\_tien} = \max(0, \text{don\_gia} - \text{tong\_tru}) \ge 0\text{ VNĐ}$.
   - **Tuyệt đối không bao giờ để chuyên cần bị âm hoặc trừ lấn sang lương cơ bản và phụ cấp khác**.
   - Bảng chuyên cần rỗng `[]` mang ý nghĩa nghiệp vụ: Nhân viên không vi phạm lỗi nào và được hưởng trọn vẹn 100% chuyên cần.

3. **Bất biến Công nợ Thực lĩnh Âm (`EC-03`)**:
   - Khi khoản tạm ứng giữa tháng (`bu_tru` chiều `tru`) lớn hơn tổng thu nhập thực lĩnh kiếm được trong kỳ, hệ thống **GIỮ NGUYÊN SỐ ÂM** ở cột `netTakeHomeSalary` (`thuc_linh`), **TUYỆT ĐỐI KHÔNG ÉP VỀ 0**.
   - Con số âm này phản ánh nghĩa vụ công nợ thực tế của nhân sự đối với doanh nghiệp, làm căn cứ chuyển sang khoản khấu trừ thu hồi tạm ứng kỳ tiếp theo.

4. **Bất biến Snapshot Đơn giá & Tỷ lệ (`BR-dltl-012`, `BR-dltl-015`)**:
   - Đơn giá sản phẩm (`PieceworkRecord.unitPrice`) và Tỷ lệ hoa hồng (`CommissionRecord.commissionRate`) được sao chép snapshot cố định tại thời điểm lập dữ liệu trong kỳ.
   - Khi doanh nghiệp điều chỉnh bảng giá sản phẩm hoặc thay đổi tỷ lệ hoa hồng trong danh mục ở các tháng sau, các số liệu trong quá khứ được bảo toàn 100%.

5. **Bất biến Toàn vẹn Giao dịch & Rollback Import Excel (`BR-dltl-022`, `EC-06`)**:
   - Tất cả các thao tác áp dụng hàng loạt (`batch apply`), chuyển trạng thái kỳ lương (`lock`), và import Excel bắt buộc phải thực thi trong Prisma Interactive Transaction (`db.$transaction`).
   - Import file Excel nếu phát hiện bất kỳ dòng nào chứa mã nhân viên không tồn tại, số lượng âm, hoặc sai format ngày sẽ lập tức **Atomic Rollback 100%**, từ chối toàn bộ file và trả về danh sách chi tiết các dòng lỗi (`E-dltl-024`).

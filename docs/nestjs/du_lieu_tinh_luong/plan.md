# Triển khai Backend: Phân hệ Dữ liệu Tính Lương (du_lieu_tinh_luong)

Tài liệu này đặc tả kế hoạch thực thi kỹ thuật chi tiết cho **Phase 3: Backend Implementation** của phân hệ **Dữ liệu tính lương (`du_lieu_tinh_luong`)**, tuân thủ 100% tài liệu thiết kế kiến trúc (`docs/du_lieu_tinh_luong/architecture/data-model.md`, `api-contract.md`) và bộ 77 ca kiểm thử BDD (`docs/du_lieu_tinh_luong/qa/test-cases.md`) đã được BA thẩm định chốt (Gate 2.5 Sign-off).

---

## 1. Mục tiêu & Phạm vi Triển khai

1. **Cập nhật Cơ sở Dữ liệu (Prisma Schema & PostgreSQL)**:
   - Thêm 6 Enums: `PayrollPeriodStatus`, `AttendanceType`, `OvertimeType`, `DiligenceDeductionMethod`, `AdjustmentDirection`, `CatalogStatus`.
   - Thêm 10 Models: `PayrollPeriod`, `AttendanceRecord`, `OvertimeRecord`, `KpiItem`, `KpiRecord`, `BonusRecord`, `PieceworkProduct`, `PieceworkRecord`, `CommissionRecord`, `DiligenceViolationType`, `DiligenceRecord`, `SalaryAdjustmentItem`, `SalaryAdjustmentRecord`, `PayrollSheetLine`.
   - Cập nhật quan hệ 2 chiều trên các models hiện có: `User`, `Employee`, `SalaryItem`.
   - Sinh mã Prisma Client (`npx prisma generate`).

2. **Xây dựng Tầng Nghiệp vụ NestJS (`Backend/src/hr/payroll/`)**:
   - Quản lý vòng đời Kỳ lương (`PayrollPeriodsService`, `PayrollPeriodsController`): `DRAFT` ➔ `PENDING_REVIEW` ➔ `LOCKED` ➔ `APPROVED` ➔ `PAID` ➔ `ARCHIVED`.
   - Cơ chế Khóa sổ kỳ lương (`lock`) với Snapshot bất biến vào `PayrollSheetLine` và Guard chặn ghi `PayrollPeriodLockGuard`.
   - Cơ chế Reopen kỳ lương có kiểm toán bắt buộc (chỉ `ADMIN`, lý do $\ge 20$ ký tự).
   - Quản lý 4 Danh mục chuyên biệt: KPI (`KpiItems`), Sản phẩm khoán (`PieceworkProducts`), Lỗi chuyên cần (`DiligenceViolationTypes`), Ứng - Bù trừ (`SalaryAdjustmentItems`).
   - Triển khai 8 phân hệ nhập liệu và ghi nhận dữ liệu:
     1. Chấm công (`attendance`): Ma trận chấm công, ghi đè ô công chuẩn (Delta store).
     2. Tăng ca (`overtime`): Ghi nhận giờ làm thêm, snapshot hệ số (150%..390%), quy đổi giờ, kiểm soát trần 40h/tháng & 300h/năm.
     3. Đánh giá KPI (`kpi`): Điểm mục tiêu vs thực thi, tỷ lệ hoàn thành, hiệu suất bình quân có trọng số.
     4. Thưởng (`bonus`): Ghi nhận các khoản thưởng lễ/tết/đột xuất (tái sử dụng `SalaryItem` loại `PERIODIC_BONUS`).
     5. Lương sản phẩm (`piecework`): Nghiệm thu sản lượng, snapshot đơn giá kỳ.
     6. Lương phần trăm (`commission`): Doanh số cơ sở, snapshot tỷ lệ hoa hồng %.
     7. Lương chuyên cần (`diligence`): Ghi nhận lỗi vi phạm, tự động khấu trừ theo giờ/lần/toàn bộ, áp dụng chặn sàn không âm: $\min(\sum \text{phat}, \text{don\_gia})$.
     8. Ứng - Bù trừ (`adjustments`): Ghi nhận tạm ứng và điều chỉnh phát sinh, số tiền dương, hỗ trợ thực lĩnh âm khi tạm ứng lớn hơn lương.
   - Excel Import/Export: Tải template chuẩn, import file Excel với cơ chế Atomic All-or-Nothing validation.

3. **Chuẩn hóa Xử lý Lỗi & Validation**:
   - Ánh xạ đầy đủ 26 mã lỗi `E-dltl-001` .. `E-dltl-026` vào hệ thống lỗi chung (`PayrollError` / `HrError`).
   - DTOs được validate chặt chẽ bằng Zod Schemas hoặc Validation Pipes.

4. **Kiểm thử Đầy đủ (Unit & Integration Tests)**:
   - Viết các bộ test bám sát 77 ca kiểm thử BDD trong `docs/du_lieu_tinh_luong/qa/test-cases.md`.
   - Chạy kiểm thử tự động đảm bảo 100% test pass không có regression.

---

## 2. Danh sách File và Cấu trúc Mã nguồn

### Database & Prisma
- `Backend/prisma/schema.prisma` [MODIFY]: Mở rộng enums, models và relations.

### Errors & Core Guards
- `Backend/src/common/payroll-errors.ts` [NEW]: Định nghĩa 26 mã lỗi `E-dltl-001` .. `E-dltl-026` và class `PayrollError`.
- `Backend/src/common/filters/http-exception.filter.ts` [MODIFY]: Đăng ký `PayrollError` vào bộ lọc exception chung.
- `Backend/src/hr/payroll/guards/payroll-period-lock.guard.ts` [NEW]: Guard chặn mọi request ghi khi kỳ lương $\ne$ `DRAFT`.

### Catalogs Submodule (`Backend/src/hr/payroll/catalogs/`)
- `Backend/src/hr/payroll/catalogs/payroll-catalogs.controller.ts` [NEW]
- `Backend/src/hr/payroll/catalogs/payroll-catalogs.service.ts` [NEW]
- DTOs / Schemas: `kpi-item.schema.ts`, `piecework-product.schema.ts`, `diligence-type.schema.ts`, `adjustment-item.schema.ts`.

### Payroll Periods Submodule (`Backend/src/hr/payroll/periods/`)
- `Backend/src/hr/payroll/periods/payroll-periods.controller.ts` [NEW]
- `Backend/src/hr/payroll/periods/payroll-periods.service.ts` [NEW]
- DTOs / Schemas: `create-period.schema.ts`, `reopen-period.schema.ts`.

### Payroll Data Submodules (`Backend/src/hr/payroll/inputs/`)
- `attendance/`: Controller, Service, Schemas (cell override, batch override, matrix query).
- `overtime/`: Controller, Service, Schemas (apply, employee OT update).
- `kpi/`: Controller, Service, Schemas (apply, employee KPI update).
- `bonus/`: Controller, Service, Schemas (apply, employee bonus update).
- `piecework/`: Controller, Service, Schemas (apply, employee piecework update).
- `commission/`: Controller, Service, Schemas (apply, employee commission update).
- `diligence/`: Controller, Service, Schemas (record violation, delete, diligence calculation).
- `adjustments/`: Controller, Service, Schemas (apply, employee adjustment update).

### Calculation & Snapshot Engine (`Backend/src/hr/payroll/calculation/`)
- `payroll-calculation.service.ts` [NEW]: Tính thử bảng lương động và chốt snapshot 18 cột vào `PayrollSheetLine`.
- `payroll-calculation.controller.ts` [NEW]: API preview và sheet-lines.

### Module Registration
- `Backend/src/hr/payroll/payroll.module.ts` [NEW]
- `Backend/src/hr/hr.module.ts` [MODIFY]: Import `PayrollModule`.

### Test Suites
- Unit tests cho các services nghiệp vụ và tính toán tài chính.
- Integration tests kiểm tra 26 mã lỗi và vòng đời kỳ lương.

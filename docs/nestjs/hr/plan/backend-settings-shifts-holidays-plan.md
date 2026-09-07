# Kế hoạch triển khai Backend: HR Master Data — Cấu hình mặc định, Ca làm việc & Lịch ngày lễ

Tài liệu này xác định kế hoạch chi tiết để **Backend Engineer** triển khai 3 thực thể thiết lập quản trị nhân sự mới theo đặc tả SRS (`docs/hr/srs/hr-spec.md`), kiến trúc (`docs/hr/architecture/hr-architecture.md`), mô hình dữ liệu (`docs/hr/architecture/hr-data-model.md`) và hợp đồng API (`docs/hr/architecture/hr-api-contract.md`).

---

## User Review Required

> [!IMPORTANT]
> **Phân quyền cập nhật Cấu hình mặc định (AC-hr-22)**:
> Endpoint `PUT /settings/general` và `POST /settings/general/restore-default` được giới hạn nghiêm ngặt **chỉ dành cho `ADMIN`** để bảo vệ các tham số trọng yếu cấp doanh nghiệp (lương cơ sở, công chuẩn, tỷ lệ BHXH, thuế TNCN). Quyền xem `GET /settings/general` vẫn mở cho `ADMIN`, `HR`, `ACCOUNTANT`.

> [!NOTE]
> **Biểu thuế TNCN & Tính toán động**:
> - Biểu thuế TNCN được lưu trữ dưới dạng Postgres `JsonB` array `[{ khoang: number, thueSuat: number }]` trong `GeneralSetting`, giúp hệ thống linh hoạt chuyển đổi giữa dự thảo 5 bậc và luật hiện hành 7 bậc mà không cần migration DB.
> - Các chỉ số ca làm việc `isOvernight` (qua đêm) và `workingHours` (số giờ công thực tế sau khi trừ nghỉ giữa ca) được tính toán động tại DTO/Service layer, không lưu cột dư thừa vào database.
> - Bảng tra ngày âm lịch cho 11 ngày lễ chuẩn Việt Nam (Điều 112 BLLĐ 2019) được tích hợp sẵn cho các năm 2024–2030, hỗ trợ tính năng "Tạo nhanh" idempotent.

---

## Open Questions

Không có câu hỏi mở nào gây chặn triển khai. Tất cả các quy tắc nghiệp vụ (BR-hr-019 đến BR-hr-028) và mã lỗi (E-hr-027 đến E-hr-036) đã được chuẩn hóa đầy đủ.

---

## Proposed Changes

```
Backend/
├── prisma/
│   ├── schema.prisma                       # [MODIFY] Thêm 4 enum và 3 model: GeneralSetting, WorkShift, Holiday
│   ├── seed.ts                             # [MODIFY] Seed bản ghi GeneralSetting DEFAULT và các ca mẫu
│   └── migrations/                         # [NEW] Migration add_settings_work_shifts_holidays
├── src/
│   ├── common/
│   │   └── hr-errors.ts                    # [MODIFY] Thêm mã lỗi E-hr-027..E-hr-036 và hỗ trợ entity mới
│   └── hr/
│       ├── hr.module.ts                    # [MODIFY] Đăng ký controllers và services mới
│       ├── settings/                       # [NEW] Submodule Cấu hình mặc định
│       │   ├── dto/
│       │   │   └── update-general-setting.schema.ts
│       │   ├── general-settings.controller.ts
│       │   ├── general-settings.service.ts
│       │   └── general-settings.service.spec.ts
│       ├── work-shifts/                    # [NEW] Submodule Ca làm việc
│       │   ├── dto/
│       │   │   ├── create-work-shift.schema.ts
│       │   │   ├── update-work-shift.schema.ts
│       │   │   └── list-work-shifts-query.schema.ts
│       │   ├── work-shifts.controller.ts
│       │   ├── work-shifts.service.ts
│       │   └── work-shifts.service.spec.ts
│       └── holidays/                       # [NEW] Submodule Lịch ngày lễ
│           ├── dto/
│           │   ├── create-holiday.schema.ts
│           │   ├── update-holiday.schema.ts
│           │   ├── list-holidays-query.schema.ts
│           │   └── quick-generate-holiday.schema.ts
│           ├── vietnam-holidays.util.ts
│           ├── holidays.controller.ts
│           ├── holidays.service.ts
│           └── holidays.service.spec.ts
└── test/
    └── settings-shifts-holidays.e2e-spec.ts # [NEW] Test E2E 14 endpoint trên Postgres thật (port 5435)
```

---

### Component 1: Database & Migration (`Backend/prisma`)

#### [MODIFY] [schema.prisma](file:///c:/Users/Admin/Desktop/project/Backend/prisma/schema.prisma)
- Thêm enums:
  - `WorkDayMethod { FIXED_26, ACTUAL }`
  - `DayPolicy { OFF, FULL_DAY, HALF_DAY }`
  - `ShiftStatus { ACTIVE, INACTIVE }`
  - `HolidayType { NATIONAL, LUNAR, COMPANY }`
- Thêm models:
  - `GeneralSetting`: Singleton `id String @id @default("DEFAULT") @db.VarChar(20)` kèm toàn bộ tham số lương, công, thuế JsonB, bảo hiểm.
  - `WorkShift`: `id`, `code` (`@unique @db.VarChar(20)`), `name`, `startTime`, `endTime`, `breakMinutes`, `status`.
  - `Holiday`: `id`, `date DateTime @db.Date`, `name`, `type`, `isAnnual`, `isPaid`, `note`, `@@unique([date, name])`.

#### [NEW] Migration `add_settings_work_shifts_holidays`
- Chạy `npx prisma migrate dev --name add_settings_work_shifts_holidays` để áp dụng lên PostgreSQL dev (port 5435).

#### [MODIFY] [seed.ts](file:///c:/Users/Admin/Desktop/project/Backend/prisma/seed.ts)
- Bổ sung upsert cho `GeneralSetting` bản ghi `"DEFAULT"`.
- Bổ sung seed các ca làm việc mẫu (`CA01` - Ca hành chính, `CA02` - Ca sáng, `CA03` - Ca chiều, `CA04` - Ca đêm).

---

### Component 2: Common Errors & Utilities (`Backend/src/common`)

#### [MODIFY] [hr-errors.ts](file:///c:/Users/Admin/Desktop/project/Backend/src/common/hr-errors.ts)
- Bổ sung định nghĩa `E-hr-027` đến `E-hr-036` vào `HR_ERRORS` và `HR_ERROR_STATUS`.
- Cập nhật hàm trợ giúp `hrNotFound()` hỗ trợ thêm loại `'ca làm việc'` và `'ngày lễ'`.

---

### Component 3: Submodule Cấu hình mặc định (`Backend/src/hr/settings`)

#### [NEW] `update-general-setting.schema.ts`
- Zod schema validate các tham số cập nhật:
  - `standardHoursPerDay` in [1..24] (`E-hr-027`)
  - `baseSalary > 0`, `regionMinSalary > 0` (`E-hr-028`)
  - `taxBrackets` mảng tăng dần về thuế suất (`E-hr-029`)

#### [NEW] `general-settings.service.ts`
- `getSettings()`: Tra cứu singleton `"DEFAULT"`. Nếu chưa có trong DB, tự động tạo mới với giá trị mặc định chuẩn.
- `updateSettings(dto)`: Cập nhật bản ghi singleton `"DEFAULT"`.
- `restoreDefault()`: Khôi phục toàn bộ các tham số về giá trị chuẩn theo BLLĐ 2019 / NQ 954.

#### [NEW] `general-settings.controller.ts`
- `GET /settings/general` (Roles: `ADMIN`, `HR`, `ACCOUNTANT`)
- `PUT /settings/general` (Roles: `ADMIN` only - `AC-hr-22`)
- `POST /settings/general/restore-default` (Roles: `ADMIN` only - `AC-hr-22`)

#### [NEW] `general-settings.service.spec.ts`
- Unit tests kiểm tra lấy mặc định, cập nhật hợp lệ, khôi phục cấu hình và bắt các lỗi `E-hr-027`..`E-hr-029`.

---

### Component 4: Submodule Ca làm việc (`Backend/src/hr/work-shifts`)

#### [NEW] `create-work-shift.schema.ts` & `update-work-shift.schema.ts`
- Validate giờ theo regex `HH:mm` (00:00–23:59, `E-hr-031`).
- Validate tên ca bắt buộc (`E-hr-030`).
- Validate phút nghỉ giữa ca >= 0 (`E-hr-032`).

#### [NEW] `work-shifts.service.ts`
- Logic tự sinh mã ca tuần tự `CA01`..`CA99` (BR-hr-023).
- Helper tính toán động `isOvernight` và `workingHours`:
  - `isOvernight = endTime <= startTime`.
  - `workingHours = Math.max(0, (totalMinutes - breakMinutes) / 60)`.
- CRUD: `create`, `findAll`, `findById`, `update`, `remove`.
- Bắt lỗi trùng mã `P2002` trả về 409 `E-hr-033`.

#### [NEW] `work-shifts.controller.ts`
- `POST /work-shifts` (Roles: `ADMIN`, `HR`)
- `GET /work-shifts` (Roles: `ADMIN`, `HR`, `ACCOUNTANT`)
- `GET /work-shifts/:id` (Roles: `ADMIN`, `HR`, `ACCOUNTANT`)
- `PATCH /work-shifts/:id` (Roles: `ADMIN`, `HR`)
- `DELETE /work-shifts/:id` (Roles: `ADMIN`, `HR`)

#### [NEW] `work-shifts.service.spec.ts`
- Unit tests kiểm tra tính giờ công thường, ca qua đêm, trừ giờ nghỉ, tự sinh mã ca `CAxx`, và các lỗi validation.

---

### Component 5: Submodule Lịch ngày lễ (`Backend/src/hr/holidays`)

#### [NEW] `vietnam-holidays.util.ts`
- Bảng tra lịch âm cho Tết Âm lịch và Giỗ Tổ Hùng Vương (2024–2030).
- Hàm sinh danh sách 11 ngày lễ chuẩn Việt Nam cho 1 năm bất kỳ theo Điều 112 BLLĐ.

#### [NEW] `create-holiday.schema.ts` & `update-holiday.schema.ts`
- Validate `date` và `name` bắt buộc (`E-hr-034`).
- Validate `isAnnual` phải là `false` nếu `type === "LUNAR"` (BR-hr-026, `E-hr-035`).

#### [NEW] `holidays.service.ts`
- CRUD: `create`, `findAll` (hỗ trợ filter theo năm, lặp lại hàng năm), `findById`, `update`, `remove`.
- `quickGenerate(year)`: Tính năng tạo nhanh 11 ngày lễ chuẩn, bỏ qua ngày đã tồn tại theo cặp `[date, name]` (`skipDuplicates`), trả về thống kê số lượng đã tạo và bỏ qua (`addedCount`, `skippedCount`).
- Bắt lỗi trùng `[date, name]` trả về 409 `E-hr-036`.

#### [NEW] `holidays.controller.ts`
- `POST /holidays` (Roles: `ADMIN`, `HR`)
- `GET /holidays` (Roles: `ADMIN`, `HR`, `ACCOUNTANT`)
- `GET /holidays/:id` (Roles: `ADMIN`, `HR`, `ACCOUNTANT`)
- `PATCH /holidays/:id` (Roles: `ADMIN`, `HR`)
- `DELETE /holidays/:id` (Roles: `ADMIN`, `HR`)
- `POST /holidays/quick-generate` (Roles: `ADMIN`, `HR`)

#### [NEW] `holidays.service.spec.ts`
- Unit tests kiểm tra CRUD ngày lễ, validation lễ âm lịch không lặp hàng năm, và tính năng tạo nhanh idempotent.

---

### Component 6: Aggregate Module (`Backend/src/hr/hr.module.ts`)

#### [MODIFY] [hr.module.ts](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/hr.module.ts)
- Import và khai báo các controllers: `GeneralSettingsController`, `WorkShiftsController`, `HolidaysController`.
- Khai báo các providers: `GeneralSettingsService`, `WorkShiftsService`, `HolidaysService`.

---

### Component 7: Kiểm thử tự động E2E (`Backend/test`)

#### [NEW] `settings-shifts-holidays.e2e-spec.ts`
- Chạy trên PostgreSQL thật (port 5435) với Supertest:
  1. Test toàn bộ 14 endpoint mới.
  2. Test RBAC: Chỉ `ADMIN` được sửa cấu hình mặc định (HR nhận 403 `E-hr-016`); `ACCOUNTANT` chỉ đọc; `EMPLOYEE` bị chặn toàn bộ 403.
  3. Test tạo ca hành chính và ca qua đêm, đối chiếu `workingHours` và `isOvernight`.
  4. Test tạo nhanh 11 ngày lễ chuẩn năm 2026, gọi lại lần 2 để xác minh tính idempotent (`skippedCount = 11, addedCount = 0`).

---

## Verification Plan

### Automated Tests
1. **Typecheck & Lint**:
   ```bash
   cd Backend && npm run lint
   cd Backend && npm run build
   ```
2. **Unit Tests (Vitest)**:
   ```bash
   cd Backend && npm test
   ```
3. **Database Migration & Seed**:
   ```bash
   cd Backend && npx prisma migrate dev --name add_settings_work_shifts_holidays
   cd Backend && npm run db:seed
   ```
4. **End-to-End Tests (PostgreSQL docker port 5435)**:
   ```bash
   cd Backend && npm run test:e2e -- test/settings-shifts-holidays.e2e-spec.ts
   ```

### Manual Verification
- Kiểm tra dữ liệu khởi tạo trong PostgreSQL: kiểm tra bản ghi `general_settings` với `id = "DEFAULT"`, danh mục `work_shifts` và bảng `holidays`.
- Xác minh HTTP response của các endpoint thông qua test suite.

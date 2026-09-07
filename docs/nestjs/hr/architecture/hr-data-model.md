---
type: data-model
feature: hr
status: draft
updated: 2026-09-05
links:
  - docs/hr/srs/hr-spec.md
  - docs/hr/architecture/hr-architecture.md
  - docs/hr/architecture/hr-api-contract.md
  - docs/hr/architecture/adr/ADR-001-employee-code-generation.md
  - docs/hr/architecture/adr/ADR-002-contract-overlap-prevention.md
  - docs/hr/architecture/adr/ADR-003-employee-contract-atomic-creation.md
  - docs/hr/architecture/adr/ADR-004-google-drive-integration.md
  - docs/hr/architecture/adr/ADR-005-settings-and-work-schedule-foundations.md
  - docs/auth/architecture/auth-data-model.md
  - Backend/prisma/schema.prisma
---

# HR — Data Model

Data model cho 9 bảng: `Department`, `Employee`, `Contract`, `Dependent`, `Document`, `GoogleDriveConnection`, `GeneralSetting`, `WorkShift`, `Holiday`. Đây là **bản thiết kế bổ sung/sửa đổi** vào `Backend/prisma/schema.prisma` hiện có.

> **Cập nhật 2026-09-05 (đợt 3 — đợt 5 HR):** Bổ sung 3 thực thể nền tảng quản trị: `GeneralSetting` (Cấu hình mặc định - Singleton, biểu thuế TNCN JSONB), `WorkShift` (Ca làm việc), `Holiday` (Lịch ngày lễ). Rationale chi tiết: [[docs/hr/architecture/adr/ADR-005-settings-and-work-schedule-foundations.md|ADR-005]].

Quy ước tái dùng đúng convention hiện có trong `schema.prisma` (không đổi so với bản trước):

- PK: `id String @id @default(uuid()) @db.Uuid` (riêng `GeneralSetting` dùng `id String @id @default("DEFAULT") @db.VarChar(20)` theo mẫu Singleton - ADR-005).
- Timestamp: `DateTime @db.Timestamptz(3)`.
- Audit fields: `createdAt` (`@default(now())`), `updatedAt` (`@updatedAt`) trên mọi bảng nghiệp vụ.
- Tên model PascalCase singular, `@@map("snake_plural")` cho tên bảng; **field giữ nguyên camelCase, KHÔNG có `@map` cấp field**.
- Mọi `String` đều có `@db.VarChar(n)` tường minh.
- Không dùng DB `CHECK` constraint cho business rule 1-dòng/1-bản-ghi (validate ở service layer/DTO validator). Ràng buộc duy nhất đa cột dùng Prisma `@@unique`.

## 1. Tổng quan 9 bảng + 8 enum

| Bảng/Enum | Mục đích nghiệp vụ | FR/BR chính |
|---|---|---|
| `Department` | Danh mục phòng ban, soft-delete qua `status` | FR-hr-001..004, BR-hr-008 |
| `Employee` | Hồ sơ nhân viên cá nhân/liên hệ/ngân hàng (KHÔNG còn field hợp đồng) | FR-hr-005, FR-hr-006, FR-hr-008..010, BR-hr-001, BR-hr-002, BR-hr-010 |
| `Contract` | Hợp đồng lao động — lương/BHXH/TNCN/Công đoàn, lưu lịch sử đầy đủ theo thời gian (N bản ghi/Nhân viên) | FR-hr-007, FR-hr-016..019, BR-hr-003..005, BR-hr-012..014 |
| `Dependent` | Người phụ thuộc phục vụ giảm trừ gia cảnh TNCN | FR-hr-011..014, BR-hr-006/007/009 |
| `Document` | Hồ sơ giấy tờ Nhân viên (CCCD/Hộ chiếu/Bằng cấp...) — metadata + tham chiếu file lưu trên Google Drive cá nhân | FR-hr-020..023, BR-hr-015..018 |
| `GoogleDriveConnection` (hạ tầng kỹ thuật) | Token OAuth Google Drive đã mã hoá của từng `User` (ADMIN/HR) | ADR-004 |
| `GeneralSetting` (MỚI) | Cấu hình mặc định toàn công ty (Singleton): ngày/giờ công, nghỉ phép, OT, lương cơ sở/vùng, tỷ lệ bảo hiểm, thuế TNCN | FR-hr-024..026, BR-hr-019..022, ADR-005 |
| `WorkShift` (MỚI) | Danh mục ca làm việc (mã tự sinh `CA01`..`CA99`), giờ vào/ra, nghỉ giữa ca, trạng thái hoạt động | FR-hr-027..029, BR-hr-023..025, ADR-005 |
| `Holiday` (MỚI) | Lịch ngày nghỉ lễ, lặp lại hàng năm (dương lịch), có lương, tự động lọc trùng | FR-hr-030..033, BR-hr-026..028, ADR-005 |
| `DepartmentStatus` (enum) | Hoạt động / Ngừng hoạt động | BR-hr-008 |
| `Gender` (enum) | Nam / Nữ / Khác | A-hr-3 |
| `ContractType` (enum) | Thử việc / HĐLĐ / HĐDV — thuộc về `Contract` | A-hr-3, BR-hr-004 |
| `SalaryType` (enum) | Gross / Net — thuộc về `Contract` | A-hr-3 |
| `WorkDayMethod` (MỚI, enum) | `FIXED_26` (Cố định 26 ngày) / `ACTUAL` (Thực tế) | Mục 6.6 SRS |
| `DayPolicy` (MỚI, enum) | `OFF` (Nghỉ) / `FULL_DAY` (Làm cả ngày) / `HALF_DAY` (Làm nửa ngày) | Mục 6.6 SRS |
| `ShiftStatus` (MỚI, enum) | `ACTIVE` (Đang dùng) / `INACTIVE` (Ngừng) | Mục 6.7 SRS |
| `HolidayType` (MỚI, enum) | `NATIONAL` (Quốc gia) / `LUNAR` (Âm lịch) / `COMPANY` (Công ty) | Mục 6.8 SRS |

Không tạo bảng `Role` mới (tái dùng enum `Role` có sẵn). Không tạo bảng cho danh sách Ngân hàng/Quan hệ NPT (free-text, A-hr-2). **Không thêm enum mới cho `Document`** — `documentType` ("Loại tài liệu") là free-text CÓ GỢI Ý, CÙNG cơ chế với `Employee.bankName`/`Dependent.relationship`, KHÔNG phải Prisma enum. Đây là điểm cần làm rõ tường minh: SRS Mục 6.5 liệt kê 5 giá trị gợi ý + "Khác", nhưng **NFR-hr-005 + A-hr-2 + A-hr-13** đều khẳng định rõ đây là "danh sách gợi ý free-text... cho phép thêm giá trị mới KHÔNG CẦN THAY ĐỔI CẤU TRÚC HỆ THỐNG" — một Prisma/DB enum thật sự sẽ VI PHẠM trực tiếp NFR-hr-005 (thêm 1 giá trị mới vào enum luôn cần migration, tức "thay đổi cấu trúc hệ thống"). Xem rationale đầy đủ ở Mục 12.1.

## 2. `Department`

*(Không đổi so với bản thiết kế trước — giữ nguyên nội dung để tham chiếu đầy đủ.)*

| Field | Type | Constraint | Nullable | Nguồn spec |
|---|---|---|---|---|
| `id` | `uuid` | PK, default `uuid()` | ✗ | — |
| `code` | `varchar(20)` | UNIQUE, NOT NULL | ✗ | Mục 6.1 "Mã phòng ban", tối đa 20 ký tự, **immutable sau khi tạo** (A-hr-5, OQ-hr-8) |
| `name` | `varchar(200)` | NOT NULL | ✗ | Mục 6.1 "Tên phòng ban", tối đa 200 |
| `description` | `varchar(500)` | — | ✓ | Mục 6.1 "Mô tả", tối đa 500 |
| `status` | `DepartmentStatus` | NOT NULL, default `ACTIVE` | ✗ | Mục 6.1 "Trạng thái", mặc định Hoạt động |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | Audit |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | Audit |

**Indexes:** `(code)` UNIQUE · `(status)` · `(name)`. **Immutable `code`:** ép ở tầng API contract, không DB trigger.

## 3. `Employee` (sửa đổi — 8 field hợp đồng đã chuyển sang `Contract`)

### 3.1 Bảng field đầy đủ

| Field | Type | Constraint | Nullable | Nguồn spec / ghi chú |
|---|---|---|---|---|
| `id` | `uuid` | PK | ✗ | — |
| `employeeCode` | `varchar(20)` | UNIQUE, NOT NULL | ✗ | "Mã NV" — nhập tay HOẶC auto-gen khi để trống (BR-hr-001, ADR-001) |
| `fullName` | `varchar(200)` | NOT NULL | ✗ | "Họ và tên" (*) |
| `dateOfBirth` | `date` | — | ✓ | "Ngày sinh" — kiểu Ngày THẬT |
| `nationalId` | `varchar(20)` | — | ✓ | "CCCD" |
| `taxCode` | `varchar(20)` | — | ✓ | "MST cá nhân" |
| `phone` | `varchar(20)` | — | ✓ | "Số điện thoại" |
| `email` | `varchar(254)` | — | ✓ | "Email" — **KHÔNG unique** (BR-hr-010) |
| `address` | `varchar(500)` | — | ✓ | "Địa chỉ" |
| `gender` | `Gender` | — | ✓ | "Giới tính" enum |
| `departmentId` | `uuid` | FK → `Department.id`, `onDelete: Restrict` | ✓ | "Mã phòng ban" — tuỳ chọn, khi có PHẢI tồn tại (BR-hr-002) |
| `position` | `varchar(100)` | — | ✓ | "Chức vụ" |
| `isTimekeepingExempt` | `boolean` | — | ✓ | "Miễn chấm công" — thuộc tính cá nhân/vai trò, ĐỘC LẬP với Hợp đồng (A-hr-11). SRS không nêu default khi trống → nullable (giữ nguyên rationale Mục 3.3) |
| `bankAccountNumber` | `varchar(30)` | — | ✓ | "Số tài khoản" |
| `bankAccountName` | `varchar(100)` | — | ✓ | "Tên tài khoản" |
| `bankName` | `varchar(150)` | — | ✓ | "Ngân hàng" — free-text có gợi ý (A-hr-2) |
| `note` | `varchar(2000)` | — | ✓ | "Ghi chú" |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | Audit |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | Audit |

**ĐÃ XOÁ khỏi `Employee` (chuyển sang `Contract`, Mục 4):** `contractNumber`, `contractType`, `salaryType`, `effectiveFrom`, `effectiveTo`, `hasSocialInsurance`, `hasPersonalIncomeTax`, `hasUnionFee` — 8 field, đúng A-hr-6/A-hr-11. `isTimekeepingExempt` **KHÔNG chuyển** — giữ nguyên trên `Employee` (A-hr-11).

**Quan hệ:** `contracts Contract[]` (1 Nhân viên — N Hợp đồng), `documents Document[]` (MỚI — 1 Nhân viên — N Tài liệu, xem Mục 12).

**Indexes:** `(employeeCode)` UNIQUE · `(departmentId)` · `(fullName)` · `(position)`. **ĐÃ XOÁ** index `(contractType)` — cột không còn tồn tại trên `Employee`; lọc theo loại hợp đồng nay đi qua quan hệ `contracts` (xem Mục 10 "Index & performance" và `hr-api-contract.md` Mục 4.2 — filter qua Prisma relation `some`).

### 3.2 `employeeCode` — không đổi (ADR-001)

Không có thay đổi nào ở cơ chế sinh Mã NV — `EmployeeCodeService`/`hr_employee_code_seq` giữ nguyên 100%. Điểm mới duy nhất: hàm `generateAndCreate()` nay có thể được gọi bằng Prisma transaction client (`tx.employee.create` thay vì `prisma.employee.create`) khi tạo Nhân viên kèm Hợp đồng đầu tiên — xem [[docs/hr/architecture/adr/ADR-003-employee-contract-atomic-creation.md|ADR-003]]. Chi tiết đầy đủ cơ chế sequence + retry: [[docs/hr/architecture/adr/ADR-001-employee-code-generation.md|ADR-001]].

### 3.3 `isTimekeepingExempt` — nullable, không default (giữ nguyên rationale)

SRS không nêu default khi bỏ trống cho "Miễn chấm công" (khác BHXH/TNCN trên `Contract` vốn có BR-hr-005 nêu rõ default = Có). Quyết định: để `null` khi không nhập, KHÔNG tự suy diễn `true`/`false` — cùng lý do đã áp dụng ở bản thiết kế trước (không tự bịa business rule chưa xác nhận). Đây là field DUY NHẤT còn giữ kiểu "nullable không default" trên `Employee` sau khi tách Hợp đồng (trước đây còn có `hasUnionFee` cùng nhóm — nay đã chuyển sang `Contract`, xem Mục 4.3).

### 3.4 `departmentId` — `onDelete: Restrict` (không đổi)

Giữ nguyên quyết định ở bản thiết kế trước: ép tường minh `onDelete: Restrict` (khác mặc định `SetNull` của Prisma cho FK optional) — lớp bảo vệ DB thật cho BR-hr-008, chống race condition giữa "xoá Department" và "gắn Employee mới vào Department đó" (xem `hr-architecture.md` Mục 5).

## 4. `Contract` (tách khỏi Employee 2026-09-05)

### 4.1 Bảng field đầy đủ

| Field | Type | Constraint | Nullable | Nguồn spec / ghi chú |
|---|---|---|---|---|
| `id` | `uuid` | PK | ✗ | — |
| `employeeId` | `uuid` | FK → `Employee.id`, `onDelete: Cascade`, NOT NULL | ✗ | "Mã NV" (*) — mỗi Hợp đồng luôn gắn đúng 1 Nhân viên (Mục 6.4). `onDelete: Cascade` vì Hợp đồng KHÔNG có ý nghĩa tồn tại độc lập — cùng pattern `Dependent.employeeId` đã có |
| `contractNumber` | `varchar(100)` | NOT NULL | ✗ | "Số hợp đồng" (*). **KHÔNG unique** — OQ-hr-2 vẫn đang mở |
| `contractType` | `ContractType` | NOT NULL | ✗ | "Loại hợp đồng" (*) enum — dùng lại enum đã có, chỉ đổi chỗ khai báo field |
| `salaryType` | `SalaryType` | NOT NULL | ✗ | "Kiểu lương" (*) enum |
| `baseSalary` | `int` | NOT NULL | ✗ | "Lương chính" (*) — VND, số nguyên, phải > 0 (BR-hr-012). Positivity validate ở SERVICE layer (E-hr-018), KHÔNG DB CHECK — xem `hr-api-contract.md` Mục 7 |
| `socialInsuranceSalary` | `int` | NOT NULL khi `hasSocialInsurance=true` (service-layer, xem BR-hr-012) | ✓ | "Lương đóng BHXH" — bắt buộc CÓ ĐIỀU KIỆN. NOT NULL ở mức DB là KHÔNG khả thi vì điều kiện phụ thuộc field khác trong CÙNG bảng — nullable ở DB, ép bắt buộc ở service (E-hr-019) |
| `effectiveFrom` | `date` | NOT NULL | ✗ | "Ngày bắt đầu" (*) |
| `effectiveTo` | `date` | — | ✓ | "Ngày kết thúc" — trống = vô thời hạn. Phải SAU `effectiveFrom` nếu có (BR-hr-003, service-layer, E-hr-006) |
| `hasSocialInsurance` | `boolean` | NOT NULL, default `true` | ✗ | "Trích đóng BHXH" — bỏ trống = Có (BR-hr-005) |
| `hasPersonalIncomeTax` | `boolean` | NOT NULL, default `true` | ✗ | "Tính thuế TNCN" — bỏ trống = Có (BR-hr-005) |
| `hasUnionFee` | `boolean` | — | ✓ | "Công đoàn" — nullable, **LUÔN ép `false`** khi `contractType = SERVICE_CONTRACT`, bất kể input (BR-hr-004, service-layer, ghi đè im lặng) |
| `terminationReason` | `varchar(500)` | — | ✓ | "Lý do chấm dứt" — tuỳ chọn, dùng khi chấm dứt sớm (OQ-hr-15, FR-hr-019) |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | Audit |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | Audit |

**Indexes:** `(employeeId, effectiveFrom)` — lấy lịch sử Hợp đồng theo Nhân viên sắp xếp theo Ngày bắt đầu (FR-hr-018), và hỗ trợ truy vấn "Hợp đồng hiện hành" (Mục 4.4). Không thêm index cho `contractNumber` (không unique, không có endpoint filter theo field này — tránh over-index).

**Không có field trạng thái tường minh** (OQ-hr-14 resolved theo default) — "hiện hành" luôn suy ra tại thời điểm truy vấn, xem Mục 4.4.

### 4.2 `onDelete: Cascade` — Hợp đồng không tồn tại độc lập

Employee bị xoá cứng (FR-hr-010) → toàn bộ Hợp đồng của Nhân viên đó xoá theo, **1 câu lệnh DB**, không phải thao tác ứng dụng riêng — đúng pattern `Dependent → Employee` đã có. OQ-hr-4 (giữ Hợp đồng/Người phụ thuộc/Tài liệu phục vụ audit thay vì xoá) **vẫn đang mở**.

### 4.3 `hasUnionFee` nullable — rationale

SRS BR-hr-004 chỉ nêu rule override RÕ RÀNG "HĐDV → Công đoàn = Không", KHÔNG nêu default cho trường hợp KHÔNG phải HĐDV. Để `null` khi người dùng không nhập — trung thực với spec, không tự bịa business rule tài chính ảnh hưởng trực tiếp lương thực nhận.

### 4.4 "Hợp đồng hiện hành" — suy ra bằng truy vấn, không lưu cột

FR-hr-018: Hợp đồng "hiện hành" tại một Nhân viên = bản ghi `Contract` có `effectiveFrom <= now() AND (effectiveTo IS NULL OR effectiveTo >= now())`. Do BR-hr-013 (Mục 5) đảm bảo tối đa 1 bản ghi thoả điều kiện này tại một thời điểm cho mỗi Nhân viên, truy vấn luôn trả về 0 hoặc 1 dòng — Backend Engineer vẫn nên thêm `orderBy: { effectiveFrom: 'desc' }, take: 1` (phòng thủ). Kết quả có thể là `null` (khoảng "gap" giữa 2 Hợp đồng) — trạng thái hợp lệ.

## 5. `Dependent`

*(Không đổi so với bản thiết kế trước.)*

| Field | Type | Constraint | Nullable | Nguồn spec / ghi chú |
|---|---|---|---|---|
| `id` | `uuid` | PK | ✗ | — |
| `employeeId` | `uuid` | FK → `Employee.id`, `onDelete: Cascade`, NOT NULL | ✗ | "Mã NV" (*) — BR-hr-007 |
| `fullName` | `varchar(200)` | NOT NULL | ✗ | "Họ tên NPT" (*) |
| `relationship` | `varchar(50)` | — | ✓ | "Quan hệ" — free-text (A-hr-2) |
| `dateOfBirth` | `varchar(20)` | — | ✓ | Kiểu CHUỖI cố ý (A-hr-7) |
| `nationalId` | `varchar(20)` | — | ✓ | "CCCD" |
| `taxCode` | `varchar(20)` | — | ✓ | "MST" |
| `phone` | `varchar(20)` | — | ✓ | "Số điện thoại" |
| `address` | `varchar(255)` | — | ✓ | "Địa chỉ" |
| `taxReliefFromMonth` | `int` | — | ✓ | 1–12 (E-hr-011) |
| `taxReliefFromYear` | `int` | — | ✓ | 2000–2100 (E-hr-012) |
| `taxReliefToMonth` | `int` | — | ✓ | 1–12 |
| `taxReliefToYear` | `int` | — | ✓ | 2000–2100 |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | Audit |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | Audit |

**Indexes:** `(employeeId)`. **"Tên nhân viên (tham khảo)":** vẫn suy qua `include`, không đổi (BR-hr-006).

## 6. Quan hệ & referential integrity — tổng hợp FK actions

| Quan hệ | `onDelete` | Lý do |
|---|---|---|
| `Employee.departmentId` → `Department.id` | `Restrict` | BR-hr-008 — không cho xoá cứng Department còn Employee tham chiếu |
| `Contract.employeeId` → `Employee.id` | `Cascade` | Hợp đồng không có ý nghĩa tồn tại độc lập ngoài Nhân viên chủ — pattern giống Dependent |
| `Dependent.employeeId` → `Employee.id` | `Cascade` | FR-hr-010 — Dependent không có ý nghĩa tồn tại độc lập |
| `Document.employeeId` → `Employee.id` | `Cascade` | **MỚI** — BR-hr-015, cùng pattern Contract/Dependent: Tài liệu không tồn tại độc lập ngoài Nhân viên chủ |
| `Document.uploadedByUserId` → `User.id` | `SetNull` | **MỚI** — traceability "ai đã upload / Drive cá nhân của ai đang chứa file" (ADR-004). `SetNull` (KHÔNG `Cascade`) vì Document vẫn còn giá trị nghiệp vụ (metadata + file vẫn tồn tại trên Drive) dù `User` đó bị xoá khỏi hệ thống sau này — chỉ mất dấu "ai đã upload". Đây là **FK cross-bounded-context ĐẦU TIÊN** của "HR Master Data" trỏ sang "Identity & Access" (`User`) — xem `hr-architecture.md` Mục 2 |
| `GoogleDriveConnection.userId` → `User.id` | `Cascade` | **MỚI** — quan hệ 1-1 (UNIQUE), thuộc bounded context "Integrations" (MỚI, xem `hr-architecture.md` Mục 2): kết nối Drive vô nghĩa nếu `User` sở hữu nó bị xoá |

**Ràng buộc đa-bản-ghi (không phải FK):** `Contract` có 1 `EXCLUDE` constraint chống chồng lấn ngày hiệu lực theo `employeeId` (BR-hr-013) — xem Mục 7 và [[docs/hr/architecture/adr/ADR-002-contract-overlap-prevention.md|ADR-002]]. `Document`/`GoogleDriveConnection` **không có** ràng buộc đa-bản-ghi nào loại này.

## 7. BR-hr-013 — chống chồng lấn ngày hiệu lực Hợp đồng (2 lớp phòng thủ)

Quyết định đầy đủ + alternatives: [[docs/hr/architecture/adr/ADR-002-contract-overlap-prevention.md|ADR-002]]. Tóm tắt:

1. **Service-layer pre-check** (Rule 1): trước khi `INSERT`/`UPDATE` một `Contract`, truy vấn toàn bộ `Contract` khác của CÙNG `employeeId`, kiểm tra khoảng `[effectiveFrom, effectiveTo ?? +∞]` có giao với bất kỳ bản ghi nào khác không. Có giao → `E-hr-020` (400).
2. **DB-level `EXCLUDE` constraint** (lớp bảo vệ THẬT chống race condition):

```sql
-- Trong migration.sql, SAU khi tạo bảng "contracts":
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_no_overlap"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[]') WITH &&
  );
```

`daterange(..., '[]')` = khoảng đóng cả 2 đầu, khớp đúng ngữ nghĩa "Ngày bắt đầu/Ngày kết thúc đều tính là ngày có hiệu lực" trong SRS.

## 8. Schema Prisma đầy đủ

**Backend Engineer lưu ý:** đây là bản THAY THẾ cho model `Employee` hiện có trong `schema.prisma` (xoá 8 field hợp đồng, thêm quan hệ `contracts`/`documents`) + THÊM MỚI model `Contract`, `Document`, `GoogleDriveConnection`. `Department`, `Dependent`, và 4 enum (`DepartmentStatus`, `Gender`, `ContractType`, `SalaryType`) **giữ nguyên, không đổi 1 dòng nào**.

```prisma
// ============================================================
// HRM-Accounting — HR data model (SỬA ĐỔI 2026-09-05: tách Contract khỏi Employee)
// Nguồn: docs/hr/architecture/hr-data-model.md
// Enum DepartmentStatus/Gender/ContractType/SalaryType: GIỮ NGUYÊN, không đổi.
// Model Department/Dependent: GIỮ NGUYÊN, không đổi.
// ============================================================

model Employee {
  id           String    @id @default(uuid()) @db.Uuid
  /// Mã NV — nhập tay hoặc auto-gen khi để trống (BR-hr-001). Sinh bằng sequence riêng, xem ADR-001.
  employeeCode String    @unique @db.VarChar(20)
  fullName     String    @db.VarChar(200)
  dateOfBirth  DateTime? @db.Date
  nationalId   String?   @db.VarChar(20)
  taxCode      String?   @db.VarChar(20)
  phone        String?   @db.VarChar(20)
  /// KHÔNG unique (BR-hr-010).
  email        String?   @db.VarChar(254)
  address      String?   @db.VarChar(500)
  gender       Gender?

  departmentId String? @db.Uuid
  position     String? @db.VarChar(100)

  /// Thuộc tính cá nhân/vai trò, ĐỘC LẬP với Hợp đồng nào đang hiệu lực (A-hr-11).
  /// SRS không nêu default khi trống — để null, KHÔNG tự suy diễn true/false.
  isTimekeepingExempt Boolean?

  bankAccountNumber String? @db.VarChar(30)
  bankAccountName   String? @db.VarChar(100)
  bankName          String? @db.VarChar(150)
  note              String? @db.VarChar(2000)

  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  /// BR-hr-008: không cho xoá cứng Department còn Employee tham chiếu — ép Restrict.
  department Department? @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  dependents Dependent[]
  /// 1 Nhân viên có N Hợp đồng theo thời gian (A-hr-6).
  contracts  Contract[]
  /// MỚI 2026-09-05 — 1 Nhân viên có N Tài liệu (hr-spec.md Mục 6.5, BR-hr-015).
  documents  Document[]

  @@index([departmentId])
  @@index([fullName])
  @@index([position])
  @@map("employees")
}

/// Tách khỏi Employee, lưu lịch sử đầy đủ (A-hr-6, Mục 6.4 hr-spec.md).
/// Chống chồng lấn ngày hiệu lực (BR-hr-013) bằng EXCLUDE constraint — xem ADR-002,
/// KHÔNG biểu diễn được bằng Prisma schema DSL, phải thêm tay vào migration.sql (Mục 11).
model Contract {
  id         String @id @default(uuid()) @db.Uuid
  employeeId String @db.Uuid

  /// KHÔNG unique — OQ-hr-2 đang mở, chờ BA xác nhận.
  contractNumber String       @db.VarChar(100)
  contractType   ContractType
  salaryType     SalaryType

  /// VND, số nguyên. Phải > 0 — validate ở service (E-hr-017/E-hr-018), KHÔNG DB CHECK.
  baseSalary Int
  /// Bắt buộc CÓ ĐIỀU KIỆN khi hasSocialInsurance = true (BR-hr-012, E-hr-019) — nullable ở DB
  /// vì điều kiện phụ thuộc field khác cùng bảng, ép bắt buộc ở service layer.
  socialInsuranceSalary Int?

  effectiveFrom DateTime  @db.Date
  effectiveTo   DateTime? @db.Date

  /// Bỏ trống = Có (BR-hr-005, chuyển ngữ cảnh từ Employee — giữ nguyên default).
  hasSocialInsurance   Boolean @default(true)
  /// Bỏ trống = Có (BR-hr-005).
  hasPersonalIncomeTax Boolean @default(true)
  /// SRS không nêu default khi trống (chỉ có rule override khi HĐDV, BR-hr-004) — để null.
  hasUnionFee          Boolean?

  /// Dùng khi chấm dứt hợp đồng sớm hơn effectiveTo dự kiến ban đầu (OQ-hr-15, FR-hr-019).
  terminationReason String? @db.VarChar(500)

  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  /// Hợp đồng không có ý nghĩa tồn tại độc lập — Cascade khi Employee bị xoá cứng (FR-hr-010).
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId, effectiveFrom])
  @@map("contracts")
}

// ============================================================
// HRM-Accounting — Document + GoogleDriveConnection (MỚI 2026-09-05, đợt 2)
// Nguồn: docs/hr/architecture/hr-data-model.md Mục 12/13, ADR-004.
// KHÔNG đổi enum/model nào ở trên. KHÔNG thêm enum DocumentType — documentType là free-text
// (NFR-hr-005, A-hr-2, A-hr-13 — hr-spec.md) — xem Mục 12.1 rationale đầy đủ.
// ============================================================

/// Tài liệu/hồ sơ giấy tờ Nhân viên (hr-spec.md Mục 6.5). File đính kèm là TUỲ CHỌN (FR-hr-020) —
/// ghi qua PUT /documents/:id/file (multipart), KHÔNG qua POST/PATCH metadata (JSON) — xem
/// hr-api-contract.md Mục 11 và ADR-004 cho lý do tách 2 luồng.
model Document {
  id         String @id @default(uuid()) @db.Uuid
  employeeId String @db.Uuid

  /// "Loại tài liệu" — free-text CÓ GỢI Ý (CCCD/CMND, Hộ chiếu, Bằng cấp, Chứng chỉ, Sơ yếu lý
  /// lịch, hoặc tự nhập "Khác") — KHÔNG phải enum, CÙNG cơ chế Employee.bankName/Dependent.
  /// relationship (NFR-hr-005, A-hr-2, A-hr-13). Danh sách gợi ý là UI concern; backend KHÔNG
  /// validate theo whitelist cố định.
  documentType String @db.VarChar(100)
  /// "Số hiệu" — KHÔNG unique (BR-hr-018), tối đa 50 ký tự theo SRS Mục 6.5.
  documentNumber String @db.VarChar(50)

  issueDate        DateTime? @db.Date
  issuingAuthority String?   @db.VarChar(200)
  /// Phải SAU issueDate nếu cả 2 có giá trị (BR-hr-017, service-layer, E-hr-026).
  expiryDate       DateTime? @db.Date
  note             String?   @db.VarChar(2000)

  // --- File đính kèm (Google Drive, OQ-hr-25 Cách hiểu 2) — TẤT CẢ nullable vì file là TUỲ
  // CHỌN (FR-hr-020): 1 Document có thể tồn tại vĩnh viễn không có file. KHÔNG lưu file bytes —
  // chỉ tham chiếu (driveFileId/webViewLink) tới file thật nằm trên Drive CÁ NHÂN người upload.
  driveFileId        String?   @db.VarChar(128)
  driveWebViewLink   String?   @db.VarChar(500)
  driveFileName      String?   @db.VarChar(255)
  driveFileMimeType  String?   @db.VarChar(150)
  driveFileSizeBytes Int?
  fileUploadedAt     DateTime? @db.Timestamptz(3)
  /// Ai đã upload / Drive CÁ NHÂN của ai đang chứa file — traceability BẮT BUỘC vì mỗi User có
  /// Drive riêng (không phải kho chung công ty) — xem ADR-004 "Rủi ro Drive cá nhân phân tán".
  uploadedByUserId   String?   @db.Uuid

  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  /// BR-hr-015: Tài liệu không tồn tại độc lập ngoài Nhân viên chủ — Cascade như Contract/Dependent.
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  /// FK cross-bounded-context ĐẦU TIÊN của "HR Master Data" trỏ sang "Identity & Access" (User).
  /// SetNull (KHÔNG Cascade) — Document vẫn còn giá trị dù User upload bị xoá sau này.
  uploadedBy User?    @relation("DocumentUploadedBy", fields: [uploadedByUserId], references: [id], onDelete: SetNull)

  @@index([employeeId])
  @@map("documents")
}

/// MỚI — KHÔNG phải SRS entity, hạ tầng kỹ thuật (ADR-004). Thuộc bounded context "Integrations"
/// (MỚI), KHÔNG phải "HR Master Data". Quan hệ 1-1 với User qua UNIQUE(userId).
model GoogleDriveConnection {
  id     String @id @default(uuid()) @db.Uuid
  userId String @unique @db.Uuid

  /// Best-effort, lấy qua drive.about.get NGAY SAU khi có token (scope drive.file ĐÃ ĐỦ quyền
  /// gọi about.get — KHÔNG cần xin thêm scope email/profile riêng). Chỉ phục vụ hiển thị UI
  /// "Đang kết nối với xxx@gmail.com" — không dùng cho logic nghiệp vụ nào.
  googleAccountEmail String? @db.VarChar(254)
  /// Scope Google THỰC SỰ trả về trong token response — đối chiếu/quan sát, KHÔNG phải nguồn
  /// phân quyền (phân quyền vẫn do RolesGuard nội bộ quyết định).
  scope              String? @db.VarChar(255)

  /// Mã hoá AES-256-GCM tại tầng ứng dụng TRƯỚC khi lưu (khoá từ env TOKEN_ENCRYPTION_KEY) —
  /// xem ADR-004 Mục "Mã hoá token tại chỗ". KHÔNG BAO GIỜ lưu plaintext. Nullable vì access
  /// token luôn tái tạo được từ refreshToken khi hết hạn/thiếu — không phải credential sống còn.
  accessTokenEncrypted  String?   @db.Text
  accessTokenExpiresAt  DateTime? @db.Timestamptz(3)
  /// Mã hoá CÙNG cơ chế accessTokenEncrypted. NOT NULL — đây là credential sống còn của kết
  /// nối; callback TỪ CHỐI lưu connection nếu Google không trả refresh_token (ADR-004).
  refreshTokenEncrypted String    @db.Text

  /// Cache Drive folder "HRM-Accounting - Hồ sơ nhân viên" trong Drive CỦA USER NÀY — tránh
  /// search/tạo lại mỗi lần upload. Tự làm mới (self-healing) nếu Google báo folder không còn
  /// tồn tại (bị user xoá tay) — xem ADR-004.
  driveFolderId String? @db.VarChar(128)

  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("google_drive_connections")
}
```

**Thay đổi bắt buộc trên model `User`** (thuộc `auth-data-model.md`, sở hữu bởi bounded context Identity & Access — đây là thay đổi CƠ HỌC bắt buộc của Prisma cho quan hệ 2 chiều, KHÔNG phải thay đổi business logic của auth): thêm 2 dòng quan hệ ngược (không thêm cột, không đổi field nghiệp vụ nào của `User`):

```prisma
model User {
  // ... toàn bộ field hiện có GIỮ NGUYÊN, không đổi ...

  uploadedDocuments     Document[]             @relation("DocumentUploadedBy")
  googleDriveConnection GoogleDriveConnection?
}
```

## 9. Sơ đồ quan hệ

```mermaid
erDiagram
    DEPARTMENT ||--o{ EMPLOYEE : "co nhieu nhan vien - FK optional"
    EMPLOYEE ||--o{ CONTRACT : "co nhieu hop dong theo thoi gian"
    EMPLOYEE ||--o{ DEPENDENT : "co nhieu nguoi phu thuoc"
    EMPLOYEE ||--o{ DOCUMENT : "co nhieu tai lieu"
    USER ||--o| GOOGLEDRIVECONNECTION : "co toi da 1 ket noi Drive"
    USER ||--o{ DOCUMENT : "co the da upload nhieu tai lieu - FK tuy chon"
    DEPARTMENT {
        uuid id PK
        varchar_20 code UK
        varchar_200 name
        DepartmentStatus status
    }
    EMPLOYEE {
        uuid id PK
        varchar_20 employeeCode UK
        varchar_200 fullName
        date dateOfBirth
        uuid departmentId FK
        boolean isTimekeepingExempt
    }
    CONTRACT {
        uuid id PK
        uuid employeeId FK
        varchar_100 contractNumber
        ContractType contractType
        SalaryType salaryType
        int baseSalary
        int socialInsuranceSalary
        date effectiveFrom
        date effectiveTo
        boolean hasSocialInsurance
        boolean hasPersonalIncomeTax
        boolean hasUnionFee
        varchar_500 terminationReason
    }
    DEPENDENT {
        uuid id PK
        uuid employeeId FK
        varchar_200 fullName
        varchar_20 dateOfBirth "kieu chuoi - A-hr-7"
    }
    DOCUMENT {
        uuid id PK
        uuid employeeId FK
        varchar_100 documentType "free-text co goi y - KHONG phai enum"
        varchar_50 documentNumber
        date issueDate
        varchar_200 issuingAuthority
        date expiryDate
        varchar_128 driveFileId "null neu chua upload file"
        varchar_500 driveWebViewLink
        uuid uploadedByUserId FK "nullable - SetNull"
    }
    GOOGLEDRIVECONNECTION {
        uuid id PK
        uuid userId FK UK "1-1 voi User"
        varchar_254 googleAccountEmail
        text accessTokenEncrypted "AES-256-GCM"
        text refreshTokenEncrypted "AES-256-GCM - NOT NULL"
        varchar_128 driveFolderId
    }
    USER {
        uuid id PK "so huu boi auth-data-model.md - chi hien thi de tham chieu"
    }
```

`USER` hiển thị tối giản (chỉ PK) vì bảng này được sở hữu và định nghĩa đầy đủ ở [[docs/auth/architecture/auth-data-model.md|Auth Data Model]] — sơ đồ này chỉ minh hoạ 2 quan hệ MỚI trỏ sang nó.

## 10. Index & performance notes (NFR-hr-002)

Không đổi kết luận so với bản trước: quy mô hàng trăm–vài nghìn nhân viên, index B-tree cơ bản là đủ; `pg_trgm`/GIN cho tìm kiếm "chứa chuỗi" vẫn hoãn (premature optimization). Lọc `GET /employees` theo "Loại hợp đồng của Hợp đồng hiện hành" (FR-hr-008) là truy vấn qua quan hệ `contracts` (Prisma `some`) — xem `hr-api-contract.md` Mục 4.2.

**`Document` (MỚI):** chỉ cần `@@index([employeeId])` — giống hệt `Dependent`, vì mọi truy vấn danh sách Tài liệu đều theo 1 Nhân viên cụ thể (FR-hr-021, route nested `/employees/:employeeId/documents`). Filter `documentType` (free-text, không enum) dùng `contains`/`equals` đơn giản, không cần index riêng ở quy mô hiện tại (mỗi Nhân viên thường có rất ít bản ghi Tài liệu, dưới 10-20). **`GoogleDriveConnection` (MỚI):** bảng cực nhỏ (tối đa bằng số User có vai trò ADMIN/HR), `UNIQUE(userId)` đã tự động có index — không cần thêm gì.

## 11. Migration strategy — tách Contract khỏi Employee

**Quyết định: migration MỚI, KHÔNG sửa `20260905043351_add_hr_module` đã áp dụng.** Dù DB dev chưa có dữ liệu thật (A-hr-6), migration đó đã "chạy" ở DB dev cục bộ và qua CI — sửa lại lịch sử migration đã áp dụng là thói quen xấu cần tránh ngay cả trước khi lên production. Tạo migration tiếp theo trong chuỗi lịch sử, đúng tinh thần forward-only đã thống nhất (`auth-architecture.md` Mục 8).

**Các bước cho Backend Engineer:**

1. Sửa `Backend/prisma/schema.prisma` theo Mục 8 (thay model `Employee`, thêm model `Contract`; KHÔNG đổi gì khác).
2. Chạy `npx prisma migrate dev --name split_contract_from_employee --create-only` (sinh diff tự động: `CREATE TABLE "contracts"`, `ALTER TABLE "employees" DROP COLUMN ...` × 8, FK, index thường — CHƯA áp dụng).
3. Mở `migration.sql` vừa sinh, **thêm tay 2 khối** Prisma DSL không biểu diễn được:
   - `CREATE EXTENSION IF NOT EXISTS btree_gist;` (đặt đầu file, trước `CREATE TABLE`).
   - Khối `ALTER TABLE "contracts" ADD CONSTRAINT "contracts_no_overlap" EXCLUDE USING gist (...)` (Mục 7) — đặt SAU khi bảng `contracts` đã tạo xong.
4. Kiểm tra thứ tự trong file: DROP COLUMN trên `employees` phải chạy được dù bảng đã có dữ liệu test.
5. Chạy `npx prisma migrate dev` (áp dụng dev) → verify bằng `npx prisma studio` hoặc test suite. Production dùng `npx prisma migrate deploy` như quy trình sẵn có, không đổi.

**Rủi ro cần biết:** `btree_gist` extension và `EXCLUDE` constraint không được Prisma schema DSL biết tới → nằm ngoài "schema.prisma là nguồn thật duy nhất". Rủi ro thực tế thấp vì `prisma migrate dev` diff dựa trên replay lịch sử migration.

**Rollback:** forward-only, không có down-migration tự động. Nếu cần huỷ: `DROP CONSTRAINT "contracts_no_overlap"`, `DROP TABLE "contracts"`, thêm lại 8 cột vào `employees`.

## 12. `Document` (MỚI — Google Drive integration, hr-spec.md Mục 6.5)

### 12.1 `documentType` — free-text có gợi ý, KHÔNG phải enum (điểm cần làm rõ tường minh)

**Kết luận:** `documentType` là `varchar(100)` free-text, KHÔNG phải Prisma/DB enum. Bằng chứng trực tiếp từ `hr-spec.md`:

- **NFR-hr-005**: "các trường 'chọn từ list' dạng free-text có gợi ý (Ngân hàng, Quan hệ NPT, **Loại tài liệu** — xem A-hr-2, A-hr-13) cho phép thêm giá trị mới **mà không cần thay đổi cấu trúc hệ thống**."
- **A-hr-13**: "Danh sách Loại tài liệu... có thể mở rộng thêm... **không cần đổi cấu trúc dữ liệu vì đây là danh sách gợi ý free-text**."
- **A-hr-2** (áp dụng chéo, được Mục 6.5 trích dẫn trực tiếp): "Ngân hàng và Quan hệ... là free-text có gợi ý hiển thị, **KHÔNG PHẢI enum cố định ở tầng dữ liệu**."

Một Prisma/DB enum thật sự (`enum DocumentType { CCCD_CMND PASSPORT ... }`) sẽ **vi phạm trực tiếp NFR-hr-005** — thêm 1 giá trị enum mới trong Postgres luôn cần migration (ALTER TYPE), đúng nghĩa "thay đổi cấu trúc hệ thống" mà NFR này yêu cầu tránh. Vì vậy thiết kế CHỌN: `documentType String @db.VarChar(100)`, danh sách 6 gợi ý (CCCD/CMND, Hộ chiếu, Bằng cấp, Chứng chỉ, Sơ yếu lý lịch, Khác) là **UI concern thuần tuý** (dropdown/autocomplete ở Frontend) — backend KHÔNG validate theo whitelist, chỉ validate non-empty + độ dài ≤ 100 (giới hạn 100 do Architect chọn — SRS không nêu max cho field này, tương tự cách `bankName`/`relationship` đã có giới hạn do Architect ấn định).

> **Lưu ý bàn giao:** nếu tài liệu định hướng ban đầu (brief) có nhắc tới "Loại tài liệu (enum: CCCD_CMND/PASSPORT/DEGREE/CERTIFICATE/CV/OTHER)", đây là cách diễn giải KHÔNG khớp với `hr-spec.md` — Architect đã ưu tiên nguồn SRS chính thức (NFR-hr-005/A-hr-2/A-hr-13) thay vì brief tóm tắt, theo đúng nguyên tắc "không tự thay đổi business requirement". Xem thêm ghi chú trong báo cáo bàn giao.

### 12.2 File đính kèm — tách khỏi metadata, TUỲ CHỌN

FR-hr-020 quy định rõ "Đường dẫn tài liệu" (nay là file Drive) là trường **tuỳ chọn** — một Document có thể tồn tại vĩnh viễn không có file đính kèm (chỉ lưu metadata: loại, số hiệu, ngày cấp...). Vì vậy 7 cột `drive*`/`fileUploadedAt`/`uploadedByUserId` đều **nullable**, và được ghi qua một endpoint RIÊNG (`PUT /documents/:id/file`, multipart) — KHÔNG lồng vào `POST /employees/:employeeId/documents` (JSON thuần). Lý do tách, xem `hr-api-contract.md` Mục 11 (phần giới thiệu) và ADR-004.

### 12.3 `uploadedByUserId` — traceability bắt buộc do đặc thù "Drive cá nhân, không phải kho chung"

Vì mô hình đã chọn (ADR-004) là **mỗi User tự upload vào Drive CÁ NHÂN của chính họ** (không phải 1 Service Account/Drive dùng chung công ty), một hệ quả kỹ thuật quan trọng là: **thao tác xoá/thay file của một Document đã có PHẢI dùng đúng token của người ĐÃ upload file đó**, không phải token của người đang gọi API hiện tại (2 người dùng khác nhau không thể xoá file trong Drive của nhau). `uploadedByUserId` là cột bắt buộc phải có để tra cứu đúng `GoogleDriveConnection` cần dùng — xem ADR-004 Mục "Thứ tự ghi khi thao tác cắt qua DB + Google API" cho quy tắc đầy đủ. Đây KHÔNG phải trường hiển thị thuần tuý — nó có Ý NGHĨA VẬN HÀNH trực tiếp.

## 13. `GoogleDriveConnection` (MỚI — hạ tầng kỹ thuật, không thuộc SRS)

### 13.1 Vì sao bảng này tồn tại dù không có trong SRS

`hr-spec.md` không định nghĩa entity này (BA không biết/không cần biết chi tiết OAuth) — đây là bảng do **Architect thiết kế thêm** để hiện thực hoá quyết định user "Cách hiểu 2" (Mục 6.5 SRS, OQ-hr-25): hệ thống chủ động upload thay người dùng, nên cần lưu trữ AN TOÀN thông tin uỷ quyền (OAuth token) mà Google cấp cho từng người dùng. Không có bảng này thì không thể gọi Google Drive API thay người dùng ở lần thứ 2 trở đi (access token hết hạn sau ~1 giờ, bắt buộc phải có `refresh_token` lưu bền để xin access token mới mà không cần người dùng đăng nhập lại Google mỗi lần).

### 13.2 Mã hoá token tại chỗ — chỉ tóm tắt ở đây, chi tiết ở ADR-004

`accessTokenEncrypted`/`refreshTokenEncrypted` **không bao giờ lưu plaintext** — mã hoá AES-256-GCM ở tầng ứng dụng trước khi ghi DB, giải mã ngay trước khi dùng. Đây là secret nhạy cảm tương đương mật khẩu (NFR bảo mật CLAUDE.md "Không... Log credential... Expose sensitive data"). Thuật toán, khoá, format lưu trữ: xem ADR-004 Mục "Mã hoá token tại chỗ" — **không lặp lại ở đây** để tránh 2 nguồn có thể lệch nhau khi 1 trong 2 tài liệu được cập nhật sau này.

### 13.3 KHÔNG soft-delete

`DELETE /integrations/google-drive/connection` xoá CỨNG bản ghi (sau khi best-effort gọi Google để revoke token phía server Google) — không có `revokedAt`/`status`. Lý do: đây là bản ghi "cấu hình kết nối hiện tại", không phải nhật ký audit cần giữ lịch sử (khác `Session`/`RefreshToken` ở feature auth, vốn CÓ `revokedAt` vì cần audit bảo mật đăng nhập). Các `Document` đã tham chiếu `driveFileId` từ trước **không bị ảnh hưởng** khi disconnect — file vẫn tồn tại trên Drive, chỉ là ứng dụng không còn upload/xoá được nữa cho tới khi user kết nối lại.

## 14. Migration strategy — `Document` + `GoogleDriveConnection`

**Đơn giản hơn hẳn Mục 11** — migration này **thuần Prisma DSL**, không cần thao tác tay nào (không extension, không `EXCLUDE`, không sequence) vì:

- Không có enum mới (`documentType` là `varchar`, không phải enum — Mục 12.1).
- Không có ràng buộc đa-bản-ghi nào kiểu BR-hr-013.
- Chỉ 2 bảng MỚI (`documents`, `google_drive_connections`) + 2 dòng quan hệ ngược thêm vào `User` (Mục 8) — KHÔNG `ALTER`/`DROP COLUMN` bảng nào đã có.

**Các bước cho Backend Engineer:**

1. Sửa `Backend/prisma/schema.prisma`: thêm 2 model mới (Mục 8), thêm quan hệ `documents Document[]` vào `Employee`, thêm 2 dòng quan hệ ngược vào `User` (`uploadedDocuments`, `googleDriveConnection`).
2. Chạy `npx prisma migrate dev --name add_document_and_google_drive_integration` (không cần `--create-only`, không cần sửa tay `migration.sql`).
3. Verify bằng `npx prisma studio` hoặc test suite.

**Rollback:** forward-only, như quy ước chung — `DROP TABLE "documents"`, `DROP TABLE "google_drive_connections"` nếu thật cần huỷ.

## 15. `GeneralSetting` (MỚI — Singleton per system/tenant, SRS Mục 6.6)

### 15.1 Bảng trường

| Field | Type | Constraint | Nullable | Mặc định | Nguồn spec / Ghi chú |
|---|---|---|---|---|---|
| `id` | `varchar(20)` | PK | ✗ | `"DEFAULT"` | Khóa cố định cho Singleton pattern (ADR-005) |
| `workDayMethod` | `WorkDayMethod` | NOT NULL | ✗ | `FIXED_26` | Phương pháp tính công chuẩn (`FIXED_26` hoặc `ACTUAL`) |
| `saturdayPolicy` | `DayPolicy` | NOT NULL | ✗ | `HALF_DAY` | Chính sách Thứ 7 (`OFF`, `FULL_DAY`, `HALF_DAY`) |
| `sundayPolicy` | `DayPolicy` | NOT NULL | ✗ | `OFF` | Chính sách Chủ nhật (`OFF`, `FULL_DAY`, `HALF_DAY`) |
| `standardHoursPerDay` | `Float` | NOT NULL | ✗ | `8.0` | Giờ công chuẩn/ngày (1.0 đến 24.0, BR-hr-020) |
| `basePaidLeaveDays` | `Int` | NOT NULL | ✗ | `12` | Ngày phép cơ bản/năm (Điều 113 BLLĐ) |
| `seniorityYearsPerDay` | `Int` | NOT NULL | ✗ | `5` | Số năm thâm niên thêm 1 ngày phép (Điều 114 BLLĐ) |
| `otNormalDayPercent` | `Float` | NOT NULL | ✗ | `150.0` | Hệ số tăng ca ngày thường ban ngày (%) |
| `otNormalNightPercent` | `Float` | NOT NULL | ✗ | `200.0` | Hệ số tăng ca ngày thường ban đêm (%) |
| `otSundayDayPercent` | `Float` | NOT NULL | ✗ | `200.0` | Hệ số tăng ca Chủ nhật ban ngày (%) |
| `otSundayNightPercent` | `Float` | NOT NULL | ✗ | `270.0` | Hệ số tăng ca Chủ nhật ban đêm (%) |
| `otHolidayDayPercent` | `Float` | NOT NULL | ✗ | `300.0` | Hệ số tăng ca Ngày lễ ban ngày (%) |
| `otHolidayNightPercent` | `Float` | NOT NULL | ✗ | `390.0` | Hệ số tăng ca Ngày lễ ban đêm (%) |
| `otMonthlyLimitHours` | `Int` | NOT NULL | ✗ | `40` | Giới hạn OT tối đa/tháng (giờ) |
| `otYearlyWarningHours` | `Int` | NOT NULL | ✗ | `200` | Ngưỡng cảnh báo OT/năm (giờ) |
| `otYearlyLimitHours` | `Int` | NOT NULL | ✗ | `300` | Mốc trần vượt mức OT/năm (giờ) |
| `baseSalary` | `Int` | NOT NULL | ✗ | `2340000` | Lương cơ sở (VND, NĐ 73/2024/NĐ-CP) |
| `regionMinSalary` | `Int` | NOT NULL | ✗ | `4960000` | Lương tối thiểu vùng I (VND, NĐ 74/2024/NĐ-CP) |
| `socialInsuranceEmpPercent` | `Float` | NOT NULL | ✗ | `8.0` | Tỷ lệ BHXH nhân viên đóng (%) |
| `healthInsuranceEmpPercent` | `Float` | NOT NULL | ✗ | `1.5` | Tỷ lệ BHYT nhân viên đóng (%) |
| `unemploymentInsuranceEmpPercent` | `Float` | NOT NULL | ✗ | `1.0` | Tỷ lệ BHTN nhân viên đóng (%) |
| `socialInsuranceCompPercent` | `Float` | NOT NULL | ✗ | `17.5` | Tỷ lệ BHXH công ty đóng (%) |
| `healthInsuranceCompPercent` | `Float` | NOT NULL | ✗ | `3.0` | Tỷ lệ BHYT công ty đóng (%) |
| `unemploymentInsuranceCompPercent` | `Float` | NOT NULL | ✗ | `1.0` | Tỷ lệ BHTN công ty đóng (%) |
| `unionFeeEmpPercent` | `Float` | NOT NULL | ✗ | `1.0` | Tỷ lệ đoàn phí NV (%) |
| `unionFeeBaseCap` | `Int` | NOT NULL | ✗ | `234000` | Trần đóng đoàn phí (VND, tối đa 10% lương cơ sở) |
| `unionFeeCompPercent` | `Float` | NOT NULL | ✗ | `2.0` | Tỷ lệ kinh phí công đoàn DN (%) |
| `personalDeduction` | `Int` | NOT NULL | ✗ | `11000000` | Giảm trừ bản thân (VND/tháng, NQ 954/2020) |
| `dependentDeduction` | `Int` | NOT NULL | ✗ | `4400000` | Giảm trừ mỗi NPT (VND/tháng, NQ 954/2020) |
| `taxBrackets` | `Json @db.JsonB` | NOT NULL | ✗ | `[...]` | Mảng 5 bậc lũy tiến `[{ khoang: number, thueSuat: number }]` (ADR-005) |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | `now()` | — |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | — | — |

### 15.2 Prisma schema mapping
```prisma
model GeneralSetting {
  id                               String        @id @default("DEFAULT") @db.VarChar(20)
  workDayMethod                    WorkDayMethod @default(FIXED_26)
  saturdayPolicy                   DayPolicy     @default(HALF_DAY)
  sundayPolicy                     DayPolicy     @default(OFF)
  standardHoursPerDay              Float         @default(8.0)
  basePaidLeaveDays                Int           @default(12)
  seniorityYearsPerDay             Int           @default(5)
  otNormalDayPercent               Float         @default(150.0)
  otNormalNightPercent             Float         @default(200.0)
  otSundayDayPercent               Float         @default(200.0)
  otSundayNightPercent             Float         @default(270.0)
  otHolidayDayPercent              Float         @default(300.0)
  otHolidayNightPercent            Float         @default(390.0)
  otMonthlyLimitHours              Int           @default(40)
  otYearlyWarningHours             Int           @default(200)
  otYearlyLimitHours               Int           @default(300)
  baseSalary                       Int           @default(2340000)
  regionMinSalary                  Int           @default(4960000)
  socialInsuranceEmpPercent        Float         @default(8.0)
  healthInsuranceEmpPercent        Float         @default(1.5)
  unemploymentInsuranceEmpPercent  Float         @default(1.0)
  socialInsuranceCompPercent       Float         @default(17.5)
  healthInsuranceCompPercent       Float         @default(3.0)
  unemploymentInsuranceCompPercent Float         @default(1.0)
  unionFeeEmpPercent               Float         @default(1.0)
  unionFeeBaseCap                  Int           @default(234000)
  unionFeeCompPercent              Float         @default(2.0)
  personalDeduction                Int           @default(11000000)
  dependentDeduction               Int           @default(4400000)
  taxBrackets                      Json
  createdAt                        DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt                        DateTime      @updatedAt @db.Timestamptz(3)

  @@map("general_settings")
}
```

## 16. `WorkShift` (MỚI — Ca làm việc, SRS Mục 6.7)

### 16.1 Bảng trường

| Field | Type | Constraint | Nullable | Mặc định | Nguồn spec / Ghi chú |
|---|---|---|---|---|---|
| `id` | `uuid` | PK, default `uuid()` | ✗ | `uuid()` | — |
| `code` | `varchar(20)` | UNIQUE, NOT NULL | ✗ | — | Mã ca làm việc (`CA01`-`CA99` hoặc nhập tay, BR-hr-023) |
| `name` | `varchar(100)` | NOT NULL | ✗ | — | Tên ca làm việc (tối đa 100) |
| `startTime` | `varchar(5)` | NOT NULL | ✗ | — | Giờ vào định dạng `HH:mm` (vd: `08:00`) |
| `endTime` | `varchar(5)` | NOT NULL | ✗ | — | Giờ ra định dạng `HH:mm` (vd: `17:00`) |
| `breakMinutes` | `Int` | NOT NULL | ✗ | `0` | Số phút nghỉ giữa ca (≥ 0, BR-hr-025) |
| `status` | `ShiftStatus` | NOT NULL | ✗ | `ACTIVE` | Trạng thái: `ACTIVE` (Đang dùng), `INACTIVE` (Ngừng dùng) |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | `now()` | — |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | — | — |

### 16.2 Prisma schema mapping
```prisma
model WorkShift {
  id           String      @id @default(uuid()) @db.Uuid
  code         String      @unique @db.VarChar(20)
  name         String      @db.VarChar(100)
  startTime    String      @db.VarChar(5)
  endTime      String      @db.VarChar(5)
  breakMinutes Int         @default(0)
  status       ShiftStatus @default(ACTIVE)
  createdAt    DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime    @updatedAt @db.Timestamptz(3)

  @@index([status])
  @@index([name])
  @@map("work_shifts")
}
```

## 17. `Holiday` (MỚI — Lịch ngày lễ, SRS Mục 6.8)

### 17.1 Bảng trường

| Field | Type | Constraint | Nullable | Mặc định | Nguồn spec / Ghi chú |
|---|---|---|---|---|---|
| `id` | `uuid` | PK, default `uuid()` | ✗ | `uuid()` | — |
| `date` | `date` | NOT NULL | ✗ | — | Ngày diễn ra ngày lễ (`YYYY-MM-DD`) |
| `name` | `varchar(150)` | NOT NULL | ✗ | — | Tên ngày lễ (tối đa 150 ký tự) |
| `type` | `HolidayType` | NOT NULL | ✗ | `NATIONAL` | Loại lễ (`NATIONAL`, `LUNAR`, `COMPANY`) |
| `isAnnual` | `Boolean` | NOT NULL | ✗ | `false` | Lặp lại hàng năm (bắt buộc false nếu `LUNAR`, BR-hr-026) |
| `isPaid` | `Boolean` | NOT NULL | ✗ | `true` | Nghỉ có hưởng lương (mặc định true) |
| `note` | `varchar(500)` | Nullable | ✓ | `null` | Ghi chú thêm |
| `createdAt` | `timestamptz(3)` | NOT NULL, default `now()` | ✗ | `now()` | — |
| `updatedAt` | `timestamptz(3)` | NOT NULL, `@updatedAt` | ✗ | — | — |

*Ràng buộc đặc biệt: `@@unique([date, name])` — chống trùng lặp ngày và tên theo BR-hr-027.*

### 17.2 Prisma schema mapping
```prisma
model Holiday {
  id        String      @id @default(uuid()) @db.Uuid
  date      DateTime    @db.Date
  name      String      @db.VarChar(150)
  type      HolidayType @default(NATIONAL)
  isAnnual  Boolean     @default(false)
  isPaid    Boolean     @default(true)
  note      String?     @db.VarChar(500)
  createdAt DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt DateTime    @updatedAt @db.Timestamptz(3)

  @@unique([date, name])
  @@index([date])
  @@index([isAnnual])
  @@map("holidays")
}
```

## 18. Migration strategy — Đợt 5 (`GeneralSetting`, `WorkShift`, `Holiday`)

**Thuần Prisma DSL** — không cần extension ngoài hay custom SQL:

1. Cập nhật `Backend/prisma/schema.prisma` với 3 model mới và 4 enum mới (`WorkDayMethod`, `DayPolicy`, `ShiftStatus`, `HolidayType`).
2. Chạy `npx prisma migrate dev --name add_settings_work_shifts_holidays`.
3. Bổ sung script nạp seed mặc định cho `GeneralSetting` và 5 ca làm việc mẫu vào `Backend/prisma/seed.ts`.
4. Chạy `npx prisma db seed` và chạy test suite để xác minh.

## References

- [[docs/hr/srs/hr-spec.md|HR SRS]] — FR/NFR/BR/Error nguồn, đặc biệt Mục 6.6, 6.7, 6.8
- [[docs/hr/architecture/hr-architecture.md|HR Architecture]] — module boundaries + transaction boundary
- [[docs/hr/architecture/hr-api-contract.md|HR API Contract]] — endpoint + error code + response shape
- [[docs/hr/architecture/adr/ADR-001-employee-code-generation.md|ADR-001 Employee Code Generation]]
- [[docs/hr/architecture/adr/ADR-002-contract-overlap-prevention.md|ADR-002 Contract Overlap Prevention]]
- [[docs/hr/architecture/adr/ADR-003-employee-contract-atomic-creation.md|ADR-003 Employee+Contract Atomic Creation]]
- [[docs/hr/architecture/adr/ADR-004-google-drive-integration.md|ADR-004 Google Drive Integration]]
- [[docs/hr/architecture/adr/ADR-005-settings-and-work-schedule-foundations.md|ADR-005 Settings and Work Schedule Foundations]]
- [[docs/auth/architecture/auth-data-model.md|Auth Data Model]] — convention PK/timestamp/audit tham chiếu, model `User` gốc

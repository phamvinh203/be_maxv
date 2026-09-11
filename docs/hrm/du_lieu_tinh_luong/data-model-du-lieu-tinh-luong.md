---
type: architecture-data-model
feature: hrm-du-lieu-tinh-luong
status: in-review
updated: 2026-09-11
author: system-architect
links:
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md
  - docs/hrm/cai_dat_luong/data-model-cai-dat-luong.md
---

# HR — Mô hình Dữ liệu: Dữ liệu tính lương (Payroll Input Data Model)

Mô hình dữ liệu quan hệ của tính năng **Dữ liệu tính lương** (`du_lieu_tinh_luong`) trong schema CSDL **Tenant** của `be_maxv`.

- **Phân vùng schema**: `be_maxv/prisma/tenant/schema.prisma` (KHÔNG có bảng nào thuộc `prisma/sys/schema.prisma` — toàn bộ 14 model là dữ liệu nghiệp vụ của từng công ty).
- **Cô lập đa tenant**: ở tầng **kết nối**, không ở tầng cột. Mỗi công ty một database riêng (`don_vi.dbName`), giải qua `resolveTenantDb(req)` → `resolveTenantInfo` → `getTenantDb(dbName)` (`be_maxv/src/helpers/resolveTenantDb.ts:19-23`, `:47-82`). Vì vậy **không có** và **không được thêm** cột `maSoThue`/`tenantId` trong 14 model dưới đây.
- **Khóa ngoài nhân viên**: dùng `ma_nv String @db.VarChar(24)` trỏ `hrm_nhan_vien.ma_nv` (khóa chính nghiệp vụ), **không dùng UUID** — khác tài liệu mẫu NestJS ở `docs/nestjs/du_lieu_tinh_luong/`. Xem **ADR-dltl-01**.
- **Tài liệu này là kết quả kiểm định ngược từ mã nguồn đã tồn tại**, không phải thiết kế đi trước. Mọi bảng/cột/index đều trích `schema.prisma:line` thật.

> **Cảnh báo tài liệu liền kề đã lệch (đọc trước khi dùng làm chuẩn):** `docs/hrm/cai_dat_luong/data-model-cai-dat-luong.md` (status `approved`) mô tả `SalaryItemCategory`, `TaxTreatment`, `CalculationMethod`, `SalaryItem`, `EmployeeSalary` **không khớp schema thật hiện tại**. Chi tiết ở Mục 7. Khi cần đối chiếu 2 khoản `PERIODIC_BONUS` / `COMMISSION_PERCENTAGE`, hãy tin schema, đừng tin doc đó.

---

## 1. Biểu đồ Thực thể Liên kết (ERD)

```
                            ┌──────────────────────────────┐
                            │      hrm_payroll_periods     │  1 kỳ = 1 tháng (code YYYY-MM)
                            │  id[PK] · code[UQ] · status  │  DRAFT→PENDING_REVIEW→LOCKED
                            │  month · year · start · end  │  →APPROVED→PAID→ARCHIVED
                            └───────────────┬──────────────┘
                                            │ 1
          ┌───────────┬───────────┬─────────┼─────────┬───────────┬───────────┬──────────┐
          │ N         │ N         │ N       │ N       │ N         │ N         │ N        │ N
┌─────────▼──────┐ ┌──▼───────┐ ┌─▼──────┐ ┌▼───────┐ ┌▼────────┐ ┌▼─────────┐ ┌▼───────┐ ┌▼──────────────┐
│hrm_attendance_ │ │hrm_over  │ │hrm_kpi_│ │hrm_bo  │ │hrm_piece│ │hrm_commi │ │hrm_dil │ │hrm_salary_    │
│    records     │ │time_reco │ │records │ │nus_rec │ │work_rec │ │ssion_rec │ │igence_ │ │adjustment_    │
│ (1) Chấm công  │ │rds (2)   │ │  (3)   │ │ords(4) │ │ords (5) │ │ords  (6) │ │rec (7) │ │records    (8) │
└────────┬───────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └────┬────┘ └────┬─────┘ └───┬────┘ └──────┬────────┘
         │              │           │          │           │           │           │             │
         └──────────────┴───────────┴──────────┴─────┬─────┴───────────┴───────────┴─────────────┘
                                                     │ N        (mọi bảng đều FK ma_nv)
                                          ┌──────────▼──────────┐ 1
                                          │   hrm_nhan_vien     │─────┐
                                          │  ma_nv [PK,VC24]    │     │ 1
                                          └──────────┬──────────┘     │
                                            1 │      │ N              │ N
                            ┌─────────────────▼──┐ ┌─▼──────────────┐ │
                            │hrm_employee_salaries│ │ hrm_hop_dong  │ │
                            │ (Set lương APPROVED)│ │ luong_chinh   │ │
                            └─────────┬───────────┘ │ luong_bhxh    │ │
                                      │ N           └───────────────┘ │
                            ┌─────────▼───────────────┐               │
                            │hrm_employee_salary_items│               │
                            └─────────┬───────────────┘               │
                                      │ N                             │
                            ┌─────────▼───────────┐                   │
                            │  hrm_salary_items   │◄──────────────────┼── (4) bonus.salaryItemId
                            │  category[7 enum]   │◄──────────────────┼── (6) commission.salaryItemId
                            └─────────────────────┘                   │
                                                                      │
  DANH MỤC CHUYÊN BIỆT (4 bảng, tái dùng qua nhiều kỳ)                 │
  ┌──────────────┐  ┌────────────────────┐  ┌──────────────────────┐  │
  │hrm_kpi_items │  │hrm_piecework_produ │  │hrm_diligence_        │  │
  │ KPI01..KPI99 │  │cts   SP01..SP99    │  │violation_types CC01..│  │
  └──────┬───────┘  └─────────┬──────────┘  └──────────┬───────────┘  │
         │ 1→N (3)            │ 1→N (5)                │ 1→N (7)      │
  ┌──────▼─────────────────┐                                          │
  │hrm_salary_adjustment_  │  BT01..BT99 · direction(tru|bu)          │
  │items          1→N (8)  │                                          │
  └────────────────────────┘                                          │
                                                                      │
                      ┌───────────────────────────────────┐           │
                      │   hrm_payroll_sheet_lines         │───────────┘
                      │ SNAPSHOT BẤT BIẾN 18 cột/người    │
                      │ UQ(periodId, ma_nv) · chốt khi LOCK│
                      └───────────────────────────────────┘
```

**Đọc ERD:** 1 `PayrollPeriod` là gốc cha của 8 bảng biến động + 1 bảng snapshot, tất cả `onDelete: Cascade` — xóa kỳ (chỉ được khi `DRAFT`) là xóa sạch dữ liệu con. 4 bảng danh mục nằm **ngoài** vòng đời kỳ (`onDelete: Restrict`) nên sửa danh mục về sau không phá bản ghi cũ.

---

## 2. Kiểu Liệt kê (Enums) — 6 enum mới

| Enum | `schema.prisma` | Giá trị | Ghi chú kiến trúc |
|---|---|---|---|
| `PayrollPeriodStatus` | `1319-1326` | `DRAFT` · `PENDING_REVIEW` · `LOCKED` · `APPROVED` · `PAID` · `ARCHIVED` | Ranh giới ghi: `DRAFT`/`PENDING_REVIEW` = ghi được; 4 trạng thái còn lại chặn ở `payrollPeriodLockGuard.ts:30-37` |
| `AttendanceType` | `1329-1338` | `lam_viec` · `nua_ngay` · `cong_tac` · `nghi_phep` · `nghi_le` · `om` · `khong_luong` · `khac` | ⚠️ **Enum này hiện KHÔNG ảnh hưởng tiền lương** — xem 🔴 A-03 (Mục 6) |
| `OvertimeType` | `1341-1348` | `ngay_thuong_ngay` · `ngay_thuong_dem` · `chu_nhat_ngay` · `chu_nhat_dem` · `ngay_le_ngay` · `ngay_le_dem` | 6 loại khớp 6 trường `otRate*` của `GeneralSetting` (`1112-1117`) — mapping ở `payrollInputs.service.ts:212-219` ✅ |
| `DiligenceDeductionMethod` | `1351-1355` | `theo_gio` · `theo_lan` · `mat_toan_bo` | Quyết định công thức phạt ở `payrollCalculation.service.ts:209-218` |
| `AdjustmentDirection` | `1358-1361` | `tru` · `bu` | `netAdjustment = Σtru − Σbu`; dương ⇒ giảm thực lĩnh |
| `CatalogStatus` | `1364-1367` | `ACTIVE` · `INACTIVE` | Dùng chung cho cả 4 bảng danh mục. **Cố ý tách khỏi `SalaryItemStatus`** (`1189-1192`) dù cùng giá trị — 2 vòng đời độc lập, gộp sẽ tạo phụ thuộc chéo giữa `cai_dat_luong` và `du_lieu_tinh_luong` |

**Enum tái sử dụng từ `cai_dat_luong` (KHÔNG tạo mới):** `SalaryItemCategory` (`1179-1187`) — 8 phân hệ dùng đúng 4 trong 7 giá trị: `PERIODIC_BONUS` (Thưởng), `COMMISSION_PERCENTAGE` (Lương phần trăm), `KPI_PERFORMANCE` (nền lương KPI), `ATTENDANCE_ALLOWANCE` (đơn giá chuyên cần). Xác nhận **không bịa category mới**.

---

## 3. Chi tiết Bảng — Nhóm A: Kỳ tính lương

### 3.1. `hrm_payroll_periods` — `schema.prisma:1374-1405`

```prisma
model PayrollPeriod {
  id               String              @id @default(uuid()) @db.VarChar(64)
  code             String              @unique @db.VarChar(20)   // YYYY-MM
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

  attendanceRecords AttendanceRecord[]     // + 7 quan hệ con khác, tất cả Cascade
  payrollSheetLines PayrollSheetLine[]

  @@index([status])
  @@index([year, month])
  @@map("hrm_payroll_periods")
}
```

| Hạng mục | Đánh giá |
|---|---|
| PK | `id` uuid VarChar(64) ✅ nhất quán với `SalaryItem`/`EmployeeSalary` thật (`1218`, `1277`) |
| Unique | `code` `YYYY-MM` ✅ — chống tạo trùng kỳ; `createPayrollPeriod` còn kiểm trước và ném 409 (`payrollPeriods.service.ts:74-80`) |
| Index | `@@index([status])`, `@@index([year, month])` ✅ khớp 2 bộ lọc thật của `listPayrollPeriods` (`:14-22`) |
| Nullable | 4 cột `lockedBy/At`, `approvedBy/At` nullable đúng — chỉ có giá trị sau khi qua trạng thái tương ứng |
| Audit | ⚠️ Có `lockedByUserId`/`approvedByUserId` nhưng **KHÔNG có `reopenedByUserId`/`reopenedAt`/`reopenReason`** → xem 🔴 A-04 |
| Redundancy | `month`+`year` **suy được** từ `code`, và `startDate`/`endDate` suy được từ `month`+`year` (`:82-83`). Chấp nhận: denormalize có chủ đích để index `[year, month]` và tránh parse chuỗi ở mọi truy vấn. Rủi ro lệch = 0 vì cả 4 cột chỉ ghi 1 lần lúc `create`, `updatePayrollPeriodSchema` chỉ cho sửa `name` (`payrollPeriods.validator.ts:11-13) |
| Thiếu | ❌ **Không có cột `version`/`rowVersion`** cho optimistic lock → `E-dltl-026` không thể triển khai. Xem 🟠 A-06 |

---

## 4. Chi tiết Bảng — Nhóm B: 8 phân hệ nhập liệu biến động

> **Khuôn mẫu chung (đã kiểm cả 8):** mỗi bảng có `id` uuid VarChar(64) · `periodId` FK Cascade · `ma_nv` FK Cascade · `@@unique([periodId, ma_nv, <cột phân biệt>])` · `@@index([periodId, ma_nv])` · `note VarChar(500)?` · `createdAt`/`updatedAt`. Khuôn này **đúng** cho mô hình truy vấn thật (luôn lọc theo `periodId` rồi gom theo `ma_nv`).

### 4.1. `hrm_attendance_records` (1 — Chấm công) — `1408-1428`

```prisma
  periodId       String         @db.VarChar(64)
  ma_nv          String         @db.VarChar(24)
  workDate       DateTime       @db.Date
  attendanceType AttendanceType
  actualHours    Decimal        @default(8.00) @db.Decimal(4, 2)
  workDayValue   Decimal        @default(1.00) @db.Decimal(3, 2)

  @@unique([periodId, ma_nv, workDate])
  @@index([periodId, ma_nv])
  @@index([workDate])
```

- **Mô hình delta**: không có bản ghi ⇒ nhân viên hưởng đủ ngày công chuẩn (`payrollCalculation.service.ts:152-156`). Đây là lựa chọn đúng — không materialize 26×N dòng/kỳ.
- `@@unique([periodId, ma_nv, workDate])` là điều kiện để `upsert` bằng khóa tổ hợp hoạt động (`payrollInputs.service.ts:115-121`) ✅.
- ⚠️ `@@index([workDate])` **hiện không có truy vấn nào dùng** (không có filter theo ngày đơn lẻ trong `payrollInputs.service.ts`/`payrollCalculation.service.ts`) — index chết, tốn write. Giữ lại được nếu có kế hoạch báo cáo theo ngày; nếu không, nên bỏ.
- 🔴 **`attendanceType` được lưu nhưng không bao giờ được đọc để tính tiền** — xem A-03.

### 4.2. `hrm_overtime_records` (2 — Tăng ca) — `1431-1450`

```prisma
  otType         OvertimeType
  hours          Decimal       @db.Decimal(5, 2)
  ratePercent    Decimal       @db.Decimal(5, 2)   // SNAPSHOT tại thời điểm apply
  convertedHours Decimal       @db.Decimal(6, 2)   // = hours × ratePercent / 100

  @@unique([periodId, ma_nv, otType])
```

- ✅ **Bất biến snapshot tỷ lệ OT**: `ratePercent` được sao chép từ `GeneralSetting.otRate*` tại lúc ghi (`payrollInputs.service.ts:212-219`, `:237`), không tham chiếu động. Đổi cấu hình OT về sau **không** làm lệch kỳ đã nhập. Đây là điểm thiết kế tốt nhất của module.
- `convertedHours Decimal(6,2)` — trần 9 999,99 giờ quy đổi/dòng: dư thừa an toàn.
- `@@unique([periodId, ma_nv, otType])` khiến kiểm trùng ở tầng service (`:201-207`) chỉ là lớp bảo vệ thứ hai — DB đã chặn. ✅ Defense in depth đúng.

### 4.3. `hrm_kpi_records` (3 — KPI) — `1471-1493`

```prisma
  kpiItemId      String  @db.VarChar(64)
  weight         Int     @default(100)
  targetValue    Decimal @db.Decimal(12, 2)
  actualValue    Decimal @db.Decimal(12, 2)
  completionRate Decimal @db.Decimal(6, 2)   // = actual/target × 100, tính ở service

  @@unique([periodId, ma_nv, kpiItemId])
  @@index([periodId, ma_nv])
  @@index([kpiItemId])
```

- `completionRate` là **cột suy diễn được lưu** (`payrollInputs.service.ts:338`). Chấp nhận: tránh tính lại ở engine, và giữ được giá trị lịch sử nếu công thức đổi. Không có rủi ro lệch vì bảng chỉ ghi qua đúng 1 đường (`applyKpi`).
- Chia 0 **đã được chặn ở validator**: `targetValue: z.coerce.number().positive()` (`inputs.validator.ts:63`) ⇒ `actual/target` không bao giờ `Infinity`. ✅ (Đây là điểm cần ghi rõ để QA không viết test sai kỳ vọng.)
- `Decimal(6,2)` cho `completionRate` = trần 9 999,99% — đủ cho vượt chỉ tiêu cực đoan.
- ❌ **Không kiểm `kpiItemId` tồn tại trước khi ghi** → xem 🟠 A-08.

### 4.4. `hrm_bonus_records` (4 — Thưởng) — `1496-1515`

```prisma
  salaryItemId String     @db.VarChar(64)
  amount       Decimal    @default(0) @db.Decimal(18, 2)
  salaryItem   SalaryItem @relation(fields: [salaryItemId], references: [id], onDelete: Restrict)

  @@unique([periodId, ma_nv, salaryItemId])
```

**Xác nhận liên kết tái sử dụng `cai_dat_luong`:** FK `salaryItemId → hrm_salary_items.id` khai đúng 2 chiều — phía con `1509`, phía cha `SalaryItem.bonusRecords BonusRecord[]` (`1233`). `onDelete: Restrict` ✅ — không cho xóa khoản lương đã phát sinh thưởng.

⚠️ **Nhưng ràng buộc "phải thuộc category `PERIODIC_BONUS`" (BR-dltl-012) KHÔNG tồn tại ở bất kỳ tầng nào** — không ở DB (không thể, FK không phân biệt được category), không ở validator (`inputs.validator.ts:74-78` chỉ yêu cầu chuỗi không rỗng), không ở service (`applyBonus` `:402-436` không truy vấn `salaryItem` lần nào). Hệ quả: gán nhầm 1 khoản `FIXED_ALLOWANCE` làm "thưởng" vẫn ghi thành công và vẫn cộng vào `bonusSalary` (`payrollCalculation.service.ts:188` cộng mọi `BonusRecord` không lọc category). Xem 🟠 A-08.

### 4.5. `hrm_piecework_products` + `hrm_piecework_records` (5) — `1518-1533`, `1536-1557`

```prisma
  // record
  productId   String  @db.VarChar(64)
  unitPrice   Decimal @db.Decimal(18, 2)   // SNAPSHOT — KHÔNG có @default, buộc ghi rõ
  quantity    Decimal @db.Decimal(10, 2)
  totalAmount Decimal @db.Decimal(18, 2)
```

- ✅ **BR-dltl-014 (bất biến đơn giá) đúng ở cả 2 tầng**: schema không có `@default` nên buộc service quyết định giá trị; `applyPiecework` (`:512`) lấy `it.unitPrice ?? catalogPriceMap.get(productId) ?? 0` rồi ghi cứng. Đọc bảng lương về sau **không** join `PieceworkProduct` để lấy giá (`payrollCalculation.service.ts:192` chỉ sum `totalAmount`). Sửa giá danh mục không đụng kỳ cũ.
- `quantity Decimal(10,2)` — trần 99 999 999,99 đơn vị. Đủ.

### 4.6. `hrm_commission_records` (6 — Lương phần trăm) — `1560-1581`

```prisma
  salaryItemId   String  @db.VarChar(64)
  baseAmount     Decimal @db.Decimal(18, 2)
  commissionRate Decimal @db.Decimal(5, 2)   // SNAPSHOT từ SalaryItem.defaultRate
  totalAmount    Decimal @db.Decimal(18, 2)
```

**Xác nhận liên kết:** FK `1575` + phía cha `SalaryItem.commissionRecords` (`1234`), `onDelete: Restrict` ✅.
✅ **BR-dltl-016 (bất biến tỷ lệ)** đúng: `applyCommission` `:590-593` đọc `SalaryItem.defaultRate` (`1224`) một lần rồi snapshot vào `commissionRate` `:611`.
⚠️ Cùng lỗ hổng như 4.4: không ràng buộc category `COMMISSION_PERCENTAGE`. Hàm `:590-592` có truy vấn `salaryItem.findMany` nhưng **chỉ để lấy `defaultRate`**, không kiểm tồn tại (id sai ⇒ `defaultRateMap.get()` trả `undefined` ⇒ fallback `0` ⇒ ghi tiếp và **vỡ ở FK**), không kiểm category.
- `commissionRate Decimal(5,2)` trần 999,99 — validator chặn `max(100)` (`inputs.validator.ts:101`), khớp.

### 4.7. `hrm_diligence_violation_types` + `hrm_diligence_records` (7) — `1584-1599`, `1602-1623`

```prisma
  violationTypeId String   @db.VarChar(64)
  violationDate   DateTime @db.Date
  violationHours  Decimal? @db.Decimal(4, 2)   // chỉ dùng khi method = theo_gio

  @@unique([periodId, ma_nv, violationTypeId, violationDate])
  @@index([periodId, ma_nv]) @@index([violationTypeId]) @@index([violationDate])
```

- Unique 4 cột ✅ — hậu thuẫn DB cho E-dltl-019, service kiểm trước bằng `findUnique` trên đúng khóa tổ hợp (`payrollInputs.service.ts:720-733`).
- `violationHours` nullable đúng (chỉ có nghĩa với `theo_gio`). ⚠️ Không có `CHECK` ràng buộc "`theo_gio` ⇒ `violationHours NOT NULL`"; service fallback ×1 khi null (`payrollCalculation.service.ts:214`) — im lặng nhưng an toàn.
- ⚠️ **`penaltyRate` KHÔNG được snapshot vào record** (khác hẳn 4.2/4.5/4.6). Engine đọc động qua `include: { violationType: true }` (`payrollCalculation.service.ts:73`, `:216`). Hệ quả: sửa `penaltyRate` của 1 loại vi phạm sẽ **làm đổi kết quả preview của mọi kỳ chưa khóa**. Với kỳ đã `LOCKED` thì vô hại (đã có snapshot ở `PayrollSheetLine`). Đây là **bất nhất thiết kế trong cùng 1 module**: 3/4 nguồn đơn giá snapshot, riêng chuyên cần thì không. Xem 🟠 A-09.
- ⚠️ `@@index([violationDate])` không có truy vấn nào dùng — index chết như 4.1.

### 4.8. `hrm_salary_adjustment_items` + `hrm_salary_adjustment_records` (8) — `1626-1641`, `1644-1663`

```prisma
  adjustmentItemId String  @db.VarChar(64)
  amount           Decimal @db.Decimal(18, 2)   // luôn dương, chiều nằm ở item.direction
  @@unique([periodId, ma_nv, adjustmentItemId])
```

- Tách **giá trị** (`amount`, luôn > 0 theo `inputs.validator.ts:125`) khỏi **chiều** (`SalaryAdjustmentItem.direction`, `1630`) là chuẩn hóa đúng: không lưu số âm, không suy diễn dấu từ ký hiệu.
- ⚠️ Cùng vấn đề 4.7: `direction` đọc động (`payrollCalculation.service.ts:74`, `:228`). Đổi `direction` của 1 khoản từ `tru` sang `bu` sẽ **đảo dấu toàn bộ bản ghi cũ ở mọi kỳ chưa khóa**. Rủi ro cao hơn `penaltyRate` vì đảo dấu tiền, không phải lệch số. Xem 🟠 A-09.
- `@@index([direction])` ở bảng danh mục (`1638`) — bảng ≤99 dòng, index này vô ích.

---

## 5. Chi tiết Bảng — Nhóm C: Snapshot bảng lương

### 5.1. `hrm_payroll_sheet_lines` — `schema.prisma:1666-1715`

29 cột dữ liệu (18 cột "bảng lương" nghiệp vụ + 11 cột định danh/ngữ cảnh). Trích nhóm quan trọng:

```prisma
  // Định danh đóng băng — copy tại thời điểm khóa sổ, KHÔNG join lại
  employeeCode   String  @db.VarChar(24)
  fullName       String  @db.VarChar(254)
  departmentName String? @db.VarChar(254)
  positionName   String? @db.VarChar(100)
  contractType   String? @db.VarChar(24)
  salaryType     String? @db.VarChar(8)
  dependentCount Int     @default(0)

  // Toàn bộ 22 cột tiền/số đều Decimal — KHÔNG Float/Int
  baseSalaryMonthly          Decimal @default(0) @db.Decimal(18, 2)
  standardWorkDays           Decimal @db.Decimal(4, 2)
  actualWorkDays             Decimal @db.Decimal(4, 2)
  otConvertedHours           Decimal @db.Decimal(6, 2)
  ... proratedWorkSalary · otAmount · pieceworkSalary · bonusSalary · kpiSalary
      commissionSalary · diligenceSalary · grossIncome · taxableIncome
      insuranceSalaryBase · employeeInsuranceDeduction · companyInsuranceExpense
      employeeUnionFee · companyUnionExpense · adjustmentNetAmount
      personalIncomeTax · netTakeHomeSalary · totalCompanyCost   (đều Decimal(18,2))

  @@unique([periodId, ma_nv])
  @@index([periodId])
  @@index([ma_nv])
```

| Hạng mục | Đánh giá |
|---|---|
| Kiểu tiền tệ | ✅ **Decimal(18,2) toàn bộ, không có Float/Double nào** — đúng chuẩn kế toán. Trần 9 999 999 999 999 999,99 đ. (Rủi ro sai số nằm ở tầng tính toán JS, không ở schema — xem 🟠 A-07.) |
| Denormalize định danh | ✅ Đúng chủ đích: `fullName`/`departmentName`/`positionName`/`contractType` copy cứng để đổi tên nhân viên / chuyển phòng ban **không** làm sai bảng lương đã chốt. Nhất quán với triết lý đã ghi trong schema (`855-933` chú thích "không có bản sao hợp đồng hiện hành"), chỉ khác ở chỗ đây là snapshot có chủ đích chứ không phải bản sao sống. |
| Unique | `@@unique([periodId, ma_nv])` ✅ — 1 người 1 dòng/kỳ |
| Index thừa | ⚠️ `@@index([periodId])` **dư thừa hoàn toàn** — `@@unique([periodId, ma_nv])` đã tạo B-tree có `periodId` làm cột dẫn đầu, phục vụ mọi truy vấn `where: { periodId }` (`payrollCalculation.service.ts:345`). Nên bỏ để giảm chi phí ghi (bảng này ghi hàng loạt lúc khóa sổ). |
| `standardWorkDays` | Được lưu per-line ✅ — cho phép audit "kỳ này tính theo bao nhiêu ngày chuẩn", đúng tinh thần snapshot. Đáng tiếc là giá trị ghi vào luôn là hằng 26 (xem 🔴 A-02). |
| Thiếu | Không có `calculatedAt`/`engineVersion`. Khi engine đổi công thức (chắc chắn sẽ đổi sau khi sửa A-02), không truy được dòng nào tính bằng phiên bản nào. Đề xuất thêm `engineVersion String @db.VarChar(16)`. |

---

## 6. Phát hiện kiến trúc (đối soát độc lập với mã nguồn)

> Mục này **không lặp lại** Mục 5/7/11 của SRS. Chỉ ghi (a) xác nhận/phủ nhận 4 phát hiện 🔴 của BA kèm định lượng chi phí sửa, và (b) phát hiện mới thuộc góc nhìn kiến trúc.

### 6.1. Thẩm định lại 4 phát hiện 🔴 của Business Analyst

| # BA | Kết luận Architect | Bằng chứng đối soát độc lập | Chi phí sửa |
|:---:|---|---|---|
| **1** — 8/8 Panel còn mock | ✅ **ĐÚNG, và phạm vi rộng hơn BA nêu** | 8 Panel: `BuTruPanel.tsx:30` · `ChamCongPanel.tsx:24` · `ChuyenCanPanel.tsx:29` · `KpiPanel.tsx:29` · `LuongPhanTramPanel.tsx:30` · `LuongSanPhamPanel.tsx:30` · `TangCaPanel.tsx:30` · `ThuongPanel.tsx:30`. **Tổng 23 file** còn phụ thuộc `mock/hooks` (thêm 7 `DanhSach*Card.tsx`, 7 `TaiSuDung*Dialog.tsx`, `ThanhLocKyLuong.tsx:15`). **Cải chính BA:** câu "dialog Tái sử dụng của 6/8 module đã nối API thật" **không chính xác** — cả 7 dialog đều còn mock, chúng ở trạng thái **lai** (vd `TaiSuDungKpiDialog.tsx`: `:15` dùng API thật `useChiTieuKpiList`, nhưng `:14` `useBanKpiList` và `:16` `useNhanVienList` vẫn mock) | **Trung bình.** Tầng API client **đã viết đủ** (`payrollInputsApi/Queries.ts`, `payrollPeriodsQueries.ts`, `payrollCatalogsQueries.ts`, `payrollCalculationQueries.ts`) ⇒ chỉ là đấu dây 23 component, không phải xây tầng dữ liệu. **KHÔNG chặn chu kỳ backend** — `frontend-engineer` đang ⏸️ theo `CLAUDE.md`. Ghi nhận là nợ FE. |
| **2** — Engine hardcode cấu hình | ✅ **ĐÚNG (🔴), cần chỉnh 1 con số** | Hardcode xác nhận: `payrollCalculation.service.ts:136` (26 ngày) · `:163` (8.0 h) · `:244` (0.105) · `:245` (0.215) · `:249` (1% + trần 234 000) · `:250` (2%) · `:7-28` (7 bậc thuế); thêm `payrollInputs.service.ts:113` (chia 8.0) và `:192` (trần OT 40). **15 trường `GeneralSetting` chết**: `standardWorkingDaysMethod`(1106) `standardHoursPerDay`(1109) `maxOtHoursPerMonth`(1118) `warningOtHoursPerYear`(1119) `maxOtHoursPerYear`(1120) `baseSalary`(1121) `regionMinSalary`(1122) `insurance*`×6 (1123-1128) `unionFee*`×3 (1129-1131) `taxBrackets`(1134). **Cải chính BA:** con số "2/~15" chỉ đúng khi giới hạn trong `calculatePayrollPreview`. Xét toàn module là **8/23** — 6 trường `otRate*` (1112-1117) **CÓ** được đọc đúng ở `payrollInputs.service.ts:212-219`. QA cần biết để không viết test sai cho phần OT rate. | **Trung bình.** ~150 LOC + 1 helper `loadPayrollConfig()`. Chi phí thật không nằm ở code mà ở việc **chốt hình dạng JSON của `taxBrackets`** (`1134` khai `Json @db.JsonB`, chưa có schema) — cần ADR + Zod schema + migration dữ liệu mặc định. Xem **ADR-dltl-04**. |
| **3** — Reopen thiếu role-guard + audit | ✅ **ĐÚNG, nhưng 2 vế chênh nhau 100 lần về chi phí** | Role-guard: `payrollPeriods.route.ts:15` không có `preHandler`; chỉ có guard module chung `hrm.route.ts:34-39`. Audit: `payrollPeriods.service.ts:181-201` cố ý bỏ `_input`/`_userId`; đã quét toàn bộ `^model` của `schema.prisma` — **không có bảng audit nào** trong tenant. **Bổ sung của Architect:** vấn đề nặng hơn "thiếu log" — validator **bắt buộc lý do ≥20 ký tự** (`payrollPeriods.validator.ts:26-31`) rồi **vứt đi**. Giao diện hứa hẹn trách nhiệm giải trình mà hệ thống không hề có. Đây là *tệ hơn* việc không hỏi lý do. **Mở rộng phạm vi:** `lock` (`:14`) và `approve` (`:16`) cũng không có role-guard — đây là 2 hành vi thẩm quyền tài chính, phải gộp chung. | **Role-guard: RẤT RẺ (~3 dòng).** Đã có sẵn tiền lệ dùng lại được ngay: `assertAdminOrOwner` tại `be_maxv/src/routes/hrm/cau_hinh_mac_dinh/generalSettings.route.ts:10-16`. Chỉ cần `import` + gắn `{ preHandler: assertAdminOrOwner }` cho `reopen`/`lock`/`approve`. **Nên sửa ngay, không chờ ADR.** <br> **Audit log: ĐẮT.** Bảng mới + migration + quyết định phạm vi (chỉ payroll hay audit chung toàn HRM). Xem **ADR-dltl-05**. |
| **4** — `createPayrollPeriod` không sinh lịch công chuẩn | ⚠️ **ĐÚNG VỀ SỰ KIỆN, nhưng HẠ MỨC 🔴 → 🟠 và phải đổi cách sửa** | Sự kiện đúng: `payrollPeriods.service.ts:71-96` chỉ tính `startDate`/`endDate` bằng `Date.UTC` rồi `create` 1 dòng; không đọc `Holiday`/`GeneralSetting`, không sinh `AttendanceRecord`. **Nhưng đánh giá kiến trúc: KHÔNG NÊN sinh lịch.** Mô hình chấm công là *delta* (`payrollCalculation.service.ts:152-156`: không có bản ghi ⇒ hưởng đủ công chuẩn). Sinh sẵn 26×N dòng/kỳ là materialize cái mặc định — tốn ghi, làm hỏng chính ngữ nghĩa "delta", và tạo nợ đồng bộ khi đổi cấu hình. **Khuyết tật thật nằm ở chỗ khác:** cái *mặc định ngầm* (26 ngày) bỏ qua `Holiday`(1158-1173) + `saturdayPolicy`(1107) + `sundayPolicy`(1108) + `standardWorkingDaysMethod`(1106). Lưu ý `getAttendanceMatrix` **đã** nạp sẵn `settings` + `holidays` và trả về FE (`payrollInputs.service.ts:86-105`) — nghĩa là màn hình vẽ đúng lịch, chỉ có **engine** là mù. | **Gộp vào #2, gần như miễn phí thêm.** Sửa `standardWorkDays` thành hàm `resolveStandardWorkDays(period, setting, holidays)` là xong cả #2 lẫn #4. **Không** viết code sinh bản ghi. |

### 6.2. Phát hiện mới của Architect (BA chưa nêu)

| Mã | Mức | Phát hiện | Bằng chứng | Hướng xử lý |
|---|:---:|---|---|---|
| **A-01** | 🔴 | **Rò rỉ dữ liệu lương trong nội bộ tenant.** `GET /payroll/calculate` và `/payroll/sheet-lines` trả **lương gộp, thực lĩnh, thuế TNCN của TOÀN BỘ nhân viên**, nhưng cả 4 controller chỉ gọi `resolveTenantDb(req)` — **không** `resolveTenantCtx` + `assertXemLuong`. Chính sách dự án (QĐ #8 / BR-hrm-059 / ADR-007, ghi tại `helpers/resolveTenantDb.ts:29-34` và `:103-111`) yêu cầu mọi dữ liệu lương phải qua cờ `DonViAccess.xemLuong`. Hiện chỉ `hopDong.controller.ts:35-36` và `nhanVien.controller.ts:33-62` tuân thủ. ⇒ Một `OWNER_EMPLOYEE` được cấp module `hrm` nhưng `xemLuong=false` vẫn đọc được toàn bộ bảng lương công ty. **BA đánh NFR-dltl-001 ✅ vì chỉ kiểm cô lập *chéo tenant* — đúng, nhưng bỏ sót phân quyền *trong* tenant.** | `payrollCalculation.controller.ts:13,19` · `payrollPeriods.controller.ts:17,...` · `payrollInputs.controller.ts:26,...` · `catalogs.controller.ts:23,...` | Thêm `resolveTenantCtx` + `assertXemLuong` (2 dòng/controller). Lưu ý công bằng: `cai_dat_luong` **cũng thiếu** ⇒ đây là lỗ hổng hệ thống, cần quyết định cấp dự án; nhưng `/payroll/calculate` là endpoint nhạy cảm nhất toàn HRM nên phải bịt trước. |
| **A-02** | 🔴 | **Chọn sai hợp đồng ⇒ sai lương gốc.** `payrollCalculation.service.ts:44-47` lấy `hop_dong: { orderBy: { ngay_bat_dau: 'desc' }, take: 1 }` — hợp đồng **mới nhất theo ngày bắt đầu**, KHÔNG lọc theo kỳ. Hai ca hỏng thật: (a) hợp đồng ký trước cho 2026-10 kèm tăng lương ⇒ tính/khóa kỳ **2026-09** dùng luôn lương tháng 10; (b) hợp đồng đã hết hạn (`ngay_ket_thuc` < đầu kỳ) vẫn trả lương. Schema có đủ `ngay_bat_dau`/`ngay_ket_thuc` (`981-1012`) và **chính chú thích trong schema đã cảnh báo đúng bẫy này** (`855-933`: "hợp đồng ký trước cho tương lai... bản sao đứng im"). Nặng hơn BR-dltl-003 của BA (BR đó chỉ nói về `resolveTargetEmployees`, tức phạm vi *nhập liệu*; lỗi này nằm trong *engine tính tiền*). | `payrollCalculation.service.ts:41-51`, `:146-147` | `where: { ngay_bat_dau: { lte: period.endDate }, OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: period.startDate } }] }`. Rẻ, phải làm cùng đợt sửa engine. |
| **A-03** | 🔴 | **`attendanceType` không ảnh hưởng tiền — nghỉ không lương vẫn trả đủ.** `overrideAttendanceCell` (`payrollInputs.service.ts:111-113`): `actualHours = input.actualHours ?? 8.0` rồi `workDayValue = actualHours/8.0`. Engine chỉ cộng `workDayValue` (`payrollCalculation.service.ts:153`), **không đọc `attendanceType` một lần nào**. ⇒ đánh dấu `khong_luong`/`om`/`nghi_phep` mà không tự tay hạ `actualHours` ⇒ `workDayValue = 1.00` ⇒ hưởng nguyên ngày công. `nua_ngay` cũng trả đủ ngày trừ khi client nhớ gửi 4h. Enum 8 giá trị (`schema.prisma:1329-1338`) hiện chỉ là nhãn trang trí. `actualHours` cũng không bị chặn trần 1 ngày công (validator cho tới 24h ⇒ `workDayValue` tới 3.0/ngày). | `payrollInputs.service.ts:108-138`; `payrollCalculation.service.ts:150-157` | Suy `workDayValue` từ `attendanceType` qua bảng chính sách (cấu hình được), `actualHours` chỉ là ghi đè khi `lam_viec`/`nua_ngay`. Chặn `workDayValue ≤ 1.0`. |
| **A-04** | 🟠 | **Không có ranh giới giao dịch quanh chuyển trạng thái — TOCTOU toàn tập.** Mọi transition đọc `status` **ngoài** lệnh ghi rồi `update` vô điều kiện (`payrollPeriods.service.ts:99` `112` `128` `141` `157` `187` `204` `221` `234`). Hai lượt `lock` đồng thời đều qua kiểm tra ⇒ cùng chạy `snapshotPayrollSheet` (deleteMany + createMany). Ở READ COMMITTED, tx sau chờ rồi xóa chính dữ liệu tx trước vừa ghi, hoặc đụng `@@unique([periodId, ma_nv])` ⇒ Prisma P2002 ⇒ `errorHandler.plugin.ts:103-107` trả **409 "Dữ liệu bị trùng"**, KHÔNG phải `E-dltl-026`. Đây là lý do kỹ thuật khiến `E-dltl-026` "không triển khai được" — không phải quên, mà là thiếu cột `version` (Mục 3.1). | `payrollPeriods.service.ts:156-176`; `errorHandler.plugin.ts:102-119` | Đổi sang `updateMany({ where: { id, status: <kỳ vọng> }, ... })` + `assert count === 1` ⇒ ném `E-dltl-026` (409). ~10 dòng/transition, không cần migration. |
| **A-05** | 🟠 | **`apply*` = N+1 lệnh ghi bên trong interactive transaction, không giới hạn, không đặt timeout.** Cả 6 hàm `apply*` lặp `for (const emp of targetEmployees)` phát `deleteMany` + `createMany` **tuần tự** trong `db.$transaction` (`payrollInputs.service.ts:221-246` · `:329-354` · `:416-435` · `:503-528` · `:595-620` · `:829-847`). Với `scope: 'toan_cong_ty'` 300 nhân viên = **600 round-trip nối tiếp trong 1 transaction**. Prisma interactive transaction mặc định `timeout: 5000ms`, `maxWait: 2000ms` — **không nơi nào truyền option `{ timeout }`**. Kết cục ở quy mô thật: **P2028 timeout ⇒ rollback toàn bộ**, và trong lúc chạy thì giữ khóa dòng trên bảng đó suốt cả kỳ. `employeeIds` cũng **không có `.max()`** (`inputs.validator.ts:10`) ⇒ payload không chặn trên. | như cột trái | Gộp thành 2 câu lệnh: `deleteMany({ where: { periodId, ma_nv: { in: maNvs } } })` + 1 `createMany` trên tích Descartes `(nhân viên × items)`. 2 lệnh thay vì 2N. Kèm `$transaction(fn, { timeout: 30_000 })` và `.max(500)` cho `employeeIds`. |
| **A-06** | 🟠 | **Cùng 1 endpoint trả 2 kiểu dữ liệu khác nhau — FE vỡ âm thầm sau khi khóa sổ.** `getPayrollSheetLines` (`payrollCalculation.service.ts:333-349`) trả **object JS số nguyên** khi kỳ `DRAFT`/`PENDING_REVIEW`, nhưng trả **bản ghi Prisma** khi `LOCKED+`. Prisma `Decimal` serialize ra JSON là **chuỗi**, và bản ghi còn kèm `id`/`createdAt`/`updatedAt`. ⇒ `netTakeHomeSalary` là `12345678` (number) trước khóa và `"12345678.00"` (string) sau khóa. Mọi phép cộng/`toLocaleString()` phía FE sẽ sai sau khi khóa sổ mà không báo lỗi. Cùng vấn đề với `records: empRecords` trong cả 8 hàm `get*Data` (mọi cột `Decimal` là chuỗi). | `payrollCalculation.service.ts:339-348` | Chuẩn hóa 1 kiểu ở biên response (serializer Decimal→number), **hoặc** chốt "tiền là chuỗi" trong hợp đồng API và bắt FE parse. Phải chốt trước khi FE đấu dây (liên quan trực tiếp phát hiện #1). Xem `api-contract` Mục 6. |
| **A-07** | 🟠 | **Preview ≠ Snapshot tới 0,5đ/dòng do thiếu làm tròn.** Schema đúng (Decimal(18,2) toàn bộ), nhưng engine tính bằng `Number()` float64. Với VND nguyên thì float64 chính xác tuyệt đối (< 2^53) — **không** phải rủi ro thảm họa. Rủi ro thật ở 4 kết quả **không** có `Math.round`: `diligencePenalty`/`diligenceSalary` (`payrollCalculation.service.ts:219-220`, mà `tongPhat` cộng dồn `penaltyRate × violationHours`, cả hai đều `Decimal(_,2)` ⇒ ra số lẻ), `adjustmentNetAmount` (`:231`), `netTakeHomeSalary` (`:259-264`), `totalCompanyCost` (`:266`). PostgreSQL `numeric(18,2)` làm tròn khi ghi ⇒ **số trên màn preview khác số đã chốt trong snapshot**. Đây đúng loại lệch mà kế toán báo là bug. | như cột trái | Thêm `Math.round()` cho 4 giá trị, hoặc chuyển engine sang `Prisma.Decimal`. Rẻ. |
| **A-08** | 🟠 | **Không kiểm tồn tại/đúng loại của khóa ngoại danh mục ⇒ trả 409 sai nghĩa.** `applyKpi`/`applyBonus`/`applyPiecework`/`applyCommission`/`applyAdjustments` **không** kiểm `kpiItemId`/`salaryItemId`/`productId`/`adjustmentItemId` có tồn tại không (`applyCommission` có query nhưng chỉ lấy `defaultRate`, `:590-593`). ID sai ⇒ Prisma P2003 ⇒ `errorHandler.plugin.ts:113-118` trả **409 "còn được tham chiếu"** — thông điệp dành cho thao tác XÓA, hoàn toàn sai ngữ cảnh INSERT. Đây chính là lý do E-dltl-008/013/021 "mã không hợp lệ" nằm trên giấy. Đồng thời **không** ràng buộc category `PERIODIC_BONUS`/`COMMISSION_PERCENTAGE` như BR-dltl-012/015 công bố (Mục 4.4, 4.6). | `payrollInputs.service.ts:309-355`, `:402-436`, `:483-529`, `:576-621`, `:815-849`; `errorHandler.plugin.ts:113-118` | Nạp trước danh mục (1 query `findMany({ where: { id: { in: ids } } })` — vốn đã có ở piecework/commission), đối chiếu đủ id + đúng category, ném `E-dltl-008/011/013/016/021` (400). |
| **A-09** | 🟡 | **Bất nhất chiến lược snapshot trong cùng module.** 3/5 nguồn đơn giá được snapshot (`OvertimeRecord.ratePercent`, `PieceworkRecord.unitPrice`, `CommissionRecord.commissionRate`) nhưng 2 nguồn đọc động: `DiligenceViolationType.penaltyRate` và `SalaryAdjustmentItem.direction`. Sửa danh mục ⇒ đổi kết quả preview của mọi kỳ chưa khóa; riêng đổi `direction` là **đảo dấu tiền**. Kỳ đã `LOCKED` an toàn nhờ `PayrollSheetLine`. | `schema.prisma:1602-1623`, `1644-1663`; `payrollCalculation.service.ts:216`, `:228` | Hoặc snapshot nốt 2 trường, hoặc ghi rõ đây là chủ đích. Xem **ADR-dltl-03**. |
| **A-10** | 🟡 | **Index: 3 index chết, 1 index thật sự thiếu.** Chết: `AttendanceRecord.@@index([workDate])` (`1426`), `DiligenceRecord.@@index([violationDate])` (`1621`), `PayrollSheetLine.@@index([periodId])` (`1712`, trùng cột dẫn đầu của `@@unique([periodId, ma_nv])`) — không truy vấn nào dùng, chỉ tốn chi phí ghi (nặng nhất đúng lúc khóa sổ ghi hàng loạt). Thiếu: `hrm_nhan_vien` không có index cho `(status, da_xoa)` trong khi **18 điểm gọi** đều lọc `{ status:'1', da_xoa:false }` (mọi `get*Data` + `resolveTargetEmployees` + engine) ⇒ seq scan bảng nhân viên ở mọi màn hình lương. | `schema.prisma:1426`, `1621`, `1712`, `929-931` | Bỏ 3 index chết; thêm `@@index([status, da_xoa])` vào `hrm_nhan_vien`. Tác động hiện tại nhỏ (bảng vài trăm dòng) nhưng miễn phí. |
| **A-11** | 🟡 | Tìm kiếm `q` dùng `contains` + `mode:'insensitive'` trên `ma_nv`/`ho_ten` ⇒ `ILIKE '%…%'`, không index được. Chấp nhận ở quy mô HRM. | `payrollInputs.service.ts:79-84` và 7 chỗ tương tự | Ghi nhận, không sửa. |
| **A-12** | 🟡 | `generateNext*Code` (4 hàm) nạp toàn bộ mã rồi quét 1..99 trong JS (`catalogs.service.ts:18-32`, `:93-107`, `:166-180`, `:239-253`). Hai lượt tạo đồng thời sinh cùng mã ⇒ chặn bởi `@@unique(code)` ở DB ⇒ **fail an toàn**, nhưng người dùng thấy 409 vô cớ. Khớp đúng khuôn đã dùng ở `cai_dat_luong` ⇒ chấp nhận, không phá vỡ quy ước. | như cột trái | Ghi nhận, không sửa (nhất quán > tối ưu). |
| **A-13** | 🟡 | **Cải chính tài liệu:** SRS Mục 6.2 viết `updatePayrollPeriod` là "sửa tên/ngày kỳ" — thực tế `updatePayrollPeriodSchema` **chỉ cho sửa `name`** (`payrollPeriods.validator.ts:11-13`); ngày kỳ không bao giờ sửa được. Kèm theo: `data: input` (`payrollPeriods.service.ts:107`) **an toàn**, không phải mass-assignment, vì Zod mặc định strip khóa lạ. | như cột trái | Sửa câu chữ trong SRS. Không phải defect. |

### 6.3. Xác nhận những điểm ĐÚNG (đã kiểm độc lập, không tin lại BA)

- ✅ **Kiểu tiền tệ**: 100% cột tiền là `Decimal`, không có `Float`/`Double`/`Int` nào bị dùng sai. Đã quét toàn bộ 14 model.
- ✅ **Cô lập đa tenant**: cả 4 controller (`catalogs`/`payrollPeriods`/`payrollInputs`/`payrollCalculation`) đều mở đầu bằng `resolveTenantDb(req)` — 52 điểm gọi, không sót hàm nào. Không có truy vấn nào nhận `dbName`/`tenantId` từ client.
- ✅ **Khóa ngoại `ma_nv String @db.VarChar(24)`** nhất quán tuyệt đối ở cả 9 bảng có tham chiếu nhân viên, khớp `hrm_nhan_vien.ma_nv` (`855`) và khớp tiền lệ `EmployeeSalary.ma_nv` (`1278`). **Khác tài liệu mẫu NestJS (UUID) là có chủ đích và đúng** — xem ADR-dltl-01.
- ✅ **Bất biến snapshot đơn giá sản phẩm / tỷ lệ hoa hồng / tỷ lệ OT**: cài đúng, không tham chiếu động.
- ✅ **Chặn sàn chuyên cần + giữ số âm thực lĩnh**: đúng ở cả 2 tầng (preview và engine), khớp nhau.
- ✅ **Transaction cho `apply*` và `lock`**: có thật (`$transaction` bọc đủ 6+1 chỗ). Ranh giới **phạm vi** đúng; vấn đề còn lại là **hiệu năng bên trong** (A-05) và **kiểm tra trạng thái nằm ngoài** (A-04), không phải thiếu transaction.
- ✅ **Liên kết tái sử dụng `hrm_salary_items`**: FK khai đủ 2 chiều cho cả Thưởng (`1509`/`1233`) và Lương phần trăm (`1575`/`1234`), `onDelete: Restrict` đúng. Chỉ thiếu ràng buộc *category* ở tầng ứng dụng (A-08).

---

## 7. Đối chiếu quy ước với feature liền kề `cai_dat_luong`

| Quy ước | `cai_dat_luong` (schema thật) | `du_lieu_tinh_luong` | Kết luận |
|---|---|---|---|
| Kiểu PK | `@default(uuid()) @db.VarChar(64)` (`1218`, `1277`) | `@default(uuid()) @db.VarChar(64)` | ✅ Khớp |
| FK nhân viên | `ma_nv String @db.VarChar(24)` (`1278`) | `ma_nv String @db.VarChar(24)` ×9 bảng | ✅ Khớp |
| Cột tiền | `Decimal(18,2)` (`1282`, `1305`) | `Decimal(18,2)` | ✅ Khớp |
| Cột tỷ lệ | `Decimal(5,2)` (`1224`) | `Decimal(5,2)` | ✅ Khớp |
| `@@map` snake_case | `hrm_salary_items`… | `hrm_payroll_periods`… | ✅ Khớp |
| Timestamps | `createdAt @default(now())` + `updatedAt @default(now()) @updatedAt` | Y hệt | ✅ Khớp |
| Envelope response | `{ success, data }` qua `sendOk`/`sendCreated` | Y hệt (`helpers/response.ts:4-10`) | ✅ Khớp |
| Guard quyền | Chỉ `requireModule('hrm')`; `PUT /settings/general` thêm `assertAdminOrOwner` | Chỉ `requireModule('hrm')` | ⚠️ Khớp *thực trạng* nhưng cả hai đều thiếu `assertXemLuong` — xem A-01 |

> **⚠️ Tài liệu `data-model-cai-dat-luong.md` (status `approved`) đã lệch schema thật.** Phát hiện khi đối chiếu để xác nhận liên kết `PERIODIC_BONUS`/`COMMISSION_PERCENTAGE`:
>
> | Mục trong doc đó | Doc ghi | `schema.prisma` thật |
> |---|---|---|
> | `SalaryItemCategory` (Mục 2.1) | `LUONG_PHU_CAP_CO_DINH`, `LUONG_HO_TRO_PHUC_LOI`, `LUONG_NGHIEM_THU`, `LUONG_HOA_HONG`, `LUONG_KPI`, `LUONG_THUONG`, `LUONG_CHUYEN_CAN` | `FIXED_ALLOWANCE`, `BENEFIT_ALLOWANCE`, `DELIVERY_PIECEWORK`, `COMMISSION_PERCENTAGE`, `KPI_PERFORMANCE`, `PERIODIC_BONUS`, `ATTENDANCE_ALLOWANCE` (`1179-1187`) |
> | `TaxTreatment` (2.3) | `TAXABLE` / `NON_TAXABLE` | `TAXABLE` / `EXEMPT` (`1194-1197`) |
> | `CalculationMethod` (2.4) | 4 giá trị `FIXED_MONTHLY`… | 7 giá trị `MONTHLY_FIXED`, `ACTUAL_WORKDAYS`, `HOURLY`, `OUTPUT_BASED`, `REVENUE_PERCENTAGE`, `KPI_BASED`, `MANUAL_ENTRY` (`1199-1207`) |
> | `SalaryItem` (3.1) | `cuid()`/`VarChar(36)`, `hasInsurance`, `description @db.Text` | `uuid()`/`VarChar(64)`, `isSocialInsurance`, `description @db.VarChar(500)` (`1217-1239`) |
> | `EmployeeSalary` (3.4) | `effectiveDate`, `note`, không có index | `effectiveFrom`/`effectiveTo`, không có `note`, có `approvedByUserId`/`approvedAt`, `@@index([ma_nv])`+`@@index([status])` (`1276-1296`) |
>
> **Khuyến nghị:** BA/Architect cập nhật lại `data-model-cai-dat-luong.md` theo schema thật trong một đợt riêng. Tài liệu hiện tại **không** lấy doc đó làm chuẩn; mọi tham chiếu đều trích thẳng `schema.prisma:line`.

---

## 8. Ranh giới Giao dịch & Yêu cầu Nhất quán

| Nghiệp vụ | Ranh giới transaction hiện tại | Mức nhất quán cần | Đánh giá |
|---|---|---|---|
| `apply*` 6 phân hệ | `$transaction` bọc `for(emp){ deleteMany; createMany }` (`payrollInputs.service.ts:221` …`:829`) | Strong — hoặc thay toàn bộ, hoặc không gì | ✅ Phạm vi đúng · ⚠️ Hiệu năng sai (A-05) |
| `PUT attendance/cell` | Không transaction — 1 `upsert` đơn (`:115`) | Đơn lệnh, atomic sẵn | ✅ Không cần |
| `POST diligence/record` | Không transaction — `findUnique` rồi `create` (`:720-744`) | Đọc-rồi-ghi | ⚠️ TOCTOU nhỏ, nhưng `@@unique` (`1618`) chặn ở DB ⇒ fail an toàn (409). Chấp nhận |
| **`lock` (khóa sổ)** | `$transaction{ snapshotPayrollSheet(tx); update status }` (`payrollPeriods.service.ts:163-176`) | **Strong bắt buộc** — snapshot 8 nguồn + đổi trạng thái phải cùng sống/chết | ✅ **Đúng phạm vi** — `deleteMany` + `createMany` + `update` đều trong 1 tx, `snapshotPayrollSheet` nhận `tx` chứ không phải `db` (`:165`) · ⚠️ nhưng kiểm trạng thái nằm **ngoài** tx (`:157`) ⇒ A-04, và 12 truy vấn của `calculatePayrollPreview` chạy **trong** tx ⇒ rủi ro chạm `timeout 5s` mặc định ở tenant lớn |
| `reopen` / `approve` / `mark-paid` / `archive` / `submit` / `reject` | Không transaction, `update` đơn | Đơn lệnh | ⚠️ A-04 (đọc-rồi-ghi không nguyên tử) |
| `DELETE payroll-period` | `delete` đơn, dựa `onDelete: Cascade` của 9 quan hệ con | Strong | ✅ Cascade ở tầng DB là nguyên tử |

**Kết luận về BR-dltl-022 (BA đánh ✅):** xác nhận **đúng về phạm vi** transaction, nhưng ✅ đó **không** kéo theo an toàn đồng thời — A-04 vẫn cho phép 2 lượt khóa sổ song song lọt qua. Hai vấn đề khác nhau, đừng gộp.

---

## 9. Quyết định Kiến trúc (ADR)

### ADR-dltl-01: Khóa ngoại nhân viên dùng `ma_nv` (VarChar 24), không dùng UUID

**Context.** Tài liệu mẫu NestJS (`docs/nestjs/du_lieu_tinh_luong/`) mô hình hóa quan hệ nhân viên bằng UUID surrogate key. 14 model mới cần chọn kiểu khóa ngoại và phải sống chung với `hrm_nhan_vien` đã tồn tại.

**Decision.** Dùng `ma_nv String @db.VarChar(24)` tham chiếu `hrm_nhan_vien.ma_nv`.

**Alternatives.** (a) Thêm cột UUID vào `hrm_nhan_vien` rồi FK theo UUID. (b) Giữ `ma_nv`.

**Trade-offs.** UUID cho phép đổi mã nhân viên mà không đụng dữ liệu con, và khóa hẹp hơn 24 byte. Nhưng `hrm_nhan_vien.ma_nv` **đang là khóa chính** (`schema.prisma:856`) và mọi feature HRM đi trước (`EmployeeSalary.ma_nv` `1278`, `hrm_hop_dong.ma_nv` `983`, `hrm_nguoi_phu_thuoc`, `hrm_tai_lieu`) đã dùng nó; đổi sang UUID là migration phá vỡ toàn phân hệ. `ma_nv` còn là mã người dùng đọc/nhập trực tiếp trên mọi màn hình lương và trong Excel — dùng nó làm khóa giúp mọi truy vấn/log/export tự đọc được. Rủi ro "đổi mã nhân viên" đã được `onUpdate: Cascade` xử lý ở các quan hệ hiện hữu.

**Consequences.** Nhất quán toàn HRM; tài liệu mẫu NestJS **không** là chuẩn cho `be_maxv`. Chi phí: khóa 24 byte lặp trên 9 bảng con — chấp nhận ở quy mô vài trăm nhân viên × 12 kỳ/năm.

---

### ADR-dltl-02: Chấm công theo mô hình *delta*, không sinh sẵn lịch công chuẩn

**Context.** BA nêu 🔴 #4: `createPayrollPeriod` không sinh lịch công chuẩn từ `GeneralSetting`/`Holiday`.

**Decision.** **Giữ mô hình delta** — không sinh `AttendanceRecord` khi tạo kỳ. Thay vào đó làm cho *giá trị mặc định ngầm* trở nên cấu hình được (gộp vào ADR-dltl-04).

**Alternatives.** (a) Sinh 26×N dòng/kỳ lúc `create`. (b) Sinh lười lúc mở màn Chấm công. (c) Giữ delta, sửa mặc định.

**Trade-offs.** Sinh sẵn cho phép truy vấn lịch trực tiếp từ DB và audit rõ "hệ thống đã giả định gì". Nhưng nó materialize cái mặc định: với 300 nhân viên × 26 ngày × 12 kỳ = 93 600 dòng/năm phần lớn là giá trị mặc định lặp lại; và khi đổi cấu hình ngày công thì dữ liệu đã sinh **đứng im**, tạo đúng lớp nợ đồng bộ mà chú thích trong `schema.prisma:874-887` đã cảnh báo cho hợp đồng. Delta giữ ngữ nghĩa "chỉ ghi cái khác chuẩn" — đúng với hành vi người dùng thật (kế toán chỉ sửa vài ngày/tháng).

**Consequences.** Không viết code sinh bản ghi. `getAttendanceMatrix` đã trả `settings` + `holidays` cho FE vẽ lịch (`payrollInputs.service.ts:86-105`) — giữ nguyên. Nợ phải trả: engine phải suy `standardWorkDays` từ cấu hình + lịch lễ, không được hằng 26. Hạ mức phát hiện #4 từ 🔴 xuống 🟠, gộp vào ADR-dltl-04.

---

### ADR-dltl-03: Snapshot đơn giá tại thời điểm ghi nhận — và phải làm nốt 2 chỗ còn thiếu

**Context.** 5 nguồn đơn giá/tỷ lệ nuôi bảng lương. 3 được snapshot, 2 đọc động (A-09).

**Decision.** Snapshot là quy tắc bắt buộc của module. Bổ sung `penaltyRate` vào `DiligenceRecord` và `direction` vào `SalaryAdjustmentRecord`.

**Alternatives.** (a) Đọc động toàn bộ, dựa `PayrollSheetLine` làm lớp bất biến duy nhất. (b) Snapshot toàn bộ.

**Trade-offs.** Đọc động gọn schema và sửa danh mục là "sửa được cho mọi kỳ chưa chốt" — nghe tiện nhưng thực tế nguy hiểm: đổi `direction` từ `tru` sang `bu` **đảo dấu tiền** trên mọi bản ghi cũ ở mọi kỳ `DRAFT`, im lặng. Snapshot tốn 2 cột nhưng làm cho mỗi dòng tự giải thích được và tương thích với 3 bảng còn lại.

**Consequences.** Cần migration thêm 2 cột + backfill từ danh mục hiện tại. Sau đó `calculatePayrollPreview` bỏ được 2 `include` (`:73-74`) ⇒ preview nhẹ hơn. Nếu **không** làm, phải ghi rõ trong SRS rằng đây là chủ đích và cảnh báo người dùng khi sửa danh mục.

---

### ADR-dltl-04: Hardcode tham số tính lương là **nợ kỹ thuật**, không phải quyết định — phải trả

**Context.** OQ-dltl-001, OQ-dltl-002 hỏi: hardcode 26 ngày / tỷ lệ bảo hiểm / đoàn phí / biểu thuế TNCN là cố ý hay thiếu sót?

**Decision.** **Là nợ kỹ thuật, phải trả.** Không chấp nhận hardcode như thiết kế.

**Alternatives.** (a) Giữ hardcode có chủ đích, lý do "luật do nhà nước quy định, tenant không nên sửa". (b) Đọc toàn bộ từ `GeneralSetting`.

**Trade-offs.** Phương án (a) nghe hợp lý cho biểu thuế TNCN, nhưng **mâu thuẫn trực tiếp với schema đã có**: 15 trường cấu hình (`schema.prisma:1106`, `1109`, `1118-1134`) và một màn hình "Cấu hình mặc định" hoàn chỉnh đã tồn tại, có route `PUT /settings/general` được bảo vệ bằng `assertAdminOrOwner`. Để chúng tồn tại mà không có tác dụng là **lừa người dùng**: sửa cấu hình, bấm lưu, thấy thành công, nhưng bảng lương không đổi một đồng. Đó là lớp lỗi tệ nhất — sai lặng lẽ. Thêm nữa `standardWorkingDaysMethod` có sẵn 3 lựa chọn `FIXED_26`/`FIXED_24`/`ACTUAL_MONTH` (`1079-1083`), tức nghiệp vụ **đã** khẳng định 26 không phải hằng số.

**Consequences.** Chi phí: ~150 LOC + 1 helper `loadPayrollConfig(db, period)` trả về object cấu hình đã giải, tiêm vào engine. Chi phí thật nằm ở `taxBrackets Json @db.JsonB` (`1134`) — hiện **chưa có hình dạng**; phải chốt schema JSON (đề xuất `[{ upTo: number|null, rate: number }]`), viết Zod validator, seed dữ liệu mặc định 7 bậc, và giữ `tinhThueLuyTien()` hiện tại làm fallback khi `taxBrackets` rỗng/sai (không được để lỗi cấu hình làm chết cả kỳ lương). Sửa xong thì AC-dltl-05, AC-dltl-06, AC-dltl-07 mới đạt được, và phát hiện #4 của BA cũng tự hết.

---

### ADR-dltl-05: Tách đôi việc sửa Reopen — role-guard làm ngay, audit log chờ quyết định

**Context.** BR-dltl-002 công bố 3 tiêu chí; chỉ 1 (lý do ≥20 ký tự) có thật. OQ-dltl-003, OQ-dltl-004 còn mở.

**Decision.** Tách thành 2 hạng mục độc lập, **không chờ nhau**:
1. **Ngay lập tức** — gắn `assertAdminOrOwner` cho `reopen`, `lock`, `approve`. Dùng lại nguyên hàm đã có tại `be_maxv/src/routes/hrm/cau_hinh_mac_dinh/generalSettings.route.ts:10-16` (trả lời luôn OQ-dltl-004: "ADMIN" ánh xạ sang `ADMIN` **hoặc** `OWNER`, đúng tiền lệ Cấu hình mặc định — `OWNER_EMPLOYEE` bị chặn 403).
2. **Chờ quyết định (OQ-dltl-003)** — bảng audit log: phạm vi payroll-riêng hay audit chung toàn HRM.

**Alternatives.** Làm cả gói cùng lúc (chờ ADR audit) — bị bác vì để một lỗ hổng quyền hạn 3 dòng nằm chờ một quyết định hàng tuần là sai thứ tự ưu tiên.

**Trade-offs.** Sửa nửa vời khiến BR-dltl-002 vẫn ❌ trên giấy sau đợt 1. Đổi lại, rủi ro thật (bất kỳ nhân viên nào cũng mở khóa được sổ lương đã chốt) biến mất trong ngày. Về audit: hiện `reason` bị **thu thập rồi vứt** — trước khi có bảng audit, phương án tạm rẻ nhất là thêm 3 cột vào chính `PayrollPeriod` (`reopenedByUserId`, `reopenedAt`, `reopenReason`) — không giữ được lịch sử nhiều lần reopen nhưng đủ cho lần gần nhất, và không cần thiết kế bảng audit chung.

**Consequences.** Sau bước 1: NFR-dltl-004 đạt, AC-dltl-03 đạt. NFR-dltl-003 + AC-dltl-04 vẫn hở tới khi chốt OQ-dltl-003. Cần cập nhật SRS Mục 2 (bảng Actors) và Mục 5 khi bước 1 xong.

---

## 10. Bàn giao

- **Tester-QA (Phase A)**: ưu tiên viết test cho A-01 (rò rỉ lương), A-02 (chọn sai hợp đồng), A-03 (nghỉ không lương vẫn trả đủ) — 3 lỗi này **sai số tiền hoặc lộ dữ liệu**, nặng hơn phần lớn mục trong Error Matrix. Kèm A-06 (kiểu response đổi sau khóa sổ) vì nó quyết định cách QA assert. Lưu ý 2 cải chính để không viết test sai kỳ vọng: `targetValue` **đã** chặn chia-0 ở validator; 6 `otRate*` **đã** đọc đúng từ `GeneralSetting`.
- **Business Analyst (Final Sign-off)**: cần chốt OQ-dltl-002 (đã có đề xuất tại ADR-dltl-04), OQ-dltl-003 + OQ-dltl-004 (ADR-dltl-05), OQ-dltl-006 (ADR-dltl-02 không đụng tới, vẫn mở); và sửa 2 chỗ trong SRS: Mục 6.2 ("sửa tên/ngày kỳ" → chỉ tên, A-13) và Mục 11 dòng kết luận tích cực ("dialog Tái sử dụng 6/8 đã nối API thật" → chưa, đang lai).
- **Hợp đồng API**: `docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md`.

---

## 11. Mở rộng mô hình dữ liệu cho **Bảng lương tổng hợp** (Architect, 2026-09-10)

> **Nguồn yêu cầu:** `srs-du-lieu-tinh-luong.md` Mục 15 (BA, 2026-09-10) — `BR-dltl-024…027` + gap API. **Hai quyết định nghiệp vụ đã được chủ dự án chốt** và là dữ kiện cố định của thiết kế này, Architect KHÔNG được đổi:
> 1. **Nguồn cột "Lương" (chốt `OQ-dltl-011`)** — mô hình **hai tầng cộng nhau**: `hrm_hop_dong.luong_chinh` / `luong_bhxh` **giữ nguyên vai trò**, **CỘNG THÊM** tổng các khoản phụ cấp cố định trong "Cài đặt lương" (`EmployeeSalary.items` → `SalaryItem`) của chính nhân viên đó. KHÔNG chọn một trong hai như SRS Mục 15.4 đặt vấn đề.
> 2. **Biểu thuế TNCN giữ nguyên 7 bậc hiện hành** (giảm trừ 11tr bản thân / 4,4tr người phụ thuộc). KHÔNG áp bộ số liệu 2026 mà `docs/nestjs/payroll` nhắc tới.
>
> Toàn bộ thay đổi dưới đây nằm ở **`be_maxv/prisma/tenant/schema.prisma`** (schema tenant `db_<MST>`). **KHÔNG** có thay đổi nào ở `prisma/sys/schema.prisma`.

### 11.1. Tổng quan thay đổi

| # | Bảng / Enum | Loại thay đổi | Phục vụ |
|:--:|---|---|---|
| M-01 | `GeneralSetting` (`hrm_general_settings`) | **+3 cột** | `BR-dltl-026` (ngưỡng + thuế suất khấu trừ 10%), `BR-dltl-027` (trần ăn ca 730k) |
| M-02 | `SalaryItem` (`hrm_salary_items`) | **+1 cột** `isMealAllowance` | `BR-dltl-027` — nhận diện khoản ăn ca **bằng dữ liệu**, không dò chuỗi tiếng Việt |
| M-03 | *(không thêm enum, không thêm cột cho 2 trần bảo hiểm)* | Hệ số `× 20` là **hằng số có căn cứ luật**, gốc `baseSalary`/`regionMinSalary` đã có sẵn | `BR-dltl-024` — đúng nhận định của BA (SRS 15.3): "không cần field DB mới, chỉ cần tách logic" |
| M-04 | `PayrollSheetLine` (`hrm_payroll_sheet_lines`) | **+15 cột** | Đóng băng đủ căn cứ giải trình thuế + các field UI mới |
| M-05 | — | **Không đổi**: `hrm_hop_dong`, `OvertimeRecord`, `EmployeeSalary(Item)`, `SalaryStructureItem` | Dữ liệu cần đã có sẵn |

> **Tên trường bám đúng SRS Mục 15.3.1** (BA chốt cùng ngày, QA đã viết 44 ca kiểm theo tên đó): `contractBaseSalary` · `fixedAllowanceTotal` · `otTaxExemptAmount` · `withholdingTaxApplied` · `lunchAllowanceTaxableAmount` · `insuranceCapAppliedBhxhByt` · `insuranceCapAppliedBhtn` · `isMealAllowance`. Architect **không** đặt tên khác cho cùng một khái niệm — đổi tên ở tầng này là buộc QA viết lại bộ ca kiểm mà không được gì. Trường duy nhất **không** có trong SRS 15.3.1 là `otherAllowanceTaxExemptAmount` — sinh ra sau khi chủ dự án chốt `Q-1` (xem 11.3.1), và là **thêm mới** chứ không phải đổi tên trường nào đang có.

> **Cập nhật 2026-09-10 (sau khi chủ dự án chốt `Q-1`):** ô tick "chịu thuế TNCN" ở màn "Khoản lương" nay **có hiệu lực thật** với bảng lương. Thay đổi ở tầng dữ liệu chỉ gồm **1 cột snapshot mới** `otherAllowanceTaxExemptAmount` (Mục 11.4) — **không** thêm cột cấu hình, **không** thêm enum, vì hai cột nguồn (`SalaryItem.isTaxable`, `SalaryStructureItem.taxTreatment`) **đã tồn tại và đã có giao diện nhập**. Quy tắc đọc hai cột đó: Mục 11.3.1.

**Không thêm bảng mới.** Endpoint `GET /payroll/support-allowances` (tab "Lương hỗ trợ") là **truy vấn đọc thuần** trên `EmployeeSalaryItem` + `SalaryItem` + `SalaryStructureItem` đã có — không cần bảng lưu riêng.

### 11.2. M-01 — `GeneralSetting`: 3 cột mới (KHÔNG phải 5)

```prisma
model GeneralSetting {
  // … 29 cột hiện có, KHÔNG đổi …

  /// BR-dltl-027 — Trần miễn thuế TNCN của phụ cấp ăn ca/ăn trưa mỗi tháng (TT 26/2016:
  /// 730.000đ). Phần vượt trần tính vào thu nhập chịu thuế. Trần này được QUY ĐỔI THEO CÔNG
  /// khi tính (AC-dltl-23) — cột lưu mức tháng đầy đủ.
  lunchAllowanceTaxFreeCap Decimal @default(730000)  @db.Decimal(15, 2)

  /// BR-dltl-026 — Thuế suất khấu trừ tại nguồn cho HĐ thử việc/thời vụ (Điều 25 TT 111/2013:
  /// 10%). Đơn vị PHẦN TRĂM (10.00 = 10%) — cùng quy ước với insurance*/unionFee*.
  withholdingTaxRate       Decimal @default(10.0)    @db.Decimal(5, 2)

  /// BR-dltl-026 — Ngưỡng thu nhập mỗi lần trả bắt đầu phải khấu trừ 10% (2.000.000đ).
  withholdingTaxThreshold  Decimal @default(2000000) @db.Decimal(15, 2)
}
```

**Vì sao 3 số này thành cột DB, còn hệ số trần bảo hiểm `× 20` thì không.** Ranh giới đã có sẵn trong chính bảng này và ADR-dltl-04 ("hardcode tham số tính lương là nợ kỹ thuật"):

| Loại tham số | Cách làm | Ví dụ đang chạy |
|---|---|---|
| **Số tiền / thuế suất luật định mà kế toán có thể phải chỉnh** | Cột `GeneralSetting` | `personalDeduction`, `dependentDeduction`, `baseSalary`, `regionMinSalary`, `unionFeeMaxAmount`, 6 tỷ lệ bảo hiểm ⇒ **3 cột mới đi cùng nhóm này** |
| **Quy tắc cấu tạo công thức** (hệ số nhân, thứ tự bước) | Hằng số trong mã, có trích dẫn căn cứ | Hệ số `× 20` của hai trần bảo hiểm |

Cụ thể với hai trần: gốc tính (`baseSalary` 2,34tr / `regionMinSalary` 4,96tr) **đã là cột cấu hình**, nên nghị định đổi lương cơ sở là trần tự đúng theo. Bản thân con số `20` nằm trong Luật BHXH và Luật Việc làm, không phải thứ từng công ty tự đặt. Thêm cột cho nó chỉ tạo thêm một đường để cấu hình sai mà không mua thêm khả năng nào — đúng nhận định của BA ở SRS Mục 15.3 ("không cần field DB mới, chỉ cần tách logic").

```ts
// be_maxv/src/constants/hrm/du_lieu_tinh_luong/insuranceCaps.ts (mới)
/** Trần đóng BHXH + BHYT = 20 lần lương cơ sở — Luật BHXH 2014 Điều 89 Khoản 3. */
export const SO_LAN_LUONG_CO_SO_TRAN_BHXH_BHYT = 20;
/** Trần đóng BHTN = 20 lần lương tối thiểu vùng — Luật Việc làm 2013 Điều 58 Khoản 2. */
export const SO_LAN_LUONG_TOI_THIEU_VUNG_TRAN_BHTN = 20;
```

**Cấm lưu số tiền trần tuyệt đối** (46.800.000 / 99.200.000) vào cấu hình: sửa `baseSalary` mà quên sửa trần là sai âm thầm — đúng bệnh mà `unionFeeMaxAmount = 234.000` (10% × 2,34tr) đang mắc.

> 🟠 **Nợ kỹ thuật ghi nhận, KHÔNG sửa trong đợt này:** `unionFeeMaxAmount` là số tuyệt đối phái sinh từ `baseSalary`. Không đụng vì đang chạy đúng và nằm ngoài 4 BR của đợt này.

**Ràng buộc thẩm định (validator `PUT /settings/general`)** — xem hợp đồng API Mục 8.4:

| Cột | Ràng buộc | Mã lỗi |
|---|---|---|
| `lunchAllowanceTaxFreeCap` | `>= 0` | `E-hrm-083` (mới) |
| `withholdingTaxRate` | `0 … 100` | `E-hrm-083` (mới) |
| `withholdingTaxThreshold` | `>= 0` | `E-hrm-083` (mới) |

`POST /settings/general/restore-default` **phải đặt lại đủ 3 cột này** về mặc định pháp luật VN (730.000 / 10.00 / 2.000.000). Bỏ sót là khôi phục nửa vời — đúng bẫy đã gặp ở đợt biểu thuế 7 bậc.

### 11.3. M-02 — nhận diện phụ cấp ăn ca **bằng dữ liệu**, không dò tên tiếng Việt

`SalaryItem` hiện chỉ có `category` (7 nhóm) và `isTaxable` (bool) — **không có** cách nào phân biệt "Phụ cấp tiền cơm" với "Phụ cấp điện thoại": cả hai đều là `BENEFIT_ALLOWANCE`, `isTaxable = false`. Trần 730k chỉ áp cho khoản ăn ca, nên phải có chỗ đánh dấu.

**Chọn phương án (a) của BA** (SRS Mục 15.3.1, `BR-dltl-027`): thêm **một cờ boolean**, đứng cạnh hai cờ cùng loại đã có (`isSocialInsurance`, `isTaxable`). Bác phương án (b) "quy ước theo `code` cố định" — mã khoản do kế toán tự đặt, đổi mã là vỡ thầm lặng.

```prisma
model SalaryItem {
  // … 11 cột hiện có, KHÔNG đổi …

  /// BR-dltl-027 — Khoản này là phụ cấp ăn ca/ăn trưa: miễn thuế TNCN tới
  /// GeneralSetting.lunchAllowanceTaxFreeCap (730.000đ/tháng, quy đổi theo công), phần vượt
  /// tính vào thu nhập chịu thuế. Kế toán tự đánh dấu — hệ thống KHÔNG đoán theo tên khoản.
  isMealAllowance Boolean @default(false)
}
```

> Cân nhắc và **bác** phương án enum `TaxExemptionRule { NONE, MEAL_ALLOWANCE }`: mở rộng hơn (đồng phục 5tr/năm, điện thoại theo quy chế…) nhưng hiện chỉ có **đúng một** quy tắc trần cần mã hóa, và enum đứng lệch khỏi lối đã có của chính bảng này (hai cờ boolean). Khi nào luật thêm quy tắc trần thứ hai thì đổi sang enum — lúc đó việc di trú là `isMealAllowance = true → MEAL_ALLOWANCE`, cơ học và an toàn.

**Bắt buộc — cấm dò chuỗi tên khoản.** Không được viết `name.includes('ăn')` / `'cơm'` / `'trưa'`. Lý do đã có tiền lệ hỏng trong chính repo (`docs/nestjs/payroll`): tên khoản là chữ tự do, có dấu/không dấu, viết hoa/thường, mỗi công ty một cách gọi ("Tiền cơm ca", "PC ăn trưa", "Hỗ trợ bữa ăn") — dò chuỗi vừa sót vừa dính nhầm, và **sai lặng lẽ** đúng chỗ tiền thuế.

**Ai đánh dấu:** kế toán, ở màn "Cài đặt lương › Khoản lương" (một ô chọn thêm). Nhiều khoản cùng đánh `isMealAllowance = true` là **hợp lệ** — trần áp trên **tổng** các khoản đó của một nhân viên trong một kỳ, không áp từng khoản.

**Dữ liệu cũ:** mọi bản ghi hiện có nhận `false` ⇒ hành vi **không đổi** cho tới khi kế toán chủ động đánh dấu. Đây là chủ đích: không đoán hộ khách khoản nào là tiền cơm.

### 11.3.1. Đọc hai cột miễn thuế **đã có sẵn** — không thêm cột nguồn nào

> **Chủ dự án chốt `Q-1` ngày 2026-09-10**: phụ cấp khai miễn thuế phải **thực sự** được trừ khỏi thu nhập tính thuế. Quyết định kiến trúc đầy đủ ở `ADR-010` **QĐ-9**; mục này chỉ nói phần **dữ liệu**.

**Hai cột nguồn, cả hai đều đã tồn tại và đã có ô nhập trên giao diện — Backend chỉ việc ĐỌC:**

| Cột | Vị trí schema | Đường ra giao diện | Mặc định |
|---|---|---|---|
| `SalaryItem.isTaxable` | `schema.prisma:1224` `Boolean @default(true)` | `salaryItems.service.ts:32` → `chiu_thue_tncn` (màn **Khoản lương**) | `true` |
| `SalaryStructureItem.taxTreatment` | `schema.prisma:1261` `TaxTreatment @default(TAXABLE)` | `salaryStructures.service.ts:37` → `phan_loai: 'tncn' \| 'mien_thue'` (màn **Cấu trúc lương**) | `TAXABLE` |

**Quy tắc hợp nhất (chốt `Q-2` — phép OR, xem ADR-010 QĐ-9.2):**

```ts
const laKhoanMienThue =
  structureItem?.taxTreatment === 'EXEMPT' || salaryItem.isTaxable === false;
```

Bất đối xứng có chủ đích: `EXEMPT` / `isTaxable = false` là **khai báo có chủ đích** của kế toán, còn `TAXABLE` / `true` **có thể chỉ là giá trị `@default` chưa ai đụng tới** (validator `salaryStructures.validator.ts:17` cũng `.default('TAXABLE')`). Cho giá trị mặc định quyền phủ quyết một khai báo có chủ đích là cách chắc chắn để ô tick tiếp tục vô hiệu — tức là chốt `Q-1` trên giấy mà không có tác dụng thật.

**Phạm vi đọc — giới hạn ở phụ cấp cố định:** chỉ áp cho `EmployeeSalaryItem` thuộc `FIXED_ALLOWANCE` / `BENEFIT_ALLOWANCE` (phần đi vào `allowanceInPeriodTotal`). `BonusRecord` và `CommissionRecord` **cũng** trỏ `SalaryItem` có `isTaxable`, nhưng engine **không** đọc cờ đó cho hai bảng này — thưởng và hoa hồng giữ nguyên là chịu thuế (lý do ở ADR-010 QĐ-9.1). Ghi rõ ở đây để người sau đọc schema không tưởng là engine bỏ sót.

> 🔴 **Ràng buộc dữ liệu quan trọng nhất của mục này — hai giỏ miễn thuế LOẠI TRỪ NHAU.** Khoản `isMealAllowance = true` **không bao giờ** được cộng vào `otherAllowanceTaxExemptAmount`, kể cả khi chính nó khai `isTaxable = false` (đây là **ca phổ biến**, không phải ca biên: `KL08` "Phụ cấp tiền cơm" trong dữ liệu mẫu của dự án đang để `chiu_thue_tncn: false`). Vi phạm ⇒ miễn thuế hai lần trên cùng một khoản tiền ⇒ khai thiếu thuế. Hai cột snapshot `mealAllowanceAmount` và `otherAllowanceTaxExemptAmount` phải thỏa bất biến: **tổng của chúng ≤ `allowanceInPeriodTotal`**, và giao của hai tập khoản là rỗng.

### 11.4. M-04 — `PayrollSheetLine`: 15 cột mới (BẮT BUỘC, không phải tùy chọn)

> 🔴 **Ràng buộc kỹ thuật cứng, Backend Engineer đọc kỹ.** `snapshotPayrollSheet()` (`payrollCalculation.service.ts:356-375`) đưa **nguyên object** của `calculatePayrollPreview()` vào `payrollSheetLine.createMany({ data: calculatedLines })`. Thêm bất kỳ field nào vào object trả về mà **không** thêm cột tương ứng ⇒ Prisma ném `Unknown argument` và **khóa sổ kỳ lương gãy hoàn toàn** — trong khi `GET /payroll/calculate` vẫn chạy bình thường, nên lỗi chỉ lộ ra lúc kế toán bấm "Khóa sổ". Hai chỗ này phải sửa **cùng một lượt**.

```prisma
model PayrollSheetLine {
  // … 29 cột hiện có, KHÔNG đổi …

  // ── Nguồn lương 2 tầng (QĐ nghiệp vụ 1 — SRS 15.4) ──
  contractBaseSalary         Decimal @default(0) @db.Decimal(18, 2) // luong_chinh của HĐ
  fixedAllowanceTotal        Decimal @default(0) @db.Decimal(18, 2) // Σ mức THÁNG phụ cấp cố định
  allowanceInPeriodTotal     Decimal @default(0) @db.Decimal(18, 2) // phụ cấp SAU quy đổi công
  // baseSalaryMonthly (đã có) = contractBaseSalary + fixedAllowanceTotal  → cột UI "Lương"

  // ── Tăng ca (BR-dltl-025) ──
  otRawHours                 Decimal @default(0) @db.Decimal(6, 2)  // giờ GỐC, chưa nhân hệ số
  otTaxExemptAmount          Decimal @default(0) @db.Decimal(18, 2) // phần vượt đơn giá giờ thường

  // ── Trần ăn ca (BR-dltl-027) ──
  mealAllowanceAmount        Decimal @default(0) @db.Decimal(18, 2) // Σ khoản isMealAllowance trong kỳ
  lunchAllowanceExemptAmount Decimal @default(0) @db.Decimal(18, 2) // phần được miễn (≤ trần đã quy đổi công)
  lunchAllowanceTaxableAmount Decimal @default(0) @db.Decimal(18, 2)// phần VƯỢT trần, phải chịu thuế

  // ── Miễn thuế theo khai báo (QĐ-9 — chủ dự án chốt Q-1 ngày 2026-09-10) ──
  /// Σ phụ cấp khai miễn thuế (isTaxable = false HOẶC taxTreatment = EXEMPT), số tiền TRONG KỲ.
  /// KHÔNG gồm khoản isMealAllowance — khoản đó nằm trọn ở mealAllowanceAmount và chịu trần riêng.
  /// Bất biến: mealAllowanceAmount + otherAllowanceTaxExemptAmount <= allowanceInPeriodTotal
  otherAllowanceTaxExemptAmount   Decimal @default(0) @db.Decimal(18, 2)

  // ── Hai trần bảo hiểm độc lập (BR-dltl-024) ──
  insuranceBaseBhxhByt       Decimal @default(0) @db.Decimal(18, 2) // gốc tính BHXH+BHYT (đã kẹp trần)
  insuranceBaseBhtn          Decimal @default(0) @db.Decimal(18, 2) // gốc tính BHTN (đã kẹp trần)
  insuranceCapAppliedBhxhByt Boolean @default(false)
  insuranceCapAppliedBhtn    Boolean @default(false)

  // ── Rẽ nhánh phương pháp thuế (BR-dltl-026) ──
  withholdingTaxApplied      Boolean @default(false)                // true = khấu trừ 10%, false = lũy tiến

  // ── Truy vết phiên bản công thức ──
  engineVersion              String  @default("v1") @db.VarChar(16)
}
```

> Đếm đúng **15 cột**: 11 `Decimal` + 3 `Boolean` + 1 `String`. Con số ở bảng 11.1 phải khớp khối này khi Backend hiện thực.
>
> **Không** thêm cột `taxableGrossIncome`: cột UI `thu_nhap_chiu_thue` suy được ngay tại Frontend bằng `grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount − otherAllowanceTaxExemptAmount` (mọi thành phần đều đã có trong response). Thêm một cột chỉ để chứa hiệu của bốn cột khác là tạo thêm một chỗ có thể lệch.
>
> **Không** đổi tên `lunchAllowanceTaxableAmount` thành `otherAllowanceTaxExemptAmount` — hai trường mang **nghĩa ngược nhau** (một bên là phần **vượt trần phải chịu thuế**, một bên là phần **được miễn**). Dùng lại tên cho nghĩa khác là cách chắc chắn nhất để Backend cộng nhầm dấu, và bắt QA viết lại `AC-dltl-21/23` mà không được gì (ADR-010 QĐ-9.4).

**Vì sao lưu cả cột "giải thích" chứ không chỉ số tiền cuối.** Bảng lương đã khóa là chứng từ giải trình với cơ quan thuế. Khi bị hỏi *"vì sao người này thuế 10% mà người kia lũy tiến"*, *"vì sao lương đóng bảo hiểm 60tr mà chỉ trừ trên 46,8tr"*, phải trả lời được **từ chính snapshot**, không phải tính lại bằng cấu hình hôm nay (cấu hình đã có thể đổi). Đó cũng là lý do thêm `engineVersion`: đề xuất cũ ở Mục 5.1 nay thành bắt buộc, vì công thức thay đổi thật trong đợt này — dòng khóa trước và sau đợt này **ra số khác nhau** và phải phân biệt được.

`insuranceCapAppliedBhxhByt` / `insuranceCapAppliedBhtn` / `withholdingTaxApplied` là **cờ dẫn xuất** (suy được từ các cột khác) — chấp nhận dư thừa có kiểm soát để bảng lương lọc/đánh dấu trên giao diện không phải tính lại.

### 11.5. Dữ liệu ĐÃ CÓ, không cần thêm cột

| Cần cho | Lấy từ | Ghi chú |
|---|---|---|
| Giờ OT gốc `otRawHours` | `OvertimeRecord.hours` | Đã lưu, engine chỉ đang bỏ qua (chỉ đọc `convertedHours`) |
| Loại hợp đồng để rẽ nhánh 10% | `hrm_hop_dong.loai_hd` (VarChar 24, **chữ tự do**) | Chuẩn hóa `trim().toLowerCase()` trước khi so — xem ADR-010 Mục "Rủi ro" |
| Công tắc tổng tính thuế | `hrm_hop_dong.tinh_tncn` | Kiểm **trước** mọi rẽ nhánh |
| Gốc đóng bảo hiểm | `hrm_hop_dong.luong_bhxh` + `trich_bhxh` | Giữ nguyên nghĩa |
| Mức từng khoản phụ cấp của nhân viên | `EmployeeSalaryItem.amount` (qua `EmployeeSalary` `status = APPROVED`) | Engine đang đọc nhưng chỉ lọc 2 nhóm `KPI_PERFORMANCE`/`ATTENDANCE_ALLOWANCE` |
| Khoản nào quy đổi theo công | `SalaryStructureItem.calculationMethod` | `ACTUAL_WORKDAYS`/`HOURLY` ⇒ quy đổi; còn lại giữ trọn tháng |
| Khoản nào vào gốc tính tăng ca | `SalaryStructureItem.isOvertimeBase` | Cột này **đang có mà chưa ai dùng** — đúng chỗ cần dùng |
| Khoản ăn ca (trần 730k) | `SalaryItem.isMealAllowance` (cột mới M-02) | Kế toán đánh dấu |
| Khoản nào miễn thuế **ngoài** ăn ca | `SalaryItem.isTaxable` **hoặc** `SalaryStructureItem.taxTreatment` | ✅ **ĐÃ CHỐT 2026-09-10** (chủ dự án chốt `Q-1`) — đọc **cả hai** cột theo phép **OR**, phạm vi chỉ phụ cấp cố định. Quy tắc đầy đủ ở Mục 11.3.1; quyết định kiến trúc ở ADR-010 QĐ-9 |

**Chọn `SalaryStructure` nào:** bản `isActive = true` **và** phủ kỳ (`effectiveFrom <= period.endDate` **và** (`effectiveTo` null **hoặc** `>= period.startDate`)), `orderBy effectiveFrom desc, take 1`. Khoản không có dòng trong cấu trúc đó ⇒ mặc định `MONTHLY_FIXED` + `isOvertimeBase = false` + miễn thuế xét **chỉ theo** `SalaryItem.isTaxable`. Cùng nguyên tắc "lọc theo kỳ" đã áp cho hợp đồng (A-02) — **không** dùng bản mới nhất bất kể kỳ.

### 11.6. Chỉ mục (index)

**Không thêm index mới.** Truy vấn của cả 2 endpoint là quét theo `periodId` hoặc quét toàn bảng master nhỏ:

| Truy vấn | Index dùng | Đánh giá |
|---|---|---|
| `employeeSalary.findMany({ where:{ status:'APPROVED' }, include:{ items:{ include:{ salaryItem } } } })` | `@@index([status])` | ✅ có sẵn |
| `salaryStructure.findMany({ where:{ isActive:true } })` + items | `@@index([isActive])`, `@@index([salaryStructureId])` | ✅ có sẵn |
| `salaryItem.findMany({ where:{ category:'BENEFIT_ALLOWANCE', status:'ACTIVE' } })` (cột động tab Lương hỗ trợ) | `@@index([category])`, `@@index([status])` | ✅ có sẵn |
| 8 bảng bản ghi kỳ | `@@index([periodId, ma_nv])` | ✅ có sẵn |

> 🟠 Giữ nguyên phát hiện Mục 5.1: `@@index([periodId])` của `hrm_payroll_sheet_lines` vẫn thừa. Không gộp việc bỏ nó vào đợt này (đụng migration của bảng đang thêm 11 cột — tách ra để nếu có sự cố còn biết do đâu).

### 11.7. Chiến lược di trú (migration)

Cơ chế tenant của dự án là **`prisma db push` cho từng DB công ty** qua `npm run sync:tenants` (`be_maxv/src/scripts/sync-tenants.ts:37`), **không** dùng `prisma migrate` như control plane.

| Bước | Việc | Rủi ro |
|:--:|---|---|
| 1 | Sửa `prisma/tenant/schema.prisma`: **+3 cột `GeneralSetting`, +1 cột `SalaryItem`, +15 cột `PayrollSheetLine`** (19 cột, **không** enum mới, **không** cột nguồn nào cho QĐ-9 — hai cột `isTaxable`/`taxTreatment` đã có sẵn) | — |
| 2 | `npm run generate` | — |
| 3 | `npm run sync:tenants` — áp cho **10/10 tenant** | ⚠️ script dùng `--accept-data-loss`; đợt này **thuần additive, mọi cột đều có `@default`** ⇒ không mất dữ liệu. **Phải kiểm lại diff trước khi chạy trên production**, không tin suông cờ đó |
| 4 | Rà soát: mọi tenant có đủ 3 cột mới trong `hrm_general_settings` với giá trị mặc định luật định | Theo khuôn `src/scripts/hrm/ra-soat-hrm.ts` đã có |
| 5 | **Không** cần backfill dữ liệu: `isMealAllowance = false` là hành vi cũ; snapshot cũ giữ nguyên, 15 cột mới = 0/false/"v1" | Snapshot kỳ đã khóa **không** được tính lại — xem dưới |
| 6 | ⚠️ **Rà soát dữ liệu tick miễn thuế TRƯỚC khi bật QĐ-9 trên production.** Chạy thống kê mỗi tenant: bao nhiêu `SalaryItem` đang `isTaxable = false`, bao nhiêu `SalaryStructureItem` đang `EXEMPT`, tổng tiền phụ cấp thuộc nhóm đó của kỳ gần nhất | Không phải rủi ro mất dữ liệu, mà là **rủi ro bất ngờ về số tiền**: đợt này làm ô tick có hiệu lực lần đầu, nên tenant nào lỡ tick sai từ trước sẽ thấy thuế TNCN giảm ngay. Phải biết trước con số để báo người dùng, đừng để kế toán phát hiện hộ |

**Tương thích ngược & rollback:**
- **Thêm cột có default ⇒ backward-compatible.** Bản backend cũ vẫn chạy được trên schema mới (không đọc cột mới). Rollback code không cần rollback DB.
- **Snapshot kỳ đã `LOCKED`+ TUYỆT ĐỐI không tính lại.** Kỳ đã chốt trả lương xong; tính lại theo công thức mới làm lệch số đã chi và số đã kê khai thuế. Dòng cũ mang `engineVersion = "v1"`, dòng khóa sau đợt này mang `"v2"`. Muốn áp công thức mới cho một kỳ cũ thì phải `reopen` → `lock` lại **có chủ đích, có người chịu trách nhiệm** — không tự động.
- **Ảnh hưởng chéo module `cai_dat_luong`:** `GET/POST/PATCH /salary-items` phải trả và nhận thêm `isMealAllowance`; `GET/PUT /settings/general` + `restore-default` phải trả và nhận thêm 3 cột. Xem hợp đồng API Mục 8.4. Không làm phần này thì cột thêm ra **không ai đặt được giá trị** — đúng bẫy `xemLuong` đã mắc ở ADR-007 ("chặn được nhưng không cấp được"). Riêng `isTaxable`/`taxTreatment` **không cần đụng gì** — CRUD của cả hai đã chạy đủ từ lâu (`salaryItems.service.ts:179`, `:215`; `salaryStructures.service.ts:121`, `:171`); đợt này chỉ là engine bắt đầu **đọc** chúng.

### 11.8. Ranh giới giao dịch & nhất quán

Không đổi so với Mục 8:

- `GET /payroll/calculate` và `GET /payroll/support-allowances` là **đọc thuần, không transaction**, chấp nhận read-committed. Hai endpoint gọi cách nhau vài giây có thể lệch nhau nếu ai đó vừa sửa "Cài đặt lương" — chấp nhận được vì đây là màn xem, và kỳ `DRAFT` vốn đang biến động.
- **`snapshotPayrollSheet` phải nằm trong transaction của `lockPayrollPeriod`** (đang đúng): `deleteMany` + `createMany` + chuyển trạng thái là một đơn vị. Thêm 11 cột không đổi ranh giới này, nhưng làm payload `createMany` nặng thêm ~25% ⇒ giữ nguyên khuyến nghị đặt `{ timeout }` cho transaction khi công ty > 300 nhân viên (A-05, chưa làm).
- **Không có yêu cầu nhất quán mạnh giữa preview và snapshot**: preview là ảnh chụp tức thời của dữ liệu đang sửa; snapshot là bản chốt. Chúng chỉ buộc phải bằng nhau **tại đúng thời điểm khóa sổ**, và điều đó được bảo đảm bằng việc `snapshot` gọi lại chính `calculatePayrollPreview` chứ không chép công thức lần hai.

### 11.9. Bàn giao Mục 11

- **Quyết định công thức & thứ tự tính**: `docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md`.
- **Hợp đồng API** (DTO đầy đủ, mã lỗi, endpoint mới): `api-contract-du-lieu-tinh-luong.md` Mục 8.
- **Tester-QA (Phase A — đã có 44 ca tại `test-matrix-bang-luong-tong-hop.md`)**: 4 vùng bổ sung so với bộ đã viết — (1) biên trần bảo hiểm (`luong_bhxh` = 46.799.999 / 46.800.000 / 46.800.001 / 99.200.001, kiểm **riêng** từng loại chứ không kiểm tổng — phủ `AC-dltl-12…14`); (2) OT miễn thuế nhiều loại hệ số cùng lúc (`AC-dltl-17`) và `otRawHours = 0`; (3) rẽ nhánh 10% đúng ngưỡng 2.000.000 và với `loai_hd` **viết hoa / có khoảng trắng thừa** (cột là chữ tự do); (4) trần ăn ca với **nhiều** khoản cùng đánh `isMealAllowance` và nhân viên nghỉ nửa tháng (`AC-dltl-21…23`). Thêm 1 ca hồi quy bắt buộc: **khóa sổ một kỳ có đủ dữ liệu 8 phân hệ** — bắt lỗi `createMany` nếu Backend quên cột.
- **Vùng thứ 5 — miễn thuế theo ô tick (Mục 11.3.1 + ADR-010 QĐ-9), QA ĐÃ VIẾT SẴN.** Tester-QA nhận quyết định `Q-1` song song và đã bổ sung **Nhóm 9** (`TC-blth-045…050`) vào `test-matrix-bang-luong-tong-hop.md`, dùng đúng tên trường `otherAllowanceTaxExemptAmount` và đúng quy tắc chống trừ trùng mà QĐ-9.3 chốt ⇒ **`GAP-QA-09` đóng, không phải sửa số liệu ca nào**, chỉ gỡ nhãn "CHƯA final". Ba ca **nên thêm** cho nhánh chưa phủ: (a) `taxTreatment = EXEMPT` nhưng `isTaxable = true` ⇒ **vẫn miễn** (phép OR, QĐ-9.2) · (b) `isMealAllowance = true` + `isTaxable = true` ⇒ **vẫn miễn tới trần** (QĐ-9.3) · (c) khoản `PERIODIC_BONUS` / `COMMISSION_PERCENTAGE` có `isTaxable = false` ⇒ **vẫn chịu thuế** (ranh giới phạm vi QĐ-9.1). Bộ 44 ca cũ **không phải sửa** — mặc định `isTaxable = true` cho ra đúng số cũ. Bất biến đáng thêm vào ca kiểm: `mealAllowanceAmount + otherAllowanceTaxExemptAmount ≤ allowanceInPeriodTotal`.

---

## 12. Chốt số từng bảng kê — `hrm_payroll_module_locks` (2026-09-11)

Nghiệp vụ: SRS Mục 16 (`BR-dltl-030…034`). Hợp đồng API: `api-contract-du-lieu-tinh-luong.md` Mục 9.

### 12.1. Thay đổi schema (tenant)

```prisma
enum PayrollModuleCode {
  ATTENDANCE  OVERTIME  KPI  BONUS  ADJUSTMENT  PIECEWORK  COMMISSION  DILIGENCE
  OTHER_INCOME  TAX_DEDUCTION  SALARY_PROFILE  SUPPORT_ALLOWANCE
}

model PayrollModuleLock {
  id             String            @id @default(uuid()) @db.VarChar(64)
  periodId       String            @db.VarChar(64)
  module         PayrollModuleCode
  lockedByUserId String            @db.VarChar(64)
  lockedAt       DateTime          @default(now())
  period PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  @@unique([periodId, module])
  @@map("hrm_payroll_module_locks")
}
// PayrollPeriod: thêm quan hệ ngược `moduleLocks PayrollModuleLock[]` (không thêm cột).
```

| Quyết định | Lý do |
|---|---|
| **Có dòng = đã chốt, không dòng = đang mở**; mở chốt là XÓA dòng | Trạng thái chỉ 2 giá trị, không cần cột `status`. Lịch sử ai chốt / mở chốt lúc nào đã có ở nhật ký hệ thống (`writeLog`) — không nhân đôi thành bảng lịch sử thứ hai (đúng hướng OQ-dltl-003) |
| `@@unique([periodId, module])` | Chặn 2 người chốt trùng ở tầng DB; lượt sau đụng `P2002` được đổi thành `E-dltl-028` (409) |
| `onDelete: Cascade` theo kỳ | Xóa kỳ Bản nháp thì khóa chốt đi theo, không mồ côi |
| Enum thay chuỗi tự do | Mã lạ không lọt vào DB; thêm bảng kê mới = thêm giá trị enum + `sync:tenants` |
| KHÔNG thêm cột "đã tính lương" vào `PayrollPeriod` | "Bảng lương a/b NV" đếm thẳng `PayrollSheetLine` của kỳ — nút "Tính lương" ghi đè các dòng này bằng CHÍNH `snapshotPayrollSheet` (cùng engine), khóa sổ lại chụp đè lần cuối |

### 12.2. Di trú

Chỉ thêm: `CREATE TYPE "PayrollModuleCode"` + `CREATE TABLE "hrm_payroll_module_locks"` + unique index + FK. Đã đo bằng `prisma migrate diff` trên 10/10 tenant local (2026-09-11): đúng 4 lệnh, **không có DROP** ⇒ `db push --accept-data-loss` an toàn cho bước này. Đã chạy `sync:tenants` (10/10) + `hrm:constraints` (10/10 đủ ràng buộc) trên môi trường dev/local. **Production chưa chạy** — cần xác nhận thời điểm, và phải chạy cùng lượt deploy mã (guard ghi `/payroll-data/*` tra bảng này).

### 12.3. Ranh giới giao dịch

- **Tính lương** (`calculatePayrollForPeriod`): chạy engine (`calculatePayrollPreview`, ~20 truy vấn) NGOÀI transaction; transaction chỉ còn pha ghi ngắn — `chuyenTrangThai` ghi có điều kiện lên dòng kỳ (`status ∈ KY_LUONG_CON_MO`) rồi `ghiDeBangLuong` (đường ghi duy nhất vào bảng, dùng chung với khóa sổ). Khóa dòng giữ tới commit nên khóa sổ chen giữa phải chờ; kỳ bị khóa sổ trong lúc tính → hụt điều kiện → 409 `E-dltl-026`, không đè bảng lương vừa chụp (sửa RVW-037: trước đây engine chạy trong transaction, giữ khóa dòng suốt lượt tính, dễ đụng timeout 5s mặc định).
- **Chốt / mở chốt**: kiểm trạng thái kỳ rồi ghi 1 dòng — không khóa dòng kỳ. Ràng buộc duy nhất lo tranh chấp chốt-với-chốt (`lock-all` dùng `createManyAndReturn` nên báo đúng dòng thực chèn); tranh chấp chốt-với-khóa-sổ còn khe hở mili-giây như guard có sẵn (RVW-039 phần (2) chưa làm).
- **Guard ghi 8 bảng kê** (`assertPayrollModuleWritable`): kiểm-rồi-ghi như `assertPayrollPeriodWritable` có từ trước (chấp nhận khe hở mili-giây giữa lượt kiểm và lượt ghi, cùng mức với guard khóa sổ hiện hành).

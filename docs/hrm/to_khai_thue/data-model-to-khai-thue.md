---
type: architecture-data-model
feature: hrm-to-khai-thue
status: in-review
updated: 2026-09-14
author: system-architect
links:
  - docs/hrm/to_khai_thue/srs-to-khai-thue.md
  - docs/hrm/to_khai_thue/api-contract-to-khai-thue.md
  - docs/hrm/du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md
  - docs/hrm/architecture/adr/ADR-012-bieu-thue-tncn-theo-moc-hieu-luc.md
  - docs/hrm/architecture/adr/ADR-013-bat-bien-so-thue-snapshot-hai-tang.md
---

# HR — Mô hình Dữ liệu: Thu nhập ngoài lương, Bảng tính thuế & Tờ khai TNCN (`to_khai_thue`)

Mô hình dữ liệu của sub-cụm `to_khai_thue` trong schema CSDL **Tenant** của `be_maxv`.

- **Phân vùng schema**: toàn bộ nằm ở `be_maxv/prisma/tenant/schema.prisma`. **KHÔNG** có bảng nào thuộc `prisma/sys/schema.prisma` — đây là dữ liệu nghiệp vụ của từng công ty. (Ngoại lệ đọc-chỉ: thông tin người nộp thuế trên tờ khai — MST/tên/địa chỉ công ty — nằm ở control-plane `maxv2_sys.don_vi`, xem Mục 9 điểm P-11.)
- **Cô lập đa tenant**: ở tầng **kết nối** (`resolveTenantDb(req)`), không ở tầng cột — kế thừa ADR-006. **Không** thêm cột `maSoThue`/`tenantId` vào bất kỳ bảng nào dưới đây (NFR-tkt-001).
- **Khóa ngoài nhân viên**: `ma_nv String @db.VarChar(24)` trỏ `hrm_nhan_vien.ma_nv` — đúng ADR-dltl-01, không dùng UUID.
- **Tài liệu này là thiết kế ĐI TRƯỚC code**, khác `data-model-du-lieu-tinh-luong.md` (kiểm định ngược). Chỗ nào bám vào mã nguồn đã có thì trích `file:line` thật.

---

## 0. Trạng thái xuất phát — schema đã có sẵn 2 bảng nháp (BẮT BUỘC đọc trước)

Khảo sát tại thời điểm thiết kế phát hiện **đã tồn tại code nháp chưa commit** cho chính 3 màn này, viết TRƯỚC khi có SRS:

| Hiện vật | Vị trí | Trạng thái |
|---|---|---|
| `enum TaxDeductionType`, `model OtherIncomeRecord`, `model hrm_to_khai_tncn05` | `prisma/tenant/schema.prisma:1810-1904` (99 dòng `git diff`, **chưa commit**) | Nháp theo **TT 80/2021** — khung pháp lý CŨ |
| 8 file BE | `src/{routes,controllers,services,validators}/**/to_khai_thue/` (2.020 dòng, **untracked**) | Nháp, đã đăng ký route tại `routes/hrm/hrm.route.ts:59` |
| FE types + 3 nhóm component | `hdđt_maxv/src/features/hrm/{types/toKhaiThue.ts, components/to_khai_thue/**}` | Nháp, chưa nối API thật |

**Hệ quả cho Backend Engineer:** đây **KHÔNG** phải "xây mới từ đầu" mà là **sửa một bộ nháp đang lệch luật**. 6 điểm lệch đã xác định:

| # | Lệch | Vị trí | Phải thành |
|---|---|---|---|
| L-1 | `incomeType String @db.VarChar(50)` — loại thu nhập là **chữ tự do**, không có danh mục | `schema.prisma:1838` | FK tới `hrm_other_income_categories` (BR-tkt-001, PA2 của brainstorm) |
| L-2 | Ngưỡng khấu trừ 10% ghi **2tr** trong comment enum | `schema.prisma:1817,1820` | 5tr — lưu trên danh mục (BR-tkt-008) |
| L-3 | `ky_loai` nhận cả `thang` lẫn `quy` | `schema.prisma:1871` | Chỉ `quy` (BR-tkt-016) |
| L-4 | `trang_thai` chỉ `nhap \| chot` | `schema.prisma:1875` | `READY_TO_EXPORT \| EXPORTED \| SUBMITTED` (Mục 6 SRS) |
| L-5 | Không có bảng/chỗ nào lưu **kết quả Bảng tính thuế tháng đã chốt** | — | `hrm_tax_calculation_lines` (Mục 3.4) |
| L-6 | `taxCalculation.service.ts:112-114` xếp `khoan` vào nhánh khấu trừ 10% | — | Theo BR-tkt-011: chỉ `{thu_viec, thoi_vu}` mới là `THOI_VU_THU_VIEC` — xem phản biện P-03 |

---

## 1. Biểu đồ Thực thể Liên kết (ERD)

```
  CẤU HÌNH PHÁP LUẬT THEO MỐC HIỆU LỰC (ADR-012 — mới, thay singleton)
  ┌────────────────────────────────────────┐
  │            hrm_tax_policies            │  1 dòng = 1 mốc hiệu lực
  │ id[PK] · effectiveFrom[UQ,Date]        │  personalDeduction · dependentDeduction
  │ taxBrackets[JsonB] · withholding*      │  voluntaryPensionCap · lunchAllowanceTaxFreeCap
  └───────────────────┬────────────────────┘
                      │ tra theo kỳ: effectiveFrom <= period.startDate, desc, limit 1
                      │ (KHÔNG có FK từ kỳ lương — quan hệ suy lúc đọc)
                      ▼
  ┌──────────────────────────────┐         ┌─────────────────────────────────┐
  │     hrm_payroll_periods      │ 1     N │  hrm_payroll_module_locks       │
  │  id[PK] · code[UQ] · status  ├─────────┤  UQ(periodId, module)           │
  │  month · year · start · end  │         │  module = TAX_SHEET  ← MỚI      │
  └───┬───────────┬──────────┬───┘         │  CÓ dòng = "Bảng tính thuế      │
      │ 1         │ 1        │ 1           │  tháng ĐÃ CHỐT" (ADR-013)       │
      │           │          │             └─────────────────────────────────┘
      │ N         │ N        │ N
┌─────▼─────────┐ │ ┌────────▼──────────────┐
│hrm_payroll_   │ │ │hrm_tax_calculation_   │  SNAPSHOT bất biến, CHỈ ghi lúc chốt
│sheet_lines    │ │ │lines           (MỚI)  │  UQ(periodId, recipientKey)
│(đã có, nguồn  │ │ │ 25 cột/người          │  taxPolicyId → truy vết biểu thuế đã dùng
│ lương chính)  │ │ └───────────────────────┘
└───────────────┘ │
                  │ N
      ┌───────────▼──────────────┐  N        1 ┌────────────────────────────────┐
      │ hrm_other_income_records │◄────────────┤ hrm_other_income_categories    │
      │ (ĐÃ CÓ — phải migrate)   │ Restrict    │ (MỚI) code[UQ] TN01..TN99      │
      │ + otherIncomeCategoryId  │             │ lower(name) UQ (raw SQL)       │
      │ + taxTreatmentGroup ⎫    │             │ taxTreatmentGroup [4 nhóm]     │
      │ + exemptAmount      ⎬snap│             │ exemptCap* · withholding*      │
      │ + taxableAmount     ⎭shot│             │ status ACTIVE/INACTIVE         │
      │ − incomeType (bỏ)        │             └────────────────────────────────┘
      └───────────┬──────────────┘
                  │ N          1
      ┌───────────▼──────────────┐
      │      hrm_nhan_vien       │  ma_nv NULLABLE — null = cá nhân vãng lai
      └──────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │ hrm_to_khai_tncn05  (ĐÃ CÓ — phải migrate)                   │
  │ PK(nam, ky_loai='quy', ky_so=1..4, so_lan=0)                 │
  │ ct / ct_may / ghi_de [JsonB] · trang_thai 3 giá trị mới       │
  │ KHÔNG có FK tới kỳ lương — nối bằng (nam, quý) → 3 tháng      │
  └──────────────────────────────────────────────────────────────┘
```

**Đọc ERD — 4 điểm quan trọng:**

1. **`hrm_tax_policies` không có FK đến ai cả.** Quan hệ "kỳ nào dùng biểu thuế nào" là quan hệ **suy lúc đọc** theo `effectiveFrom`, không phải khóa ngoại. Chỉ `hrm_tax_calculation_lines` mới ghim `taxPolicyId` — vì đó là snapshot cần giải trình về sau (ADR-012).
2. **Không có bảng "kỳ bảng tính thuế".** Trạng thái Nháp/Đã chốt là **sự có mặt của 1 dòng** trong `hrm_payroll_module_locks` với `module = TAX_SHEET` — đúng triết lý đã ghi sẵn tại `schema.prisma:1448-1449` ("CÓ dòng = đã chốt, mở chốt là xóa dòng").
3. **Tờ khai quý nối với kỳ lương bằng số học** (`quý q` = 3 tháng `3q-2 … 3q`), theo `A-tkt-04` — không cần bảng ánh xạ.
4. **`hrm_other_income_records.ma_nv` là `onDelete: SetNull`** (đã có sẵn, giữ nguyên): xóa nhân viên không làm mất bản ghi chi trả — đúng vì đây là chứng từ thuế đã phát sinh.

---

## 2. Kiểu Liệt kê (Enums)

### 2.1. Enum MỚI (4)

| Enum | Giá trị | Ghi chú kiến trúc |
|---|---|---|
| `OtherIncomeTaxGroup` | `EXEMPT_FULL` · `EXEMPT_CAPPED` · `TAXABLE_FULL` · `WITHHOLDING_FLAT` | BR-tkt-001. Dùng ở **cả 2 chỗ**: cột trên danh mục và cột **snapshot** trên bản ghi (ADR-013) |
| `ExemptCapPeriod` | `MONTHLY` · `YEARLY` | BR-tkt-002 (ăn ca 1,2tr/tháng · trang phục 5tr/năm) |
| `TaxLaborType` | `HOP_DONG_3_THANG_TRO_LEN` · `THOI_VU_THU_VIEC` · `VANG_LAI` | BR-tkt-011. Trùng **đúng từng ký tự** với `DongBangTinhThueDto.loai_lao_dong` ở FE (`types/toKhaiThue.ts:83`) — không cần lớp ánh xạ |
| `TaxMethod` | `LUY_TIEN` · `KHAU_TRU_10` · `KHAU_TRU_20` · `CAM_KET_08` · `DUOI_NGUONG` | Trùng đúng `DongBangTinhThueDto.phuong_phap_tinh` (`:99`). `KHAU_TRU_20` **khai báo nhưng ngoài phạm vi** (SRS Mục 2.2) — service không bao giờ sinh ra giá trị này ở đợt này |

### 2.2. Enum TÁI DÙNG (không tạo mới)

| Enum có sẵn | Dùng cho | Lý do KHÔNG tạo enum riêng |
|---|---|---|
| `CatalogStatus` (`ACTIVE`/`INACTIVE`, `schema.prisma:1385-1388`) | `OtherIncomeCategory.status` | Đúng 4 danh mục anh em (`KpiItem`, `PieceworkProduct`, `DiligenceViolationType`, `SalaryAdjustmentItem`) đều dùng enum này. Tạo `OtherIncomeCategoryStatus` là nhân bản y hệt |
| `TaxDeductionType` (`schema.prisma:1815-1821`, đã có trong nháp) | `OtherIncomeRecord.taxDeductionType` | Giữ nguyên 5 giá trị, **chỉ sửa comment** (ngưỡng 2tr → tra từ danh mục). FE đã dùng đúng 5 giá trị này (`types/toKhaiThue.ts:1-6`) |

### 2.3. Enum SỬA — `PayrollModuleCode` thêm đúng 1 giá trị

```prisma
enum PayrollModuleCode {
  ATTENDANCE
  OVERTIME
  KPI
  BONUS
  ADJUSTMENT
  PIECEWORK
  COMMISSION
  DILIGENCE
  OTHER_INCOME
  TAX_DEDUCTION
  SALARY_PROFILE
  SUPPORT_ALLOWANCE

  /// MỚI (ADR-013) — khóa "Bảng tính thuế tháng đã chốt" (BR-tkt-013).
  /// KHÔNG phải bảng kê thứ 13 của màn "Chốt kỳ lương": giá trị này CỐ Ý
  /// nằm NGOÀI `PAYROLL_MODULE_CODES` (`constants/hrm/payrollModules.ts:25`).
  TAX_SHEET
}
```

**Bắt buộc phải hiểu — 2 hàng rào có sẵn tự bảo vệ, KHÔNG được phá:**

| Hàng rào | Ở đâu | Vì sao quan trọng |
|---|---|---|
| `lockAllPayrollModules` chỉ lặp `PAYROLL_MODULE_CODES` | `payrollClosing.service.ts:145` | `TAX_SHEET` **không** nằm trong danh sách ⇒ nút "Chốt toàn kỳ" của màn Chốt kỳ lương **không** vô tình chốt Bảng tính thuế mà không ghi snapshot |
| `payrollModuleParamsSchema` = `z.enum(PAYROLL_MODULE_CODES)` | `payrollClosing.validator.ts:10` | `POST /payroll-periods/:id/modules/TAX_SHEET/lock` bị **Zod chặn 400** ⇒ không có đường khóa "chui" bỏ qua bước snapshot |

⚠️ **Backend Engineer KHÔNG được thêm `TAX_SHEET` vào `PAYROLL_MODULES`** (`constants/hrm/payrollModules.ts`). Thêm vào là phá cả 2 hàng rào cùng lúc và tạo ra trạng thái "đã khóa nhưng không có số liệu chốt" — không cách nào phát hiện bằng typecheck.

---

## 3. Chi tiết từng bảng

### 3.1. `hrm_tax_policies` — Chính sách thuế TNCN theo mốc hiệu lực `[MỚI]`

> Đóng `OQ-hrm-35` / `A-tkt-02` / `BR-tkt-017` / `NFR-tkt-004`. Quyết định đầy đủ + phương án loại bỏ: **ADR-012**.

```prisma
/// Chính sách thuế TNCN có hiệu lực theo mốc thời gian (ADR-012, BR-tkt-017, OQ-hrm-35).
///
/// NGUỒN SỰ THẬT DUY NHẤT cho mọi con số do PHÁP LUẬT quy định trong tính thuế TNCN.
/// Engine KHÔNG đọc `hrm_general_settings` cho các số này nữa (xem Mục 6 — lộ trình M-1…M-4).
///
/// Không có `effectiveTo`: dòng có `effectiveFrom` lớn hơn kế tiếp tự động thay thế dòng trước.
/// Mô hình này KHÔNG thể sinh khoảng trống (gap) hay chồng lấn (overlap) — hai lỗi mà cặp
/// from/to luôn phải kiểm bằng tay.
model TaxPolicy {
  id            String   @id @default(uuid()) @db.VarChar(64)

  /// Ngày bắt đầu hiệu lực. UNIQUE: một ngày chỉ có đúng một chính sách.
  effectiveFrom DateTime @unique @db.Date

  personalDeduction  Decimal @db.Decimal(15, 2)
  dependentDeduction Decimal @db.Decimal(15, 2)

  /// Cùng cấu trúc và cùng NGỮ NGHĨA `khoang` = ngưỡng trên lũy kế (BR-hrm-080).
  /// Ràng buộc toàn vẹn BR-hrm-082 áp NGUYÊN VẸN khi ghi vào đây (>=2 bậc, ngưỡng tăng
  /// nghiêm ngặt, thuế suất tăng nghiêm ngặt, bậc cuối là bậc mở).
  taxBrackets Json @db.JsonB

  /// BR-dltl-026 — khấu trừ tại nguồn trên CHÍNH LƯƠNG của HĐ thử việc/thời vụ.
  /// KHÁC `hrm_other_income_categories.withholdingThreshold` (BR-tkt-008, 5.000.000) —
  /// hai cơ chế độc lập, xem EC-tkt-06 và phản biện P-02. KHÔNG tự đồng bộ hai số này.
  withholdingTaxRate      Decimal @default(10.0)    @db.Decimal(5, 2)
  withholdingTaxThreshold Decimal @default(2000000) @db.Decimal(15, 2)

  /// BR-tkt-010 — trần giảm trừ bảo hiểm hưu trí tự nguyện mỗi tháng (NĐ 253/2026/NĐ-CP).
  voluntaryPensionMonthlyCap Decimal @default(3000000) @db.Decimal(15, 2)

  /// BR-dltl-027 — trần miễn thuế phụ cấp ăn ca ĐỊNH KỲ trong bảng lương.
  /// KHÁC trần ăn ca tiền mặt ngoài lương (danh mục `EXEMPT_CAPPED`, 1.200.000 — BR-tkt-002).
  lunchAllowanceTaxFreeCap Decimal @default(730000) @db.Decimal(15, 2)

  legalBasisNote String? @db.VarChar(500)

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  taxCalculationLines TaxCalculationLine[]

  @@map("hrm_tax_policies")
}
```

| Ràng buộc | Giá trị | Lý do |
|---|---|---|
| PK | `id` uuid | Đồng bộ mọi bảng HRM khác |
| UNIQUE | `effectiveFrom` | Chặn 2 chính sách cùng ngày hiệu lực ở tầng CSDL, không phụ thuộc service |
| Index | Không thêm — UNIQUE trên `effectiveFrom` đã phục vụ `WHERE effectiveFrom <= ? ORDER BY effectiveFrom DESC LIMIT 1` | Bảng ≤ 5 dòng/công ty trong nhiều năm |
| Nullable | Chỉ `legalBasisNote` | Mọi con số đều phải có giá trị — thiếu một số là tính sai thuế trong im lặng |
| Xóa | **Không có luồng xóa.** Sửa một dòng đã được `hrm_tax_calculation_lines` tham chiếu ⇒ chặn 409 | `onDelete: Restrict` từ `TaxCalculationLine.taxPolicyId` |

**Hàm tra cứu bắt buộc dùng chung (viết 1 lần, cấm chép lại):**

```ts
// src/services/client/hrm/to_khai_thue/taxPolicy.service.ts
export async function resolveTaxPolicy(db: PrismaClient, periodStartDate: Date) {
  const policy = await db.taxPolicy.findFirst({
    where: { effectiveFrom: { lte: periodStartDate } },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!policy) throw new AppError(500, 'E-tkt-015', '…'); // xem phản biện P-15
  return policy;
}
```

> Mốc so sánh là **`period.startDate`**, KHÔNG phải `paymentDate` của từng bản ghi: cả kỳ tháng phải dùng đúng một biểu thuế, nếu không thì hai bản ghi cùng tháng lại tính theo hai biểu khác nhau và `thu_nhap_tinh_thue` lũy tiến không còn ý nghĩa.

**Dữ liệu khởi tạo (seed) — 2 dòng, xem Mục 7.**

---

### 3.2. `hrm_other_income_categories` — Danh mục loại thu nhập ngoài lương `[MỚI]`

> SRS Mục 4.1 · BR-tkt-001…004 · FR-tkt-001…004

```prisma
model OtherIncomeCategory {
  id   String @id @default(uuid()) @db.VarChar(64)

  /// TN01..TN99 — tự sinh quét khe trống, cùng khuôn `KL01`/`CA01`/`KPI01` (ADR-001).
  code String @unique @db.VarChar(20)

  /// BR-tkt-003: duy nhất KHÔNG phân biệt hoa/thường. Ràng buộc thật là UNIQUE INDEX trên
  /// `lower(name)` — Prisma DSL không diễn tả được, nằm ở `hrmTenantConstraints.ts`
  /// (cùng cách đã làm cho `hrm_npt_mst_khong_trung_ky`). KHÔNG khai `@unique` ở đây.
  name String @db.VarChar(200)

  taxTreatmentGroup OtherIncomeTaxGroup

  /// Bắt buộc khi nhóm = EXEMPT_CAPPED (BR-tkt-003, E-tkt-003). NULL với 3 nhóm còn lại.
  exemptCapAmount Decimal?         @db.Decimal(15, 2)
  exemptCapPeriod ExemptCapPeriod?

  /// Bắt buộc khi nhóm = WITHHOLDING_FLAT. Mặc định nghiệp vụ 10.0 / 5.000.000 do SERVICE
  /// điền khi client bỏ trống (AC-tkt-002) — KHÔNG dùng `@default` của Prisma, vì `@default`
  /// sẽ điền cả cho 3 nhóm không dùng tới và làm mất ngữ nghĩa "NULL = không áp dụng".
  withholdingRate      Decimal? @db.Decimal(5, 2)
  withholdingThreshold Decimal? @db.Decimal(15, 2)

  legalBasisNote String?       @db.VarChar(500)
  status         CatalogStatus @default(ACTIVE)

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  records OtherIncomeRecord[]

  @@index([taxTreatmentGroup])
  @@index([status])
  @@map("hrm_other_income_categories")
}
```

| Chủ đề | Quyết định |
|---|---|
| **PK** | `id` uuid |
| **UNIQUE** | `code` (Prisma) · `lower(name)` (raw SQL, xem dưới) |
| **Index** | `taxTreatmentGroup` (FR-tkt-002 lọc theo nhóm) · `status` (lọc ACTIVE khi đổ dropdown) |
| **Nullable strategy** | 4 cột tham số thuế **nullable có chủ đích**: `NULL` = "nhóm này không dùng tham số đó". Không dùng `0` làm "không áp dụng" — `0` là một ngưỡng hợp lệ (khấu trừ từ đồng đầu tiên) |
| **Xóa** | Xóa cứng **chỉ khi** chưa có `OtherIncomeRecord` nào trỏ tới. FK `onDelete: Restrict` là hàng rào cuối; service kiểm trước để trả `E-tkt-002` có thông điệp nghiệp vụ thay vì lỗi CSDL thô (BR-tkt-004) |
| **Audit** | `createdAt`/`updatedAt`. Không thêm `createdByUserId` — danh mục là cấu hình, không phải chứng từ; đúng như 4 danh mục anh em |
| **`appliesToInternalOnly`** | **KHÔNG lưu cột** — suy lúc đọc `taxTreatmentGroup !== 'WITHHOLDING_FLAT'`, đúng chỉ dẫn SRS Mục 4.1 ("tránh 2 nguồn sự thật"). API trả ra như trường tính (Mục 2.1 api-contract) |

**Ràng buộc raw SQL (thêm vào `src/services/shared/hrmTenantConstraints.ts`, chạy qua `npm run hrm:constraints` sau mỗi `prisma db push`):**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS hrm_oic_ten_khong_trung
  ON hrm_other_income_categories (lower(btrim(name)));
```

> Chọn unique index biểu thức thay vì thêm cột `nameNormalized`: cột phái sinh là **nguồn sự thật thứ hai** — quên cập nhật một nhánh ghi là ràng buộc vô hiệu trong im lặng. Đây đúng bài học đã ghi tại `schema.prisma:962-975`.

---

### 3.3. `hrm_other_income_records` — Bản ghi thu nhập ngoài lương `[ĐÃ CÓ — MIGRATE]`

> SRS Mục 4.2 · BR-tkt-005…009 · A-tkt-09 → **ADR-013**

```prisma
model OtherIncomeRecord {
  id       String  @id @default(uuid()) @db.VarChar(64)
  periodId String  @db.VarChar(64)
  ma_nv    String? @db.VarChar(24) // NULL = cá nhân vãng lai ngoài công ty

  // ── MỚI: danh mục thay cho chuỗi tự do ──
  otherIncomeCategoryId String @db.VarChar(64)

  // ── Snapshot định danh người nhận (đã có, giữ nguyên) ──
  fullName     String  @db.VarChar(254)
  taxCode      String? @db.VarChar(20)
  idCardNumber String? @db.VarChar(20)
  address      String? @db.VarChar(500)
  phone        String? @db.VarChar(20)
  email        String? @db.VarChar(100)
  isResident   Boolean @default(true)

  paymentDate DateTime @db.Date
  paymentType String   @default("GROSS") @db.VarChar(10) // GROSS | NET

  // ── MỚI: snapshot KẾT QUẢ xử lý thuế (ADR-013 — snapshot kết quả, KHÔNG snapshot tham số) ──
  /// Nhóm xử lý thuế của danh mục TẠI THỜI ĐIỂM tạo/sửa bản ghi. Sửa danh mục về sau KHÔNG
  /// đổi ngược số của bản ghi cũ (cùng luật với `PieceworkRecord.unitPrice` — BR-dltl-014).
  taxTreatmentGroup OtherIncomeTaxGroup

  /// Phần MIỄN thuế của khoản này (nhóm EXEMPT_FULL: bằng grossAmount; EXEMPT_CAPPED: phần
  /// trong trần; hai nhóm còn lại: 0). KHÔNG cộng vào `thu_nhap_ngoai` của Bảng tính thuế.
  exemptAmount Decimal @default(0) @db.Decimal(18, 2)

  /// Phần PHẢI CỘNG LŨY TIẾN vào `thu_nhap_ngoai` của Bảng tính thuế tháng
  /// (TAXABLE_FULL: toàn bộ; EXEMPT_CAPPED: phần vượt trần; hai nhóm còn lại: 0).
  /// Bất biến: exemptAmount + taxableAmount == grossAmount khi nhóm != WITHHOLDING_FLAT.
  taxableAmount Decimal @default(0) @db.Decimal(18, 2)

  /// BR-tkt-008 nhánh "dưới ngưỡng nhưng cá nhân YÊU CẦU khấu trừ". [CHỜ BA — phản biện P-07]
  forceWithholding Boolean @default(false)

  // ── Số tiền & thuế (đã có, giữ nguyên) ──
  grossAmount      Decimal          @default(0) @db.Decimal(18, 2)
  netAmount        Decimal          @default(0) @db.Decimal(18, 2)
  taxDeductionType TaxDeductionType @default(FLAT_10)
  taxRate          Decimal          @default(0) @db.Decimal(5, 2)
  taxDeducted      Decimal          @default(0) @db.Decimal(18, 2)

  hasCommitment08      Boolean   @default(false)
  eWithholdingCertNo   String?   @db.VarChar(50)
  eWithholdingCertDate DateTime? @db.Date
  note                 String?   @db.VarChar(500)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @default(now()) @updatedAt
  createdByUserId String?  @db.VarChar(64)

  period    PayrollPeriod       @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien hrm_nhan_vien?      @relation(fields: [ma_nv], references: [ma_nv], onDelete: SetNull, onUpdate: Cascade)
  category  OtherIncomeCategory @relation(fields: [otherIncomeCategoryId], references: [id], onDelete: Restrict)

  @@index([periodId])
  @@index([periodId, ma_nv])
  @@index([otherIncomeCategoryId])
  @@index([taxCode])
  @@index([idCardNumber])
  @@index([paymentDate])
  @@map("hrm_other_income_records")
}
```

**Cột BỎ:** `incomeType String @db.VarChar(50)` — thay bằng FK danh mục (L-1). Bỏ **sau** khi đã chuyển dữ liệu, theo trình tự M-2 ở Mục 6.

**Chống trùng BR-tkt-006 / E-tkt-005 — phải là ràng buộc CSDL, không phải kiểm ở service:**

```sql
-- hrmTenantConstraints.ts — v2 (RVW-727, chủ dự án chốt 2026-09-15): khóa vãng lai ưu tiên CCCD > MST > họ tên
CREATE UNIQUE INDEX IF NOT EXISTS hrm_oir_chong_trung_v2
  ON hrm_other_income_records (
    "periodId",
    COALESCE(
      "ma_nv",
      'VL:' || lower(COALESCE(NULLIF(btrim("idCardNumber"), ''), NULLIF(btrim("taxCode"), ''), btrim("fullName")))
    ),
    "otherIncomeCategoryId",
    "paymentDate",
    "grossAmount"
  );
-- Gỡ bản v1 (khóa chỉ theo họ tên) CHỈ khi v2 đã tạo được — v2 vướng dữ liệu cũ thì tenant vẫn giữ v1.
DROP INDEX IF EXISTS hrm_oir_chong_trung;
```

> **Sửa đổi 2026-09-15 (RVW-727):** bản v1 khóa vãng lai chỉ theo `lower(btrim("fullName"))` nên hai cộng tác viên trùng tên, khác CCCD, cùng loại/ngày/số tiền thì người thứ hai bị từ chối 409 — không có cách nhập đúng. Khóa v2 là **cùng một luật** với `khoaNguoiNhan` (`otherIncomeRecord.service.ts`), nơi gộp dòng Bảng tính thuế và cộng trần miễn thuế: đổi một nơi phải đổi cả hai. Đánh đổi chủ dự án đã chấp nhận: cùng một người lần có lần không khai CCCD/MST sẽ thành hai khóa (hai dòng Bảng tính thuế, `[16]` đếm hai) — kế toán khai đủ giấy tờ để tránh.

| Điểm | Giải thích |
|---|---|
| Vì sao không dùng `@@unique` của Prisma | `ma_nv` nullable ⇒ Postgres coi mọi `NULL` là **khác nhau** ⇒ cá nhân vãng lai **không** bị chặn trùng. Đây đúng là ca EC-tkt-07 (double-click) mà quy tắc sinh ra để chặn |
| Vì sao không kiểm bằng `findFirst` trước `create` | Hai request song song cùng vượt qua bước kiểm rồi cùng ghi — kiểm ở tầng ứng dụng **không** chặn được đua. Double-click là kịch bản đua điển hình |
| Xử lý lỗi | Prisma ném `P2002` ⇒ service ánh xạ sang **409 `E-tkt-005`** |
| Giới hạn đã biết | Cùng số tiền nhưng `paymentType` khác nhau (`GROSS 6tr` vs `NET 6tr`) cho ra `grossAmount` khác nhau ⇒ **không** bị coi là trùng. Đúng chữ BR-tkt-006 ("trùng HOÀN TOÀN"), ghi ra đây để QA không coi là lỗi |

**Nullable strategy:** `ma_nv` NULL là **giá trị nghiệp vụ có nghĩa** (vãng lai), không phải "chưa có dữ liệu". `taxCode` NULL hợp lệ trừ khi `hasCommitment08 = true` (E-tkt-006) — ràng buộc điều kiện này nằm ở validator (Zod `superRefine`), không ở CSDL: Postgres `CHECK` biểu diễn được nhưng thông điệp lỗi không nghiệp vụ hóa được, và đây là quy tắc có thể đổi theo luật.

---

### 3.4. `hrm_tax_calculation_lines` — Dòng Bảng tính thuế tháng `[MỚI — chỉ ghi khi CHỐT]`

> SRS Mục 4.3 · BR-tkt-010…013 → **ADR-013**

```prisma
/// Bảng tính thuế TNCN tháng theo từng NGƯỜI — SNAPSHOT BẤT BIẾN, chỉ sinh khi kế toán CHỐT
/// (BR-tkt-013). Đúng khuôn `PayrollSheetLine` (`schema.prisma:1721-1724`):
///   - Tháng chưa chốt  -> KHÔNG có dòng nào ở đây, số liệu tính TRỰC TIẾP mỗi lần đọc.
///   - Tháng đã chốt    -> đọc thẳng bảng này, KHÔNG tính lại (số thuế là số pháp lý đã chốt).
/// Mở lại tháng = xóa dòng khóa `TAX_SHEET` + xóa sạch dòng của kỳ trong CÙNG một transaction.
model TaxCalculationLine {
  id       String  @id @default(uuid()) @db.VarChar(64)
  periodId String  @db.VarChar(64)
  ma_nv    String? @db.VarChar(24)

  /// Khóa định danh NGƯỜI trong kỳ: `ma_nv` với nhân viên nội bộ; cá nhân vãng lai là `'VL:'` + CCCD, không có
  /// thì MST, không có nữa mới dùng họ tên — chữ thường, bỏ khoảng trắng đầu cuối (ADR-013 sửa đổi 2026-09-15). Một vãng lai có NHIỀU bản ghi chi trả trong tháng (AC-tkt-008) nhưng
  /// chỉ được đếm MỘT lần ở chỉ tiêu [16] của tờ khai — nên dòng bảng tính thuế là THEO NGƯỜI,
  /// không theo bản ghi. Đây là lý do bỏ `otherIncomeRecordId` mà SRS Mục 4.3 đề xuất (ADR-013 QĐ-5).
  recipientKey String @db.VarChar(300)

  // ── Định danh snapshot ──
  ho_ten             String  @db.VarChar(254)
  mst_ca_nhan        String? @db.VarChar(20)
  so_cccd            String? @db.VarChar(20)
  loai_lao_dong      TaxLaborType
  cu_tru             Boolean @default(true)
  so_nguoi_phu_thuoc Int     @default(0)

  // ── Thu nhập ──
  thu_nhap_luong     Decimal @default(0) @db.Decimal(18, 2)
  /// Mọi thu nhập ngoài lương CHỊU THUẾ của người đó trong kỳ = Σ taxableAmount + Σ grossAmount
  /// của khoản WITHHOLDING_FLAT — khoản khấu trừ riêng NẰM TRONG cột này để lên chỉ tiêu [22]/[23].
  thu_nhap_ngoai     Decimal @default(0) @db.Decimal(18, 2)
  /// Phần của `thu_nhap_ngoai` đã khấu trừ riêng theo tỷ lệ cố định (Σ grossAmount khoản
  /// WITHHOLDING_FLAT) — KHÔNG vào nền lũy tiến. Quyết định "tách 2 phần", 2026-09-15.
  thu_nhap_khau_tru_rieng Decimal @default(0) @db.Decimal(18, 2)
  tong_thu_nhap      Decimal @default(0) @db.Decimal(18, 2)
  thu_nhap_mien_thue Decimal @default(0) @db.Decimal(18, 2)
  thu_nhap_chiu_thue Decimal @default(0) @db.Decimal(18, 2)

  // ── Giảm trừ (chỉ khác 0 ở nhánh LUY_TIEN) ──
  giam_tru_ban_than  Decimal @default(0) @db.Decimal(18, 2)
  giam_tru_phu_thuoc Decimal @default(0) @db.Decimal(18, 2)
  giam_tru_bao_hiem  Decimal @default(0) @db.Decimal(18, 2)
  tong_giam_tru      Decimal @default(0) @db.Decimal(18, 2)

  // ── Thuế ──
  thu_nhap_tinh_thue Decimal   @default(0) @db.Decimal(18, 2)
  phuong_phap_tinh   TaxMethod
  thue_luy_tien      Decimal   @default(0) @db.Decimal(18, 2)
  thue_toan_phan     Decimal   @default(0) @db.Decimal(18, 2)
  tong_thue_tncn     Decimal   @default(0) @db.Decimal(18, 2)
  thuc_nhan          Decimal   @default(0) @db.Decimal(18, 2)

  // ── Truy vết (NFR-tkt-003) ──
  /// Biểu thuế/giảm trừ ĐÃ DÙNG để ra con số trên. Thiếu cột này thì một năm sau không ai
  /// giải trình được vì sao thanh tra tính ra số khác (ADR-012).
  taxPolicyId    String @db.VarChar(64)
  /// "v1" gộp vãng lai theo họ tên; "v2" (2026-09-15) theo CCCD → MST → họ tên — ADR-013 sửa đổi, mục 4.
  engineVersion  String @default("v1") @db.VarChar(16)
  lockedByUserId String @db.VarChar(64)
  lockedAt       DateTime @default(now())
  createdAt      DateTime @default(now())

  period    PayrollPeriod  @relation(fields: [periodId], references: [id], onDelete: Cascade)
  nhan_vien hrm_nhan_vien? @relation(fields: [ma_nv], references: [ma_nv], onDelete: SetNull, onUpdate: Cascade)
  taxPolicy TaxPolicy      @relation(fields: [taxPolicyId], references: [id], onDelete: Restrict)

  @@unique([periodId, recipientKey])
  @@index([periodId])
  @@index([ma_nv])
  @@map("hrm_tax_calculation_lines")
}
```

**Khác biệt có chủ đích so với SRS Mục 4.3 (2 điểm — đã báo BA ở Mục 9):**

| SRS đề xuất | Thiết kế chốt | Lý do |
|---|---|---|
| `status` enum `DRAFT`/`LOCKED` | **Bỏ cột** | Bảng chỉ có dòng khi đã chốt ⇒ `status` luôn bằng `LOCKED`, là cột hằng số. Đúng triết lý đã ghi ở `PayrollModuleLock` (`schema.prisma:1448`) |
| `otherIncomeRecordId` FK nullable | **Thay bằng `recipientKey`** | 1 vãng lai có nhiều khoản/tháng (AC-tkt-008) ⇒ không ánh xạ 1-1 được; chỉ tiêu [16] đếm theo NGƯỜI |

**Bất biến số học (QA kiểm được từng dòng):**

```
tong_thu_nhap      == thu_nhap_luong + thu_nhap_ngoai
thu_nhap_chiu_thue == max(0, tong_thu_nhap - thu_nhap_mien_thue)
tong_giam_tru      == giam_tru_ban_than + giam_tru_phu_thuoc + giam_tru_bao_hiem
thu_nhap_khau_tru_rieng <= thu_nhap_ngoai
thu_nhap_tinh_thue == max(0, thu_nhap_chiu_thue - thu_nhap_khau_tru_rieng - tong_giam_tru)   [chỉ nhánh LUY_TIEN]
tong_thue_tncn     == thue_luy_tien + thue_toan_phan
phuong_phap_tinh != LUY_TIEN  =>  thue_luy_tien == 0 AND tong_giam_tru == 0 AND thu_nhap_tinh_thue == 0
loai_lao_dong == VANG_LAI     =>  ma_nv IS NULL AND thu_nhap_luong == 0
```

> **Sửa 2026-09-15 (quyết định "tách 2 phần" của chủ dự án):** thêm cột `thu_nhap_khau_tru_rieng`; nền lũy tiến trừ lại phần này. **Bỏ bất biến cũ `LUY_TIEN ⇒ thue_toan_phan == 0`** — nhân viên HĐLĐ có khoản khấu trừ riêng thì `thue_toan_phan` mang đúng số thuế đã khấu trừ đó (khớp Mục 5.2); để 0 thì tờ khai quý mất số thuế. Bộ bất biến này được kiểm tự động trên từng dòng ở `hrmTaxSheetRows.test.ts`.

---

### 3.5. `hrm_to_khai_tncn05` — Tờ khai quý `[ĐÃ CÓ — MIGRATE]`

> SRS Mục 4.4 · BR-tkt-014…018 · FR-tkt-013…018

```prisma
model hrm_to_khai_tncn05 {
  nam     Int
  /// BR-tkt-016 — CHỈ nhận 'quy'. Cột giữ lại (không bỏ) vì là một phần KHÓA CHÍNH; bỏ cột
  /// khóa chính là viết lại bảng. Validator chặn mọi giá trị khác ('thang' bị từ chối 400).
  ky_loai String @db.VarChar(8)
  ky_so   Int    // 1..4
  /// 0 = tờ khai chính thức. >0 dành cho khai bổ sung — NGOÀI PHẠM VI đợt này (EC-tkt-03),
  /// giữ cột để không phải đổi khóa chính khi làm khai bổ sung về sau.
  so_lan  Int    @default(0)

  /// READY_TO_EXPORT | EXPORTED | SUBMITTED (BR-tkt-014, BR-tkt-015).
  /// Dòng chỉ TỒN TẠI khi đã đủ 3 tháng chốt — chưa đủ thì KHÔNG có dòng nào.
  trang_thai String @default("READY_TO_EXPORT") @db.VarChar(16)

  ct     Json @db.JsonB   // finalIndicators — bộ đem nộp
  ct_may Json @db.JsonB   // calculatedIndicators — số máy tự tính
  ghi_de Json @db.JsonB   // overrides: { ct22: { gia: 480000000, lyDo: "…" } }

  // Cột bóc tách để danh sách kỳ khai không phải quét JSONB
  ct16 Int     @default(0)
  ct21 Decimal @default(0) @db.Decimal(18, 2)
  ct29 Decimal @default(0) @db.Decimal(18, 2)

  canh_bao Json?     @db.JsonB
  nguoi_ky String?   @db.VarChar(100)
  ngay_ky  DateTime? @db.Date
  tinh_luc DateTime?

  /// "Đã xuất tờ khai" (BR-tkt-015) — cũng chính là mốc KHÓA VĨNH VIỄN 3 tháng trong quý.
  khoa_so_boi String?   @db.VarChar(64)
  khoa_so_luc DateTime?

  /// MỚI — "Đã nộp" (FR-tkt-017, FR-tkt-018).
  nop_boi String?   @db.VarChar(64)
  nop_luc DateTime?

  datetime0 DateTime @default(now())
  datetime2 DateTime @updatedAt

  @@id([nam, ky_loai, ky_so, so_lan])
  @@index([nam, ky_loai])
  @@index([trang_thai])
  @@map("hrm_to_khai_tncn05")
}
```

| Chủ đề | Quyết định |
|---|---|
| **Tái dùng cột thay vì thêm mới** | `khoa_so_boi`/`khoa_so_luc` (đã có) = `exportedBy`/`exportedAt` của SRS. Chỉ thêm đúng 2 cột `nop_boi`/`nop_luc` |
| **Phong cách đặt tên** | Giữ **Vietnamese-snake** của bảng đã có + khớp `ToKhaiTncn05Dto` ở FE (`types/toKhaiThue.ts:149-164`). Đổi sang camelCase là viết lại cả bảng lẫn FE để đổi lấy đúng… thẩm mỹ |
| **`ghi_de` là JSONB, không phải bảng con** | Tối đa 13 chỉ tiêu gốc × 1 dòng/quý. Bảng con cho ≤13 dòng/quý là thêm join mà không thêm khả năng nào — JSONB đã đủ và FE đã đọc đúng hình dạng này |
| **Vì sao không có FK tới `hrm_payroll_periods`** | Tờ khai thuộc về **quý**, không thuộc một kỳ lương nào. Nối bằng số học `(nam, ky_so)` → 3 tháng (A-tkt-04) |

**Danh sách chỉ tiêu gốc được ghi đè (BR-tkt-018) — hằng số ở BE, không lưu CSDL:**

```ts
// src/constants/hrm/to_khai_thue/chiTieuTncn05.ts
export const CT_GOC_SUA_DUOC = [
  'ct16','ct17','ct19','ct20','ct22','ct23','ct24','ct25','ct27','ct28','ct30','ct31','ct32',
] as const;                       // 13 chỉ tiêu — khớp `O_SUA_DUOC_TNCN05` của FE
export const CT_TONG_HOP = {      // luôn tính lại, cấm ghi đè trực tiếp (E-tkt-012)
  ct18: ['ct19','ct20'], ct21: ['ct22','ct23'],
  ct26: ['ct27','ct28'], ct29: ['ct30','ct31'],
} as const;
```

---

## 4. Sáu quyết định Architect mà SRS để ngỏ

| # | Điểm SRS để ngỏ | **Quyết định** | Căn cứ |
|---|---|---|---|
| **(a)** | Tên bảng/field cuối cùng | 5 bảng như Mục 3. Phong cách đặt tên **theo bảng, không theo sub-cụm**: `hrm_tax_policies`/`hrm_other_income_categories`/`hrm_other_income_records` dùng English-camelCase (khớp bảng đã tồn tại + `OtherIncomeRecordDto` ở FE); `hrm_tax_calculation_lines` + `hrm_to_khai_tncn05` dùng Vietnamese-snake (khớp `DongBangTinhThueDto`/`ToKhaiTncn05Dto` ở FE). **Đánh đổi ghi rõ:** sub-cụm có 2 phong cách — đổi lấy **không có lớp ánh xạ tên** ở cả BE lẫn FE, và không phải viết lại code nháp đã có. Repo vốn đã trộn 2 phong cách (`hrm_hop_dong` vs `PayrollSheetLine`) | SRS Mục 14 điểm 5 |
| **(b)** | Cơ chế snapshot bất biến A-tkt-09 | **Snapshot KẾT QUẢ, không snapshot THAM SỐ**: bản ghi lưu `taxTreatmentGroup` + `exemptAmount` + `taxableAmount` + `taxRate` + `taxDeducted` (3 cột mới), **không** chép `withholdingThreshold`/`exemptCapAmount`. 3 cột thay vì 5, và Bảng tính thuế **không bao giờ** phải đọc lại danh mục | **ADR-013** |
| **(c)** | Tái dùng `hrm_payroll_module_locks` hay tạo cơ chế riêng | **Tái dùng**, thêm đúng 1 giá trị enum `TAX_SHEET`, **không** thêm vào `PAYROLL_MODULE_CODES`. 0 bảng mới, 0 thay đổi hành vi màn Chốt kỳ lương, và 2 hàng rào có sẵn (Mục 2.3) tự chặn lối khóa chui | **ADR-013** |
| **(d)** | Effective-dated cho biểu thuế/giảm trừ (OQ-hrm-35) | Bảng **`hrm_tax_policies`** riêng, khóa theo `effectiveFrom` (không có `effectiveTo`), tra theo `period.startDate`. `GeneralSetting` **nhả 6 cột thuế** theo lộ trình 4 bước M-1…M-4 để giữ đúng 1 nguồn sự thật (NFR-tkt-004) | **ADR-012** |
| **(e)** | Cách BR-tkt-011 tra `loai_lao_dong` | **KHÔNG truy vấn `hrm_hop_dong` lần hai.** Lấy thẳng `contractType` mà engine lương đã chọn (`payrollCalculation.service.ts:615` — hợp đồng lọc theo kỳ, A-02) rồi cho qua `laHopDongKhauTruTaiNguon()` (`:105-108`, đã export sẵn). Kỳ đã `LOCKED` thì đọc `PayrollSheetLine.contractType` (snapshot). Xem Mục 5.2 | A-tkt-03, NFR-tkt-005 |
| **(f)** | Field mapping 17 chỉ tiêu `ct16`–`ct32` | Bảng đầy đủ ở Mục 8 — rút từ `toKhaiTncn05.service.ts:169-230` (code nháp đã có), sửa lại đơn vị gộp thành **theo NGƯỜI** và đánh dấu các chỉ tiêu chưa có nguồn | SRS BR-tkt-018 |

---

## 5. Đường dữ liệu & ranh giới giao dịch

### 5.1. Bảng tính thuế tháng lấy số lương ở đâu

```
Kỳ tháng CHƯA chốt (không có dòng TAX_SHEET)
  └─ calculatePayrollPreview(db, periodId)        ← payrollCalculation.service.ts:274
        │  trả 45 trường/nhân viên, số là NUMBER
        └─► lấy đúng 7 trường:
              grossIncome · otTaxExemptAmount · lunchAllowanceExemptAmount
              otherAllowanceTaxExemptAmount · employeeInsuranceDeduction
              contractType · personalIncomeTax

Kỳ tháng ĐÃ chốt (có dòng TAX_SHEET)
  └─ đọc thẳng hrm_tax_calculation_lines — KHÔNG tính lại bất cứ gì
```

**Các công thức bắc cầu (dùng chung, cấm chép lần hai):**

```
thu_nhap_mien_thue = otTaxExemptAmount + lunchAllowanceExemptAmount + otherAllowanceTaxExemptAmount
thu_nhap_luong     = grossIncome                       // thu nhập gộp từ lương chính
thu_nhap_ngoai     = Σ taxableAmount + Σ grossAmount của khoản WITHHOLDING_FLAT (trong kỳ, của NGƯỜI đó)
thu_nhap_khau_tru_rieng = Σ grossAmount của khoản WITHHOLDING_FLAT (trong kỳ, của NGƯỜI đó)
thu_nhap_tinh_thue = max(0, thu_nhap_chiu_thue − thu_nhap_khau_tru_rieng − tong_giam_tru)   // chỉ LUY_TIEN
giam_tru_bao_hiem  = employeeInsuranceDeduction + min(BH hưu trí tự nguyện, voluntaryPensionMonthlyCap)
                     + đóng góp từ thiện hợp lệ        // hai vế sau: chưa có nguồn nhập liệu, xem P-17
```

> **Vì sao không đụng engine lương:** cả 4 cấu phần trên đều **đã** là cột trả ra sẵn (và đã là cột snapshot trên `PayrollSheetLine:1772-1784`). Tính lại `thu_nhap_luong` bằng cách cộng dồn lại các khoản lương là chép công thức lần hai — đúng thứ ADR-010 QĐ-8 đã cấm.

### 5.2. `loai_lao_dong` và `phuong_phap_tinh` — bảng quyết định duy nhất

| Điều kiện | `loai_lao_dong` | `phuong_phap_tinh` | `thue_luy_tien` | `thue_toan_phan` |
|---|---|---|---|---|
| `ma_nv` NULL | `VANG_LAI` | lấy theo `taxDeductionType` của chính bản ghi: `EXEMPT_COMMIT`→`CAM_KET_08` · `NO_DEDUCTION`→`DUOI_NGUONG` · `FLAT_10`→`KHAU_TRU_10` | 0 | Σ `taxDeducted` |
| `ma_nv` có · `laHopDongKhauTruTaiNguon(contractType) === true` | `THOI_VU_THU_VIEC` | `KHAU_TRU_10` | 0 | `personalIncomeTax` **lấy thẳng từ engine lương** + Σ `taxDeducted` của khoản `WITHHOLDING_FLAT` |
| `ma_nv` có · còn lại (gồm cả `khoan`, `null` contract) | `HOP_DONG_3_THANG_TRO_LEN` | `LUY_TIEN` | tính bằng `taxBrackets` của `TaxPolicy` hiệu lực | Σ `taxDeducted` của khoản `WITHHOLDING_FLAT` |

⚠️ Ở nhánh `THOI_VU_THU_VIEC`, **cấm tính lại 10%** — phải lấy `personalIncomeTax` mà engine lương đã tính (NFR-tkt-005). Code nháp hiện đang tính lại (`taxCalculation.service.ts:159+`) ⇒ hai màn sẽ ra hai số khác nhau ngay khi `withholdingTaxThreshold` đổi. Xem phản biện P-05.

### 5.3. Ranh giới giao dịch (NFR-tkt-002)

| Thao tác | Trong 1 transaction | Ngoài transaction |
|---|---|---|
| Chốt Bảng tính thuế tháng | `SELECT … FOR UPDATE` dòng kỳ lương → kiểm kỳ lương `LOCKED`+ (E-tkt-008) và chưa có khóa (E-tkt-018) → tính dòng → `create` khóa `TAX_SHEET` (trùng ⇒ 409 `E-tkt-018`) → `deleteMany` dòng cũ của kỳ → `createMany` dòng mới `[sửa 2026-09-15 — RVW-721/722: bản đầu kiểm và tính NGOÀI giao dịch]` | `ghiNhatKyKyLuong(...)` |
| Thêm / sửa / xóa thu nhập ngoài lương | `SELECT … FOR SHARE` dòng kỳ lương → kiểm khóa `TAX_SHEET`/`OTHER_INCOME` (E-tkt-007) → tính snapshot → ghi `[BỔ SUNG 2026-09-15 — RVW-722]` | — |
| Mở lại / xóa kỳ lương (`du_lieu_tinh_luong`) | `SELECT … FOR UPDATE` dòng kỳ lương → còn khóa `TAX_SHEET` ⇒ 409 `E-dltl-029` → (riêng xóa) kỳ còn khoản thu nhập ngoài lương ⇒ 409 `E-dltl-030` → đổi trạng thái / xóa `[BỔ SUNG 2026-09-15 — RVW-721, RVW-735]` | nhật ký |
| Mở lại Bảng tính thuế tháng | `delete` khóa `TAX_SHEET` (0 dòng ⇒ 409 `E-tkt-018`) → kiểm quý chưa xuất (đã xuất ⇒ 403 `E-tkt-009`, lùi cả giao dịch) → `deleteMany` dòng của kỳ → `deleteMany` tờ khai chưa xuất của quý (GAP-QA-tkt-06) | nhật ký |
| Xuất tờ khai quý | kiểm đủ 3 khóa `TAX_SHEET` → `upsert` tờ khai (`ct_may`, `ct`, `canh_bao`, `trang_thai=EXPORTED`, `khoa_so_*`) | **kết xuất Excel/PDF (Puppeteer)** — tuyệt đối không nằm trong transaction, render mất vài giây sẽ giữ khóa hàng |
| Ghi đè chỉ tiêu | `update` `ghi_de` + tính lại `ct` + 3 cột bóc tách | — |
| Đánh dấu đã nộp | `update` `trang_thai=SUBMITTED`, `nop_boi`, `nop_luc` | — |

**Đồng thời (concurrency):**

| Đua | Chặn bằng |
|---|---|
| 2 người cùng bấm Chốt 1 tháng | Khóa `FOR UPDATE` dòng kỳ lương ⇒ lượt sau chờ rồi thấy khóa `TAX_SHEET` ⇒ **409 E-tkt-018**; lưới cuối là `@@unique([periodId, module])` của `PayrollModuleLock` ⇒ `P2002` ⇒ **409** |
| 2 người cùng tạo bản ghi trùng | unique index `hrm_oir_chong_trung_v2` ⇒ `P2002` ⇒ **409 E-tkt-005** |
| Chốt tháng trong khi có người đang thêm / sửa / xóa thu nhập ngoài lương | Hai bên cùng khóa dòng kỳ lương: lượt ghi giữ `FOR SHARE`, lượt chốt chờ `FOR UPDATE` ⇒ lượt ghi commit xong mới tính dòng (snapshot có đủ khoản đó); lượt ghi đến sau khi chốt thấy khóa `TAX_SHEET` ⇒ **403 E-tkt-007** `[sửa 2026-09-15 — RVW-722: bản đầu chấp nhận khoản lọt giữa lúc tính và lúc khóa; thực tế còn lọt cả lệnh ghi SAU khi tháng đã chốt]` |
| Mở lại / xóa kỳ lương đúng lúc chốt tháng | Cùng khóa `FOR UPDATE` dòng kỳ lương ⇒ xếp hàng: chốt trước thì mở lại / xóa kỳ thấy khóa `TAX_SHEET` ⇒ **409 E-dltl-029**; mở lại trước thì chốt thấy kỳ `DRAFT` ⇒ **400 E-tkt-008** `[BỔ SUNG 2026-09-15 — RVW-721]` |
| 2 người cùng xuất 1 tờ khai quý | PK `(nam, ky_loai, ky_so, so_lan)` + `upsert` có điều kiện `trang_thai = READY_TO_EXPORT` ⇒ người thứ hai nhận **409** |
| Mở lại 1 tháng đúng lúc người khác xuất tờ khai quý | Mở lại xóa dòng khóa `TAX_SHEET` trước khi kiểm quý, trong cùng giao dịch ⇒ giữ khóa hàng tới lúc xong. **Bước xuất phải đọc khóa 3 tháng bằng `SELECT … FOR SHARE`** — đọc thường ở `READ COMMITTED` không thấy lệnh xóa chưa commit và vẫn xuất được (ghi chú cho bước 6, 2026-09-15) |

**Yêu cầu nhất quán (consistency):** Bảng tính thuế **chỉ** được chốt khi kỳ lương gốc đã `LOCKED` trở lên (E-tkt-008) — kỳ còn mở thì `calculatePayrollPreview` cho ra số khác nhau mỗi lần gọi, chốt lên số động là chốt lên cát. **Chiều ngược lại** `[BỔ SUNG 2026-09-15 — RVW-721]`: tháng đã chốt thì kỳ lương gốc **không** mở lại hay xóa được (409 `E-dltl-029`) — phải mở lại Bảng tính thuế trước; quý đã xuất thì kỳ lương khóa vĩnh viễn.

---

## 6. Lộ trình di trú (Migration strategy)

Áp dụng đúng khuôn 4 bước đã dùng cho `hrm_tai_lieu_file` (`data-model.md` M-14) — **không** làm gộp một lần.

| Bước | Việc | Điều kiện qua bước sau |
|---|---|---|
| **M-1** | Thêm 4 enum mới + 3 bảng mới (`hrm_tax_policies`, `hrm_other_income_categories`, `hrm_tax_calculation_lines`) + `TAX_SHEET`. Thêm cột mới vào `hrm_other_income_records` (`otherIncomeCategoryId` **nullable**, `taxTreatmentGroup` nullable, `exemptAmount`, `taxableAmount`, `forceWithholding`). `prisma db push` → `npm run hrm:constraints` | 2 unique index raw SQL tạo thành công trên mọi tenant |
| **M-2** | Seed 2 dòng `hrm_tax_policies` (Mục 7.1) + seed 12 danh mục (Mục 7.2). Chuyển `incomeType` (chữ tự do) → `otherIncomeCategoryId` bằng script đối chiếu tên; dòng không khớp gán danh mục `TN99 — Khác (cần phân loại lại)` nhóm `WITHHOLDING_FLAT`. Tính `taxTreatmentGroup`/`exemptAmount`/`taxableAmount` cho dòng cũ | Đếm dòng `otherIncomeCategoryId IS NULL` = **0** trên mọi tenant |
| **M-3** | Siết `otherIncomeCategoryId` + `taxTreatmentGroup` thành **NOT NULL**. Engine thuế chuyển sang đọc `TaxPolicy`; `generalSettings.service` đọc/ghi dòng `TaxPolicy` đang hiệu lực thay vì 6 cột của `GeneralSetting` | Đối soát: mọi kỳ đã `LOCKED` tính lại cho ra **đúng** `personalIncomeTax` như `PayrollSheetLine` đã snapshot (xem cảnh báo P-01 về biểu 7 bậc) |
| **M-4** | Bỏ `OtherIncomeRecord.incomeType`. Bỏ 6 cột thuế khỏi `GeneralSetting` (`personalDeduction`, `dependentDeduction`, `taxBrackets`, `withholdingTaxRate`, `withholdingTaxThreshold`, `lunchAllowanceTaxFreeCap`) | Không còn tham chiếu nào trong `src/` (grep sạch) |

> **Rollback:** M-1 và M-2 chỉ thêm, không xóa ⇒ lùi được bằng cách bỏ qua. Từ **M-3 trở đi có phá vỡ tương thích ngược** — phải sao lưu CSDL tenant trước khi chạy, và M-4 **không** rollback được bằng schema (phải phục hồi từ bản sao lưu).
>
> **Lưu giữ dữ liệu (data retention):** không có luồng xóa tự động cho cả 5 bảng. Chứng từ thuế phải giữ tối thiểu 10 năm theo Luật Kế toán — xóa kỳ lương (`onDelete: Cascade`) chỉ làm được khi kỳ còn `DRAFT`, tháng không còn khóa `TAX_SHEET` (409 `E-dltl-029`, RVW-721) **và** kỳ không còn khoản thu nhập ngoài lương nào (409 `E-dltl-030`, RVW-735) — cả ba kiểm trong giao dịch, dưới khóa dòng kỳ (2026-09-15). Bản đầu chỉ dựa vào `DRAFT` nên xóa kỳ cuốn theo dòng thuế đã chốt và mọi khoản ngoài lương, kể cả khoản đã phát hành chứng từ khấu trừ.

---

## 7. Dữ liệu khởi tạo (Seed)

### 7.1. `hrm_tax_policies` — 2 dòng

| `effectiveFrom` | `personalDeduction` | `dependentDeduction` | `taxBrackets` | `withholdingTaxRate` / `Threshold` | `voluntaryPensionMonthlyCap` | `lunchAllowanceTaxFreeCap` |
|---|---:|---:|---|---|---:|---:|
| `1900-01-01` (kế thừa) | **11.000.000** | **4.400.000** | biểu **7 bậc** cũ (5/10/15/20/25/30/35 — `payrollCalculation.service.ts:21-42`) | 10.0 / **2.000.000** | 1.000.000 | 730.000 |
| `2026-01-01` | **15.500.000** | **6.200.000** | biểu **5 bậc** (10tr–5% · 30tr–10% · 60tr–20% · 100tr–30% · bậc mở–35%) | 10.0 / **5.000.000** | **3.000.000** | **1.200.000** |

**Ba ghi chú bắt buộc đọc:**

1. Dòng `1900-01-01` là **ảnh chụp hiện trạng**, không phải giá trị "đúng" — chép đúng những gì `GeneralSetting` và `tinhThueLuyTien()` đang chạy, để mọi kỳ đã chốt trong quá khứ tính lại vẫn ra đúng số cũ (A-tkt-01).
2. ~~`withholdingTaxThreshold = 2.000.000` và `lunchAllowanceTaxFreeCap = 730.000` ở dòng 2026 **cố tình giữ nguyên số cũ**~~ — **CẬP NHẬT 2026-09-14:** hai số này đã được BA chốt đổi thành **5.000.000** và **1.200.000** trong cùng ngày (BUG-dltl-004, theo NĐ 253/2026/NĐ-CP), nên `[CHỜ BA]` đã gỡ và bảng trên mang số mới. Ghi chú gốc giữ lại để hiểu vì sao bản thiết kế đầu tiên để số cũ: lúc đó hai field này còn thuộc phạm vi `srs-du-lieu-tinh-luong.md` chưa sửa. Phản biện **P-02** coi như đã đóng.
3. Ngày hiệu lực `2026-01-01` bám `BR-tkt-017` ("kỳ tính thuế 2026 trở đi"). **`OQ-tkt-02` ĐÃ CHỐT 2026-09-14 — chủ dự án quyết áp biểu mới cho TOÀN BỘ năm 2026**, không tách H1/H2. Vì vậy giữ đúng 2 dòng như bảng trên, `effectiveFrom = 2026-01-01`. Nếu sau này cơ quan thuế hướng dẫn khác, mô hình effective-dated cho phép sửa bằng **một dòng dữ liệu** (đổi `effectiveFrom` thành `2026-07-01` + thêm dòng H1), không đụng code.

### 7.2. `hrm_other_income_categories` — 12 danh mục (BR-tkt-002, nguyên văn số liệu SRS)

| `code` | `name` | Nhóm | Tham số |
|---|---|---|---|
| TN01 | Làm thêm giờ / ca đêm | `EXEMPT_FULL` | — |
| TN02 | Trợ cấp thôi việc / mất việc | `EXEMPT_FULL` | — |
| TN03 | Trợ cấp thất nghiệp | `EXEMPT_FULL` | — |
| TN04 | Công tác phí thực thanh toán có chứng từ | `EXEMPT_FULL` | — |
| TN05 | Khoản chi chung không ghi tên cá nhân (xe đưa đón, học phí con, khám sức khỏe) | `EXEMPT_FULL` | — |
| TN06 | Trang phục hiện vật có hóa đơn | `EXEMPT_FULL` | — |
| TN07 | Thưởng sáng kiến được cơ quan nhà nước công nhận | `EXEMPT_FULL` | — |
| TN08 | Ăn ca doanh nghiệp tự nấu / phiếu ăn | `EXEMPT_FULL` **`[SỬA — BA duyệt P-09, xem BR-tkt-002 SRS]`** | — |
| TN09 | Ăn trưa / ăn ca bằng tiền mặt | `EXEMPT_CAPPED` | `1.200.000` / `MONTHLY` |
| TN10 | Trang phục bằng tiền | `EXEMPT_CAPPED` | `5.000.000` / `YEARLY` **(`OQ-tkt-03` còn mở)** |
| TN11 | Thưởng Tết / lễ / KPI / tháng 13 · phúc lợi ghi rõ tên cá nhân | `TAXABLE_FULL` | — |
| TN12 | Hoa hồng / thù lao CTV / kiêm nhiệm không HĐLĐ hoặc HĐLĐ <3 tháng | `WITHHOLDING_FLAT` | `10.0%` / `5.000.000` |

> **Thời điểm seed:** theo `AC-tkt-003`, chạy **lười** — lần đầu mở màn "Thu nhập ngoài lương" mà bảng rỗng thì tự sinh (cùng khuôn self-healing `BR-hrm-070`), không chạy lúc tạo công ty.

---

## 8. Ánh xạ 17 chỉ tiêu `ct16`–`ct32` (quyết định **(f)**)

**Đơn vị gộp:** mọi chỉ tiêu tính trên tập **NGƯỜI** (gộp theo `recipientKey`) của **3 tháng trong quý**, lấy từ `hrm_tax_calculation_lines`. Một người xuất hiện ở nhiều tháng chỉ được **đếm một lần** ở các chỉ tiêu đếm người, nhưng **cộng dồn** ở các chỉ tiêu tiền.

| CT | Tên | Kiểu | Công thức tự tính | Gốc? |
|:---:|---|:---:|---|:---:|
| **16** | Tổng số lao động | Int | `COUNT(DISTINCT recipientKey)` của người có `Σ tong_thu_nhap > 0` trong quý. `[SỬA 2026-09-15 — ISSUE-tkt-002]` Nhân viên không được trả đồng nào cả quý (vd hợp đồng từ quý sau) vẫn có dòng 0 đồng trên Bảng tính thuế tháng nhưng KHÔNG đếm — chủ dự án chốt | ✅ |
| **17** | Cá nhân cư trú có HĐLĐ ≥3 tháng | Int | đếm người có `Σ tong_thu_nhap > 0` ∧ `cu_tru` ∧ từng có `loai_lao_dong = HOP_DONG_3_THANG_TRO_LEN` `[SỬA 2026-09-15 — ISSUE-tkt-002]` | ✅ |
| **18** | Tổng cá nhân đã khấu trừ thuế | Int | `= ct19 + ct20` | ❌ |
| **19** | — cá nhân cư trú | Int | đếm người `cu_tru` ∧ `Σ tong_thue_tncn > 0` | ✅ |
| **20** | — cá nhân không cư trú | Int | đếm người `!cu_tru` ∧ `Σ tong_thue_tncn > 0` | ✅ |
| **21** | Tổng TNCT trả cho cá nhân | Decimal | `= ct22 + ct23` | ❌ |
| **22** | — cá nhân cư trú | Decimal | `Σ thu_nhap_chiu_thue` của người `cu_tru` | ✅ |
| **23** | — cá nhân không cư trú | Decimal | `Σ thu_nhap_chiu_thue` của người `!cu_tru` | ✅ |
| **24** | Trong đó: TNCT từ tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của DN bảo hiểm không thành lập tại Việt Nam | Decimal | **`0`** — chưa có nguồn dữ liệu | ✅ `[P-12, OQ-tkt-05]` |
| **25** | Trong đó: TNCT được miễn theo quy định của Hợp đồng dầu khí | Decimal | **`0`** — chưa có nguồn dữ liệu | ✅ `[P-12, OQ-tkt-05]` |
| **26** | Tổng TNCT của cá nhân thuộc diện khấu trừ | Decimal | `= ct27 + ct28` | ❌ |
| **27** | — cá nhân cư trú | Decimal | `Σ thu_nhap_chiu_thue` của người `cu_tru` ∧ `Σ thuế > 0` | ✅ |
| **28** | — cá nhân không cư trú | Decimal | `Σ thu_nhap_chiu_thue` của người `!cu_tru` ∧ `Σ thuế > 0` | ✅ |
| **29** | Tổng thuế TNCN đã khấu trừ | Decimal | `= ct30 + ct31` | ❌ |
| **30** | — cá nhân cư trú | Decimal | `Σ tong_thue_tncn` của người `cu_tru` | ✅ |
| **31** | — cá nhân không cư trú | Decimal | `Σ tong_thue_tncn` của người `!cu_tru` | ✅ |
| **32** | Trong đó: Thuế TNCN đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của DN bảo hiểm không thành lập tại Việt Nam | Decimal | **`0`** — chủ dự án chốt 2026-09-15 theo nhãn mẫu, kế toán ghi đè nếu có. Công thức đề xuất cũ (`Σ tong_thue_tncn` của người cư trú có HĐLĐ) **bỏ**: sẽ điền sai số thuế lương vào ô bảo hiểm nhân thọ | ✅ `[OQ-tkt-05]` |

**Kiểm tra chéo tự động (`canh_bao`, giữ nguyên 9 luật đã có ở `toKhaiTncn05.service.ts:54-96`):**
`ct17 ≤ ct16` · `ct18 = ct19+ct20` · `ct18 ≤ ct16` · `ct21 = ct22+ct23` · `ct26 = ct27+ct28` · `ct26 ≤ ct21` · `ct27 ≤ ct22` · `ct28 ≤ ct23` · `ct29 = ct30+ct31` · `ct32 ≤ ct30`.

> Cảnh báo **không chặn** thao tác (chỉ hiển thị) — vì sau khi kế toán ghi đè hợp lệ, một bất đẳng thức vẫn có thể lệch tạm mà vẫn đúng nghiệp vụ.

---

## 9. Phản biện SRS gửi Business Analyst

> Vai trò Phase A "Spec Review" theo `CLAUDE.md`. **Không** tự sửa SRS. 17 điểm, xếp theo mức chặn. **Cập nhật 2026-09-14 (BA Final Sign-off):** toàn bộ 17 điểm đã được BA xử lý — xem cột "Kết luận BA" ở cuối mỗi điểm, và các sửa đổi tương ứng đã áp dụng vào `srs-to-khai-thue.md`.

### 🔴 Chặn triển khai (3)

**P-01 — `tinhThueLuyTien()` đang chạy biểu 7 bậc CŨ, hardcode, không đọc cấu hình.**

`payrollCalculation.service.ts:21-42` cài cứng biểu 7 bậc (5tr–5%, 10tr–10%, 18tr–15%, 32tr–20%, 52tr–25%, 80tr–30%, trên 80tr–35%), **không** đọc `GeneralSetting.taxBrackets`. Comment tại `:357-358` còn khẳng định *"Biểu thuế TNCN 7 bậc GIỮ NGUYÊN `tinhThueLuyTien()` (đã đúng luật, không đụng — ngoài phạm vi đợt sửa này)"* — câu này viết ngày 2026-09-09, **trước** khi BA cập nhật `BR-hrm-081` sang biểu 5 bậc ngày 2026-09-14.

Ba hệ quả:
1. Trái `BR-hrm-081` (biểu 5 bậc theo Luật 109/2025/QH15, đã ký) và trái `NFR-tkt-004` ("không hardcode rời rạc ở nhiều nơi").
2. **`AC-tkt-017` không thể pass**: thu nhập tính thuế 9.500.000đ ra `475.000` theo biểu 5 bậc mới (bậc 1 đến 10tr, 5%), nhưng ra `700.000` theo biểu 7 bậc đang chạy (5tr×5% + 4,5tr×10%).
3. Nghiêm trọng hơn phạm vi đợt này: **bảng lương đang phát hành hiện tính sai thuế TNCN** theo luật 2026 cho mọi nhân viên.

Nằm ngoài phạm vi SRS `tkt` nhưng **chặn cứng** AC-tkt-017 và NFR-tkt-005. Đề nghị BA mở việc riêng và xếp lịch **trước** golive dữ liệu thật.

> **Kết luận BA (2026-09-14):** xác nhận nghiêm trọng, đã tạo task riêng mức ưu tiên cao (`task_defff3dd`) độc lập với `task_85b3ae1d` (task cũ chỉ về BR-dltl-025/026/027, KHÔNG bao gồm chính biểu thuế lũy tiến này). Không sửa trong phạm vi `to_khai_thue`.

**P-02 — Hai ngưỡng khấu trừ 10% cùng tồn tại, cùng gốc pháp lý, khác giá trị.**

`GeneralSetting.withholdingTaxThreshold = 2.000.000` (BR-dltl-026, đang chạy trong bảng lương) và `withholdingThreshold = 5.000.000` của danh mục thu nhập ngoài lương (BR-tkt-008, SRS này). Cả hai đều viện dẫn **cùng một** căn cứ — NĐ 253/2026/NĐ-CP Điều 50 khoản 2 ⇒ **một trong hai đang sai luật**.

SRS Mục 14 điểm 5 đã ghi nhận và hoãn sang "task riêng" (`task_85b3ae1d`). Nhưng điểm mà SRS chưa nêu: trong **cùng một quý**, một người `thu_viec` vừa nhận lương vừa nhận hoa hồng sẽ bị áp **hai ngưỡng khác nhau**, và **cả hai con số cùng chảy vào một tờ khai 05/KK-TNCN**. Đây không phải nợ kỹ thuật hoãn được — là số liệu pháp lý mâu thuẫn trên cùng một chứng từ nộp cho cơ quan thuế. Đề nghị BA chốt **trước bước M-3**.

> **Kết luận BA (2026-09-14):** giữ nguyên quyết định hoãn sang `task_85b3ae1d`, xử lý trước bước M-3 của lộ trình di trú (Mục 6). Không chặn việc ghi 3 file SRS/data-model/api-contract của `to_khai_thue` hôm nay.

**P-03 — `BR-tkt-011` đẩy hợp đồng `khoan` vào nhánh lũy tiến mà không ai nhắc là đã quyết.**

BR-tkt-011 định nghĩa `HOP_DONG_3_THANG_TRO_LEN` = `loai_hd` **không thuộc** `{thu_viec, thoi_vu}`. Theo đúng chữ, hợp đồng **khoán** (`khoan` — một trong 5 giá trị hợp lệ của `hrm_hop_dong.loai_hd`, `schema.prisma:988-991`) rơi vào nhánh **lũy tiến**, được giảm trừ gia cảnh 15,5tr/tháng.

Trong khi đó:
- Code nháp hiện xếp `khoan` vào nhánh khấu trừ 10% (`taxCalculation.service.ts:112-114` chỉ nhận `khong_xac_dinh`/`xac_dinh` là dài hạn).
- `EC-dltl-06`/`EC-dltl-07` của `srs-du-lieu-tinh-luong.md` đang **treo đúng câu hỏi này** và chưa có kết luận; `ADR-010 QĐ-3` ghi rõ "phạm vi CHỐT: đúng `{thu_viec, thoi_vu}`; `khoan`/`xac_dinh` ngắn hạn KHÔNG nằm trong nhóm này — chờ kế toán trưởng xác nhận riêng".

SRS `tkt` đóng cứng một chiều mà không ghi là đã quyết. Xin BA xác nhận rõ: `khoan` đi nhánh nào, và câu trả lời có đóng luôn `EC-dltl-06/07` không.

> **Kết luận BA (2026-09-14):** xác nhận với chủ dự án — hợp đồng khoán đi nhánh **lũy tiến, có giảm trừ gia cảnh**, đúng như BR-tkt-011 hiện tại. Đã đóng `EC-dltl-07` (đúng case `khoan`) trong `srs-du-lieu-tinh-luong.md`. `EC-dltl-06` (`xac_dinh` <3 tháng) là câu hỏi khác, vẫn treo — không bị ảnh hưởng.

### 🟡 Thiếu định nghĩa, phải chốt trước khi code (7)

**P-04 — `thuc_nhan` không phải "thực nhận".**

SRS Mục 4.3 định nghĩa `thuc_nhan = tong_thu_nhap − tong_thue_tncn − BH bắt buộc (đã trừ trong lương)`. Nhưng `tong_thu_nhap = thu_nhap_luong + thu_nhap_ngoai`, trong đó `thu_nhap_ngoai` **chỉ** gồm phần chịu thuế — không gồm:
- khoản nhóm `EXEMPT_FULL` (người lao động vẫn nhận tiền thật),
- phần miễn của nhóm `EXEMPT_CAPPED`,
- toàn bộ khoản nhóm `WITHHOLDING_FLAT`.

Đồng thời **không** trừ đoàn phí công đoàn và các khoản ứng/bù trừ mà `netTakeHomeSalary` của Bảng lương **có** trừ (`payrollCalculation.service.ts:596-601`).

Hệ quả: cột này sẽ **lệch với cột "Thực nhận" của Bảng lương** trên cùng một nhân viên, cùng một tháng, và kế toán chắc chắn sẽ hỏi vì sao. Đề nghị: đổi tên thành `thu_nhap_sau_thue` và ghi rõ đây là góc nhìn thuế, hoặc bỏ hẳn cột (Bảng lương đã có "Thực lĩnh" đúng nghĩa).

> **Kết luận BA (2026-09-14):** giữ tên field `thuc_nhan` (tránh đổi schema đã code), nhưng SRS đã ghi rõ đây KHÔNG phải "Thực lĩnh" của Bảng lương — khác phạm vi (không gồm khoản miễn/khấu trừ riêng, không trừ đoàn phí/ứng-bù trừ).
>
> **Cập nhật 2026-09-15 (tách 2 phần):** gạch đầu dòng thứ ba ở trên không còn đúng — khoản `WITHHOLDING_FLAT` nay nằm trong `thu_nhap_ngoai`, nên có mặt trong `tong_thu_nhap` và `thuc_nhan`. Phần khác biệt với "Thực lĩnh" chỉ còn: khoản miễn, đoàn phí, ứng/bù trừ.

**P-05 — `thue_toan_phan` có đường đếm thuế hai lần.**

Mục 4.3 định nghĩa `thue_toan_phan` = Σ `taxWithheld` của khoản `WITHHOLDING_FLAT` **+ "từ chính lương nếu `loai_lao_dong = THOI_VU_THU_VIEC` theo BR-dltl-026"**. Vế thứ hai chính là `personalIncomeTax` mà engine lương **đã** tính cho nhóm đó (`payrollCalculation.service.ts:585-589`).

Thiết kế này lấy **thẳng** số của engine, không tính lại (Mục 5.2) — nhưng code nháp hiện **đang tính lại** bằng công thức riêng. Nếu cả hai cùng tồn tại, số của Bảng lương và số của Bảng tính thuế sẽ lệch nhau ngay khi `withholdingTaxThreshold` đổi giá trị.

Xin BA xác nhận hai điều: (1) lấy thẳng số engine là đúng ý; (2) số thuế đó **không** bị cộng thêm lần nữa ở bước tổng hợp quý.

> **Kết luận BA (2026-09-14):** xác nhận đúng ý thiết kế (A-tkt-03: tái dùng engine, không tính lại) — lấy thẳng `personalIncomeTax` từ engine, không cộng thêm lần nữa ở bước quý.

**P-06 — Trần miễn theo `YEARLY` chưa có quy tắc lũy kế.**

Danh mục "Trang phục bằng tiền 5.000.000đ/người/năm" (TN10) dùng `exemptCapPeriod = YEARLY`. BR-tkt-007 chỉ viết *"`exemptCapAmount` quy đổi theo `exemptCapPeriod`"* — câu này mơ hồ giữa hai cách hiểu:
- **Chia 12 theo tháng** (≈416.667đ/tháng): sai nghiệp vụ, vì trang phục thường chi một lần trong năm, chi 5tr vào tháng 3 sẽ bị tính 4,58tr là thu nhập chịu thuế.
- **Lũy kế theo năm dương lịch**: đúng nghiệp vụ, nhưng cần tra tổng đã miễn của cùng (người, danh mục, năm) trước khi tính phần còn lại của trần.

Thiết kế tạm theo **lũy kế năm**. Cần BA chốt vì ảnh hưởng cả công thức BR-tkt-007 lẫn chỉ mục truy vấn.

> **Kết luận BA (2026-09-14):** chốt lũy kế theo năm dương lịch — đã ghi rõ vào BR-tkt-002 của SRS.

**P-07 — `BR-tkt-008` nhắc tới "cá nhân yêu cầu khấu trừ" nhưng không có chỗ nào bật.**

BR-tkt-008 viết: *"Dưới 5.000.000đ/lần: không khấu trừ, **trừ khi cá nhân yêu cầu khấu trừ (kế toán bật tay)**"*. Nhưng Mục 4.2 (danh sách trường của `OtherIncomeRecord`) **không có trường nào** cho nhánh này, và Mục 9 cũng không có mã lỗi liên quan.

Đã đề xuất thêm `forceWithholding Boolean @default(false)`. Đây là **trường nghiệp vụ mới**, cần BA duyệt — hoặc xác nhận bỏ nhánh này khỏi BR-tkt-008 nếu thực tế không dùng.

> **Kết luận BA (2026-09-14):** duyệt field `forceWithholding` — chỉ hiện thực hóa lời văn đã có sẵn trong BR-tkt-008, không phải quy tắc nghiệp vụ mới.

**P-08 — Cam kết 08 sai danh mục / sai cư trú không có mã lỗi.**

BR-tkt-007 quy định `hasCommitment08` chỉ hợp lệ khi **đồng thời** ba điều kiện: nhóm `WITHHOLDING_FLAT` ∧ `isResident = true` ∧ có `taxCode`. Nhưng Ma trận lỗi (Mục 9 SRS) chỉ có `E-tkt-006` cho ca **thiếu MST**. Hai ca còn lại không có mã:
- tick Cam kết 08 nhưng `isResident = false`;
- tick Cam kết 08 trên danh mục thuộc nhóm `EXEMPT_FULL`/`EXEMPT_CAPPED`/`TAXABLE_FULL`.

Đề nghị **mở rộng ngữ nghĩa `E-tkt-006`** thành *"Cam kết 08/CK-TNCN không hợp lệ"* phủ cả 3 ca (thiết kế hiện làm theo hướng này), hoặc cấp 2 mã mới nếu BA muốn tách thông điệp.

> **Kết luận BA (2026-09-14):** duyệt mở rộng ngữ nghĩa `E-tkt-006` phủ cả 3 ca — đã cập nhật BR-tkt-008 của SRS.

**P-09 — "Trần vô hạn" của `EXEMPT_CAPPED` tự mâu thuẫn với `BR-tkt-003`.**

BR-tkt-002 xếp "ăn ca DN tự nấu/phiếu ăn" vào nhóm `EXEMPT_CAPPED` *"với ngưỡng = vô hạn theo cấu hình, để không cần thêm nhóm thứ 5"*. Hai vấn đề:
1. `BR-tkt-003` bắt `exemptCapAmount` là **bắt buộc** cho nhóm `EXEMPT_CAPPED` (thiếu ⇒ 400 `E-tkt-003`), và SRS không quy định giá trị nào biểu diễn "vô hạn" — `null` bị chặn, số rất lớn là số ma thuật.
2. **Không cần nhóm thứ 5 nào cả**: nhóm `EXEMPT_FULL` đã tồn tại và cho ra **đúng** kết quả nghiệp vụ (miễn 100%, không cộng vào `thu_nhap_ngoai`).

Đề nghị chuyển TN08 sang `EXEMPT_FULL`. Thiết kế đang seed theo hướng này và đánh dấu `[ĐỀ XUẤT]` — chờ BA chốt.

> **Kết luận BA (2026-09-14):** duyệt — TN08 chuyển sang `EXEMPT_FULL`, đã cập nhật BR-tkt-002 của SRS và Mục 7.2 seed ở trên.

**P-10 — `AC-tkt-017` ngầm giả định hợp đồng không trích BHXH.**

AC ghi *"thu nhập chịu thuế từ lương 20.000.000đ, … không có người phụ thuộc, **không giảm trừ khác**"* và kết luận `thu_nhap_tinh_thue = 9.500.000`. Nhưng theo chính `BR-tkt-010` và Mục 4.3, `tong_giam_tru` **luôn** gồm `giam_tru_bao_hiem` = BH bắt buộc 10,5% mà nhân viên HĐLĐ ≥3 tháng bình thường phải đóng. Với lương 20tr, phần này khoảng 2,1tr ⇒ `thu_nhap_tinh_thue` thực tế ≈ 7,4tr, không phải 9,5tr.

AC chỉ đúng khi hợp đồng có `trich_bhxh = false`. Đề nghị thêm điều kiện đó vào mệnh đề **Given** — nếu không, QA sẽ tự động hóa một kỳ vọng không tái hiện được và báo fail nhầm cho code đúng.

> **Kết luận BA (2026-09-14):** duyệt — đã thêm điều kiện `trich_bhxh=false` vào AC-tkt-017 của SRS.

### 🟢 Cần bổ sung, không chặn (7)

**P-11 — Tờ khai thiếu chỉ tiêu [01]–[15] (thông tin người nộp thuế).**

`FR-tkt-014` yêu cầu *"xuất đúng mẫu 05/KK-TNCN"* nhưng SRS chỉ đặc tả `ct16`–`ct32`. Phần đầu của mẫu (mã số thuế, tên người nộp thuế, địa chỉ, quận/huyện, tỉnh/thành, điện thoại, cơ quan thuế quản lý, kỳ tính thuế, lần đầu/bổ sung, tên đại lý thuế nếu có, người ký, ngày ký) **không** có trong bất kỳ bảng nào của sub-cụm.

Dữ liệu này nằm ở **control-plane** `maxv2_sys.don_vi` — tức phải đọc chéo database, khác mọi truy vấn còn lại của sub-cụm. Xin BA xác nhận nguồn dữ liệu và liệt kê chính xác các trường cần lấy để file xuất ra dùng được thật.

> **Kết luận BA (2026-09-14):** duyệt nguồn `maxv2_sys.don_vi` — đã bổ sung yêu cầu này vào FR-tkt-014 của SRS. Danh sách trường chính xác để Backend Engineer đối chiếu khi code, không cần BA liệt kê thêm ở SRS.

**P-12 — `ct24`/`ct25`/`ct32` chưa có định nghĩa pháp lý xác nhận.**

Code nháp trả `0` cho cả ba (`toKhaiTncn05.service.ts:197-199, 227-228`). Thiết kế này:
- giữ `0` cho `ct24`/`ct25` — không suy đoán được định nghĩa từ tên gọi;
- **đề xuất công thức** cho `ct32` = `Σ tong_thue_tncn` của người cư trú có `loai_lao_dong = HOP_DONG_3_THANG_TRO_LEN` (đọc theo nghĩa đen của tên chỉ tiêu).

Cần kế toán trưởng đối chiếu mẫu 05/KK-TNCN theo **Thông tư 89/2026/TT-BTC** bản gốc. Nếu để `0`, kế toán sẽ phải ghi đè tay ba chỉ tiêu này **mỗi quý** — đúng loại việc lặp mà G3 muốn loại bỏ.

> **Kết luận BA (2026-09-14):** chưa thể tự quyết (cần đối chiếu văn bản gốc) — đã thêm `OQ-tkt-05` vào SRS, giữ nguyên đề xuất tạm của Architect cho tới khi có câu trả lời.

**P-13 — Xuất XML cho HTKK: có trong code nháp, không có trong SRS.**

`xuatXmlTncn05.ts` (152 dòng) đã viết sẵn và có route `GET /to-khai-thue/05-kk-tncn/export-xml`. Nhưng `FR-tkt-014` chỉ yêu cầu **Excel + PDF**.

Thực tế nghiệp vụ: kế toán nộp tờ khai qua HTKK/eTax bằng cách **import XML**, không gõ lại số từ PDF. XML nhiều khả năng hữu ích hơn PDF cho đúng mục tiêu G3 ("không phải tính tay lại"). Xin BA quyết một trong ba: bỏ hẳn, giữ như tính năng bổ sung, hay **thay PDF bằng XML**.

> **Kết luận BA (2026-09-14):** bỏ hẳn XML đợt này — giữ đúng phạm vi Excel + PDF đã chốt trong SRS. Chuẩn XML HTKK không công khai chính thức, rủi ro sai định dạng cao hơn lợi ích.

**P-14 — `OQ-tkt-01` chưa đóng ⇒ chặn việc khóa cứng `ky_loai = 'quy'`.**

Thiết kế khóa `ky_loai` chỉ nhận `'quy'` theo `BR-tkt-016`. Nếu `OQ-tkt-01` kết luận *"cần dựng tờ khai lịch sử Quý I–II/2026 theo kỳ tháng"* thì phải mở lại giá trị `'thang'` ở validator (may mắn là cột vẫn còn trong khóa chính nên không phải đổi schema). Ghi ra để nếu điều đó xảy ra thì không bị coi là thay đổi ngoài dự kiến.

> **Kết luận BA (2026-09-14):** ghi nhận, không cần hành động thêm — `OQ-tkt-01` vẫn treo như cũ, xử lý khi có câu trả lời.

**P-15 — Thiếu mã lỗi cho "không tìm được chính sách thuế hiệu lực".**

Mô hình effective-dated (ADR-012) sinh ra một lỗi hệ thống mới mà Ma trận lỗi chưa có: kỳ lương có `startDate` nằm **trước** mọi `effectiveFrom` trong `hrm_tax_policies`. Đề nghị cấp `E-tkt-015` (500). Việc seed dòng `1900-01-01` khiến ca này gần như không xảy ra, nhưng vẫn cần mã để không rơi vào lỗi 500 vô danh mà QA không phân biệt được với lỗi hạ tầng.

> **Kết luận BA (2026-09-14):** duyệt, đã thêm `E-tkt-015` vào Ma trận lỗi SRS (cùng đợt với P-16).

**P-16 — Cần bổ sung 7 mã lỗi kỹ thuật vào Ma trận lỗi (SRS Mục 9).**

Ma trận lỗi hiện có 14 mã `E-tkt-001…014`, phủ đủ các quy tắc nghiệp vụ nhưng **không** phủ các ca kỹ thuật bắt buộc phải có mã. Hợp đồng API bổ sung 7 mã, cần BA duyệt đưa vào SRS:

| Mã đề xuất | HTTP | Tình huống | Vì sao cần |
|---|:--:|---|---|
| `E-tkt-015` | 500 | Không tìm thấy chính sách thuế hiệu lực cho kỳ | P-15 |
| `E-tkt-016` | 404 | Không tìm thấy bản ghi/danh mục theo `id` | SRS **không có mã 404 nào** — mọi endpoint `/:id` đều cần |
| `E-tkt-017` | 400 | `periodId` không tồn tại trong tenant | Phân biệt với 404 tài nguyên |
| `E-tkt-018` | 409 | Chốt tháng đã chốt / mở tháng chưa chốt | Đua hai người cùng thao tác |
| `E-tkt-019` | 403 | Sửa/xóa ghi đè khi tờ khai đã xuất | EC-tkt-03 có mô tả hành vi nhưng không có mã |
| `E-tkt-020` | 409 | Xuất lại tờ khai đã xuất | Đua hai người cùng bấm Xuất |
| `E-tkt-021` | 400 | Vi phạm `BR-tkt-009` (nhóm không phải `WITHHOLDING_FLAT` mà `ma_nv` null) | BR-tkt-009 viết *"Vi phạm trả 400"* nhưng **không cấp mã** — trong khi `AC-tkt-015` kiểm đúng ca này |

> **Kết luận BA (2026-09-14):** duyệt cả 7 mã, đã bổ sung vào Ma trận lỗi Mục 9 của SRS.

**P-17 — Hai cấu phần của `giam_tru_bao_hiem` chưa có nguồn nhập liệu.**

`BR-tkt-010` và Mục 4.3 định nghĩa `giam_tru_bao_hiem` gồm ba phần: (1) BH bắt buộc 10,5% — engine lương **đã có**; (2) BH hưu trí tự nguyện tối đa 3.000.000đ/tháng; (3) đóng góp từ thiện/nhân đạo/khuyến học theo chứng từ.

Phần (2) và (3) **không có trường nào** trong bất kỳ bảng nào để kế toán nhập vào — không có trong `OtherIncomeRecord`, không có trong các bảng của `du_lieu_tinh_luong`, không có trong hồ sơ nhân viên. `AC-tkt-016` lại kiểm đúng phần (2) ("hưu trí tự nguyện 4tr ⇒ chỉ trừ 3tr").

Ba lựa chọn xin BA chốt: (a) thêm hai trường nhập ở màn nào đó (cần FR mới); (b) khai qua một danh mục khoản lương có sẵn (`SalaryItem`) rồi engine nhận diện; (c) đưa ra ngoài phạm vi đợt này và **sửa `AC-tkt-016`** cho khớp. Thiết kế hiện để công thức sẵn ở Mục 5.1 nhưng hai vế đó luôn bằng 0 vì không có nguồn.

> **Kết luận BA (2026-09-14):** chọn phương án (c) — ngoài phạm vi đợt này, đã sửa `AC-tkt-016` và `BR-tkt-010` của SRS cho khớp thực tế (giam_tru_bao_hiem đợt này chỉ gồm BH bắt buộc).

---

## 10. Truy vết Business Rule → Lược đồ

| BR | Hiện thực ở đâu | Kiểu ràng buộc |
|---|---|---|
| BR-tkt-001 | `OtherIncomeCategory.taxTreatmentGroup` (enum 4 giá trị) | Enum CSDL |
| BR-tkt-002 | Seed Mục 7.2 | Dữ liệu |
| BR-tkt-003 | `code @unique` · `hrm_oic_ten_khong_trung` (raw SQL) · Zod `superRefine` theo nhóm | CSDL + validator |
| BR-tkt-004 | FK `onDelete: Restrict` + kiểm trước ở service | CSDL + service |
| BR-tkt-005 | `periodId` NOT NULL · `fullName` NOT NULL · `ma_nv` nullable | CSDL |
| BR-tkt-006 | `hrm_oir_chong_trung_v2` (unique index biểu thức; vãng lai theo CCCD → MST → họ tên) | CSDL |
| BR-tkt-007 | `exemptAmount` / `taxableAmount` / `taxDeducted` tính lúc ghi | Service + cột snapshot |
| BR-tkt-008 | `withholdingRate`/`withholdingThreshold` trên danh mục · `hasCommitment08` · `forceWithholding` | Service |
| BR-tkt-009 | Zod `superRefine`: nhóm ≠ `WITHHOLDING_FLAT` ⇒ `ma_nv` bắt buộc (**E-tkt-021**, P-16) | Validator |
| BR-tkt-010 | `TaxPolicy.voluntaryPensionMonthlyCap` · `giam_tru_bao_hiem` (xem P-17) | Cấu hình + service |
| BR-tkt-011 | `TaxLaborType` + bảng quyết định Mục 5.2 | Service (tái dùng `laHopDongKhauTruTaiNguon`) |
| BR-tkt-012 | `TaxPolicy.taxBrackets` + `thue_luy_tien` | Cấu hình + service |
| BR-tkt-013 | `PayrollModuleLock(module = TAX_SHEET)` + `hrm_tax_calculation_lines` | CSDL (ADR-013) |
| BR-tkt-014 | Đếm 3 khóa `TAX_SHEET` của 3 tháng trong quý | Service |
| BR-tkt-015 | `trang_thai` 3 giá trị · `khoa_so_*` · `nop_*` | CSDL + service |
| BR-tkt-016 | `ky_loai = 'quy'` (validator) | Validator |
| BR-tkt-017 | `hrm_tax_policies.effectiveFrom` | CSDL (ADR-012) |
| BR-tkt-018 | `CT_GOC_SUA_DUOC` / `CT_TONG_HOP` + `ghi_de` JSONB | Hằng số + CSDL |

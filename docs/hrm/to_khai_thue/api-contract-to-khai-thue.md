---
type: api-contract
feature: hrm-to-khai-thue
status: in-review
updated: 2026-09-14
author: system-architect
links:
  - docs/hrm/to_khai_thue/srs-to-khai-thue.md
  - docs/hrm/to_khai_thue/data-model-to-khai-thue.md
  - docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md
  - docs/hrm/architecture/adr/ADR-005-envelope-phan-trang-va-truyen-file.md
---

# HR — Hợp đồng API: Thu nhập ngoài lương, Bảng tính thuế & Tờ khai TNCN (`to_khai_thue`)

Đặc tả **22 REST endpoint** phủ đủ 18 yêu cầu chức năng `FR-tkt-001…018`.

- **Base URL**: `/api/v1/hrm` — đăng ký tại `routes/index.route.ts`; nhóm route của sub-cụm đã có sẵn tại `routes/hrm/hrm.route.ts:59` (`hrmToKhaiThueRoutes`).
- **Ứng dụng tiêu thụ**: `hdđt_maxv` (Kế toán & HĐĐT) — nhóm **`/api/v1/*`**. **KHÔNG** thuộc nhóm `maxv` `/api/v1/admin/*`.
- **Xác thực**: Bearer JWT / cookie `accessToken` — hook chung `hrm.route.ts:35-39` (`app.authenticate` + `requireModule('hrm')`). **Không** endpoint nào dưới đây được miễn.
- **Đa tenant**: `resolveTenantDb(req)` (qua `dbCoQuyenLuongPayroll`) ở đầu **mọi** controller. Client không truyền được tenant (NFR-tkt-001).
- **Envelope**: `{ success: true, data: … }` (`helpers/response.ts:4-10`).

> **Trạng thái tài liệu:** đây là hợp đồng **thiết kế đi trước code**, khác `api-contract-du-lieu-tinh-luong.md` (mô tả ngược từ code đã viết). Đã tồn tại **một bộ route nháp chưa commit** (`routes/hrm/to_khai_thue/toKhaiThue.route.ts`, 15 endpoint) — xem Mục 0.6 đối chiếu. Hợp đồng này **thay thế** bộ nháp đó.

---

## 0. Quy ước chung (đọc trước — 6 điểm)

### 0.1. Phân quyền — 2 mức, đóng `A-tkt-08`

| Mức | Cài đặt | Áp cho | Lỗi |
|---|---|---|---|
| **Quyền xem dữ liệu lương** | `dbCoQuyenLuongPayroll(req)` ở đầu controller (`helpers/hrm/payrollAccessGuard.ts`) — đúng như `cai_dat_luong` và `du_lieu_tinh_luong` đã dùng | **Mọi** endpoint: đọc, CRUD danh mục, CRUD thu nhập ngoài lương, **chốt** Bảng tính thuế | **403** `E-tkt-014` |
| **ADMIN / OWNER** | `preHandler: assertAdminOrOwner` ở **tầng route** (export từ `cai_dat_luong/generalSettings.route.ts`) — đúng chỗ `payrollClosing.route.ts:20-23` đã đặt | **Mở lại** Bảng tính thuế · **Xuất** tờ khai · **Đánh dấu đã nộp** | **403** `E-tkt-014` |

**Căn cứ phân đôi (không phải suy đoán — theo đúng tiền lệ đã chốt 2026-09-11):** trong `du_lieu_tinh_luong`, thao tác **thuận chiều** (`lock`, `submit`) chỉ cần quyền lương, còn thao tác **đảo chiều hoặc không hoàn tác được** (`reopen`, `approve`, `mark-paid`, `archive`, `unlock` bảng kê) mới cần ADMIN/OWNER. Áp cùng luật đó ở đây:

- **Chốt** tháng ⇒ đảo được (có nút Mở lại) ⇒ quyền lương là đủ.
- **Mở lại** ⇒ xóa số đã chốt, không hoàn tác ⇒ ADMIN/OWNER (cùng mức `unlockModule`).
- **Xuất tờ khai** ⇒ khóa **vĩnh viễn** 3 tháng, không có đường lùi (BR-tkt-015) ⇒ ADMIN/OWNER (cùng mức `archive`).
- **Đánh dấu đã nộp** ⇒ tuyên bố pháp lý với cơ quan thuế ⇒ ADMIN/OWNER (cùng mức `mark-paid`).

> **Cài đặt thực tế (2026-09-15):** cả hai mức đi qua `helpers/hrm/toKhaiThueAccess.ts` (`dbToKhaiThue`, `assertQuanTriToKhaiThue`) ở **đầu controller**, để lỗi mang đúng `E-tkt-014` — `dbCoQuyenLuongPayroll` / `assertAdminOrOwner` gốc ném lỗi mã `E-hrm-058` / không mã. Ai được làm gì giữ nguyên như bảng trên; kiểm ở controller thay vì `preHandler` để quyền đi cùng handler — nối handler sang route khác cũng không lọt quyền (giữ nguyên khi viết lại file route ở bước 7, 2026-09-15). Ma trận quyền được kiểm tự động qua HTTP giả lập ở `hrmToKhaiThueRoutes.test.ts`.

### 0.2. Hình dạng lỗi — **bắt buộc 1 dạng duy nhất có `code`**

```jsonc
// Lỗi nghiệp vụ (ADR-005 Mục 1)
{ "success": false, "code": "E-tkt-005", "message": "Đã có khoản chi trả y hệt trong kỳ này…" }

// Lỗi kiểm dữ liệu (Zod) — có CẢ code lẫn errors
{ "success": false, "code": "E-tkt-004", "message": "Dữ liệu không hợp lệ",
  "errors": { "formErrors": [], "fieldErrors": { "fullName": ["Bắt buộc nhập họ tên"] } } }
```

⚠️ **Bài học bắt buộc áp dụng từ sub-cụm trước:** `du_lieu_tinh_luong` có **14/26 mã lỗi không bao giờ được ném ra** — chúng chỉ nằm trong chuỗi tiếng Việt của một Zod issue, khiến QA phải so khớp chuỗi và **đã sai một ca** (`api-contract-du-lieu-tinh-luong.md` Mục 0.2). Ở sub-cụm này: **cả 21 mã `E-tkt-001…021` phải ra tới client trong trường `code`**, kể cả lỗi Zod. Điều kiện nghiệm thu: QA grep được đủ 21 mã trong phản hồi thật, không phải trong mã nguồn.

### 0.3. Kiểu số tiền — **luôn là `number`**

Prisma `Decimal` serialize ra JSON thành **chuỗi**, và sub-cụm trước đã vướng đúng lỗi này (A-06 🟠: cùng một trường, khi thì `12345678`, khi thì `"12345678.00"` tùy kỳ đã khóa hay chưa).

**Quy định cho sub-cụm này:** mọi trường tiền/tỷ lệ trong phản hồi là **`number`**. Service phải `Number()` tại biên trước khi `sendOk`, ở **cả hai** nhánh (tính trực tiếp và đọc snapshot). FE không được phép gặp chuỗi tiền.

**Làm tròn:** `Math.round` đến **đồng**, tại từng bước — đúng như engine lương đang làm (`payrollCalculation.service.ts`), để `tong_thue_tncn` của hai màn không lệch 1 đồng.

### 0.4. Phân trang / lọc / sắp xếp (ADR-005 Mục 2)

| Nhóm | Phân trang | Lý do |
|---|---|---|
| `GET /income-categories` | **Không** | Danh mục nhỏ (~12 dòng), FE cần toàn bộ để dựng dropdown |
| `GET /other-income` | **Có** — `?limit=1..500 (mặc định 200)&offset=≥0`, trả header `X-Total-Count` | Bảng phát sinh, một kỳ có thể hàng trăm dòng |
| `GET /tax-calculation` | **Không** | Đơn vị đọc là **cả kỳ**: cắt trang thì 4 chỉ số KPI không tính được |
| `GET /05-kk-tncn/periods` | **Không** | Tối đa 4 dòng/năm |

**Sắp xếp:** do máy chủ quyết định, **không** nhận `sort`/`order` từ client — đúng lập luận ADR-005 ("thứ tự là luật nghiệp vụ, cho client đổi là mở đường cho kết quả không xác định"). Thứ tự cố định:
- `other-income`: `paymentDate DESC, createdAt DESC`
- `tax-calculation`: `loai_lao_dong, ho_ten`
- `income-categories`: `code ASC`
- `05-kk-tncn/periods`: `nam DESC, ky_so DESC`

### 0.5. Idempotency

Không dùng `Idempotency-Key`. Ba thao tác cần chống lặp đều đã có **ràng buộc CSDL tự nhiên**:

| Thao tác | Chống lặp bằng |
|---|---|
| Tạo bản ghi thu nhập ngoài lương | unique index `hrm_oir_chong_trung` ⇒ **409 `E-tkt-005`** (EC-tkt-07) |
| Chốt Bảng tính thuế tháng | `@@unique([periodId, module])` ⇒ **409 `E-tkt-018`** |
| Xuất tờ khai quý | `upsert` có điều kiện `trang_thai = READY_TO_EXPORT` ⇒ **409 `E-tkt-020`** |

### 0.6. Đối chiếu với 15 route nháp đã tồn tại

| Route nháp | Số phận | Lý do |
|---|---|---|
| `GET/POST/PUT/DELETE /to-khai-thue/other-income[/:id]` | **Giữ** (đổi payload) | Khớp FR-tkt-005…008 |
| `POST .../other-income/batch-apply` | **Bỏ** | Không FR nào yêu cầu. Ngữ nghĩa "xóa tất cả rồi tạo lại" của sub-cụm trước là nguồn mất dữ liệu im lặng (`api-contract-du-lieu-tinh-luong.md` Mục 0.4) — không nhân bản sang chứng từ thuế |
| `POST .../other-income/delete-all` | **Bỏ** | Xóa hàng loạt chứng từ thuế: không có FR, không có mã lỗi nào phủ |
| `POST .../other-income/delete-employee` | **Bỏ** | Như trên |
| `GET .../tax-calculation` | **Giữ** | FR-tkt-009/010 |
| `PUT/DELETE .../05-kk-tncn/ghi-de` | **Giữ** (đổi đường dẫn sang `/overrides`) | FR-tkt-016 |
| `POST .../05-kk-tncn/chot`, `.../mo-khoa` | **Đổi nghĩa** | "Chốt/mở khóa **tờ khai**" không khớp vòng đời BR-tkt-015. Thay bằng `export` + `mark-submitted`; việc chốt/mở là của **Bảng tính thuế tháng**, không phải tờ khai |
| `GET .../05-kk-tncn/export-xml` | **Bỏ** | Không có trong FR-tkt-014 (chỉ Excel + PDF) — BA đã quyết định bỏ hẳn XML tại Final Sign-off 2026-09-14 (data-model P-13) |
| — | **Thêm mới** | Danh mục (5) · preview (1) · chốt/mở tháng (2) · xuất + bảng chi tiết + lịch sử kỳ + đánh dấu nộp (4) · chính sách thuế (1) |

> **Đã thực hiện 2026-09-15 (bước 7):** file route chỉ còn 23 endpoint của hợp đồng; 8 route nháp (`batch-apply`, `delete-all`, `delete-employee`, `ghi-de` ×2, `chot`, `mo-khoa`, `export-xml`) đã bỏ. Mã nháp phía máy chủ không commit mà cất vào git stash. Giao diện nháp (`hdđt_maxv`) vẫn gọi các route đã bỏ — sửa khi bật lại frontend.

---

## 1. Bảng tổng hợp 22 endpoint

| # | Method | Path (sau `/api/v1/hrm`) | Quyền | FR |
|:--:|:---|:---|:---:|:---|
| 1 | `GET` | `/to-khai-thue/income-categories` | Lương | FR-tkt-002 |
| 2 | `GET` | `/to-khai-thue/income-categories/:id` | Lương | FR-tkt-002 |
| 3 | `POST` | `/to-khai-thue/income-categories` | Lương | FR-tkt-001 |
| 4 | `PUT` | `/to-khai-thue/income-categories/:id` | Lương | FR-tkt-003/004 |
| 5 | `DELETE` | `/to-khai-thue/income-categories/:id` | Lương | FR-tkt-004 |
| 6 | `GET` | `/to-khai-thue/other-income` | Lương | FR-tkt-008 |
| 7 | `GET` | `/to-khai-thue/other-income/:id` | Lương | FR-tkt-008 |
| 8 | `POST` | `/to-khai-thue/other-income/preview` | Lương | FR-tkt-005 |
| 9 | `POST` | `/to-khai-thue/other-income` | Lương | FR-tkt-005 |
| 10 | `PUT` | `/to-khai-thue/other-income/:id` | Lương | FR-tkt-006 |
| 11 | `DELETE` | `/to-khai-thue/other-income/:id` | Lương | FR-tkt-007 |
| 12 | `GET` | `/to-khai-thue/tax-calculation` | Lương | FR-tkt-009/010 |
| 13 | `POST` | `/to-khai-thue/tax-calculation/lock` | Lương | FR-tkt-011 |
| 14 | `POST` | `/to-khai-thue/tax-calculation/unlock` | **A/O** | FR-tkt-012 |
| 15 | `GET` | `/to-khai-thue/05-kk-tncn` | Lương | FR-tkt-013 |
| 16 | `GET` | `/to-khai-thue/05-kk-tncn/periods` | Lương | FR-tkt-018 |
| 17 | `PUT` | `/to-khai-thue/05-kk-tncn/overrides` | Lương | FR-tkt-016 |
| 18 | `DELETE` | `/to-khai-thue/05-kk-tncn/overrides` | Lương | FR-tkt-016 |
| 19 | `POST` | `/to-khai-thue/05-kk-tncn/export` | **A/O** | FR-tkt-014 |
| 20 | `GET` | `/to-khai-thue/05-kk-tncn/detail-sheet` | Lương | FR-tkt-015 |
| 21 | `POST` | `/to-khai-thue/05-kk-tncn/mark-submitted` | **A/O** | FR-tkt-017 |
| 22 | `GET` | `/to-khai-thue/tax-policies` | Lương | hạ tầng (ADR-012) |
| 23 | `GET` | `/to-khai-thue/05-kk-tncn/file` | **A/O** | FR-tkt-014 — tải lại file đã xuất (Mục 5.8, thêm 2026-09-15) |

> **Về #22:** chỉ **đọc** danh sách chính sách thuế theo mốc hiệu lực (để màn Bảng tính thuế hiển thị "đang áp biểu nào"). Việc **ghi** chính sách thuế đi qua màn **Cài đặt chung** đã có (`FR-hrm-045/046/047`) sau bước M-3 của lộ trình di trú. Sub-cụm này **không** mở endpoint ghi, tránh hai cửa ghi vào cùng một bảng cấu hình.

---

## 2. Danh mục loại thu nhập ngoài lương (5 endpoint)

### 2.1. `GET /to-khai-thue/income-categories`

| | |
|---|---|
| **Quyền** | Quyền xem dữ liệu lương |
| **Query** | `taxTreatmentGroup?` (1 trong 4 enum) · `status?` (`ACTIVE`/`INACTIVE`) · `q?` (tìm theo `code`/`name`, `contains` + `mode: 'insensitive'`) |
| **200** | `{ success: true, data: OtherIncomeCategoryDto[] }` |

```ts
interface OtherIncomeCategoryDto {
  id: string;
  code: string;                       // TN01..TN99
  name: string;
  taxTreatmentGroup: 'EXEMPT_FULL' | 'EXEMPT_CAPPED' | 'TAXABLE_FULL' | 'WITHHOLDING_FLAT';
  exemptCapAmount: number | null;
  exemptCapPeriod: 'MONTHLY' | 'YEARLY' | null;
  withholdingRate: number | null;
  withholdingThreshold: number | null;
  legalBasisNote: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  appliesToInternalOnly: boolean;     // TÍNH LÚC ĐỌC: taxTreatmentGroup !== 'WITHHOLDING_FLAT'
  usageCount: number;                 // số OtherIncomeRecord đang dùng — FE ẩn nút Xóa khi > 0
  createdAt: string; updatedAt: string;
}
```

> **`usageCount` trả sẵn** để FE không phải đoán rồi bấm Xóa và ăn 400 (BR-tkt-004). Tính bằng `_count.records`, một lượt truy vấn, không phải N+1.
>
> **Tự sinh danh mục lần đầu (AC-tkt-003):** bảng rỗng ⇒ endpoint này **tự seed 12 danh mục** (data-model Mục 7.2) rồi mới trả về — cùng khuôn self-healing `BR-hrm-070`. `GET` có tác dụng phụ ghi; ghi rõ ở đây để QA không coi là lỗi.

### 2.2. `GET /to-khai-thue/income-categories/:id`

`200` `OtherIncomeCategoryDto` · `404` `E-tkt-016`.

### 2.3. `POST /to-khai-thue/income-categories`

```ts
interface CreateIncomeCategoryBody {
  code?: string;              // bỏ trống => tự sinh TN01..TN99 quét khe trống (ADR-001)
  name: string;               // 1..200, bắt buộc
  taxTreatmentGroup: OtherIncomeTaxGroup;   // bắt buộc
  exemptCapAmount?: number;   // BẮT BUỘC khi group = EXEMPT_CAPPED
  exemptCapPeriod?: 'MONTHLY' | 'YEARLY';   // mặc định MONTHLY khi có exemptCapAmount
  withholdingRate?: number;       // group = WITHHOLDING_FLAT, bỏ trống => 10.0     (AC-tkt-002)
  withholdingThreshold?: number;  // group = WITHHOLDING_FLAT, bỏ trống => 5000000  (AC-tkt-002)
  legalBasisNote?: string;    // <= 500
  status?: 'ACTIVE' | 'INACTIVE';  // mặc định ACTIVE
}
```

| Kiểm | Lỗi |
|---|---|
| `code` hoặc `lower(btrim(name))` đã tồn tại | **400 `E-tkt-001`** (BR-tkt-003 · AC-tkt-004) |
| `group = EXEMPT_CAPPED` mà thiếu `exemptCapAmount` | **400 `E-tkt-003`** (AC-tkt-001) |
| `group ∈ {EXEMPT_FULL, TAXABLE_FULL}` mà **có** `exemptCapAmount`/`withholdingRate`/`withholdingThreshold` | **400 `E-tkt-003`** — tham số thừa gây hiểu nhầm; từ chối thay vì lặng lẽ bỏ qua |
| `withholdingRate` ngoài `0..100`; `exemptCapAmount`/`withholdingThreshold` < 0 | **400 `E-tkt-003`** |

**201** `{ success: true, data: OtherIncomeCategoryDto }` — giữ **201 cho mọi POST** theo ADR-005 Mục 1 (QA sửa kỳ vọng, không phải backend hạ xuống 200).

### 2.4. `PUT /to-khai-thue/income-categories/:id`

Body như 2.3 nhưng **không nhận `code`** (FR-tkt-003: "sửa danh mục, trừ mã"). Nhận `status` ⇒ đây cũng là đường chuyển `INACTIVE` (FR-tkt-004). Kiểm lại toàn bộ BR-tkt-003.

`200` DTO · `400 E-tkt-001/003` · `404 E-tkt-016`.

> **Sửa danh mục KHÔNG hồi tố** số thuế của bản ghi cũ (ADR-013). Phản hồi kèm `affectedRecordsCount: number` để FE hiện cảnh báo: *"Thay đổi chỉ áp dụng cho khoản chi trả nhập MỚI. {n} khoản đã ghi giữ nguyên cách tính cũ."*

### 2.5. `DELETE /to-khai-thue/income-categories/:id`

`204` (xóa cứng, chỉ khi `usageCount = 0`) · **400 `E-tkt-002`** kèm `message` gợi ý chuyển `INACTIVE` (AC-tkt-005) · `404 E-tkt-016`.

---

## 3. Thu nhập ngoài lương (6 endpoint)

### 3.1. `GET /to-khai-thue/other-income`

| | |
|---|---|
| **Query** | `periodId` **bắt buộc** · `maNv?` · `taxDeductionType?` · `taxTreatmentGroup?` · `isResident?` (bool) · `q?` (họ tên/MST/CCCD) · `limit?` · `offset?` |
| **Header trả** | `X-Total-Count` |

```ts
interface OtherIncomeListResponse {
  records: OtherIncomeRecordDto[];
  summary: {                 // FR-tkt-008 — 4 chỉ số, tính trên TOÀN BỘ bộ lọc, KHÔNG chỉ trang hiện tại
    totalRecords: number; totalGross: number; totalTax: number; totalNet: number;
  };
  periodLocked: boolean;     // true khi kỳ đã có khóa TAX_SHEET hoặc OTHER_INCOME
                             // => FE khóa nút Thêm/Sửa/Xóa
}

interface OtherIncomeRecordDto {
  id: string; periodId: string; ma_nv: string | null;
  otherIncomeCategoryId: string;
  category: { id: string; code: string; name: string; taxTreatmentGroup: OtherIncomeTaxGroup };
  fullName: string; taxCode: string | null; idCardNumber: string | null;
  address: string | null; phone: string | null; email: string | null;
  isResident: boolean;
  paymentDate: string;       // YYYY-MM-DD
  paymentType: 'GROSS' | 'NET';
  // SNAPSHOT — cách tính tại thời điểm ghi, KHÔNG đọc lại danh mục (ADR-013)
  taxTreatmentGroup: OtherIncomeTaxGroup;
  grossAmount: number; netAmount: number;
  exemptAmount: number;      // phần miễn
  taxableAmount: number;     // phần cộng lũy tiến vào Bảng tính thuế
  taxDeductionType: TaxDeductionType;
  taxRate: number; taxDeducted: number;
  hasCommitment08: boolean; forceWithholding: boolean;
  eWithholdingCertNo: string | null; eWithholdingCertDate: string | null;
  note: string | null;
  createdAt: string; updatedAt: string;
}
```

> `summary` tính trên **toàn bộ** bộ lọc chứ không phải trang đang xem — nếu không, kế toán lật trang thấy tổng nhảy và không tin được con số nào nữa.
>
> `category` (đối tượng lồng) là **giá trị hiện tại** của danh mục; `taxTreatmentGroup` ở cấp bản ghi là **giá trị snapshot**. Hai trường này **có thể khác nhau** sau khi danh mục bị sửa — đó là đúng thiết kế, FE hiển thị theo snapshot.

### 3.2. `GET /to-khai-thue/other-income/:id`

`200` `OtherIncomeRecordDto` · `404 E-tkt-016`.

### 3.3. `POST /to-khai-thue/other-income/preview` `[MỚI]`

Tính thử BR-tkt-007/008 **không ghi gì**. Body = `CreateOtherIncomeBody` (3.4) nhưng `periodId` tùy chọn.

```ts
interface OtherIncomePreviewDto {
  taxTreatmentGroup: OtherIncomeTaxGroup;
  grossAmount: number; netAmount: number;
  exemptAmount: number; taxableAmount: number;
  taxDeductionType: TaxDeductionType; taxRate: number; taxDeducted: number;
  explain: string;   // vd "Vượt ngưỡng 5.000.000đ/lần => khấu trừ 10% tại nguồn"
                     //    "Có Cam kết 08/CK-TNCN => tạm không khấu trừ"
                     //    "Miễn 1.200.000đ theo trần tháng, 300.000đ còn lại cộng vào thu nhập chịu thuế"
}
```

**Vì sao endpoint này bắt buộc phải có:** `ThuNhapNgoaiLuongDialog.tsx` hiện **hardcode ngưỡng 2.000.000** ở FE (SRS Mục 14 điểm 1) — tức công thức thuế đang nằm ở **hai nơi**. `NFR-tkt-004` cấm điều đó. Preview đẩy toàn bộ công thức về máy chủ; FE chỉ hiển thị kết quả. Sau khi nối API, FE **phải xóa** mọi phép tính thuế cục bộ, kể cả ngưỡng.

### 3.4. `POST /to-khai-thue/other-income`

```ts
interface CreateOtherIncomeBody {
  periodId: string;                 // bắt buộc
  otherIncomeCategoryId: string;    // bắt buộc, danh mục phải ACTIVE
  ma_nv?: string | null;            // null = cá nhân vãng lai
  fullName: string;                 // bắt buộc
  taxCode?: string; idCardNumber?: string; address?: string; phone?: string; email?: string;
  isResident?: boolean;             // mặc định true
  paymentDate: string;              // YYYY-MM-DD, phải nằm trong tháng của periodId
  paymentType?: 'GROSS' | 'NET';    // mặc định GROSS
  amount: number;                   // > 0 — số tiền NHẬP VÀO, hiểu theo paymentType
  hasCommitment08?: boolean;
  forceWithholding?: boolean;       // BR-tkt-008, đã duyệt tại BA Final Sign-off 2026-09-14
  eWithholdingCertNo?: string; eWithholdingCertDate?: string;
  note?: string;
}
```

> ⚠️ Trường nhập là **`amount`**, không phải `grossAmount`/`netAmount`. Payload nháp hiện cho gửi cả hai (`CreateOtherIncomePayload`, `types/toKhaiThue.ts:66-67`) — sai, vì chỉ **một** trong hai là số kế toán gõ, số còn lại do công thức BR-tkt-007 suy ra. Cho gửi cả hai là mở đường cho client gửi cặp số không khớp nhau mà server không biết tin cái nào.

**Thứ tự kiểm (mã lỗi trả về theo đúng thứ tự này):**

| # | Kiểm | Lỗi |
|---|---|---|
| 1 | Kỳ đã có khóa `TAX_SHEET` hoặc `OTHER_INCOME` | **403 `E-tkt-007`** |
| 2 | Thiếu `fullName` / `paymentDate` / `otherIncomeCategoryId`; `amount ≤ 0`; `paymentDate` ngoài tháng của kỳ | **400 `E-tkt-004`** (AC-tkt-006) |
| 3 | Danh mục không tồn tại hoặc `INACTIVE` | **400 `E-tkt-003`** |
| 4 | Nhóm ≠ `WITHHOLDING_FLAT` mà `ma_nv` null | **400 `E-tkt-021`** (BR-tkt-009 · AC-tkt-015 — mã do BA duyệt bổ sung 2026-09-14) |
| 5 | `hasCommitment08 = true` mà thiếu `taxCode` / `isResident = false` / nhóm ≠ `WITHHOLDING_FLAT` | **400 `E-tkt-006`** (AC-tkt-014 — ngữ nghĩa mở rộng, BA duyệt 2026-09-14) |
| 6 | Vi phạm unique `hrm_oir_chong_trung` (`P2002`) | **409 `E-tkt-005`** (AC-tkt-007) |

**201** `{ success: true, data: OtherIncomeRecordDto }`.

### 3.5. `PUT /to-khai-thue/other-income/:id`

Body như 3.4 nhưng **không nhận `periodId`** — không cho chuyển kỳ. (Đổi kỳ làm sai **cả hai** tháng: tháng cũ mất số, tháng mới thừa số, và nếu một trong hai đã chốt thì không còn đường sửa. Muốn đổi kỳ thì xóa và tạo lại.)

Tính lại toàn bộ snapshot theo danh mục **hiện tại**. Cùng bộ lỗi 3.4 + `404 E-tkt-016`. `200` DTO.

### 3.6. `DELETE /to-khai-thue/other-income/:id`

`204` · **403 `E-tkt-007`** khi kỳ đã chốt (AC-tkt-019) · `404 E-tkt-016`.

---

## 4. Bảng tính thuế tháng (3 endpoint)

### 4.1. `GET /to-khai-thue/tax-calculation`

| | |
|---|---|
| **Query** | `periodId` **bắt buộc** · `loaiLaoDong?` · `cuTru?` (bool) · `q?` |

```ts
interface BangTinhThueTongHopDto {
  periodId: string; periodName: string; month: number; year: number;
  payrollPeriodStatus: 'DRAFT'|'PENDING_REVIEW'|'LOCKED'|'APPROVED'|'PAID'|'ARCHIVED';
  trangThai: 'NHAP' | 'DA_CHOT';         // = có dòng khóa TAX_SHEET hay không
  chotBoi: string | null; chotBoiTen: string | null; chotLuc: string | null;
  coTheChot: boolean;                     // payrollPeriodStatus >= LOCKED && trangThai = NHAP
  coTheMoLai: boolean;                    // trangThai = DA_CHOT && quý chứa tháng chưa EXPORTED
  bieuThueApDung: {                       // ADR-012 — minh bạch biểu nào đang dùng
    taxPolicyId: string; effectiveFrom: string;
    personalDeduction: number; dependentDeduction: number;
    taxBrackets: { khoang: number; thueSuat: number }[];
  };
  kpi: { tongNguoiLaoDong: number; tongThuNhapChiuThue: number;
         tongGiamTruGiaCanh: number; tongThueTncn: number };
  danhSach: DongBangTinhThueDto[];        // 25 trường (gồm id + thu_nhap_khau_tru_rieng), khớp data-model Mục 3.4
}
```

`DongBangTinhThueDto` = đúng các cột của `hrm_tax_calculation_lines` (bỏ `periodId`/`taxPolicyId`/`engineVersion`/`lockedByUserId`/`lockedAt`/`createdAt`), giữ **nguyên tên Vietnamese-snake** khớp `types/toKhaiThue.ts:77-104`.

- **`id` = `recipientKey`** (không phải uuid của dòng snapshot — uuid đó đổi mỗi lần chốt lại): ổn định cả khi tháng chuyển Nháp sang Đã chốt, nên giao diện giữ được dòng đang chọn. `[làm rõ 2026-09-15]`
- **`thu_nhap_khau_tru_rieng`** `[MỚI 2026-09-15 — quyết định tách 2 phần]`: phần thu nhập đã khấu trừ riêng, nằm trong `thu_nhap_ngoai` nhưng không vào nền lũy tiến. `types/toKhaiThue.ts` phía giao diện **chưa có** trường này.

**Hai nguồn dữ liệu, một hình dạng phản hồi:**

| `trangThai` | Nguồn | Ghi chú |
|---|---|---|
| `NHAP` | tính trực tiếp: `calculatePayrollPreview()` + `hrm_other_income_records` | Số **đổi** mỗi lần gọi nếu dữ liệu lương/thu nhập ngoài lương đổi |
| `DA_CHOT` | đọc thẳng `hrm_tax_calculation_lines` | **Không** tính lại — số pháp lý đã chốt |

> Đây đúng khuôn `GET /payroll/sheet-lines` đã có (`payrollCalculation.service.ts:340-348`). **Khác một điểm quan trọng:** sub-cụm trước để lọt lỗi kiểu dữ liệu giữa hai nhánh (number vs chuỗi) — ở đây **cả hai nhánh đều trả `number`** (Mục 0.3).
>
> `q`/`loaiLaoDong`/`cuTru` lọc **sau** khi tính; `kpi` tính trên **toàn bộ kỳ**, không theo bộ lọc (nếu không, người dùng lọc một phòng ban rồi tưởng đó là tổng thuế cả công ty).

`400 E-tkt-017` khi `periodId` không tồn tại trong tenant.

### 4.2. `POST /to-khai-thue/tax-calculation/lock` — Chốt tháng (FR-tkt-011)

**Body** `{ periodId: string }` · **Quyền** quyền xem dữ liệu lương.

```
1. payrollPeriodStatus < LOCKED                      -> 400 E-tkt-008   (AC-tkt-018)
2. đã có khóa TAX_SHEET                              -> 409 E-tkt-018
3. [TRANSACTION]
     policy = resolveTaxPolicy(db, period.startDate)         // 500 E-tkt-015 nếu không có
     tính toàn bộ dòng (lương + thu nhập ngoài lương)
     deleteMany hrm_tax_calculation_lines WHERE periodId
     createMany hrm_tax_calculation_lines (gắn taxPolicyId, lockedByUserId, lockedAt)
     create     hrm_payroll_module_locks { periodId, module: 'TAX_SHEET', lockedByUserId }
4. ghiNhatKyKyLuong(req, 'TAX_SHEET_LOCKED', periodId, { soDong })   -- NGOÀI transaction
```

**200** `{ success: true, data: { periodId, trangThai: 'DA_CHOT', soDong: number, chotLuc: string, taxPolicyId: string } }`

> Sau khi chốt: mọi thao tác ghi lên `hrm_other_income_records` của kỳ đó bị chặn **403 `E-tkt-007`** (AC-tkt-019).

### 4.3. `POST /to-khai-thue/tax-calculation/unlock` — Mở lại (FR-tkt-012)

**Body** `{ periodId: string, lyDo: string }` (`lyDo` ≥ 20 ký tự — cùng chuẩn `reopen` kỳ lương, `payrollPeriods.service.ts:207`; thiếu hoặc ngắn hơn ⇒ **400 `E-tkt-011`** — mã gần nghĩa nhất trong 21 mã, backend chọn 2026-09-15, chờ Architect xác nhận) · **Quyền `assertAdminOrOwner`**.

```
1. chưa có khóa TAX_SHEET                            -> 409 E-tkt-018   (status theo Mục 7; "400" cũ ở dòng này là lỗi chép)
2. quý chứa tháng có tờ khai đã xuất (EXPORTED | SUBMITTED)
                                                     -> 403 E-tkt-009  (AC-tkt-021)
   (tới bước 6 di trú trạng thái: giá trị nháp cũ `chot` tính như đã xuất, `nhap` như chưa xuất)
3. [TRANSACTION] delete khóa TAX_SHEET; deleteMany dòng bảng tính thuế của kỳ;
     NẾU quý chứa tháng đó đang READY_TO_EXPORT -> xóa luôn dòng hrm_to_khai_tncn05
     (BR-tkt-013 sửa 2026-09-14 — tránh dữ liệu treo sai trạng thái, xem GAP-QA-tkt-06)
4. ghiNhatKyKyLuong(req, 'TAX_SHEET_UNLOCKED', periodId, { lyDo })
```

**200** `{ periodId, trangThai: 'NHAP' }` (AC-tkt-020).

⚠️ Thao tác này **xóa** dữ liệu snapshot đã chốt và không hoàn tác được — FE phải hiện hộp xác nhận nêu rõ, và bắt nhập lý do.

---

## 5. Tờ khai thuế TNCN quý (7 endpoint)

### 5.1. `GET /to-khai-thue/05-kk-tncn`

**Query** `nam` **bắt buộc** · `quy` **bắt buộc** (1..4).

```ts
interface ToKhaiTncn05Dto {
  nam: number; quy: number;                  // ky_loai luôn 'quy' (BR-tkt-016)
  trangThai: 'CHUA_SAN_SANG' | 'READY_TO_EXPORT' | 'EXPORTED' | 'SUBMITTED';
  cacThang: { month: number; periodId: string | null;
              daChot: boolean; payrollStatus: string | null }[];   // 3 dòng — BR-tkt-014
  thongTinNguoiNopThue: {                     // MỚI 2026-09-14 — BA duyệt bổ sung, xem FR-tkt-014
    maSoThue: string; ten: string; diaChi: string;
    coQuanThueQuanLy: string; nguoiKy: string | null;
  };                                          // đọc từ maxv2_sys.don_vi (control-plane)
  ct: ChiTieuTncn05Map | null;        // bộ CUỐI (đã áp ghi đè) — null khi CHUA_SAN_SANG
  ctMay: ChiTieuTncn05Map | null;     // số máy tự tính
  ghiDe: Record<string, { gia: number; lyDo: string }>;
  canhBao: string[];
  ctGocSuaDuoc: string[];             // 13 mã — FE KHÔNG hardcode danh sách này
  tinhLuc: string | null;
  xuatBoi: string | null; xuatBoiTen: string | null; xuatLuc: string | null;
  nopBoi: string | null;  nopBoiTen: string | null;  nopLuc: string | null;
  nguoiKy: string | null; ngayKy: string | null;
}
```

| Tình huống | Hành vi |
|---|---|
| Chưa đủ 3 tháng chốt | `trangThai: 'CHUA_SAN_SANG'`, `ct`/`ctMay` = `null`, `cacThang` chỉ rõ tháng nào còn thiếu. **Không** tạo dòng CSDL (AC-tkt-022) |
| Đủ 3 tháng, chưa có dòng | **Tự tạo** dòng `READY_TO_EXPORT` + tính `ct_may` (FR-tkt-013 — "không cần thao tác thủ công để tạo tờ khai") |
| Đã có dòng, `READY_TO_EXPORT` | **Tính lại** `ct_may` mỗi lần đọc (dữ liệu tháng có thể vừa đổi do Mở lại rồi Chốt lại), hợp nhất `ghi_de` ⇒ `ct` |
| `EXPORTED` / `SUBMITTED` | **Đọc nguyên** `ct`/`ct_may` đã lưu, **không** tính lại — tờ khai đã xuất là bất biến |

> `GET` có tác dụng phụ ghi (tạo dòng / cập nhật `ct_may`) — cùng bản chất self-healing với 2.1. Ghi rõ để QA không coi là lỗi.
>
> `ctGocSuaDuoc` trả từ hằng số `CT_GOC_SUA_DUOC` của BE để FE **không** giữ bản sao thứ hai của danh sách 13 chỉ tiêu (`O_SUA_DUOC_TNCN05` hiện đang hardcode ở FE).
>
> `thongTinNguoiNopThue` đọc chéo `maxv2_sys.don_vi` — khác mọi trường còn lại của DTO này (nguồn DB tenant). Danh sách trường chính xác để Backend Engineer đối chiếu khi code (BA Final Sign-off 2026-09-14, data-model P-11).
>
> **Ghi nhận khi code (2026-09-15):** `coQuanThueQuanLy` hiện **luôn là chuỗi rỗng** — `don_vi` chưa có cột này (tờ khai GTGT cũng để trống); cần bổ sung nơi lưu ở đợt sau. `nam`/`quy` sai kiểu/khoảng, hoặc gửi `kyLoai` khác `'quy'` ⇒ **400 `E-tkt-017`** (TC-tkt-082).

### 5.2. `GET /to-khai-thue/05-kk-tncn/periods` (FR-tkt-018)

**Query** `nam?` (bỏ trống = toàn bộ).

`200` mảng `{ nam, quy, trangThai, ct16, ct21, ct29, xuatBoi, xuatBoiTen, xuatLuc, nopBoi, nopBoiTen, nopLuc }` — ba chỉ tiêu đọc từ **cột bóc tách**, không quét JSONB.

### 5.3. `PUT /to-khai-thue/05-kk-tncn/overrides` (FR-tkt-016)

```ts
interface PutOverridesBody {
  nam: number; quy: number;
  overrides: Record<string, { gia: number; lyDo: string }>;  // vd { ct22: { gia: 480000000, lyDo: "…" } }
}
```

| Kiểm | Lỗi |
|---|---|
| `lyDo` rỗng hoặc < 10 ký tự | **400 `E-tkt-011`** (AC-tkt-026) |
| Mã chỉ tiêu **không** thuộc 13 mã `CT_GOC_SUA_DUOC` — gồm `ct18`, `ct21`, `ct26`, `ct29` | **400 `E-tkt-012`** (AC-tkt-027) |
| Mã không thuộc `ct16..ct32`; `gia < 0`; `ct16`–`ct20` không phải số nguyên | **400 `E-tkt-012`** |
| `trangThai` ≠ `READY_TO_EXPORT` | **403 `E-tkt-019`** — tờ khai đã xuất thì không sửa (EC-tkt-03) |
| Quý chưa đủ 3 tháng chốt (chưa có tờ khai để ghi đè) | **400 `E-tkt-010`** `[bổ sung khi code 2026-09-15]` |

**200** `ToKhaiTncn05Dto` với `ct` đã tính lại: 4 chỉ tiêu tổng hợp **luôn** suy lại từ chỉ tiêu con (`ct18=ct19+ct20`, `ct21=ct22+ct23`, `ct26=ct27+ct28`, `ct29=ct30+ct31`) — AC-tkt-025.

### 5.4. `DELETE /to-khai-thue/05-kk-tncn/overrides`

**Query** `nam` · `quy` · `ct?` (bỏ trống = xóa **toàn bộ** ghi đè của kỳ).

`200` DTO đã tính lại · `403 E-tkt-019` khi đã xuất.

### 5.5. `POST /to-khai-thue/05-kk-tncn/export` (FR-tkt-014) — **ADMIN/OWNER**

**Body** `{ nam, quy, format: 'excel' | 'pdf', nguoiKy?: string, ngayKy?: string }`

```
1. chưa đủ 3 tháng chốt                    -> 400 E-tkt-010          (AC-tkt-022)
2. trangThai = EXPORTED | SUBMITTED        -> 409 E-tkt-020
3. [TRANSACTION] tính ct_may -> hợp nhất ghi_de -> ct;
     update trang_thai='EXPORTED', khoa_so_boi, khoa_so_luc,
            ct16/ct21/ct29 (cột bóc tách), canh_bao, nguoi_ky, ngay_ky
4. [NGOÀI TRANSACTION] kết xuất file Excel/PDF (KHÔNG có XML — BA quyết định 2026-09-14)
```

**200** — thân là **file nhị phân** (không bọc envelope), theo đúng quy ước truyền file của **ADR-005 Mục 3**:

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | application/pdf
Content-Disposition: attachment; filename*=UTF-8''05-KK-TNCN_Quy{q}_{nam}.xlsx
Cache-Control: no-store, private
X-Content-Type-Options: nosniff
```

⚠️ **Hệ quả không đảo ngược:** sau khi 200, cả 3 tháng trong quý **vĩnh viễn không Mở lại được** (BR-tkt-015 · AC-tkt-023 · endpoint 14 sẽ luôn trả 403 `E-tkt-009`). FE **phải** hiện hộp xác nhận nêu rõ điều này trước khi gọi.

⚠️ **Kết xuất PDF chạy Puppeteer — tuyệt đối không đặt trong transaction.** Render mất vài giây sẽ giữ khóa hàng trên bảng tờ khai suốt thời gian đó.

⚠️ **Lỗi kết xuất xảy ra SAU khi transaction commit** ⇒ trạng thái đã là `EXPORTED` nhưng người dùng chưa có file. Xử lý: trả **500** kèm `message` nói rõ tờ khai đã sang Đã xuất và hướng dẫn tải lại file bằng **`GET /05-kk-tncn/file` (Mục 5.8)** — `detail-sheet` là bảng chi tiết nhân viên, không phải mẫu tờ khai. **Không** rollback trạng thái — rollback sẽ mở lại khóa 3 tháng mà số liệu đã được chốt sang bộ `ct` chính thức.

### 5.6. `GET /to-khai-thue/05-kk-tncn/detail-sheet` (FR-tkt-015)

**Query** `nam` · `quy` · `format` (`excel` | `json`).

Bảng chi tiết **từng nhân viên nội bộ** — không phải mẫu chính thức, phục vụ đối chiếu và chuẩn bị dữ liệu cho quyết toán năm sau. Nguồn: `hrm_tax_calculation_lines` của 3 tháng trong quý, gộp theo `recipientKey`, cộng dồn các cột tiền.

- `format=json` ⇒ envelope thường `{ success: true, data: [...] }`.
- `format=excel` ⇒ file nhị phân như 5.5.

`400 E-tkt-010` khi chưa đủ 3 tháng chốt.

### 5.7. `POST /to-khai-thue/05-kk-tncn/mark-submitted` (FR-tkt-017) — **ADMIN/OWNER**

**Body** `{ nam, quy, nguoiKy?, ngayKy? }`

| Kiểm | Lỗi |
|---|---|
| `trangThai` ≠ `EXPORTED` | **400 `E-tkt-013`** (AC-tkt-028) |

**200** DTO với `trangThai: 'SUBMITTED'`, `nopBoi`, `nopLuc`.

> Thao tác **thủ công**, hệ thống **không** xác thực với cơ quan thuế (BR-tkt-015). `message` phản hồi phải nói rõ điều này để kế toán không hiểu nhầm là đã nộp thành công qua hệ thống.

### 5.8. `GET /to-khai-thue/05-kk-tncn/file` — Tải lại file tờ khai đã xuất — **ADMIN/OWNER** `[MỚI — chủ dự án duyệt 2026-09-15, endpoint thứ 23]`

**Query** `nam` · `quy` · `format` (`excel` | `pdf`).

Dựng lại file từ bộ `ct` **đã lưu lúc xuất** — không tính lại, không đổi trạng thái. Lý do có endpoint: Mục 5.5 chỉ trả file đúng một lần (gọi lại ⇒ 409 `E-tkt-020`), nên tải lỗi hoặc mất file thì trước đây không còn đường lấy lại bản chính thức.

| Tình huống | Lỗi |
|---|---|
| Tờ khai chưa xuất (chưa có dòng, hoặc `READY_TO_EXPORT`) | **400 `E-tkt-013`** — thông điệp riêng: chỉ tải lại được tờ khai đã xuất |
| Hàng đợi dựng PDF đang đầy | **429** |

**200** — file nhị phân, cùng bộ header như Mục 5.5.

---

## 6. Chính sách thuế (1 endpoint, chỉ đọc)

### 6.1. `GET /to-khai-thue/tax-policies`

`200` mảng, sắp theo `effectiveFrom DESC`:

```ts
interface TaxPolicyDto {
  id: string; effectiveFrom: string;         // YYYY-MM-DD
  personalDeduction: number; dependentDeduction: number;
  taxBrackets: { khoang: number; thueSuat: number }[];
  withholdingTaxRate: number; withholdingTaxThreshold: number;
  voluntaryPensionMonthlyCap: number; lunchAllowanceTaxFreeCap: number;
  legalBasisNote: string | null;
  dangApDung: boolean;                       // true với dòng hiệu lực tại thời điểm hôm nay
}
```

> Ghi chính sách đi qua màn **Cài đặt chung** (`FR-hrm-045/046/047`) sau bước M-3 của lộ trình di trú (data-model Mục 6). Sub-cụm này **không** mở cửa ghi thứ hai vào bảng cấu hình.

---

## 7. Ma trận lỗi đầy đủ (21 mã)

| Mã | HTTP | Tình huống | Endpoint | BR/AC |
|---|:--:|---|---|---|
| `E-tkt-001` | 400 | Trùng `code` hoặc `lower(name)` danh mục | 3, 4 | BR-tkt-003 · AC-tkt-004 |
| `E-tkt-002` | 400 | Xóa danh mục đang có bản ghi sử dụng | 5 | BR-tkt-004 · AC-tkt-005 |
| `E-tkt-003` | 400 | Thiếu/thừa tham số ngưỡng-tỷ lệ theo nhóm; danh mục `INACTIVE` | 3, 4, 9, 10 | BR-tkt-003 · AC-tkt-001 |
| `E-tkt-004` | 400 | Thiếu họ tên / ngày chi trả / danh mục; `amount ≤ 0`; ngày ngoài tháng của kỳ | 8, 9, 10 | BR-tkt-005 · AC-tkt-006 |
| `E-tkt-005` | 409 | Trùng bản ghi (kỳ + người + loại + ngày + số tiền) | 9 | BR-tkt-006 · AC-tkt-007 |
| `E-tkt-006` | 400 | Cam kết 08 không hợp lệ (thiếu MST / không cư trú / danh mục sai nhóm) | 9, 10 | BR-tkt-008 · AC-tkt-014 |
| `E-tkt-007` | 403 | Thêm/sửa/xóa bản ghi khi tháng đã chốt | 9, 10, 11 | BR-tkt-013 · AC-tkt-019 |
| `E-tkt-008` | 400 | Chốt tháng khi kỳ lương gốc chưa `LOCKED` | 13 | AC-tkt-018 |
| `E-tkt-009` | 403 | Mở lại tháng khi quý đã xuất tờ khai | 14 | BR-tkt-013 · AC-tkt-021 |
| `E-tkt-010` | 400 | Xuất tờ khai / bảng chi tiết khi chưa đủ 3 tháng chốt | 19, 20 | BR-tkt-014 · AC-tkt-022 |
| `E-tkt-011` | 400 | Ghi đè chỉ tiêu thiếu lý do | 17 | BR-tkt-018 · AC-tkt-026 |
| `E-tkt-012` | 400 | Ghi đè chỉ tiêu không thuộc 13 chỉ tiêu gốc | 17 | BR-tkt-018 · AC-tkt-027 |
| `E-tkt-013` | 400 | Đánh dấu đã nộp khi chưa ở trạng thái Đã xuất | 21 | BR-tkt-015 · AC-tkt-028 |
| `E-tkt-014` | 403 | Không đủ quyền (quyền lương hoặc ADMIN/OWNER) | mọi | A-tkt-08 |
| `E-tkt-015` | 500 | Không tìm thấy chính sách thuế hiệu lực cho kỳ | 12, 13 | Đã duyệt vào SRS 2026-09-14 |
| `E-tkt-016` | 404 | Không tìm thấy bản ghi/danh mục theo `id` | 2, 4, 5, 7, 10, 11 | Đã duyệt vào SRS 2026-09-14 |
| `E-tkt-017` | 400 | `periodId` không tồn tại trong tenant | 6, 12, 13, 14 | Đã duyệt vào SRS 2026-09-14 |
| `E-tkt-018` | 409 | Chốt tháng đã chốt / mở tháng chưa chốt | 13, 14 | Đã duyệt vào SRS 2026-09-14 |
| `E-tkt-019` | 403 | Sửa/xóa ghi đè khi tờ khai đã xuất | 17, 18 | Đã duyệt vào SRS 2026-09-14 (EC-tkt-03) |
| `E-tkt-020` | 409 | Xuất lại tờ khai đã xuất | 19 | Đã duyệt vào SRS 2026-09-14 |
| `E-tkt-021` | 400 | Nhóm ≠ `WITHHOLDING_FLAT` mà `ma_nv` null | 9, 10 | Đã duyệt vào SRS 2026-09-14 (BR-tkt-009 · AC-tkt-015) |

---

## 8. Truy vết Yêu cầu chức năng → Endpoint

| FR | Endpoint | FR | Endpoint |
|---|---|---|---|
| FR-tkt-001 | 3 | FR-tkt-010 | 12 (`loaiLaoDong`, `cuTru`) |
| FR-tkt-002 | 1, 2 | FR-tkt-011 | 13 |
| FR-tkt-003 | 4 | FR-tkt-012 | 14 |
| FR-tkt-004 | 4 (`status`), 5 | FR-tkt-013 | 15 (tự tạo khi đủ điều kiện) |
| FR-tkt-005 | 8, 9 | FR-tkt-014 | 19 |
| FR-tkt-006 | 10 | FR-tkt-015 | 20 |
| FR-tkt-007 | 11 | FR-tkt-016 | 17, 18 |
| FR-tkt-008 | 6 | FR-tkt-017 | 21 |
| FR-tkt-009 | 12 | FR-tkt-018 | 16 |

**Phủ ngược:** 22/22 endpoint đều có FR tương ứng, trừ endpoint 22 (`GET /tax-policies`) là hạ tầng phục vụ ADR-012 (hiển thị biểu thuế đang áp) — không thuộc FR nào, ghi rõ để không bị coi là thừa.

---

## 9. Bàn giao Tester-QA — 8 điểm dễ trượt

1. **Mọi POST trả 201**, không phải 200 (ADR-005 Mục 1). Kỳ vọng test phải sửa theo, không phải backend hạ xuống 200.
2. **Cả 21 mã lỗi phải xuất hiện trong trường `code`** của phản hồi thật. Test khẳng định `body.code === 'E-tkt-xxx'`; **cấm** so khớp chuỗi tiếng Việt trong `message` — đó chính là lỗi đã mắc ở sub-cụm trước.
3. **Mọi trường tiền là `number`** ở cả hai nhánh (tháng chưa chốt / đã chốt). Bắt được một chuỗi `"12345678.00"` là **fail**.
4. **Endpoint 1 và 15 là `GET` nhưng có tác dụng phụ ghi** (tự seed danh mục / tự tạo dòng tờ khai). Test idempotency phải gọi 2 lần liên tiếp và khẳng định lần hai **không** nhân đôi dữ liệu.
5. **`AC-tkt-017` sẽ fail cho tới khi P-01 được xử lý** — `tinhThueLuyTien()` đang chạy biểu 7 bậc cũ (ra 700.000 thay vì 475.000). Ghi nhận là lỗi đã biết ở `issues-and-bugs.md`; **không** sửa production code chỉ để test pass.
6. **Ca đua bắt buộc test:** double-click endpoint 9 với payload y hệt ⇒ đúng 1 bản ghi + 1 lần 409 `E-tkt-005`; hai người cùng bấm endpoint 13 ⇒ 1 lần 200 + 1 lần 409 `E-tkt-018`.
7. **Sau endpoint 19 thì endpoint 14 phải luôn 403 `E-tkt-009`** cho **cả 3 tháng** của quý đó — không đảo ngược được. Test cả 3 tháng, không chỉ tháng cuối.
8. **Phân quyền:** với `OWNER_EMPLOYEE` **tắt** cờ `xemLuong` ⇒ cả 23 endpoint phải 403 `E-tkt-014`; với `OWNER_EMPLOYEE` **có** cờ `xemLuong` ⇒ đúng 4 endpoint (14, 19, 21, 23) phải 403 `E-tkt-014`, 19 endpoint còn lại không bị chặn quyền. *(Cập nhật 2026-09-15: thêm endpoint 23; ma trận này đã có ca kiểm HTTP giả lập ở backend — Phase B vẫn phải chạy trên DB thật.)*

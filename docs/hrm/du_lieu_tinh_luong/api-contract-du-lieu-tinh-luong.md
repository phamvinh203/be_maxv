---
type: api-contract
feature: hrm-du-lieu-tinh-luong
status: in-review
updated: 2026-09-09
author: system-architect
links:
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md
  - docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md
---

# HR — Hợp đồng API: Dữ liệu tính lương (Payroll Input Data API Contract)

Đặc tả **45 REST endpoint** của tính năng `du_lieu_tinh_luong` trong `be_maxv`, đối soát trực tiếp từ mã nguồn (route → controller → validator → service).

- **Base URL Prefix**: `/api/v1/hrm` — đăng ký tại `be_maxv/src/routes/index.route.ts:48`
- **Ứng dụng tiêu thụ**: `hdđt_maxv` (Kế toán & HĐĐT) — nhóm `/api/v1/*`. **KHÔNG** thuộc nhóm `maxv` `/api/v1/admin/*`.
- **Authentication**: Bearer JWT / cookie `accessToken` — hook chung `hrm.route.ts:35-39` (`app.authenticate` + `requireModule('hrm')`)
- **Multi-tenancy**: `resolveTenantDb(req)` ở đầu mọi controller — chọn database tenant theo `req.user.donViId`, client **không** truyền được tenant
- **Envelope**: `{ success: true, data: … }` (`helpers/response.ts:4-10`) — khớp `cai_dat_luong`

> **Trạng thái tài liệu:** đây là hợp đồng **mô tả đúng hành vi hiện tại của mã nguồn đã viết**, kèm cột đánh dấu chỗ hành vi **lệch với ý định nghiệp vụ** trong SRS. Chỗ nào lệch được ghi `⚠️` + mã phát hiện (`A-xx` trong `data-model-du-lieu-tinh-luong.md` Mục 6, hoặc `BR-dltl-xxx` trong SRS Mục 5). Backend Engineer **không** được coi phần `⚠️` là hợp đồng đã chốt.

---

## 0. Quy ước chung (đọc trước — 4 điểm dễ sai)

### 0.1. Phân quyền hiện tại — **chưa phân vai**

| Tầng | Có gì | Ghi chú |
|---|---|---|
| Xác thực | ✅ `app.authenticate` | `hrm.route.ts:37` |
| Module | ✅ `requireModule('hrm')` | `hrm.route.ts:38` |
| Vai trò (OWNER/ADMIN) | ❌ **Không có** trên bất kỳ endpoint nào trong 45 endpoint | ⚠️ `reopen`/`lock`/`approve` là hành vi thẩm quyền tài chính — xem SRS BR-dltl-002 và ADR-dltl-05 |
| Quyền xem lương (`xemLuong`) | ❌ **Không có** | ⚠️ **A-01 🔴** — `GET /payroll/calculate` trả lương gộp + thực lĩnh + thuế TNCN của toàn bộ nhân viên cho bất kỳ ai có module `hrm`, kể cả `OWNER_EMPLOYEE` bị tắt cờ `xemLuong`. Trái chính sách BR-hrm-059 / ADR-007 (`helpers/resolveTenantDb.ts:103-111`) |

### 0.2. Ba dạng lỗi khác nhau — client phải xử lý cả ba

| Dạng | Hình dạng response | Sinh ra ở | Có `code` máy đọc? |
|---|---|---|:---:|
| **PayrollError** | `{ success:false, code:"E-dltl-xxx", errorCode:"E-dltl-xxx", message }` | `errorHandler.plugin.ts:26-33` | ✅ |
| **ValidationError (Zod)** | `{ success:false, errors:[ …ZodIssue ] }` | `errorHandler.plugin.ts:34-38` | ❌ — mã `E-dltl-xxx` chỉ là chuỗi con trong `message` tiếng Việt của một issue |
| **Lỗi chung** | `{ success:false, message }` | `errorHandler.plugin.ts:39-63`, `:102-119` | ❌ |

**Chỉ 12/26 mã trả về dưới dạng PayrollError.** Đã quét toàn bộ điểm `throw`: **14 mã không bao giờ được ném** — `E-dltl-002`, `005`, `007`, `008`, `012`, `013`, `015`, `017`, `018`, `020`, `021`, `023` (chỉ nằm trong message Zod) và `024`, `026` (không có code path nào). Xem Mục 7.

### 0.3. ⚠️ Kiểu số tiền **đổi giữa chừng** — A-06 🟠

Prisma `Decimal` serialize ra JSON thành **chuỗi**. Hệ quả:

| Nguồn dữ liệu | `netTakeHomeSalary` trả về |
|---|---|
| `GET /payroll/calculate` (mọi trạng thái) | `12345678` — **number** (tính trong JS) |
| `GET /payroll/sheet-lines` khi kỳ `DRAFT`/`PENDING_REVIEW` | `12345678` — **number** (chuyển hướng sang preview, `payrollCalculation.service.ts:340-342`) |
| `GET /payroll/sheet-lines` khi kỳ `LOCKED`+ | `"12345678.00"` — **chuỗi** (đọc `PayrollSheetLine`, `:345-348`) |

Tương tự, mọi mảng `records[]` trong 8 endpoint `GET /payroll-data/*` trả cột `Decimal` dưới dạng **chuỗi** (`amount`, `hours`, `unitPrice`, `totalAmount`, `penaltyRate`…), trong khi các cột tổng do service tự tính (`totalAmount`, `totalHours`, `netAdjustment`, `donGia`, `tongTru`, `thanhTien`, `avgScore`) là **number**.

**Bắt buộc trước khi Frontend đấu dây:** chốt 1 trong 2 hướng — (a) serializer Decimal→number ở biên response, hoặc (b) khai "tiền là chuỗi" và FE luôn parse. **Đừng để nguyên trạng thái hiện tại.**

### 0.4. Ngữ nghĩa `apply` = **XÓA TẤT CẢ RỒI TẠO LẠI**

6 endpoint `POST /payroll-data/*/apply` đều theo khuôn: với **mỗi** nhân viên trong phạm vi, `deleteMany` toàn bộ bản ghi hiện có của (kỳ, nhân viên) rồi `createMany` từ `items` gửi lên.

- Client **phải gửi đủ toàn bộ danh sách dòng**, không phải phần thay đổi. Gửi thiếu ⇒ **mất dữ liệu, không cảnh báo**.
- `items: []` (mảng rỗng) là hợp lệ và có nghĩa **xóa sạch** cho các nhân viên trong phạm vi.
- Đây là `PUT`-semantics (thay thế) nhưng dùng verb `POST` — không đổi được nữa vì FE đã gọi; ghi rõ ở đây để không hiểu nhầm là `POST`-thêm-mới. Xem SRS `OQ-dltl-006`.

### 0.5. Cập nhật 2026-09-09 (Backend Engineer) — 8/9 lỗi 🔴 đã sửa, hợp đồng có thay đổi hành vi

> Ghi bởi backend-engineer sau khi sửa theo yêu cầu tường minh: "nếu 1 fix bắt buộc đổi contract,
> ghi rõ vào `api-contract-du-lieu-tinh-luong.md`". KHÔNG sửa lại nội dung Mục 0.1-0.4/1-7 phía
> trên (đó là đánh giá gốc của Architect tại thời điểm CHƯA sửa) — mục này chỉ ghi thêm phần THAY
> ĐỔI HÀNH VI so với những gì đã mô tả ở trên. Đầy đủ: `docs/hrm/review-findings.md` (bảng
> "Blocking kế thừa", cột "Trạng thái (2026-09-09)") + `docs/hrm/work-log.md`.

**Mục 0.1 (Phân quyền) — KHÔNG còn đúng, đã có cả 2 lớp:**
- **Quyền xem lương (`xemLuong`)**: cả 4 controller (`payrollPeriods`/`catalogs`/`payrollInputs`/
  `payrollCalculation`) nay đi qua `dbCoQuyenLuongPayroll()` — thiếu quyền → **403** (không `code`
  `E-dltl-*`, dùng chung message `MESSAGES.HRM.KHONG_CO_QUYEN_XEM_LUONG`, giống nhóm `/hop-dong`).
- **Vai trò (ADMIN/OWNER)**: 3 action `POST /payroll-periods/:id/{lock,reopen,approve}` nay có
  `preHandler: assertAdminOrOwner` — role khác `ADMIN`/`OWNER` (vd `OWNER_EMPLOYEE`) → **403**
  (`MESSAGES.HRM.CAN_QUYEN_ADMIN_HOAC_OWNER`). `submit`/`reject`/`mark-paid`/`archive`/CRUD kỳ vẫn
  CHỈ cần `requireModule('hrm')` — KHÔNG đổi.

**Mục 1.6 (Chuyển trạng thái) — cột "Lỗi khi sai trạng thái" bổ sung 403 mới cho (c)(d)(e):**
- `lock`/`reopen`/`approve`: thêm **403** `{ success:false, message:"Chỉ ADMIN hoặc OWNER..." }`
  (Zod-less, không `code`) TRƯỚC khi chạm tới logic chuyển trạng thái, nếu role không hợp lệ.
- `lock`: response `data.lockedByUserId` nay là **userId thật** của người gọi (trước đây luôn
  `null` do bug `(req.user as any)?.sub` — RVW-002). `approve` tương tự với `approvedByUserId`.
- `reopen`: **KHÔNG đổi response shape** (vẫn trả `PayrollPeriod` như cũ) — audit log (`reason` +
  `userId` + thời điểm) được ghi RA NGOÀI response, vào bảng `sys_log` control-plane qua
  `writeLog()`, không phải cột mới trên `PayrollPeriod`. Client không cần đổi gì để đọc audit log
  (không có endpoint đọc lại audit log trong đợt này — ngoài phạm vi).

**Mục 3.1 (Chấm công) — `PUT /payroll-data/attendance/cell` đổi hành vi tính `workDayValue`:**
- **Trước**: `workDayValue = (actualHours ?? 8.0) / 8.0`, không đọc `attendanceType`, không chặn
  trần → `actualHours=24` cho ra `workDayValue=3.00`.
- **Sau**: `attendanceType` QUYẾT ĐỊNH `workDayValue`. Với `lam_viec`/`nua_ngay`: server tính
  `actualHours / standardHoursPerDay` (đọc từ `GeneralSetting`, mặc định 8.0), và **CHẶN 400**
  `E-dltl-005` (nay là **PayrollError có `code`**, không còn Zod-message-only) nếu
  `actualHours > standardHoursPerDay`. Với 6 loại còn lại (`cong_tac`/`nghi_phep`/`nghi_le`/`om`/
  `khong_luong`/`khac`): server **bỏ qua** `actualHours` client gửi lên, tự gán hệ số cố định
  (1.0 công cho 3 loại đầu, 0 công cho 3 loại sau) — xem bảng `ATTENDANCE_FIXED_VALUE`.
  ⚠️ **Client cũ dựa vào việc tự tính `actualHours` cho các loại nghỉ cố định sẽ thấy giá trị lưu
  lại khác với giá trị gửi lên** (server ghi đè) — đây là SỬA ĐÚNG theo A-03, không phải lỗi mới.

**Mục 4.1 (`GET /payroll/calculate`) — số liệu trả về thay đổi (không đổi shape 29 trường):**
- `actualWorkDays`/`standardWorkDays`: không còn hằng 26 — đọc `standardWorkDays` từ
  `GeneralSetting.standardWorkingDaysMethod` (`FIXED_26`/`FIXED_24`/`ACTUAL_MONTH`, hàm mới
  `resolveStandardWorkDays()`). Công ty chưa đổi cấu hình vẫn ra 26 như cũ (mặc định `FIXED_26`).
- `actualWorkDays` với nhân viên có bản ghi chấm công: SỐ ĐÃ ĐÚNG theo mô hình delta (RVW-001) —
  trước đây có thể ra gần 0 khi chỉ có 1 bản ghi ngoại lệ, nay ra `standardWorkDays + Σ(workDayValue-1)`.
  **Đây là fix bug số tiền, không phải thay đổi ý định thiết kế.**
- `baseSalaryMonthly`/`insuranceSalaryBase`: dùng hợp đồng LỌC THEO KỲ (A-02) thay vì "mới nhất
  theo `ngay_bat_dau`" — nhân viên có hợp đồng ký trước cho tháng sau sẽ KHÔNG còn bị áp nhầm lương
  mới vào kỳ hiện tại.
- `employeeInsuranceDeduction`/`companyInsuranceExpense`/`employeeUnionFee`/`companyUnionExpense`:
  đọc tỷ lệ từ `GeneralSetting` (BUG-dltl-002) — công ty ĐÃ ĐỔI cấu hình BHXH/đoàn phí khỏi mặc
  định pháp luật sẽ thấy số liệu đổi theo kể từ đợt sửa này (trước đây luôn hardcode 10.5%/21.5%/
  1% trần 234.000đ/2% bất kể cấu hình).
- `personalIncomeTax`: **KHÔNG đổi** — `tinhThueLuyTien()` vẫn hardcode 7 bậc, chưa nối
  `GeneralSetting.taxBrackets` (nằm ngoài phạm vi phiên này, xem OQ-dltl-002).
- Bảng "4 sai lệch" ở Mục 4.1: `A-01` và `A-02` nay **FIXED**; `ADR-dltl-04` **FIXED một phần**
  (trừ biểu thuế); `A-07` (thiếu `Math.round`) vẫn **OPEN**, không đụng trong đợt này.

**Mục 5/7 (Ma trận mã lỗi) — `E-dltl-005` đổi cơ chế trả về:**
- Trước: chỉ **Zod (message-only)**, không có `code`.
- Sau: khi vi phạm trần giờ chuẩn/ngày (loại `lam_viec`/`nua_ngay`), lỗi ném từ SERVICE là
  **PayrollError** (`{ success:false, code:"E-dltl-005", errorCode:"E-dltl-005", message }`).
  Zod vẫn giữ nguyên chặn khoảng vật lý 0-24h ở validator (không đổi) — hai lớp chặn cùng tồn tại,
  lớp Zod là biên ngoài, lớp PayrollError là biên nghiệp vụ (so với `standardHoursPerDay` cấu hình).

**Mục 6 (Điểm phải chốt) — cập nhật trạng thái:** hàng 1 (`assertXemLuong`), 2 (lọc hợp đồng), 3
(`attendanceType`), 5 (`assertAdminOrOwner`) nay **Đã làm**. Hàng 4 (`GeneralSetting` + `taxBrackets`)
**đã làm phần `GeneralSetting`, CHƯA làm phần `taxBrackets`** (cần ADR riêng). Hàng 11 (audit log
reopen) **đã làm** — dùng `writeLog`/`sys_log`, không phải "bảng mới + migration" như dự trù ban
đầu. Các hàng 6-10 (`A-06`, `A-05`, `A-04`, `A-08`, `A-07`) vẫn **chưa làm**, ngoài phạm vi phiên
sửa 2026-09-09.

---

## 1. Kỳ tính lương (`/payroll-periods`) — 12 endpoint

> Route: `be_maxv/src/routes/hrm/du_lieu_tinh_luong/payrollPeriods.route.ts:4-19` · Controller: `.../controllers/client/hrm/du_lieu_tinh_luong/payrollPeriods.controller.ts` · Service: `.../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service.ts`

### 1.1. `GET /api/v1/hrm/payroll-periods` — Danh sách kỳ

- Route `payrollPeriods.route.ts:5` → ctrl `:16-20` → svc `:14-42`
- **Query** (`payrollPeriods.validator.ts:17-22`): `year?` (int, coerce) · `status?` ∈ `DRAFT|PENDING_REVIEW|LOCKED|APPROVED|PAID|ARCHIVED`
- **Sort**: cố định `year desc, month desc` (`:25`) — không cho client đổi
- **Phân trang**: ❌ **không có** — trả toàn bộ. Chấp nhận: ≤12 kỳ/năm.
- **200 OK**

```json
{ "success": true, "data": [ {
  "id": "9f1c…", "code": "2026-09", "name": "Kỳ lương tháng 09/2026",
  "month": 9, "year": 2026,
  "startDate": "2026-09-01T00:00:00.000Z", "endDate": "2026-09-30T00:00:00.000Z",
  "status": "DRAFT",
  "lockedByUserId": null, "lockedAt": null, "approvedByUserId": null, "approvedAt": null,
  "createdAt": "…", "updatedAt": "…",
  "_count": { "attendanceRecords": 12, "overtimeRecords": 5, "kpiRecords": 30,
              "bonusRecords": 8, "pieceworkRecords": 0, "commissionRecords": 4,
              "diligenceRecords": 2, "adjustmentRecords": 6, "payrollSheetLines": 0 }
} ] }
```

### 1.2. `GET /payroll-periods/:id` — Chi tiết

- `:7` → ctrl `:22-26` → svc `:44-69` · **200**: như 1.1 (1 object, có `_count`)
- **404**: `{ success:false, code:"E-dltl-025", errorCode:"E-dltl-025", message:"Kỳ lương không tồn tại trong hệ thống." }` (`:65`)

### 1.3. `POST /payroll-periods` — Tạo kỳ

- `:6` → ctrl `:28-32` → svc `:71-96`
- **Body** (`payrollPeriods.validator.ts:3-7`): `{ month: 1..12, year: 2020..2100, name: string(1..100) }`
- **Server tự sinh**: `code = "{year}-{MM}"` (`:72`) · `startDate` = ngày 1 · `endDate` = ngày cuối tháng, tính bằng `Date.UTC` (`:82-83`) · `status = 'DRAFT'` (`:93`)
- **201 Created**: `{ success:true, data:{ …PayrollPeriod } }`
- **409 Conflict**: `{ success:false, message:"Kỳ tính lương 2026-09 đã tồn tại trong hệ thống." }` (`:79`) — ⚠️ **không có `code`**, là `ConflictError` chứ không phải `PayrollError`
- **400**: Zod (`month`/`year` ngoài khoảng, `name` rỗng)
- ⚠️ **Không sinh lịch công chuẩn** từ `GeneralSetting`/`Holiday` — xác nhận BA #4, nhưng **đây là chủ đích đúng** theo ADR-dltl-02. Khuyết tật thật nằm ở giá trị mặc định trong engine (A-02/ADR-dltl-04), không ở endpoint này.

### 1.4. `PATCH /payroll-periods/:id` — Sửa kỳ

- `:8` → ctrl `:34-39` → svc `:98-109`
- **Body**: `{ name?: string(1..100) }` — ⚠️ **CHỈ `name`** (`payrollPeriods.validator.ts:11-13`). SRS Mục 6.2 ghi "sửa tên/ngày kỳ" là **sai**: `month`/`year`/`startDate`/`endDate` không bao giờ sửa được (A-13). Khóa lạ bị Zod strip ⇒ `data: input` ở `:107` an toàn.
- **Điều kiện**: chỉ khi `status === 'DRAFT'`
- **200 OK** · **403**: `code:"E-dltl-001"` (`:102`) — ⚠️ dùng lại mã "kỳ đã khóa sổ" cho ngữ cảnh "kỳ không còn ở DRAFT"; ở `PENDING_REVIEW` thông điệp sẽ gây hiểu nhầm · **404**: `E-dltl-025`

### 1.5. `DELETE /payroll-periods/:id` — Xóa kỳ

- `:9` → ctrl `:41-45` → svc `:111-125` · Chỉ khi `DRAFT`
- **200 OK**: `{ success:true, data:{ …bản ghi vừa xóa } }`
- **403**: `{ code:"E-dltl-001", message:"Chỉ có thể xóa kỳ lương ở trạng thái Nháp (DRAFT)." }` (`:115-119`) · **404**: `E-dltl-025`
- **Cascade**: xóa kéo theo cả 8 bảng biến động + `PayrollSheetLine` (`schema.prisma:1392-1400`, `onDelete: Cascade`). **Không có xác nhận 2 bước** — client phải tự hỏi lại người dùng.

### 1.6. Chuyển trạng thái — 7 endpoint

| # | Endpoint | Route | Service | Từ → Sang | Body | Lỗi khi sai trạng thái |
|---|---|---|---|---|---|---|
| a | `POST /payroll-periods/:id/submit` | `:12` | `:127-138` | `DRAFT` → `PENDING_REVIEW` | — | 400 `{message:"Chỉ có thể gửi đối soát kỳ lương từ trạng thái DRAFT."}` (không `code`) |
| b | `POST /payroll-periods/:id/reject` | `:13` | `:140-151` | `PENDING_REVIEW` → `DRAFT` | — | 400 (không `code`) |
| c | `POST /payroll-periods/:id/lock` | `:14` | `:156-176` | `DRAFT` **hoặc** `PENDING_REVIEW` → `LOCKED` | — | 400 (không `code`) |
| d | `POST /payroll-periods/:id/reopen` | `:15` | `:181-201` | `LOCKED` → `DRAFT` | `{ reason: string ≥20 }` | 400 (không `code`); Zod nếu `reason` < 20 |
| e | `POST /payroll-periods/:id/approve` | `:16` | `:203-218` | `LOCKED` → `APPROVED` | — | 400 (không `code`) |
| f | `POST /payroll-periods/:id/mark-paid` | `:17` | `:220-231` | `APPROVED` → `PAID` | — | 400 (không `code`) |
| g | `POST /payroll-periods/:id/archive` | `:18` | `:233-244` | `PAID` → `ARCHIVED` | — | 400 (không `code`) |

Mọi endpoint trên: **200 OK** `{ success:true, data:{ …PayrollPeriod } }` · **404** `E-dltl-025`.

**Ghi chú bắt buộc đọc:**

- **(c) `lock` — tác dụng phụ lớn nhất của cả module.** Chạy `snapshotPayrollSheet` trong cùng `$transaction` (`:163-176`): `deleteMany` toàn bộ `PayrollSheetLine` cũ của kỳ → `calculatePayrollPreview` (12 truy vấn) → `createMany` 18 cột × N nhân viên → `update` status + `lockedByUserId` (lấy từ `req.user.sub`, ctrl `:62`) + `lockedAt`. ✅ Ranh giới transaction **đúng**. ⚠️ `calculatePayrollPreview` chạy **bên trong** transaction và **không** truyền `{ timeout }` ⇒ mặc định Prisma 5 s; tenant lớn có thể P2028 rollback (A-05).
- **(c)** ⚠️ Cho khóa thẳng từ `DRAFT`, bỏ qua `PENDING_REVIEW` (`:159-161`) — lệch bảng transition trong SRS. `OQ-dltl-009` chưa chốt.
- **(d) `reopen`** ⚠️ **`reason` được validate ≥20 ký tự rồi vứt đi.** Tham số `_input` và `_userId` cố ý không dùng (`:181-186`); không có bảng audit nào trong tenant schema. Giao diện hứa trách nhiệm giải trình mà hệ thống không lưu gì. Xem ADR-dltl-05.
- **(c)(d)(e)** ⚠️ **Không có role-guard.** Bất kỳ ai qua `requireModule('hrm')` đều khóa sổ / mở lại / phê duyệt được. Fix rẻ: `{ preHandler: assertAdminOrOwner }`, dùng lại hàm có sẵn ở `routes/hrm/cau_hinh_mac_dinh/generalSettings.route.ts:10-16`.
- **Tất cả** ⚠️ Kiểm trạng thái nằm **ngoài** lệnh ghi (TOCTOU, A-04). Hai lượt `lock` đồng thời đều lọt; nếu đụng `@@unique([periodId, ma_nv])` thì trả **409 "Dữ liệu bị trùng"** (`errorHandler.plugin.ts:103-107`) chứ **không** phải `E-dltl-026`.

---

## 2. Danh mục chuyên biệt (`/payroll-catalogs`) — 16 endpoint

> Route `catalogs.route.ts:4-28` · Ctrl `catalogs.controller.ts` · Svc `catalogs.service.ts` · Validator `catalogs.validator.ts`

4 nhóm × 4 verb, **cùng một khuôn**:

| Nhóm | Path | Bảng | Mã tự sinh | Route line |
|---|---|---|---|---|
| Chỉ tiêu KPI | `/payroll-catalogs/kpi-items` | `hrm_kpi_items` | `KPI01`..`KPI99` | `:6-9` |
| Sản phẩm khoán | `/payroll-catalogs/products` | `hrm_piecework_products` | `SP01`..`SP99` | `:12-15` |
| Loại lỗi chuyên cần | `/payroll-catalogs/diligence-types` | `hrm_diligence_violation_types` | `CC01`..`CC99` | `:18-21` |
| Khoản ứng-bù trừ | `/payroll-catalogs/adjustment-items` | `hrm_salary_adjustment_items` | `BT01`..`BT99` | `:24-27` |

### 2.1. `GET /payroll-catalogs/{nhóm}` — Danh sách

- **Query** (`catalogs.validator.ts:54-57`): `status?` ∈ `ACTIVE|INACTIVE|ALL` (**default `ACTIVE`** — không truyền thì **không** thấy mục đã ngừng) · `q?` (tìm theo `code` hoặc `name`, `contains` + insensitive)
- **Sort** cố định `code asc` · **Không phân trang** (bảng ≤99 dòng)
- **200 OK**: `{ success:true, data:[ … ] }`

### 2.2. `POST /payroll-catalogs/{nhóm}` — Tạo mới

**Body theo nhóm** (`catalogs.validator.ts`):

| Nhóm | Body | Line |
|---|---|---|
| kpi-items | `{ code?≤20, name:1..200, unit:1..50, defaultWeight?:int 0..100 =100, status? =ACTIVE }` | `:4-10` |
| products | `{ code?≤20, name:1..200, unit:1..50, unitPrice?:≥0 =0, status? =ACTIVE }` | `:17-22` |
| diligence-types | `{ code?≤20, name:1..200, deductionMethod: theo_gio\|theo_lan\|mat_toan_bo, penaltyRate?:≥0 =0, status? =ACTIVE }` | `:30-36` |
| adjustment-items | `{ code?≤20, name:1..200, direction: tru\|bu, status? =ACTIVE }` | `:43-48` |

- **201 Created**: `{ success:true, data:{ … } }` (`sendCreated`, ctrl `:30`)
- **409 Conflict**: `{ success:false, message:"Mã chỉ tiêu KPI \"KPI01\" đã tồn tại." }` — `ConflictError`, **không có `code`** (svc `:51`, `:124`, `:197`, `:270`)
- `code` bỏ trống ⇒ server tự sinh mã trống đầu tiên trong `01..99`; hết chỗ ⇒ fallback `KPI{4 số cuối timestamp}` (`:31`). ⚠️ Có khe đua giữa 2 lượt tạo đồng thời — chặn bởi `@@unique(code)` ở DB ⇒ **fail an toàn**, người dùng thấy 409 vô cớ (A-12, chấp nhận, khớp khuôn `cai_dat_luong`).

### 2.3. `PATCH /payroll-catalogs/{nhóm}/:id` — Cập nhật

- Body = bản `.partial()` của schema tạo (`:13`, `:26`, `:39`, `:51`)
- **200 OK** · **404**: `{ success:false, message:"Không tìm thấy chỉ tiêu KPI." }` (`NotFoundError`, không `code`) · **409**: đổi `code` trùng
- ⚠️ **Cho phép đổi `code`, `penaltyRate`, `direction` bất kể danh mục đã phát sinh bản ghi.** Với `penaltyRate` và `direction` thì đây là **thay đổi có hiệu lực hồi tố** trên mọi kỳ chưa khóa (A-09) — `direction` đổi `tru`↔`bu` sẽ **đảo dấu tiền**. Cân nhắc chặn khi `usedCount > 0`.

### 2.4. `DELETE /payroll-catalogs/{nhóm}/:id` — Xóa

- **200 OK**: `{ success:true, data:{ …bản ghi vừa xóa } }`
- **400 Bad Request** khi danh mục đã phát sinh bản ghi (`BadRequestError`, **không** `code`):
  - KPI: `"Không thể xóa chỉ tiêu KPI đã phát sinh dữ liệu đánh giá trong kỳ."` (`:85`)
  - Sản phẩm: `"…đã có dữ liệu nghiệm thu trong kỳ tính lương."` (`:158`)
  - Chuyên cần: `"…đã phát sinh ghi nhận vi phạm trong kỳ."` (`:231`)
  - Bù trừ: `"…đã phát sinh bản ghi trong kỳ tính lương."` (`:303`)
- ✅ Kiểm ở tầng service **và** `onDelete: Restrict` ở DB — defense in depth đúng.

---

## 3. Tám phân hệ nhập liệu (`/payroll-data`) — 16 endpoint

> Route `payrollInputs.route.ts:4-38` · Ctrl `payrollInputs.controller.ts` · Svc `payrollInputs.service.ts` · Validator `inputs.validator.ts`

### 3.0. Khuôn chung

**Query cho mọi `GET /payroll-data/*`** (`inputs.validator.ts:134-138`): `periodId` (bắt buộc) · `ma_pb?` · `q?`

**Body cho mọi `POST .../apply`** — kế thừa `scopeBaseSchema` (`inputs.validator.ts:6-11`):
```jsonc
{
  "periodId": "9f1c…",                 // bắt buộc
  "scope": "toan_cong_ty" | "phong_ban" | "nhan_vien",
  "ma_pb": "PB01",                     // BẮT BUỘC khi scope = phong_ban
  "employeeIds": ["NV0001","NV0002"],  // BẮT BUỘC không rỗng khi scope = nhan_vien
  "items": [ /* … tùy phân hệ, [] = xóa sạch */ ]
}
```
- **200 OK**: `{ success:true, data:{ "appliedCount": 12 } }` — số **nhân viên** đã áp dụng, không phải số dòng
- ⚠️ `employeeIds` **không giới hạn độ dài** (`:10`) và vòng lặp ghi là N+1 trong transaction (A-05)
- ⚠️ ID trong `employeeIds` mà không tồn tại / đã nghỉ / đã xóa mềm ⇒ **âm thầm bỏ qua**, `appliedCount` nhỏ hơn số gửi lên, không có cảnh báo (`resolveTargetEmployees` `:61-65`; SRS `EC-dltl-01`, BR-dltl-003 ❌)

**Guard ghi (mọi endpoint ghi):** `assertPayrollPeriodWritable` (`helpers/payrollPeriodLockGuard.ts:13-40`) chạy **đầu tiên**:
- Kỳ không tồn tại → **404** `E-dltl-025`
- Kỳ ∈ `LOCKED|APPROVED|PAID|ARCHIVED` → **403** `E-dltl-001` ✅ (BR-dltl-001 xác nhận đúng)
- Kỳ ∈ `DRAFT|PENDING_REVIEW` → cho ghi
- ⚠️ `GET` **không** qua guard này ⇒ đọc được dữ liệu kỳ đã khóa (đúng ý định)
- ⚠️ Backend cho ghi ở `PENDING_REVIEW` nhưng FE khóa toàn bộ UI (`PayrollPeriodContext.tsx:36`) — 3 tầng không đồng bộ, SRS `OQ-dltl-010`

**Lỗi phạm vi (PayrollError, có `code`):**
- **400** `E-dltl-003` — `scope=phong_ban` thiếu `ma_pb` (`:38-44`)
- **400** `E-dltl-004` — `scope=nhan_vien` mà `employeeIds` rỗng/thiếu (`:53-59`)

---

### 3.1. Chấm công (2 endpoint)

**`GET /payroll-data/attendance/matrix`** — route `:6`, ctrl `:25-29`, svc `:71-106`

- **200 OK** (5 khối, client tự dựng ma trận):
```json
{ "success": true, "data": {
  "period":    { "id":"…", "code":"2026-09", "startDate":"…", "endDate":"…", "status":"DRAFT" },
  "settings":  { "id":"DEFAULT", "standardWorkingDaysMethod":"FIXED_26", "saturdayPolicy":"HALF_DAY",
                 "sundayPolicy":"OFF", "standardHoursPerDay":"8.00", "…":"… 15 trường cấu hình" },
  "holidays":  [ { "id":"…","date":"2026-09-02T00:00:00.000Z","name":"Quốc khánh","type":"NATIONAL","isPaid":true } ],
  "employees": [ { "ma_nv":"NV0001","ho_ten":"Nguyễn Văn A","ma_pb":"PB01" } ],
  "records":   [ { "id":"…","periodId":"…","ma_nv":"NV0001","workDate":"2026-09-05T00:00:00.000Z",
                   "attendanceType":"nghi_phep","actualHours":"0.00","workDayValue":"0.00","note":null } ]
}}
```
- **404** `E-dltl-025`
- ✅ Endpoint **đã** trả `settings` + `holidays` để FE vẽ lịch chuẩn — nghĩa là dữ liệu cấu hình có sẵn ở tầng API; chỉ có **engine tính lương** là bỏ qua chúng (A-02, ADR-dltl-04).
- Mô hình **delta**: `records` chỉ chứa ngày khác chuẩn.

**`PUT /payroll-data/attendance/cell`** — route `:7`, ctrl `:30-34`, svc `:108-139`

- **Body** (`inputs.validator.ts:14-30`):
```json
{ "periodId":"…", "ma_nv":"NV0001", "workDate":"2026-09-05",
  "attendanceType":"nghi_phep", "actualHours": 0, "note":"Nghỉ phép năm" }
```
  - `workDate` regex `^\d{4}-\d{2}-\d{2}$` · `actualHours?` 0..24 · `note?` ≤500
- **Server tính**: `actualHours = input.actualHours ?? 8.0` rồi `workDayValue = (actualHours/8.0).toFixed(2)` (`:112-113`)
- **200 OK**: bản ghi sau `upsert` theo khóa `(periodId, ma_nv, workDate)` (`:115-121`)
- **403** `E-dltl-001` · **404** `E-dltl-025` · **400** Zod
- ⚠️ **A-03 🔴 — bẫy nghiêm trọng cho client:** `attendanceType` được lưu nhưng **engine không bao giờ đọc** (`payrollCalculation.service.ts:153` chỉ cộng `workDayValue`). Gửi `attendanceType:"khong_luong"` mà **không** gửi `actualHours: 0` ⇒ `workDayValue = 1.00` ⇒ **hưởng nguyên ngày công**. `nua_ngay` cũng trả đủ ngày trừ khi client gửi `actualHours: 4`. Tới khi sửa engine, **client bắt buộc phải tự gửi đúng `actualHours`** cho từng loại ngày công.
- ⚠️ `actualHours` tới 24 ⇒ `workDayValue` tới `3.00`/ngày, không bị chặn trần 1 ngày công (SRS BR-dltl-006). Chỉ bị chặn gián tiếp ở tổng tháng qua `Math.min(actualWorkDays, standardWorkDays)` (`payrollCalculation.service.ts:157`).
- ❌ **Không có** `POST /payroll-data/attendance/batch-override` — endpoint "Đặt lại theo lịch chuẩn" mô tả trong `BA_ANALYSIS_SPEC.md` **không tồn tại**.

---

### 3.2. Tăng ca (3 endpoint)

**`GET /payroll-data/overtime`** — route `:10`, svc `:153-195`
```json
{ "success": true, "data": [ {
  "ma_nv":"NV0001", "ho_ten":"Nguyễn Văn A", "ma_pb":"PB01",
  "records":[ { "id":"…","otType":"ngay_thuong_ngay","hours":"10.00",
                "ratePercent":"150.00","convertedHours":"15.00","note":null } ],
  "totalHours": 10, "convertedHours": 15, "isWarningMonth": false
} ] }
```
- ⚠️ `isWarningMonth: totalHours > 40` — **hardcode 40** (`:192`), không đọc `GeneralSetting.maxOtHoursPerMonth` (`schema.prisma:1118`).
- ❌ **Không có** cảnh báo trần **năm** (`maxOtHoursPerYear` 300h / `warningOtHoursPerYear` 200h) — không code path nào cộng dồn qua kỳ. AC-dltl-07 không đạt.

**`POST /payroll-data/overtime/apply`** — route `:11`, svc `:197-247`
- **`items[]`** (`inputs.validator.ts:41-52`): `{ otType: <6 enum>, hours: >0, note?≤500 }`
- **Server tính**: `ratePercent` lấy từ `GeneralSetting.otRate*` ✅ (`:212-219`, fallback `DEFAULT_OT_RATES` `:144-151` khi chưa có cấu hình) → **snapshot** vào record (`:237`); `convertedHours = (hours × rate / 100).toFixed(2)` (`:231`)
- **400** `E-dltl-006` (PayrollError) — trùng `otType` trong `items`
- **400** Zod — `hours ≤ 0` (message chứa `E-dltl-007`, **không** có field `code`)
- ✅ **Đây là phần cấu hình được cài đúng nhất module** — 6/6 tỷ lệ OT đọc từ `GeneralSetting` và snapshot bất biến. (Cải chính SRS: câu "chỉ đọc 2/~15 tham số" đúng cho *engine tính lương*, **không** đúng cho phần OT này.)

**`DELETE /payroll-data/overtime/:ma_nv?periodId=…`** — route `:12`, ctrl `:47-52`, svc `:249-254`
- `periodId` truyền qua **query**, `ma_nv` qua **path** · **200 OK**: `{ success:true, data:{ count: 3 } }` (kết quả `deleteMany`)
- **403** `E-dltl-001` · **404** `E-dltl-025`

---

### 3.3. KPI (2 endpoint)

**`GET /payroll-data/kpi`** — route `:15`, svc `:259-307`
```json
{ "success": true, "data": [ {
  "ma_nv":"NV0001","ho_ten":"…","ma_pb":"PB01",
  "records":[ { "id":"…","kpiItemId":"…","weight":50,"targetValue":"100.00",
                "actualValue":"95.00","completionRate":"95.00",
                "kpiItem":{ "code":"KPI01","name":"Doanh số","unit":"triệu đồng","defaultWeight":100,"status":"ACTIVE" } } ],
  "avgScore": 95, "totalKpiItems": 1
} ] }
```
- `avgScore` = trung bình `completionRate` **có trọng số**; `null` khi chưa có dòng nào (`:296`)

**`POST /payroll-data/kpi/apply`** — route `:16`, svc `:309-355`
- **`items[]`** (`inputs.validator.ts:60-66`): `{ kpiItemId: string≥1, weight?: int ≥0 =100, targetValue: >0, actualValue: ≥0, note? }`
- **Server tính**: `completionRate = (actualValue/targetValue × 100).toFixed(2)` (`:338`)
- **400** `E-dltl-009` (PayrollError) — trùng `kpiItemId` (`:317`) · **400** `E-dltl-010` (PayrollError) — `Σweight ≤ 0` khi có ≥1 dòng (`:324`)
- **400** Zod — thiếu `kpiItemId` (message chứa `E-dltl-008`) hoặc `targetValue ≤ 0`
- ✅ **Chia cho 0 không xảy ra**: `targetValue` đã `.positive()` ở validator (`:63`). QA đừng viết test kỳ vọng `Infinity`/`NaN`.
- ⚠️ **A-08 🟠 — không kiểm `kpiItemId` tồn tại.** ID sai ⇒ Prisma P2003 ⇒ `errorHandler.plugin.ts:113-118` trả **409 "Không thể xóa vì còn được tham chiếu"** — thông điệp của thao tác XÓA, hoàn toàn sai ngữ cảnh. Đây là lý do `E-dltl-008` chỉ tồn tại trên giấy.

---

### 3.4. Thưởng (2 endpoint)

**`GET /payroll-data/bonus`** — route `:19`, svc `:360-400` — `{ ma_nv, ho_ten, ma_pb, records[] (kèm `salaryItem`), totalAmount }`

**`POST /payroll-data/bonus/apply`** — route `:20`, svc `:402-436`
- **`items[]`** (`inputs.validator.ts:74-78`): `{ salaryItemId: string≥1, amount: ≥0, note? }`
- **400** `E-dltl-011` (PayrollError) — trùng `salaryItemId` (`:409`) · **400** Zod — `amount < 0` (message chứa `E-dltl-012`)
- **Liên kết `cai_dat_luong`**: `salaryItemId` → `hrm_salary_items.id`, FK `schema.prisma:1509` / `1233`, `onDelete: Restrict` ✅
- ⚠️ **A-08 🟠 — KHÔNG kiểm `salaryItem.category === 'PERIODIC_BONUS'`.** `applyBonus` không truy vấn `salaryItem` lần nào (`:402-436`). Gán nhầm 1 khoản `FIXED_ALLOWANCE` làm "thưởng" vẫn ghi thành công **và vẫn cộng vào `bonusSalary`** (engine `:188` cộng mọi `BonusRecord`, không lọc category). BR-dltl-012 nói "loại `PERIODIC_BONUS`" — **không được thực thi ở bất kỳ tầng nào**.

---

### 3.5. Lương sản phẩm (2 endpoint)

**`GET /payroll-data/piecework`** — route `:23`, svc `:441-481` — records kèm `product`

**`POST /payroll-data/piecework/apply`** — route `:24`, svc `:483-529`
- **`items[]`** (`inputs.validator.ts:86-91`): `{ productId: string≥1, unitPrice?: ≥0, quantity: ≥0, note? }`
- **Server tính**: `unitPrice = it.unitPrice ?? danh_mục.unitPrice ?? 0` → **snapshot** (`:512`); `totalAmount = Math.round(unitPrice × quantity)` (`:513`)
- **400** `E-dltl-014` (PayrollError) — trùng `productId` (`:490`) · **400** Zod — `unitPrice`/`quantity` âm (message chứa `E-dltl-015`), thiếu `productId` (`E-dltl-013`)
- ✅ **BR-dltl-014 xác nhận đúng**: đơn giá đóng băng, đổi giá danh mục về sau không đụng bản ghi cũ
- ⚠️ A-08: `productId` sai ⇒ `catalogPriceMap.get()` trả `undefined` ⇒ fallback `0` ⇒ ghi tiếp ⇒ vỡ ở FK ⇒ 409 sai nghĩa

---

### 3.6. Lương phần trăm (2 endpoint)

**`GET /payroll-data/commission`** — route `:27`, svc `:534-574` — records kèm `salaryItem`

**`POST /payroll-data/commission/apply`** — route `:28`, svc `:576-621`
- **`items[]`** (`inputs.validator.ts:99-104`): `{ salaryItemId: string≥1, baseAmount: ≥0, commissionRate?: 0..100, note? }`
- **Server tính**: `rate = it.commissionRate ?? SalaryItem.defaultRate ?? 0` → **snapshot** (`:604`, `:611`); `totalAmount = Math.round(baseAmount × rate / 100)` (`:605`)
- **400** `E-dltl-016` (PayrollError) — trùng `salaryItemId` (`:583`) · **400** Zod — `commissionRate > 100` (message chứa `E-dltl-017`)
- **Liên kết `cai_dat_luong`**: FK `schema.prisma:1575` / `1234`, `onDelete: Restrict` ✅
- ✅ **BR-dltl-016 xác nhận đúng** (snapshot tỷ lệ)
- ⚠️ A-08: có query `salaryItem.findMany` (`:590-592`) **nhưng chỉ lấy `defaultRate`** — không kiểm tồn tại, không kiểm `category === 'COMMISSION_PERCENTAGE'`

---

### 3.7. Lương chuyên cần (3 endpoint)

**`GET /payroll-data/diligence`** — route `:31`, svc `:626-712`
```json
{ "success": true, "data": [ {
  "ma_nv":"NV0001","ho_ten":"…","ma_pb":"PB01",
  "records":[ { "id":"…","violationTypeId":"…","violationDate":"2026-09-05T00:00:00.000Z",
                "violationHours":"2.00",
                "violationType":{ "code":"CC01","name":"Đi muộn","deductionMethod":"theo_gio","penaltyRate":"50000.00" } } ],
  "donGia": 500000, "tongTru": 100000, "thanhTien": 400000, "soViPham": 1
} ] }
```
- `donGia` tra từ Set lương `APPROVED`, khoản category `ATTENDANCE_ALLOWANCE` (`:656-664`)
- ✅ **BR-dltl-018 (chặn sàn) xác nhận đúng**: `tongTru = min(Σphạt, donGia)` (`:698`), `thanhTien = max(0, donGia − tongTru)` (`:699`); `mat_toan_bo` ép `tongPhat = donGia` (`:693-695`). Khớp **chính xác** với engine (`payrollCalculation.service.ts:198-220`), đã kiểm cả 2 nhánh.

**`POST /payroll-data/diligence/record`** — route `:32`, ctrl `:108-112` (`sendCreated`), svc `:714-745`
- **Body** (`inputs.validator.ts:112-119`): `{ periodId, ma_nv, violationTypeId, violationDate:"YYYY-MM-DD", violationHours?: ≥0, note? }`
- **201 Created** (khác 6 `apply` khác trả 200) · ghi **1 bản ghi/lần**, không theo scope
- **400** `E-dltl-019` (PayrollError) — trùng `(periodId, ma_nv, violationTypeId, violationDate)` (`:732`), hậu thuẫn `@@unique` `schema.prisma:1618`
- **400** Zod — sai định dạng ngày (message chứa `E-dltl-018`), `violationHours` âm (`E-dltl-020`)
- **403** `E-dltl-001` · **404** `E-dltl-025`
- ⚠️ `deductionMethod = theo_gio` mà không gửi `violationHours` ⇒ engine mặc định ×1 (`payrollCalculation.service.ts:214`), im lặng

**`DELETE /payroll-data/diligence/:id`** — route `:33`, svc `:747-754`
- **404**: `{ success:false, message:"Không tìm thấy bản ghi vi phạm chuyên cần." }` (`NotFoundError`, không `code`)
- **403** `E-dltl-001` (guard chạy **sau** khi tìm bản ghi để biết `periodId`, `:751`) · **200 OK**

---

### 3.8. Ứng — Bù trừ (2 endpoint)

**`GET /payroll-data/adjustments`** — route `:36`, svc `:759-813`
```json
{ "success": true, "data": [ {
  "ma_nv":"NV0001","ho_ten":"…","ma_pb":"PB01",
  "records":[ { "id":"…","adjustmentItemId":"…","amount":"2000000.00",
                "adjustmentItem":{ "code":"BT01","name":"Tạm ứng lương","direction":"tru" } } ],
  "tongTru": 2000000, "tongBu": 0, "netAdjustment": 2000000
} ] }
```
- ✅ **BR-dltl-020 xác nhận đúng**: `netAdjustment = Σtru − Σbu` (`:801`), khớp engine (`payrollCalculation.service.ts:231`). Dương ⇒ giảm thực lĩnh.

**`POST /payroll-data/adjustments/apply`** — route `:37`, svc `:815-849`
- **`items[]`** (`inputs.validator.ts:123-127`): `{ adjustmentItemId: string≥1, amount: >0, note? }` — `amount` **luôn dương**, chiều nằm ở `adjustmentItem.direction`
- **400** `E-dltl-022` (PayrollError) — trùng `adjustmentItemId` (`:822`) · **400** Zod — `amount ≤ 0` (`E-dltl-023`), thiếu id (`E-dltl-021`)

---

## 4. Bảng lương tổng hợp (`/payroll`) — 2 endpoint

> Route `payrollCalculation.route.ts:4-7` · Ctrl `payrollCalculation.controller.ts` · Svc `payrollCalculation.service.ts`

### 4.1. `GET /api/v1/hrm/payroll/calculate?periodId=…` — Tính thời gian thực

- Route `:5` → ctrl `:12-16` → svc `calculatePayrollPreview` `:33-308`
- **Query**: `periodId` (bắt buộc)
- **200 OK** — mảng 29 trường/nhân viên, **tất cả số là `number` JS**:

```json
{ "success": true, "data": [ {
  "periodId":"9f1c…", "ma_nv":"NV0001", "employeeCode":"NV0001", "fullName":"Nguyễn Văn A",
  "departmentName":"Phòng Kỹ thuật", "positionName":"Kỹ sư", "contractType":"xac_dinh",
  "salaryType":"gross", "dependentCount":1,

  "baseSalaryMonthly":15000000, "standardWorkDays":26, "actualWorkDays":26, "otConvertedHours":15,
  "proratedWorkSalary":15000000, "otAmount":1081731, "pieceworkSalary":0, "bonusSalary":2000000,
  "kpiSalary":950000, "commissionSalary":0, "diligenceSalary":400000, "grossIncome":19431731,

  "taxableIncome":2456731, "insuranceSalaryBase":15000000,
  "employeeInsuranceDeduction":1575000, "companyInsuranceExpense":3225000,
  "employeeUnionFee":150000, "companyUnionExpense":300000,

  "adjustmentNetAmount":2000000, "personalIncomeTax":195673,
  "netTakeHomeSalary":15511058, "totalCompanyCost":22956731
} ] }
```

- **404** `E-dltl-025` (`:37`)
- **Nguồn dữ liệu**: 4 truy vấn master (`hrm_nhan_vien` + hợp đồng + người phụ thuộc, `GeneralSetting`, `EmployeeSalary` status `APPROVED`, `hrm_phong_ban`) + 8 truy vấn bản ghi kỳ, tất cả qua 2 `Promise.all` (`:40-75`) ⇒ **không N+1 khi đọc** ✅
- **Phạm vi**: mọi nhân viên `status:'1', da_xoa:false`. **Không phân trang, không lọc** ⇒ luôn trả cả công ty.

**⚠️ Cảnh báo bắt buộc cho Backend/QA — 4 sai lệch trong endpoint này:**

| Mã | Vấn đề | Vị trí |
|---|---|---|
| **A-01 🔴** | **Không có guard `xemLuong`** — endpoint nhạy cảm nhất module (lương gộp + thực lĩnh + thuế TNCN toàn công ty) mở cho mọi user có module `hrm` | `payrollCalculation.controller.ts:13` |
| **A-02 🔴** | **Chọn sai hợp đồng** — `hop_dong: { orderBy:{ngay_bat_dau:'desc'}, take:1 }` lấy hợp đồng mới nhất **không lọc theo kỳ**. Hợp đồng ký trước cho tháng sau (kèm tăng lương) sẽ được dùng để tính kỳ **hiện tại**; hợp đồng đã hết hạn vẫn trả lương | `:44-47`, `:146-147` |
| **ADR-dltl-04 🔴** | **Chỉ 2/17 tham số đọc từ `GeneralSetting`** (`personalDeduction`, `dependentDeduction` `:137-138`). Hardcode: `standardWorkDays=26` `:136` · `8.0` giờ/ngày `:163` · BHXH NLĐ `0.105` `:244` · BHXH DN `0.215` `:245` · đoàn phí `1%`+trần `234000` `:249` · `2%` `:250` · biểu thuế 7 bậc `:7-28`. ⇒ Sửa "Cấu hình mặc định" **không làm đổi một đồng nào** trong bảng lương | như cột trái |
| **A-07 🟠** | **Preview lệch snapshot tới 0,5đ/dòng** — `diligenceSalary` `:219-220`, `adjustmentNetAmount` `:231`, `netTakeHomeSalary` `:259-264`, `totalCompanyCost` `:266` **không có `Math.round`**; PostgreSQL `numeric(18,2)` làm tròn khi ghi snapshot | như cột trái |

### 4.2. `GET /api/v1/hrm/payroll/sheet-lines?periodId=…` — Bảng lương (preview hoặc snapshot)

- Route `:6` → ctrl `:18-22` → svc `getPayrollSheetLines` `:333-349`
- **Hành vi phân nhánh theo trạng thái kỳ:**

| `period.status` | Trả về | Nguồn | Kiểu số | Trường thừa |
|---|---|---|---|---|
| `DRAFT` · `PENDING_REVIEW` | Tính lại thời gian thực | `calculatePayrollPreview` (`:341`) | **number** | không có `id`/`createdAt` |
| `LOCKED` · `APPROVED` · `PAID` · `ARCHIVED` | **Snapshot đóng băng** | `payrollSheetLine.findMany`, sort `ma_nv asc` (`:345-348`) | **chuỗi** (Prisma Decimal) | có `id`, `createdAt`, `updatedAt` |

- **404** `E-dltl-025` (`:337`)
- ⚠️ **A-06 🟠 — đây là điểm gãy hợp đồng nghiêm trọng nhất với Frontend.** Cùng URL, cùng query, nhưng **kiểu dữ liệu đổi sau khi khóa sổ**. FE làm `data[0].netTakeHomeSalary + x` hoặc `.toLocaleString()` sẽ chạy đúng ở kỳ nháp và sai/vỡ ngay khi kỳ được khóa — không có lỗi nào được ném. **Phải chốt trước khi FE đấu dây 23 component.**
- ✅ Snapshot **bất biến đúng**: đọc từ `hrm_payroll_sheet_lines`, không tính lại, không join lại master data (`data-model` Mục 5.1).

### 4.3. Endpoint **không tồn tại**

❌ `GET /payroll/payslips/my` — được mô tả trong `BA_ANALYSIS_SPEC.md` Mục 4.4 nhưng **không có** trong `payrollCalculation.route.ts` (file chỉ đăng ký 2 route). Actor "Nhân viên (self-service)" chưa có đường vào hệ thống. QA không viết test cho endpoint này.

---

## 5. Ma trận Mã lỗi — đối soát điểm `throw` thật

**Chú giải:** `PE` = PayrollError (có `code`/`errorCode`, máy đọc được) · `Zod` = chỉ có message tiếng Việt trong `errors[]`, **không** có `code` · `—` = không có code path nào.

| Mã | HTTP | Cơ chế | Điểm `throw` thật |
|---|:---:|:---:|---|
| `E-dltl-001` | 403 | **PE** | `payrollPeriodLockGuard.ts:33` · `payrollPeriods.service.ts:102` (sửa kỳ ≠DRAFT) · `:116` (xóa kỳ ≠DRAFT) |
| `E-dltl-002` | 400 | **—** | ❌ BR-dltl-003 chưa triển khai — không kiểm hợp đồng bao phủ kỳ |
| `E-dltl-003` | 400 | **PE** | `payrollInputs.service.ts:40` |
| `E-dltl-004` | 400 | **PE** | `payrollInputs.service.ts:55` |
| `E-dltl-005` | 400 | **Zod** | `inputs.validator.ts:28` — ⚠️ cận trên thật là **24h**, không phải "số giờ chuẩn" như message |
| `E-dltl-006` | 400 | **PE** | `payrollInputs.service.ts:204` |
| `E-dltl-007` | 400 | **Zod** | `inputs.validator.ts:50` |
| `E-dltl-008` | 400 | **Zod** | `inputs.validator.ts:61` — chỉ chặn chuỗi rỗng; **id sai** rơi vào FK ⇒ 409 sai nghĩa (A-08) |
| `E-dltl-009` | 400 | **PE** | `payrollInputs.service.ts:317` |
| `E-dltl-010` | 400 | **PE** | `payrollInputs.service.ts:324` |
| `E-dltl-011` | 400 | **PE** | `payrollInputs.service.ts:409` |
| `E-dltl-012` | 400 | **Zod** | `inputs.validator.ts:76` |
| `E-dltl-013` | 400 | **Zod** | `inputs.validator.ts:87` — như 008 |
| `E-dltl-014` | 400 | **PE** | `payrollInputs.service.ts:490` |
| `E-dltl-015` | 400 | **Zod** | `inputs.validator.ts:88-89` |
| `E-dltl-016` | 400 | **PE** | `payrollInputs.service.ts:583` |
| `E-dltl-017` | 400 | **Zod** | `inputs.validator.ts:101` |
| `E-dltl-018` | 400 | **Zod** | `inputs.validator.ts:116` |
| `E-dltl-019` | 400 | **PE** | `payrollInputs.service.ts:732` |
| `E-dltl-020` | 400 | **Zod** | `inputs.validator.ts:117` |
| `E-dltl-021` | 400 | **Zod** | `inputs.validator.ts:124` — như 008 |
| `E-dltl-022` | 400 | **PE** | `payrollInputs.service.ts:822` |
| `E-dltl-023` | 400 | **Zod** | `inputs.validator.ts:125` |
| `E-dltl-024` | 400 | **—** | ❌ Không có endpoint import Excel; toàn bộ 7 file `*Excel.ts` chạy 100% phía trình duyệt |
| `E-dltl-025` | 404 | **PE** | `payrollPeriodLockGuard.ts:24` · `payrollPeriods.service.ts:65` · `payrollInputs.service.ts:75` · `payrollCalculation.service.ts:37`, `:337` |
| `E-dltl-026` | 409 | **—** | ❌ Không có optimistic lock; xung đột thật trả **409 "Dữ liệu bị trùng"** qua P2002 (`errorHandler.plugin.ts:103-107`) — xem A-04 |

**Lỗi hệ thống không có mã `E-dltl-*` mà client vẫn gặp:**

| Tình huống | HTTP | Body | Nguồn |
|---|:---:|---|---|
| Tạo kỳ trùng `code` | 409 | `{success:false, message:"Kỳ tính lương 2026-09 đã tồn tại…"}` | `payrollPeriods.service.ts:79` |
| Sai trạng thái chuyển tiếp (submit/reject/lock/reopen/approve/mark-paid/archive) | 400 | `{success:false, message:"Chỉ có thể …"}` | `payrollPeriods.service.ts:131,144,160,190,207,224,237` |
| Danh mục trùng `code` | 409 | `{success:false, message:"Mã … đã tồn tại."}` | `catalogs.service.ts:51,124,197,270` |
| Danh mục không tồn tại | 404 | `{success:false, message:"Không tìm thấy …"}` | `catalogs.service.ts:66,139,212,284` |
| Xóa danh mục đang dùng | 400 | `{success:false, message:"Không thể xóa … đã phát sinh …"}` | `catalogs.service.ts:85,158,231,303` |
| **FK sai khi INSERT** (id danh mục không tồn tại) | **409** | `{success:false, message:"…còn được tham chiếu…"}` | `errorHandler.plugin.ts:113-118` — ⚠️ **thông điệp sai ngữ cảnh** (A-08) |
| Transaction timeout (P2028) | 500 | `{success:false, message:"Lỗi máy chủ nội bộ"}` | `errorHandler.plugin.ts:121-124` — ⚠️ P2028 **không được map**, rơi xuống 500 (A-05) |
| Chưa chọn công ty / mất quyền / chưa cấp DB | 403 / 404 | `{success:false, message}` | `resolveTenantDb.ts:49-74` |
| Chưa mua module `hrm` | 403 | theo `requireModule` | `hrm.route.ts:38` |

---

## 6. Điểm phải chốt trước khi Backend sửa & Frontend đấu dây

| # | Hạng mục | Mức | Cần ai quyết | Chi phí |
|:---:|---|:---:|---|---|
| 1 | Guard `assertXemLuong` cho 4 controller (A-01) | 🔴 | Architect + BA (ảnh hưởng cả `cai_dat_luong`) | 2 dòng/controller |
| 2 | Lọc hợp đồng theo kỳ (A-02) | 🔴 | Architect — không đổi hợp đồng API | ~5 dòng |
| 3 | `attendanceType` → `workDayValue` (A-03) | 🔴 | BA (chính sách ngày công theo loại) | ~30 dòng + bảng chính sách |
| 4 | Đọc `GeneralSetting` trong engine + chốt shape `taxBrackets` (ADR-dltl-04) | 🔴 | BA chốt `OQ-dltl-002` | ~150 dòng + Zod schema |
| 5 | `assertAdminOrOwner` cho `reopen`/`lock`/`approve` (ADR-dltl-05 bước 1) | 🔴 | Đã có tiền lệ ⇒ làm ngay | ~3 dòng |
| 6 | **Chốt kiểu tiền trong response** (A-06) | 🟠 | Architect + FE — **chặn việc đấu dây 23 component** | serializer hoặc quy ước |
| 7 | Gộp `apply*` thành 2 lệnh + `{timeout}` + `.max()` cho `employeeIds` (A-05) | 🟠 | Architect | ~40 dòng |
| 8 | `updateMany` có điều kiện trạng thái ⇒ bật được `E-dltl-026` (A-04) | 🟠 | Architect | ~10 dòng/transition |
| 9 | Kiểm tồn tại + đúng category cho FK danh mục (A-08) ⇒ bật `E-dltl-008/013/021` | 🟠 | Architect | ~15 dòng/hàm |
| 10 | `Math.round` 4 giá trị còn thiếu (A-07) | 🟠 | Architect | 4 dòng |
| 11 | Audit log cho `reopen` (ADR-dltl-05 bước 2) | 🟠 | BA chốt `OQ-dltl-003` | bảng mới + migration |

---

## 7. Bàn giao

- **Tester-QA (Phase A)**: Mục 5 là nguồn assert chính thức — **chỉ 12/26 mã trả về field `code`**; 12 mã Zod phải assert bằng `errors[].message` chứa chuỗi, `E-dltl-002/024/026` **không được viết test** (không có code path). Ưu tiên viết test cho Mục 6 hàng 1-5 (🔴). Hai điểm dễ viết sai kỳ vọng: `targetValue` **đã** chặn chia-0 (`inputs.validator.ts:63`); 6 tỷ lệ OT **đã** đọc đúng từ `GeneralSetting` (`payrollInputs.service.ts:212-219`).
- **Business Analyst (Final Sign-off)**: cần chốt `OQ-dltl-002`, `OQ-dltl-003`, `OQ-dltl-004` (đã có đề xuất trong `data-model-du-lieu-tinh-luong.md` Mục 9) và bổ sung quyết định mới cho A-01 (phạm vi `xemLuong`), A-03 (chính sách ngày công theo `attendanceType`), A-06 (kiểu tiền trong hợp đồng API).
- **Backend Engineer**: **không** coi các mục `⚠️` là hợp đồng đã chốt. Chỉ triển khai sau khi BA cập nhật `Status: Ready for Implementation`.
- **Mô hình dữ liệu**: `docs/hrm/du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md`.

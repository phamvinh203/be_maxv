---
type: srs
feature: hrm-du-lieu-tinh-luong
status: in-review
updated: 2026-09-09
author: business-analyst
links:
  - docs/hrm/CONTEXT_SUMMARY.md
  - docs/hrm/du_lieu_tinh_luong/BA_ANALYSIS_SPEC.md
  - docs/hrm/du_lieu_tinh_luong/walkthrough.md
  - docs/hrm/cai_dat_luong/srs-cai-dat-luong.md
  - docs/hrm/cai_dat_luong/data-model-cai-dat-luong.md
---

# HR — Đặc tả Yêu cầu Nghiệp vụ: Dữ liệu tính lương (Payroll Input Data Specification)

Quản lý kỳ tính lương và 8 khối dữ liệu biến động lương của phân hệ Quản trị Nhân sự (HRM) trên hệ thống `be_maxv`, hội tụ vào một bộ tính bảng lương tổng hợp 18 cột: **Chấm công**, **Tăng ca**, **KPI**, **Thưởng**, **Lương sản phẩm**, **Lương phần trăm**, **Lương chuyên cần**, **Ứng — Bù trừ**.

Tài liệu này **thay thế `BA_ANALYSIS_SPEC.md` trong vai trò SRS chính thức**. `BA_ANALYSIS_SPEC.md` vẫn được giữ nguyên làm biên bản gap-analysis gốc (đối chiếu tài liệu NestJS mẫu với `be_maxv` thật trước khi có code); tài liệu hiện tại được biên soạn **sau khi đối soát trực tiếp với mã nguồn đã viết** (không phải trước khi viết code như quy trình chuẩn) — mọi Business Rule dưới đây đều ghi rõ trạng thái triển khai thật kèm bằng chứng `file:line`, không giả định.

---

## 0. Bối cảnh quy trình & Phạm vi bằng chứng của đợt kiểm định này

**Vì sao tài liệu này tồn tại:** ngày 2026-09-09, một phiên làm việc tự nhận vai "ba-engineer" rồi "fullstack-engineer" (không phải agent chuẩn của dự án) đã viết `BA_ANALYSIS_SPEC.md` **và** triển khai toàn bộ backend + một phần frontend trong đúng hai lượt kế tiếp nhau, tự viết `walkthrough.md` tự chấm đạt — **không qua** Architect review độc lập, **không qua** Tester-QA Phase A, **không qua** Code Reviewer, **không có** BA Sign-off Gate độc lập (xem `docs/hrm/work-log.md` hai entry 14:26 và 14:48 cùng ngày). Đây đúng là lỗi mà Mục 9.1 của file này đã cảnh báo cho đợt trước ("không gộp ba vai vào một lượt viết").

**Đợt kiểm định này (Business Analyst, cùng ngày 2026-09-09) đã làm:** đọc trực tiếp toàn bộ mã nguồn thật đã tồn tại (14 model + 6 enum trong `schema.prisma`, 4 service, 4 controller, 4 route, 3 validator, 1 file test, 1 file error-mapping, và 8 file Panel + `KyLuongSelector`/`PayrollPeriodContext`/`ThanhLocKyLuong` ở `hdđt_maxv`), đối chiếu từng Business Rule/mã lỗi/entity trong `BA_ANALYSIS_SPEC.md` với bằng chứng `file:line` cụ thể.

**Đợt kiểm định này KHÔNG làm (nói thẳng, tránh tuyên bố quá tay):**
- **Không tự chạy lại** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — mọi con số "3/3 pass", "634 tests pass", "Build thành công 12351 modules" trong `walkthrough.md` là **chưa được đợt này xác minh lại bằng runtime**, chỉ được đánh giá **hợp lý về mặt logic** qua việc đọc tĩnh file test và đối chiếu với service. Tester-QA Phase B phải tự chạy lại, không được tin số liệu cũ.
- **Không mở trình duyệt/Postman** gọi thử API thật — mọi nhận định về hành vi API (mã lỗi trả về, response shape) suy từ đọc mã nguồn `errorHandler.plugin.ts` + controller + validator, không phải quan sát runtime.
- **Không sửa bất kỳ file mã nguồn nào** (`.ts`/`.tsx`/`.prisma`) — chỉ ghi file `.md`.

---

## 1. Mục tiêu nghiệp vụ (Business Goals)

1. **Thu thập chuẩn hóa 8 khối dữ liệu biến động lương theo kỳ**: cho phép kế toán/HR nhập chấm công, tăng ca, KPI, thưởng, lương sản phẩm, lương phần trăm, chuyên cần, ứng — bù trừ theo từng kỳ tính lương (tháng), tái sử dụng dữ liệu giữa các nhân viên để giảm thao tác lặp lại.
2. **Vòng đời kỳ lương có kiểm soát (Payroll Period Governance)**: kỳ lương đi qua 6 trạng thái (`DRAFT → PENDING_REVIEW → LOCKED → APPROVED → PAID → ARCHIVED`), khóa sổ là **bất biến một chiều** trừ thao tác Reopen có kiểm soát chặt (chỉ vai trò được ủy quyền, có giải trình, có vết kiểm toán).
3. **Một bộ tính lương tổng hợp duy nhất, nhất quán với cấu hình doanh nghiệp đã khai báo**: bảng lương 18 cột phải phản ánh đúng các tham số đã cấu hình ở "Cài đặt lương" (`SalaryItem`/`EmployeeSalary`) và "Cấu hình mặc định" (`hrm_general_settings`) — không được tính cứng theo số liệu độc lập với những gì doanh nghiệp đã khai báo.
4. **Toàn vẹn dữ liệu tài chính đã chốt**: một khi kỳ đã khóa sổ, số liệu snapshot không bị ảnh hưởng bởi thay đổi hồ sơ nhân sự/danh mục về sau.

---

## 2. Actors

| Actor | Vai trò nghiệp vụ | Trạng thái triển khai quyền hạn |
|---|---|---|
| Nhân viên nhập liệu (kế toán/HR phụ trách kỳ lương) | Nhập 8 khối dữ liệu biến động khi kỳ ở `DRAFT`/`PENDING_REVIEW`, tạo/trình duyệt kỳ | ✅ Đủ quyền qua guard `requireModule('hrm')` chung (`be_maxv/src/routes/hrm/hrm.route.ts:34-39`) |
| Kế toán trưởng | Khóa sổ (`lock`) kỳ lương sau khi rà soát | ⚠️ Không có phân biệt vai trò — bất kỳ ai qua được `requireModule('hrm')` cũng gọi được `lock` (xem Mục 5, BR-dltl-001) |
| Quản trị viên (ADMIN/OWNER) | **Duy nhất** được phép Reopen kỳ đã khóa | ❌ **Chưa triển khai** — route `/payroll-periods/:id/reopen` không có role guard riêng nào (xem Mục 5, BR-dltl-002 — Phát hiện đối soát 🔴) |
| Ban Giám đốc | Phê duyệt (`approve`) kỳ đã khóa sổ | ⚠️ Cùng tình trạng: không phân biệt vai trò ở tầng route |
| Nhân viên (self-service) | Xem phiếu lương cá nhân khi kỳ đã `PAID` | ❌ **Chưa triển khai** — endpoint `GET /payroll/payslips/my` được liệt kê trong `BA_ANALYSIS_SPEC.md` Mục 4.4 nhưng **không tồn tại** trong `be_maxv/src/routes/hrm/du_lieu_tinh_luong/payrollCalculation.route.ts` (file chỉ có 2 route: `/payroll/calculate`, `/payroll/sheet-lines`) |

---

## 3. Phạm vi chức năng (Scope)

### 3.1. Kỳ tính lương (`PayrollPeriod`)
Vòng đời 6 trạng thái, mỗi kỳ gắn `code` duy nhất định dạng `YYYY-MM`. Chi tiết vòng đời và bằng chứng triển khai: xem Mục 6 (Vòng đời trạng thái) và Mục 5 (BR-dltl-001, BR-dltl-002).

### 3.2. Tám phân hệ nhập liệu biến động (`/payroll-data/*`)
Giữ nguyên phạm vi nghiệp vụ đã mô tả đúng trong `BA_ANALYSIS_SPEC.md` Mục 1 và Mục 3 (không lặp lại ở đây) — 8 khối: Chấm công, Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Chuyên cần, Ứng — Bù trừ. Tất cả dùng chung khuôn mẫu 3 phạm vi áp dụng (`toan_cong_ty` / `phong_ban` / `nhan_vien`) qua `resolveTargetEmployees()` (`be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts:23-66`).

**Khác biệt so với mô tả gốc — cần ghi nhận:**
- Nút "Đặt lại theo lịch chuẩn" và endpoint `POST /payroll-data/attendance/batch-override` mà `BA_ANALYSIS_SPEC.md` Mục 3 dòng 1 và Mục 4.3 điểm 1 mô tả **không tồn tại** trong `be_maxv/src/routes/hrm/du_lieu_tinh_luong/payrollInputs.route.ts` (file chỉ có `GET .../attendance/matrix` và `PUT .../attendance/cell`, không có `POST .../attendance/batch-override`).
- Cơ chế "áp dụng hàng loạt" (`apply`) của cả 6 phân hệ có nút "Tái sử dụng" (Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Ứng-bù trừ) đều theo khuôn: **xóa toàn bộ bản ghi hiện có của (các) nhân viên trong phạm vi, rồi tạo lại từ danh sách `items` gửi lên** (vd `applyKpi`: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts:329-354`, cùng khuôn ở `applyOvertime`, `applyBonus`, `applyPiecework`, `applyCommission`, `applyAdjustments`). Hệ quả nghiệp vụ: client (FE) **bắt buộc phải gửi đủ toàn bộ danh sách dòng hiện có** mỗi lần "áp dụng", không phải chỉ phần thay đổi — nếu FE tưởng nhầm là API hỗ trợ "thêm 1 dòng" thì sẽ **xóa mất các dòng khác đã có**. Đánh dấu `OQ-dltl-006` (Mục 8).

### 3.3. Bộ tính bảng lương tổng hợp 18 cột (`PayrollCalculationEngine`)
`calculatePayrollPreview()` (`be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts:33-308`) gộp Master Data (`hrm_nhan_vien`, `hrm_hop_dong`, `hrm_nguoi_phu_thuoc`), Set lương đã duyệt (`EmployeeSalary` trạng thái `APPROVED`), Cấu hình mặc định (`GeneralSetting`) và 8 khối dữ liệu biến động của kỳ để tính ra 18 cột lương/người. Khi kỳ `LOCKED` trở lên, `snapshotPayrollSheet()` chốt kết quả bất biến vào `hrm_payroll_sheet_lines`.

**Phát hiện quan trọng nhất của đợt kiểm định — xem chi tiết Mục 5 BR-dltl-023 (mới thêm, không có trong `BA_ANALYSIS_SPEC.md`):** động cơ tính lương chỉ đọc đúng **2 trong khoảng 15 tham số** cấu hình được từ `hrm_general_settings` (`personalDeduction`, `dependentDeduction` — `payrollCalculation.service.ts:137-138`), còn lại đều **hardcode trong mã nguồn**, bỏ qua giá trị doanh nghiệp đã cấu hình.

---

## 4. Ánh xạ API Endpoints thật (đối soát `be_maxv` — đã đọc từng route file)

> Bảng dưới đối chiếu **đúng những gì mã nguồn thật đăng ký**, không phải những gì tài liệu mô tả. Cột "Khớp BA_ANALYSIS_SPEC" đánh dấu lệch nếu có.

### 4.1. Kỳ lương (`payrollPeriods.route.ts`, 11 endpoint) — khớp 100% với `BA_ANALYSIS_SPEC.md` Mục 4.1 về path/verb
`GET /payroll-periods` · `POST /payroll-periods` · `GET /payroll-periods/:id` · `PATCH /payroll-periods/:id` · `DELETE /payroll-periods/:id` · `POST .../submit` · `.../reject` · `.../lock` · `.../reopen` · `.../approve` · `.../mark-paid` · `.../archive`.

**Lệch hành vi (không lệch path) — xem BR-dltl-001, BR-dltl-002:** `lock` cho phép chuyển cả từ `DRAFT` lẫn `PENDING_REVIEW` (`payrollPeriods.service.ts:156-161`), trong khi văn bản đặc tả mô tả transition là `PENDING_REVIEW -> LOCKED` (ngụ ý bắt buộc qua bước trình duyệt trước) — đánh dấu `OQ-dltl-009`.

### 4.2. Danh mục chuyên biệt (`catalogs.route.ts`, 16 endpoint) — khớp 100%
4 nhóm × (`GET`, `POST`, `PATCH /:id`, `DELETE /:id`): `kpi-items`, `products`, `diligence-types`, `adjustment-items`.

### 4.3. Tám phân hệ nhập liệu (`payrollInputs.route.ts`, 16 endpoint) — khớp path/verb, **thiếu 1 endpoint** so với đặc tả (xem Mục 3.2)
Đủ `GET`/`apply` cho 8 phân hệ, riêng Chấm công chỉ có `matrix` + `cell` (thiếu `batch-override`), Tăng ca và Chuyên cần có thêm `DELETE`.

### 4.4. Bảng lương & Snapshot (`payrollCalculation.route.ts`, **2 endpoint**, KHÔNG phải 3 như đặc tả)
`GET /payroll/calculate` · `GET /payroll/sheet-lines`. **Không có** `GET /payroll/payslips/my`.

---

## 5. Bảng Quy tắc Nghiệp vụ (Business Rules) & Đối soát Triển khai

**Chú giải cột "Trạng thái":** ✅ Đã triển khai đúng như mô tả (có bằng chứng) · ⚠️ Triển khai một phần / lệch một phần / hành vi khác ý định · ❌ Chưa triển khai (mã lỗi chỉ tồn tại trên giấy, không có code path nào ném ra).

| Mã | Tên quy tắc | Mô tả | Mã lỗi | Trạng thái | Bằng chứng `file:line` |
|---|---|---|---|:---:|---|
| BR-dltl-001 | Bất biến khóa sổ | Kỳ ở `LOCKED`/`APPROVED`/`PAID`/`ARCHIVED` → chặn mọi ghi (`POST`/`PUT`/`PATCH`/`DELETE`) trên 8 phân hệ nhập liệu | E-dltl-001 | ✅ | `helpers/payrollPeriodLockGuard.ts:29-37`, gọi ở đầu mọi hàm ghi của `payrollInputs.service.ts` (vd dòng 109, 198, 310, 403, 484, 577, 715, 816) |
| BR-dltl-002 | Reopen có kiểm soát | Chỉ vai trò ADMIN/OWNER được mở lại kỳ `LOCKED`; bắt buộc lý do ≥ 20 ký tự; ghi sự kiện `PAYROLL_PERIOD_REOPENED` vào Audit Log | — | ❌ (2/3 tiêu chí thiếu) | Lý do ≥20 ký tự: ✅ `validators/.../payrollPeriods.validator.ts:26-31`. Role ADMIN-only: ❌ route không có preHandler riêng (`routes/.../payrollPeriods.route.ts:15`, guard chung `hrm.route.ts:34-39`). Audit Log: ❌ tham số `_input`/`_userId` bị bỏ qua có chủ đích (prefix `_`) tại `services/.../payrollPeriods.service.ts:181-201`; **không có bảng audit log nào trong `schema.prisma` tenant** để ghi vào (đã grep xác nhận) |
| BR-dltl-003 | Nhân viên hợp lệ theo kỳ | Nhân viên áp dụng phải đang hoạt động và có hợp đồng lao động bao phủ khoảng thời gian của kỳ tính lương | E-dltl-002 | ❌ | `resolveTargetEmployees()` (`payrollInputs.service.ts:23-66`) chỉ lọc `status:'1', da_xoa:false`, **không** kiểm tra `hrm_hop_dong.ngay_bat_dau`/`ngay_ket_thuc` có phủ kỳ hay không; scope `nhan_vien` mà 1 phần `employeeIds` không khớp cũng **không báo lỗi**, chỉ âm thầm bỏ qua |
| BR-dltl-004 | Phạm vi phòng ban bắt buộc chọn | Áp dụng theo `phong_ban` mà không truyền `ma_pb` → từ chối | E-dltl-003 | ✅ | `payrollInputs.service.ts:38-44` |
| BR-dltl-005 | Phạm vi nhân viên không rỗng | Áp dụng theo `nhan_vien` mà `employeeIds` rỗng/thiếu → từ chối | E-dltl-004 | ✅ | `payrollInputs.service.ts:53-59` |
| BR-dltl-006 | Giờ công hợp lệ | Giờ công 1 ngày không âm, không vượt số giờ chuẩn/ngày | E-dltl-005 | ⚠️ | Validator chặn khoảng **0–24h** (`validators/.../inputs.validator.ts:28`), KHÔNG phải "số giờ chuẩn trong ngày" (8h theo `GeneralSetting.standardHoursPerDay`) như thông điệp lỗi mô tả — chặn theo giới hạn vật lý 1 ngày, không theo cấu hình nghiệp vụ. `workDayValue` từng ngày cũng không bị chặn trần 1.0 (`services/.../payrollInputs.service.ts:112-113`), chỉ bị chặn gián tiếp ở **tổng cả tháng** qua `Math.min(actualWorkDays, standardWorkDays)` (`payrollCalculation.service.ts:157`) |
| BR-dltl-007 | Không trùng loại tăng ca | 1 bảng áp dụng của 1 nhân viên không được khai 2 dòng cùng `otType` | E-dltl-006 | ✅ | `payrollInputs.service.ts:200-207` |
| BR-dltl-008 | Giờ tăng ca dương | `hours > 0` | E-dltl-007 | ⚠️ Chỉ Zod | `validators/.../inputs.validator.ts:50` — enforce đúng nhưng **response lỗi không mang field `code`/`errorCode` = "E-dltl-007"** (xem Mục 7) |
| BR-dltl-009 | Cảnh báo trần giờ tăng ca | Cảnh báo (không chặn) khi tổng OT vượt trần tháng/năm | — | ⚠️ Một nửa, hardcode | Trần tháng: có cảnh báo (`isWarningMonth: totalHours > 40` — `payrollInputs.service.ts:192`) nhưng **hardcode số 40**, không đọc `GeneralSetting.maxOtHoursPerMonth` (mặc định cũng là 40, nhưng đổi cấu hình sẽ không đổi cảnh báo). Trần **năm** (`maxOtHoursPerYear`, mặc định 300h) **hoàn toàn chưa có code path nào tính** — không cộng dồn OT qua nhiều kỳ trong năm |
| BR-dltl-010 | Dòng KPI hợp lệ, không trùng | Mỗi dòng phải chọn `kpiItemId` hợp lệ; không trùng chỉ tiêu trong bảng | E-dltl-008, E-dltl-009 | ✅ (E-dltl-009) / ⚠️ Chỉ Zod (E-dltl-008) | Trùng: `payrollInputs.service.ts:313-321`. Chọn hợp lệ: `validators/.../inputs.validator.ts:61` |
| BR-dltl-011 | Tổng trọng số KPI dương | `Σweight > 0` khi có ít nhất 1 dòng | E-dltl-010 | ✅ | `payrollInputs.service.ts:323-325` |
| BR-dltl-012 | Khoản thưởng hợp lệ, không trùng | Không trùng `salaryItemId` (loại `PERIODIC_BONUS`) trong bảng của 1 NV; số tiền ≥ 0 | E-dltl-011, E-dltl-012 | ✅ (011) / ⚠️ Chỉ Zod (012) | Trùng: `payrollInputs.service.ts:406-412`. Số tiền: `validators/.../inputs.validator.ts:76` |
| BR-dltl-013 | Dòng lương sản phẩm hợp lệ, không trùng | Chọn `productId` hợp lệ; không trùng sản phẩm; đơn giá/số lượng ≥ 0 | E-dltl-013, E-dltl-014, E-dltl-015 | ✅ (014) / ⚠️ Chỉ Zod (013, 015) | Trùng: `payrollInputs.service.ts:487-493`. Còn lại: `validators/.../inputs.validator.ts:87-89` |
| BR-dltl-014 | Bất biến snapshot đơn giá sản phẩm | `PieceworkRecord.unitPrice` sao chép cố định tại thời điểm áp dụng (cho override thủ công); đổi giá danh mục về sau không ảnh hưởng bản ghi cũ | — | ✅ | `payrollInputs.service.ts:498-524` — `unitPrice = it.unitPrice ?? catalogPriceMap.get(productId) ?? 0`, ghi thẳng vào record, không tham chiếu động tới `PieceworkProduct` |
| BR-dltl-015 | Khoản hoa hồng hợp lệ, không trùng | Không trùng `salaryItemId` (loại `COMMISSION_PERCENTAGE`) trong bảng; tỷ lệ 0–100% | E-dltl-016, E-dltl-017 | ✅ (016) / ⚠️ Chỉ Zod (017) | Trùng: `payrollInputs.service.ts:583-586`. Tỷ lệ: `validators/.../inputs.validator.ts:101` |
| BR-dltl-016 | Bất biến snapshot tỷ lệ hoa hồng | `CommissionRecord.commissionRate` sao chép cố định (mặc định lấy `SalaryItem.defaultRate`, cho override thủ công) | — | ✅ | `payrollInputs.service.ts:590-611` |
| BR-dltl-017 | Dòng chuyên cần hợp lệ, không trùng | Chọn loại lỗi + ngày hợp lệ; không trùng (nhân viên, loại lỗi, ngày) | E-dltl-018, E-dltl-019, E-dltl-020 | ✅ (019) / ⚠️ Chỉ Zod (018, 020) | Trùng: `payrollInputs.service.ts:719-733` (unique index `periodId_ma_nv_violationTypeId_violationDate` hậu thuẫn ở DB). Còn lại: `validators/.../inputs.validator.ts:116-117` |
| BR-dltl-018 | Bất biến chặn sàn chuyên cần | `tong_tru = min(Σphạt, đơn_giá)`; `thành_tiền = max(0, đơn_giá − tong_tru) ≥ 0`; bảng rỗng = hưởng 100%; đơn giá tra từ `EmployeeSalary` khoản loại `ATTENDANCE_ALLOWANCE` đang `APPROVED` | E-dltl-016 (chặn sàn không phát sinh mã lỗi riêng — là công thức, không phải validation input) | ✅ | Cài đúng **2 nơi độc lập, khớp nhau**: hiển thị/preview `payrollInputs.service.ts:693-699`; tính lương thật `payrollCalculation.service.ts:198-220`. Test xác nhận công thức đúng: `__tests__/hrmPayrollInputData.test.ts:417-425` |
| BR-dltl-019 | Dòng ứng-bù trừ hợp lệ, không trùng | Chọn khoản hợp lệ; không trùng khoản trong bảng của 1 NV; số tiền > 0 | E-dltl-021, E-dltl-022, E-dltl-023 | ✅ (022) / ⚠️ Chỉ Zod (021, 023) | Trùng: `payrollInputs.service.ts:819-825`. Còn lại: `validators/.../inputs.validator.ts:124-125` |
| BR-dltl-020 | Công thức tổng bù trừ ròng | `netAdjustment = Σ(chiều 'tru') − Σ(chiều 'bu')`; dương làm giảm thực lĩnh, âm làm tăng thực lĩnh | — | ✅ | `payrollInputs.service.ts:790-801` (preview) và `payrollCalculation.service.ts:223-231` (tính lương thật) — khớp nhau |
| BR-dltl-021 | Bất biến công nợ thực lĩnh âm (EC-03) | Khi khấu trừ vượt thu nhập kiếm được trong kỳ, `netTakeHomeSalary` **giữ nguyên số âm**, không ép về 0 | — | ✅ | `payrollCalculation.service.ts:259-264` — không có `Math.max(0, ...)` bao ngoài công thức trừ |
| BR-dltl-022 | Bất biến toàn vẹn giao dịch | Mọi `apply` hàng loạt và chuyển trạng thái kỳ (đặc biệt `lock` kèm chốt snapshot) chạy trong 1 Prisma transaction | — | ✅ | `db.$transaction` bọc đủ 6 hàm `apply*` (vd `payrollInputs.service.ts:221`, `:329`, `:416`, `:503`, `:595`, `:829`) và `lockPayrollPeriod` (`payrollPeriods.service.ts:163-176`) |
| BR-dltl-023 *(mới, không có trong `BA_ANALYSIS_SPEC.md`)* | Số liệu lương phải nhất quán với Cấu hình mặc định đã khai báo | Mọi tham số tính lương có mặt trong `hrm_general_settings` (ngày công chuẩn, giờ chuẩn/ngày, tỷ lệ bảo hiểm, đoàn phí, biểu thuế) phải đọc từ đó, không hardcode | — | ❌ **Phát hiện đối soát mức 🔴** | Chỉ đọc đúng `personalDeduction`, `dependentDeduction` (`payrollCalculation.service.ts:137-138`). **Hardcode**: `standardWorkDays = 26` (dòng 136, bỏ qua `GeneralSetting.standardWorkingDaysMethod`), `8.0` giờ chuẩn/ngày (dòng 163, bỏ qua `standardHoursPerDay`), `employeeInsuranceRate = 0.105`/`companyInsuranceRate = 0.215` (dòng 244–247, bỏ qua 6 trường `insurance*`), đoàn phí `1%`/trần `234_000`/`2%` (dòng 249–250, bỏ qua `unionFee*`), biểu thuế TNCN 7 bậc viết cứng trong `tinhThueLuyTien()` (dòng 7–28, bỏ qua field `taxBrackets Json` vốn được thiết kế sẵn để chứa đúng dữ liệu này) |

---

## 6. Vòng đời trạng thái Kỳ tính lương (`PayrollPeriod`)

### 6.1. Bảng chuyển đổi trạng thái

| Từ | Sang | Hành động (endpoint) | Điều kiện | Trạng thái triển khai |
|---|---|---|---|---|
| *(mới)* | `DRAFT` | `POST /payroll-periods` | `code` (YYYY-MM) chưa tồn tại | ✅ 409 khi trùng — `payrollPeriods.service.ts:71-96` |
| `DRAFT` | `PENDING_REVIEW` | `POST .../submit` | Đang ở `DRAFT` | ✅ `payrollPeriods.service.ts:127-138` |
| `PENDING_REVIEW` | `DRAFT` | `POST .../reject` | Đang ở `PENDING_REVIEW` | ✅ `payrollPeriods.service.ts:140-151` |
| `DRAFT` hoặc `PENDING_REVIEW` | `LOCKED` | `POST .../lock` | Không ở `LOCKED+`; chốt snapshot 18 cột vào `hrm_payroll_sheet_lines` | ⚠️ Cho khóa thẳng từ `DRAFT`, bỏ qua bước trình duyệt — xem `OQ-dltl-009` |
| `LOCKED` | `DRAFT` | `POST .../reopen` | Lý do ≥ 20 ký tự | ⚠️ Thiếu role-guard + audit log — xem BR-dltl-002 |
| `LOCKED` | `APPROVED` | `POST .../approve` | Đang ở `LOCKED` | ✅ `payrollPeriods.service.ts:203-218` |
| `APPROVED` | `PAID` | `POST .../mark-paid` | Đang ở `APPROVED` | ✅ `payrollPeriods.service.ts:220-231` |
| `PAID` | `ARCHIVED` | `POST .../archive` | Đang ở `PAID` | ✅ `payrollPeriods.service.ts:233-244` |
| `DRAFT` | *(xóa)* | `DELETE /payroll-periods/:id` | Chỉ khi `DRAFT` | ✅ `payrollPeriods.service.ts:111-125` |

### 6.2. Quy tắc read-only theo trạng thái — LỆCH giữa 3 tầng, cần chốt lại

| Trạng thái | Backend guard 8 phân hệ (`payrollPeriodLockGuard.ts`) | Backend `updatePayrollPeriod` (sửa tên/ngày kỳ) | Frontend `PayrollPeriodContext.isReadOnly` |
|---|:---:|:---:|:---:|
| `DRAFT` | Ghi được | Sửa được | Sửa được |
| `PENDING_REVIEW` | **Ghi được** | **Chặn** (`E-dltl-001`) | **Chặn** (`isReadOnly = true`) |
| `LOCKED`+ | Chặn | Chặn | Chặn |

Ba tầng không thống nhất ở trạng thái `PENDING_REVIEW`: 8 phân hệ dữ liệu **được phép ghi** ở tầng Backend (đúng ý đặc tả Mục 4.3: "chặn khi kỳ ≠ DRAFT/PENDING_REVIEW"), nhưng **Frontend khóa toàn bộ giao diện nhập liệu** ngay khi kỳ chuyển `PENDING_REVIEW` (`PayrollPeriodContext.tsx:36`) — nghĩa là qua đường UI thật, "cửa sổ vẫn sửa được khi đang chờ duyệt" không bao giờ dùng tới được, chỉ lộ ra khi gọi thẳng API. Xem `OQ-dltl-010`.

---

## 7. Ma trận Mã lỗi chuẩn hóa (Error Matrix)

**Chú giải cột "Cơ chế trả về":**
- **PayrollError (mã thật)** — response `{ success:false, code:"E-dltl-xxx", errorCode:"E-dltl-xxx", message }` qua `errorHandler.plugin.ts:26-33`. Client/QA có thể `assert response.body.code === 'E-dltl-xxx'`.
- **Zod (message-only)** — rule CÓ được kiểm tra và request CÓ bị từ chối (400), nhưng response là `{ success:false, errors: [...ZodIssue] }` (`errorHandler.plugin.ts:34-38`, `helpers/errors.ts:43-47`) — **không có field `code`**. Mã `E-dltl-xxx` chỉ là chuỗi con nằm trong `message` tiếng Việt của một ZodIssue, không phải giá trị máy đọc được ở cấp response.
- **Chưa triển khai** — không có bất kỳ code path nào (service, validator, hay nơi khác) ném ra mã này.

| Mã lỗi | Thông điệp | HTTP | Cơ chế trả về | Ghi chú kiểm định |
|---|---|:---:|---|---|
| E-dltl-001 | Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu | 403 | **PayrollError** | Cũng bị tái sử dụng cho case "sửa tên/ngày kỳ khi không ở DRAFT" (`payrollPeriods.service.ts:101-103`) — hai ngữ cảnh khác nhau dùng chung 1 mã, cân nhắc tách |
| E-dltl-002 | Nhân viên không tồn tại hoặc không có hợp đồng lao động bao phủ kỳ tính lương | 400 | **Chưa triển khai** | Xem BR-dltl-003 |
| E-dltl-003 | Chưa chọn phòng ban khi áp dụng theo phạm vi phòng ban | 400 | **PayrollError** | — |
| E-dltl-004 | Danh sách nhân viên áp dụng không được để trống | 400 | **PayrollError** | — |
| E-dltl-005 | Số giờ công không được âm hoặc vượt quá số giờ chuẩn trong ngày | 400 | **Zod (message-only)** | Cận trên thật là 24h, không phải "số giờ chuẩn" — xem BR-dltl-006 |
| E-dltl-006 | Loại tăng ca bị lặp lại trong bảng của nhân viên | 400 | **PayrollError** | — |
| E-dltl-007 | Số giờ tăng ca phải lớn hơn 0 | 400 | **Zod (message-only)** | — |
| E-dltl-008 | Còn dòng chưa chọn chỉ tiêu KPI hoặc mã chỉ tiêu không hợp lệ | 400 | **Zod (message-only)** | — |
| E-dltl-009 | Chỉ tiêu KPI bị lặp lại trong bảng | 400 | **PayrollError** | — |
| E-dltl-010 | Tổng trọng số KPI phải lớn hơn 0 | 400 | **PayrollError** | — |
| E-dltl-011 | Khoản thưởng bị lặp lại trong bảng của nhân viên | 400 | **PayrollError** | — |
| E-dltl-012 | Số tiền thưởng phải lớn hơn hoặc bằng 0 | 400 | **Zod (message-only)** | — |
| E-dltl-013 | Còn dòng sản phẩm chưa chọn mã sản phẩm hợp lệ | 400 | **Zod (message-only)** | — |
| E-dltl-014 | Sản phẩm bị lặp lại trong bảng lương sản phẩm | 400 | **PayrollError** | — |
| E-dltl-015 | Đơn giá hoặc số lượng sản phẩm không được âm | 400 | **Zod (message-only)** | — |
| E-dltl-016 | Khoản lương phần trăm bị lặp lại trong bảng | 400 | **PayrollError** | — |
| E-dltl-017 | Tỷ lệ hoa hồng phải từ 0% đến 100% | 400 | **Zod (message-only)** | — |
| E-dltl-018 | Còn dòng chuyên cần chưa chọn loại lỗi hoặc chưa điền ngày | 400 | **Zod (message-only)** | — |
| E-dltl-019 | Lỗi chuyên cần bị khai báo trùng lặp cho cùng một ngày | 400 | **PayrollError** | — |
| E-dltl-020 | Số giờ vi phạm chuyên cần không được âm | 400 | **Zod (message-only)** | — |
| E-dltl-021 | Còn dòng bù trừ chưa chọn khoản hoặc mã khoản không hợp lệ | 400 | **Zod (message-only)** | — |
| E-dltl-022 | Khoản bù trừ bị lặp lại trong bảng của nhân viên | 400 | **PayrollError** | — |
| E-dltl-023 | Số tiền bù trừ phải lớn hơn 0 | 400 | **Zod (message-only)** | — |
| E-dltl-024 | File Excel nhập vào không đúng cấu trúc mẫu quy định | 400 | **Chưa triển khai** | Không có endpoint import Excel nào ở backend; toàn bộ 7 file `*Excel.ts` ở FE (`kpiExcel.ts`, `buTruExcel.ts`, `thuongExcel.ts`, `tangCaExcel.ts`, `chuyenCanExcel.ts`, `luongSanPhamExcel.ts`, `luongPhanTramExcel.ts`) đọc/ghi 100% phía trình duyệt bằng `exceljs`, không gọi API — xem `OQ-dltl-007` |
| E-dltl-025 | Kỳ lương không tồn tại trong hệ thống | 404 | **PayrollError** | — |
| E-dltl-026 | Đang có thao tác khóa sổ kỳ lương đồng thời, vui lòng thử lại | 409 | **Chưa triển khai** | Không có optimistic lock/mutex nào bảo vệ `lockPayrollPeriod` khỏi 2 lượt gọi đồng thời |

---

## 8. Câu hỏi mở (Open Questions) — KHÔNG tự suy đoán, cần BA/Product/Architect chốt

| Mã | Câu hỏi | Vì sao mở |
|---|---|---|
| OQ-dltl-001 | `standardWorkDays` (26 ngày) có nên đọc động từ `GeneralSetting.standardWorkingDaysMethod` (`FIXED_26`/`FIXED_24`/`ACTUAL_MONTH`) thay vì hardcode? | BR-dltl-023 — hardcode làm cấu hình "Cấu hình mặc định" vô nghĩa với riêng module này |
| OQ-dltl-002 | Tỷ lệ bảo hiểm/đoàn phí/biểu thuế TNCN nên đọc từ `GeneralSetting` (theo đúng thiết kế field đã có) hay **cố ý** giữ hardcode (lý do: đơn giản hóa, không muốn tenant tự chỉnh luật)? Nếu cố ý giữ hardcode thì cần ghi rõ thành quyết định kiến trúc (ADR), không để ngầm định | BR-dltl-023 |
| OQ-dltl-003 | Audit Log cho hành động Reopen nên lưu ở đâu — có bảng audit chung nào của `be_maxv` để tái dùng (module khác có nhắc "BR-hrm-066 nhóm 6 — ghi nhật ký kiểm toán" ở Cấu hình mặc định) hay cần tạo bảng riêng cho `PayrollPeriod`? | BR-dltl-002 — hiện chưa có bảng audit nào trong tenant schema |
| OQ-dltl-004 | "ADMIN" trong BR-dltl-002 nên map vào role nào thật của hệ thống phân quyền `be_maxv` (`OWNER`/`OWNER_EMPLOYEE`/khác) — tham khảo tiền lệ "Cấu hình mặc định" đã quyết định `PUT` chỉ dành cho `OWNER` | BR-dltl-002 |
| OQ-dltl-005 | Cảnh báo trần OT 300h/năm: chặn cứng hay chỉ cảnh báo? Cộng dồn theo năm dương lịch hay năm tài chính? Cộng dồn qua nhiều `PayrollPeriod` bằng cách nào (không có FK nào nối OT record với "năm" ngoài field `year` của `PayrollPeriod` chứa nó)? | BR-dltl-009 |
| OQ-dltl-006 | Cơ chế "áp dụng hàng loạt" hiện tại là XÓA-TẤT-CẢ-RỒI-TẠO-LẠI cho (các) nhân viên trong phạm vi. Khi nối lại 8 Panel FE thật (xem Mục 9), FE có đảm bảo luôn gửi đủ toàn bộ danh sách dòng hiện có (không chỉ phần vừa sửa) không? Rủi ro mất dữ liệu nếu FE gửi thiếu | Mục 3.2 |
| OQ-dltl-007 | Excel Import — có bắt buộc phải có 1 endpoint backend riêng để đạt được "Atomic Rollback" + "danh sách dòng lỗi chi tiết" (E-dltl-024) như spec mô tả, hay chấp nhận luồng: FE parse Excel → gọi lại đúng API `apply*` sẵn có (đã có transaction, nhưng lỗi trả về là toàn bộ request bị từ chối bởi Zod, không có "danh sách dòng lỗi" chi tiết theo từng dòng Excel)? | E-dltl-024 |
| OQ-dltl-008 | `updatePayrollPeriod` (sửa tên/ngày kỳ) hiện chặn ở mọi trạng thái khác `DRAFT`. Có nên nới cho `PENDING_REVIEW` giống 8 phân hệ dữ liệu, hay đây là chủ đích (tên/ngày kỳ là metadata quan trọng hơn, khóa sớm hơn dữ liệu biến động)? | BR-dltl-001, Mục 6.2 |
| OQ-dltl-009 | `lock` cho khóa thẳng từ `DRAFT`, bỏ qua `PENDING_REVIEW`. Có phải hành vi mong muốn ("rush lock" khi không cần đối soát) hay bắt buộc phải qua `submit` trước? | Mục 4.1, Mục 6.1 |
| OQ-dltl-010 | `PENDING_REVIEW` có thực sự nên "vẫn sửa được" (như Backend + đặc tả Mục 4.3 ngụ ý) hay cố ý "đóng băng ngay khi trình duyệt" (như FE hiện triển khai)? Cần chốt 1 lần rồi đồng bộ cả 3 tầng (guard BE 8-phân-hệ, `updatePayrollPeriod`, FE `isReadOnly`) | Mục 6.2 |

---

## 9. Non-Functional Requirements (NFR)

| Mã | Yêu cầu | Trạng thái |
|---|---|---|
| NFR-dltl-001 | Cô lập dữ liệu đa tenant: mọi truy vấn phải qua `resolveTenantDb(req)`, không rò dữ liệu chéo công ty | ✅ Toàn bộ 4 controller đều gọi `resolveTenantDb(req)` đầu hàm — đã đọc xác nhận cả 4 file |
| NFR-dltl-002 | Toàn vẹn giao dịch: thao tác ảnh hưởng nhiều bản ghi phải atomic | ✅ Xem BR-dltl-022 |
| NFR-dltl-003 | Khả năng kiểm toán (Auditability): hành động nhạy cảm (Reopen kỳ đã khóa) phải để lại vết không thể chối bỏ | ❌ Xem BR-dltl-002 — hiện không có cơ chế nào |
| NFR-dltl-004 | Điều khiển truy cập theo vai trò cho hành động tài chính nhạy cảm (Reopen, Lock) | ❌ Xem BR-dltl-002, Mục 2 |
| NFR-dltl-005 | Nhất quán cấu hình: mọi tham số tính lương phải đồng bộ với "Cấu hình mặc định" đã khai báo, không phân kỳ âm thầm | ❌ Xem BR-dltl-023 |
| NFR-dltl-006 | Điều khiển đồng thời (Concurrency): 2 người cùng khóa sổ 1 kỳ không được gây trạng thái không nhất quán | ❌ Xem E-dltl-026 |

---

## 10. User Stories & Acceptance Criteria (Given/When/Then)

> AC dưới đây phản ánh **hành vi mong đợi theo đúng ý định nghiệp vụ đã công bố** (không phải luôn khớp hành vi hiện tại) — dùng làm cơ sở cho Tester-QA viết test case và cho Architect quyết định sửa hay chấp nhận (accept) từng lệch.

**US-dltl-01**: Là kế toán trưởng, tôi muốn khóa sổ kỳ lương để chốt số liệu, để dữ liệu không bị sửa sau khi đã duyệt xong.
- AC-dltl-01: Given kỳ đang `PENDING_REVIEW`, When gọi `lock`, Then kỳ chuyển `LOCKED` và một bản ghi `PayrollSheetLine` đủ 18 cột được tạo cho mỗi nhân viên đang hoạt động.
- AC-dltl-02: Given kỳ đã `LOCKED`, When bất kỳ client nào gọi `POST /payroll-data/*/apply` cho kỳ đó, Then hệ thống trả 403 kèm `code = "E-dltl-001"`.

**US-dltl-02**: Là quản trị viên (ADMIN), tôi muốn mở lại 1 kỳ đã khóa khi phát hiện sai sót, nhưng hành động này phải được kiểm soát chặt vì nó phá vỡ tính bất biến của số liệu đã chốt.
- AC-dltl-03: Given tôi KHÔNG có vai trò ADMIN/OWNER, When tôi gọi `reopen`, Then hệ thống từ chối (403) — **hiện KHÔNG đạt**, mọi user qua được `requireModule('hrm')` đều reopen được (xem BR-dltl-002).
- AC-dltl-04: Given tôi có vai trò hợp lệ và nhập lý do ≥ 20 ký tự, When gọi `reopen`, Then kỳ chuyển về `DRAFT` VÀ một bản ghi audit log được tạo mang đúng lý do đã nhập — **vế audit log hiện KHÔNG đạt**.

**US-dltl-03**: Là kế toán, tôi muốn nhập chấm công theo mô hình "delta" (chỉ ghi ngày khác chuẩn), để không phải nhập lại 26 ngày công chuẩn cho từng người.
- AC-dltl-05: Given nhân viên chưa có bản ghi `AttendanceRecord` nào trong kỳ, When xem bảng lương preview, Then `actualWorkDays` của người đó bằng đúng `standardWorkDays` cấu hình cho doanh nghiệp (không phải số 26 cố định nếu doanh nghiệp đã đổi cấu hình) — **hiện KHÔNG đạt** vì `standardWorkDays` hardcode (BR-dltl-023).

**US-dltl-04**: Là kế toán, tôi muốn nhập tăng ca và được cảnh báo khi vượt trần luật định, để tránh vi phạm Bộ luật Lao động.
- AC-dltl-06: Given tổng giờ OT trong tháng của 1 nhân viên vượt `GeneralSetting.maxOtHoursPerMonth`, When xem danh sách tăng ca, Then dòng của người đó có cờ cảnh báo — **hiện đạt một phần** (có cờ nhưng ngưỡng hardcode 40, không đọc cấu hình).
- AC-dltl-07: Given tổng giờ OT cộng dồn trong năm của 1 nhân viên vượt `GeneralSetting.maxOtHoursPerYear`, When xem danh sách tăng ca, Then có cảnh báo tương ứng — **hiện KHÔNG đạt**, chưa có code path nào tính theo năm.

**US-dltl-05**: Là kế toán, tôi muốn nhập vi phạm chuyên cần và hệ thống tự tính phụ cấp còn lại, không bao giờ để âm.
- AC-dltl-08: Given đơn giá chuyên cần 1.000.000đ và tổng phạt khai báo 1.500.000đ, When tính lương, Then `diligenceSalary = 0` (không âm) — **đạt**, đã có unit test xác nhận công thức (`__tests__/hrmPayrollInputData.test.ts:410-426`); Tester-QA Phase B cần tự chạy lại để xác nhận runtime.
- AC-dltl-09: Given nhân viên không có dòng vi phạm nào trong kỳ, When tính lương, Then `diligenceSalary` bằng đúng 100% đơn giá chuyên cần tra từ Set lương đã duyệt — **đạt về mặt logic đọc mã** (`payrollCalculation.service.ts:198-220`, `tongPhat` khởi tạo 0 khi `empDiligences` rỗng).

**US-dltl-06**: Là kế toán, tôi muốn khoản tạm ứng vượt quá thu nhập trong kỳ vẫn hiển thị đúng số âm ở thực lĩnh, để biết chính xác công nợ nhân viên.
- AC-dltl-10: Given tổng khấu trừ (thuế + bảo hiểm + đoàn phí + ứng-bù trừ chiều trừ) lớn hơn tổng thu nhập gộp trong kỳ, When tính lương, Then `netTakeHomeSalary` là số âm, KHÔNG bị ép về 0 — **đạt** (`payrollCalculation.service.ts:259-264`).

**US-dltl-07**: Là kế toán, tôi muốn màn hình nhập liệu 8 phân hệ đọc/ghi đúng kỳ lương đang chọn qua API thật, không còn dữ liệu giả lập.
- AC-dltl-11: Given tôi đang ở màn Chấm công/Tăng ca/KPI/Thưởng/Lương sản phẩm/Lương phần trăm/Chuyên cần/Ứng-bù trừ, When tôi nhập và lưu dữ liệu, Then dữ liệu được ghi vào đúng bảng tương ứng của `periodId` đang chọn qua API thật (`/payroll-data/*`) — **hiện KHÔNG đạt cho cả 8/8 màn**: cả 8 file `*Panel.tsx` đều còn import hook nghiệp vụ chính từ `mock/hooks/*` (xem Mục 11, Phát hiện đối soát 🔴 #1). Đây là gap nghiêm trọng nhất của toàn bộ đợt kiểm định.

---

## 11. Phát hiện đối soát tổng hợp (tham chiếu nhanh, chi tiết đã nằm rải rác Mục 5–10)

> Mục này chỉ tổng hợp lại — KHÔNG lặp lại phần "Trạng thái triển khai" đã có ở Mục 5/6/7/9/10, chỉ nêu 1 dòng + mức độ + đường dẫn tới mục chi tiết.

| # | Mức | Một dòng | Chi tiết ở |
|:---:|:---:|---|---|
| 1 | 🔴 | 8/8 file `*Panel.tsx` (màn hình chính của cả 8 phân hệ nhập liệu — Chấm công, Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Chuyên cần, Ứng-bù trừ) **vẫn import hook từ `mock/hooks/*`**, không gọi API thật. `walkthrough.md` tuyên bố "100% việc nối frontend" — tuyên bố này SAI cho đúng phần lõi nghiệp vụ của tính năng | Mục 10 AC-dltl-11, Mục 12 |
| 2 | 🔴 | Động cơ tính lương chỉ đọc 2/~15 tham số từ `GeneralSetting` đã cấu hình sẵn, còn lại hardcode (ngày công chuẩn, giờ chuẩn/ngày, tỷ lệ bảo hiểm, đoàn phí, biểu thuế TNCN) | Mục 5 BR-dltl-023 |
| 3 | 🔴 | Reopen kỳ lương: không có role-guard ADMIN-only, không ghi Audit Log — 2/3 tiêu chí của BR-dltl-001/002 công bố trong `BA_ANALYSIS_SPEC.md` không có thật | Mục 5 BR-dltl-002 |
| 4 | 🔴 | `createPayrollPeriod` không tự sinh lịch công chuẩn từ `GeneralSetting`/`Holiday` như `BA_ANALYSIS_SPEC.md` Mục 4.1 khẳng định | Mục 4.1 |
| 5 | 🟠 | 11/26 mã lỗi chỉ tồn tại trong message Zod, không trả về field `code`/`errorCode` máy đọc được — rủi ro QA viết test case sai cách assert | Mục 7 |
| 6 | 🟠 | 3/26 mã lỗi (E-dltl-002, 024, 026) chưa có bất kỳ code path nào — dead code trên giấy | Mục 5 BR-dltl-003, Mục 7 |
| 7 | 🟠 | Cảnh báo trần OT: hardcode ngưỡng tháng (bỏ qua cấu hình), thiếu hoàn toàn cảnh báo trần năm | Mục 5 BR-dltl-009 |
| 8 | 🟠 | FE khóa (read-only) toàn bộ nhập liệu ngay khi `PENDING_REVIEW`, trong khi Backend + đặc tả cho phép ghi ở trạng thái này — 3 tầng không đồng bộ | Mục 6.2, OQ-dltl-010 |
| 9 | 🟠 | Thiếu endpoint `batch-override` chấm công và `payslips/my` (xem cả trong đặc tả nhưng không có route) | Mục 3.2, Mục 4.4 |
| 10 | 🟡 | `ThanhLocKyLuong.tsx` (thanh lọc DÙNG CHUNG cho cả 8 màn) đọc danh sách phòng ban từ `mock/hooks/phongBan.ts`, hệ quả trực tiếp của phát hiện #1 | `hdđt_maxv/.../ThanhLocKyLuong.tsx:15` |
| 11 | 🟡 | `E-dltl-005` giới hạn thật là 24h/ngày, không phải "số giờ chuẩn" như message | Mục 5 BR-dltl-006 |
| 12 | 🟡 | `lock` cho khóa thẳng từ `DRAFT`, bỏ qua bước `PENDING_REVIEW` mà bảng endpoint mô tả | Mục 6.1, OQ-dltl-009 |

### Kết luận tích cực (đã kiểm, không phải giả định)
- **14 model + 6 enum trong `schema.prisma` khớp 100%** với `BA_ANALYSIS_SPEC.md` Mục 2 — đã diff dòng-by-dòng (`git diff be_maxv/prisma/tenant/schema.prisma`).
- **Bất biến chặn sàn chuyên cần (BR-dltl-018)** cài đúng ở 2 nơi độc lập, khớp nhau, có unit test.
- **Bất biến công nợ âm (BR-dltl-021)** cài đúng, không có `Math.max(0,...)` nào bọc sai.
- **4 category `SalaryItem`** (`ATTENDANCE_ALLOWANCE`, `KPI_PERFORMANCE`, `PERIODIC_BONUS`, `COMMISSION_PERCENTAGE`) dùng đúng, khớp enum thật đã có sẵn từ tính năng "Cài đặt lương" — không có category bịa.
- **Toàn vẹn giao dịch (BR-dltl-022)**: mọi `apply` hàng loạt và `lock` đều bọc `$transaction`.
- **Đa tenant**: 4 controller đều gọi `resolveTenantDb(req)` đúng quy ước dự án.
- Riêng phần **"Quản lý danh mục"** (CRUD KPI/Sản phẩm/Chuyên cần/Bù trừ) và dialog **"Tái sử dụng"** của 6/8 module: đã nối API thật đúng như `walkthrough.md` liệt kê (không phải toàn bộ tuyên bố "100%" của walkthrough sai, chỉ riêng phần Panel chính là sai).

---

## 12. Edge Cases bổ sung (chưa có trong `BA_ANALYSIS_SPEC.md`)

| # | Kịch bản | Hành vi hiện tại | Hành vi mong đợi |
|---|---|---|---|
| EC-dltl-01 | Gọi `apply` cho phạm vi `nhan_vien` với `employeeIds` gồm 3 mã, trong đó 1 mã không tồn tại/đã nghỉ việc | Âm thầm áp dụng cho 2 người còn lại, không báo lỗi, không báo người dùng biết 1 mã bị bỏ qua | Nên trả về cảnh báo hoặc lỗi liệt kê rõ mã nào bị bỏ qua và vì sao (liên hệ BR-dltl-003) |
| EC-dltl-02 | Gọi `apply` 2 lần liên tiếp rất nhanh (double-click nút "Áp dụng") cho cùng 1 nhân viên | Lần 2 xóa sạch rồi tạo lại y hệt lần 1 nếu payload giống nhau — vô hại nhưng lãng phí; nếu payload khác (do race condition FE) thì lần sau thắng, không cảnh báo mất dữ liệu của lần trước | Nên có debounce/disable nút phía FE trong lúc `isPending` |
| EC-dltl-03 | Nhân viên bị xóa mềm (`da_xoa = true`) sau khi đã có `KpiRecord`/`BonusRecord`/... trong kỳ đang `DRAFT` | `resolveTargetEmployees` lọc `da_xoa:false` nên nhân viên biến mất khỏi danh sách các màn nhập liệu, nhưng bản ghi biến động cũ của họ vẫn còn trong DB và vẫn được `calculatePayrollPreview` tính vào bảng lương (vì hàm này tự query riêng `attendanceRecord`/`kpiRecord`/... theo `periodId`, không lọc lại theo nhân viên còn hoạt động) | Cần quyết định rõ: nhân viên nghỉ giữa kỳ có được tính lương phần đã làm hay bị loại hoàn toàn khỏi bảng lương kỳ đó |
| EC-dltl-04 | `snapshotPayrollSheet` chạy khi có 0 nhân viên đang hoạt động | `calculatedLines.length > 0` mới `createMany` — an toàn, không lỗi | Giữ nguyên |
| EC-dltl-05 | Reopen 1 kỳ đã `LOCKED`, sau đó khóa lại (`lock`) mà không sửa gì | `snapshotPayrollSheet` xóa hết `PayrollSheetLine` cũ rồi tạo lại từ đầu — số liệu giống hệt lần trước nếu không có gì đổi | Đúng như kỳ vọng, không cần sửa |

---

## 13. Traceability nhanh

BR-dltl-001…023 ↔ E-dltl-001…026 ↔ AC-dltl-01…11 ↔ OQ-dltl-001…010: xem chỉ mục tương ứng ở Mục 5, 7, 10, 8. Traceability đầy đủ UC↔FR↔Screen sẽ được Architect/QA bổ sung trong `docs/hrm/du_lieu_tinh_luong/` khi có `api-contract.md`/`data-model.md`/`test-cases.md` (chưa tồn tại tại thời điểm đợt kiểm định này — xem Mục 14).

---

## 14. Bước tiếp theo (Handoff)

Tài liệu này **chưa đóng vai trò "Ready for Implementation"** — nó là kết quả kiểm định + hình thức hóa cho code **đã viết trước, chưa qua review**. Trình tự đúng theo `CLAUDE.md` cần chạy tiếp từ đây:

1. **Architect** đọc Mục 4–7 (API thật, BR, Error Matrix), viết `docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md` + `data-model-du-lieu-tinh-luong.md`, ra quyết định kiến trúc (ADR) cho các OQ ảnh hưởng thiết kế (OQ-dltl-001, 002, 003, 004, 006, 007).
2. **Tester-QA (Phase A)** đọc Mục 10 (AC) + Mục 11 (phát hiện đối soát) + Mục 12 (edge case), viết `test-matrix-du-lieu-tinh-luong.md` + `test-cases-du-lieu-tinh-luong.md` — ưu tiên viết test case cho đúng 4 phát hiện 🔴 trước.
3. Sau khi Architect + QA phản biện xong (Phase A), **Business Analyst quay lại chốt Final Sign-off** — cập nhật `Status: Ready for Implementation` vào `docs/hrm/CONTEXT_SUMMARY.md` — **chỉ khi đó** mới kích hoạt Backend Engineer sửa các phát hiện 🔴/🟠.

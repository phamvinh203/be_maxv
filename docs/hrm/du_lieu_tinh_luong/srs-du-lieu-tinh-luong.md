---
type: srs
feature: hrm-du-lieu-tinh-luong
status: in-review
updated: 2026-09-11
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
| NFR-dltl-007 *(mới, 2026-09-10)* | Tuân thủ pháp luật Thuế TNCN/BHXH VN hiện hành cho Bảng lương tổng hợp: 2 trần bảo hiểm độc lập, miễn thuế phần OT vượt chuẩn, khấu trừ 10% đúng đối tượng thử việc/thời vụ, trần miễn thuế phụ cấp ăn trưa | ❌ Chưa triển khai — xem BR-dltl-024…027 (Mục 15.3.1), đã có công thức + AC đầy đủ, chờ Architect/Backend |

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
| EC-dltl-06 *(mới, 2026-09-10)* | Nhân viên có `loai_hd = 'xac_dinh'` (HĐ xác định thời hạn) nhưng thời hạn hợp đồng (`ngay_ket_thuc − ngay_bat_dau`) dưới 3 tháng | Theo phạm vi CHỐT ở BR-dltl-026, vẫn áp nhánh cũ (biểu lũy tiến + giảm trừ gia cảnh) vì chỉ xét `loai_hd ∈ {thu_viec, thoi_vu}` | Luật (Điều 25 TT111/2013) có thể yêu cầu khấu trừ 10% cho trường hợp này — **chưa CHỐT**, cần kế toán trưởng xác nhận nếu phát sinh thực tế; KHÔNG chặn tiến độ đợt này |
| EC-dltl-07 *(mới, 2026-09-10)* | Nhân viên có `loai_hd = 'khoan'` (hợp đồng khoán việc) | Theo phạm vi CHỐT ở BR-dltl-026, áp nhánh cũ (biểu lũy tiến), không rơi vào khấu trừ 10% | Luật có khái niệm "không ký HĐLĐ" cũng thuộc diện khấu trừ 10% — `khoan` CÓ THỂ thuộc diện này nhưng **chưa CHỐT**, cùng nhóm với EC-dltl-06, cần xác nhận riêng nếu phát sinh |

---

## 13. Traceability nhanh

BR-dltl-001…023 ↔ E-dltl-001…026 ↔ AC-dltl-01…11 ↔ OQ-dltl-001…010: xem chỉ mục tương ứng ở Mục 5, 7, 10, 8. Traceability đầy đủ UC↔FR↔Screen sẽ được Architect/QA bổ sung trong `docs/hrm/du_lieu_tinh_luong/` khi có `api-contract.md`/`data-model.md`/`test-cases.md` (chưa tồn tại tại thời điểm đợt kiểm định này — xem Mục 14).

BR-dltl-024…027 ↔ AC-dltl-12…23 ↔ OQ-dltl-011: xem Mục 15.3.1 (công thức + AC chi tiết), Mục 15.4 (field mapping cột "Lương"), Mục 15.8 (biên bản quyết định của chủ dự án, 2026-09-10) — đợt kiểm định "Bảng lương tổng hợp".

---

## 14. Bước tiếp theo (Handoff) — cập nhật 2026-09-10, xem Mục 15

Ghi chú lịch sử (giữ nguyên, không xóa): tài liệu này ban đầu **chưa đóng vai trò "Ready for Implementation"**. Sau vòng 3 Amigos (Architect ∥ Tester-QA ∥ Code Reviewer, 2026-09-09) và phiên sửa lỗi kế tiếp, **8/9 lỗi 🔴 gốc đã FIXED** (xem `review-findings.md`, Mục 19.9 của `CONTEXT_SUMMARY.md`) và **frontend-engineer đã nối 23/23 file còn mock của 8 phân hệ nhập liệu** (`work-log.md` entry 2026-09-09 17:55). Cụm "Dữ liệu tính lương" (nhập liệu 8 phân hệ + vòng đời kỳ lương) coi như ổn định.

**Phạm vi Mục 15 (mới, 2026-09-10):** nhiệm vụ khác — dựng chức năng hiển thị **Bảng lương tổng hợp** (`hdđt_maxv/.../components/bang_luong`) nối vào API `GET /payroll/calculate` **CHƯA TỪNG được đấu nối** (100% còn mock, khác cụm 8 phân hệ nhập liệu ở trên). Đợt kiểm định này phát hiện: (a) 10 OQ cũ nay phần lớn đã có hướng giải quyết, (b) 4 lỗ hổng nghiệp vụ thuế/bảo hiểm thật so với luật VN mà bộ máy tính lương hiện tại chưa xử lý, (c) một xung đột nguồn sự thật nghiêm trọng giữa "Hợp đồng" và "Cài đặt lương" cho cột "Lương" — xem chi tiết Mục 15.

1. **Architect** đọc Mục 15 (gap thuế/bảo hiểm + xung đột nguồn lương) + Mục 4–7 (API/BR/Error Matrix cũ), thiết kế mở rộng `payrollCalculation.service.ts` + API contract cho `bang_luong`/`luong_ho_tro`.
2. **Tester-QA (Phase A)** viết test case cho các Business Rule mới (BR-dltl-024…027) và đối chiếu Error Matrix mở rộng.
3. Sau khi Architect + QA phản biện xong, **Business Analyst quay lại chốt Final Sign-off** — cập nhật `Status` vào `docs/hrm/CONTEXT_SUMMARY.md` — chỉ khi đó mới kích hoạt Backend Engineer.

---

## 15. Đối chiếu bổ sung Thuế/Bảo hiểm VN & Yêu cầu API cho UI Bảng lương (Business Analyst, 2026-09-10)

### 15.1. Bối cảnh đợt này

Yêu cầu: hoàn thiện chức năng **Bảng lương tổng hợp** trong `be_maxv` rồi gán API thay thế mock tại `hdđt_maxv/src/features/hrm/components/bang_luong` (`BangLuongTable.tsx`, `cotBangLuong.ts` — 18 cột; `LuongHoTroPanel.tsx` — tab "Lương hỗ trợ"). Đã đọc `mock/hooks/bangLuong.ts`, `calculations/bang_luong/bangLuong.ts` (công thức FE mẫu), `payrollCalculation.service.ts` thật, schema `GeneralSetting`/`SalaryItem`/`SalaryStructureItem`/`EmployeeSalaryItem`/`OvertimeRecord`, và `docs/nestjs/payroll/CONTEXT_SUMMARY.md` (chỉ lấy business rule luật định, KHÔNG lấy schema/code — theo đúng cảnh báo của `CLAUDE.md`).

### 15.2. Cập nhật trạng thái 10 câu hỏi mở gốc (Mục 8)

| Mã | Chốt lần này | Căn cứ |
|---|---|---|
| OQ-dltl-001 | ✅ **Đã xong** (không còn mở) | `resolveStandardWorkDays()` đọc `GeneralSetting` — đã FIXED phiên 2026-09-09 |
| OQ-dltl-002 | ⚠️ **Chốt một nửa**: tỷ lệ bảo hiểm/đoàn phí — ĐỌC từ `GeneralSetting` (đã FIXED). Biểu thuế TNCN — **khuyến nghị BA: nên nối `GeneralSetting.taxBrackets`**, vì trường JSONB này được thiết kế đúng cho việc này (đã có `restore-default`, validate `E-hrm-080/081/082`) và giữ 2 nguồn song song (hardcode `tinhThueLuyTien()` + JSONB không dùng) là nợ kỹ thuật, không phải quyết định kiến trúc cố ý. Việc NỐI là của Architect (ADR riêng); BA chỉ chốt **hướng đi**, không tự sửa code |
| OQ-dltl-003 | ✅ Đã xong | Audit qua `writeLog`/`sys_log` — FIXED |
| OQ-dltl-004 | ✅ Đã xong | `assertAdminOrOwner` — FIXED |
| OQ-dltl-005 | ⚠️ **Hướng đã chốt, thiết kế còn mở**: giữ **cảnh báo, không chặn cứng** trần OT năm (nhất quán với cách làm trần tháng hiện tại; luật cho phép vượt trần trong một số ngành có điều kiện, chặn cứng rủi ro sai). Cộng dồn theo **năm dương lịch** (khớp field `PayrollPeriod.year`). Cách truy vấn cộng dồn qua nhiều kỳ là việc của Architect |
| OQ-dltl-006 | ✅ Coi như đã xong | `frontend-engineer` (2026-09-09 17:55) xác nhận FE luôn gửi đủ danh sách khi "Áp dụng" — rủi ro mất dữ liệu đã được né bằng quy ước code, không cần sửa API |
| OQ-dltl-007 | ✅ Chốt: **không cần** endpoint Excel import riêng | FE đã triển khai theo hướng "parse Excel ở trình duyệt rồi gọi lại `apply*` sẵn có" (work-log 2026-09-09 17:55) — chấp nhận được, lỗi hiển thị theo response Zod hiện có |
| OQ-dltl-008 | ✅ Gộp vào OQ-dltl-010 | Xem quyết định OQ-dltl-010 |
| OQ-dltl-009 | ✅ Chốt: **giữ nguyên** `lock` cho phép khóa thẳng từ `DRAFT` | Đây là tính linh hoạt hợp lý (công ty nhỏ có thể bỏ qua bước trình duyệt), không có rủi ro toàn vẹn dữ liệu vì `snapshotPayrollSheet` luôn tính lại từ nguồn |
| OQ-dltl-010 | ✅ **Chốt 1 chuẩn cho cả 3 tầng**: `PENDING_REVIEW` phải **đóng băng ghi dữ liệu** (đúng hành vi FE hiện tại, đúng thực hành kế toán — đang chờ duyệt thì không ai được sửa số, muốn sửa phải `reject` về `DRAFT` trước). **Backend `payrollPeriodLockGuard.ts` cần sửa**: thêm `PENDING_REVIEW` vào danh sách trạng thái chỉ-đọc của 8 phân hệ (hiện guard 8-phân-hệ cho ghi ở `PENDING_REVIEW`, lệch với `updatePayrollPeriod` và FE) — đây là **gap kỹ thuật cụ thể cho Architect**, không phải OQ nữa |

### 15.3. Bốn lỗ hổng nghiệp vụ thuế/bảo hiểm mới (so với luật VN, tham khảo `docs/nestjs/payroll`) — CHỐT trong phạm vi triển khai đợt này (2026-09-10)

| Mã BR mới | Quy tắc | Trạng thái hiện tại | Ảnh hưởng tới thực lĩnh |
|---|---|---|---|
| BR-dltl-024 | **Hai trần bảo hiểm độc lập**: BHXH+BHYT trần = `baseSalary × 20` (hiện 2.34tr × 20 = 46.8tr, NĐ 73/2024); BHTN trần = `regionMinSalary × 20` (hiện 4.96tr × 20 = 99.2tr, theo vùng) | ❌ **Không có** — `employeeInsuranceRate` gộp cả 3 loại (BHXH+BHYT+BHTN) thành 1 tỷ lệ, nhân thẳng với `insuranceSalaryBase` không trần nào. `GeneralSetting` đã sẵn `baseSalary`/`regionMinSalary` (không cần field DB mới, chỉ cần tách logic) | Nhân viên lương đóng bảo hiểm > 46.8tr/tháng bị trừ **bảo hiểm vượt mức luật định** — sai cả 2 chiều (NLĐ đóng thừa, DN cũng ghi nhận chi phí thừa) |
| BR-dltl-025 | **Miễn thuế phần tăng ca vượt chuẩn** (Điều 3 TT111/2013): chỉ phần **chênh lệch** giữa tiền OT thực trả và tiền công giờ bình thường tương ứng mới bị tính thuế; phần trả thêm do hệ số (150%/200%/300%...) được miễn | ❌ **Không có** — `otAmount` tính đủ 100% cộng vào `grossIncome` rồi chịu thuế toàn bộ. Thiếu dữ liệu: engine chỉ giữ `convertedHours` (đã nhân hệ số), **không giữ `hours` gốc** trong kết quả trả về nên không tách được phần chênh lệch miễn thuế | Thuế TNCN bị tính **thừa** trên toàn bộ nhân viên có tăng ca |
| BR-dltl-026 | **Khấu trừ 10% tại nguồn cho HĐ thử việc/thời vụ** khi thu nhập ≥ 2.000.000đ/lần trả, KHÔNG áp dụng biểu lũy tiến, KHÔNG trừ giảm trừ gia cảnh (Điều 25 TT111/2013) | ❌ **Không có** — `personalIncomeTax` luôn gọi `tinhThueLuyTien()` (biểu lũy tiến) khi `activeContract.tinh_tncn = true`, không rẽ nhánh theo `loai_hd`. Field `hrm_hop_dong.loai_hd` **đã có sẵn** giá trị `thu_viec`/`thoi_vu` (đã xác nhận qua schema) | Nhân viên thử việc/thời vụ bị tính thuế **sai phương pháp hoàn toàn** (áp nhầm biểu lũy tiến + giảm trừ gia cảnh cho đối tượng luật quy định phải khấu trừ thẳng 10%) |
| BR-dltl-027 | **Trần miễn thuế phụ cấp ăn trưa/ăn ca 730.000đ/tháng** (TT26/2016/TT-BLĐTBXH) — phần vượt trần bị tính vào thu nhập chịu thuế | ❌ **Không có** — hệ quả trực tiếp của gap lớn hơn: engine **hoàn toàn chưa đọc** `EmployeeSalaryItem` nhóm `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE` (chỉ đọc `KPI_PERFORMANCE` và `ATTENDANCE_ALLOWANCE`) — nay ĐÃ CHỐT phải đọc (xem Mục 15.4, OQ-dltl-011 resolved) nên trần này bắt buộc phải cài cùng lúc | Nếu nối nhóm phụ cấp mà quên trần, phụ cấp ăn trưa > 730k vẫn bị khai miễn thuế toàn bộ — sai luật |

**Quyết định biểu thuế TNCN/giảm trừ gia cảnh — ĐÃ CHỐT (không còn "không tự quyết"):** xem Mục 15.8. Giữ nguyên luật hiện hành 7 bậc, 11.000.000đ/4.400.000đ. Bộ số liệu 2026 mới (5 bậc, 15.500.000đ/6.200.000đ) mà `docs/nestjs/payroll` có nhắc tới **KHÔNG được áp dụng**.

#### 15.3.1. Công thức chi tiết & Acceptance Criteria (đủ để Architect thiết kế và Backend code thẳng)

Toàn bộ công thức dưới đây viết theo đúng tên biến/field đã có trong `payrollCalculation.service.ts` bản 2026-09-09 (không đổi tên biến hiện có trừ khi ghi rõ).

**BR-dltl-024 — Hai trần bảo hiểm độc lập**

Nguồn dữ liệu (đã có sẵn, không cần field DB mới): `hrm_hop_dong.luong_bhxh` (→ `insuranceSalaryBase`, giữ nguyên) · `hrm_hop_dong.trich_bhxh` · `GeneralSetting.baseSalary` (mặc định 2.340.000) · `GeneralSetting.regionMinSalary` (mặc định 4.960.000) · `GeneralSetting.insuranceEmployeeSocial` (8.0%) + `insuranceEmployeeHealth` (1.5%) · `insuranceEmployeeUnemployment` (1.0%) · `insuranceCompanySocial` (17.5%) + `insuranceCompanyHealth` (3.0%) · `insuranceCompanyUnemployment` (1.0%).

Công thức (thay đoạn `employeeInsuranceDeduction`/`companyInsuranceExpense` ở `payrollCalculation.service.ts:289-290`):
```
capBhxhByt = min(insuranceSalaryBase, GeneralSetting.baseSalary × 20)        // mặc định trần 46.800.000
capBhtn    = min(insuranceSalaryBase, GeneralSetting.regionMinSalary × 20)   // mặc định trần 99.200.000

Khi activeContract.trich_bhxh = true:
  employeeInsuranceDeduction = round(capBhxhByt × (insuranceEmployeeSocial + insuranceEmployeeHealth) / 100)
                              + round(capBhtn × insuranceEmployeeUnemployment / 100)
  companyInsuranceExpense    = round(capBhxhByt × (insuranceCompanySocial + insuranceCompanyHealth) / 100)
                              + round(capBhtn × insuranceCompanyUnemployment / 100)
Khi trich_bhxh = false: cả hai = 0 (giữ nguyên hành vi hiện tại).

insuranceCapAppliedBhxhByt = (insuranceSalaryBase > GeneralSetting.baseSalary × 20)      // field MỚI, boolean
insuranceCapAppliedBhtn    = (insuranceSalaryBase > GeneralSetting.regionMinSalary × 20) // field MỚI, boolean
```

AC-dltl-12: Given `luong_bhxh = 120.000.000`, `trich_bhxh = true`, When tính lương, Then `employeeInsuranceDeduction = round(46.800.000×9.5%) + round(99.200.000×1.0%) = 4.446.000 + 992.000 = 5.438.000` (KHÔNG phải `120.000.000×10.5% = 12.600.000` như công thức gộp cũ), `insuranceCapAppliedBhxhByt = true`, `insuranceCapAppliedBhtn = true`.
AC-dltl-13: Given `luong_bhxh = 70.000.000` (vượt trần BHXH/BHYT nhưng chưa vượt trần BHTN), When tính lương, Then chỉ `insuranceCapAppliedBhxhByt = true`; `capBhtn = 70.000.000` (không bị kẹp).
AC-dltl-14: Given `luong_bhxh = 20.000.000` (dưới cả 2 trần), When tính lương, Then `employeeInsuranceDeduction = round(20.000.000×10.5%) = 2.100.000` — khớp kết quả công thức gộp cũ (không regression cho trường hợp phổ biến).

**BR-dltl-025 — Miễn thuế phần tăng ca vượt chuẩn**

Nguồn dữ liệu: `OvertimeRecord.hours` (giờ GỐC — đã có trong DB, engine hiện chỉ đọc `convertedHours`) · `OvertimeRecord.convertedHours` · biến `hourlyRate` đã có sẵn trong engine (`baseSalaryMonthly / (standardWorkDays × standardHoursPerDay)`, xem lưu ý ở Mục 15.4 về `baseSalaryMonthly`).

Công thức (chèn trước bước tính `personalIncomeTax`; KHÔNG đổi `otAmount`/`grossIncome`/`netTakeHomeSalary`):
```
Với mỗi OvertimeRecord r của nhân viên trong kỳ:
  tienOT_r    = round(hourlyRate × r.convertedHours)   // khớp cách cộng dồn otAmount hiện tại
  tienChuan_r = round(hourlyRate × r.hours)             // tiền công giờ CHUẨN (giờ gốc, hệ số 100%)
  tienMienThue_r = max(0, tienOT_r − tienChuan_r)

otTaxExemptAmount = Σ tienMienThue_r (mọi bản ghi OT của nhân viên trong kỳ)   // field MỚI

taxableIncome = max(0, grossIncome − otTaxExemptAmount − totalDeductions)
// totalDeductions giữ nguyên = personalDeduction + dependentCount×dependentDeduction + employeeInsuranceDeduction
// grossIncome/otAmount/netTakeHomeSalary GIỮ NGUYÊN — chỉ taxableIncome giảm, thực lĩnh không đổi
```

AC-dltl-15: Given `hourlyRate = 100.000đ/giờ`, 1 dòng OT ngày thường (`hours = 10`, `convertedHours = 15`), When tính lương, Then `tienOT_r = 1.500.000`, `tienChuan_r = 1.000.000`, `otTaxExemptAmount = 500.000`, `taxableIncome` giảm đúng 500.000đ so với cách tính cũ (toàn bộ `otAmount` chịu thuế).
AC-dltl-16: Given nhân viên không có dòng OT nào trong kỳ, When tính lương, Then `otTaxExemptAmount = 0`, `taxableIncome` không đổi.
AC-dltl-17: Given nhân viên có 3 dòng OT thuộc 3 loại khác nhau, When tính lương, Then `otTaxExemptAmount` = tổng miễn thuế của cả 3 dòng cộng lại.

**BR-dltl-026 — Khấu trừ 10% tại nguồn cho HĐ thử việc/thời vụ (phạm vi CHỐT: `loai_hd ∈ {thu_viec, thoi_vu}`)**

Nguồn dữ liệu: `hrm_hop_dong.loai_hd` (đã có, giá trị `thu_viec`/`thoi_vu` xác nhận qua schema `hrm_hop_dong:987-990`). Ngưỡng khấu trừ 2.000.000đ/lần trả (Điều 25 Khoản 1 Điểm i TT111/2013/TT-BTC, giữ nguyên luật hiện hành) — `GeneralSetting` **chưa có field lưu ngưỡng này**; Architect cân nhắc thêm field mới (vd `probationWithholdingThreshold`) hoặc hardcode kèm chú thích căn cứ pháp lý — đây là quyết định KỸ THUẬT, ngưỡng NGHIỆP VỤ (2.000.000đ) đã chốt.

Công thức (thay nhánh rẽ hiện tại ở `payrollCalculation.service.ts:299`, hiện luôn gọi `tinhThueLuyTien()` bất kể `loai_hd`):
```
thuNhapKheKhauTru = grossIncome − otTaxExemptAmount   // đã trừ phần OT miễn thuế (BR-dltl-025), ÁP DỤNG chung cho cả 2 nhánh dưới — trả lời GAP-QA-05

Nếu activeContract.tinh_tncn ≠ true:          // cờ hợp đồng "không tính TNCN" ĐÈ LÊN cả 2 cơ chế bên dưới
  personalIncomeTax = 0
  withholdingTaxApplied = false
Ngược lại nếu activeContract.loai_hd ∈ {'thu_viec', 'thoi_vu'}:
  Nếu thuNhapKheKhauTru ≥ 2.000.000:
    personalIncomeTax = round(thuNhapKheKhauTru × 10%)
    withholdingTaxApplied = true   // field MỚI, boolean
    // TUYỆT ĐỐI KHÔNG áp personalDeduction/dependentDeduction, KHÔNG dùng tinhThueLuyTien()
  Ngược lại (dưới ngưỡng):
    personalIncomeTax = 0
    withholdingTaxApplied = false
Ngược lại (loai_hd ∈ {khong_xac_dinh, xac_dinh, khoan} — nhánh CŨ giữ nguyên):
  taxableIncome = max(0, thuNhapKheKhauTru − totalDeductions)
  personalIncomeTax = tinhThueLuyTien(taxableIncome)
  withholdingTaxApplied = false
```

**Phạm vi CHƯA áp dụng, ghi nhận rõ (không phải bỏ sót):** `xac_dinh` ngắn hạn (<3 tháng) và `khoan` (khoán việc) có thể cũng thuộc diện khấu trừ 10% theo luật — đánh dấu EC-dltl-06/07 (Mục 12), cần kế toán trưởng xác nhận riêng nếu phát sinh, KHÔNG chặn tiến độ đợt này.

AC-dltl-18: Given `loai_hd = 'thu_viec'`, `grossIncome = 3.000.000`, `otTaxExemptAmount = 0`, When tính lương, Then `personalIncomeTax = 300.000`, `withholdingTaxApplied = true`, KHÔNG bị trừ giảm trừ gia cảnh dù có khai người phụ thuộc.
AC-dltl-19: Given `loai_hd = 'thoi_vu'`, `grossIncome = 1.500.000` (dưới ngưỡng 2.000.000), When tính lương, Then `personalIncomeTax = 0`, `withholdingTaxApplied = false`.
AC-dltl-20: Given `loai_hd = 'xac_dinh'` (HĐ chính thức), When tính lương, Then áp nhánh cũ (`tinhThueLuyTien`, có giảm trừ gia cảnh) — hành vi hiện tại không đổi cho loại hợp đồng này.

**BR-dltl-027 — Trần miễn thuế phụ cấp ăn trưa 730.000đ/tháng**

Điều kiện tiên quyết: chỉ có ý nghĩa SAU khi engine đọc nhóm phụ cấp cố định theo OQ-dltl-011 (Mục 15.4).

**Gap kỹ thuật cần Architect quyết định trước khi code (BA KHÔNG tự chọn):** `SalaryItem` của `be_maxv` KHÔNG có cờ nhận diện "khoản ăn trưa/ăn ca" (khác tài liệu tham khảo `docs/nestjs/payroll` có sẵn `isMealAllowance`). KHÔNG được dò theo TÊN khoản (rủi ro y hệt lỗi tài liệu tham khảo đã cảnh báo — khoản đặt tên khác "ăn trưa/ăn ca" sẽ không bao giờ khớp). Hai lựa chọn: (a) thêm cờ boolean mới `SalaryItem.isMealAllowance` (khuyến nghị — nhất quán với 2 cờ `isTaxable`/`isSocialInsurance` đã có); (b) quy ước theo `code` cố định (rủi ro vỡ khi đổi mã).

> ✅ **Đã chốt bởi Architect** (`ADR-010` QĐ-4, 2026-09-10): đúng phương án (a) — cột mới `SalaryItem.isMealAllowance`, xem `data-model-du-lieu-tinh-luong.md` Mục 11.3.

Công thức (giả định đã có cách nhận diện, vd cờ `isMealAllowance` theo phương án (a)):
```
mealAllowanceAmount = Σ EmployeeSalaryItem.amount của set lương APPROVED hiện hành, với salaryItem.isMealAllowance = true

hanMucMienThue = round(730.000 × min(1, actualWorkDays / standardWorkDays))   // quy đổi theo công thực tế, nhất quán cách proratedWorkSalary đã làm

lunchAllowanceTaxableAmount = max(0, mealAllowanceAmount − hanMucMienThue)     // field MỚI — phần VƯỢT trần
lunchAllowanceExemptAmount  = mealAllowanceAmount − lunchAllowanceTaxableAmount

taxableIncome = max(0, grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount
                     − otherAllowanceTaxExemptAmount − totalDeductions)
// MỞ RỘNG bởi Quyết định nghiệp vụ 3 ngay dưới đây — công thức đầy đủ có BA cấu phần miễn thuế,
// không phải hai (`otherAllowanceTaxExemptAmount` xem định nghĩa dưới)
```

AC-dltl-21: Given `mealAllowanceAmount = 1.000.000`, đủ công (`actualWorkDays = standardWorkDays`), When tính lương, Then `hanMucMienThue = 730.000`, `lunchAllowanceTaxableAmount = 270.000` cộng vào thu nhập chịu thuế.
AC-dltl-22: Given `mealAllowanceAmount = 500.000` (dưới trần), When tính lương, Then `lunchAllowanceTaxableAmount = 0`, toàn bộ được miễn thuế.
AC-dltl-23: Given nhân viên nghỉ nửa tháng (`actualWorkDays = standardWorkDays/2`), When tính lương, Then `hanMucMienThue = round(730.000×0.5) = 365.000` — trần miễn thuế quy đổi theo công, không giữ nguyên 730.000 cho người làm nửa tháng.

**Quyết định nghiệp vụ 3 (`Q-1`, chốt bởi chủ dự án 2026-09-10) — Miễn thuế phụ cấp cố định theo khai báo `isTaxable`/`taxTreatment`, field mới `otherAllowanceTaxExemptAmount`**

> Quyết định + lý do đầy đủ: Mục 15.8 (biên bản quyết định chủ dự án — 2 quyết định gốc; đây là quyết định thứ 3, phát sinh sau khi Architect nêu câu hỏi trong `ADR-010`) · `ADR-010` QĐ-9 (kiến trúc chi tiết bước [5a]). Mục này bổ sung công thức + Acceptance Criteria còn thiếu ở lần viết đầu của Mục 15.3.1, theo đúng yêu cầu đối soát của Architect (`api-contract-du-lieu-tinh-luong.md` Mục 8.7) — khớp 100% với `ADR-010`, không đổi tên trường/công thức Architect đã chốt.

Ô tick "chịu thuế TNCN" ở màn "Khoản lương" (`SalaryItem.isTaxable`) và cột "Phân loại" ở màn "Cấu trúc lương" (`SalaryStructureItem.taxTreatment`) **phải có hiệu lực thật**: khoản phụ cấp cố định nào được khai miễn thuế thì bị trừ thật khỏi thu nhập tính thuế — không chỉ dừng ở hai ngoại lệ cứng (OT vượt chuẩn, ăn trưa trong trần) như công thức gốc ở trên.

Công thức (chèn ngay sau bước quy đổi công ở Mục 15.4, TRƯỚC khi tính `taxableIncome`; duyệt **CÙNG MỘT vòng lặp** với bước tính `mealAllowanceAmount` ở trên — cấm hai vòng lặp độc lập cộng vào hai biến):
```
Với mỗi EmployeeSalaryItem đã cộng vào allowanceInPeriodTotal (chỉ salaryItem.category ∈ {FIXED_ALLOWANCE, BENEFIT_ALLOWANCE}),
xét theo thứ tự, dừng ở điều kiện đầu tiên khớp (if / else if):
  (i)   salaryItem.isMealAllowance = true                                         → vào giỏ ĂN CA (bỏ qua ô tick của chính khoản này)
  (ii)  structureItem?.taxTreatment = 'EXEMPT'  HOẶC  salaryItem.isTaxable = false → vào giỏ MIỄN THEO KHAI BÁO
  (iii) còn lại                                                                   → chịu thuế, không vào giỏ nào

mealAllowanceAmount           = Σ giỏ (i)    // đã có ở công thức BR-dltl-027 trên, không đổi
otherAllowanceTaxExemptAmount = Σ giỏ (ii)   // field MỚI — số tiền TRONG KỲ, đã quy đổi công
```

**Phạm vi (KHÔNG hiểu rộng ra):** chỉ áp cho phụ cấp cố định đi vào `allowanceInPeriodTotal` (`category ∈ {FIXED_ALLOWANCE, BENEFIT_ALLOWANCE}`). KHÔNG áp cho thưởng (`BonusRecord`), lương phần trăm (`CommissionRecord`), KPI, lương sản phẩm, chuyên cần — các bảng đó cũng trỏ `SalaryItem` có cột `isTaxable`, nhưng cờ đó **vẫn bị bỏ qua** cho các cấu phần này (giữ đúng hành vi hiện tại, không đổi một đồng nào ở đó).

**Ràng buộc bắt buộc — hai giỏ (i) và (ii) LOẠI TRỪ NHAU:** một khoản `isMealAllowance = true` không bao giờ được cộng thêm vào `otherAllowanceTaxExemptAmount`, kể cả khi chính khoản đó cũng khai `isTaxable = false`/`taxTreatment = EXEMPT` (tình huống phổ biến trong dữ liệu thật, không phải ca biên — vi phạm ⇒ miễn thuế hai lần trên cùng một khoản tiền ⇒ khai thiếu thuế). Bất biến bắt buộc: `mealAllowanceAmount + otherAllowanceTaxExemptAmount ≤ allowanceInPeriodTotal`.

AC-dltl-24: Given "Phụ cấp trách nhiệm" `1.000.000đ` (`FIXED_ALLOWANCE`, `isMealAllowance = false`, `isTaxable = false`, không có dòng cấu trúc lương ghi đè), đủ công, When tính lương, Then khoản này VẪN được cộng đủ `1.000.000đ` vào `allowanceInPeriodTotal`/thực lĩnh (không bị trừ khỏi lương), nhưng `otherAllowanceTaxExemptAmount = 1.000.000` và `taxableIncome` giảm đúng `1.000.000đ` so với trường hợp không tick.
AC-dltl-25: Given khoản `isTaxable = true` (mặc định) NHƯNG `SalaryStructureItem.taxTreatment = 'EXEMPT'` cho đúng khoản đó trong cấu trúc lương hiệu lực của kỳ, When tính lương, Then khoản này VẪN vào giỏ miễn theo khai báo (phép OR — `EXEMPT` không bị `isTaxable = true` phủ quyết), `otherAllowanceTaxExemptAmount` cộng khoản này.
AC-dltl-26: Given "Phụ cấp ăn trưa" `900.000đ` có CẢ `isMealAllowance = true` VÀ `isTaxable = false`, đủ công, When tính lương, Then khoản này CHỈ vào giỏ ăn ca — `mealAllowanceAmount = 900.000`, `lunchAllowanceExemptAmount = 730.000`, `lunchAllowanceTaxableAmount = 170.000` (giống hệt `AC-dltl-21`, cờ `isTaxable` của khoản này bị bỏ qua hoàn toàn) — KHÔNG được cộng thêm vào `otherAllowanceTaxExemptAmount`. Nếu code miễn toàn bộ `900.000đ` (cộng dồn 2 lớp) là SAI, phải FAIL ca này.
AC-dltl-27: Given nhân viên có khoản `BonusRecord`/`CommissionRecord` mà `SalaryItem.isTaxable = false`, When tính lương, Then khoản này VẪN chịu thuế toàn bộ như trước — KHÔNG cộng vào `otherAllowanceTaxExemptAmount` (phạm vi giỏ miễn theo khai báo chỉ áp cho phụ cấp cố định, không áp cho thưởng/hoa hồng/KPI/lương sản phẩm/chuyên cần).
AC-dltl-28: Given không có khoản phụ cấp cố định nào khai miễn thuế (mọi `isTaxable` mặc định `true`, không có dòng cấu trúc lương nào `EXEMPT`), When tính lương, Then `otherAllowanceTaxExemptAmount = 0` — kết quả khớp đúng công thức gốc (`AC-dltl-21…23`), không phá vỡ hành vi hiện có của các test case cũ.

### 15.4. Cột "Lương" — ĐÃ CHỐT bởi chủ dự án (2026-09-10), không còn là xung đột nguồn sự thật

**Bối cảnh cũ (để lưu vết):** FE mock (`calculations/bang_luong/bangLuong.ts`) coi "Cài đặt lương" (`EmployeeSalaryItem` nhóm `FIXED_ALLOWANCE`+`BENEFIT_ALLOWANCE`) là nguồn cột "Lương"; engine thật (`payrollCalculation.service.ts`) coi "Hợp đồng" (`luong_chinh`) là TOÀN BỘ lương cơ bản, không đọc nhóm phụ cấp cố định chút nào. Đây từng bị đánh dấu OQ-dltl-011 vì tưởng là 2 mô hình loại trừ nhau.

**Quyết định (OQ-dltl-011 — [x] Đã resolved):** Cột "Lương" lấy **CẢ HAI nguồn cộng lại** — 2 tầng dữ liệu bổ sung cho nhau, KHÔNG thay thế nhau:
1. **Hợp đồng** (`hrm_hop_dong.luong_chinh`) — lương thỏa thuận nền tảng.
2. **Cài đặt lương** (`EmployeeSalaryItem` của `EmployeeSalary` đang `APPROVED`, nhóm `FIXED_ALLOWANCE`+`BENEFIT_ALLOWANCE`) — CỘNG THÊM, đọc theo đúng cách engine đã đọc riêng `KPI_PERFORMANCE`/`ATTENDANCE_ALLOWANCE` (dùng chung vòng lặp `es.items` đã có sẵn, không cần query mới).

**Công thức field mapping (theo đúng chỉ đạo — `baseSalaryMonthly` là field cột "Lương", ĐƯỢC MỞ RỘNG để gồm cả 2 tầng):**
```
fixedAllowanceTotal = Σ EmployeeSalaryItem.amount của set lương APPROVED hiện hành, với
                       salaryItem.category ∈ {FIXED_ALLOWANCE, BENEFIT_ALLOWANCE}

baseSalaryMonthly = Number(activeContract.luong_chinh) + fixedAllowanceTotal   // MỞ RỘNG so với hiện tại (dòng 187, hiện chỉ = luong_chinh)
```

**Lưu ý kỹ thuật quan trọng cho Architect (BA không tự quyết thay):** `baseSalaryMonthly` hiện đang được dùng làm đầu vào cho 2 công thức khác mà ý nghĩa gốc là "chỉ tính trên lương hợp đồng":
- `hourlyRate = baseSalaryMonthly / (standardWorkDays × standardHoursPerDay)` (dùng cho `otAmount`, BR-dltl-025) — nếu `baseSalaryMonthly` giờ gồm cả phụ cấp, đơn giá giờ OT sẽ tăng theo, có thể không đúng ý luật ("giờ chuẩn" thường tính trên lương cơ bản thuần, không gồm phụ cấp).
- `proratedWorkSalary` (quy đổi theo công) — phụ cấp cố định `MONTHLY_FIXED` (theo `SalaryStructureItem.calculationMethod`) không nên bị quy đổi theo công giống lương hợp đồng.

Vì vậy Architect cần tách rõ 2 biến khi thiết kế chi tiết: `contractBaseSalary` (= `luong_chinh` thuần, dùng cho `hourlyRate`/BHXH) và `fixedAllowanceTotal` (cộng vào `grossIncome`/cột "Lương" hiển thị, quy đổi công theo `calculationMethod` riêng của từng khoản — `MONTHLY_FIXED` = không quy đổi, `ACTUAL_WORKDAYS` = quy đổi theo `actualWorkDays/standardWorkDays`). Cột "Lương" hiển thị ở UI = `contractBaseSalary + fixedAllowanceTotal` (đã quy đổi công nếu áp dụng).

**Vai trò còn lại của Hợp đồng (không đổi):** căn cứ đóng BHXH (`luong_bhxh` → `insuranceSalaryBase`, BR-dltl-024) · cờ tính thuế (`tinh_tncn`) · loại hợp đồng cho khấu trừ 10% (`loai_hd`, BR-dltl-026) · kiểu lương (`kieu_luong`).

### 15.5. Ánh xạ 18 cột UI Bảng lương ↔ dữ liệu API hiện có/thiếu (cập nhật sau khi chốt OQ-dltl-011 + BR-dltl-024…027)

| Cột UI (`cotBangLuong.ts`) | Field API `GET /payroll/calculate` | Trạng thái |
|---|---|---|
| `ho_ten`, `bo_phan` (ghép `ten_pb`/`ten_cv`) | `fullName`, `departmentName` | ✅ có, thiếu `positionName` ghép sẵn — FE tự ghép được |
| `so_npt` | `dependentCount` | ✅ |
| `luong` | `contractBaseSalary` + `fixedAllowanceTotal` (2 field MỚI) | ⚠️ Đã chốt công thức Mục 15.4, cần Architect thêm 2 field |
| `ngay_cong` | `actualWorkDays` | ✅ |
| `gio_tang_ca` (giờ **gốc**, chưa quy đổi) | *(chỉ có `otConvertedHours`)* | ❌ Thiếu field `otRawHours` — vẫn cần bổ sung (tái xác nhận, xem Mục 15.9) |
| `tien_tang_ca` | `otAmount` | ✅ |
| `luong_theo_ngay` | `proratedWorkSalary` | ✅ giữ nguyên ý nghĩa (chỉ phần Hợp đồng quy đổi công); phần phụ cấp quy đổi công theo `calculationMethod` riêng (Mục 15.4) |
| `luong_san_pham` | `pieceworkSalary` | ✅ |
| `thuong` | `bonusSalary` | ✅ |
| `kpi` | `kpiSalary` | ✅ |
| `thu_nhap` | `grossIncome` (mở rộng cộng thêm `fixedAllowanceTotal` quy đổi công) | ⚠️ Cần đối chiếu 1-1 khi viết adapter |
| `bao_hiem` | `employeeInsuranceDeduction` | ⚠️ Cần công thức mới BR-dltl-024 (2 trần độc lập) + field `insuranceCapAppliedBhxhByt`/`insuranceCapAppliedBhtn` |
| `cong_doan` | `employeeUnionFee` | ✅ |
| `kpcd_ct` | `companyUnionExpense` | ✅ |
| `bu_tru` | `adjustmentNetAmount` | ✅ |
| `thue_tncn` | `personalIncomeTax` | ⚠️ Cần công thức mới BR-dltl-025/026/027 + Quyết định nghiệp vụ 3 (`Q-1`, `AC-dltl-24…28`) + field `otTaxExemptAmount`/`withholdingTaxApplied`/`lunchAllowanceTaxableAmount`/`otherAllowanceTaxExemptAmount` |
| `thuc_linh` | `netTakeHomeSalary` | ✅ |

**Kết luận Mục 15.5 (cập nhật 2026-09-10):** việc chính không còn là "chờ chốt OQ-dltl-011" (đã resolved) mà là (1) vá 4 công thức Mục 15.3.1, (2) thêm field mới vào response `GET /payroll/calculate` (đếm đủ ở Mục 15.9), (3) Architect quyết định gap kỹ thuật `isMealAllowance` (BR-dltl-027) + tách `contractBaseSalary`/`fixedAllowanceTotal` (Mục 15.4), (4) FE viết 1 lớp adapter đổi tên field (giống `payrollInputsApi.ts` trước đó).

### 15.6. Yêu cầu API cho tab "Lương hỗ trợ"

`useLuongHoTroRows()` (mock) cần: mỗi nhân viên 1 dòng, `khoan: Record<ma_khoan, so_tien>` (một cột động cho mỗi khoản `luong_ho_tro`/`BENEFIT_ALLOWANCE` đang `ACTIVE`), cộng `tong`/`tong_muc_thang`. **Không có endpoint nào ở `payrollCalculation.controller.ts` hiện tại phục vụ được việc này**. Cần **1 endpoint mới**, đề xuất `GET /payroll/support-allowances?periodId=` — trả breakdown theo từng `SalaryItem` category `BENEFIT_ALLOWANCE` cho từng nhân viên đang hoạt động. Sau khi chốt OQ-dltl-011 (Mục 15.4), endpoint này **càng cần thiết hơn** (không còn là "gap độc lập" mà là hệ quả trực tiếp của việc engine giờ phải đọc nhóm phụ cấp) — Architect thiết kế response shape theo `SalaryStructureItem.calculationMethod` đã có sẵn trong schema.

### 15.7. Kết luận & Trạng thái

**Đặc tả đã chốt đủ cho phần "Bảng lương tổng hợp".** Cả 3 quyết định nghiệp vụ bắt buộc (OQ-dltl-011 — nguồn cột "Lương"; biểu thuế TNCN — giữ nguyên luật hiện hành; Quyết định nghiệp vụ 3/`Q-1` — ô tick miễn thuế có hiệu lực thật) đã được chủ dự án xác nhận trực tiếp qua phiên làm việc 2026-09-10 (Mục 15.8). BR-dltl-024…027 + Quyết định nghiệp vụ 3 đã có công thức + Acceptance Criteria đầy đủ (Mục 15.3.1, `AC-dltl-12…28`) — đủ để Architect thiết kế thẳng và Tester-QA viết test case mà không cần đoán. Hai gap KỸ THUẬT BA từng để mở đã được Architect chốt trong `ADR-010`: (a) cách nhận diện khoản "ăn trưa/ăn ca" trong `SalaryItem` → cờ `isMealAllowance` (QĐ-4); (b) tách `contractBaseSalary`/`fixedAllowanceTotal`/`allowanceInPeriodTotal` khỏi `baseSalaryMonthly` (QĐ-1).

**BA Final Sign-off — HOÀN TẤT (2026-09-10).** Đã đối soát chéo SRS ↔ `ADR-010` ↔ `data-model` Mục 11 ↔ `api-contract` Mục 8 ↔ `test-matrix-bang-luong-tong-hop.md`: không còn mâu thuẫn nghiệp vụ chặn tiến độ. Biên bản sign-off đầy đủ: `docs/hrm/CONTEXT_SUMMARY.md` Mục 19.16. **Status: Ready for Implementation** cho cụm "Bảng lương tổng hợp" — Backend Engineer được kích hoạt.

### 15.8. Biên bản quyết định của chủ dự án — chốt 2 câu hỏi mở (2026-09-10)

| Câu hỏi | Quyết định | Người quyết | Căn cứ |
|---|---|---|---|
| OQ-dltl-011 — Nguồn cột "Lương" | **Hợp đồng (`luong_chinh`) + CỘNG THÊM phụ cấp cố định từ Cài đặt lương (`EmployeeSalaryItem` nhóm `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE`)** — 2 tầng bổ sung, không thay thế | Chủ dự án, qua phiên làm việc trực tiếp 2026-09-10 | Cả 2 cụm code (FE mock + engine thật) đều đúng một phần — mỗi bên nắm 1 tầng dữ liệu nghiệp vụ khác nhau, không loại trừ nhau. Việc engine trước đây bỏ sót nhóm `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE` là THIẾU SÓT (đã ghi nhận ở BR-dltl-023, Mục 5), không phải chủ đích |
| Biểu thuế TNCN | **Giữ nguyên luật hiện hành: 7 bậc lũy tiến, giảm trừ gia cảnh 11.000.000đ (bản thân) / 4.400.000đ (người phụ thuộc)** — KHÔNG áp bộ số liệu 2026 mới (5 bậc, 15.500.000đ/6.200.000đ) | Chủ dự án, qua phiên làm việc trực tiếp 2026-09-10 | Bộ số liệu 2026 mới CHƯA xác nhận hiệu lực chính thức tại `be_maxv` — chính tài liệu tham khảo `docs/nestjs/payroll` cũng tự ghi "kế toán phải đối chiếu lại". `tinhThueLuyTien()` hiện tại đã đúng luật hiện hành, GIỮ NGUYÊN, không sửa biểu thuế |

**Hệ quả:** `tinhThueLuyTien()` (`payrollCalculation.service.ts:9-30`) và `GeneralSetting.personalDeduction`/`dependentDeduction` **KHÔNG cần sửa** cho đợt này. `OQ-dltl-002` (Mục 15.2) vẫn giữ nguyên phần khuyến nghị "nối `GeneralSetting.taxBrackets` JSONB thay vì hardcode" — đây là quyết định KỸ THUẬT (đọc từ DB field có sẵn vs giữ hardcode), khác với quyết định NGHIỆP VỤ "dùng luật nào" vừa chốt ở đây. Vì luật không đổi, việc nối JSONB không bắt buộc cho đợt này (không có rủi ro sai số nếu giữ hardcode); Architect có thể để lại thành nợ kỹ thuật không chặn tiến độ.

### 15.9. Gap API tổng hợp — tái xác nhận sau khi thêm 4 Business Rule (2026-09-10)

**Vẫn đúng, không đổi:**
- Endpoint mới `GET /payroll/support-allowances?periodId=` (Mục 15.6) — nay CÀNG cần thiết hơn (hệ quả trực tiếp của OQ-dltl-011).
- Field `otRawHours` (giờ OT gốc chưa quy đổi) — nay CÀNG cần thiết hơn (dữ liệu nguồn cho công thức BR-dltl-025, dù công thức tính nội bộ backend không bắt buộc phải lộ ra response, FE vẫn cần hiển thị đúng cột UI `gio_tang_ca`).

**Field mới phát sinh từ BR-dltl-024…027 + Quyết định nghiệp vụ 3 (bổ sung vào response `GET /payroll/calculate`), 9 field:**

| Field mới | Kiểu | Sinh ra từ | Mục đích |
|---|---|---|---|
| `contractBaseSalary` | number | Mục 15.4 | Lương thuần theo hợp đồng (`luong_chinh`), tách khỏi phụ cấp |
| `fixedAllowanceTotal` | number | Mục 15.4 | Tổng phụ cấp cố định từ Cài đặt lương, cộng vào cột "Lương" |
| `insuranceCapAppliedBhxhByt` | boolean | BR-dltl-024 | Cờ minh bạch: lương đóng BHXH/BHYT có bị kẹp trần 46.8tr không |
| `insuranceCapAppliedBhtn` | boolean | BR-dltl-024 | Cờ minh bạch: lương đóng BHTN có bị kẹp trần 99.2tr không |
| `otTaxExemptAmount` | number | BR-dltl-025 | Phần tiền OT được miễn thuế TNCN trong kỳ |
| `withholdingTaxApplied` | boolean | BR-dltl-026 | Cờ minh bạch: có đang áp khấu trừ 10% tại nguồn thay vì biểu lũy tiến không |
| `lunchAllowanceTaxableAmount` | number | BR-dltl-027 | Phần phụ cấp ăn trưa VƯỢT trần 730k, phải tính vào thu nhập chịu thuế |
| `otherAllowanceTaxExemptAmount` | number | Quyết định nghiệp vụ 3 (`Q-1`, Mục 15.3.1 `AC-dltl-24…28`) | Tổng phụ cấp cố định khai miễn thuế (`isTaxable=false` HOẶC `taxTreatment=EXEMPT`), KHÔNG gồm khoản ăn ca |
| `otRawHours` | number | Mục 15.5 (tái xác nhận, không phải mới) | Tổng giờ OT gốc chưa quy đổi hệ số, phục vụ cột UI `gio_tang_ca` |

Đây là danh sách đầy đủ, KHÔNG có gap API nào khác phát sinh ngoài 9 field trên + 1 endpoint mới đã liệt kê. *(Cập nhật khi Final Sign-off: `otherAllowanceTaxExemptAmount` là field thứ 9, bổ sung sau khi chủ dự án chốt Quyết định nghiệp vụ 3 — công thức + AC nay đã đầy đủ ở Mục 15.3.1, khớp `ADR-010` QĐ-9.)*

### 15.10. Giải đáp trực tiếp GAP-QA-01/02/05 (đối chiếu chéo với Tester-QA Phase A, cùng ngày 2026-09-10)

Tester-QA chạy song song đã viết `test-matrix-bang-luong-tong-hop.md` và tự đặt **giả định khác** với công thức ở Mục 15.3.1/15.4 cho 3 gap 🔴 — BA giải đáp dứt điểm bằng chính lời chỉ đạo gốc của chủ dự án, KHÔNG để tồn tại 2 giả định song song:

- **GAP-QA-01 (category nào tính là "phụ cấp cố định"):** QA tạm giả định TC-blth-001…005 chỉ gồm `FIXED_ALLOWANCE`, loại trừ `BENEFIT_ALLOWANCE` (lý do QA nêu: ăn trưa có trần riêng nên "khác bản chất phụ cấp cố định"). **Giả định này SAI so với chỉ đạo gốc** — chủ dự án nêu ví dụ tường minh "*ăn trưa, trách nhiệm*" là phụ cấp cố định cần cộng thêm, tức khoản ăn trưa (`BENEFIT_ALLOWANCE`) **PHẢI nằm trong** `fixedAllowanceTotal`. Điều này KHÔNG mâu thuẫn với việc khoản ăn trưa còn bị áp trần thuế riêng 730k (BR-dltl-027) — 2 việc độc lập: (a) khoản ăn trưa vẫn được **cộng vào lương/thực lĩnh** như phụ cấp cố định khác, (b) chỉ riêng **cách tính thuế TNCN** của phần đó có trần miễn thuế khác các phụ cấp còn lại. **CHỐT**: `fixedAllowanceTotal` gồm CẢ 2 category `FIXED_ALLOWANCE` + `BENEFIT_ALLOWANCE` (đúng công thức đã viết ở Mục 15.4) — QA cần sửa lại giả định trong test matrix (Nhóm 1 + Nhóm 6, `TC-blth-001…005`) theo hướng này.
- **GAP-QA-02 (quy đổi công gộp hay riêng từng khoản):** **CHỐT phương án (b)** — mỗi `EmployeeSalaryItem` tự quy đổi theo `SalaryStructureItem.calculationMethod` riêng của chính nó (`MONTHLY_FIXED` = không quy đổi, `ACTUAL_WORKDAYS` = quy đổi theo `actualWorkDays/standardWorkDays`), KHÔNG gộp chung 1 tỷ lệ với `luong_chinh`. Xem công thức đầy đủ ở Mục 15.4 (đoạn "Lưu ý kỹ thuật quan trọng cho Architect").
- **GAP-QA-05 (miễn thuế OT có áp cho HĐ thử việc/thời vụ không):** **CHỐT có áp dụng**, và trừ `otTaxExemptAmount` ra khỏi gross **TRƯỚC KHI** nhân 10% — xem công thức đã sửa ở BR-dltl-026 (Mục 15.3.1): `thuNhapKheKhauTru = grossIncome − otTaxExemptAmount`, dùng chung cho cả nhánh khấu trừ 10% lẫn nhánh lũy tiến. Đây cũng trực tiếp trả lời `TC-blth-029` (câu hỏi về `tinh_tncn = false`): cờ `activeContract.tinh_tncn ≠ true` **đè lên cả 2 cơ chế** (khấu trừ 10% lẫn biểu lũy tiến) — hợp đồng không tính TNCN thì `personalIncomeTax = 0` bất kể `loai_hd`.

**Đề nghị QA:** cập nhật lại `test-matrix-bang-luong-tong-hop.md` Mục 0 (đóng GAP-QA-01/02/05) và số liệu Nhóm 1/Nhóm 5/Nhóm 6 theo 3 quyết định trên ở lượt làm việc kế tiếp; BA không tự sửa file của QA. `BR-dltl-028`/`BR-dltl-029` QA đề xuất (Mục "Traceability" của test matrix) được BA xác nhận **hợp lệ về nội dung** (BR-dltl-028 = công thức hybrid Mục 15.4, đã có; BR-dltl-029 = endpoint `support-allowances` Mục 15.6, đã có) nhưng BA **giữ nguyên đánh số hiện tại của SRS** (không đổi ID BR-dltl-024…027 đã chốt) — công thức 2 mã đó nay đã nằm sẵn trong Mục 15.4/15.6, không cần thêm ID BR mới trùng nội dung.

---

## 16. Màn "Chốt kỳ lương" — chốt số từng bảng kê (2026-09-11)

### 16.1. Bối cảnh & phạm vi

Chủ dự án yêu cầu (2026-09-11, kèm ảnh màn tham chiếu): dựng màn **Chốt kỳ lương** gồm 12 bảng kê của kỳ, mỗi bảng kê chốt số / mở chốt riêng, nút **Tính lương**, **Chốt số toàn kỳ**, **Hướng dẫn chốt kỳ lương**, cột **Lịch sử hoạt động**; đồng thời chuyển ô chọn tháng/năm kỳ lương và nút **Chốt kỳ lương T{tháng}/{năm}** ra góc phải thanh HRM (thay khối "Kỳ lương" to nằm trên đầu khu Dữ liệu tính lương / Bảng lương).

> ID quy tắc bắt đầu từ **BR-dltl-030**: `BR-dltl-028`/`029` đã được test matrix Bảng lương tổng hợp dùng làm ID đề xuất (Mục 15.10) — không dùng lại để tránh trùng khi truy vết.

| # | Bảng kê | Loại dữ liệu | Chốt số thì | Màn "Xem chi tiết" |
|:-:|---|---|---|---|
| 1 | Chấm công | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Chấm công |
| 2 | Tăng ca | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Tăng ca |
| 3 | KPI | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › KPI |
| 4 | Thưởng | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Thưởng |
| 5 | Bù trừ | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Ứng - bù trừ |
| 6 | Sản lượng | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Lương sản phẩm |
| 7 | Lương phần trăm | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Lương phần trăm |
| 8 | Thu nhập ngoài bảng lương | Dùng chung nhiều kỳ | Chỉ xác nhận đã rà soát | Tờ khai thuế › Thu nhập ngoài lương *(màn chưa dựng)* |
| 9 | Chuyên cần | Riêng của kỳ | Chặn ghi | Dữ liệu tính lương › Lương chuyên cần |
| 10 | Giảm trừ thuế TNCN | Dùng chung nhiều kỳ | Chỉ xác nhận đã rà soát | Dữ liệu nhân viên › Người phụ thuộc |
| 11 | Hồ sơ lương | Dùng chung nhiều kỳ | Chỉ xác nhận đã rà soát | Cài đặt lương › Set lương |
| 12 | Khoản hỗ trợ | Dùng chung nhiều kỳ | Chỉ xác nhận đã rà soát | Bảng lương › Lương hỗ trợ |

### 16.2. Biên bản quyết định của chủ dự án (2026-09-11)

| # | Câu hỏi | Chốt |
|:-:|---|---|
| 1 | Chốt số 1 bảng kê có chặn sửa dữ liệu không? | **Chặn 8 bảng kê có dữ liệu riêng của kỳ**; 4 bảng kê dữ liệu dùng chung chỉ đánh dấu "đã rà soát" (khóa danh mục dùng chung sẽ chặn luôn các kỳ khác đang mở) |
| 2 | Ai được chốt / mở chốt? | **Chốt**: ai có quyền xem/nhập lương. **Mở chốt**: chỉ chủ tài khoản — cùng mức với "Mở lại kỳ lương" |
| 3 | Khóa sổ kỳ có bắt buộc chốt đủ 12/12 bảng kê? | **Không bắt buộc**, chỉ cảnh báo "còn N bảng kê chưa chốt". Kỳ đã khóa sổ thì mọi bảng kê coi như đã chốt theo kỳ |
| 4 | Nút "Tính lương" làm gì? | **Chạy engine lương hiện có và lưu kết quả tạm của kỳ** (ghi đè mỗi lần bấm) để hiện "Bảng lương a/b NV" + ghi lịch sử |

### 16.3. Business Rules

| Mã | Tên quy tắc | Mô tả | Mã lỗi | Trạng thái | Bằng chứng `file:line` |
|---|---|---|---|:---:|---|
| BR-dltl-030 | Chốt số từng bảng kê | Bảng kê "Riêng của kỳ" đã chốt số ⇒ mọi thao tác ghi dữ liệu của bảng kê đó trong kỳ bị từ chối. Bảng kê "Dùng chung" chốt số chỉ ghi nhận đã rà soát. Chốt lại bảng kê đã chốt / mở chốt bảng kê đang mở ⇒ báo trạng thái vừa thay đổi | E-dltl-027, E-dltl-028 | ✅ | Guard `helpers/hrm/payrollPeriodLockGuard.ts:76`, gọi ở 10 đường ghi `payrollInputs.service.ts:151,256,306,352,427,490,566,687,723,774`; chốt/mở chốt `payrollClosing.service.ts:114,149` |
| BR-dltl-031 | Thẩm quyền chốt / mở chốt | Chốt số, chốt toàn kỳ, tính lương: người có quyền xem lương. Mở chốt: chỉ chủ tài khoản | 403 | ✅ | `routes/hrm/du_lieu_tinh_luong/payrollClosing.route.ts:16` (`assertAdminOrOwner`), quyền lương qua `dbCoQuyenLuongPayroll` |
| BR-dltl-032 | Quan hệ với khóa sổ kỳ | Khóa sổ không đòi chốt đủ bảng kê. Kỳ đã khóa sổ trở đi ⇒ 12 bảng kê hiện "đã chốt theo kỳ", không chốt / mở chốt / chốt toàn kỳ / tính lương được; muốn sửa phải "Mở lại kỳ lương" trước. Mở lại kỳ **giữ nguyên** các bảng kê đã chốt riêng | E-dltl-001 | ✅ | `payrollClosing.service.ts:70` (`lockSource` = `PERIOD`), `:102` (`assertKyConMoDeChot`) |
| BR-dltl-033 | Tính lương tạm | Chạy đúng engine bảng lương (ADR-010) và lưu kết quả tạm của kỳ, ghi đè mỗi lần bấm. "Bảng lương a/b NV": a = số nhân viên đã có kết quả tính gần nhất, b = số nhân viên đang làm việc. Màn Bảng lương của kỳ còn mở vẫn tính trực tiếp; khóa sổ vẫn tính lại lần cuối rồi chụp | E-dltl-001, E-dltl-026 | ✅ | `payrollClosing.service.ts:204` |
| BR-dltl-034 | Lịch sử hoạt động | Mọi thao tác chốt / mở chốt / chốt toàn kỳ / tính lương / khóa sổ / mở lại / duyệt được ghi nhật ký (ai, lúc nào, làm gì) và hiện ở cột Lịch sử hoạt động — 50 thao tác gần nhất của kỳ | — | ✅ | Ghi: `payrollClosing.controller.ts`, `payrollPeriods.controller.ts`; đọc: `payrollActivity.service.ts:81` |

### 16.4. Mã lỗi mới

| Mã lỗi | Thông điệp | HTTP | Cơ chế trả về |
|---|---|:---:|---|
| E-dltl-027 | Bảng kê này đã được chốt số cho kỳ lương, không thể thay đổi dữ liệu. Mở chốt bảng kê trước khi sửa. | 403 | PayrollError |
| E-dltl-028 | Trạng thái chốt của bảng kê vừa thay đổi (chốt lại bảng kê đã chốt / mở chốt bảng kê đang mở) | 409 | PayrollError, câu thông báo nêu tên bảng kê |

### 16.5. User Story & Acceptance Criteria

**US-dltl-05**: Là kế toán lương, tôi muốn chốt số từng bảng kê ngay khi rà xong, để dữ liệu đã đối chiếu không bị sửa trong lúc các bảng kê khác vẫn đang nhập.

- AC-dltl-29: Given kỳ đang Bản nháp và bảng kê Chấm công đang mở, When bấm "Chốt số liệu" trên thẻ Chấm công, Then thẻ chuyển "Đã chốt số" kèm giờ chốt, ô "Số bảng kê đã chốt số" tăng 1, và Lịch sử hoạt động có dòng "Chốt số liệu Chấm công".
- AC-dltl-30: Given bảng kê Chấm công đã chốt số, When sửa một ô chấm công của kỳ đó, Then hệ thống từ chối với `E-dltl-027`; bảng kê Tăng ca chưa chốt vẫn ghi được bình thường.
- AC-dltl-31: Given người dùng là nhân viên (không phải chủ tài khoản) có quyền lương, When bấm "Mở chốt", Then hệ thống từ chối (403) — nút trên màn bị khóa sẵn kèm giải thích.
- AC-dltl-32: Given còn 11 bảng kê đang mở, When bấm "Chốt số toàn kỳ" và xác nhận, Then đúng 11 bảng kê đó được chốt, bảng kê đã chốt từ trước giữ nguyên giờ chốt cũ, lịch sử có 1 dòng "Chốt số toàn kỳ (11 bảng kê)".
- AC-dltl-33: Given kỳ đã khóa sổ, When mở màn Chốt kỳ lương, Then 12 thẻ đều hiện "Đã chốt số" và mọi nút chốt / mở chốt / chốt toàn kỳ / tính lương đều không dùng được (máy chủ trả `E-dltl-001` nếu cố gọi).
- AC-dltl-34: Given kỳ đang Bản nháp có 2 nhân viên đang làm việc, When bấm "Tính lương", Then ô "Bảng lương" hiện "2/2 NV" và lịch sử có dòng "Đã tính lương cho 2 nhân viên"; bấm lại lần nữa vẫn là 2/2 (ghi đè, không nhân đôi).
- AC-dltl-35: Given kỳ còn 3 bảng kê chưa chốt, When bấm "Khóa sổ kỳ lương", Then hộp xác nhận liệt kê đủ 3 bảng kê đó nhưng vẫn cho khóa sổ.
- AC-dltl-36: Given đang xem tháng 10/2026 chưa có kỳ lương, When nhìn góc phải thanh HRM, Then nút đổi thành "Tạo kỳ lương T10/2026"; bấm thì tạo kỳ Bản nháp và mở màn Chốt kỳ lương của kỳ vừa tạo.

### 16.6. Vòng đời trạng thái của một bảng kê trong kỳ

| Từ | Sự kiện | Điều kiện | Đến |
|---|---|---|---|
| Đang mở | Chốt số liệu / Chốt số toàn kỳ | Kỳ Bản nháp hoặc Chờ duyệt; có quyền lương | Đã chốt số |
| Đã chốt số | Mở chốt | Kỳ Bản nháp hoặc Chờ duyệt; chủ tài khoản | Đang mở |
| Đang mở / Đã chốt số | Khóa sổ kỳ | Như vòng đời kỳ | Đã chốt theo kỳ (chỉ hiển thị) |
| Đã chốt theo kỳ | Mở lại kỳ lương | Chủ tài khoản, lý do ≥ 20 ký tự | Trở về trạng thái riêng trước khi khóa sổ |

### 16.7. Ngoài phạm vi đợt này

- Nút "Tra cứu MST" trên ảnh tham chiếu — tính năng khác, không làm.
- Màn "Thu nhập ngoài bảng lương" (Tờ khai thuế) vẫn là màn chờ dựng; thẻ bảng kê 8 dẫn tới đó.
- Phía giao diện, kỳ "Chờ duyệt" vẫn khóa nhập liệu (máy chủ cho ghi) — lệch có từ trước, xem Mục 6.2.

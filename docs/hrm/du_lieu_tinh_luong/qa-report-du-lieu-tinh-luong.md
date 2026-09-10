---
type: qa-report
feature: hrm-du-lieu-tinh-luong
status: failed
updated: 2026-09-09
author: tester-qa
links:
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/cai_dat_luong/qa-report-cai-dat-luong.md
  - be_maxv/src/__tests__/hrmPayrollInputData.test.ts
---

# HR — Báo cáo Kiểm thử & Xác thực: Dữ liệu tính lương (QA & Verification Report)

Báo cáo kiểm định độc lập tính năng Dữ liệu tính lương (`du_lieu_tinh_luong`) cho `be_maxv` + `hdđt_maxv`. Theo đúng phương pháp Shift-Left: **bộ test kỳ vọng được tự thiết kế từ `srs-du-lieu-tinh-luong.md` TRƯỚC khi đọc code/test thật** (23 Business Rules, 26 mã lỗi, 11 Acceptance Criteria, 12 phát hiện đối soát, 5 edge case), sau đó mới đối chiếu ngược với `hrmPayrollInputData.test.ts` và mã nguồn 4 service. Không tin số liệu "3/3 test suites pass 100%" trong `walkthrough.md` — toàn bộ số liệu dưới đây do đợt kiểm định này **tự chạy lại**.

---

## 1. Tóm tắt Thực thi (Execution Summary)

| Hạng mục | Kết quả | Ghi chú |
|---|:---:|---|
| **Unit/Integration Test (`hrmPayrollInputData.test.ts`)** | **3 / 3 PASS** (888ms) | Tự chạy `npx tsx --experimental-test-module-mocks --test src/__tests__/hrmPayrollInputData.test.ts` — khớp con số cũ, nhưng "3 test suites" trong walkthrough thực ra là 3 `test()` block đơn (Node test runner báo `suites 0`, `tests 3`), không phải 3 file/suite riêng biệt |
| **Toàn bộ Backend Test Suite** | **634 / 638 PASS** (16.8s) | 4 fail nằm 100% trong `hrmSettingsShiftsHolidaysApi.test.ts` (TC-hrm-301, TC-hrm-316 — module Ca làm việc/Lịch ngày lễ) — **KHÔNG liên quan** `du_lieu_tinh_luong`, xác nhận qua đọc code không đụng file nào của 2 module đó. Không phải regression của tính năng này. |
| **TypeScript Typecheck (`tsc --noEmit`)** | **PASS** | 0 lỗi biên dịch |
| **ESLint (`eslint src`)** | **PASS (0 error)** | 324 warning toàn dự án (pre-existing: `no-console`, `no-explicit-any`) — 13 warning nằm trong 4 file của tính năng này (`catalogs.service.ts` ×4, `payrollInputs.service.ts` ×8, `payrollPeriods.service.ts` ×1), toàn bộ đều là `@typescript-eslint/no-explicit-any` trên các `where: any` — cùng pattern đã có sẵn trong `cai_dat_luong` (không phải warning mới do vi phạm coding rule) |
| **Frontend Build (`hdđt_maxv`, `tsc -b && vite build`)** | **PASS** | 12351 modules transformed, 5.31s — khớp con số walkthrough. 1 warning `INEFFECTIVE_DYNAMIC_IMPORT` (exceljs) — pre-existing, không liên quan tính năng |
| **Độ phủ test so với SRS (23 BR / 26 mã lỗi / 11 AC)** | **~26% BR có test, 0% qua HTTP cho 6/8 phân hệ nhập liệu** | Xem Mục 3 — 3 test block chỉ chạm: vòng đời kỳ lương (đầy đủ), reopen (một phần), thuế lũy tiến (hàm thuần, không qua service thật), sàn chuyên cần (**không gọi code thật** — xem BUG-dltl-006), catalogs CRUD (chỉ CREATE, 4/4 loại) |
| **QA Verdict tổng thể** | ❌ **FAILED — chưa đạt điều kiện Ready for Production** | 5 Bug 🔴 Critical (functionally blocking hoặc financially incorrect), 6 Bug/Issue 🟠 High, còn lại 🟡 |

---

## 2. Phương pháp luận

1. Đọc `srs-du-lieu-tinh-luong.md` (23 BR + 26 mã lỗi + 11 AC + 12 phát hiện + 5 edge case) — **chưa đọc code** — tự liệt kê ca test kỳ vọng cho từng BR theo 5 chiều: happy path, edge case, validation/boundary, error flow, permission.
2. Đọc `hrmPayrollInputData.test.ts` thật — đối chiếu từng ca đã tự thiết kế với ca thật có trong file → điền cột "Test thật".
3. Tự chạy `npm test` (đúng cờ `--experimental-test-module-mocks` theo `work-log.md`), `tsc --noEmit`, `eslint src`, `vite build` — lấy số liệu thật (Mục 1, Mục 6).
4. Đọc tĩnh 4 service (`payrollPeriods`, `catalogs`, `payrollInputs`, `payrollCalculation`) + validator + controller + route + `errorHandler.plugin.ts` + `schema.prisma` (model `GeneralSetting`) — săn lỗi logic không cần chạy runtime (Mục 7).
5. Thẩm định độc lập 4 phát hiện 🔴 của BA (Mục 8).
6. Đọc 8 file `*Panel.tsx` + các dialog/card liên quan ở `hdđt_maxv` — đối chiếu hành vi UI với API thật (Mục 9).

---

## 3. Ma trận Kiểm thử (Test Matrix) — tự thiết kế từ SRS, đối chiếu test thật

Chú giải cột **Test thật**: ✅ Có test khớp · ⚠️ Có test nhưng yếu/gián tiếp · ❌ Không có test nào · N/A không áp dụng (rule chưa triển khai, không thể test hành vi chưa tồn tại).

### 3.1. Vòng đời & Quản trị Kỳ lương (BR-dltl-001, 002; AC-01..04)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-001 | — | Tạo kỳ lương mới `POST /payroll-periods` sinh đúng `code=YYYY-MM`, status=`DRAFT` | P0 | ✅ | PASS |
| TC-dltl-002 | — | Tạo trùng `code` → 409 Conflict | P0 | ✅ | PASS |
| TC-dltl-003 | — | `submit` DRAFT→PENDING_REVIEW | P0 | ✅ | PASS |
| TC-dltl-004 | — | `submit` khi không ở DRAFT → 400 | P1 | ❌ | Không có test (đọc code: có guard, đúng) |
| TC-dltl-005 | — | `reject` PENDING_REVIEW→DRAFT | P1 | ❌ | Không có test |
| TC-dltl-006 | OQ-dltl-009 | `lock` thẳng từ DRAFT (bỏ qua PENDING_REVIEW) — hành vi hiện tại cho phép | P1 | ❌ | Không có test riêng cho path DRAFT→LOCKED (test có sẵn đi qua PENDING_REVIEW→LOCKED, không test path còn lại) |
| TC-dltl-007 | AC-dltl-01 | `lock` PENDING_REVIEW→LOCKED, snapshot `PayrollSheetLine` đủ cột được tạo | P0 | ⚠️ | Test chỉ assert `status===LOCKED`, **KHÔNG assert nội dung/số dòng `sheetLines`** — nửa vế AC-dltl-01 (snapshot 18 cột) không được verify |
| TC-dltl-008 | BR-dltl-001, AC-dltl-02 | Ghi dữ liệu (`overtime/apply`) khi kỳ LOCKED → 403 `E-dltl-001` | P0 | ✅ | PASS |
| TC-dltl-009 | BR-dltl-001 | Ghi dữ liệu khi kỳ APPROVED/PAID/ARCHIVED → 403 | P1 | ❌ | Không có test (đọc code: `readOnlyStatuses` bao đủ 4 trạng thái, đúng) |
| TC-dltl-010 | BR-dltl-001 | Ghi dữ liệu khi kỳ PENDING_REVIEW → PHẢI cho phép (theo Backend + đặc tả Mục 4.3) | P0 | ❌ | Không có test — đây là điểm 3 tầng LỆCH nhau (OQ-dltl-010), cần test xác nhận rõ hành vi Backend trước khi quyết fix FE hay BE |
| TC-dltl-011 | BR-dltl-002 | Reopen LOCKED→DRAFT, lý do <20 ký tự → 400 | P0 | ✅ | PASS |
| TC-dltl-012 | BR-dltl-002 | Reopen LOCKED→DRAFT, lý do ≥20 ký tự → 200, status=DRAFT | P0 | ✅ | PASS |
| TC-dltl-013 | BR-dltl-002, AC-dltl-03 | Reopen bởi user KHÔNG có role ADMIN/OWNER → PHẢI 403 | **P0** | ❌ | **Không có test — vì tính năng chưa tồn tại (BUG-dltl-003).** Test giả (role-agnostic) hiện tại PASS chỉ vì không có gì để chặn |
| TC-dltl-014 | BR-dltl-002, AC-dltl-04 | Reopen thành công → PHẢI tạo 1 bản ghi Audit Log mang đúng lý do | **P0** | ❌ | **Không có test — vì tính năng chưa tồn tại (BUG-dltl-004)** |
| TC-dltl-015 | BR-dltl-002 | Reopen kỳ KHÔNG ở LOCKED (vd đang DRAFT) → 400 | P2 | ❌ | Không có test |
| TC-dltl-016 | — | `approve` LOCKED→APPROVED, `mark-paid` APPROVED→PAID, `archive` PAID→ARCHIVED | P1 | ❌ | Không có test (đọc code: guard đúng theo bảng chuyển trạng thái) |
| TC-dltl-017 | — | `updatePayrollPeriod`/`deletePayrollPeriod` khi không ở DRAFT → 403/400 | P1 | ❌ | Không có test |
| TC-dltl-018 | E-dltl-025 | Gọi bất kỳ endpoint kỳ lương với `id` không tồn tại → 404 `E-dltl-025` | P1 | ❌ | Không có test |
| TC-dltl-019 | E-dltl-026, NFR-dltl-006 | 2 request `lock` đồng thời cho cùng 1 kỳ → phải có 1 request bị từ chối 409 | P2 | N/A | Chưa triển khai (đúng như SRS ghi — không có optimistic lock/mutex nào, xác nhận qua đọc `lockPayrollPeriod` không có version check) |

### 3.2. Phân giải phạm vi áp dụng (BR-dltl-003, 004, 005; EC-dltl-01)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-020 | BR-dltl-004, E-dltl-003 | `scope=phong_ban` thiếu `ma_pb` → 400 `E-dltl-003` | P0 | ❌ | Không có test (đọc code: đúng, `payrollInputs.service.ts:38-44`) |
| TC-dltl-021 | BR-dltl-005, E-dltl-004 | `scope=nhan_vien` với `employeeIds=[]` → 400 `E-dltl-004` | P0 | ❌ | Không có test (đọc code: đúng, `:53-59`) |
| TC-dltl-022 | BR-dltl-003, E-dltl-002 | `scope=nhan_vien` với 1 nhân viên KHÔNG có hợp đồng phủ kỳ tính lương → PHẢI 400 `E-dltl-002` | P0 | N/A | **Chưa triển khai** — `resolveTargetEmployees` không kiểm tra hợp đồng, xác nhận qua đọc code |
| TC-dltl-023 | EC-dltl-01 | `scope=nhan_vien` với 3 mã, 1 mã không tồn tại/đã nghỉ → hệ thống hiện ÂM THẦM bỏ qua, không cảnh báo | P1 | ❌ | Không có test — hành vi hiện tại (silent skip) chưa được test xác nhận, cũng chưa có test nào phủ định assumption ngược lại |
| TC-dltl-024 | — | `scope=toan_cong_ty` → áp dụng cho toàn bộ NV `status='1', da_xoa=false` | P0 | ⚠️ | Test 1 dùng gián tiếp qua `applyOvertime` scope `toan_cong_ty`, không assert riêng số lượng |

### 3.3. Chấm công (BR-dltl-006)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-025 | BR-dltl-006, E-dltl-005 | `actualHours` âm → 400 (Zod) | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-026 | BR-dltl-006, E-dltl-005 | `actualHours = 24` (biên trên hợp lệ theo code, KHÔNG phải "giờ chuẩn") → 200 | P1 | ❌ | Không có test — đồng thời là bằng chứng cho thấy message lỗi "không quá giờ chuẩn" gây hiểu nhầm |
| TC-dltl-027 | BR-dltl-006, E-dltl-005 | `actualHours = 25` → 400 | P1 | ❌ | Không có test |
| TC-dltl-028 | **BUG-dltl-007 (mới)** | `actualHours = 24` → `workDayValue` tính ra **3.00** (không chặn trần 1.0/ngày) | **P0** | ❌ | Không có test — đây là ca QUAN TRỌNG nhất bị thiếu của cả module Chấm công, xem Mục 7 |
| TC-dltl-029 | — | Không có bản ghi `AttendanceRecord` nào trong kỳ → `actualWorkDays` mặc định = `standardWorkDays` | P1 | ❌ | Không có test |

### 3.4. Tăng ca (BR-dltl-007, 008, 009; AC-06, 07)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-030 | BR-dltl-007, E-dltl-006 | 2 dòng cùng `otType` trong 1 lần `apply` → 400 `E-dltl-006` | P0 | ❌ | Không có test qua HTTP (test 1 chỉ gửi 1 item) |
| TC-dltl-031 | BR-dltl-008, E-dltl-007 | `hours <= 0` → 400 (Zod) | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-032 | — | OT rate đọc từ `GeneralSetting.otRate*` (6 loại) thay vì hardcode | P1 | ⚠️ | Không test trực tiếp nhưng **đọc code xác nhận ĐÚNG** — đây là điểm SÁNG hiếm hoi đọc config động (`payrollInputs.service.ts:211-219`), ngược lại với BR-dltl-023 |
| TC-dltl-033 | BR-dltl-009, AC-06 | Tổng OT tháng > 40h (mặc định) → `isWarningMonth=true` | P1 | ❌ | Không có test |
| TC-dltl-034 | BR-dltl-009, AC-06 | Đổi `GeneralSetting.maxOtHoursPerMonth` thành 48h, tổng OT = 45h → PHẢI không cảnh báo (hiện tại VẪN cảnh báo vì hardcode 40) | **P0** | N/A | **Xác nhận bug hardcode** — `payrollInputs.service.ts:192` dùng literal `40`, không đọc `setting.maxOtHoursPerMonth` |
| TC-dltl-035 | BR-dltl-009, AC-07 | Tổng OT cộng dồn NĂM > `maxOtHoursPerYear` (300h) → cảnh báo | P1 | N/A | Chưa triển khai — không có code path nào cộng dồn theo năm |
| TC-dltl-036 | — | `deleteEmployeeOvertime` khi kỳ LOCKED → 403 | P2 | ❌ | Không có test qua HTTP (đọc code: có `assertPayrollPeriodWritable`, đúng) |

### 3.5. KPI (BR-dltl-010, 011)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-037 | BR-dltl-010, E-dltl-008 | `kpiItemId` rỗng → 400 (Zod) | P1 | ❌ | Không có test qua HTTP |
| TC-dltl-038 | BR-dltl-010, E-dltl-008 | `kpiItemId` hợp lệ format nhưng KHÔNG tồn tại trong `kpiItem` → kỳ vọng 400 rõ ràng | **P0** | ❌ | **Không có test — phát hiện bug độc lập: trả về 409 sai + message gây hiểu nhầm** (xem BUG-dltl-009, Mục 7) |
| TC-dltl-039 | BR-dltl-010, E-dltl-009 | 2 dòng cùng `kpiItemId` → 400 `E-dltl-009` | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-040 | BR-dltl-011, E-dltl-010 | `Σweight <= 0` khi có ≥1 dòng → 400 `E-dltl-010` | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-041 | — | Không có `KpiRecord` nào trong kỳ → `kpiScore` mặc định 100% (full lương KPI) | P1 | ❌ | Không có test — hành vi mặc định nên được BA xác nhận có chủ đích (giống default 100% của Chuyên cần) hay không |

### 3.6. Thưởng (BR-dltl-012)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-042 | BR-dltl-012, E-dltl-011 | 2 dòng cùng `salaryItemId` → 400 `E-dltl-011` | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-043 | BR-dltl-012, E-dltl-012 | `amount < 0` → 400 (Zod) | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-044 | BR-dltl-012, E-dltl-012 | `amount = 0` (biên hợp lệ) → 200 | P2 | ❌ | Không có test |

### 3.7. Lương sản phẩm (BR-dltl-013, 014)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-045 | BR-dltl-013, E-dltl-014 | 2 dòng cùng `productId` → 400 `E-dltl-014` | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-046 | BR-dltl-013, E-dltl-013/015 | `productId` rỗng / `unitPrice`, `quantity` âm → 400 (Zod) | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-047 | BR-dltl-014 | Apply với `unitPrice` không truyền → lấy từ danh mục, ghi cố định vào record (snapshot) | P0 | ❌ | Không có test qua HTTP — chỉ đọc code xác nhận đúng |
| TC-dltl-048 | BR-dltl-014 | Sau khi có `PieceworkRecord`, đổi `unitPrice` trong danh mục `pieceworkProduct` → record CŨ giữ nguyên giá cũ | **P0** | ❌ | **Không có test verify bất biến snapshot theo đúng nghĩa "trước/sau" (before/after) — điểm yếu quan trọng vì đây là 1 trong 5 bất biến tài chính cốt lõi được `BA_ANALYSIS_SPEC.md` liệt kê** |

### 3.8. Lương phần trăm / Hoa hồng (BR-dltl-015, 016)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-049 | BR-dltl-015, E-dltl-016 | 2 dòng cùng `salaryItemId` (COMMISSION) → 400 `E-dltl-016` | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-050 | BR-dltl-015, E-dltl-017 | `commissionRate` ngoài [0,100] → 400 (Zod) | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-051 | BR-dltl-016 | Snapshot `commissionRate` bất biến (tương tự TC-dltl-048) | **P0** | ❌ | Không có test before/after |

### 3.9. Chuyên cần — Bất biến chặn sàn (BR-dltl-017, 018; AC-08, 09)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-052 | BR-dltl-017, E-dltl-019 | Trùng (nhân viên, loại lỗi, ngày) → 400 `E-dltl-019` | P0 | ❌ | Không có test qua HTTP (đọc code: đúng, dựa unique index DB) |
| TC-dltl-053 | BR-dltl-018, AC-08 | `Σphạt > đơn_giá` → `thanhTien = 0`, KHÔNG âm | **P0** | ⚠️ **Test giả** | Test 2 chỉ tái hiện công thức `Math.min/Math.max` bằng biến cục bộ, **KHÔNG gọi `payrollCalculation.service.ts` hay `payrollInputs.service.ts` thật** — xem BUG-dltl-006 |
| TC-dltl-054 | BR-dltl-018, AC-09 | Bảng vi phạm rỗng → `thanhTien = 100%` đơn giá | P0 | ❌ | Không có test qua service/HTTP thật (chỉ đọc code xác nhận đúng logic) |
| TC-dltl-055 | BR-dltl-018 | `deductionMethod='mat_toan_bo'` → mất trắng phụ cấp dù có phạt khác trước đó | P1 | ❌ | Không có test — đã đọc code xác nhận 2 nơi triển khai (preview + tính lương) cho cùng kết quả toán học dù code path khác nhau (`break` sớm vs cờ boolean) |
| TC-dltl-056 | — | `donGia` tra từ `EmployeeSalary` status=APPROVED loại `ATTENDANCE_ALLOWANCE`; nhân viên KHÔNG có set lương duyệt → `donGia=0` | P1 | ❌ | Không có test |

### 3.10. Ứng — Bù trừ (BR-dltl-019, 020; AC-10)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-057 | BR-dltl-019, E-dltl-022 | 2 dòng cùng `adjustmentItemId` → 400 `E-dltl-022` | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-058 | BR-dltl-019, E-dltl-023 | `amount <= 0` → 400 (Zod) | P0 | ❌ | Không có test qua HTTP |
| TC-dltl-059 | BR-dltl-020 | `netAdjustment = Σtru − Σbu`, dương giảm lương / âm tăng lương | P0 | ❌ | Không có test qua service/HTTP |
| TC-dltl-060 | BR-dltl-021, AC-10 | Tổng khấu trừ > tổng thu nhập → `netTakeHomeSalary` âm, KHÔNG ép 0 | **P0** | ❌ | **KHÔNG có test nào** — đây là 1 trong 5 bất biến tài chính cốt lõi (EC-03) nhưng SRS tự nhận "đạt" chỉ qua đọc code tĩnh, chưa từng chạy runtime xác nhận |

### 3.11. Bộ tính lương tổng hợp & Nhất quán cấu hình (BR-dltl-022, 023; AC-05, 11; NFR-004, 005, 006)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-061 | — | `GET /payroll/calculate` trả đủ 18 cột cho từng nhân viên đang hoạt động | **P0** | ❌ | **KHÔNG có test nào gọi endpoint này** — toàn bộ engine tính lương (349 dòng) chưa từng được test qua HTTP |
| TC-dltl-062 | BR-dltl-022 | `snapshotPayrollSheet` chạy trong transaction, lỗi giữa chừng → rollback toàn bộ | P1 | ⚠️ | Không test được rollback thật với mock hiện tại (mock `$transaction` không mô phỏng lỗi nửa chừng) — chỉ xác nhận qua đọc code có bọc `$transaction` |
| TC-dltl-063 | BR-dltl-023, AC-05 | Đổi `standardWorkingDaysMethod` → `standardWorkDays` trong bảng lương PHẢI đổi theo | **P0** | N/A | **Xác nhận bug hardcode `standardWorkDays=26`** (`payrollCalculation.service.ts:136`) |
| TC-dltl-064 | BR-dltl-023 | Đổi `standardHoursPerDay` → giờ chuẩn tính OT/hourlyRate PHẢI đổi theo | **P0** | N/A | **Xác nhận bug hardcode `8.0`** (dòng 163, VÀ thêm 1 nơi hardcode độc lập khác ở `payrollInputs.service.ts:113`) |
| TC-dltl-065 | BR-dltl-023 | Đổi 6 field `insurance*` → `employeeInsuranceDeduction`/`companyInsuranceExpense` PHẢI đổi theo | **P0** | N/A | **Xác nhận bug hardcode `0.105`/`0.215`** (dòng 244-245) |
| TC-dltl-066 | BR-dltl-023 | Đổi `unionFee*` → phí công đoàn PHẢI đổi theo | **P0** | N/A | **Xác nhận bug hardcode `1%`/`234_000`/`2%`** (dòng 249-250) |
| TC-dltl-067 | BR-dltl-023 | `tinhThueLuyTien()` dùng đúng **7 bậc** (Điều 22 Luật Thuế TNCN), KHÔNG phải 5 bậc | **P0** | ✅ | **PASS — công thức 7 bậc ĐÚNG** (5%/10%/15%/20%/25%/30%/35%, ngưỡng 5tr/10tr/18tr/32tr/52tr/80tr khớp luật hiện hành). Bug DUY NHẤT ở đây là **vị trí** — hardcode trong hàm thay vì đọc field `taxBrackets Json` đã thiết kế sẵn trong `GeneralSetting`, không phải sai SỐ BẬC |
| TC-dltl-068 | — | Thuế tính SAU khi trừ bảo hiểm + giảm trừ gia cảnh (đúng thứ tự luật định) | P0 | ✅ | PASS (đọc code: `taxableIncome = grossIncome − personalDeduction − dependent×N − employeeInsuranceDeduction`, đúng thứ tự) |
| TC-dltl-069 | NFR-dltl-001 | Toàn bộ 4 controller gọi `resolveTenantDb(req)` — không rò dữ liệu chéo công ty | P0 | ❌ | Không test tự động (test hiện tại mock `resolveTenantDb` toàn cục) — chỉ xác nhận tĩnh qua đọc code, KHÔNG có integration test 2-tenant thật |
| TC-dltl-070 | AC-dltl-11 | 8 màn nhập liệu Panel đọc/ghi qua API thật, không còn mock | **P0** | ❌ | **FAIL — 8/8 vẫn mock, xem Mục 9** |

### 3.12. Danh mục chuyên biệt (Catalogs CRUD)

| Test ID | Ref | Scenario | Priority | Test thật | Kết quả thật |
|---|---|---|:---:|:---:|---|
| TC-dltl-071 | — | Tạo mới 4 loại danh mục (KPI/Product/Diligence/Adjustment), tự sinh mã `KPI01`/`SP01`/`CC01`/`BT01` | P0 | ✅ | PASS (cả 4 loại) |
| TC-dltl-072 | — | Tạo trùng tên/mã → 409 Conflict | P1 | ❌ | Không có test qua HTTP (đọc code: đúng, có `ConflictError`) |
| TC-dltl-073 | — | `GET` danh sách có `q`/`status` filter | P2 | ❌ | Không có test |
| TC-dltl-074 | — | `PATCH` cập nhật 1 item | P1 | ❌ | Không có test |
| TC-dltl-075 | — | `DELETE` item đã phát sinh dữ liệu (KpiRecord/PieceworkRecord/DiligenceRecord/SalaryAdjustmentRecord) → 400 chặn xóa | **P0** | ❌ | **Không có test cho cả 4 loại** — đây là business rule bảo vệ toàn vẹn dữ liệu tương đương `E-sal-003` của `cai_dat_luong` (đã có test ở feature liền kề) nhưng feature này CHƯA test |
| TC-dltl-076 | — | `DELETE` item chưa dùng → xóa thành công | P2 | ❌ | Không có test |

### Tổng kết Mục 3

**76 test scenario** tự thiết kế từ SRS. Đối chiếu: **13/76 (~17%) có test thật khớp hoặc gián tiếp**, trong đó **1 ca (TC-dltl-053) là test giả** (không gọi code thật) — nên số ca thực sự được bảo vệ bởi automated test chỉ còn **12/76 (~16%)**. 100% các ca liên quan trực tiếp tới 4 phát hiện 🔴 của BA (TC-dltl-013, 014, 028, 034, 063-066, 070) đều **KHÔNG có test**, đúng như kỳ vọng vì đây chính là code chưa tồn tại/chưa đúng.

---

## 4. Test Cases chi tiết ưu tiên P0 (Gherkin)

### TC-dltl-013 — Reopen bị chặn khi không có role ADMIN/OWNER

```gherkin
Ref: BR-dltl-002, AC-dltl-03, NFR-dltl-004
Preconditions: Kỳ lương "2026-08" đang ở trạng thái LOCKED. User đăng nhập với role KHÔNG phải ADMIN/OWNER (vd nhân viên nhập liệu thường).
Given kỳ lương đang LOCKED và user hiện tại không có quyền ADMIN/OWNER
When user gọi POST /payroll-periods/{id}/reopen với lý do hợp lệ (≥20 ký tự)
Then hệ thống PHẢI trả 403 Forbidden
Actual: Hệ thống trả 200 OK, kỳ chuyển về DRAFT — KHÔNG có kiểm tra role nào (BUG-dltl-003)
Status: FAIL (chức năng chưa tồn tại)
```

### TC-dltl-014 — Reopen thành công phải ghi Audit Log

```gherkin
Ref: BR-dltl-002, AC-dltl-04, NFR-dltl-003
Preconditions: Kỳ lương LOCKED, user có quyền hợp lệ.
Given kỳ lương đang LOCKED
When user gọi POST /payroll-periods/{id}/reopen với lý do "Cần mở lại để bổ sung ngày công cho nhân viên mới"
Then kỳ chuyển DRAFT VÀ một bản ghi audit log được tạo, mang đúng userId + lý do + timestamp
Actual: Kỳ chuyển DRAFT đúng, nhưng KHÔNG có bản ghi audit log nào được tạo — _input/_userId bị bỏ qua có chủ đích (prefix "_"), và tenant schema KHÔNG có bảng audit log nào để ghi vào
Status: FAIL (chức năng chưa tồn tại — cần ADR quyết định lưu ở đâu, xem OQ-dltl-003)
```

### TC-dltl-028 — workDayValue không bị chặn trần 1.0/ngày

```gherkin
Ref: BR-dltl-006 (mở rộng), liên quan AC-dltl-05
Preconditions: Kỳ lương DRAFT, nhân viên NV0001 chưa có bản ghi chấm công nào trong kỳ.
Given kỳ đang DRAFT
When kế toán gọi PUT /payroll-data/attendance/cell với { ma_nv: "NV0001", workDate: "2026-08-05", attendanceType: "lam_viec", actualHours: 24 }
Then workDayValue PHẢI bị chặn trần ở 1.0 (1 ngày không thể tính hơn 1 công)
Actual: workDayValue = Number((24/8).toFixed(2)) = 3.00 — không có Math.min(..., 1.0) nào bọc ngoài
Hệ quả: chỉ cần 9 ngày nhập actualHours=24 (thay vì 26 ngày thực), actualWorkDays đã đạt/vượt standardWorkDays=26 nhờ Math.min(actualWorkDays, standardWorkDays) ở tầng tổng — nhân viên có thể được trả đủ lương dù thực tế đi làm rất ít ngày
Status: FAIL — payrollInputs.service.ts:113
```

### TC-dltl-034 — Cảnh báo trần OT tháng phải theo cấu hình, không hardcode

```gherkin
Ref: BR-dltl-009, AC-dltl-06
Preconditions: GeneralSetting.maxOtHoursPerMonth đã được Admin đổi từ 40 (mặc định) thành 48.
Given cấu hình maxOtHoursPerMonth = 48
And nhân viên NV0001 có tổng OT tháng = 45h
When kế toán xem GET /payroll-data/overtime?periodId=...
Then isWarningMonth PHẢI = false (45 < 48, cấu hình mới)
Actual: isWarningMonth = true vì code so sánh cứng "totalHours > 40" (payrollInputs.service.ts:192), không đọc setting.maxOtHoursPerMonth dù đã query generalSetting cho phần otRate* ngay phía trên
Status: FAIL
```

### TC-dltl-063..066 — Bộ tính lương phải đọc GeneralSetting, không hardcode (BR-dltl-023)

```gherkin
Ref: BR-dltl-023, AC-dltl-05, NFR-dltl-005
Preconditions: GeneralSetting của công ty đã đổi standardWorkingDaysMethod, standardHoursPerDay,
  6 field insurance*, 3 field unionFee* khỏi giá trị mặc định.
Given GeneralSetting.standardWorkingDaysMethod = FIXED_24 (thay vì FIXED_26 mặc định)
When kế toán xem GET /payroll/calculate?periodId=...
Then standardWorkDays trong kết quả PHẢI = 24 cho mọi nhân viên
Actual: standardWorkDays luôn = 26 (literal, payrollCalculation.service.ts:136) — cấu hình bị bỏ qua hoàn toàn

Given GeneralSetting.insuranceEmployeeSocial/Health/Unemployment đổi tổng khác 10.5%
When tính lương
Then employeeInsuranceDeduction PHẢI phản ánh tỷ lệ mới
Actual: luôn dùng 0.105/0.215 literal (dòng 244-245) — 6 field insurance* trong schema hoàn toàn không được đọc ở đâu trong toàn bộ 4 service

Status: FAIL cho cả 2 nhánh — xác nhận độc lập bằng cách đọc schema.prisma (model GeneralSetting có đủ 24 field cấu hình) đối chiếu code chỉ Number(generalSetting.personalDeduction)/Number(generalSetting.dependentDeduction) (2 dòng 137-138) được dùng trong toàn bộ file
```

### TC-dltl-053 — Bất biến chặn sàn chuyên cần: PHẢI verify qua service thật

```gherkin
Ref: BR-dltl-018, AC-dltl-08
Preconditions: EmployeeSalary APPROVED của NV0001 có khoản ATTENDANCE_ALLOWANCE = 1.000.000đ.
  DiligenceRecord: 3 lần vi phạm "theo_lan" đơn giá 500.000đ (tổng phạt 1.500.000đ).
Given dữ liệu trên đã tồn tại trong kỳ DRAFT
When gọi GET /payroll-data/diligence?periodId=... (preview) VÀ GET /payroll/calculate?periodId=... (tính lương thật)
Then cả 2 nơi PHẢI trả thanhTien/diligenceSalary = 0 (không âm)
Actual của test hiện tại: test "Bất biến Tài chính" (dòng 417-425) KHÔNG gọi getDiligenceData() hay calculatePayrollPreview() — nó tự khai báo lại `const tongTru = Math.min(tongPhat, donGia)` bằng literal number ngay trong file test, rồi assert với chính công thức nó vừa viết. Nếu ai đó xóa nhầm dòng `Math.max(0, ...)` trong payrollCalculation.service.ts:220, test NÀY VẪN PASS — không phát hiện được regression thật
Status: Test hiện tại PASS nhưng KHÔNG chứng minh được điều nó tuyên bố chứng minh (false confidence) — xem BUG-dltl-006
```

### TC-dltl-060 — Công nợ thực lĩnh âm không bị ép về 0 (EC-03)

```gherkin
Ref: BR-dltl-021, AC-dltl-10
Preconditions: Nhân viên NV0001 có tổng thu nhập gộp trong kỳ = 5.000.000đ, có khoản Ứng
  (adjustment direction=tru) = 20.000.000đ trong cùng kỳ.
Given grossIncome=5tr, adjustmentNetAmount=20tr (net khấu trừ)
When gọi GET /payroll/calculate?periodId=...
Then netTakeHomeSalary PHẢI là số âm (~ -15tr trở xuống tùy thuế/bảo hiểm), KHÔNG bị ép về 0
Actual: KHÔNG có test nào gọi calculatePayrollPreview()/endpoint /payroll/calculate với payload cụ thể để verify số liệu — SRS tự nhận "đạt" chỉ qua đọc code tĩnh (không có Math.max(0,...) bọc netTakeHomeSalary), CHƯA từng chạy runtime để xác nhận
Status: Chưa kiểm chứng bằng test tự động — rủi ro nếu có ai vô tình thêm Math.max(0,...) trong lần sửa sau, sẽ không có test nào bắt được
```

---

## 5. Đối chiếu Ma trận Mã lỗi (Error Code Mechanism) — tự kiểm chứng lại

Đọc trực tiếp `constants/payrollErrors.ts`, `helpers/payrollErrors.ts`, `errorHandler.plugin.ts`, và 3 file validator — xác nhận độc lập cách phân loại của SRS Mục 7 là **chính xác**, đồng thời phát hiện thêm 1 điểm SRS chưa nêu:

- **`errorHandler.plugin.ts:26-33`**: `PayrollError` → response `{ success:false, code, errorCode, message }`. Xác nhận đúng.
- **`ValidationError` (Zod)** → response `{ success:false, errors: [...] }`, **không có field `code`** — xác nhận đúng. QA/FE viết assertion `response.body.code === 'E-dltl-xxx'` cho 11 mã lỗi loại này (005,007,008,012,013,015,017,018,020,021,023) sẽ LUÔN fail vì field không tồn tại.
- **Phát hiện thêm (không có trong SRS)**: message Zod của `E-dltl-005` (`cellOverrideSchema.actualHours`, `inputs.validator.ts:28`) là `'Số giờ không được âm'` / `'Số giờ không quá 24h'` — **không hề chứa chuỗi con `"E-dltl-005"`** ở bất kỳ đâu, khác với 10 mã Zod-only còn lại (007/008/012/013/015/017/018/020/021/023) đều có tag `(E-dltl-xxx)` ngay trong message. Tức là E-dltl-005 còn khó truy vết hơn mức SRS mô tả — không thể grep ra được kể cả bằng message string.
- **Phát hiện thêm (không có trong SRS) — sai HTTP status cho họ lỗi "FK không tồn tại"**: `E-dltl-008/013/016/018/021` (chọn ID không hợp lệ) chỉ được Zod check `.min(1)` (chuỗi không rỗng), KHÔNG check ID có tồn tại trong bảng danh mục hay không. Khi client gửi 1 ID đúng định dạng nhưng KHÔNG tồn tại (vd `kpiItemId` là UUID hợp lệ nhưng không có trong `kpiItem`), Prisma ném `P2003` (foreign key constraint) ở bước `createMany` → `errorHandler.plugin.ts:113-118` bắt và trả **409 Conflict** với message chung `"vẫn còn được tham chiếu"` — sai cả HTTP status (409 thay vì 400) lẫn message (nói ngược nghĩa: dữ liệu KHÔNG tồn tại chứ không phải "đang bị tham chiếu"). Xem BUG-dltl-009.

---

## 6. Kết quả chạy test thật (chi tiết)

```
$ npx tsx --experimental-test-module-mocks --test src/__tests__/hrmPayrollInputData.test.ts
✔ Vòng đời Kỳ lương (PayrollPeriod Lifecycle) và Khóa sổ Snapshot (316.4175ms)
✔ Bất biến Tài chính: Thuế lũy tiến 7 bậc và Chặn sàn Chuyên cần (0.2788ms)
✔ Quản lý Danh mục Chuyên biệt (Catalogs CRUD) (16.6058ms)
tests 3 | suites 0 | pass 3 | fail 0 | duration_ms 888.1684

$ npx tsx --experimental-test-module-mocks --test src/__tests__/*.test.ts
tests 638 | suites 0 | pass 634 | fail 4 | duration_ms 16797.5212
✖ TC-hrm-301 — lọc search + status (hrmSettingsShiftsHolidaysApi.test.ts) — pre-existing, unrelated
✖ TC-hrm-316 — GET ?year=2026&filter=THIS_YEAR (hrmSettingsShiftsHolidaysApi.test.ts) — pre-existing, unrelated

$ npm run typecheck   → tsc --noEmit: 0 lỗi
$ npm run lint        → 0 error, 324 warning (13 warning nằm trong 4 file feature này, toàn bộ no-explicit-any pre-existing pattern)
$ (hdđt_maxv) npm run build → tsc -b && vite build: PASS, 12351 modules, 5.31s
```

**Kết luận Regression**: Không phát hiện regression do tính năng này gây ra cho phần còn lại của hệ thống (4 fail thuộc module Ca làm việc/Lịch ngày lễ, không đụng file nào của `du_lieu_tinh_luong`).

---

## 7. Phát hiện lỗi logic qua đọc code (đọc-suy luận, không cần chạy test mới thấy)

| # | Vị trí `file:line` | Mô tả | Mức độ |
|---|---|---|:---:|
| 1 | `payrollCalculation.service.ts:44-47,142` | `activeContract = emp.hop_dong[0]` lấy hợp đồng có `ngay_bat_dau` MỚI NHẤT, KHÔNG lọc theo `ngay_ket_thuc`/khoảng phủ kỳ tính lương. Nhân viên có hợp đồng đã hết hạn (`ngay_ket_thuc` đã qua) nhưng chưa tạo hợp đồng mới vẫn bị tính lương theo hợp đồng CŨ đã hết hạn (query chỉ có `orderBy + take:1`, không có `where` lọc hiệu lực) | 🟠 High |
| 2 | `payrollInputs.service.ts:112-113` | `overrideAttendanceCell`: `workDayValue = actualHours/8.0`, không `Math.min(..., 1.0)` → 1 ngày có thể tính > 1 công (xem TC-dltl-028) | 🔴 Critical (rủi ro tài chính cụ thể, có kịch bản khai thác) |
| 3 | `payrollCalculation.service.ts` (toàn hàm `tinhThueLuyTien` + dòng 136,163,244-250) | Đã liệt kê đủ ở BR-dltl-023 — xác nhận độc lập bằng cách đối chiếu với `schema.prisma` model `GeneralSetting` (24 field cấu hình, chỉ 2 field `personalDeduction`/`dependentDeduction` được dùng) | 🔴 Critical |
| 4 | `payrollInputs.service.ts:192` | `isWarningMonth: totalHours > 40` hardcode, trong khi `setting.otRateWeekdayDay` v.v. đã được query ngay phía trên cùng hàm — chỉ cần thêm `setting.maxOtHoursPerMonth` là sửa được, cho thấy đây là thiếu sót cục bộ dễ fix chứ không phải giới hạn kiến trúc | 🟠 High |
| 5 | `errorHandler.plugin.ts:113-118` kết hợp với 5 validator không check FK tồn tại | Sai HTTP status/message cho input có ID hợp lệ format nhưng không tồn tại (409 + message sai nghĩa thay vì 400 + mã lỗi đúng) — ảnh hưởng `E-dltl-008/013/016/018/021` | 🟡 Medium |
| 6 | `__tests__/hrmPayrollInputData.test.ts:417-425` | Test "Bất biến Tài chính... Chặn sàn Chuyên cần" không gọi bất kỳ hàm nào từ `payrollCalculation.service.ts`/`payrollInputs.service.ts` — tái lập công thức bằng biến cục bộ rồi tự assert với chính nó (test giả, không bảo vệ được regression thật) | 🟠 High (process/test-integrity issue) |
| 7 | `payrollPeriods.service.ts:179` (comment) + `KyLuongSelector.tsx:104,316` (FE) | Cả comment code BE và text/toast FE đều ghi "(BR-dltl-001)" cho rule lý do Reopen ≥20 ký tự — SAI, đúng ra là **BR-dltl-002** theo định nghĩa của chính SRS. Lỗi lặp lại ở cả 2 tầng cho thấy cùng 1 nhầm lẫn từ tác giả gốc | 🟡 Low (tài liệu/traceability, không ảnh hưởng hành vi) |
| 8 | `payrollCalculation.service.ts:174` | `kpiScore` mặc định 100% khi không có `KpiRecord` nào — hợp lý nếu chủ đích (giống Chuyên cần), nhưng KHÔNG có Business Rule nào trong SRS xác nhận đây là chủ đích cho KPI (khác Chuyên cần đã ghi rõ ở BR-dltl-018 "bảng rỗng = hưởng 100%") | 🟡 Low (cần BA xác nhận, không chắc là bug) |

**Điểm tích cực xác nhận độc lập (đọc code, không phải giả định):**
- OT premium rate (6 loại `otRate*`) đọc ĐÚNG từ `GeneralSetting` (`payrollInputs.service.ts:211-219`) — trái ngược hoàn toàn với phần còn lại của BR-dltl-023, chứng tỏ code có khả năng đọc config động, chỉ là KHÔNG áp dụng nhất quán.
- Biểu thuế TNCN đúng 7 bậc, đúng số tiền từng bậc theo luật hiện hành (không phải 5 bậc, không sai công thức).
- Thứ tự tính thuế ĐÚNG (trừ bảo hiểm + giảm trừ gia cảnh trước khi tính thuế TNCN).
- 4 hàm `delete*` của Catalogs (`deleteKpiItem`/`deleteProduct`/`deleteDiligenceType`/`deleteAdjustmentItem`) đều có guard chặn xóa khi đã phát sinh dữ liệu — đúng pattern `E-sal-003` của `cai_dat_luong`, dù chưa có test.
- Toàn bộ 6 hàm `apply*` + `lockPayrollPeriod` đều bọc `$transaction` — xác nhận BR-dltl-022.
- `netTakeHomeSalary` không có `Math.max(0,...)` bọc ngoài — xác nhận BR-dltl-021 đúng (dù chưa có test, xem TC-dltl-060).

---

## 8. Thẩm định 4 phát hiện 🔴 của BA

| # | Phát hiện của BA | Thẩm định độc lập | Kết luận |
|---|---|---|---|
| 1 | 8/8 `*Panel.tsx` vẫn import `mock/hooks/*`, chưa nối API thật | Tự đọc trực tiếp import block của cả 8 file (`ChamCongPanel`, `TangCaPanel`, `KpiPanel`, `ThuongPanel`, `LuongSanPhamPanel`, `LuongPhanTramPanel`, `ChuyenCanPanel`, `BuTruPanel`) — **XÁC NHẬN ĐÚNG 100%**, không có ngoại lệ | ✅ **CONFIRMED**, và tìm thêm bằng chứng mở rộng: tổng cộng **22 file** (không chỉ 8 Panel) trong `components/du_lieu_tinh_luong/` còn import từ `mock/hooks/*`, gồm cả `ThanhLocKyLuong.tsx` (thanh lọc DÙNG CHUNG) và 7/8 dialog "Tái sử dụng" (`TaiSuDung*Dialog.tsx`) — xem Mục 9 |
| 2 | Động cơ tính lương chỉ đọc 2/~15 tham số `GeneralSetting`, còn lại hardcode | Đọc trực tiếp `payrollCalculation.service.ts` dòng 136,163,244-250 + đối chiếu `schema.prisma` model `GeneralSetting` (đếm được **24 field** cấu hình, không phải ~15 — con số thật CÒN LỚN HƠN BA ước tính) — **XÁC NHẬN ĐÚNG, mở rộng thêm phạm vi** | ✅ **CONFIRMED + mở rộng**: thêm 1 vị trí hardcode `8.0` độc lập thứ 2 tại `payrollInputs.service.ts:113` (ảnh hưởng `workDayValue` ngay từ lúc nhập liệu, không chỉ lúc tính lương cuối) |
| 3 | Reopen thiếu role-guard + audit log | Đọc `payrollPeriods.controller.ts:66-72`, `payrollPeriods.route.ts:15`, `hrm.route.ts:34-39` — xác nhận route Reopen dùng CHUNG preHandler `requireModule('hrm')` với mọi route HRM khác, không có preHandler riêng nào phân biệt role. Đọc `payrollPeriods.service.ts:181-201` — xác nhận `_input`/`_userId` bị bỏ qua, không ghi gì | ✅ **CONFIRMED**, thêm bằng chứng: FE `KyLuongSelector.tsx` cũng KHÔNG có bất kỳ điều kiện role nào trước khi hiện nút "Mở lại kỳ lương" — lỗ hổng tồn tại ở CẢ 2 tầng, không chỉ Backend |
| 4 | `createPayrollPeriod` không tự sinh lịch công chuẩn | Đọc toàn bộ hàm `createPayrollPeriod` (`payrollPeriods.service.ts:71-96`) — chỉ tạo 1 bản ghi `PayrollPeriod`, không có lời gọi nào tới `holiday.findMany()` hay `attendanceRecord.createMany()`/`upsert()` | ✅ **CONFIRMED**, không có gì để bổ sung — bằng chứng rõ ràng và đầy đủ |

**Không phát hiện điểm nào trong 4 phát hiện của BA là sai hoặc phóng đại.** Cả 4 đều xác nhận đúng qua đọc code độc lập, và 2/4 phát hiện (1, 2) còn được mở rộng thêm bằng chứng cụ thể hơn.

---

## 9. Đối chiếu FE mock 8 phân hệ với API thật (Bug tích hợp)

### 9.1. 8 Panel chính — xác nhận 100% còn mock

| Panel | Hook mock đang dùng | File:line |
|---|---|---|
| `ChamCongPanel.tsx` | `useBangChamCong`, `useDatLaiChamCong`, `useDatOChamCong` | `mock/hooks/chamCong` (dòng 20-24) |
| `TangCaPanel.tsx` | `useApDungTangCa`, `useLuuMauTangCa`, `useMauTangCa`, `useTangCaRows` | `mock/hooks/tangCa` (dòng 25-30) |
| `KpiPanel.tsx` | `useApDungKpi`, `useChiTieuKpiList`, `useKpiRows`, `useLuuMauKpi`, `useMauKpi` | `mock/hooks/kpi` (dòng 23-29) |
| `ThuongPanel.tsx` | `useApDungThuong`, `useKhoanThuongList`, `useLuuMauThuong`, `useMauThuong`, `useThuongRows` | `mock/hooks/thuong` (dòng 24-30) |
| `LuongSanPhamPanel.tsx` | `useApDungLuongSanPham`, `useLuongSanPhamRows`, `useLuuMauLuongSanPham`, `useMauLuongSanPham`, `useSanPhamList` | `mock/hooks/luongSanPham` (dòng 24-30) |
| `LuongPhanTramPanel.tsx` | `useApDungLuongPhanTram`, `useKhoanPhanTramList`, `useLuongPhanTramRows`, `useLuuMauLuongPhanTram`, `useMauLuongPhanTram` | `mock/hooks/luongPhanTram` (dòng 24-30) |
| `ChuyenCanPanel.tsx` | `useApDungChuyenCan`, `useChuyenCanRows`, `useLoaiChuyenCanList`, `useLuuMauChuyenCan`, `useMauChuyenCan` | `mock/hooks/chuyenCan` (dòng 23-29) |
| `BuTruPanel.tsx` | `useApDungBuTru`, `useBuTruRows`, `useKhoanBuTruList`, `useLuuMauBuTru`, `useMauBuTru` | `mock/hooks/buTru` (dòng 24-30) |

**Hệ quả**: người dùng thao tác trên 8 màn hình chính (bảng nhập liệu, nút "Áp dụng") của UI thật **không hề gọi tới** 21 endpoint `/payroll-data/*` đã viết ở backend — toàn bộ 849 dòng `payrollInputs.service.ts` hiện chưa có đường vào từ UI production.

### 9.2. Ngoài 8 Panel — 14 file khác cũng còn mock (mở rộng so với SRS)

Quét toàn bộ `components/du_lieu_tinh_luong/**` (22 file khớp `mock/hooks`), trừ 8 Panel ở trên còn lại **14 file**:

- `ThanhLocKyLuong.tsx:15` — `usePhongBanList` từ `mock/hooks/phongBan` — **dùng chung cho cả 8 màn** (thanh lọc phạm vi/phòng ban). Rủi ro cụ thể: nếu mã `ma_pb` trong dữ liệu mock KHÔNG khớp mã phòng ban thật của công ty (bảng `hrm_phong_ban`), chọn "Áp dụng theo phòng ban" sẽ gửi `ma_pb` sai lên backend → `resolveTargetEmployees` trả về danh sách RỖNG một cách âm thầm (không lỗi, không cảnh báo — xem BR-dltl-004 chỉ chặn `ma_pb` THIẾU chứ không chặn `ma_pb` SAI/không tồn tại).
- 7 dialog `TaiSuDung*Dialog.tsx` (Tăng ca/KPI/Thưởng/Sản phẩm/Phần trăm/Chuyên cần/Bù trừ) — **mixed**: đã đổi phần danh mục (`useKhoanBuTruList` v.v.) sang API thật (`api/payrollCatalogsQueries`), nhưng phần lõi của chính tính năng "tái sử dụng" (`useBanBuTruList`/`useBanTangCaList`/... — danh sách các lần "áp dụng" trước đó để chép lại) và `useNhanVienList` (danh sách nhân viên) **vẫn mock**. Đây là điểm SRS Mục 11 dòng "Kết luận tích cực" nêu hơi lạc quan ("dialog Tái sử dụng của 6/8 module: đã nối API thật") — thực tế các dialog này chỉ nối MỘT PHẦN, không phải toàn bộ.
- 6 file `DanhSach*Card.tsx` (bảng hiển thị dữ liệu đã nhập của Tăng ca/Thưởng/Sản phẩm/Phần trăm/Chuyên cần/Bù trừ) — dùng hook `useXoaBan*`/tương tự từ mock cho thao tác xóa "bản" đã lưu (tính năng phụ, không phải luồng nhập liệu chính).

### 9.3. Bug tích hợp cụ thể (UI hiển thị hành vi backend không có / ngược lại)

- **UI có, Backend không**: KHÔNG phát hiện nút/luồng nào ở FE gọi tới endpoint không tồn tại — vì FE hiện tại còn dùng mock nên chưa thực sự "gọi" gì tới backend cho 8 Panel chính, nên loại bug tích hợp này chưa lộ ra được (sẽ chỉ lộ ra SAU khi nối API thật, đúng như OQ-dltl-006 đã cảnh báo về rủi ro payload "áp dụng hàng loạt" xóa nhầm dữ liệu nếu FE gửi thiếu).
- **Backend có, UI ẩn/không dùng**: `PayrollPeriodContext.tsx:36` (`isReadOnly = isLocked || status==='PENDING_REVIEW'`) khóa toàn bộ UI nhập liệu ngay khi kỳ chuyển `PENDING_REVIEW`, trong khi Backend (`payrollPeriodLockGuard.ts`) **cho phép ghi** ở trạng thái này — xác nhận đúng như SRS Mục 6.2. Do FE khóa sớm hơn, tính năng "vẫn sửa được khi đang chờ duyệt" của Backend hiện **không có đường vào từ UI thật** (chỉ gọi được qua API trực tiếp) — cần OQ-dltl-010 chốt trước khi coi đây là bug hay tính năng ẩn có chủ đích.
- **Nút "Mở lại kỳ lương"** ở `KyLuongSelector.tsx:228-239` hiển thị cho MỌI user khi kỳ `LOCKED` — không ẩn/disable theo role — khớp với lỗ hổng thiếu role-guard ở Backend (Mục 8, phát hiện #3), tạo thành lỗ hổng phân quyền xuyên suốt cả 2 tầng.

---

## 10. Danh mục Bug & Issues

### Bug 🔴 Critical

**BUG-dltl-001** — 8/8 Panel chính (+14 file phụ) chưa nối API thật, toàn bộ nghiệp vụ nhập liệu qua UI vẫn chạy trên dữ liệu giả lập
- Severity: Critical · Priority: P0
- Environment: `hdđt_maxv` (dev)
- Steps to reproduce: Mở bất kỳ 1 trong 8 tab của "Dữ liệu tính lương" → mở DevTools Network tab → thao tác nhập/lưu dữ liệu → quan sát không có request nào gọi `/payroll-data/*`.
- Expected: Request thật gọi API `/payroll-data/{module}/apply`.
- Actual: Không có network request nào — toàn bộ state chạy qua `mock/hooks/*` (localStorage/in-memory).
- Vị trí: 8 file `*Panel.tsx` liệt kê ở Mục 9.1 + `ThanhLocKyLuong.tsx:15` + 7 `TaiSuDung*Dialog.tsx` + 6 `DanhSach*Card.tsx`.
- Suspected root cause: Phiên "fullstack-engineer" trước chỉ nối API cho tầng `api/*Queries.ts` + `Context`/`Selector` + dialog "Quản lý danh mục", chưa động tới các file Panel/Card/dialog-tái-sử-dụng vốn là phần lõi hiển thị.

**BUG-dltl-002** — Động cơ tính lương hardcode ~22/24 tham số cấu hình, bỏ qua `GeneralSetting` doanh nghiệp đã khai báo
- Severity: Critical · Priority: P0
- Steps to reproduce: Đổi bất kỳ giá trị nào trong `hrm_general_settings` (vd `standardHoursPerDay` từ 8.0 → 7.5) → gọi `GET /payroll/calculate` → so sánh kết quả trước/sau.
- Expected: Kết quả tính lương thay đổi theo cấu hình mới.
- Actual: Kết quả KHÔNG đổi (trừ 2 trường `personalDeduction`/`dependentDeduction`).
- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts:136,163,244-250` + hàm `tinhThueLuyTien` dòng 7-28 + `payrollInputs.service.ts:113`.
- Suspected root cause: Field `taxBrackets Json` và 22 field khác của `GeneralSetting` đã được thiết kế sẵn trong schema nhưng chưa được nối vào công thức tính — thiếu bước tích hợp cuối, không phải thiếu thiết kế dữ liệu.

**BUG-dltl-003** — Reopen kỳ lương không có role-guard (mọi user qua `requireModule('hrm')` đều mở lại được kỳ đã khóa sổ)
- Severity: Critical · Priority: P0
- Steps to reproduce: Đăng nhập tài khoản nhân viên nhập liệu thường (không phải OWNER) → chọn kỳ đã LOCKED → bấm "Mở lại kỳ lương" → nhập lý do ≥20 ký tự → xác nhận.
- Expected: 403 Forbidden.
- Actual: 200 OK, kỳ chuyển về DRAFT.
- Vị trí: `be_maxv/src/controllers/client/hrm/du_lieu_tinh_luong/payrollPeriods.controller.ts:66-72`, `routes/hrm/du_lieu_tinh_luong/payrollPeriods.route.ts:15` (không preHandler riêng), `routes/hrm/hrm.route.ts:34-39` (guard chung `requireModule('hrm')`). FE: `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/KyLuongSelector.tsx:228-239` (nút hiện cho mọi user).
- Suspected root cause: Thiếu preHandler role-check riêng cho nhóm route nhạy cảm tài chính — cần quyết định trước (OQ-dltl-004) role nào map với "ADMIN" trong đặc tả.

**BUG-dltl-004** — Reopen không ghi Audit Log (không có bảng audit nào trong tenant schema)
- Severity: Critical · Priority: P0
- Steps to reproduce: Thực hiện reopen thành công 1 kỳ → tìm bản ghi audit log tương ứng trong DB.
- Expected: 1 bản ghi audit log chứa userId, lý do, thời điểm.
- Actual: Không có bảng nào để tra — `grep` `schema.prisma` xác nhận không tồn tại model audit log liên quan `PayrollPeriod`.
- Vị trí: `payrollPeriods.service.ts:181-201` (`_input`, `_userId` prefix `_` = cố ý bỏ qua).
- Suspected root cause: Cần ADR quyết định tạo bảng audit riêng hay dùng chung cơ chế audit đã có ở module khác (OQ-dltl-003) — việc này ảnh hưởng schema migration nên chưa thể tự làm ở tầng service.

**BUG-dltl-005** — `createPayrollPeriod` không tự sinh lịch công chuẩn
- Severity: Critical · Priority: P1 (không chặn vận hành cơ bản như 4 bug trên, nhưng sai với đặc tả gốc và ảnh hưởng trực tiếp UX nhập chấm công theo mô hình "delta")
- Steps to reproduce: Tạo kỳ lương mới → xem bảng Chấm công.
- Expected (theo `BA_ANALYSIS_SPEC.md` Mục 4.1): Đã có sẵn lịch công chuẩn (26 ngày công, trừ ngày lễ theo `Holiday`) cho tất cả nhân viên.
- Actual: Không có bản ghi `AttendanceRecord` nào được tạo — bảng Chấm công trống, engine tính lương tự bù `standardWorkDays` khi rỗng (hành vi tương đương về SỐ nhưng không tạo dữ liệu tường minh để kế toán soát/sửa từng ngày).
- Vị trí: `payrollPeriods.service.ts:71-96` (toàn hàm).

### Bug 🟠 High

**BUG-dltl-006** — Test "Bất biến Tài chính... Chặn sàn Chuyên cần" không gọi code sản xuất thật (test giả)
- Severity: High · Priority: P1
- Steps to reproduce: Xóa dòng `Math.max(0, donGia - tongTru)` trong `payrollCalculation.service.ts:220` (giả lập regression) → chạy lại `hrmPayrollInputData.test.ts`.
- Expected: Test fail (phát hiện regression).
- Actual: Test vẫn PASS (đã verify bằng đọc code — test không import/gọi hàm nào từ 2 service, chỉ tự tính lại bằng biến cục bộ trong chính file test).
- Vị trí: `be_maxv/src/__tests__/hrmPayrollInputData.test.ts:410-426`.

**BUG-dltl-007** — `workDayValue` không bị chặn trần 1.0/ngày, rủi ro overpayment cụ thể
- Severity: High · Priority: P1
- Steps to reproduce: `PUT /payroll-data/attendance/cell` với `actualHours=24` cho 1 ngày → xem `workDayValue` trả về.
- Expected: `workDayValue` tối đa 1.0.
- Actual: `workDayValue = 3.00`.
- Vị trí: `payrollInputs.service.ts:112-113`.

**BUG-dltl-008** — `activeContract` không lọc theo hiệu lực/khoảng phủ kỳ lương
- Severity: High · Priority: P1
- Steps to reproduce: Nhân viên có `hop_dong` với `ngay_ket_thuc` đã qua (hợp đồng cũ hết hạn), chưa tạo hợp đồng mới → tính lương kỳ hiện tại.
- Expected: Không tính lương theo hợp đồng đã hết hạn, hoặc cảnh báo thiếu hợp đồng hiệu lực (liên hệ E-dltl-002/BR-dltl-003).
- Actual: Vẫn lấy `hop_dong[0]` (mới nhất theo `ngay_bat_dau`, không lọc ngày hết hạn) để tính `baseSalaryMonthly`.
- Vị trí: `payrollCalculation.service.ts:44-47,142`.

**BUG-dltl-010** — `ThanhLocKyLuong` (thanh lọc DÙNG CHUNG 8 màn) dùng mock `phongBan`, rủi ro "Áp dụng theo phòng ban" nhắm sai/0 nhân viên
- Severity: High · Priority: P1 (nâng mức so với 🟡 của SRS vì đây là component DÙNG CHUNG, và hệ quả — scope rỗng âm thầm — không có cảnh báo nào ở BR-dltl-004)
- Vị trí: `hdđt_maxv/.../ThanhLocKyLuong.tsx:15`.

**BUG-dltl-011** — Nút "Mở lại kỳ lương" không ẩn/khóa theo role ở FE
- Severity: High · Priority: P1 (đi kèm BUG-dltl-003, cần sửa đồng bộ 2 tầng)
- Vị trí: `KyLuongSelector.tsx:228-239`.

**ISSUE-dltl-001** — Độ phủ test tự động quá thấp so với SRS
- Severity: High · Priority: P1
- Mô tả: Chỉ 12-13/76 (~16-17%) test scenario tự thiết kế từ SRS có test thật khớp; 0 test nào gọi `GET /payroll/calculate` (349 dòng engine tính lương hoàn toàn chưa test qua HTTP); 0 test cho 6/8 phân hệ nhập liệu (KPI/Thưởng/Sản phẩm/Phần trăm/Chuyên cần/Ứng-bù trừ) qua đường `apply`; 0 test cho catalogs UPDATE/DELETE/duplicate-name. Xem Mục 3 để biết danh sách đầy đủ.

### Bug/Issue 🟡 Medium/Low

**BUG-dltl-009** — Sai HTTP status/message cho ID hợp lệ-format-nhưng-không-tồn-tại (E-dltl-008/013/016/018/021)
- Severity: Medium · Priority: P2 · Vị trí: `errorHandler.plugin.ts:113-118` + 5 validator liên quan.

**BUG-dltl-012** — Sai mã Business Rule trích dẫn ("BR-dltl-001" thay vì "BR-dltl-002") ở cả BE comment và FE UI text
- Severity: Low · Priority: P3 · Vị trí: `payrollPeriods.service.ts:179`, `KyLuongSelector.tsx:104,316`.

**BUG-dltl-013** — Message Zod của E-dltl-005 không mang mã lỗi, khó truy vết hơn cả nhóm Zod-only còn lại
- Severity: Low · Priority: P3 · Vị trí: `inputs.validator.ts:28`.

**ISSUE-dltl-002** — SRS Mục 11 "Kết luận tích cực" hơi lạc quan về dialog "Tái sử dụng"
- Severity: Low · Priority: P3 · Mô tả: 7/7 dialog `TaiSuDung*` chỉ nối MỘT PHẦN (danh mục thật, nhưng `useNhanVienList` + "bản đã lưu" vẫn mock) — cần cập nhật câu chữ SRS cho chính xác hơn khi có dịp, không chặn tiến độ.

**ISSUE-dltl-003** (thông tin, không thuộc phạm vi feature này) — 4 test fail pre-existing trong `hrmSettingsShiftsHolidaysApi.test.ts` (TC-hrm-301 bỏ dấu tìm kiếm, TC-hrm-316 thiếu trường "thứ trong tuần") — không liên quan `du_lieu_tinh_luong`, nêu ở đây để tránh nhầm lẫn khi CI đỏ.

**ISSUE-dltl-004** — 10 Open Questions (`OQ-dltl-001`..`010`) của SRS chưa được Architect/BA/Product chốt — chặn Backend Engineer sửa dứt điểm BUG-dltl-003/004/005 vì cần quyết định thiết kế (role mapping, nơi lưu audit log, có sinh lịch công tự động hay không).

---

## 11. QA Recommendation

**Verdict: ❌ FAILED — KHÔNG đạt điều kiện "Ready for Implementation sign-off tiếp"/production.**

Lý do: 4/4 phát hiện 🔴 của BA đều được xác nhận đúng qua kiểm định độc lập, cộng thêm 5 bug/issue 🟠 High mới phát hiện (trong đó BUG-dltl-006 đặc biệt nghiêm trọng về mặt QUY TRÌNH — một bất biến tài chính cốt lõi được cả `walkthrough.md` lẫn `srs-du-lieu-tinh-luong.md` trích dẫn "đã có unit test xác nhận" thực chất không được bảo vệ bởi test nào chạm tới code thật). Độ phủ test tự động (~16%) quá thấp để tự tin merge, đặc biệt là **0% cho engine tính lương** (endpoint quan trọng nhất của toàn bộ tính năng) và **0% cho 6/8 phân hệ nhập liệu qua đường HTTP `apply`**.

**Khuyến nghị thứ tự xử lý** (không tự sửa — chờ BA/Architect chốt các OQ liên quan trước khi Backend Engineer bắt tay, đúng luồng `CLAUDE.md`):
1. BUG-dltl-001 (nối 8 Panel + 14 file phụ vào API thật) — chặn toàn bộ giá trị sử dụng thực tế của tính năng.
2. BUG-dltl-002 (đọc `GeneralSetting` đầy đủ) — sai số liệu tài chính, ảnh hưởng mọi kỳ lương đã/sẽ khóa sổ.
3. BUG-dltl-003 + BUG-dltl-011 (role-guard Reopen cả 2 tầng) và BUG-dltl-004 (audit log) — rủi ro kiểm toán/compliance.
4. BUG-dltl-007 (chặn trần workDayValue) — rủi ro overpayment cụ thể, sửa nhanh (1 dòng `Math.min`).
5. BUG-dltl-005, BUG-dltl-008 — đúng theo mức độ ảnh hưởng dữ liệu.
6. Viết bổ sung test cho toàn bộ 63 scenario ❌/⚠️ ở Mục 3 trước khi coi là Done, ưu tiên tuyệt đối nhóm P0 (đặc biệt TC-dltl-053 phải được viết LẠI để gọi service thật, và TC-dltl-061 phải test `GET /payroll/calculate` qua HTTP).

Sau khi Backend Engineer fix xong, Tester-QA sẽ chạy lại toàn bộ Mục 3 (Phase B lần 2) trước khi chuyển Code Reviewer.

---

## 12. Log đề xuất (KHÔNG tự ghi — đề xuất để `docs/hrm/CONTEXT_SUMMARY.md`/`work-log.md` gộp sau)

```
## [2026-09-09] tester-qa — Kiểm định độc lập & Test Design cho Dữ liệu tính lương (Phase A+B)
- Nhiệm vụ: Tự thiết kế 76 test scenario từ srs-du-lieu-tinh-luong.md (KHÔNG nhìn code trước),
  đối chiếu ngược với hrmPayrollInputData.test.ts thật, tự chạy lại toàn bộ test/typecheck/lint/build,
  đọc tĩnh 4 service để săn lỗi logic, thẩm định độc lập 4 phát hiện 🔴 của BA, đối chiếu 22 file FE
  (8 Panel + 14 phụ) với API thật.
- Kết quả chạy thật: hrmPayrollInputData.test.ts 3/3 PASS (888ms) · toàn bộ suite 634/638 PASS
  (4 fail pre-existing, không liên quan, ở hrmSettingsShiftsHolidaysApi.test.ts) · typecheck 0 lỗi ·
  lint 0 error/324 warning (13 warning pre-existing pattern trong 4 file feature) ·
  hdđt_maxv build PASS (12351 modules, 5.31s).
- Đã tạo: docs/hrm/du_lieu_tinh_luong/qa-report-du-lieu-tinh-luong.md — test matrix 76 ca (~16% có
  test thật), 5 bug 🔴 Critical (BUG-dltl-001..005), 6 bug/issue 🟠 High (BUG-dltl-006..008,010,011,
  ISSUE-dltl-001), 5 bug/issue 🟡 (BUG-dltl-009,012,013, ISSUE-dltl-002..004).
- Xác nhận ĐỘC LẬP cả 4 phát hiện 🔴 của BA đúng, mở rộng thêm bằng chứng cho phát hiện #1 (22 file
  không chỉ 8) và #2 (24 field GeneralSetting, thêm 1 vị trí hardcode 8.0h độc lập ở payrollInputs).
- Phát hiện MỚI quan trọng nhất: test "Bất biến Tài chính... Chặn sàn Chuyên cần" (dòng 417-425) là
  test giả — không gọi code sản xuất thật, chỉ tự đối chiếu công thức với chính nó (BUG-dltl-006).
- QA Verdict: ❌ FAILED — chưa đạt điều kiện production, xem Mục 11 báo cáo để biết thứ tự xử lý.
- Liên kết: docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md · qa-report-du-lieu-tinh-luong.md
- Không sửa code/test hiện có (đúng ràng buộc nhiệm vụ). Không tham khảo chéo kết quả Architect
  (đang chạy song song độc lập).
```

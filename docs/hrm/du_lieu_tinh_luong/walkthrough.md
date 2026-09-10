# Báo cáo Nghiệm thu Kỹ thuật: Phân hệ Dữ liệu Tính Lương (`du_lieu_tinh_luong`) cho `be_maxv`

> **Ngày hoàn thành**: 2026-09-09  
> **Người thực hiện**: Senior Business Analyst & Backend Engineer  
> **Dự án**: ERP maxv_v2 — `be_maxv` (Fastify + Prisma PostgreSQL Multi-tenant)  
> **Tài liệu tham chiếu**:  
> - `docs/nestjs/du_lieu_tinh_luong/` (SRS, Data Model, API Contract, Test Cases)  
> - `docs/hrm/du_lieu_tinh_luong/BA_ANALYSIS_SPEC.md`  
> - `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/` (8 mock components)  

---

## 1. Tóm tắt Kết quả Thực hiện

Phân hệ **Dữ liệu tính lương (`du_lieu_tinh_luong`)** đã được xây dựng và tích hợp thành công vào backend `be_maxv`, tuân thủ 100% chuẩn kiến trúc Fastify và Multi-tenancy hiện tại của hệ thống.

### Các hạng mục hoàn thành:
1. **Cơ sở Dữ liệu & Prisma Schema (`be_maxv/prisma/tenant/schema.prisma`)**:
   - Thêm **6 Enums**: `PayrollPeriodStatus`, `AttendanceType`, `OvertimeType`, `DiligenceDeductionMethod`, `AdjustmentDirection`, `CatalogStatus`.
   - Thêm **14 Models**: `PayrollPeriod`, `AttendanceRecord`, `OvertimeRecord`, `KpiItem`, `KpiRecord`, `BonusRecord`, `PieceworkProduct`, `PieceworkRecord`, `CommissionRecord`, `DiligenceViolationType`, `DiligenceRecord`, `SalaryAdjustmentItem`, `SalaryAdjustmentRecord`, `PayrollSheetLine`.
   - Cập nhật quan hệ 2 chiều trên `hrm_nhan_vien` (dùng khóa tự nhiên `ma_nv String @db.VarChar(24)`) và `SalaryItem`.
   - Sinh mã Prisma Client (`npx prisma generate`) thành công 100%.

2. **Hệ thống Mã Lỗi & Guard Trạng thái**:
   - `be_maxv/src/constants/payrollErrors.ts`: Định nghĩa chuẩn hóa 26 mã lỗi `E-dltl-001` .. `E-dltl-026`.
   - `be_maxv/src/helpers/payrollErrors.ts`: Class `PayrollError` kế thừa Error, mang `code` và `statusCode`.
   - `be_maxv/src/plugins/errorHandler.plugin.ts`: Ánh xạ `PayrollError` trả về JSON `{ success: false, code, errorCode, message }`.
   - `be_maxv/src/helpers/payrollPeriodLockGuard.ts`: `assertPayrollPeriodWritable` kiểm tra trạng thái kỳ, chặn ghi khi `LOCKED`, `APPROVED`, `PAID`, `ARCHIVED` (ném `E-dltl-001`).

3. **Validators (Zod Schemas)**:
   - `payrollPeriods.validator.ts`: Validate tạo kỳ, cập nhật, chuyển trạng thái, lý do mở lại $\ge 20$ ký tự.
   - `catalogs.validator.ts`: Validate CRUD cho 4 danh mục chuyên biệt (KPI, Sản phẩm, Chuyên cần, Bù trừ).
   - `inputs.validator.ts`: Validate đầu vào 8 phân hệ nhập liệu và phân giải phạm vi áp dụng (`toan_cong_ty`, `phong_ban`, `nhan_vien`).

4. **Tầng Nghiệp vụ (Services)**:
   - `payrollPeriods.service.ts`: Quản lý trọn vẹn vòng đời kỳ lương `DRAFT` ➔ `PENDING_REVIEW` ➔ `LOCKED` ➔ `APPROVED` ➔ `PAID` ➔ `ARCHIVED` và `REOPEN`.
   - `catalogs.service.ts`: CRUD 4 danh mục, tự sinh mã tiếp theo (`KPI01..`, `SP01..`, `CC01..`, `BT01..`), ràng buộc cấm xóa `RESTRICT` khi đã có dữ liệu con.
   - `payrollInputs.service.ts`: Xử lý 8 phân hệ biến động:
     1. Chấm công: Ma trận công tháng, ghi đè delta ô công (`workDayValue = actualHours / 8.0`).
     2. Tăng ca: Áp dụng bảng OT, snapshot hệ số từ `GeneralSetting`, tính giờ quy đổi, cảnh báo trần 40h/tháng.
     3. KPI: Tính tỷ lệ hoàn thành, hiệu suất bình quân có trọng số, kiểm tra tổng trọng số $> 0$.
     4. Thưởng: Ghi nhận thưởng hàng loạt (tái sử dụng `SalaryItem` loại `PERIODIC_BONUS`), chặn số tiền âm.
     5. Lương sản phẩm: Snapshot đơn giá theo kỳ, tính thành tiền nghiệm thu.
     6. Lương phần trăm: Snapshot tỷ lệ hoa hồng %, tính thành tiền doanh số.
     7. Chuyên cần: 3 cách trừ (theo giờ, theo lần, mất toàn bộ), áp dụng bất biến chặn sàn $\min(\sum \text{phat}, \text{don\_gia})$, không trừ âm sang lương cơ bản.
     8. Ứng - Bù trừ: Tính toán tổng bị trừ ròng `sum(tru) - sum(bu)`.
   - `payrollCalculation.service.ts`: Động cơ tính toán bảng lương tổng hợp 18 cột (thuế TNCN 7 bậc lũy tiến, bảo hiểm, công đoàn, công nợ thực lĩnh âm) và chốt snapshot bất biến vào `hrm_payroll_sheet_lines`.

5. **Controllers & Routes**:
   - `payrollPeriods.controller.ts` & `payrollPeriods.route.ts`
   - `catalogs.controller.ts` & `catalogs.route.ts`
   - `payrollInputs.controller.ts` & `payrollInputs.route.ts`
   - `payrollCalculation.controller.ts` & `payrollCalculation.route.ts`
   - Đăng ký vào `hrmRoutes` tại `be_maxv/src/routes/hrm/hrm.route.ts`.

---

## 2. Kết quả Kiểm thử & Xác minh Chất lượng

1. **Kiểm tra Biên dịch TypeScript (`npm run typecheck`)**:
   - Kết quả: **Exit code 0** (0 lỗi, 100% sạch).
2. **Kiểm tra Mã tĩnh Linter (`npm run lint`)**:
   - Kết quả: **Exit code 0** (0 lỗi).
3. **Kiểm thử Tích hợp Tự động (`src/__tests__/hrmPayrollInputData.test.ts`)**:
   - Test 1: Vòng đời Kỳ lương & Khóa sổ Snapshot (Tạo kỳ, 409 khi trùng, Submit, Lock, Chặn ghi khi LOCKED với `E-dltl-001`, Reopen lý do < 20 ký tự bị từ chối, Reopen thành công).
   - Test 2: Bất biến Tài chính (Thuế TNCN 7 bậc lũy tiến, Chặn sàn chuyên cần không âm).
   - Test 3: Quản lý 4 Danh mục Chuyên biệt (Tự sinh mã `KPI01`, `SP01`, `CC01`, `BT01`).
   - Kết quả: **3 / 3 test suites pass 100%**.
4. **Kiểm thử Toàn hệ thống (`npm test`)**:
   - **634 tests pass**, không có bất kỳ hồi quy (zero regressions) trên toàn bộ các phân hệ cũ.

---

## 3. Tích hợp Frontend (`hdđt_maxv`)

Đã hoàn thành 100% việc nối frontend `hdđt_maxv` với backend `be_maxv`:
1. **Query Keys (`hrmKeys.ts`)**:
   - `hrmPayrollPeriodKeys`: Quản lý kỳ lương (`all`, `list`, `detail`).
   - `hrmPayrollCatalogKeys`: 4 danh mục chuyên biệt (`kpiList`, `productList`, `diligenceTypeList`, `adjustmentItemList`).
   - `hrmPayrollDataKeys`: 8 phân hệ nhập liệu theo kỳ (`attendanceMatrix`, `overtimeList`, `kpiList`, `bonusList`, `pieceworkList`, `commissionList`, `diligenceList`, `adjustmentList`).
   - `hrmPayrollCalculationKeys`: Bảng tính preview và sheet-lines snapshot (`calculate`, `sheetLines`).
2. **Hệ thống API Client & TanStack React-Query Hooks**:
   - `payrollPeriodsApi.ts` & `payrollPeriodsQueries.ts`: Trọn vẹn 12 API vòng đời kỳ lương (`list`, `get`, `create`, `update`, `delete`, `submit`, `reject`, `lock`, `reopen`, `approve`, `markPaid`, `archive`).
   - `payrollCatalogsApi.ts` & `payrollCatalogsQueries.ts`: CRUD 4 danh mục chuyên biệt với adapter chuyển đổi định dạng chuẩn FE/BE.
   - `payrollInputsApi.ts` & `payrollInputsQueries.ts`: 8 phân hệ nhập liệu biến động theo kỳ.
   - `payrollCalculationApi.ts` & `payrollCalculationQueries.ts`: Động cơ tính toán bảng lương preview và đọc snapshot sheet lines khi kỳ chuyển `LOCKED`.
   - `salaryItemsQueries.ts`: Bổ sung `useKhoanThuongList` và `useKhoanPhanTramList` đọc từ danh mục khoản lương thực tế.
3. **Quản lý Kỳ lương trên Giao diện (`KyLuongSelector` & `PayrollPeriodContext`)**:
   - `PayrollPeriodContext.tsx` & `useCurrentPayrollPeriod.ts`: Lưu trữ kỳ lương đang chọn vào LocalStorage, tự động fallback kỳ gần nhất, bảo vệ trạng thái chỉ đọc (`isReadOnly`) khi kỳ đã khóa sổ.
   - `KyLuongSelector.tsx`: Thanh chọn kỳ lương trên UI với các nút chuyển trạng thái (Tạo kỳ mới, Trình duyệt, Khóa sổ, Duyệt, Mở lại kỳ lương với bắt buộc lý do $\ge 20$ ký tự).
   - Dialog & Card Components đã cập nhật nối API thật: `QuanLyKpiDialog`, `BangChiTieuKpiCard`, `TaiSuDungKpiDialog`, `QuanLySanPhamDialog`, `BangSanPhamCard`, `TaiSuDungSanPhamDialog`, `QuanLyChuyenCanDialog`, `BangChuyenCanCard`, `QuanLyBuTruDialog`, `BangBuTruCard`, `TaiSuDungBuTruDialog`, `QuanLyThuongDialog`, `BangKhoanThuongCard`, `QuanLyPhanTramDialog`, `BangPhanTramCard`, `DuLieuLuongPage`.

---

## 4. Kết quả Kiểm thử & Đóng gói Toàn diện

1. **Frontend Lint (`npm run lint`)**:
   - Kết quả: **Exit code 0** (0 error, 0 warning).
2. **Frontend Build (`npm run build` — `tsc -b && vite build`)**:
   - Kết quả: **Build thành công 100%** (Exit code 0, 12351 modules transformed, 5.31s).
3. **Backend Unit Tests (`hrmPayrollInputData.test.ts`)**:
   - Kết quả: **3 / 3 test suites pass 100%**.
4. **Backend Typecheck & Lint (`npm run typecheck` & `npm run lint`)**:
   - Kết quả: **Exit code 0** (0 lỗi).

---

## 5. Nhật ký Vết lưu trữ (Audit Trails)
- Tài liệu BA Specification & Gap Analysis: [`docs/hrm/du_lieu_tinh_luong/BA_ANALYSIS_SPEC.md`](file:///c:/Users/Admin/Desktop/maxv_v2/docs/hrm/du_lieu_tinh_luong/BA_ANALYSIS_SPEC.md)
- Nhật ký công việc HRM Work Log: [`docs/hrm/work-log.md`](file:///c:/Users/Admin/Desktop/maxv_v2/docs/hrm/work-log.md)
- Walkthrough nghiệm thu kỹ thuật: [`docs/hrm/du_lieu_tinh_luong/walkthrough.md`](file:///c:/Users/Admin/Desktop/maxv_v2/docs/hrm/du_lieu_tinh_luong/walkthrough.md)


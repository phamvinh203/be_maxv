# KẾ HOẠCH TRIỂN KHAI KỸ THUẬT (IMPLEMENTATION PLAN) — PHÂN HỆ CÀI ĐẶT LƯƠNG
## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

- **Mã kế hoạch**: PLAN-HR-SALARY-SETTINGS-01
- **Người lập**: Backend Architect & Tech Lead
- **Ngày lập**: 2026-09-06
- **Trạng thái**: ✅ **COMPLETED (ĐÃ THỰC THI & NGHIỆM THU HOÀN TOÀN)**
- **Vị trí tài liệu**: `docs/hr/plan/backend-salary-settings-plan.md`

---

## 1. Mục tiêu và Phạm vi triển khai

Hiện thực hóa toàn bộ nghiệp vụ quản trị lương theo tài liệu SRS (`docs/hr/srs/salary-settings-spec.md`), kiến trúc ADR-006 (`docs/hr/architecture/adr/ADR-006-salary-settings-and-assignment.md`) và Hợp đồng API (`docs/hr/architecture/salary-settings-api-contract.md`):

1. **Danh mục khoản lương (`SalaryItem`)**:
   - Quản lý 7 nhóm khoản lương chuẩn Việt Nam.
   - Tự động sinh mã `KL01`..`KL99`.
   - Kiểm tra chống trùng tên trong cùng nhóm (`E-sal-002`).
   - Chặn xoá khoản lương đang nằm trong cấu trúc lương (`E-sal-003`).

2. **Cấu trúc lương doanh nghiệp (`SalaryStructure` & `SalaryStructureItem`)**:
   - Quản lý cấu trúc lương khung hiện hành.
   - Hỗ trợ thiết lập tính thuế, nhân hệ số làm thêm giờ, tiêu thức tính và số tiền mặc định.
   - Lưu trữ an toàn bằng transaction, kiểm tra tối thiểu 1 khoản mục (`E-sal-004`).

3. **Thiết lập mức lương nhân sự (`EmployeeSalary` & `EmployeeSalaryItem`)**:
   - Quản lý quan hệ 1-1 với `Employee`.
   - Lưu trữ số tiền chi tiết từng khoản lương của nhân viên.
   - Tự động tính tổng thu nhập dự kiến hàng tháng.
   - Quy trình phê duyệt mức lương (`DRAFT` / `PENDING_APPROVAL` -> `APPROVED`), hỗ trợ duyệt hàng loạt.

---

## 2. Lộ trình thực hiện chi tiết (Milestones)

### Giai đoạn 1: Thiết kế & Cơ sở dữ liệu (Database Layer)
- [x] Cập nhật `Backend/prisma/schema.prisma`: Khai báo 5 enums và 5 models mới, quan hệ 2 chiều với `User` và `Employee`.
- [x] Tạo migration: `20260906014946_add_salary_settings`.
- [x] Áp dụng migration lên PostgreSQL container (port 5435).
- [x] Generate Prisma Client vào `Backend/src/generated/prisma`.
- [x] Cập nhật seed script `seed.ts` với 19 khoản lương chuẩn và 1 cấu trúc lương khung.

### Giai đoạn 2: Nền tảng & Tiện ích dùng chung (Common Layer)
- [x] Cập nhật `Backend/src/common/hr-errors.ts`: Thêm mã lỗi `E-sal-001` đến `E-sal-009`.
- [x] Cập nhật hàm `hrNotFound()` cho các thực thể lương.

### Giai đoạn 3: Hiện thực các Submodules Backend (Service & Controller Layer)
- [x] **Submodule Salary Items**: DTOs + Zod schema, Service, Controller, Unit tests.
- [x] **Submodule Salary Structures**: DTOs + Zod schema, Service, Controller, Unit tests.
- [x] **Submodule Employee Salaries**: DTOs + Zod schema, Service, Controller, Unit tests.
- [x] Đăng ký các controller và service vào `HrModule` (`hr.module.ts`).

### Giai đoạn 4: Kiểm thử & Đảm bảo chất lượng (Verification & Testing)
- [x] Chạy Linter Oxlint: 0 lỗi, 0 cảnh báo.
- [x] Chạy Nest build: Biên dịch thành công.
- [x] Viết và chạy Unit tests: 271/271 tests passed.
- [x] Viết và chạy E2E tests: `test/salary-settings.e2e-spec.ts` (17/17 tests passed trên PostgreSQL container thật).

### Giai đoạn 5: Đánh giá chuyên sâu (Audit & Review)
- [x] Code Reviewer Report: `docs/hr/code-reviewer/code-review-report-salary-settings.md`.
- [x] QA / Tester Report: `docs/hr/tester-qa/qa-report-salary-settings.md`.
- [x] DevOps Audit Report: `docs/hr/dev-op/devops-salary-settings-report.md`.
- [x] Technical Documentation & Walkthrough: `docs/hr/api_docs/walkthrough-salary-settings.md`.

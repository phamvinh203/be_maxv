---
type: api-endpoints-index
status: approved
updated: 2026-09-07
links:
  - docs/auth/architecture/auth-api-contract.md
  - docs/hr/architecture/hr-api-contract.md
  - docs/hr/architecture/salary-settings-api-contract.md
  - docs/du_lieu_tinh_luong/architecture/api-contract.md
  - docs/payroll/architecture/api-contract.md
---

# Danh mục API Endpoint toàn hệ thống

> Nguồn sự thật: 28 controller trong `Backend/src` tại commit `1ce5df5` — **131 route handler**.
> File này là bản tổng hợp đọc-nhanh xuyên phân hệ; đặc tả chi tiết (request/response, validation, mã lỗi) nằm ở các `api-contract.md` của từng feature (xem `links`).

## 0. Quy ước chung

- **Không có global prefix** — mọi path bên dưới là path đầy đủ. Server nghe cổng `8000`.
- **Guard toàn cục** (`app.module.ts`), chạy theo thứ tự: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`.
  - Mặc định **mọi endpoint đều yêu cầu đăng nhập**; `@Public()` là ngoại lệ được đánh dấu tường minh trong bảng.
  - Cột **Quyền** ghi đúng nội dung decorator `@Roles(...)`. Viết tắt: `A` = ADMIN, `H` = HR, `ACC` = ACCOUNTANT, `EMP` = EMPLOYEE.
- **🔒 Lock guard** = endpoint còn gắn `PayrollPeriodLockGuard`: từ chối ghi khi kỳ lương đã khóa sổ.
- Khi decorator `@Roles` rộng hơn quyền thực tế (service chặn thêm), điều đó được ghi rõ ở cột Ghi chú.

---

## 1. Hệ thống & Xác thực

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/` | Public | Trang hello mặc định của NestJS |
| GET | `/health` | Public | Health check cho monitoring (status/uptime/timestamp) |
| GET | `/api/docs` | Public | Swagger UI — **chỉ mount khi `env !== production`** |
| POST | `/auth/login` | Public | Đăng nhập, cấp access + refresh token |
| POST | `/auth/logout` | Public (cố ý) | Đăng xuất, thu hồi token — idempotent, xem doc comment `AuthService.logoutByAccessToken` |
| POST | `/auth/refresh` | Public | Làm mới access token từ refresh token |
| POST | `/auth/forgot-password` | Public | Gửi email khôi phục mật khẩu |
| POST | `/auth/reset-password` | Public | Đặt lại mật khẩu bằng token trong email |
| POST | `/auth/change-password` | Đã đăng nhập | Đổi mật khẩu |
| GET | `/auth/me` | Đã đăng nhập | Thông tin tài khoản hiện tại |

## 2. Nhân sự cơ bản (HR)

### 2.1 Nhân viên & Hợp đồng

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| POST | `/employees` | A, H | Tạo hồ sơ nhân viên |
| GET | `/employees` | A, H, ACC | Danh sách NV (lọc, phân trang) |
| GET | `/employees/:id` | A, H, ACC | Chi tiết hồ sơ NV |
| PATCH | `/employees/:id` | A, H | Cập nhật hồ sơ NV |
| DELETE | `/employees/:id` | A, H | Xóa hồ sơ NV |
| POST | `/employees/:employeeId/contracts` | A, H | Tạo hợp đồng lao động |
| GET | `/employees/:employeeId/contracts` | A, H, ACC | Danh sách hợp đồng của 1 NV |
| GET | `/contracts/:id` | A, H, ACC | Chi tiết hợp đồng |
| PATCH | `/contracts/:id` | A, H | Cập nhật hợp đồng |

### 2.2 Phòng ban

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| POST | `/departments` | A, H | Tạo phòng ban |
| GET | `/departments` | A, H, ACC | Danh sách phòng ban |
| GET | `/departments/:id` | A, H, ACC | Chi tiết phòng ban |
| PATCH | `/departments/:id` | A, H | Cập nhật phòng ban |
| DELETE | `/departments/:id` | A, H | Xóa phòng ban |

### 2.3 Người phụ thuộc (giảm trừ gia cảnh)

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| POST | `/dependents` | A, H | Thêm người phụ thuộc |
| GET | `/employees/:employeeId/dependents` | A, H, ACC | Người phụ thuộc của 1 NV |
| GET | `/dependents/:id` | A, H, ACC | Chi tiết người phụ thuộc |
| PATCH | `/dependents/:id` | A, H | Cập nhật người phụ thuộc |
| DELETE | `/dependents/:id` | A, H | Xóa người phụ thuộc |

### 2.4 Tài liệu nhân sự

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| POST | `/employees/:employeeId/documents` | A, H | Tạo metadata tài liệu của NV |
| GET | `/employees/:employeeId/documents` | A, H, ACC | Danh sách tài liệu của 1 NV |
| GET | `/documents/:id` | A, H, ACC | Chi tiết tài liệu |
| PATCH | `/documents/:id` | A, H | Cập nhật metadata tài liệu |
| DELETE | `/documents/:id` | A, H | Xóa tài liệu |
| PUT | `/documents/:id/file` | A, H | Upload file đính kèm (Google Drive) |
| DELETE | `/documents/:id/file` | A, H | Xóa file đính kèm |

### 2.5 Ngày lễ & Ca làm việc

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| POST | `/holidays` | A, H | Tạo ngày lễ |
| POST | `/holidays/quick-generate` | A, H | Sinh nhanh danh sách ngày lễ theo năm |
| GET | `/holidays` | A, H, ACC | Danh sách ngày lễ |
| GET | `/holidays/:id` | A, H, ACC | Chi tiết ngày lễ |
| PATCH | `/holidays/:id` | A, H | Cập nhật ngày lễ |
| DELETE | `/holidays/:id` | A, H | Xóa ngày lễ |
| POST | `/work-shifts` | A, H | Tạo ca làm việc |
| GET | `/work-shifts` | A, H, ACC | Danh sách ca làm |
| GET | `/work-shifts/:id` | A, H, ACC | Chi tiết ca làm |
| PATCH | `/work-shifts/:id` | A, H | Cập nhật ca làm |
| DELETE | `/work-shifts/:id` | A, H | Xóa ca làm |

## 3. Cấu trúc & định mức lương

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/salary-items` | A, H, ACC | Danh mục khoản lương (cờ `isTaxable`/`isSocialInsurance`/`isBaseSalary`/`isMealAllowance`) |
| GET | `/salary-items/count-by-category` | A, H, ACC | Đếm số khoản theo nhóm |
| GET | `/salary-items/:id` | A, H, ACC | Chi tiết khoản lương |
| POST | `/salary-items` | A, H | Tạo khoản lương |
| PATCH | `/salary-items/:id` | A, H | Cập nhật khoản lương |
| DELETE | `/salary-items/:id` | A, H | Xóa khoản lương |
| GET | `/salary-structures/current` | A, H, ACC | Cấu trúc lương hiện hành |
| PUT | `/salary-structures/current` | A, H | Cập nhật cấu trúc lương |
| GET | `/employee-salaries/counts` | A, H, ACC | Thống kê số NV đã có định mức lương |
| GET | `/employee-salaries` | A, H, ACC | Danh sách định mức lương NV |
| POST | `/employee-salaries/approve` | A, H | Phê duyệt định mức lương |
| GET | `/employee-salaries/:employeeId` | A, H, ACC | Định mức lương của 1 NV |
| PUT | `/employee-salaries/:employeeId` | A, H | Thiết lập định mức lương của 1 NV |
| DELETE | `/employee-salaries/:employeeId` | A, H | Xóa định mức lương của 1 NV |

## 4. Dữ liệu đầu vào tính lương — `/payroll-data/*`

> **Không có "bộ chuẩn" áp cho cả 8 phân hệ.** Bộ `GET` + `POST /apply` + `PUT /:employeeId` chỉ đúng cho **6 phân hệ**: overtime, kpi, bonus, piecework, commission, adjustments. **attendance** và **diligence** có bộ route riêng — xem bảng đầy đủ dưới đây.

| Phân hệ | Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|---|
| **Chấm công** | GET | `/payroll-data/attendance/matrix` | A, H, ACC | Ma trận công theo tháng/phòng ban |
| | PUT | `/payroll-data/attendance/cell` | A, H | 🔒 Lock guard · sửa 1 ô (delta store) |
| | POST | `/payroll-data/attendance/batch-override` | A, H | 🔒 Lock guard · chấm công hàng loạt |
| **Tăng ca** | GET | `/payroll-data/overtime` | A, H, ACC | |
| | POST | `/payroll-data/overtime/apply` | A, H | 🔒 Lock guard |
| | PUT | `/payroll-data/overtime/:employeeId` | A, H | 🔒 Lock guard |
| | DELETE | `/payroll-data/overtime/:employeeId` | A, H | 🔒 Lock guard |
| **KPI** | GET | `/payroll-data/kpi` | A, H, ACC | |
| | POST | `/payroll-data/kpi/apply` | A, H | 🔒 Lock guard |
| | PUT | `/payroll-data/kpi/:employeeId` | A, H | 🔒 Lock guard |
| **Thưởng** | GET | `/payroll-data/bonus` | A, H, ACC | |
| | POST | `/payroll-data/bonus/apply` | A, H | 🔒 Lock guard |
| | PUT | `/payroll-data/bonus/:employeeId` | A, H | 🔒 Lock guard |
| **Khoán sản phẩm** | GET | `/payroll-data/piecework` | A, H, ACC | |
| | POST | `/payroll-data/piecework/apply` | A, H | 🔒 Lock guard |
| | PUT | `/payroll-data/piecework/:employeeId` | A, H | 🔒 Lock guard |
| **Hoa hồng** | GET | `/payroll-data/commission` | A, H, ACC | |
| | POST | `/payroll-data/commission/apply` | A, H | 🔒 Lock guard |
| | PUT | `/payroll-data/commission/:employeeId` | A, H | 🔒 Lock guard |
| **Chuyên cần** | GET | `/payroll-data/diligence` | A, H, ACC | |
| | POST | `/payroll-data/diligence/record` | A, H | 🔒 Lock guard · ghi nhận 1 lỗi vi phạm |
| | DELETE | `/payroll-data/diligence/:id` | A, H | 🔒 Lock guard · hủy theo **id bản ghi**, không theo employeeId |
| **Ứng – Bù trừ** | GET | `/payroll-data/adjustments` | A, H, ACC | |
| | POST | `/payroll-data/adjustments/apply` | A, H, **ACC** | 🔒 Lock guard · phân hệ **duy nhất** cho ACC ghi |
| | PUT | `/payroll-data/adjustments/:employeeId` | A, H, **ACC** | 🔒 Lock guard |

**Quy tắc quyền của nhóm này:** `GET` mở cho cả 3 vai trò A/H/ACC. Ghi (`POST`/`PUT`/`DELETE`) chỉ **ADMIN + HR** — ngoại lệ duy nhất là **adjustments**, cho phép cả ACCOUNTANT.

## 5. Import/Export Excel — `/payroll-data/:module/*`

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/payroll-data/:module/template` | A, H, ACC | Tải file Excel mẫu |
| POST | `/payroll-data/:module/import-excel` | A, H, ACC | Import dữ liệu (upload nguyên tử) |
| GET | `/payroll-data/:module/export-excel` | A, H, ACC | Xuất dữ liệu ra Excel |

`:module` thuộc `{attendance, overtime, kpi, bonus, piecework, commission, diligence, adjustments}` (8 nhánh `switch` trong `payroll-excel.service.ts`) — 3 handler phục vụ 24 tổ hợp.

## 6. Kỳ lương — `/payroll-periods` (vòng đời)

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/payroll-periods` | A, H, ACC | Danh sách kỳ lương |
| POST | `/payroll-periods` | A, H | Tạo kỳ lương (DRAFT) |
| GET | `/payroll-periods/:id` | A, H, ACC | Chi tiết kỳ lương |
| PATCH | `/payroll-periods/:id` | A, H | Cập nhật kỳ lương |
| DELETE | `/payroll-periods/:id` | A, H | Xóa kỳ lương |
| POST | `/payroll-periods/:id/submit` | A, H, ACC | Trình kỳ lương chờ duyệt |
| POST | `/payroll-periods/:id/reject` | A, H, ACC | Trả lại kỳ lương |
| POST | `/payroll-periods/:id/lock` | A, ACC | Khóa sổ + snapshot đa tầng (lines + breakdowns) |
| POST | `/payroll-periods/:id/reopen` | A, H, ACC → **chỉ ADMIN** | Decorator mở cho 3 vai trò nhưng service chặn cứng: không phải ADMIN thì ghi audit `PERMISSION_DENIED` + trả `E-pay-008`; lý do dưới 20 ký tự thì `E-pay-009`. Kỳ đã APPROVED/PAID/ARCHIVED không mở lại được. |
| POST | `/payroll-periods/:id/approve` | A | BGĐ phê duyệt |
| POST | `/payroll-periods/:id/mark-paid` | A, ACC | Đánh dấu đã thanh toán |
| POST | `/payroll-periods/:id/archive` | A | Lưu trữ kỳ lương |

## 7. Tính toán & bảng lương — `/payroll`

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/payroll/calculate` | A, H, ACC | Tính toán xem trước bảng lương (không ghi snapshot) |
| GET | `/payroll/sheet-lines` | A, H, ACC | Danh sách dòng bảng lương snapshot 18 cột |
| GET | `/payroll/sheet-lines/:id` | A, H, ACC | Chi tiết 1 dòng + breakdowns cấu phần |
| GET | `/payroll/support-allowances` | A, H, ACC | Ma trận "Bóc tách Lương" (tab lương hỗ trợ) |
| GET | `/payroll/payslips/my` | EMP, A, H, ACC | Phiếu lương cá nhân (xác định chủ sở hữu qua `Employee.userId`) |

## 8. Danh mục payroll — `/payroll-catalogs`

4 danh mục, mỗi danh mục 4 route (`GET` list · `POST` · `PATCH /:id` · `DELETE /:id`):

| Danh mục | Path gốc | Quyền đọc | Quyền ghi |
|---|---|---|---|
| Chỉ tiêu KPI | `/payroll-catalogs/kpi-items` | A, H, ACC | A, H |
| Sản phẩm tính khoán | `/payroll-catalogs/products` | A, H, ACC | A, H |
| Loại chuyên cần | `/payroll-catalogs/diligence-types` | A, H, ACC | A, H |
| Khoản điều chỉnh | `/payroll-catalogs/adjustment-items` | A, H, ACC | A, H, **ACC** |

> `adjustment-items` cho ACCOUNTANT ở **cả POST, PATCH và DELETE** — không chỉ riêng DELETE.

## 9. Cài đặt · Tích hợp · Quản trị

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/settings/general` | A, H, ACC | Xem cài đặt chung (chính sách nội bộ) |
| PUT | `/settings/general` | A | Cập nhật cài đặt |
| POST | `/settings/general/restore-default` | A | Khôi phục mặc định |
| GET | `/integrations/google-drive/authorize` | A, H | Bắt đầu OAuth Google Drive |
| GET | `/integrations/google-drive/callback` | Public | Redirect từ Google (browser top-level, không có header `Authorization`) |
| GET | `/integrations/google-drive/connection` | A, H | Trạng thái kết nối Drive |
| DELETE | `/integrations/google-drive/connection` | A, H | Ngắt kết nối Drive |
| POST | `/admin/users/:id/lock` | A | Khóa tài khoản |
| POST | `/admin/users/:id/unlock` | A | Mở khóa tài khoản |
| GET | `/admin/audit-logs` | A | Tra cứu nhật ký kiểm toán |

---

## Đối chiếu số lượng

| Nhóm | Số handler |
|---|---|
| Hệ thống (`/`, `/health`) | 2 |
| Xác thực (`/auth`) | 7 |
| Nhân viên + Hợp đồng | 9 |
| Phòng ban | 5 |
| Người phụ thuộc | 5 |
| Tài liệu | 7 |
| Ngày lễ | 6 |
| Ca làm việc | 5 |
| Khoản lương + Cấu trúc + Định mức | 14 |
| Dữ liệu đầu vào (8 phân hệ) | 25 |
| Excel (`:module`) | 3 |
| Kỳ lương | 12 |
| Bảng lương (`/payroll`) | 5 |
| Danh mục payroll | 16 |
| Cài đặt · Drive · Admin | 10 |
| **Tổng** | **131** |

> `GET /api/docs` do `SwaggerModule.setup()` mount, không phải route handler nên không tính vào 131.

## Cách kiểm chứng lại khi code đổi

```bash
cd Backend/src && for f in $(find . -name "*.controller.ts" | sort); do echo "=== $f"; grep -nE "@(Controller|Get|Post|Put|Patch|Delete|Roles|Public|UseGuards)\(" "$f"; done
```

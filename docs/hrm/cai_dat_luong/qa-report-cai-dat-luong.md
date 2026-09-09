---
type: qa-report
feature: hrm-cai-dat-luong
status: passed
updated: 2026-09-09
author: QA-Specialist & BA
links:
  - docs/hrm/cai_dat_luong/srs-cai-dat-luong.md
  - docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md
---

# HR — Báo cáo Kiểm thử & Xác thực: Cài đặt lương (QA & Verification Report)

Tài liệu báo cáo kết quả thực thi kiểm thử toàn diện tính năng Cài đặt lương (`cai_dat_luong`) cho `be_maxv`.

---

## 1. Tóm tắt Thực thi (Execution Summary)

| Hạng mục | Kết quả | Ghi chú |
|---|:---:|---|
| **TypeScript Typecheck (`tsc --noEmit`)** | **PASSED** | 0 lỗi biên dịch trên toàn bộ dự án `be_maxv` |
| **Kiểm thử Đơn vị & Nghiệp vụ (Unit Tests)** | **13 / 13 PASSED** | File: `src/__tests__/hrmSalarySettings.test.ts` (~815ms) |
| **Kiểm thử Tích hợp HTTP API (Fastify Route Tests)** | **10 / 10 PASSED** | File: `src/__tests__/hrmSalarySettingsApi.test.ts` (~254ms) |
| **Tổng số ca kiểm thử** | **23 / 23 PASSED (100%)** | Thời gian chạy tổng: ~1.07 giây |

---

## 2. Chi tiết Kết quả Kiểm thử Nghiệp vụ (13 Ca)

| STT | Tên Test Case | Mục tiêu kiểm thử & Ràng buộc | Kết quả |
|:---:|---|---|:---:|
| 1 | `TC-SAL-001` | Tự động sinh mã khoản lương `KL01`..`KL99` khi không truyền `code` | **PASS** |
| 2 | `TC-SAL-002` | Chặn trùng tên khoản lương (`E-sal-002`) | **PASS** |
| 3 | `TC-SAL-003` | Thống kê số lượng khoản lương theo 7 nhóm chuẩn (`count-by-category`) | **PASS** |
| 4 | `TC-SAL-004` | Chặn xóa khoản lương khi đã được sử dụng trong Cấu trúc khung (`E-sal-003`) | **PASS** |
| 5 | `TC-SAL-005` | Xóa thành công khoản lương không bị ràng buộc sử dụng | **PASS** |
| 6 | `TC-SAL-006` | Tạo cấu trúc lương khung kèm danh sách các khoản và tiêu thức tính | **PASS** |
| 7 | `TC-SAL-007` | Lấy cấu trúc lương khung đang hoạt động (`isActive = true`) | **PASS** |
| 8 | `TC-SAL-008` | Chặn set lương cho nhân viên không có hợp đồng lao động hiệu lực (`E-sal-009`) | **PASS** |
| 9 | `TC-SAL-009` | Chặn set lương khi khoản thiết lập không nằm trong Cấu trúc khung active (`E-sal-010`) | **PASS** |
| 10 | `TC-SAL-010` | Chặn set lương khi tổng số tiền <= 0 (`E-sal-008`) | **PASS** |
| 11 | `TC-SAL-011` | Set lương thành công: sinh phiên bản 1, trạng thái `PENDING_APPROVAL`, tính đúng tổng tiền | **PASS** |
| 12 | `TC-SAL-012` | Cập nhật lương đã duyệt: tăng `setupVersion = 2`, tự động chuyển về `PENDING_APPROVAL` | **PASS** |
| 13 | `TC-SAL-013` | Phê duyệt lương hàng loạt (`bulkApprove`) cập nhật đúng số lượng bản ghi | **PASS** |

---

## 3. Chi tiết Kết quả Kiểm thử Fastify HTTP API (10 Ca)

| STT | Tuyến đường (Route) & Method | Kịch bản kiểm thử | Mã phản hồi | Kết quả |
|:---:|---|---|:---:|:---:|
| 1 | `GET /api/v1/hrm/salary-items` | Lấy danh sách khoản lương thành công | 200 OK | **PASS** |
| 2 | `GET /api/v1/hrm/salary-items/count-by-category` | Đếm số lượng khoản theo 7 nhóm | 200 OK | **PASS** |
| 3 | `POST /api/v1/hrm/salary-items` | Tạo mới khoản lương thành công | 201 Created | **PASS** |
| 4 | `POST /api/v1/hrm/salary-items` | Bắt lỗi validation khi thiếu trường bắt buộc | 400 Bad Request | **PASS** |
| 5 | `GET /api/v1/hrm/salary-structures` | Lấy danh sách cấu trúc khung | 200 OK | **PASS** |
| 6 | `GET /api/v1/hrm/salary-structures/active` | Lấy cấu trúc khung active | 200 OK | **PASS** |
| 7 | `GET /api/v1/hrm/employee-salaries` | Lấy danh sách nhân viên kèm trạng thái lương | 200 OK | **PASS** |
| 8 | `GET /api/v1/hrm/employee-salaries/:employeeId` | Lấy chi tiết lương của 1 nhân viên | 200 OK | **PASS** |
| 9 | `POST /api/v1/hrm/employee-salaries/:employeeId` | Set lương hỗ trợ payload kiểu map `khoan: { ... }` | 200 OK | **PASS** |
| 10 | `POST /api/v1/hrm/employee-salaries/approve` | Duyệt hàng loạt nhân viên | 200 OK | **PASS** |

---

## 4. Kết luận Đảm bảo Chất lượng (QA Sign-off)

- **Độ tin cậy**: Toàn bộ luồng nghiệp vụ từ Danh mục khoản lương, Cấu trúc lương khung, đến Set lương nhân sự và Phê duyệt hoạt động chính xác theo đúng yêu cầu BA và tài liệu mock `hdđt_maxv`.
- **An toàn mã nguồn**: Không có xung đột, không phá vỡ các chức năng hiện có của phân hệ HRM. Sẵn sàng tích hợp liền mạch với giao diện `hdđt_maxv`.

# Bộ Ca Kiểm Thử Chi Tiết (Detailed Test Cases) — Dữ liệu Tính Lương (du_lieu_tinh_luong)

> **Mã phân hệ**: `HRM-PAYROLL-DATA`  
> **Phiên bản**: 1.0.0  
> **Ngày lập**: 2026-09-06  
> **Vai trò**: QA Test Design Lead  
> **Giai đoạn**: Shift-Left QA (Phase A: Spec Review & Test Design) — Gate 2.5 Sign-off  
> **Tài liệu tham chiếu**:  
> - Ma trận Truy vết: [`docs/du_lieu_tinh_luong/qa/test-matrix.md`](./test-matrix.md)  
> - SRS Đặc tả Nghiệp vụ: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-spec.md`](../srs/du_lieu_tinh_luong-spec.md)  
> - Vòng đời Trạng thái: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-states.md`](../srs/du_lieu_tinh_luong-states.md)  
> - Sơ đồ Thực thể ERD: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-erd.md`](../srs/du_lieu_tinh_luong-erd.md)  

---

## Danh mục Phân nhóm Ca Kiểm thử (Test Suite Structure)

- **Nhóm 1: Quản lý Vòng đời Kỳ lương & Bất biến Snapshot** (`TC-DLTL-001` ➔ `TC-DLTL-010`)
- **Nhóm 2: Phân hệ 1 — Chấm công (`cham_cong`)** (`TC-DLTL-011` ➔ `TC-DLTL-018`)
- **Nhóm 3: Phân hệ 2 — Tăng ca (`tang_ca`)** (`TC-DLTL-019` ➔ `TC-DLTL-025`)
- **Nhóm 4: Phân hệ 3 — Đánh giá KPI (`kpi`)** (`TC-DLTL-026` ➔ `TC-DLTL-032`)
- **Nhóm 5: Phân hệ 4 — Thưởng (`thuong`)** (`TC-DLTL-033` ➔ `TC-DLTL-037`)
- **Nhóm 6: Phân hệ 5 — Lương sản phẩm (`luong_san_pham`)** (`TC-DLTL-038` ➔ `TC-DLTL-044`)
- **Nhóm 7: Phân hệ 6 — Lương phần trăm (`luong_phan_tram`)** (`TC-DLTL-045` ➔ `TC-DLTL-049`)
- **Nhóm 8: Phân hệ 7 — Lương chuyên cần (`chuyen_can`)** (`TC-DLTL-050` ➔ `TC-DLTL-057`)
- **Nhóm 9: Phân hệ 8 — Các khoản ứng - bù trừ (`bu_tru`)** (`TC-DLTL-058` ➔ `TC-DLTL-063`)
- **Nhóm 10: Quy tắc Chung, Quản lý Nhân sự & Phạm vi** (`TC-DLTL-064` ➔ `TC-DLTL-068`)
- **Nhóm 11: Nhập / Xuất Excel (Excel IO)** (`TC-DLTL-069` ➔ `TC-DLTL-072`)
- **Nhóm 12: Bảo mật, Phân quyền & Cách ly Dữ liệu (Security & RBAC)** (`TC-DLTL-073` ➔ `TC-DLTL-075`)
- **Nhóm 13: Concurrency & Toàn vẹn Giao dịch Cơ sở Dữ liệu** (`TC-DLTL-076` ➔ `TC-DLTL-077`)

---

## Nhóm 1: Quản lý Vòng đời Kỳ lương & Bất biến Snapshot

### TC-DLTL-001: Khởi tạo kỳ lương mới thành công & tự sinh lịch chấm công mặc định (Happy Path)
- **Module / Feature**: Kỳ lương (`payroll_periods`)
- **Mức độ ưu tiên**: **P0 (Blocker)**
- **Loại kiểm thử**: API / Functional
- **Quy tắc ánh xạ**: `BR-dltl-001`, `BR-dltl-004`
- **Mục tiêu**: Đảm bảo khi tạo mới kỳ lương thành công ở trạng thái `DRAFT`, hệ thống tự động sinh lịch chấm công chuẩn dựa trên `GeneralSetting` và `Holiday`.
- **Điều kiện tiên quyết (Preconditions)**:
  - Tài khoản đăng nhập vai trò `ADMIN` hoặc `HR`.
  - Chưa tồn tại kỳ lương mã `2026-08`.
  - `GeneralSetting`: `standardHoursPerDay = 8`, `saturdayPolicy = HALF_DAY`, `sundayPolicy = OFF`.
  - `Holiday`: Ngày `2026-08-19` là ngày nghỉ lễ hưởng lương công ty.
- **Dữ liệu thử nghiệm (Test Data)**:
  - Payload: `{ "code": "2026-08", "name": "Bảng lương tháng 08/2026", "month": 8, "year": 2026, "startDate": "2026-08-01", "endDate": "2026-08-31" }`
- **Các bước thực hiện (Steps to Reproduce)**:
  1. Gửi HTTP POST tới `/api/v1/payroll-periods` với payload trên.
  2. Kiểm tra mã phản hồi HTTP và dữ liệu bản ghi kỳ lương trả về.
  3. Truy vấn bảng `attendance_records` và bảng xem trước lịch làm việc của tháng 08/2026.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Khởi tạo kỳ lương mới thành công
    Given Người dùng có vai trò "HR" và kỳ lương "2026-08" chưa tồn tại
    When Gửi yêu cầu POST "/api/v1/payroll-periods" với tháng 8 năm 2026
    Then Phản hồi trả về mã 201 Created
    And Trạng thái kỳ lương là "DRAFT"
    And Hệ thống nhận diện đúng 31 ngày trong tháng
    And Ngày Chủ nhật được đánh dấu OFF, sáng Thứ 7 là 0.5 công, ngày 19/08 là nghỉ lễ có lương
  ```
- **Kết quả kỳ vọng (Expected Results)**:
  - HTTP Status: `201 Created`.
  - Body: `{ "data": { "id": "<UUID>", "code": "2026-08", "status": "DRAFT", "month": 8, "year": 2026 } }`.
  - Bảng lương chuyển sang trạng thái sẵn sàng cho 8 phân hệ nhập liệu.

---

### TC-DLTL-002: Khóa sổ kỳ lương (`PENDING_REVIEW` ➔ `LOCKED`) và chốt snapshot bất biến
- **Module / Feature**: Kỳ lương (`payroll_periods`) / Snapshot tính lương
- **Mức độ ưu tiên**: **P0 (Blocker)**
- **Loại kiểm thử**: Integration / State Machine
- **Quy tắc ánh xạ**: `BR-dltl-001`, State Invariant #2
- **Mục tiêu**: Kiểm tra quá trình khóa sổ kỳ lương: Đóng băng toàn bộ dữ liệu 8 phân hệ, tính toán tổng hợp lương và ghi snapshot vào `payroll_sheet_lines`.
- **Điều kiện tiên quyết**:
  - Kỳ lương `2026-08` đang ở trạng thái `PENDING_REVIEW`.
  - Đã có dữ liệu chấm công, tăng ca, thưởng cho 5 nhân viên.
  - Tài khoản đăng nhập vai trò `ACCOUNTANT` hoặc `ADMIN`.
- **Dữ liệu thử nghiệm**:
  - Request: `POST /api/v1/payroll-periods/:id/lock`
- **Các bước thực hiện**:
  1. Gửi request khóa sổ kỳ lương `2026-08`.
  2. Kiểm tra trạng thái kỳ trong DB và các trường `locked_at`, `locked_by_user_id`.
  3. Kiểm tra số lượng bản ghi trong `payroll_sheet_lines` bằng chính xác số lượng nhân viên ACTIVE (5 bản ghi).
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Khóa sổ kỳ lương và tạo snapshot
    Given Kỳ lương "2026-08" đang ở trạng thái "PENDING_REVIEW"
    When Kế toán gửi POST "/api/v1/payroll-periods/:id/lock"
    Then Mã trạng thái trả về 200 OK
    And Kỳ lương chuyển sang trạng thái "LOCKED"
    And Trường "locked_at" có giá trị timestamp hiện tại, "locked_by_user_id" ghi nhận ID kế toán
    And Bảng "payroll_sheet_lines" có 5 bản ghi snapshot tính lương tương ứng 5 nhân viên
  ```
- **Kết quả kỳ vọng**:
  - HTTP Status: `200 OK`.
  - Database: `payroll_periods.status = "LOCKED"`. Bản ghi `payroll_sheet_lines` được lưu đầy đủ 18 cột snapshot tài chính.

---

### TC-DLTL-003: Chặn sửa/xóa dữ liệu 8 phân hệ khi kỳ lương đã `LOCKED` (Negative)
- **Module / Feature**: Toàn bộ 8 phân hệ con / Write Protection Invariant
- **Mức độ ưu tiên**: **P0 (Security & Financial Integrity)**
- **Loại kiểm thử**: API / Security / Negative
- **Quy tắc ánh xạ**: `BR-dltl-001`, `E-dltl-001`
- **Mục tiêu**: Đảm bảo khi kỳ lương ở trạng thái `LOCKED`, mọi API ghi (POST, PUT, DELETE) vào 8 phân hệ đều bị chặn triệt để tại Service Layer.
- **Điều kiện tiên quyết**:
  - Kỳ lương `2026-08` đang ở trạng thái `LOCKED`.
  - Tài khoản đăng nhập vai trò `HR` hoặc `ACCOUNTANT`.
- **Dữ liệu thử nghiệm**:
  - Thử POST cập nhật tăng ca: `/api/v1/du-lieu-tinh-luong/tang-ca`
  - Body: `{ "periodId": "<LOCKED_PERIOD_ID>", "employeeId": "<EMP_01>", "otType": "ngay_thuong_ngay", "hours": 4 }`
- **Các bước thực hiện**:
  1. Gửi lần lượt các request tạo/sửa/xóa đến cả 8 phân hệ: Chấm công, Tăng ca, KPI, Thưởng, Lương SP, Lương %, Chuyên cần, Bù trừ.
  2. Quan sát HTTP status code và mã lỗi trả về.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn sửa dữ liệu khi kỳ lương đã LOCKED
    Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED"
    When Người dùng gửi thao tác thêm dòng tăng ca vào kỳ này
    Then Hệ thống từ chối yêu cầu với HTTP 400 Bad Request
    And Trả về mã lỗi "E-dltl-001"
    And Thông điệp "Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu."
    And Cơ sở dữ liệu không bị thay đổi
  ```
- **Kết quả kỳ vọng**:
  - HTTP Status: `400 Bad Request`.
  - Error Response: `{ "statusCode": 400, "errorCode": "E-dltl-001", "message": "Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu." }`.

---

### TC-DLTL-004: Chặn sửa/xóa dữ liệu khi kỳ lương ở trạng thái `APPROVED` hoặc `PAID` (Negative)
- **Module / Feature**: Toàn bộ 8 phân hệ con / State Protection
- **Mức độ ưu tiên**: **P0 (Financial Integrity)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-001`, `E-dltl-001`
- **Mục tiêu**: Kỳ lương đã được Ban Giám Đốc duyệt (`APPROVED`) hoặc Kế toán chi trả (`PAID`) phải bất biến tuyệt đối.
- **Điều kiện tiên quyết**: Kỳ lương đang ở trạng thái `APPROVED` hoặc `PAID`.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn cập nhật kỳ lương đã APPROVED hoặc PAID
    Given Kỳ lương đang ở trạng thái "APPROVED" hoặc "PAID"
    When Người dùng cố tình gửi request xóa dòng thưởng hoặc sửa chấm công
    Then Hệ thống lập tức trả về mã lỗi "E-dltl-001" với HTTP 400
  ```
- **Kết quả kỳ vọng**: HTTP 400, `E-dltl-001`. Không có bản ghi nào bị sửa đổi.

---

### TC-DLTL-005: Mở lại kỳ lương (`LOCKED` ➔ `DRAFT`) bởi ADMIN kèm lý do giải trình $\ge 20$ ký tự & ghi Audit Log
- **Module / Feature**: Kỳ lương (`payroll_periods`) / Reopen Workflow
- **Mức độ ưu tiên**: **P1 (High)**
- **Loại kiểm thử**: Security / Integration / Audit
- **Quy tắc ánh xạ**: State Invariant #3
- **Mục tiêu**: Kiểm tra tính năng Reopen kỳ lương: Chỉ ADMIN có quyền, bắt buộc lý do $\ge 20$ ký tự, đưa kỳ về `DRAFT` và ghi nhật ký Audit Log bảo mật.
- **Điều kiện tiên quyết**: Kỳ lương `2026-08` đang ở `LOCKED`. Tài khoản đăng nhập vai trò `ADMIN`.
- **Dữ liệu thử nghiệm**:
  - Request: `POST /api/v1/payroll-periods/:id/reopen`
  - Body: `{ "reason": "Phát hiện sai sót 3 trường hợp tăng ca tổ nguội theo biên bản đối soát số 12" }` (74 ký tự $\ge 20$)
- **Các bước thực hiện**:
  1. Gửi request Reopen với lý do trên.
  2. Kiểm tra trạng thái kỳ trong DB chuyển về `DRAFT`.
  3. Truy vấn bảng `audit_logs` kiểm tra sự kiện `PAYROLL_PERIOD_REOPENED`.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: ADMIN mở lại kỳ lương đã khóa sổ thành công
    Given Kỳ lương đang ở trạng thái "LOCKED" và người thực hiện là "ADMIN"
    When ADMIN gửi yêu cầu mở lại kỳ lương kèm lý do trên 20 ký tự
    Then Phản hồi trả về HTTP 200 OK
    And Trạng thái kỳ chuyển về "DRAFT"
    And Hệ thống ghi 1 bản ghi vào audit_logs với loại sự kiện "PAYROLL_PERIOD_REOPENED"
    And Lưu trữ đầy đủ ID người mở, thời gian và nội dung lý do giải trình
  ```
- **Kết quả kỳ vọng**:
  - HTTP Status: `200 OK`.
  - Database: `payroll_periods.status = "DRAFT"`.
  - Audit Log: Bản ghi mới chứa `{ "event": "PAYROLL_PERIOD_REOPENED", "userId": "<ADMIN_ID>", "reason": "..." }`.

---

### TC-DLTL-006: Chặn vai trò HR hoặc ACCOUNTANT thực hiện Reopen kỳ lương (Security / RBAC)
- **Module / Feature**: Phân quyền Reopen Kỳ lương
- **Mức độ ưu tiên**: **P0 (Security)**
- **Loại kiểm thử**: Security / RBAC
- **Quy tắc ánh xạ**: RBAC Matrix (Mục 4 Test Matrix)
- **Mục tiêu**: Đảm bảo các tài khoản không phải `ADMIN` (HR, Kế toán) không thể tự ý Reopen kỳ lương đã khóa.
- **Điều kiện tiên quyết**: Kỳ lương ở trạng thái `LOCKED`. Tài khoản đăng nhập là `HR` hoặc `ACCOUNTANT`.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn HR/Kế toán tự ý Reopen kỳ lương
    Given Kỳ lương đang ở trạng thái "LOCKED"
    When Tài khoản có vai trò "HR" hoặc "ACCOUNTANT" gửi POST "/api/v1/payroll-periods/:id/reopen"
    Then Hệ thống từ chối với HTTP 403 Forbidden
    And Ghi nhận sự kiện "PERMISSION_DENIED" vào audit log
  ```
- **Kết quả kỳ vọng**: HTTP Status: `403 Forbidden`. Kỳ lương vẫn giữ nguyên `LOCKED`.

---

### TC-DLTL-007: Chặn Reopen kỳ lương khi lý do giải trình $< 20$ ký tự hoặc để trống (Negative)
- **Module / Feature**: Validation Reopen Kỳ lương
- **Mức độ ưu tiên**: **P1 (Validation)**
- **Loại kiểm thử**: API / Validation
- **Quy tắc ánh xạ**: State Invariant #3
- **Mục tiêu**: Bắt buộc giải trình nghiêm túc khi mở khóa kỳ lương.
- **Dữ liệu thử nghiệm**: Body: `{ "reason": "Sửa lại lương" }` (14 ký tự $< 20$)
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn Reopen khi lý do giải trình quá ngắn
    Given Tài khoản ADMIN thực hiện mở lại kỳ lương
    When Gửi lý do "Sửa lại lương" dưới 20 ký tự
    Then Hệ thống trả về HTTP 400 Bad Request kèm thông điệp yêu cầu lý do tối thiểu 20 ký tự
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, validation error `reason must be at least 20 characters`.

---

### TC-DLTL-008: Chặn Reopen kỳ lương khi kỳ đã được chi trả `PAID` hoặc lưu trữ `ARCHIVED` (Invariant)
- **Module / Feature**: Kỳ lương (`payroll_periods`) / Hard State Lock
- **Mức độ ưu tiên**: **P0 (Financial Integrity)**
- **Loại kiểm thử**: API / Invariant
- **Quy tắc ánh xạ**: State Machine Diagram (du_lieu_tinh_luong-states.md)
- **Mục tiêu**: Kỳ lương đã chuyển khoản chi trả (`PAID`) hoặc lưu trữ kế toán (`ARCHIVED`) là vĩnh viễn, không ai (kể cả ADMIN) được phép Reopen.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn Reopen kỳ lương đã PAID
    Given Kỳ lương đang ở trạng thái "PAID"
    When ADMIN gửi yêu cầu POST "/api/v1/payroll-periods/:id/reopen"
    Then Hệ thống từ chối với HTTP 400 Bad Request
    And Thông điệp "Kỳ lương đã chi trả hoặc lưu trữ, không thể mở lại."
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request. Không thể đảo ngược trạng thái.

---

### TC-DLTL-009: Thao tác nhập liệu với `period_id` không tồn tại trong hệ thống (Negative)
- **Module / Feature**: API Validation chung
- **Mức độ ưu tiên**: **P0 (Reliability)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `E-dltl-025`
- **Mục tiêu**: Trả về đúng mã lỗi `E-dltl-025` (404 Not Found) khi truyền UUID kỳ lương ảo.
- **Dữ liệu thử nghiệm**: `periodId = "00000000-0000-0000-0000-000000000000"`
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Truy vấn hoặc thêm dữ liệu vào kỳ lương không tồn tại
    Given Người dùng gửi yêu cầu nhập liệu với periodId không có trong DB
    When API xử lý yêu cầu
    Then Trả về mã HTTP 404 Not Found
    And Mã lỗi "E-dltl-025"
    And Thông điệp "Kỳ lương không tồn tại trong hệ thống."
  ```
- **Kết quả kỳ vọng**: HTTP 404 Not Found, `errorCode: "E-dltl-025"`.

---

### TC-DLTL-010: Xử lý xung đột phiên bản khi 2 người dùng cùng khóa sổ đồng thời (Concurrency)
- **Module / Feature**: Concurrency Lock / Optimistic Concurrency
- **Mức độ ưu tiên**: **P1 (Concurrency)**
- **Loại kiểm thử**: Concurrency / API
- **Quy tắc ánh xạ**: `E-dltl-026`, `EC-05`
- **Mục tiêu**: Khi 2 Kế toán cùng bấm Khóa sổ cho cùng 1 kỳ lương ở cùng mili-giây, hệ thống khóa bằng Pessimistic lock / Version guard để một request thành công và request thứ 2 trả về `E-dltl-026`.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tranh chấp khóa sổ đồng thời
    Given Kỳ lương đang ở "PENDING_REVIEW"
    When Hai tiến trình đồng thời gửi request lock kỳ lương
    Then Một tiến trình thực hiện thành công chuyển kỳ sang LOCKED
    And Tiến trình còn lại nhận mã lỗi "E-dltl-026" với HTTP 409 Conflict
    And Thông điệp "Đang có thao tác khóa sổ kỳ lương đồng thời, vui lòng thử lại."
  ```
- **Kết quả kỳ vọng**: Request 1: HTTP 200 OK. Request 2: HTTP 409 Conflict, `errorCode: "E-dltl-026"`.

---

## Nhóm 2: Phân hệ 1 — Chấm công (`cham_cong`)

### TC-DLTL-011: Tự động sinh lịch chấm công tháng kế thừa Thứ 7, CN và Ngày lễ (Happy Path)
- **Module / Feature**: Chấm công (`cham_cong`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / Integration
- **Quy tắc ánh xạ**: `BR-dltl-004`, `US-dltl-01`, `AC-dltl-01-A`
- **Mục tiêu**: Kiểm tra ma trận chấm công tháng hiển thị đúng 8 loại công chuẩn và phân biệt ngày nghỉ lễ, ngày làm việc, nửa ngày thứ 7.
- **Dữ liệu thử nghiệm**: Tháng 08/2026 (31 ngày). Cấu hình: Thứ 7 nửa ngày (0.5 công), CN nghỉ (0 công), ngày 19/08 nghỉ lễ hưởng lương (1.0 công `nghi_le`).
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tự sinh lịch chuẩn tháng 08/2026
    Given Cấu hình hệ thống với thứ 7 làm nửa buổi, chủ nhật nghỉ, ngày 19/08 là ngày lễ
    When C&B mở bảng chấm công tháng 08/2026 của nhân viên "NV0001"
    Then Ngày 19/08 hiển thị mã "nghi_le" và giá trị công là 1.0
    And Các ngày Chủ nhật (02, 09, 16, 23, 30) hiển thị trạng thái OFF
    And Các ngày Thứ 7 (01, 08, 15, 22, 29) hiển thị giá trị công 0.5
    And Ngày thường từ thứ 2 đến thứ 6 hiển thị công 1.0 "lam_viec"
  ```
- **Kết quả kỳ vọng**: Sinh đầy đủ 31 ngày, khớp chính xác từng loại công và ngày công chuẩn.

---

### TC-DLTL-012: Ghi đè số giờ công lẻ hợp lệ và tính công quy đổi `round(soGio / standardHours, 2)`
- **Module / Feature**: Chấm công (`cham_cong`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / Functional
- **Quy tắc ánh xạ**: `BR-dltl-005`, `US-dltl-01`, `AC-dltl-01-B`
- **Mục tiêu**: Người dùng chỉnh sửa số giờ công lẻ (ví dụ làm 6h, 5h), hệ thống tính toán công quy đổi chính xác làm tròn 2 chữ số thập phân (`ROUND_HALF_UP`).
- **Dữ liệu thử nghiệm**:
  - Ca 1: `soGio = 6`, `standardHoursPerDay = 8` ➔ Công quy đổi = $6 / 8 = 0.75$ công.
  - Ca 2: `soGio = 5`, `standardHoursPerDay = 8` ➔ Công quy đổi = $5 / 8 = 0.625 \approx 0.63$ công.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Ghi đè số giờ công lẻ cho nhân viên
    Given Nhân viên "NV0001" có giờ công chuẩn là 8 giờ/ngày
    When Người dùng cập nhật ngày 10/08 với loại "lam_viec" và soGio = 6
    Then Hệ thống lưu bản ghi với actual_hours = 6.0 và work_day_value = 0.75
    And Tổng ngày công thực tế của nhân viên tăng thêm 0.75 công
  ```
- **Kết quả kỳ vọng**: `work_day_value` lưu đúng 0.75 (với 6h) và 0.63 (với 5h).

---

### TC-DLTL-013: Chặn nhập số giờ công làm việc âm (`soGio < 0`) (Boundary / Negative)
- **Module / Feature**: Chấm công (`cham_cong`)
- **Mức độ ưu tiên**: **P0 (Data Integrity)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-005`, `E-dltl-005`, `AC-dltl-01-C`
- **Mục tiêu**: Chặn người dùng nhập số giờ công âm.
- **Dữ liệu thử nghiệm**: Request body: `{ "workDate": "2026-08-10", "actualHours": -1.5 }`
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn nhập số giờ công âm
    Given Người dùng chỉnh sửa ô công ngày 10/08
    When Nhập số giờ actualHours là -1.5
    Then Hệ thống báo lỗi với mã "E-dltl-005" và HTTP 400 Bad Request
    And Thông điệp "Số giờ công không được âm hoặc vượt quá số giờ chuẩn trong ngày."
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-005"`.

---

### TC-DLTL-014: Chặn nhập số giờ công vượt quá số giờ chuẩn trong ngày (`soGio > 8h`) (Boundary)
- **Module / Feature**: Chấm công (`cham_cong`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-005`, `E-dltl-005`, `AC-dltl-01-C`
- **Mục tiêu**: Chặn nhập số giờ làm việc bình thường vượt quá `standardHoursPerDay` (8h). Giờ làm thêm ngoài 8h phải nhập sang phân hệ Tăng ca.
- **Dữ liệu thử nghiệm**: Request body: `{ "workDate": "2026-08-10", "actualHours": 9.0 }` (khi standard = 8h)
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn nhập số giờ công vượt trần ngày
    Given Số giờ chuẩn trong ngày là 8h
    When Người dùng nhập actualHours là 9.0 vào ô chấm công bình thường
    Then Hệ thống từ chối với mã lỗi "E-dltl-005"
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-005"`.

---

### TC-DLTL-015: Kiểm thử cơ chế Delta Store (Tiết kiệm 90% dung lượng CSDL)
- **Module / Feature**: Chấm công (`cham_cong`) / Data Storage Optimization
- **Mức độ ưu tiên**: **P1 (Architecture)**
- **Loại kiểm thử**: Integration / Database
- **Quy tắc ánh xạ**: SRS Mục 3.1 & ERD Section 2.2
- **Mục tiêu**: Đảm bảo bảng `attendance_records` chỉ tạo bản ghi khi người dùng chỉnh sửa khác lịch chuẩn.
- **Dữ liệu thử nghiệm**: Tháng 08/2026 có 31 ngày. Nhân viên chỉ xin nghỉ phép ngày 12/08 và làm nửa ngày 15/08.
- **Các bước thực hiện**:
  1. Mở chấm công tháng 08/2026 cho nhân viên `NV0001`.
  2. Chỉ ghi nhận chỉnh sửa ngày 12/08 (`nghi_phep`) và ngày 15/08 (`nua_ngay`).
  3. Kiểm tra số dòng bản ghi trong bảng `attendance_records` của nhân viên này.
- **Kết quả kỳ vọng**: Bảng `attendance_records` chỉ chứa đúng **2 dòng** (thay vì 31 dòng). Khi truy vấn API, các ngày còn lại tự động tái tạo từ lịch chuẩn.

---

### TC-DLTL-016: Edge Case nhân viên vào làm việc giữa tháng (EC-01)
- **Module / Feature**: Chấm công (`cham_cong`) / Tính tỷ lệ công
- **Mức độ ưu tiên**: **P1 (Edge Case)**
- **Loại kiểm thử**: Unit / Integration
- **Quy tắc ánh xạ**: `EC-01`, `BR-dltl-002`
- **Mục tiêu**: Nhân viên ký hợp đồng bắt đầu làm từ ngày 15 của tháng 31 ngày (tháng 8/2026).
- **Dữ liệu thử nghiệm**:
  - Hợp đồng hiệu lực: từ `2026-08-15` đến `2027-08-14`.
  - Ngày công chuẩn của tháng: 26 ngày.
  - Số ngày làm việc thực tế từ 15/08 đến 31/08: 14 ngày.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Nhân viên vào làm giữa tháng
    Given Nhân viên có hợp đồng bắt đầu từ ngày 15/08/2026
    When Hệ thống tính công tháng 08/2026
    Then Các ngày từ 01/08 đến 14/08 được đánh dấu là chưa vào làm (0 công)
    And Số ngày công thực tế tính được là 14 ngày
    And Tỷ lệ công quy đổi tyLeCong = 14 / 26 = 0.5385 (53.85%)
  ```
- **Kết quả kỳ vọng**: Lương cơ bản tính theo công = $\text{luong\_co\_ban} \times (14 / 26)$, làm tròn VND chuẩn.

---

### TC-DLTL-017: Edge Case nhân viên nghỉ không lương trọn tháng (`ngayCongThucTe = 0`) (EC-02)
- **Module / Feature**: Chấm công (`cham_cong`) / Toán học
- **Mức độ ưu tiên**: **P1 (Edge Case)**
- **Loại kiểm thử**: Unit / Financial
- **Quy tắc ánh xạ**: `EC-02`
- **Mục tiêu**: Nhân viên nghỉ không lương cả tháng, `ngayCongThucTe = 0`. Kiểm tra không bị lỗi `NaN` hoặc chia cho 0.
- **Dữ liệu thử nghiệm**: `ngayCongThucTe = 0`, `ngayCongChuan = 26`, Lương cơ bản = 10.000.000 ₫, Phụ cấp cố định tháng = 1.000.000 ₫.
- **Kết quả kỳ vọng**:
  - Lương theo công = 0 ₫.
  - Phụ cấp cố định tháng = 1.000.000 ₫.
  - Chuyên cần = 0 ₫ (do vắng quá quy định).
  - Thuế TNCN = 0 ₫.
  - Hệ thống tính toán trơn tru không phát sinh lỗi exception.

---

### TC-DLTL-018: Edge Case ngày công chuẩn $\le 0$ do cấu hình lỗi (EC-08)
- **Module / Feature**: Chấm công (`cham_cong`) / Guard an toàn
- **Mức độ ưu tiên**: **P2 (Defensive)**
- **Loại kiểm thử**: Unit / Boundary
- **Quy tắc ánh xạ**: `EC-08`
- **Mục tiêu**: Đảm bảo guard `standardWorkDays > 0` hoạt động. Nếu ngày công chuẩn $\le 0$, đơn giá ngày trả về 0 thay vì `Infinity`.
- **Kết quả kỳ vọng**: `donGiaNgay = 0`, không crash tiến trình tính lương.

---

## Nhóm 3: Phân hệ 2 — Tăng ca (`tang_ca`)

### TC-DLTL-019: Nhập tăng ca với 6 hệ số pháp lý chuẩn và tính giờ quy đổi (Happy Path)
- **Module / Feature**: Tăng ca (`tang_ca`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / API
- **Quy tắc ánh xạ**: `US-dltl-02`, `AC-dltl-02-A`
- **Mục tiêu**: Kiểm tra tính toán giờ quy đổi với công thức $\text{gio\_quy\_doi} = \text{round}(\text{so\_gio} \times \text{he\_so} / 100, 1)$ cho cả 6 loại tăng ca.
- **Dữ liệu thử nghiệm**:
  1. `ngay_thuong_ngay` (150%): 10.0h ➔ $10 \times 1.5 = 15.0$h quy đổi.
  2. `ngay_thuong_dem` (200%): 4.0h ➔ $4 \times 2.0 = 8.0$h quy đổi.
  3. `chu_nhat_ngay` (200%): 5.0h ➔ $5 \times 2.0 = 10.0$h quy đổi.
  4. `chu_nhat_dem` (270%): 3.0h ➔ $3 \times 2.7 = 8.1$h quy đổi.
  5. `ngay_le_ngay` (300%): 8.0h ➔ $8 \times 3.0 = 24.0$h quy đổi.
  6. `ngay_le_dem` (390%): 2.5h ➔ $2.5 \times 3.9 = 9.75 \approx 9.8$h quy đổi.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tính giờ tăng ca quy đổi cho 6 loại chuẩn
    Given Nhân viên có phát sinh các buổi làm thêm giờ
    When C&B nhập 6 dòng tăng ca với các hệ số tương ứng
    Then Giờ quy đổi của từng dòng khớp chính xác công thức toán học
    And Tổng giờ thực tế là 32.5h, Tổng giờ quy đổi là 74.9h
  ```
- **Kết quả kỳ vọng**: Lưu snapshot `rate_percent` và `converted_hours` chính xác từng dòng vào DB.

---

### TC-DLTL-020: Chặn trùng loại tăng ca trên cùng một nhân viên trong kỳ (Negative)
- **Module / Feature**: Tăng ca (`tang_ca`)
- **Mức độ ưu tiên**: **P0 (Integrity)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-006`, `E-dltl-006`
- **Mục tiêu**: Một nhân viên trong kỳ chỉ có tối đa 1 dòng cho mỗi loại tăng ca. Các buổi làm thêm cùng loại phải cộng dồn giờ.
- **Dữ liệu thử nghiệm**: Đã có dòng `ngay_thuong_ngay` (8h). Thêm dòng thứ 2 tiếp tục chọn `ngay_thuong_ngay` (4h).
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn trùng loại tăng ca
    Given Bảng tăng ca của nhân viên đã có loại "ngay_thuong_ngay"
    When Người dùng thêm dòng mới và chọn lại "ngay_thuong_ngay"
    Then Hệ thống báo lỗi với mã "E-dltl-006" và HTTP 400
    And Thông điệp "Loại tăng ca bị lặp lại trong bảng của nhân viên."
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-006"`.

---

### TC-DLTL-021: Chặn số giờ tăng ca $\le 0$ (`hours <= 0`) (Boundary / Negative)
- **Module / Feature**: Tăng ca (`tang_ca`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-007`, `E-dltl-007`
- **Mục tiêu**: Chặn nhập số giờ OT bằng 0 hoặc âm.
- **Dữ liệu thử nghiệm**: Request body: `{ "otType": "chu_nhat_ngay", "hours": 0 }` hoặc `{ "hours": -2 }`
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-007"`, thông điệp "Số giờ tăng ca phải lớn hơn 0."

---

### TC-DLTL-022: Cảnh báo mức vàng khi tổng giờ OT tháng đạt từ 80% trần (32h - 40h)
- **Module / Feature**: Tăng ca (`tang_ca`) / Cảnh báo Luật Lao động
- **Mức độ ưu tiên**: **P1 (Compliance Warning)**
- **Loại kiểm thử**: UI / Functional
- **Quy tắc ánh xạ**: `BR-dltl-007`, `US-dltl-02-C`
- **Mục tiêu**: Hiển thị chip cảnh báo màu vàng khi nhân viên có tổng giờ OT $\ge 32$h và $\le 40$h.
- **Dữ liệu thử nghiệm**: Nhân viên `NV0002` có tổng OT thực tế là 35.0 giờ.
- **Kết quả kỳ vọng**: API trả về cờ cảnh báo `warningLevel: "YELLOW"`, UI hiển thị chip vàng cảnh báo sắp chạm trần 40h/tháng.

---

### TC-DLTL-023: Báo đỏ khi tổng giờ OT tháng vượt quá trần 40h/tháng (Boundary / Compliance)
- **Module / Feature**: Tăng ca (`tang_ca`) / Tuân thủ Điều 107 BLLĐ
- **Mức độ ưu tiên**: **P0 (Legal Compliance)**
- **Loại kiểm thử**: UI / API
- **Quy tắc ánh xạ**: `BR-dltl-007`, `US-dltl-02-C`
- **Mục tiêu**: Nhân viên có tổng giờ OT $> 40$h/tháng vi phạm Điều 107 Bộ luật Lao động 2019.
- **Dữ liệu thử nghiệm**: Tổng OT = 44.0 giờ.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Cảnh báo vi phạm trần tăng ca tháng
    Given Nhân viên có tổng giờ tăng ca thực tế là 44.0 giờ (> 40h)
    When Hệ thống kiểm tra ngưỡng tuân thủ
    Then Trả về cờ cảnh báo warningLevel: "RED"
    And Cột tổng giờ tháng hiển thị màu đỏ vi phạm trần lao động
  ```
- **Kết quả kỳ vọng**: API trả về cảnh báo `RED`, UI hiển thị vi phạm trần 40h/tháng.

---

### TC-DLTL-024: Cảnh báo lũy kế OT trong năm vượt 200h và chặn trần 300h/năm
- **Module / Feature**: Tăng ca (`tang_ca`) / Lũy kế năm
- **Mức độ ưu tiên**: **P1 (Compliance)**
- **Loại kiểm thử**: Integration / Business Rule
- **Quy tắc ánh xạ**: `BR-dltl-007`, Điều 107 BLLĐ
- **Mục tiêu**: Kiểm tra tính toán lũy kế giờ làm thêm từ tháng 1 đến kỳ hiện tại trong cùng năm.
- **Dữ liệu thử nghiệm**: Lũy kế các tháng trước là 285h. Kỳ này đăng ký thêm 20h ➔ Tổng lũy kế = 305h ($> 300$h).
- **Kết quả kỳ vọng**: Hệ thống cảnh báo đỏ vượt trần năm 300h theo quy định pháp luật.

---

### TC-DLTL-025: Áp dụng bảng tăng ca hàng loạt theo phạm vi phòng ban (Happy Path)
- **Module / Feature**: Tăng ca (`tang_ca`) / Áp dụng hàng loạt
- **Mức độ ưu tiên**: **P1 (Core)**
- **Loại kiểm thử**: API / E2E
- **Quy tắc ánh xạ**: `BR-dltl-003`, `US-dltl-02-B`
- **Mục tiêu**: Áp dụng cùng 1 bảng tăng ca mẫu cho toàn bộ nhân viên thuộc một phòng ban, sinh các ID dòng độc lập.
- **Dữ liệu thử nghiệm**: Phòng Sản Xuất 1 có 4 nhân viên (`NV01`, `NV02`, `NV03`, `NV04`). Mẫu OT: Ngày thường ngày 8h, Chủ nhật ngày 4h.
- **Kết quả kỳ vọng**:
  - Tạo thành công 8 bản ghi trong `overtime_records` (4 NV × 2 dòng).
  - Mỗi bản ghi có `id` UUID hoàn toàn khác nhau.

---

## Nhóm 4: Phân hệ 3 — Đánh giá KPI (`kpi`)

### TC-DLTL-026: Tính tỷ lệ hoàn thành và hiệu suất chung theo bình quân trọng số (Happy Path)
- **Module / Feature**: KPI (`kpi`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / API
- **Quy tắc ánh xạ**: `US-dltl-03`, `AC-dltl-03-A`
- **Mục tiêu**: Kiểm tra công thức tính:
  - $\text{ty\_le\_ht} = \text{round}(\text{thuc\_thi} / \text{muc\_tieu} \times 100, 1)$
  - $\text{hieu\_suat} = \text{round}(\sum(\text{ty\_le\_ht} \times \text{trong\_so}) / \sum \text{trong\_so}, 1)$
- **Dữ liệu thử nghiệm**:
  - Chỉ tiêu 1: Mục tiêu 100.0, Thực thi 90.0, Trọng số 60 ➔ Tỷ lệ HT = $90 / 100 \times 100 = 90.0\%$.
  - Chỉ tiêu 2: Mục tiêu 10.0, Thực thi 12.0, Trọng số 40 ➔ Tỷ lệ HT = $12 / 10 \times 100 = 120.0\%$.
  - Hiệu suất tổng = $\frac{90.0 \times 60 + 120.0 \times 40}{60 + 40} = \frac{5400 + 4800}{100} = 102.0\%$.
  - Mức lương KPI cá nhân: 4.000.000 ₫ ➔ Tiền thưởng KPI = $\text{round}(4.000.000 \times 102.0 / 100) = 4.080.000$ ₫.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tính hiệu suất KPI và tiền thưởng KPI
    Given Nhân viên có mức lương KPI là 4.000.000 ₫
    When Chấm điểm 2 chỉ tiêu với trọng số 60 và 40, tỷ lệ hoàn thành lần lượt là 90% và 120%
    Then Hiệu suất chung được tính là 102.0%
    And Tiền lương KPI tính vào bảng lương là 4.080.000 ₫
  ```
- **Kết quả kỳ vọng**: `overall_kpi_rate = 102.0`, `kpi_salary = 4.080.000 ₫`.

---

### TC-DLTL-027: Chặn chỉ tiêu KPI bị lặp lại trong bảng đánh giá (Negative)
- **Module / Feature**: KPI (`kpi`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-008`, `E-dltl-009`, `AC-dltl-03-B`
- **Mục tiêu**: Chặn khai báo trùng mã chỉ tiêu KPI trong cùng một bảng của nhân viên.
- **Dữ liệu thử nghiệm**: Bảng đã có chỉ tiêu `KPI01`. Thêm dòng mới tiếp tục chọn `KPI01`.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-009"`, thông điệp "Chỉ tiêu KPI bị lặp lại trong bảng."

---

### TC-DLTL-028: Chặn lưu khi còn dòng chưa chọn chỉ tiêu hoặc mã không hợp lệ (Negative)
- **Module / Feature**: KPI (`kpi`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-008`, `E-dltl-008`
- **Mục tiêu**: Chặn submit khi có dòng để trống mã KPI hoặc mã KPI không tồn tại trong `kpi_items`.
- **Dữ liệu thử nghiệm**: Body gửi dòng có `kpiItemId: ""` hoặc `kpiItemId: null`.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-008"`.

---

### TC-DLTL-029: Chặn lưu bảng KPI khi tổng trọng số $\le 0$ (Boundary / Negative)
- **Module / Feature**: KPI (`kpi`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-008`, `E-dltl-010`
- **Mục tiêu**: Tổng trọng số các chỉ tiêu phải $> 0$ để tránh chia cho 0.
- **Dữ liệu thử nghiệm**: Tất cả các chỉ tiêu đều nhập trọng số 0 ➔ $\sum \text{weight} = 0$.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-010"`, thông điệp "Tổng trọng số KPI phải lớn hơn 0."

---

### TC-DLTL-030: Cảnh báo vàng khi tổng trọng số khác 100% nhưng vẫn cho phép lưu nếu $> 0$
- **Module / Feature**: KPI (`kpi`) / User Experience
- **Mức độ ưu tiên**: **P1 (UX Warning)**
- **Loại kiểm thử**: UI / Functional
- **Quy tắc ánh xạ**: `BR-dltl-008`
- **Mục tiêu**: Khuyến nghị tổng trọng số bằng 100. Nếu tổng trọng số là 80 hoặc 120, hiển thị cảnh báo vàng nhưng không chặn lưu.
- **Dữ liệu thử nghiệm**: 2 chỉ tiêu có trọng số lần lượt là 50 và 30 ➔ $\sum = 80$.
- **Kết quả kỳ vọng**: Lưu thành công HTTP 200/201, trả kèm cảnh báo `warning: "Tổng trọng số hiện tại là 80% (khác 100%)"`.

---

### TC-DLTL-031: Xử lý an toàn khi mục tiêu giao $\le 0$ (EC/BR-dltl-009: Guard chia cho 0)
- **Module / Feature**: KPI (`kpi`) / Math Safety
- **Mức độ ưu tiên**: **P0 (Math Safety)**
- **Loại kiểm thử**: Unit / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-009`
- **Mục tiêu**: Trường hợp người dùng cấu hình nhầm `muc_tieu <= 0`, hệ thống tự động gán tỷ lệ hoàn thành = 0%, tuyệt đối không văng lỗi `DivisionByZero` hoặc `NaN`.
- **Dữ liệu thử nghiệm**: `muc_tieu = 0`, `thuc_thi = 50`.
- **Kết quả kỳ vọng**: `completion_rate = 0.0%`, tính toán tiếp tục bình thường.

---

### TC-DLTL-032: Nhân viên chưa được chấm điểm KPI trong kỳ (`kpi_record = null`)
- **Module / Feature**: KPI (`kpi`) / Bảng lương
- **Mức độ ưu tiên**: **P1 (Business Logic)**
- **Loại kiểm thử**: Integration / Payroll
- **Quy tắc ánh xạ**: SRS Mục 3.3
- **Mục tiêu**: Nhân viên có mức lương KPI trong hợp đồng nhưng trong kỳ chưa chấm KPI: Tiền KPI trong bảng lương mặc định = 0 ₫ (khác với chuyên cần mặc định hưởng).
- **Kết quả kỳ vọng**: `kpi_salary = 0 ₫`.

---

## Nhóm 5: Phân hệ 4 — Thưởng (`thuong`)

### TC-DLTL-033: Thêm khoản thưởng hợp lệ từ `SalaryItem` (`PERIODIC_BONUS`) và tính ngân sách nhóm
- **Module / Feature**: Thưởng (`thuong`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: API / E2E
- **Quy tắc ánh xạ**: `US-dltl-04`, `AC-dltl-04-A`
- **Mục tiêu**: Thêm khoản thưởng hợp lệ cho nhóm nhân viên và kiểm tra tính toán tổng quỹ thưởng tiêu tốn.
- **Dữ liệu thử nghiệm**: Áp dụng khoản thưởng Tết `ST01` mức 5.000.000 ₫ cho nhóm 11 nhân viên.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Thêm khoản thưởng và tính tổng quỹ
    Given Danh sách gồm 11 nhân viên ACTIVE
    When Người dùng áp dụng khoản thưởng Tết với mức 5.000.000 ₫/người
    Then Mỗi nhân viên nhận 1 bản ghi thưởng 5.000.000 ₫
    And Tổng ngân sách thưởng của nhóm tính được là 55.000.000 ₫
  ```
- **Kết quả kỳ vọng**: Tạo 11 bản ghi trong `bonus_records`, mỗi bản ghi `amount = 5.000.000`. Tổng quỹ = 55.000.000 ₫.

---

### TC-DLTL-034: Chặn lặp lại cùng một mã khoản thưởng cho một nhân viên trong kỳ (Negative)
- **Module / Feature**: Thưởng (`thuong`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-010`, `E-dltl-011`
- **Mục tiêu**: Chặn nhập 2 dòng cùng một khoản thưởng cho 1 nhân viên trong 1 kỳ.
- **Dữ liệu thử nghiệm**: Thêm 2 dòng cùng có `salary_item_id = <THUONG_DU_AN_ID>`.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-011"`, thông điệp "Khoản thưởng bị lặp lại trong bảng của nhân viên."

---

### TC-DLTL-035: Chặn nhập số tiền thưởng âm (`amount < 0`) (Boundary / Negative)
- **Module / Feature**: Thưởng (`thuong`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-011`, `E-dltl-012`, `AC-dltl-04-B`
- **Mục tiêu**: Chặn nhập số tiền thưởng là số âm.
- **Dữ liệu thử nghiệm**: Request body: `{ "salaryItemId": "<ID>", "amount": -500000 }`
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-012"`, thông điệp "Số tiền thưởng phải lớn hơn hoặc bằng 0."

---

### TC-DLTL-036: Cho phép nhập số tiền thưởng bằng 0 đồng (`amount = 0`) (Boundary)
- **Module / Feature**: Thưởng (`thuong`)
- **Mức độ ưu tiên**: **P1 (Boundary)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-011`
- **Mục tiêu**: Giá trị biên `amount = 0` là hợp lệ (ví dụ ghi nhận có tên trong danh sách xét duyệt nhưng mức thưởng 0 đồng).
- **Kết quả kỳ vọng**: HTTP 200/201 Created, `amount = 0`.

---

### TC-DLTL-037: Áp dụng thưởng phạm vi toàn công ty (`toan_cong_ty`)
- **Module / Feature**: Thưởng (`thuong`) / Phạm vi áp dụng
- **Mức độ ưu tiên**: **P1 (Feature)**
- **Loại kiểm thử**: Integration / Batch
- **Quy tắc ánh xạ**: `BR-dltl-003`
- **Mục tiêu**: Áp dụng khoản thưởng cho phạm vi `toan_cong_ty`, tự động lọc toàn bộ nhân viên có `status = "ACTIVE"`.
- **Kết quả kỳ vọng**: 100% nhân viên ACTIVE đều nhận được bản ghi thưởng tương ứng, nhân viên `RESIGNED` không nhận được.

---

## Nhóm 6: Phân hệ 5 — Lương sản phẩm (`luong_san_pham`)

### TC-DLTL-038: Thêm sản phẩm nghiệm thu & snapshot đơn giá từ danh mục (Happy Path)
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Integration / Snapshot
- **Quy tắc ánh xạ**: `BR-dltl-012`, `US-dltl-05`, `AC-dltl-05-A`
- **Mục tiêu**: Khi chọn sản phẩm `SP01`, hệ thống sao chép đơn giá từ danh mục sang bản ghi kỳ lương.
- **Dữ liệu thử nghiệm**: Sản phẩm `SP01` danh mục có đơn giá 25.000 ₫. Số lượng nghiệm thu: 200 cái.
- **Kết quả kỳ vọng**: `unit_price = 25000`, `quantity = 200`, `total_amount = 25000 * 200 = 5.000.000 ₫`.

---

### TC-DLTL-039: Điều chỉnh đơn giá snapshot trong kỳ mà không ảnh hưởng danh mục gốc
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`) / Snapshot Override
- **Mức độ ưu tiên**: **P0 (Architecture)**
- **Loại kiểm thử**: API / Business
- **Quy tắc ánh xạ**: `BR-dltl-012`, `EC-07`
- **Mục tiêu**: Cho phép người làm lương sửa đơn giá trong kỳ (ví dụ do làm ca khó tăng lên 27.000 ₫). Đơn giá trong danh mục gốc vẫn giữ nguyên 25.000 ₫.
- **Dữ liệu thử nghiệm**: Chỉnh sửa đơn giá dòng của nhân viên thành 27.000 ₫.
- **Kết quả kỳ vọng**:
  - Dòng chi tiết kỳ lương: `unit_price = 27000`, `total_amount = 5.400.000 ₫`.
  - Danh mục `piecework_products`: `unit_price` của `SP01` vẫn là 25.000 ₫.

---

### TC-DLTL-040: Sửa đổi đơn giá trong danh mục không làm thay đổi các kỳ đã ghi nhận
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`) / Immutability
- **Mức độ ưu tiên**: **P0 (Financial Integrity)**
- **Loại kiểm thử**: API / Invariant
- **Quy tắc ánh xạ**: `BR-dltl-012`, `EC-07`
- **Mục tiêu**: Admin cập nhật giá `SP01` trong danh mục từ 25.000 ₫ lên 30.000 ₫ vào tháng 9/2026. Kiểm tra lại kỳ lương tháng 8/2026.
- **Kết quả kỳ vọng**: Số liệu tháng 8/2026 giữ nguyên đơn giá 25.000 ₫ và thành tiền 5.000.000 ₫.

---

### TC-DLTL-041: Chặn thêm sản phẩm bị trùng lặp trong bảng của nhân viên (Negative)
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-012`, `E-dltl-014`
- **Mục tiêu**: Chặn khai báo 2 dòng cùng một mã sản phẩm trong cùng một kỳ của một nhân viên.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-014"`, thông điệp "Sản phẩm bị lặp lại trong bảng lương sản phẩm."

---

### TC-DLTL-042: Chặn số lượng hoặc đơn giá sản phẩm âm (Boundary / Negative)
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-013`, `E-dltl-015`
- **Mục tiêu**: Chặn nhập `quantity < 0` hoặc `unitPrice < 0`.
- **Dữ liệu thử nghiệm**: `{ "productId": "<ID>", "quantity": -5, "unitPrice": 20000 }`
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-015"`, thông điệp "Đơn giá hoặc số lượng sản phẩm không được âm."

---

### TC-DLTL-043: Chặn lưu khi còn dòng chưa chọn sản phẩm (Negative)
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-012`, `E-dltl-013`
- **Mục tiêu**: Dòng sản phẩm không có `productId` hợp lệ bị từ chối lưu.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-013"`.

---

### TC-DLTL-044: Làm tròn thành tiền lương sản phẩm có số lượng thập phân
- **Module / Feature**: Lương sản phẩm (`luong_san_pham`) / Làm tròn tiền tệ
- **Mức độ ưu tiên**: **P1 (Financial Precision)**
- **Loại kiểm thử**: Unit / Financial
- **Quy tắc ánh xạ**: `BR-dltl-013`
- **Mục tiêu**: Cho phép số lượng lẻ tối đa 2 chữ số thập phân (ví dụ 125.5 kg hoặc kiện), thành tiền làm tròn về đơn vị đồng nguyên VNĐ.
- **Dữ liệu thử nghiệm**: Đơn giá = 25.450 ₫, Số lượng = 125.55 ➔ Tích = $25.450 \times 125.55 = 3.195.247,25 \approx 3.195.247$ ₫.
- **Kết quả kỳ vọng**: `total_amount = 3195247` (Int VNĐ, làm tròn `ROUND_HALF_UP`).

---

## Nhóm 7: Phân hệ 6 — Lương phần trăm (`luong_phan_tram`)

### TC-DLTL-045: Tính hoa hồng doanh số cơ sở theo tỷ lệ snapshot (Happy Path)
- **Module / Feature**: Lương phần trăm (`luong_phan_tram`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / API
- **Quy tắc ánh xạ**: `BR-dltl-014`
- **Mục tiêu**: Tính hoa hồng theo công thức $\text{thanh\_tien} = \text{round}(\text{so\_tien\_co\_so} \times \text{ty\_le} / 100)$.
- **Dữ liệu thử nghiệm**: Doanh số = 250.000.000 ₫, Tỷ lệ hoa hồng snapshot = 2.5%.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tính lương phần trăm doanh số
    Given Nhân viên có doanh số bán hàng trong kỳ là 250.000.000 ₫
    When Áp dụng tỷ lệ hoa hồng 2.5%
    Then Thành tiền hoa hồng tính ra là 6.250.000 ₫
  ```
- **Kết quả kỳ vọng**: `total_amount = 6250000` ₫.

---

### TC-DLTL-046: Chặn khoản lương phần trăm bị lặp lại trong bảng của nhân viên (Negative)
- **Module / Feature**: Lương phần trăm (`luong_phan_tram`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-014`, `E-dltl-016`
- **Mục tiêu**: Một nhân viên không được nhận 2 dòng cùng một khoản lương phần trăm trong kỳ.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-016"`, thông điệp "Khoản lương phần trăm bị lặp lại trong bảng."

---

### TC-DLTL-047: Chặn nhập tỷ lệ hoa hồng ngoài khoảng $[0\%, 100\%]$ (Boundary / Negative)
- **Module / Feature**: Lương phần trăm (`luong_phan_tram`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-014`, `E-dltl-017`
- **Mục tiêu**: Chặn nhập tỷ lệ hoa hồng $< 0\%$ hoặc $> 100\%$.
- **Dữ liệu thử nghiệm**: Thử nhập `-0.5%` và `105%`.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-017"`, thông điệp "Tỷ lệ hoa hồng phải từ 0% đến 100%."

---

### TC-DLTL-048: Kiểm thử giá trị biên của tỷ lệ hoa hồng ($0.01\%$, $0\%$, $100\%$) kèm làm tròn số tiền
- **Module / Feature**: Lương phần trăm (`luong_phan_tram`)
- **Mức độ ưu tiên**: **P1 (Boundary)**
- **Loại kiểm thử**: Unit / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-014`
- **Mục tiêu**: Kiểm thử các giá trị biên hợp lệ.
- **Dữ liệu thử nghiệm**:
  - Ca 1: Doanh số 123.456.789 ₫, Tỷ lệ 0.01% ➔ $123.456.789 \times 0.0001 = 12.345,6789 \approx 12.346$ ₫.
  - Ca 2: Doanh số 50.000.000 ₫, Tỷ lệ 0% ➔ Thành tiền = 0 ₫.
  - Ca 3: Doanh số 10.000.000 ₫, Tỷ lệ 100% ➔ Thành tiền = 10.000.000 ₫.
- **Kết quả kỳ vọng**: Hệ thống tính toán chính xác, làm tròn `ROUND_HALF_UP`.

---

### TC-DLTL-049: Độc lập snapshot tỷ lệ hoa hồng với cấu hình mặc định trong `SalaryItem`
- **Module / Feature**: Lương phần trăm (`luong_phan_tram`) / Snapshot
- **Mức độ ưu tiên**: **P0 (Architecture)**
- **Loại kiểm thử**: Integration / Snapshot
- **Quy tắc ánh xạ**: `BR-dltl-015`
- **Mục tiêu**: Khi sửa tỷ lệ mặc định của `SalaryItem` trong Cài đặt lương, tỷ lệ snapshot của các kỳ lương cũ không bị thay đổi.
- **Kết quả kỳ vọng**: Bản ghi `commission_records.commission_rate` giữ nguyên giá trị tại thời điểm tạo.

---

## Nhóm 8: Phân hệ 7 — Lương chuyên cần (`chuyen_can`)

### TC-DLTL-050: Ghi nhận vi phạm loại `theo_gio` và `theo_lan`, tính đúng số tiền khấu trừ (Happy Path)
- **Module / Feature**: Lương chuyên cần (`chuyen_can`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / API
- **Quy tắc ánh xạ**: `BR-dltl-016`
- **Mục tiêu**: Kiểm tra tính tiền phạt:
  - Loại `theo_gio`: $\text{so\_gio} \times \text{muc\_phat}$.
  - Loại `theo_lan`: $\text{muc\_phat}$.
- **Dữ liệu thử nghiệm**: Mức phụ cấp chuyên cần được hưởng = 800.000 ₫.
  - Vi phạm 1: Đi trễ 2 giờ (mức phạt 50.000 ₫/h) ➔ Phạt 100.000 ₫.
  - Vi phạm 2: Quên chấm công 1 lần (mức phạt 100.000 ₫/lần) ➔ Phạt 100.000 ₫.
  - Tổng phạt = 200.000 ₫.
  - Thực nhận chuyên cần = $800.000 - 200.000 = 600.000$ ₫.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tính khấu trừ vi phạm chuyên cần theo giờ và theo lần
    Given Nhân viên có mức chuyên cần hưởng là 800.000 ₫
    When Ghi nhận đi trễ 2 giờ (100.000 ₫) và quên chấm công 1 lần (100.000 ₫)
    Then Tổng tiền bị trừ là 200.000 ₫
    And Tiền chuyên cần thực nhận còn lại là 600.000 ₫
  ```
- **Kết quả kỳ vọng**: `tong_tru = 200000`, `thanh_tien = 600000`.

---

### TC-DLTL-051: Vi phạm loại `mat_toan_bo`: Hệ thống trừ đúng 100% mức chuyên cần
- **Module / Feature**: Lương chuyên cần (`chuyen_can`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / Business
- **Quy tắc ánh xạ**: `BR-dltl-016`, `US-dltl-06`, `AC-dltl-06-A`
- **Mục tiêu**: Chỉ cần có 1 lỗi loại `mat_toan_bo` (ví dụ nghỉ không phép), nhân viên mất toàn bộ chuyên cần của tháng.
- **Dữ liệu thử nghiệm**: Mức hưởng 1.200.000 ₫. Phát sinh 1 lỗi "Nghỉ không phép" ngày 07/08 (`mat_toan_bo`).
- **Kết quả kỳ vọng**: $\text{tong\_tru} = 1.200.000$ ₫, $\text{thanh\_tien} = 0$ ₫.

---

### TC-DLTL-052: Chặn sàn chuyên cần: Phạt vượt mức hưởng thì tổng trừ = đơn giá, thành tiền = 0đ (Hard Invariant)
- **Module / Feature**: Lương chuyên cần (`chuyen_can`) / An toàn tài chính
- **Mức độ ưu tiên**: **P0 (Financial Invariant - Critical)**
- **Loại kiểm thử**: Unit / Financial
- **Quy tắc ánh xạ**: `BR-dltl-016`, `US-dltl-06`, `AC-dltl-06-B`
- **Mục tiêu**: **TUYỆT ĐỐI KHÔNG ĐỂ CHUYÊN CẦN BỊ ÂM**. Tổng trừ tối đa bằng đúng mức chuyên cần được hưởng: $\text{tong\_tru} = \min(\sum \text{phat}, \text{don\_gia})$. Tiền phạt vượt mức không được trừ sang lương cơ bản hay phụ cấp khác.
- **Dữ liệu thử nghiệm**:
  - Mức chuyên cần được hưởng = 300.000 ₫.
  - Nhân viên đi trễ 10 giờ (phạt 50.000 ₫/h ➔ Tổng phạt thô = 500.000 ₫).
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn sàn không âm tiền chuyên cần
    Given Nhân viên có mức phụ cấp chuyên cần là 300.000 ₫
    When Tổng tiền phạt vi phạm tính ra là 500.000 ₫
    Then Hệ thống chặn trần số tiền trừ là 300.000 ₫ (bằng mức hưởng)
    And Thành tiền chuyên cần còn lại là đúng 0 ₫
    And Phần tiền vượt 200.000 ₫ tuyệt đối KHÔNG bị trừ vào lương cơ bản
  ```
- **Kết quả kỳ vọng**: `tong_tru = 300000`, `thanh_tien = 0`. Tiền lương cơ bản không bị sứt mẻ 1 đồng.

---

### TC-DLTL-053: Bảng chuyên cần rỗng `[]` = hưởng 100% chuyên cần (Logic Invariant)
- **Module / Feature**: Lương chuyên cần (`chuyen_can`)
- **Mức độ ưu tiên**: **P0 (Business Meaning)**
- **Loại kiểm thử**: Unit / Logic
- **Quy tắc ánh xạ**: `BR-dltl-018`
- **Mục tiêu**: Mảng dòng rỗng `dong: []` mang ý nghĩa nhân viên đã được xét duyệt và **không vi phạm lỗi nào**, được hưởng trọn 100% chuyên cần.
- **Dữ liệu thử nghiệm**: Mức hưởng 500.000 ₫. Payload `dong: []`.
- **Kết quả kỳ vọng**: `tong_tru = 0`, `thanh_tien = 500.000 ₫`.

---

### TC-DLTL-054: Cho phép lặp cùng loại lỗi nhưng khác ngày; Chặn lặp lỗi nếu trùng cả loại và ngày
- **Module / Feature**: Lương chuyên cần (`chuyen_can`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Validation
- **Quy tắc ánh xạ**: `BR-dltl-017`, `E-dltl-019`
- **Mục tiêu**: Nhân viên có thể bị trễ giờ nhiều ngày trong tháng (ví dụ trễ ngày 05/08 và trễ tiếp ngày 12/08 ➔ hợp lệ). Nhưng không được khai báo 2 dòng trễ giờ cho cùng ngày 05/08.
- **Dữ liệu thử nghiệm**:
  - Request 1: Lỗi `CC01` ngày `2026-08-05` và `CC01` ngày `2026-08-12` ➔ Hợp lệ.
  - Request 2: Lỗi `CC01` ngày `2026-08-05` và tiếp tục `CC01` ngày `2026-08-05` ➔ Trùng cặp.
- **Kết quả kỳ vọng**: Request 1 thành công (HTTP 200). Request 2 trả về HTTP 400 Bad Request, `errorCode: "E-dltl-019"`, thông điệp "Lỗi chuyên cần bị khai báo trùng lặp cho cùng một ngày."

---

### TC-DLTL-055: Chặn lưu khi dòng vi phạm chuyên cần chưa chọn loại lỗi hoặc chưa điền ngày
- **Module / Feature**: Lương chuyên cần (`chuyen_can`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Validation
- **Quy tắc ánh xạ**: `BR-dltl-017`, `E-dltl-018`
- **Mục tiêu**: Bắt buộc chọn loại lỗi và ngày vi phạm.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-018"`.

---

### TC-DLTL-056: Chặn nhập số giờ vi phạm chuyên cần âm (`violation_hours < 0`)
- **Module / Feature**: Lương chuyên cần (`chuyen_can`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-016`, `E-dltl-020`
- **Mục tiêu**: Chặn nhập số giờ vi phạm âm.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-020"`.

---

### TC-DLTL-057: Nhân viên có lỗi vi phạm nhưng hợp đồng không có phụ cấp chuyên cần (`donGia = 0`) (EC-09)
- **Module / Feature**: Lương chuyên cần (`chuyen_can`) / Edge Case
- **Mức độ ưu tiên**: **P1 (Edge Case)**
- **Loại kiểm thử**: Unit / Financial
- **Quy tắc ánh xạ**: `EC-09`
- **Mục tiêu**: Nhân viên thử việc hoặc hợp đồng không có khoản chuyên cần (`donGia = 0`), nếu có bị ghi nhận lỗi đi trễ thì `tongTru = 0`, `thanhTien = 0`.
- **Kết quả kỳ vọng**: Không trừ âm sang lương, `tong_tru = 0`, `thanh_tien = 0`.

---

## Nhóm 9: Phân hệ 8 — Các khoản ứng - bù trừ (`bu_tru`)

### TC-DLTL-058: Tính tổng bị trừ ròng khi nhân viên có cả khoản trừ (`tru`) và khoản bù (`bu`) (Happy Path)
- **Module / Feature**: Ứng - Bù trừ (`bu_tru`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / API
- **Quy tắc ánh xạ**: `US-dltl-07`, `AC-dltl-07-A`
- **Mục tiêu**: Tính $\text{tong\_bi\_tru} = \sum \text{tru} - \sum \text{bu}$.
- **Dữ liệu thử nghiệm**:
  - Dòng 1: Tạm ứng lương giữa tháng = 1.500.000 ₫ (chiều `tru`).
  - Dòng 2: Truy lĩnh lương thiếu tháng trước = 800.000 ₫ (chiều `bu`).
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Tính tổng bị trừ ròng có cả bù và trừ
    Given Nhân viên có khoản tạm ứng 1.500.000 ₫ (chiều trừ) và truy lĩnh 800.000 ₫ (chiều bù)
    When Hệ thống tính toán tổng bị trừ
    Then Tổng bị trừ ròng tong_bi_tru = 1.500.000 - 800.000 = 700.000 ₫
    And Số tiền 700.000 ₫ được khấu trừ trực tiếp vào thực lĩnh
  ```
- **Kết quả kỳ vọng**: `tong_bi_tru = 700000 ₫` (Dương = bị trừ vào thực lĩnh).

---

### TC-DLTL-059: Tổng bị trừ ròng âm: Nhân viên được cộng thêm tiền vào thực lĩnh
- **Module / Feature**: Ứng - Bù trừ (`bu_tru`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: Unit / Business
- **Quy tắc ánh xạ**: `US-dltl-07`, `AC-dltl-07-B`
- **Mục tiêu**: Khi khoản bù lớn hơn khoản trừ, `tong_bi_tru < 0`, tiền được cộng thêm vào thực lĩnh.
- **Dữ liệu thử nghiệm**: Chỉ có khoản hoàn phí bảo hiểm thai sản 1.200.000 ₫ (chiều `bu`).
- **Kết quả kỳ vọng**: `tong_bi_tru = -1200000 ₫`. Thực lĩnh của nhân viên được cộng thêm 1.200.000 ₫. UI hiển thị chip xanh lá "Được nhận thêm: 1.200.000 ₫".

---

### TC-DLTL-060: Bắt buộc nhập số tiền dương $> 0$, chặn nhập số tiền âm hoặc bằng 0 (Negative)
- **Module / Feature**: Ứng - Bù trừ (`bu_tru`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Boundary
- **Quy tắc ánh xạ**: `BR-dltl-019`, `E-dltl-023`
- **Mục tiêu**: Người dùng luôn nhập số tiền dương $> 0$. Chiều cộng hay trừ do thuộc tính `direction` trong danh mục quy định.
- **Dữ liệu thử nghiệm**: Nhập `amount = -500000` hoặc `amount = 0`.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-023"`, thông điệp "Số tiền bù trừ phải lớn hơn 0 (chiều bù hoặc trừ do danh mục quy định)."

---

### TC-DLTL-061: Chặn khai báo trùng mã khoản bù trừ cho một nhân viên trong kỳ (Negative)
- **Module / Feature**: Ứng - Bù trừ (`bu_tru`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-020`, `E-dltl-022`
- **Mục tiêu**: Một nhân viên không được nhận 2 dòng cùng một khoản bù trừ trong kỳ.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-022"`, thông điệp "Khoản bù trừ bị lặp lại trong bảng của nhân viên."

---

### TC-DLTL-062: Chặn lưu khi dòng bù trừ chưa chọn khoản hoặc mã không hợp lệ (Negative)
- **Module / Feature**: Ứng - Bù trừ (`bu_tru`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-019`, `E-dltl-021`
- **Mục tiêu**: Dòng bù trừ không có mã khoản hợp lệ bị chặn lưu.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-021"`.

---

### TC-DLTL-063: Xử lý Thực lĩnh âm khi tạm ứng vượt quá lương thực nhận (EC-03: Financial Invariant)
- **Module / Feature**: Ứng - Bù trừ (`bu_tru`) / Xử lý công nợ kế toán
- **Mức độ ưu tiên**: **P0 (Financial Invariant - Critical)**
- **Loại kiểm thử**: Unit / Financial
- **Quy tắc ánh xạ**: `EC-03`, SRS Mục 3.8
- **Mục tiêu**: **HỆ THỐNG PHẢI GIỮ NGUYÊN SỐ ÂM Ở CỘT THỰC LĨNH**, TUYỆT ĐỐI KHÔNG ÉP VỀ 0. Số âm phản ánh nghĩa vụ nhân viên nợ doanh nghiệp để chuyển sang khoản thu hồi ở kỳ lương tiếp theo.
- **Dữ liệu thử nghiệm**:
  - Lương thực tế kiếm được sau thuế & bảo hiểm: 8.000.000 ₫.
  - Tạm ứng trong tháng: 10.000.000 ₫ (chiều `tru`).
  - Thực lĩnh = $8.000.000 - 10.000.000 = -2.000.000$ ₫.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Lưu trữ số âm thực lĩnh khi tạm ứng vượt lương
    Given Nhân viên có lương ròng sau thuế là 8.000.000 ₫
    When Nhân viên đã tạm ứng 10.000.000 ₫ trong tháng
    Then Cột thực lĩnh net_take_home_salary ghi nhận giá trị -2.000.000 ₫
    And Hệ thống KHÔNG ép con số này về 0
    And Ghi nhận khoản nợ 2.000.000 ₫ sẵn sàng thu hồi ở kỳ tiếp theo
  ```
- **Kết quả kỳ vọng**: `payroll_sheet_lines.net_take_home_salary = -2000000`. Phiếu chi ngân hàng nhận diện khoản âm để không tạo lệnh chuyển tiền.

---

## Nhóm 10: Quy tắc Chung, Quản lý Nhân sự & Phạm vi

### TC-DLTL-064: Chặn lập hoặc áp dụng dữ liệu lương cho nhân viên đã nghỉ việc (Security / Integrity)
- **Module / Feature**: Kiểm soát nhân sự (`BR-dltl-002`)
- **Mức độ ưu tiên**: **P0 (Data Integrity)**
- **Loại kiểm thử**: API / Security
- **Quy tắc ánh xạ**: `BR-dltl-002`, `E-dltl-002`
- **Mục tiêu**: Nhân viên có `status = "RESIGNED"` hoặc `status != "ACTIVE"` không được phép xuất hiện trong dữ liệu tính lương.
- **Dữ liệu thử nghiệm**: Gửi request thêm dòng tăng ca hoặc thưởng cho nhân viên `NV_DA_NGHI_VIEC`.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn nhập liệu cho nhân viên đã thôi việc
    Given Nhân viên "NV0099" có trạng thái "RESIGNED" (đã nghỉ việc)
    When Người dùng gửi request thêm dữ liệu lương cho nhân viên này
    Then Hệ thống từ chối với HTTP 400 Bad Request
    And Trả về mã lỗi "E-dltl-002"
    And Thông điệp "Nhân viên không tồn tại hoặc đã nghỉ việc."
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-002"`.

---

### TC-DLTL-065: Báo lỗi khi chọn phạm vi `phong_ban` nhưng chưa chọn phòng ban cụ thể (Negative)
- **Module / Feature**: Phạm vi áp dụng (`BR-dltl-003`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Validation
- **Quy tắc ánh xạ**: `BR-dltl-003`, `E-dltl-003`
- **Mục tiêu**: Chặn submit khi chọn phạm vi phòng ban mà không truyền `departmentId`.
- **Dữ liệu thử nghiệm**: Body: `{ "scope": "phong_ban", "departmentId": null }`
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-003"`, thông điệp "Chưa chọn phòng ban khi áp dụng theo phạm vi phòng ban."

---

### TC-DLTL-066: Báo lỗi khi chọn phạm vi `nhan_vien` nhưng danh sách nhân viên chọn bị rỗng (Negative)
- **Module / Feature**: Phạm vi áp dụng (`BR-dltl-003`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Validation
- **Quy tắc ánh xạ**: `BR-dltl-003`, `E-dltl-004`
- **Mục tiêu**: Chặn submit khi chọn phạm vi nhân viên mà mảng `employeeIds` rỗng.
- **Dữ liệu thử nghiệm**: Body: `{ "scope": "nhan_vien", "employeeIds": [] }`
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-004"`, thông điệp "Danh sách nhân viên áp dụng không được để trống."

---

### TC-DLTL-067: Tái sử dụng dữ liệu: Bắt buộc sinh mới 100% UUID dòng chi tiết (Data Isolation)
- **Module / Feature**: Tái sử dụng dữ liệu kỳ trước (`BR-dltl-021`)
- **Mức độ ưu tiên**: **P1 (Architecture)**
- **Loại kiểm thử**: Integration / Clone
- **Quy tắc ánh xạ**: `BR-dltl-021`
- **Mục tiêu**: Khi sao chép dữ liệu từ kỳ cũ sang kỳ mới, các dòng chi tiết phải nhận UUID mới hoàn toàn, không giữ nguyên ID cũ gây lỗi trùng khóa chính (Primary Key Collision).
- **Kết quả kỳ vọng**: 100% ID các dòng chi tiết ở kỳ mới là UUID mới được sinh tự động.

---

### TC-DLTL-068: Nhân viên chưa được set lương cá nhân -> Fallback về khung lương công ty (EC-04)
- **Module / Feature**: Tính toán Bảng lương / Fallback
- **Mức độ ưu tiên**: **P1 (Business Continuity)**
- **Loại kiểm thử**: Unit / Integration
- **Quy tắc ánh xạ**: `EC-04`
- **Mục tiêu**: Nhân viên mới vào chưa kịp cấu hình `EmployeeSalary`: Khi tính lương, hệ thống fallback lấy mức lương mặc định từ `SalaryStructure` khung của chức danh, không làm gián đoạn bảng lương.
- **Kết quả kỳ vọng**: Nhân viên vẫn xuất hiện trong bảng lương với các mức lương ngạch bậc chuẩn của công ty.

---

## Nhóm 11: Nhập / Xuất Excel (Excel IO)

### TC-DLTL-069: Import Excel hợp lệ cập nhật chính xác dữ liệu phân hệ hàng loạt (Happy Path)
- **Module / Feature**: Excel IO (`BR-dltl-022`)
- **Mức độ ưu tiên**: **P0 (Core)**
- **Loại kiểm thử**: API / Integration
- **Quy tắc ánh xạ**: `BR-dltl-022`
- **Mục tiêu**: Upload file Excel mẫu chuẩn tăng ca / thưởng cho 50 nhân viên thành công.
- **Dữ liệu thử nghiệm**: File `tang_ca_2026_08.xlsx` chứa 50 dòng hợp lệ.
- **Kết quả kỳ vọng**: HTTP 200 OK, trả về `{ "success": true, "importedRows": 50, "failedRows": 0 }`. Cơ sở dữ liệu ghi nhận đầy đủ 50 bản ghi.

---

### TC-DLTL-070: Import Excel không đúng cấu trúc mẫu quy định: Từ chối nguyên tử (Negative)
- **Module / Feature**: Excel IO (`BR-dltl-022`)
- **Mức độ ưu tiên**: **P0 (Validation)**
- **Loại kiểm thử**: API / Negative
- **Quy tắc ánh xạ**: `BR-dltl-022`, `E-dltl-024`
- **Mục tiêu**: Upload file sai tên cột, sai định dạng sheet, hoặc thiếu cột bắt buộc.
- **Dữ liệu thử nghiệm**: Upload file Excel bị xóa mất cột `ma_nv`.
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, `errorCode: "E-dltl-024"`, thông điệp "File Excel nhập vào không đúng cấu trúc mẫu quy định."

---

### TC-DLTL-071: File Excel chứa mã nhân viên không tồn tại: Rollback toàn bộ (EC-06: Atomic Rollback)
- **Module / Feature**: Excel IO / Atomic Transaction
- **Mức độ ưu tiên**: **P0 (Data Integrity)**
- **Loại kiểm thử**: Integration / Database
- **Quy tắc ánh xạ**: `EC-06`, `BR-dltl-022`
- **Mục tiêu**: File có 49 dòng đúng và dòng thứ 50 chứa mã nhân viên `NV_INVALID`. Toàn bộ giao dịch phải Rollback, không được lưu dở dang 49 dòng kia.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Atomic Rollback khi Import Excel gặp lỗi
    Given File Excel có 49 dòng hợp lệ và 1 dòng chứa mã nhân viên không tồn tại
    When Người dùng thực hiện Import file
    Then Hệ thống báo lỗi và chỉ rõ dòng số 50 bị sai
    And Toàn bộ 49 dòng trước đó bị hủy bỏ (Rollback 100%)
    And Cơ sở dữ liệu không lưu bất kỳ bản ghi nào của lần import này
  ```
- **Kết quả kỳ vọng**: HTTP 400 Bad Request, DB rollback hoàn toàn, số lượng bản ghi tăng thêm = 0.

---

### TC-DLTL-072: Tự động chuẩn hóa Trim khoảng trắng thừa và làm tròn số lẻ tiền đồng khi Import Excel (EC-10)
- **Module / Feature**: Excel IO / Data Normalization
- **Mức độ ưu tiên**: **P1 (Data Cleaning)**
- **Loại kiểm thử**: Unit / Validation
- **Quy tắc ánh xạ**: `EC-10`
- **Mục tiêu**: Người dùng gõ mã nhân viên có khoảng trắng thừa `" NV0001 "` và số tiền có số lẻ `"5000000.45"`. Hệ thống tự động trim thành `"NV0001"` và làm tròn thành `5000000`.
- **Kết quả kỳ vọng**: Dữ liệu lưu vào DB sạch sẽ, không lỗi khoảng trắng.

---

## Nhóm 12: Bảo mật, Phân quyền & Cách ly Dữ liệu (Security & RBAC)

### TC-DLTL-073: Tài khoản vai trò `EMPLOYEE` bị từ chối truy cập mọi API ghi/sửa dữ liệu (403 Forbidden)
- **Module / Feature**: Phân quyền RBAC
- **Mức độ ưu tiên**: **P0 (Security)**
- **Loại kiểm thử**: Security / RBAC
- **Quy tắc ánh xạ**: RBAC Matrix (Mục 4 Test Matrix)
- **Mục tiêu**: Nhân viên bình thường không được phép can thiệp vào dữ liệu chấm công, OT, thưởng, phạt của công ty.
- **Kịch bản BDD / Gherkin**:
  ```gherkin
  Scenario: Chặn EMPLOYEE gọi API nhập liệu
    Given Người dùng đăng nhập với vai trò "EMPLOYEE"
    When Gửi request POST/PUT/DELETE tới bất kỳ endpoint nào của du-lieu-tinh-luong
    Then Hệ thống chặn truy cập và trả về HTTP 403 Forbidden
  ```
- **Kết quả kỳ vọng**: HTTP 403 Forbidden.

---

### TC-DLTL-074: Tài khoản `EMPLOYEE` chỉ xem được phiếu lương cá nhân, không xem được người khác (Data Isolation)
- **Module / Feature**: Cách ly dữ liệu cá nhân
- **Mức độ ưu tiên**: **P0 (Privacy / Compliance)**
- **Loại kiểm thử**: Security / Privacy
- **Quy tắc ánh xạ**: RBAC Matrix
- **Mục tiêu**: Đảm bảo tính bảo mật tiền lương. Nhân viên A cố tình truy cập phiếu lương của Nhân viên B bằng cách đổi `employeeId` trên URL bị chặn ngay lập tức.
- **Dữ liệu thử nghiệm**: Nhân viên A có ID `EMP_A`, gọi API `GET /api/v1/my-payslip?employeeId=EMP_B`.
- **Kết quả kỳ vọng**: HTTP 403 Forbidden hoặc chỉ trả về dữ liệu của `EMP_A` dựa theo JWT Token.

---

### TC-DLTL-075: Kiểm tra quyền phê duyệt bảng lương (`APPROVED`) dành riêng cho Cấp quản lý (`ADMIN`)
- **Module / Feature**: Phân quyền Phê duyệt Kỳ lương
- **Mức độ ưu tiên**: **P0 (Security)**
- **Loại kiểm thử**: Security / RBAC
- **Quy tắc ánh xạ**: RBAC Matrix
- **Mục tiêu**: Chỉ Giám đốc / CFO (`ADMIN`) có quyền ký duyệt bảng lương (`APPROVED`). HR và Kế toán không thể tự duyệt bảng lương do mình lập.
- **Kết quả kỳ vọng**: HR hoặc Kế toán gọi `POST /:id/approve` trả về HTTP 403 Forbidden.

---

## Nhóm 13: Concurrency & Toàn vẹn Giao dịch Cơ sở Dữ liệu

### TC-DLTL-076: Hai người dùng cùng áp dụng bảng dữ liệu đồng thời cho cùng một phòng ban (EC-05)
- **Module / Feature**: Concurrency & Transaction Isolation
- **Mức độ ưu tiên**: **P0 (Concurrency)**
- **Loại kiểm thử**: Concurrency / DB
- **Quy tắc ánh xạ**: `EC-05`
- **Mục tiêu**: Đảm bảo giao dịch `$transaction` với mức Isolation Level `Serializable` hoặc `RepeatableRead` ngăn ngừa hiện tượng ghi đè mất mát (Lost Updates).
- **Các bước thực hiện**:
  1. Gửi đồng thời 2 request áp dụng bảng thưởng với 2 mức khác nhau cho cùng Phòng Kỹ thuật.
  2. Quan sát kết quả DB sau khi cả 2 request hoàn tất.
- **Kết quả kỳ vọng**: Dữ liệu cuối cùng của từng nhân viên nhất quán 100%, không bị tình trạng nửa số nhân viên nhận thưởng mức A, nửa nhận mức B.

---

### TC-DLTL-077: Ràng buộc Khóa ngoại: Xóa kỳ DRAFT xóa sạch chi tiết (CASCADE); Xóa danh mục cha bị chặn (RESTRICT)
- **Module / Feature**: Database Integrity & Cascading Rules
- **Mức độ ưu tiên**: **P0 (Data Architecture)**
- **Loại kiểm thử**: Integration / Database
- **Quy tắc ánh xạ**: Sơ đồ ERD Mục 3
- **Mục tiêu**:
  - Test 1 (CASCADE): Xóa 1 kỳ lương nháp (`DRAFT`) ➔ Tự động xóa sạch toàn bộ bản ghi con trong 8 bảng chi tiết của kỳ đó.
  - Test 2 (RESTRICT): Cố tình xóa sản phẩm `SP01` trong `piecework_products` khi đã có bản ghi trong `piecework_records` ➔ Bị chặn bởi Postgres Foreign Key Constraint.
- **Kết quả kỳ vọng**:
  - Test 1: Bảng con của kỳ nháp bị dọn sạch.
  - Test 2: Báo lỗi vi phạm Foreign Key `RESTRICT`, sản phẩm danh mục được bảo vệ an toàn.

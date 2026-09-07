# BÁO CÁO KIỂM THỬ CHẤT LƯỢNG (QA TEST REPORT) — ĐỢT 5
## Phân hệ: HR Master Data — Cấu hình mặc định, Ca làm việc & Lịch ngày lễ

- **Người thực hiện**: Agent Tester-QA
- **Thời gian thực hiện**: 2026-09-05
- **Mã đợt kiểm thử**: QA-HR-PHASE-5
- **Trạng thái tổng thể**: ✅ **PASSED (100% ĐẠT CHUẨN) — SẴN SÀNG TÍCH HỢP FRONTEND**

---

## 1. Tổng quan kiểm thử (Executive Summary)

### 1.1 Mục tiêu kiểm thử
Đánh giá toàn diện chất lượng kỹ thuật, tính toàn vẹn dữ liệu, các giá trị biên (boundary limits), logic nghiệp vụ phức tạp, khả năng chống lỗi (fault tolerance), bảo mật xác thực (Auth) và phân quyền vai trò (RBAC) cho 3 thực thể thiết lập nhân sự mới:
1. **GeneralSetting** (Cấu hình mặc định / Thiết lập chung — Singleton `DEFAULT`).
2. **WorkShift** (Ca làm việc — Mã tự sinh `CA01`..`CA99`, tính toán động `workingHours` & `isOvernight`).
3. **Holiday** (Lịch ngày lễ — Ràng buộc duy nhất `[date, name]`, tính năng tạo nhanh 11 ngày lễ chuẩn Việt Nam 2024–2030).

### 1.2 Môi trường & Hạ tầng kiểm thử
- **Ngôn ngữ & Runtime**: Node.js v20+, TypeScript 5.7+
- **Framework**: NestJS v11, Prisma ORM 6.x (với `@prisma/adapter-pg`)
- **Cơ sở dữ liệu kiểm thử**: PostgreSQL 16 chạy trên Docker container thật (`localhost:5435/hrm_accounting`)
- **Framework kiểm thử**: Vitest v4.1.11, Supertest v7.0.0, Argon2 password hashing
- **Công cụ rà soát mã nguồn**: Oxlint (Static Linter), Nest Build (Compiler & Typecheck)

### 1.3 Thống kê kết quả kiểm thử tổng quát
| Chỉ số kiểm thử | Kết quả đạt được | Mục tiêu | Trạng thái |
|---|---|---|---|
| **Oxlint (Linter)** | **0 errors, 0 warnings** | 0 lỗi | ✅ ĐẠT |
| **Nest Build (Typecheck)** | **0 errors, biên dịch thành công** | 0 lỗi | ✅ ĐẠT |
| **Unit Tests (Vitest)** | **248 passed / 248 tests** (20 test files) | 100% pass | ✅ ĐẠT |
| **End-to-End Tests (Postgres 5435)** | **224 passed / 224 tests** (8 test files) | 100% pass | ✅ ĐẠT |
| **E2E Suite Đợt 5 (`settings-shifts-holidays`)** | **25 passed / 25 tests** | 100% pass | ✅ ĐẠT |
| **Tỷ lệ kiểm thử thành công (Pass Rate)** | **100%** | 100% | ✅ ĐẠT |

---

## 2. Ma trận truy xuất yêu cầu & kiểm thử (Requirements Traceability Matrix - RTM)

Bảng đối chiếu giữa Yêu cầu nghiệp vụ (SRS), Tiêu chí nghiệm thu (AC), Mã lỗi hệ thống (Errors) và Ca kiểm thử tự động tương ứng:

| Mã yêu cầu | Phân loại | Tóm tắt yêu cầu | Ca kiểm thử xác minh | Kết quả |
|---|---|---|---|---|
| **BR-hr-019** | Business Rule | Singleton `DEFAULT` cho Cấu hình mặc định | Unit: `general-settings.service.spec.ts`<br>E2E: `settings-shifts-holidays.e2e-spec.ts` (GET & Restore) | ✅ PASS |
| **BR-hr-020** | Business Rule | Biểu thuế TNCN lũy tiến: bậc sau thuế suất phải cao hơn bậc trước | Unit: `general-settings.service.spec.ts`<br>E2E: Test case `E-hr-029` (Thuế suất giảm hoặc bằng) | ✅ PASS |
| **BR-hr-021** | Business Rule | Ràng buộc giá trị biên tham số (Giờ công 1–24h, Lương > 0) | E2E: Test case giá trị biên `1.0`, `24.0`, `0.9`, `24.1`, `baseSalary: 0` | ✅ PASS |
| **BR-hr-022** | Business Rule | Khôi phục mặc định tham số chuẩn Việt Nam | E2E: `POST /settings/general/restore-default` (Base salary 2.34M, 8h/ngày) | ✅ PASS |
| **BR-hr-023** | Business Rule | Mã ca tự sinh `CA01`–`CA99` khi để trống, bất biến sau khi tạo | Unit: `work-shifts.service.spec.ts`<br>E2E: Test tự gán mã & chặn sửa `code` qua PATCH | ✅ PASS |
| **BR-hr-024** | Business Rule | Giờ vào/ra định dạng `HH:mm`, tự động tính `workingHours` & `isOvernight` | Unit & E2E: Ca ngày (8.0h), Ca đêm (7.5h), Ca 24h (22.0h), Ca qua 00:00 (1.0h) | ✅ PASS |
| **BR-hr-025** | Business Rule | Mã ca làm việc duy nhất trong toàn hệ thống | E2E: Test case `E-hr-033` (Tạo ca trùng mã -> 409 Conflict) | ✅ PASS |
| **BR-hr-026** | Business Rule | Lễ âm lịch không được cấu hình lặp lại hàng năm theo dương lịch | E2E: Test case `E-hr-035` (`type: LUNAR` + `isAnnual: true` -> 400 Bad Request) | ✅ PASS |
| **BR-hr-027** | Business Rule | Cặp `[date, name]` của ngày lễ là duy nhất | E2E: Test case `E-hr-036` (Tạo/Sửa ngày lễ trùng `[date, name]` -> 409 Conflict) | ✅ PASS |
| **BR-hr-028** | Business Rule | Tạo nhanh 11 ngày lễ chuẩn VN theo Điều 112 BLLĐ 2019 (2024–2030), idempotent | Unit: `holidays.service.spec.ts`<br>E2E: Tạo lần 1 (11 added), tạo lần 2 (11 skipped) | ✅ PASS |
| **FR-hr-024** | Functional | Xem thông tin thiết lập chung | E2E: `GET /settings/general` cho ADMIN, HR, ACCOUNTANT | ✅ PASS |
| **FR-hr-025** | Functional | Cập nhật thiết lập chung | E2E: `PUT /settings/general` cập nhật partial và validate strict | ✅ PASS |
| **FR-hr-026** | Functional | Khôi phục thiết lập chung mặc định | E2E: `POST /settings/general/restore-default` trả về 200 OK | ✅ PASS |
| **FR-hr-027** | Functional | Tạo mới ca làm việc | E2E: `POST /work-shifts` hỗ trợ mã tự sinh hoặc mã tự nhập | ✅ PASS |
| **FR-hr-028** | Functional | Danh sách & phân trang ca làm việc | E2E: `GET /work-shifts` lọc theo `status`, tìm kiếm theo từ khóa | ✅ PASS |
| **FR-hr-029** | Functional | Xem chi tiết ca làm việc | E2E: `GET /work-shifts/:id` trả về `workingHours` và `isOvernight` | ✅ PASS |
| **FR-hr-030** | Functional | Cập nhật & Xóa ca làm việc | E2E: `PATCH /work-shifts/:id`, `DELETE /work-shifts/:id` -> 204 | ✅ PASS |
| **FR-hr-031** | Functional | Tạo mới ngày lễ | E2E: `POST /holidays` lưu ngày dạng Date chuẩn ISO YYYY-MM-DD | ✅ PASS |
| **FR-hr-032** | Functional | Danh sách, phân trang & tạo nhanh ngày lễ | E2E: `GET /holidays` lọc theo `year`, `type`, phân trang `page`/`pageSize` | ✅ PASS |
| **FR-hr-033** | Functional | Cập nhật & Xóa ngày lễ | E2E: `PATCH /holidays/:id`, `DELETE /holidays/:id` -> 204 | ✅ PASS |
| **AC-hr-18** | Acceptance | Khôi phục mặc định trả về tham số chuẩn | E2E: Verify đầy đủ các trường sau restore | ✅ PASS |
| **AC-hr-19** | Acceptance | Tự tính giờ công ca ngày, ca qua đêm, trừ giờ nghỉ | E2E: Xác thực công thức tính toán và trường hợp nghỉ vượt độ dài ca | ✅ PASS |
| **AC-hr-20** | Acceptance | Sinh mã ca `CA01`–`CA99` khi không truyền mã | E2E: Regex `/^CA\d{2}$/` trên kết quả tự sinh | ✅ PASS |
| **AC-hr-21** | Acceptance | Tạo nhanh 11 ngày lễ không tạo trùng lặp | E2E: Xác thực idempotency trên năm 2026 | ✅ PASS |
| **AC-hr-22** | Acceptance | Chỉ `ADMIN` có quyền cập nhật cấu hình mặc định | E2E: `HR` và `ACCOUNTANT` bị từ chối 403 khi gọi PUT / Restore | ✅ PASS |

---

## 3. Chi tiết kết quả kiểm thử chuyên sâu (Detailed Test Execution)

### 3.1 Cấu hình mặc định (`GeneralSetting`)
1. **Kiểm thử giá trị biên (Boundary Testing)**:
   - `standardHoursPerDay = 1.0` -> **200 OK** (Biên dưới hợp lệ).
   - `standardHoursPerDay = 24.0` -> **200 OK** (Biên trên hợp lệ).
   - `standardHoursPerDay = 0.9` -> **400 Bad Request**, mã lỗi chuẩn `E-hr-027`.
   - `standardHoursPerDay = 24.1` -> **400 Bad Request**, mã lỗi chuẩn `E-hr-027`.
   - `baseSalary = 1` -> **200 OK** (Số nguyên dương nhỏ nhất hợp lệ).
   - `baseSalary = 0` -> **400 Bad Request**, mã lỗi chuẩn `E-hr-028`.
2. **Kiểm thử Biểu thuế TNCN lũy tiến 7 bậc**:
   - Gửi payload chuẩn 7 bậc thuế theo quy định pháp luật (5%, 10%, 15%, 20%, 25%, 30%, 35%) -> **200 OK**.
   - Gửi 2 bậc thuế có thuế suất bằng nhau (10% và 10%) -> **400 Bad Request**, mã lỗi chuẩn `E-hr-029`.
   - Gửi bậc sau có thuế suất thấp hơn bậc trước (10% rồi 5%) -> **400 Bad Request**, mã lỗi chuẩn `E-hr-029`.
3. **Cập nhật từng phần (Partial Update) & Strict Validation**:
   - Cập nhật trường lẻ `{ socialInsuranceCompPercent: 18.0 }`: chỉ cập nhật trường yêu cầu, bảo toàn nguyên vẹn tất cả các trường cấu hình khác (`healthInsuranceCompPercent`, `workDayMethod`, `taxBrackets`...).
   - Gửi trường không xác định (`unknownKey`): Schema `.strict()` chặn đứng với **400 Bad Request**, ngăn ngừa rủi ro ô nhiễm cơ sở dữ liệu.

### 3.2 Ca làm việc (`WorkShift`)
1. **Kiểm thử các kịch bản thời gian & ca đặc thù**:
   - **Ca hành chính thường** (`08:00` đến `17:00`, nghỉ 60 phút): Tổng thời gian 9h - 1h = `workingHours: 8.0`, `isOvernight: false` -> **201 Created**.
   - **Ca đêm qua nửa đêm** (`22:00` đến `06:00`, nghỉ 30 phút): Tổng thời gian 8h - 0.5h = `workingHours: 7.5`, `isOvernight: true` -> **201 Created**.
   - **Ca vượt qua mốc nửa đêm** (`23:30` đến `00:30`, nghỉ 0 phút): `workingHours: 1.0`, `isOvernight: true` -> **201 Created**.
   - **Ca trực 24 giờ** (`08:00` đến `08:00` hôm sau, nghỉ 120 phút): Tổng 24h - 2h = `workingHours: 22.0`, `isOvernight: true` -> **201 Created**.
   - **Ca có thời gian nghỉ vượt quá độ dài ca** (`08:00` đến `12:00` = 4h, nghỉ 300 phút = 5h): Hệ thống tự động clamp `Math.max(0, ...)` -> `workingHours: 0`, không xảy ra số âm -> **201 Created**.
2. **Quy tắc tính mã & tính bất biến**:
   - Bỏ trống trường `code`: Hệ thống tự động quét các mã đã dùng và gán số thứ tự tiếp theo dạng `CA01`, `CA02`... -> **201 Created**.
   - Nhập mã trùng lặp với ca đã tồn tại: Hệ thống bắt lỗi `P2002` của Postgres và trả về **409 Conflict**, mã lỗi `E-hr-033`.
   - Sửa `code` qua `PATCH /work-shifts/:id`: Bị từ chối **400 Bad Request** vì `code` là trường bất biến không có trong DTO cập nhật (`BR-hr-023`). Sửa các trường được phép (`name`, `breakMinutes`) hoạt động hoàn hảo (**200 OK**).

### 3.3 Lịch ngày lễ (`Holiday`)
1. **Kiểm thử ràng buộc nghiệp vụ**:
   - Bỏ trống tên ngày lễ -> **400 Bad Request**, mã lỗi `E-hr-034`.
   - Chọn loại lễ âm lịch (`type: LUNAR`) nhưng bật cờ lặp hàng năm (`isAnnual: true`) -> **400 Bad Request**, mã lỗi `E-hr-035` (`BR-hr-026`).
   - Tạo mới hoặc sửa ngày lễ trùng cặp `[date, name]` với bản ghi khác -> **409 Conflict**, mã lỗi `E-hr-036` (`BR-hr-027`).
2. **Kiểm thử tính năng Tạo nhanh (`quick-generate`)**:
   - Kiểm tra biên năm hỗ trợ:
     - Gửi `year: 2023` (< 2024) -> **400 Bad Request** ("Chỉ hỗ trợ tạo nhanh cho các năm từ 2024 đến 2030").
     - Gửi `year: 2035` (> 2030) -> **400 Bad Request** ("Chỉ hỗ trợ tạo nhanh cho các năm từ 2024 đến 2030").
   - Chạy tạo nhanh năm 2025: Tạo thành công 11 ngày lễ chuẩn Việt Nam (Tết Âm lịch bắt đầu từ ngày 28 tháng Chạp `2025-01-27` đến Mùng 3 Tết `2025-01-31`; Giỗ Tổ Hùng Vương ngày `2025-04-07`).
   - Chạy tạo nhanh năm 2026:
     - Chạy lần 1: Tạo mới thành công 11 ngày (`addedCount: 11`, `skippedCount: 0`).
     - Chạy lại lần 2: Hệ thống nhận diện toàn bộ đã tồn tại, không tạo trùng lặp (`addedCount: 0`, `skippedCount: 11`) -> Xác nhận tính Idempotent 100%.
3. **Kiểm thử phân trang và bộ lọc**:
   - `GET /holidays?year=2025&page=1&pageSize=5`: Trả về `page: 1`, `pageSize: 5`, `items.length: 5`, `total >= 11`.
   - `GET /holidays?year=2025&type=NATIONAL`: Lọc chính xác các ngày quốc lễ dương lịch.

---

## 4. Ma trận kiểm thử bảo mật & phân quyền (Security & RBAC Matrix)

Đã kiểm tra thực tế trên 14 endpoint API với 4 vai trò người dùng (`ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE`) và trường hợp Unauthenticated (không gửi JWT token):

| Endpoint | Method | Unauth | EMPLOYEE | ACCOUNTANT | HR | ADMIN |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `/settings/general` | `GET` | 401 | 403 | **200** | **200** | **200** |
| `/settings/general` | `PUT` | 401 | 403 | 403 | **403** (AC-hr-22) | **200** |
| `/settings/general/restore-default` | `POST` | 401 | 403 | 403 | **403** (AC-hr-22) | **200** |
| `/work-shifts` | `GET` | 401 | 403 | **200** | **200** | **200** |
| `/work-shifts/:id` | `GET` | 401 | 403 | **200** | **200** | **200** |
| `/work-shifts` | `POST` | 401 | 403 | 403 | **201** | **201** |
| `/work-shifts/:id` | `PATCH` | 401 | 403 | 403 | **200** | **200** |
| `/work-shifts/:id` | `DELETE` | 401 | 403 | 403 | **204** | **204** |
| `/holidays` | `GET` | 401 | 403 | **200** | **200** | **200** |
| `/holidays/:id` | `GET` | 401 | 403 | **200** | **200** | **200** |
| `/holidays` | `POST` | 401 | 403 | 403 | **201** | **201** |
| `/holidays/quick-generate` | `POST` | 401 | 403 | 403 | **201** | **201** |
| `/holidays/:id` | `PATCH` | 401 | 403 | 403 | **200** | **200** |
| `/holidays/:id` | `DELETE` | 401 | 403 | 403 | **204** | **204** |

**Đánh giá an toàn thông tin**:
- Toàn bộ endpoint đều được bọc bởi `JwtAuthGuard` và `RolesGuard`. Tuyệt đối không có endpoint nào bị lộ lọt dữ liệu ra ngoài khi chưa xác thực.
- Phân quyền theo nguyên tắc đặc quyền tối thiểu (Principle of Least Privilege): `ACCOUNTANT` chỉ có quyền xem báo cáo/danh mục; `HR` chỉ cấu hình lịch biểu vận hành; cấu hình tài chính toàn công ty được bảo vệ độc quyền cho `ADMIN`.

---

## 5. Nhật ký phát hiện & Phân tích chất lượng (QA Insights & Observations)

Trong quá trình thiết kế và thực thi bộ test chuyên sâu, QA ghi nhận 3 phát hiện kiến trúc quan trọng:

1. **Bất biến mã ca làm việc (`WorkShift.code`)**:
   - *Phát hiện*: DTO `updateWorkShiftSchema` không chứa trường `code` và được cấu hình `.strict()`. Khi client cố tình gửi trường `code` trong payload `PATCH`, NestJS trả về `400 Bad Request`.
   - *Đánh giá*: Đây là hành vi ĐÚNG theo quy tắc nghiệp vụ `BR-hr-023` ("Mã ca làm việc không được sửa đổi sau khi tạo để đảm bảo toàn vẹn dữ liệu chấm công lịch sử").
2. **Cơ chế `.strict()` trên Zod Schema**:
   - *Phát hiện*: Tất cả các payload gửi lên controller đều được validate nghiêm ngặt, từ chối bất kỳ thuộc tính lạ nào không nằm trong schema (ví dụ: `siCompanyRate` thay vì `socialInsuranceCompPercent`).
   - *Đánh giá*: Rất tốt cho bảo mật, ngăn chặn kỹ thuật tấn công Mass Assignment / Parameter Tampering.
3. **Hành vi truy vấn ngày lễ theo năm (`GET /holidays?year=YYYY`)**:
   - *Phát hiện*: Theo API Contract Mục 15.2, khi lọc theo `year`, hệ thống trả về các ngày lễ trong năm đó HOẶC có cờ `isAnnual = true`. Do đó, các ngày quốc lễ cố định (như 01/01, 30/04, 01/05, 02/09) sẽ luôn hiển thị trong kết quả tra cứu của bất kỳ năm nào.
   - *Đánh giá*: Hoàn toàn phù hợp với logic nghiệp vụ lịch nghỉ lễ của doanh nghiệp (ngày lễ cố định tự động áp dụng qua các năm mà không bắt buộc người dùng phải tái tạo thủ công mỗi năm).

---

## 6. Kết luận & Đánh giá mức độ sẵn sàng (Release Recommendation)

- **Độ tin cậy mã nguồn (Code Reliability)**: Đạt mức cao nhất. 0 lỗi lint, 0 lỗi biên dịch, 100% test case tự động vượt qua trên môi trường cơ sở dữ liệu thật.
- **Tính sẵn sàng của API (API Readiness)**: Cả 14 endpoints hoạt động ổn định, đúng chuẩn RESTful, format ngày tháng và dữ liệu tính toán nhất quán.
- **Khuyến nghị của QA**:
  > **CHẤP THUẬN PHÁT HÀNH (SIGNED OFF)**. Hệ thống đã đủ điều kiện 100% để chuyển giao sang Agent **Frontend Engineer** nhằm thay thế các mock data tại `C:\Users\Admin\Desktop\maxv_v2\hdđt_maxv\src\features\hrm\components\cau_hinh_mac_dinh` bằng kết nối API thực tế.

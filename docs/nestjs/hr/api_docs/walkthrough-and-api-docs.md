# BÁO CÁO WALKTHROUGH VÀ TÀI LIỆU KỸ THUẬT API (HR MASTER DATA)
## Đợt 5: Cấu hình mặc định, Ca làm việc & Lịch ngày lễ (Kèm Danh mục 44 API)

- **Thời gian**: 2026-09-05
- **Tác giả**: Engineering Pipeline (BA, Architect, Backend Engineer, Tester-QA)
- **Dự án**: `phamvinh203/hrm-Accounting` (Nhánh `dev`)
- **Vị trí lưu trữ**: `docs/hr/api_docs/walkthrough-and-api-docs.md`
- **Trạng thái**: ✅ **100% HOÀN THÀNH & NGHIỆM THU — SẴN SÀNG TÍCH HỢP FRONTEND**

---

# PHẦN 1: WALKTHROUGH TRIỂN KHAI VÀ KẾT QUẢ NGHIỆM THU

## 1. Mục tiêu & Bối cảnh kỹ thuật
Đợt 5 tập trung chuyển đổi toàn bộ giao diện và dữ liệu giả lập (mock data) tại thư mục frontend `C:\Users\Admin\Desktop\maxv_v2\hdđt_maxv\src\features\hrm\components\cau_hinh_mac_dinh` thành các module cơ sở dữ liệu và RESTful API thực tế trên backend:
1. **Thiết lập chung / Cấu hình mặc định (`GeneralSetting`)**:
   - Singleton pattern (`id = "DEFAULT"`).
   - Quản lý tham số ngày công, giờ công chuẩn (1–24h), ngày phép, quy định OT, lương cơ sở, lương vùng.
   - Tỷ lệ đóng BHXH, BHYT, BHTN, công đoàn cho Người lao động và Doanh nghiệp.
   - Biểu thuế TNCN lũy tiến 7 bậc lưu trữ dưới dạng `JsonB` trên PostgreSQL.
   - Tính năng khôi phục cấu hình chuẩn theo Bộ luật Lao động 2019 và Nghị quyết 954/2020/UBTVQH14.
   - Bảo mật: Chỉ `ADMIN` có quyền cập nhật và khôi phục mặc định (`AC-hr-22`).
2. **Ca làm việc (`WorkShift`)**:
   - Quản lý danh mục ca làm việc: mã ca, tên ca, giờ vào (`startTime`), giờ ra (`endTime`), thời gian nghỉ giữa ca (`breakMinutes`), trạng thái (`status`).
   - Tự động sinh mã tuần tự `CA01`–`CA99` khi client để trống (`BR-hr-023`). Mã ca bất biến sau khi tạo.
   - Tính toán động (không lưu tĩnh trong DB): `isOvernight` (nhận diện ca qua đêm hoặc vượt mốc 00:00) và `workingHours` (tính giờ làm việc thực tế sau khi trừ thời gian nghỉ).
3. **Lịch ngày lễ (`Holiday`)**:
   - Quản lý lịch nghỉ lễ toàn công ty: ngày lễ (`date`), tên ngày lễ, loại lễ (`NATIONAL`, `LUNAR`, `COMPANY`), cờ lặp hàng năm (`isAnnual`), cờ hưởng nguyên lương (`isPaid`).
   - Ràng buộc toàn vẹn duy nhất: Cặp `[date, name]` là UNIQUE (`BR-hr-027`, mã lỗi `E-hr-036`).
   - Quy tắc nghiệp vụ: Lễ âm lịch không được cấu hình lặp hàng năm theo dương lịch (`BR-hr-026`, mã lỗi `E-hr-035`).
   - Tính năng Tạo nhanh (`POST /holidays/quick-generate`): Tự động tạo 11 ngày lễ chuẩn Việt Nam theo Điều 112 BLLĐ 2019 cho các năm từ 2024 đến 2030 (tra cứu chính xác lịch âm cho Tết Âm lịch và Giỗ Tổ Hùng Vương), đảm bảo tính Idempotent (không tạo trùng lặp).

---

## 2. Các thành phần mã nguồn đã hoàn thành

### 2.1 Cơ sở dữ liệu & Migration (`Backend/prisma`)
- **4 Enums mới**: `WorkDayMethod`, `DayPolicy`, `ShiftStatus`, `HolidayType`.
- **3 Models mới**: `GeneralSetting`, `WorkShift`, `Holiday`.
- **Migration**: Tạo và áp dụng thành công migration `20260905144810_add_settings_work_shifts_holidays` lên PostgreSQL dev (port 5435).
- **Seed Script**: Bổ sung bản ghi `DEFAULT` và 4 ca làm việc mẫu (`CA01`..`CA04`) vào `Backend/prisma/seed.ts`.

### 2.2 Mã lỗi nền tảng (`Backend/src/common/hr-errors.ts`)
- Mở rộng hàm `hrNotFound()` hỗ trợ thực thể `'ca làm việc'` và `'ngày lễ'`.
- Bổ sung 10 mã lỗi chuẩn hóa mới:
  - `E-hr-027`: Giờ công chuẩn/ngày phải nằm trong khoảng 1–24 giờ (400).
  - `E-hr-028`: Lương cơ sở và lương tối thiểu vùng phải lớn hơn 0 (400).
  - `E-hr-029`: Thuế suất bậc sau phải cao hơn bậc liền trước (400).
  - `E-hr-030`: Tên ca không được để trống (400).
  - `E-hr-031`: Ca làm việc phải có giờ vào và giờ ra (400).
  - `E-hr-032`: Nghỉ giữa ca không được là số âm (400).
  - `E-hr-033`: Mã ca làm việc đã tồn tại (409 Conflict).
  - `E-hr-034`: Tên ngày lễ và ngày không được để trống (400).
  - `E-hr-035`: Lễ theo âm lịch không lặp lại theo dương lịch được (400).
  - `E-hr-036`: Ngày này đã có ngày lễ cùng tên (409 Conflict).

### 2.3 Các Submodules Nghiệp vụ (`Backend/src/hr/`)
- `Backend/src/hr/settings/`:
  - DTO: `update-general-setting.schema.ts` (Zod `.strict()`, kiểm tra lũy tiến biểu thuế và giá trị biên).
  - Service: `general-settings.service.ts` (Singleton pattern, tự khởi tạo khi trống, partial update, restore default).
  - Controller: `general-settings.controller.ts` (GET 200 cho ADMIN/HR/ACC; PUT và Restore 200 cho ADMIN only).
  - Unit Tests: `general-settings.service.spec.ts`.
- `Backend/src/hr/work-shifts/`:
  - DTOs: `create-work-shift.schema.ts`, `update-work-shift.schema.ts` (bảo vệ bất biến `code`), `list-work-shifts-query.schema.ts`.
  - Service: `work-shifts.service.ts` (tính `workingHours`, `isOvernight`, tự sinh mã `CA01`..`CA99`, phân trang & tìm kiếm).
  - Controller: `work-shifts.controller.ts` (CRUD đầy đủ).
  - Unit Tests: `work-shifts.service.spec.ts`.
- `Backend/src/hr/holidays/`:
  - Helper tra cứu âm lịch: `vietnam-holidays.util.ts` (bảng tra Tết Âm lịch và Giỗ Tổ Hùng Vương 2024–2030).
  - DTOs: `create-holiday.schema.ts`, `update-holiday.schema.ts`, `list-holidays-query.schema.ts`, `quick-generate-holiday.schema.ts` (chặn năm ngoài 2024–2030).
  - Service: `holidays.service.ts` (CRUD, format ngày `YYYY-MM-DD`, tạo nhanh idempotent).
  - Controller: `holidays.controller.ts`.
  - Unit Tests: `holidays.service.spec.ts`.
- `Backend/src/hr/hr.module.ts`: Đã đăng ký và liên kết 3 controller cùng 3 service mới.

---

## 3. Kết quả kiểm thử tự động & Nghiệm thu QA (QA Sign-off)

| Chỉ số kiểm thử | Công cụ | Kết quả đạt được | Trạng thái |
|---|---|:---:|:---:|
| **Static Analysis / Linting** | Oxlint | **0 errors, 0 warnings** | ✅ XANH |
| **Typecheck & Compilation** | Nest build (`tsc`) | **0 errors, biên dịch thành công** | ✅ XANH |
| **Unit Tests** | Vitest | **248 / 248 passed** (20 test files) | ✅ XANH |
| **End-to-End Tests** | Vitest + Supertest + PostgreSQL thật (port 5435) | **224 / 224 passed** (8 test suites) | ✅ XANH |
| **E2E Suite Settings/Shifts/Holidays** | Supertest | **25 / 25 passed** | ✅ XANH |

### Các nội dung chuyên sâu đã được QA xác nhận:
1. **Giá trị biên**: Giờ công 1.0h, 24.0h (pass); 0.9h, 24.1h (bắt lỗi `E-hr-027`); Lương cơ sở = 1 (pass), <= 0 (bắt lỗi `E-hr-028`); Biểu thuế 7 bậc chuẩn (pass), thuế suất giảm/bằng nhau (bắt lỗi `E-hr-029`).
2. **Ca làm việc đặc thù**: Ca thường 08:00–17:00 (8h, `isOvernight: false`); Ca đêm 22:00–06:00 (7.5h, `isOvernight: true`); Ca qua 00:00 23:30–00:30 (1h, `isOvernight: true`); Ca trực 24h 08:00–08:00 (22h sau trừ nghỉ 120p); Ca nghỉ vượt giờ tự động clamp về 0h.
3. **Bất biến**: Sửa `code` của ca làm việc qua `PATCH` bị từ chối `400 Bad Request`.
4. **Tạo nhanh ngày lễ**: Tạo năm 2025 và 2026 chính xác 11 ngày lễ; Chạy lần 2 không sinh trùng (`skippedCount = 11, addedCount = 0`). Chặn năm ngoài 2024–2030 (`2023`, `2035` -> 400).
5. **Bảo mật & RBAC**: 401 khi thiếu token; 403 đối với `EMPLOYEE` trên toàn bộ 14 endpoints; `ACCOUNTANT` chế độ Read-only; `HR` bị chặn sửa thiết lập chung (chỉ `ADMIN` có quyền).

---

# PHẦN 2: DANH MỤC TỔNG THỂ 44 API HIỆN CÓ CỦA MODULE HR

Tất cả 44 API dưới đây đều đã được triển khai mã nguồn, kết nối database PostgreSQL và vượt qua 100% bộ kiểm thử tự động:

| STT | Phương thức | Endpoint Route | Phân quyền (Roles) | Mô tả chức năng |
|:---:|:---:|---|---|---|
| **1** | `POST` | `/departments` | `ADMIN`, `HR` | Tạo mới phòng ban |
| **2** | `GET` | `/departments` | `ADMIN`, `HR`, `ACCOUNTANT` | Danh sách phòng ban (lọc trạng thái, tìm kiếm) |
| **3** | `GET` | `/departments/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | Chi tiết phòng ban |
| **4** | `PATCH` | `/departments/:id` | `ADMIN`, `HR` | Cập nhật thông tin phòng ban |
| **5** | `DELETE` | `/departments/:id` | `ADMIN`, `HR` | Xóa phòng ban (soft-delete nếu đã có nhân viên) |
| **6** | `POST` | `/employees` | `ADMIN`, `HR` | Tạo nhân viên kèm hợp đồng đầu tiên (Transaction nguyên tử) |
| **7** | `GET` | `/employees` | `ADMIN`, `HR`, `ACCOUNTANT` | Danh sách nhân viên (phân trang, tìm kiếm, lọc phòng ban) |
| **8** | `GET` | `/employees/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | Chi tiết hồ sơ nhân viên |
| **9** | `PATCH` | `/employees/:id` | `ADMIN`, `HR` | Cập nhật thông tin nhân viên |
| **10** | `DELETE` | `/employees/:id` | `ADMIN`, `HR` | Xóa nhân viên |
| **11** | `POST` | `/dependents` | `ADMIN`, `HR` | Thêm người phụ thuộc cho nhân viên |
| **12** | `GET` | `/employees/:id/dependents` | `ADMIN`, `HR`, `ACCOUNTANT` | Danh sách người phụ thuộc theo nhân viên |
| **13** | `GET` | `/dependents/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | Chi tiết người phụ thuộc |
| **14** | `PATCH` | `/dependents/:id` | `ADMIN`, `HR` | Cập nhật người phụ thuộc |
| **15** | `DELETE` | `/dependents/:id` | `ADMIN`, `HR` | Xóa người phụ thuộc |
| **16** | `POST` | `/employees/:employeeId/contracts` | `ADMIN`, `HR` | Tạo hợp đồng mới cho nhân viên (chống chồng lấn) |
| **17** | `GET` | `/employees/:employeeId/contracts` | `ADMIN`, `HR`, `ACCOUNTANT` | Danh sách lịch sử hợp đồng của nhân viên |
| **18** | `GET` | `/contracts/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | Chi tiết hợp đồng lao động |
| **19** | `PATCH` | `/contracts/:id` | `ADMIN`, `HR` | Cập nhật hợp đồng lao động |
| **20** | `POST` | `/employees/:employeeId/documents` | `ADMIN`, `HR` | Thêm hồ sơ tài liệu cho nhân viên (metadata) |
| **21** | `GET` | `/employees/:employeeId/documents` | `ADMIN`, `HR`, `ACCOUNTANT` | Danh sách hồ sơ tài liệu của nhân viên |
| **22** | `GET` | `/documents/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | Chi tiết hồ sơ tài liệu |
| **23** | `PATCH` | `/documents/:id` | `ADMIN`, `HR` | Cập nhật hồ sơ tài liệu |
| **24** | `DELETE` | `/documents/:id` | `ADMIN`, `HR` | Xóa hồ sơ tài liệu (kèm xóa file Drive nếu có) |
| **25** | `PUT` | `/documents/:id/file` | `ADMIN`, `HR` | Upload/thay thế file đính kèm lên Google Drive |
| **26** | `DELETE` | `/documents/:id/file` | `ADMIN`, `HR` | Xóa file đính kèm trên Google Drive |
| **27** | `GET` | `/integrations/google-drive/authorize` | `ADMIN`, `HR` | Khởi tạo luồng OAuth kết nối Google Drive |
| **28** | `GET` | `/integrations/google-drive/callback` | `@Public()` | Callback OAuth Google Drive |
| **29** | `GET` | `/integrations/google-drive/connection` | `ADMIN`, `HR` | Xem trạng thái kết nối Google Drive |
| **30** | `DELETE` | `/integrations/google-drive/connection` | `ADMIN`, `HR` | Ngắt kết nối Google Drive |
| **31** | `GET` | `/settings/general` | `ADMIN`, `HR`, `ACCOUNTANT` | **MỚI** Xem cấu hình chung / thiết lập mặc định |
| **32** | `PUT` | `/settings/general` | `ADMIN` *(Chỉ Admin)* | **MỚI** Cập nhật cấu hình chung / tham số lương |
| **33** | `POST` | `/settings/general/restore-default` | `ADMIN` *(Chỉ Admin)* | **MỚI** Khôi phục cấu hình mặc định theo quy chuẩn luật |
| **34** | `POST` | `/work-shifts` | `ADMIN`, `HR` | **MỚI** Tạo mới ca làm việc (tự sinh mã `CAxx`) |
| **35** | `GET` | `/work-shifts` | `ADMIN`, `HR`, `ACCOUNTANT` | **MỚI** Danh sách ca làm việc (phân trang, tìm kiếm) |
| **36** | `GET` | `/work-shifts/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | **MỚI** Chi tiết ca làm việc kèm `workingHours` & `isOvernight` |
| **37** | `PATCH` | `/work-shifts/:id` | `ADMIN`, `HR` | **MỚI** Cập nhật ca làm việc |
| **38** | `DELETE` | `/work-shifts/:id` | `ADMIN`, `HR` | **MỚI** Xóa ca làm việc |
| **39** | `POST` | `/holidays` | `ADMIN`, `HR` | **MỚI** Tạo mới ngày nghỉ lễ |
| **40** | `GET` | `/holidays` | `ADMIN`, `HR`, `ACCOUNTANT` | **MỚI** Danh sách ngày lễ (lọc theo năm, loại lễ) |
| **41** | `GET` | `/holidays/:id` | `ADMIN`, `HR`, `ACCOUNTANT` | **MỚI** Chi tiết ngày lễ |
| **42** | `PATCH` | `/holidays/:id` | `ADMIN`, `HR` | **MỚI** Cập nhật ngày lễ |
| **43** | `DELETE` | `/holidays/:id` | `ADMIN`, `HR` | **MỚI** Xóa ngày lễ |
| **44** | `POST` | `/holidays/quick-generate` | `ADMIN`, `HR` | **MỚI** Tạo nhanh 11 ngày lễ chuẩn Việt Nam |

---

# PHẦN 3: TÀI LIỆU KỸ THUẬT CHI TIẾT 14 ENDPOINTS MỚI (CHO FRONTEND INTEGRATION)

Dành cho Agent **Frontend Engineer** tích hợp vào giao diện `cau_hinh_mac_dinh`.

### Cấu hình chung cho Client:
- **Base URL**: `http://localhost:8000` (hoặc cấu hình qua biến `VITE_API_BASE_URL`)
- **Headers bắt buộc**:
  ```http
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```

---

## 1. Phân hệ Cấu hình mặc định (`/settings/general`)

### 1.1 `GET /settings/general`
- **Mô tả**: Lấy thông tin thiết lập chung của công ty.
- **Phân quyền**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Response 200 OK**:
  ```json
  {
    "id": "DEFAULT",
    "workDayMethod": "FIXED_26",
    "saturdayPolicy": "OFF",
    "sundayPolicy": "OFF",
    "standardHoursPerDay": 8.0,
    "basePaidLeaveDays": 12,
    "seniorityYearsPerDay": 5,
    "otNormalDayPercent": 150.0,
    "otNormalNightPercent": 200.0,
    "otSundayDayPercent": 200.0,
    "otSundayNightPercent": 270.0,
    "otHolidayDayPercent": 300.0,
    "otHolidayNightPercent": 390.0,
    "otMonthlyLimitHours": 40,
    "otYearlyWarningHours": 200,
    "otYearlyLimitHours": 300,
    "baseSalary": 2340000,
    "regionMinSalary": 4960000,
    "socialInsuranceEmpPercent": 8.0,
    "healthInsuranceEmpPercent": 1.5,
    "unemploymentInsuranceEmpPercent": 1.0,
    "socialInsuranceCompPercent": 17.5,
    "healthInsuranceCompPercent": 3.0,
    "unemploymentInsuranceCompPercent": 1.0,
    "unionFeeEmpPercent": 1.0,
    "unionFeeBaseCap": 234000,
    "unionFeeCompPercent": 2.0,
    "personalDeduction": 11000000,
    "dependentDeduction": 4400000,
    "taxBrackets": [
      { "khoang": 5000000, "thueSuat": 5 },
      { "khoang": 10000000, "thueSuat": 10 },
      { "khoang": 18000000, "thueSuat": 15 },
      { "khoang": 32000000, "thueSuat": 20 },
      { "khoang": 52000000, "thueSuat": 25 },
      { "khoang": 80000000, "thueSuat": 30 },
      { "khoang": 999999999, "thueSuat": 35 }
    ],
    "createdAt": "2026-09-05T00:00:00.000Z",
    "updatedAt": "2026-09-05T00:00:00.000Z"
  }
  ```

### 1.2 `PUT /settings/general`
- **Mô tả**: Cập nhật thiết lập chung. Hỗ trợ partial update (chỉ gửi các trường cần sửa).
- **Phân quyền**: `ADMIN` (Nếu `HR` hoặc `ACCOUNTANT` gọi sẽ trả về 403 `E-hr-016`).
- **Request Body mẫu**:
  ```json
  {
    "standardHoursPerDay": 7.5,
    "baseSalary": 2500000,
    "socialInsuranceCompPercent": 18.0
  }
  ```
- **Response 200 OK**: Trả về toàn bộ object `GeneralSetting` đã cập nhật.
- **Lỗi thường gặp**:
  - `400` với mã `E-hr-027`: `standardHoursPerDay` ngoài khoảng 1–24.
  - `400` với mã `E-hr-028`: `baseSalary` hoặc `regionMinSalary` <= 0.
  - `400` với mã `E-hr-029`: `taxBrackets` có bậc sau không cao hơn bậc trước.
  - `403` với mã `E-hr-016`: Người dùng không có quyền `ADMIN`.

### 1.3 `POST /settings/general/restore-default`
- **Mô tả**: Khôi phục toàn bộ tham số về chuẩn Việt Nam (Lương cơ sở 2.340.000, 8h/ngày, 7 bậc thuế chuẩn).
- **Phân quyền**: `ADMIN`.
- **Request Body**: `{}` (rỗng).
- **Response 200 OK**: Object `GeneralSetting` sau khôi phục.

---

## 2. Phân hệ Ca làm việc (`/work-shifts`)

### 2.1 `POST /work-shifts`
- **Mô tả**: Tạo mới ca làm việc.
- **Phân quyền**: `ADMIN`, `HR`.
- **Request Body mẫu**:
  ```json
  {
    "code": "CA01", // Tuỳ chọn, nếu bỏ trống hệ thống tự sinh CA01..CA99
    "name": "Ca hành chính",
    "startTime": "08:00",
    "endTime": "17:00",
    "breakMinutes": 60,
    "status": "ACTIVE"
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "id": "7b7a1518-a6fe-4d76-880c-033878b27346",
    "code": "CA01",
    "name": "Ca hành chính",
    "startTime": "08:00",
    "endTime": "17:00",
    "breakMinutes": 60,
    "status": "ACTIVE",
    "isOvernight": false,
    "workingHours": 8.0,
    "createdAt": "2026-09-05T00:00:00.000Z",
    "updatedAt": "2026-09-05T00:00:00.000Z"
  }
  ```
- **Lỗi thường gặp**:
  - `400` `E-hr-030`: Tên ca rỗng.
  - `400` `E-hr-031`: Thiếu giờ vào/ra hoặc sai định dạng `HH:mm`.
  - `400` `E-hr-032`: `breakMinutes` < 0.
  - `409` `E-hr-033`: Mã ca đã tồn tại.

### 2.2 `GET /work-shifts`
- **Mô tả**: Lấy danh sách ca làm việc.
- **Phân quyền**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Query Params**:
  - `page`: Số trang (mặc định 1).
  - `pageSize`: Số phần tử/trang (mặc định 20).
  - `search`: Từ khóa tìm kiếm theo mã ca hoặc tên ca.
  - `status`: `ACTIVE` | `INACTIVE`.
  - `sortBy`: `code` | `name` | `startTime` | `createdAt` (mặc định `code`).
  - `sortOrder`: `asc` | `desc` (mặc định `asc`).
- **Response 200 OK**:
  ```json
  {
    "items": [
      {
        "id": "7b7a1518-a6fe-4d76-880c-033878b27346",
        "code": "CA01",
        "name": "Ca hành chính",
        "startTime": "08:00",
        "endTime": "17:00",
        "breakMinutes": 60,
        "status": "ACTIVE",
        "isOvernight": false,
        "workingHours": 8.0
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
  ```

### 2.3 `GET /work-shifts/:id`
- **Mô tả**: Xem chi tiết 1 ca làm việc.
- **Phân quyền**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Response 200 OK**: Chi tiết ca làm việc kèm `workingHours` và `isOvernight`.

### 2.4 `PATCH /work-shifts/:id`
- **Mô tả**: Cập nhật ca làm việc (Tên, giờ vào, giờ ra, phút nghỉ, status).
- **Lưu ý quan trọng**: Không hỗ trợ sửa `code` (mã ca bất biến).
- **Phân quyền**: `ADMIN`, `HR`.
- **Response 200 OK**: Chi tiết ca làm việc sau khi cập nhật.

### 2.5 `DELETE /work-shifts/:id`
- **Mô tả**: Xóa ca làm việc.
- **Phân quyền**: `ADMIN`, `HR`.
- **Response 204 No Content**: Rỗng.

---

## 3. Phân hệ Lịch ngày lễ (`/holidays`)

### 3.1 `POST /holidays`
- **Mô tả**: Tạo một ngày nghỉ lễ thủ công.
- **Phân quyền**: `ADMIN`, `HR`.
- **Request Body mẫu**:
  ```json
  {
    "date": "2026-11-20",
    "name": "Ngày Nhà giáo Việt Nam",
    "type": "COMPANY", // NATIONAL | LUNAR | COMPANY
    "isAnnual": false,
    "isPaid": true,
    "note": "Nghỉ lễ nội bộ"
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "id": "c1f7b0ef-65ba-4e92-959a-14d88e4e9301",
    "date": "2026-11-20",
    "name": "Ngày Nhà giáo Việt Nam",
    "type": "COMPANY",
    "isAnnual": false,
    "isPaid": true,
    "note": "Nghỉ lễ nội bộ",
    "createdAt": "2026-09-05T00:00:00.000Z",
    "updatedAt": "2026-09-05T00:00:00.000Z"
  }
  ```
- **Lỗi thường gặp**:
  - `400` `E-hr-034`: Tên ngày lễ hoặc ngày rỗng.
  - `400` `E-hr-035`: Chọn `type: LUNAR` nhưng bật `isAnnual: true`.
  - `409` `E-hr-036`: Trùng cặp `[date, name]` với ngày lễ đã có.

### 3.2 `POST /holidays/quick-generate`
- **Mô tả**: Tạo nhanh 11 ngày nghỉ lễ chuẩn Việt Nam theo Điều 112 BLLĐ 2019 (hỗ trợ năm 2024–2030).
- **Phân quyền**: `ADMIN`, `HR`.
- **Request Body mẫu**:
  ```json
  {
    "year": 2026 // Tuỳ chọn, mặc định lấy năm hiện tại
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "year": 2026,
    "totalStandard": 11,
    "addedCount": 11,
    "skippedCount": 0,
    "items": [
      { "date": "2026-01-01", "name": "Tết Dương lịch", "type": "NATIONAL", "isPaid": true },
      { "date": "2026-02-16", "name": "Nghỉ Tết Âm lịch (29 Tết)", "type": "LUNAR", "isPaid": true },
      { "date": "2026-02-17", "name": "Nghỉ Tết Âm lịch (30 Tết)", "type": "LUNAR", "isPaid": true },
      { "date": "2026-02-18", "name": "Tết Nguyên Đán (Mùng 1)", "type": "LUNAR", "isPaid": true },
      { "date": "2026-02-19", "name": "Tết Nguyên Đán (Mùng 2)", "type": "LUNAR", "isPaid": true },
      { "date": "2026-02-20", "name": "Tết Nguyên Đán (Mùng 3)", "type": "LUNAR", "isPaid": true },
      { "date": "2026-04-26", "name": "Giỗ Tổ Hùng Vương (10/3 Âm lịch)", "type": "LUNAR", "isPaid": true },
      { "date": "2026-04-30", "name": "Ngày Chiến thắng", "type": "NATIONAL", "isPaid": true },
      { "date": "2026-05-01", "name": "Ngày Quốc tế Lao động", "type": "NATIONAL", "isPaid": true },
      { "date": "2026-09-01", "name": "Nghỉ liền kề Quốc khánh", "type": "NATIONAL", "isPaid": true },
      { "date": "2026-09-02", "name": "Ngày Quốc khánh", "type": "NATIONAL", "isPaid": true }
    ]
  }
  ```
- **Tính Idempotent**: Nếu người dùng gọi lại nút "Tạo nhanh" nhiều lần trong cùng năm, hệ thống sẽ bỏ qua các ngày đã có (`skippedCount = 11, addedCount = 0`), không tạo bản ghi trùng lặp và không gây lỗi.

### 3.3 `GET /holidays`
- **Mô tả**: Lấy danh sách ngày lễ có phân trang và bộ lọc.
- **Phân quyền**: `ADMIN`, `HR`, `ACCOUNTANT`.
- **Query Params**:
  - `year`: Năm tra cứu (vd `2026`). Khi truyền `year`, hệ thống lọc tất cả ngày lễ diễn ra trong năm đó HOẶC các ngày quốc lễ có `isAnnual = true`.
  - `filter`: `THIS_YEAR` | `ANNUAL` | `ALL`.
  - `type`: `NATIONAL` | `LUNAR` | `COMPANY`.
  - `isPaid`: `true` | `false`.
  - `page`, `pageSize`: Mặc định 1, 50.
  - `sortBy`: `date` | `name` | `createdAt` (mặc định `date`).
  - `sortOrder`: `asc` | `desc` (mặc định `asc`).

### 3.4 `GET /holidays/:id`
- **Mô tả**: Chi tiết 1 ngày lễ.

### 3.5 `PATCH /holidays/:id`
- **Mô tả**: Cập nhật thông tin ngày lễ.
- **Phân quyền**: `ADMIN`, `HR`.

### 3.6 `DELETE /holidays/:id`
- **Mô tả**: Xóa ngày lễ khỏi hệ thống.
- **Phân quyền**: `ADMIN`, `HR`.
- **Response 204 No Content**: Rỗng.

---

## 4. Bảng mã lỗi chuẩn hóa Frontend cần xử lý

Khi nhận response lỗi (`4xx`), API luôn trả về cấu trúc chuẩn:
```json
{
  "error": {
    "code": "E-hr-xxx",
    "message": "Thông điệp lỗi chi tiết hiển thị cho người dùng",
    "details": []
  }
}
```

| Mã lỗi | HTTP Status | Trường hợp kích hoạt | Khuyến nghị hiển thị UI |
|---|:---:|---|---|
| `E-hr-016` | 403 | Vai trò `HR` hoặc `ACCOUNTANT` cố tình cập nhật cấu hình chung | Toast thông báo: *"Chỉ Quản trị viên (ADMIN) mới có quyền thay đổi thiết lập công ty."* |
| `E-hr-027` | 400 | Giờ công chuẩn/ngày không nằm trong 1–24 giờ | Validate inline tại input: *"Giờ công chuẩn phải từ 1 đến 24 giờ."* |
| `E-hr-028` | 400 | Lương cơ sở hoặc lương tối thiểu vùng <= 0 | Validate inline tại input: *"Mức lương phải lớn hơn 0 VNĐ."* |
| `E-hr-029` | 400 | Thuế suất bậc thuế TNCN sau không cao hơn bậc trước | Báo lỗi tại bảng thuế: *"Thuế suất bậc sau phải lớn hơn bậc trước."* |
| `E-hr-030` | 400 | Tên ca làm việc rỗng | Validate inline tại modal: *"Vui lòng nhập tên ca làm việc."* |
| `E-hr-031` | 400 | Giờ vào hoặc giờ ra không đúng định dạng `HH:mm` | Validate inline tại TimePicker: *"Giờ vào và giờ ra là bắt buộc."* |
| `E-hr-032` | 400 | Phút nghỉ giữa ca là số âm | Validate inline: *"Thời gian nghỉ không được là số âm."* |
| `E-hr-033` | 409 | Trùng mã ca làm việc | Báo lỗi modal: *"Mã ca làm việc này đã tồn tại, vui lòng chọn mã khác."* |
| `E-hr-034` | 400 | Tên ngày lễ hoặc ngày rỗng | Validate inline tại Form: *"Vui lòng nhập đầy đủ tên và ngày lễ."* |
| `E-hr-035` | 400 | Lễ âm lịch nhưng lại bật cờ lặp hàng năm theo dương lịch | Toast cảnh báo: *"Ngày lễ theo âm lịch không thể lặp lại theo dương lịch."* |
| `E-hr-036` | 409 | Đã tồn tại ngày lễ cùng tên trong cùng ngày | Báo lỗi modal: *"Ngày này đã có ngày lễ cùng tên trong lịch."* |

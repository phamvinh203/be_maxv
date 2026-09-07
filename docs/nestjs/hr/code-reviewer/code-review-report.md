# BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN (CODE REVIEW REPORT) — ĐỢT 5
## Phân hệ: HR Master Data — Cấu hình mặc định, Ca làm việc & Lịch ngày lễ

- **Người thực hiện**: Agent Code-Reviewer
- **Thời gian đánh giá**: 2026-09-05
- **Mã đợt review**: CR-HR-PHASE-5
- **Trạng thái phê duyệt**: ✅ **APPROVED (CHẤP THUẬN MERGE & TIẾP TỤC BƯỚC TIẾP THEO)**
- **Mức độ rủi ro**: **Thấp (Low Risk)**
- **Số lượng Blockers**: **0**

---

## 1. Bảng tổng hợp các file sửa đổi / tạo mới và lý do kỹ thuật (Why & What)

Dưới đây là thống kê chi tiết từng file mã nguồn và tài liệu trong đợt triển khai, kèm lý do kỹ thuật bắt buộc phải chỉnh sửa hoặc tạo mới:

### 1.1 Cơ sở dữ liệu & Cấu hình Migration (`Backend/prisma`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 1 | [`Backend/prisma/schema.prisma`](file:///c:/Users/Admin/Desktop/project/Backend/prisma/schema.prisma) | **MODIFIED** | **Lý do**: Khai báo 4 enums mới (`WorkDayMethod`, `DayPolicy`, `ShiftStatus`, `HolidayType`) và 3 models mới (`GeneralSetting`, `WorkShift`, `Holiday`) theo ADR-005 và Data Model Mục 15–17. Thiết lập ràng buộc duy nhất `[date, name]` trên `Holiday` và trường `taxBrackets` dạng `Json @db.JsonB`. |
| 2 | `Backend/prisma/migrations/20260905144810_add_settings_work_shifts_holidays/` | **NEW** | **Lý do**: Migration DDL tự động sinh từ Prisma CLI (`prisma migrate dev`) để tạo bảng vật lý, index và constraints trên PostgreSQL container thật (port 5435). |
| 3 | [`Backend/prisma/seed.ts`](file:///c:/Users/Admin/Desktop/project/Backend/prisma/seed.ts) | **MODIFIED** | **Lý do**: Khởi tạo dữ liệu gốc cho môi trường phát triển: tạo bản ghi singleton `DEFAULT` với các tham số lương, công, bảo hiểm chuẩn Việt Nam và 4 ca làm việc mẫu (`CA01` - Hành chính, `CA02` - Sáng, `CA03` - Chiều, `CA04` - Đêm). |

---

### 1.2 Mã lỗi nền tảng & Tiện ích dùng chung (`Backend/src/common`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 4 | [`Backend/src/common/hr-errors.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/common/hr-errors.ts) | **MODIFIED** | **Lý do**: Bổ sung 10 mã lỗi chuẩn hóa mới (`E-hr-027` đến `E-hr-036`) theo đặc tả SRS Mục 6.6–6.8; đồng thời mở rộng hàm `hrNotFound()` để ném lỗi chuẩn 404 cho `'ca làm việc'` và `'ngày lễ'`. |

---

### 1.3 Submodule Cấu hình mặc định (`Backend/src/hr/settings`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 5 | [`dto/update-general-setting.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/settings/dto/update-general-setting.schema.ts) | **NEW** | **Lý do**: Định nghĩa schema Zod xác thực payload cập nhật cấu hình; sử dụng `.strict()` chống parameter tampering; kiểm tra lũy tiến biểu thuế TNCN (bậc sau > bậc trước -> `E-hr-029`) và giá trị biên (giờ công 1–24h -> `E-hr-027`, lương cơ sở/vùng > 0 -> `E-hr-028`). |
| 6 | [`general-settings.service.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/settings/general-settings.service.ts) | **NEW** | **Lý do**: Cung cấp nghiệp vụ quản lý singleton `id = 'DEFAULT'`; cơ chế tự khởi tạo nếu chưa có bản ghi (self-healing); hỗ trợ cập nhật từng phần (partial update); khôi phục về tham số chuẩn theo Bộ luật Lao động 2019 / NQ 954. |
| 7 | [`general-settings.controller.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/settings/general-settings.controller.ts) | **NEW** | **Lý do**: Khai báo 3 endpoints: `GET /settings/general` (Roles: `ADMIN`, `HR`, `ACCOUNTANT`), `PUT /settings/general` (Role: `ADMIN` only theo AC-hr-22), `POST /settings/general/restore-default` (Role: `ADMIN` only, trả mã 200). |
| 8 | [`general-settings.service.spec.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/settings/general-settings.service.spec.ts) | **NEW** | **Lý do**: Bộ kiểm thử đơn vị (Unit tests) cô lập với PrismaService mock, xác minh logic singleton, cập nhật biểu thuế và khôi phục mặc định. |

---

### 1.4 Submodule Ca làm việc (`Backend/src/hr/work-shifts`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 9 | [`dto/create-work-shift.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/work-shifts/dto/create-work-shift.schema.ts) | **NEW** | **Lý do**: Validate payload tạo ca: kiểm tra định dạng giờ `HH:mm` (`E-hr-031`), tên ca không rỗng (`E-hr-030`), phút nghỉ không âm (`E-hr-032`). Cho phép `code` tuỳ chọn để hỗ trợ tự sinh. |
| 10 | [`dto/update-work-shift.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/work-shifts/dto/update-work-shift.schema.ts) | **NEW** | **Lý do**: Validate payload cập nhật ca. Áp dụng `.strict()` và **CỐ TÌNH LOẠI BỎ trường `code`** để thực thi quy tắc bất biến mã ca theo `BR-hr-023`. |
| 11 | [`dto/list-work-shifts-query.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/work-shifts/dto/list-work-shifts-query.schema.ts) | **NEW** | **Lý do**: Validate query parameters khi lấy danh sách ca làm việc: `page`, `pageSize`, `search`, `status`, `sortBy`, `sortOrder`. |
| 12 | [`work-shifts.service.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/work-shifts/work-shifts.service.ts) | **NEW** | **Lý do**: Xử lý logic nghiệp vụ ca làm việc: tự động sinh mã ca `CA01`..`CA99` quét tìm số trống đầu tiên; tính toán động `workingHours` (khấu trừ `breakMinutes`, clamp không âm) và `isOvernight` (nhận diện ca qua nửa đêm); bắt lỗi trùng mã `P2002` -> `E-hr-033`. |
| 13 | [`work-shifts.controller.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/work-shifts/work-shifts.controller.ts) | **NEW** | **Lý do**: Khai báo 5 RESTful endpoints CRUD cho Ca làm việc; áp dụng `JwtAuthGuard` và `RolesGuard` với ma trận phân quyền phù hợp. |
| 14 | [`work-shifts.service.spec.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/work-shifts/work-shifts.service.spec.ts) | **NEW** | **Lý do**: Unit tests kiểm tra thuật toán tính giờ công ca ngày, ca đêm, ca 24 tiếng, ca nghỉ vượt giờ và tính năng sinh mã tuần tự. |

---

### 1.5 Submodule Lịch ngày lễ (`Backend/src/hr/holidays`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 15 | [`vietnam-holidays.util.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/vietnam-holidays.util.ts) | **NEW** | **Lý do**: Cung cấp hàm `getStandardVietnamHolidays(year)` tích hợp bảng tra âm lịch chính xác cho Tết Nguyên Đán và Giỗ Tổ Hùng Vương giai đoạn 2024–2030 theo Điều 112 BLLĐ 2019. |
| 16 | [`dto/create-holiday.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/dto/create-holiday.schema.ts) | **NEW** | **Lý do**: Validate tạo ngày lễ: format ngày `YYYY-MM-DD`, tên lễ (`E-hr-034`), cấm bật `isAnnual: true` nếu là lễ âm lịch `LUNAR` (`BR-hr-026`, `E-hr-035`). |
| 17 | [`dto/update-holiday.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/dto/update-holiday.schema.ts) | **NEW** | **Lý do**: Validate cập nhật ngày lễ, duy trì kiểm tra tính nhất quán giữa loại lễ âm lịch và cờ lặp hàng năm. |
| 18 | [`dto/list-holidays-query.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/dto/list-holidays-query.schema.ts) | **NEW** | **Lý do**: Validate query parameters danh sách ngày lễ: `year`, `filter` (`THIS_YEAR`, `ANNUAL`, `ALL`), `type`, `isPaid`, phân trang. |
| 19 | [`dto/quick-generate-holiday.schema.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/dto/quick-generate-holiday.schema.ts) | **NEW** | **Lý do**: Validate năm yêu cầu tạo nhanh, chặn nghiêm ngặt các năm ngoài khoảng 2024–2030. |
| 20 | [`holidays.service.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/holidays.service.ts) | **NEW** | **Lý do**: CRUD ngày lễ, format ngày dạng chuẩn ISO `YYYY-MM-DD`, thực thi tính năng tạo nhanh idempotent (bỏ qua ngày đã có, chỉ thêm ngày còn thiếu). Bắt lỗi trùng `P2002` -> `E-hr-036`. |
| 21 | [`holidays.controller.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/holidays.controller.ts) | **NEW** | **Lý do**: Khai báo 6 endpoints ngày lễ gồm CRUD và `POST /holidays/quick-generate`. |
| 22 | [`holidays.service.spec.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/holidays/holidays.service.spec.ts) | **NEW** | **Lý do**: Unit tests kiểm tra CRUD và tính idempotent của hàm tạo nhanh. |

---

### 1.6 Aggregate Module & Kiểm thử End-to-End (`Backend`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 23 | [`Backend/src/hr/hr.module.ts`](file:///c:/Users/Admin/Desktop/project/Backend/src/hr/hr.module.ts) | **MODIFIED** | **Lý do**: Khai báo 3 controllers mới (`GeneralSettingsController`, `WorkShiftsController`, `HolidaysController`) và 3 providers mới vào NestJS DI container của `HrModule`. |
| 24 | [`Backend/test/settings-shifts-holidays.e2e-spec.ts`](file:///c:/Users/Admin/Desktop/project/Backend/test/settings-shifts-holidays.e2e-spec.ts) | **NEW** | **Lý do**: Bộ kiểm thử E2E tích hợp chạy trên PostgreSQL thật (port 5435), bao phủ toàn diện 25 test cases: giá trị biên, fuzzing, kịch bản ca đặc thù, idempotency và ma trận phân quyền 4 vai trò + 401 unauthenticated. |

---

### 1.7 Tài liệu phân tích, kiến trúc & bàn giao (`docs/hr/`)

| STT | Đường dẫn file | Trạng thái | Tại sao phải tạo/sửa đổi? |
|:---:|---|:---:|---|
| 25 | [`docs/hr/srs/hr-spec.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/srs/hr-spec.md) | **MODIFIED** | **Lý do**: Bổ sung đặc tả nghiệp vụ Mục 6.6–6.8 (`BR-hr-019..028`, `FR-hr-024..033`, `E-hr-027..036`, `AC-hr-18..22`). |
| 26 | [`docs/hr/architecture/adr/ADR-005-...`](file:///c:/Users/Admin/Desktop/project/docs/hr/architecture/adr/ADR-005-settings-and-work-schedule-foundations.md) | **NEW** | **Lý do**: Lưu vết quyết định kiến trúc: Singleton `DEFAULT`, tự sinh mã ca, tính toán động và bảng tra âm lịch 2024–2030. |
| 27 | [`docs/hr/architecture/hr-data-model.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/architecture/hr-data-model.md) | **MODIFIED** | **Lý do**: Bổ sung sơ đồ thực thể Mục 15–18, kiểu dữ liệu, ràng buộc unique và giải thích chi tiết `taxBrackets` JsonB. |
| 28 | [`docs/hr/architecture/hr-api-contract.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/architecture/hr-api-contract.md) | **MODIFIED** | **Lý do**: Bổ sung đặc tả 14 API endpoints (Mục 13–15, endpoints 31–44) kèm request/response mẫu. |
| 29 | [`docs/hr/architecture/hr-architecture.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/architecture/hr-architecture.md) | **MODIFIED** | **Lý do**: Cập nhật cây thư mục kiến trúc tổng thể và ranh giới bounded context. |
| 30 | [`docs/hr/plan/backend-settings-shifts-holidays-plan.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/plan/backend-settings-shifts-holidays-plan.md) | **NEW** | **Lý do**: Lưu trữ kế hoạch kỹ thuật chi tiết của Đợt 5 phục vụ truy vết. |
| 31 | [`docs/hr/tester-qa/qa-report-settings-shifts-holidays.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/tester-qa/qa-report-settings-shifts-holidays.md) | **NEW** | **Lý do**: Báo cáo nghiệm thu chất lượng của Tester-QA kèm ma trận RTM và chỉ số kiểm thử. |
| 32 | [`docs/hr/api_docs/walkthrough-and-api-docs.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/api_docs/walkthrough-and-api-docs.md) | **NEW** | **Lý do**: Báo cáo Walkthrough tổng hợp và tài liệu đặc tả 44 API của module HR cho Frontend Developer. |
| 33 | [`docs/hr/CONTEXT_SUMMARY.md`](file:///c:/Users/Admin/Desktop/project/docs/hr/CONTEXT_SUMMARY.md) | **MODIFIED** | **Lý do**: Cập nhật trạng thái bộ nhớ làm việc của dự án, đánh dấu hoàn thành cho cả 3 thực thể mới. |

---

## 2. Đánh giá chuyên sâu về chất lượng mã nguồn (Technical Audit)

### 2.1 Tính đúng đắn & Tuân thủ nghiệp vụ (Correctness)
- ✅ **Singleton Self-healing**: `GeneralSettingsService#getSettings` sử dụng cơ chế tìm bản ghi `DEFAULT`, nếu rỗng tự động gọi `create(DEFAULT_GENERAL_SETTING)`. Điều này ngăn ngừa lỗi 404 hoặc crash hệ thống ngay cả khi cơ sở dữ liệu chưa được chạy seed.
- ✅ **Tính giờ công & ca qua đêm chính xác**:
  - Thuật toán `computeShiftFields` xử lý ca qua đêm (`endTime <= startTime`) bằng công thức `1440 - startTotal + endTotal`, đảm bảo tính đúng cho ca xuyên đêm (22:00 -> 06:00 = 8h, 23:30 -> 00:30 = 1h).
  - Sử dụng `Math.max(0, totalDuration - shift.breakMinutes)` ngăn chặn hoàn toàn trường hợp số giờ công bị âm khi người dùng cấu hình thời gian nghỉ lớn hơn độ dài ca.
- ✅ **Tạo nhanh ngày lễ Idempotent**:
  - `HolidaysService#quickGenerate` sử dụng phép tra cứu theo khóa kết hợp `date_name: { date, name }` để phân tách ngày đã có và ngày còn thiếu. Khi người dùng click nút "Tạo nhanh" nhiều lần, hệ thống không tạo trùng lặp và không ném lỗi 500.

### 2.2 Bảo mật & Phân quyền (Security & RBAC)
- ✅ **Nguyên tắc đặc quyền tối thiểu (Least Privilege)**:
  - `PUT /settings/general` và `POST /settings/general/restore-default` được bảo vệ độc quyền bởi `@Roles(Role.ADMIN)`. `HR` và `ACCOUNTANT` hoàn toàn không có quyền sửa đổi tham số tài chính công ty (AC-hr-22).
  - `EMPLOYEE` bị chặn đứng tại `RolesGuard` với mã lỗi 403 trên toàn bộ 14 endpoints.
- ✅ **Chống Parameter Tampering & Mass Assignment**:
  - Tất cả các DTO cập nhật (`updateGeneralSettingSchema`, `updateWorkShiftSchema`, `updateHolidaySchema`) đều được gắn `.strict()`. Bất kỳ trường lạ nào được gửi lên đều bị Zod Pipe từ chối với mã lỗi 400.
  - Trường `code` trong `WorkShift` đã bị loại bỏ khỏi `updateWorkShiftSchema`, ngăn chặn triệt để nguy cơ client sửa đổi mã ca làm ảnh hưởng đến dữ liệu chấm công lịch sử (`BR-hr-023`).

### 2.3 Khả năng bảo trì & Cấu trúc mã (Maintainability)
- ✅ **Tách bạch tầng trách nhiệm (Separation of Concerns)**:
  - `Controller`: Chỉ nhận request, bọc `HrZodValidationPipe`, phân quyền và chuyển tiếp xuống service.
  - `Service`: Xử lý nghiệp vụ thuần túy, tương tác Prisma và bắt `P2002` để dịch sang mã lỗi nghiệp vụ chuẩn `E-hr-xxx`.
  - `DTO Schema`: Độc lập, có thể tái sử dụng hoặc chia sẻ với frontend.
- ✅ **Format ngày tháng nhất quán**:
  - Trong `HolidaysService`, helper `transformHoliday` chuẩn hóa thuộc tính `date` thành chuỗi ISO `YYYY-MM-DD` trước khi trả về cho client, giúp frontend không bị lệch múi giờ UTC+0 khi parse ngày.

### 2.4 Hiệu năng & Cơ sở dữ liệu (Performance & DB Indexing)
- ✅ **Index duy nhất hiệu quả**:
  - `WorkShift.code` được gắn `@unique @db.VarChar(20)` -> PostgreSQL tự động tạo B-Tree index duy nhất.
  - `Holiday` được gắn `@@unique([date, name])` -> PostgreSQL tạo Composite Index trên 2 cột `date` và `name`, tối ưu hóa cả phép truy vấn lọc theo ngày và chống trùng lặp.
- ✅ **Thuật toán sinh mã tuần tự**:
  - `WorkShiftsService#generateNextCode` sử dụng `select: { code: true }` để chỉ tải duy nhất cột mã ca về bộ nhớ, sau đó sử dụng `Set` để quét số nguyên còn trống trong phạm vi 1–99. Thao tác này có độ phức tạp $O(N)$ với $N \le 99$, thực thi trong dưới 1ms.

---

## 3. Phân loại góp ý & Đề xuất cải tiến (Findings & Suggestions)

### 🔴 Blockers (Lỗi chặn - Bắt buộc fix trước khi release)
- **KHÔNG CÓ (0 Blockers)**. Không phát hiện lỗ hổng bảo mật, rò rỉ dữ liệu hoặc lỗi vi phạm kiến trúc.

### 🟡 Suggestions (Đề xuất tối ưu dài hạn - Không ảnh hưởng hiện tại)
1. **Kiểu dữ liệu mảng trả về trong `quickGenerate`**:
   - *Vị trí*: `Backend/src/hr/holidays/holidays.service.ts` dòng 139:
     ```typescript
     const addedItems: any[] = [];
     ```
   - *Đề xuất*: Thay vì khai báo `any[]`, có thể khai báo kiểu rõ ràng `Array<StandardHolidayDefinition | Holiday>` hoặc kiểu trả về của `transformHoliday` để tăng tính type-safety của TypeScript.
2. **Indexing bổ sung cho bảng `Holiday`**:
   - *Hiện tại*: Đã có composite index `[date, name]`.
   - *Đề xuất*: Khi hệ thống hoạt động nhiều năm và có hàng nghìn ngày lễ, nếu các truy vấn `GET /holidays?filter=ANNUAL` diễn ra thường xuyên, có thể cân nhắc thêm index riêng cho cột `is_annual` (`@@index([isAnnual])`). Hiện tại với số lượng ngày lễ ít (< 100 bản ghi/năm), index hiện có đã hoạt động tối ưu.

### 💭 Nits (Điểm tinh chỉnh phong cách)
- Trích xuất hằng số `MAX_WORK_SHIFTS = 99` và tiền tố ca `'CA'` thành file constants dùng chung giữa `WorkShiftsService` và `vietnam-holidays.util.ts`.

---

## 4. Khen ngợi giải pháp thiết kế xuất sắc (Commendations)

1. **Kiến trúc Bất biến của `WorkShift.code`**: Thiết kế loại bỏ `code` khỏi DTO update kết hợp với Zod `.strict()` là một mẫu mực về bảo vệ tính toàn vẹn dữ liệu từ tầng API mà không cần viết thêm câu lệnh `if-else` phức tạp trong service.
2. **Cơ chế Idempotent của `quickGenerate`**: Việc kiểm tra và chỉ tạo mới những ngày chưa có giúp trải nghiệm người dùng rất an toàn, có thể bấm nhiều lần mà không sợ sinh dữ liệu rác.
3. **Bộ kiểm thử E2E mẫu mực**: 25 bài kiểm thử E2E chạy trên PostgreSQL thật bao phủ từ giá trị biên nhỏ nhất (`1.0h`, `baseSalary: 1`) đến ma trận phân quyền 4 vai trò, giúp phát hiện sớm các lỗi sai lệch tên thuộc tính trước khi bàn giao cho Frontend.

---

## 5. Kết luận & Khuyến nghị chuyển giao

> **CODE REVIEW RESULT: APPROVED (100% ĐẠT TIÊU CHUẨN KỸ THUẬT)**
>
> Toàn bộ mã nguồn Đợt 5 đạt chất lượng cao, cấu trúc sạch sẽ, tuân thủ nghiêm ngặt các ADR và tiêu chí nghiệm thu của SRS. 

### Bước tiếp theo trong Pipeline:
Pipeline phát triển phần mềm đã hoàn tất các vai trò:
`business-analyst` $\rightarrow$ `software-architect` $\rightarrow$ `backend-engineer` $\rightarrow$ `tester-qa` $\rightarrow$ `code-reviewer` (Hoàn tất!).

👉 **Sẵn sàng chuyển giao cho Agent `frontend-engineer`** để:
- Thay thế các mock hook (`useCauHinh`, `useNgayLe`, `store.ts`) tại `C:\Users\Admin\Desktop\maxv_v2\hdđt_maxv\src\features\hrm\components\cau_hinh_mac_dinh` bằng các API client gọi vào 14 endpoints backend vừa hoàn thành.
- Hoặc thực hiện commit toàn bộ mã nguồn lên Git branch `dev`.

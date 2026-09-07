---
type: adr
feature: hr
status: accepted
updated: 2026-09-05
---

# ADR-005 — Thiết kế kỹ thuật Cấu hình mặc định, Ca làm việc và Lịch ngày lễ

## Context

Đợt phân tích mới (SRS Mục 6.6, 6.7, 6.8; BR-hr-019..028; FR-hr-024..033) bổ sung 3 thực thể nền tảng cho phân hệ HR:
1. **Cấu hình mặc định (`GeneralSetting`)**: Hơn 30 tham số quy định ngày công chuẩn, giờ công, chính sách nghỉ tuần, tỷ lệ bảo hiểm, công đoàn, mức giảm trừ gia cảnh và biểu thuế TNCN 5 bậc. Có chức năng khôi phục mặc định ban đầu.
2. **Ca làm việc (`WorkShift`)**: Quản lý danh mục ca (mã tự sinh `CA01`-`CA99`), giờ vào/ra, nghỉ giữa ca, nhận diện ca qua đêm và tự tính số giờ công thực tế.
3. **Lịch ngày lễ (`Holiday`)**: Quản lý các ngày nghỉ lễ trong năm, chu kỳ lặp hàng năm (chỉ áp dụng cho lễ dương lịch), cờ có lương, và tính năng "Tạo nhanh" 11 ngày lễ chuẩn Việt Nam theo Điều 112 BLLĐ 2019 tự động lọc trùng.

Cần đưa ra các quyết định kiến trúc cốt lõi:
- Mô hình lưu trữ cho cấu hình toàn công ty (Singleton pattern).
- Cấu trúc lưu trữ biểu thuế lũy tiến TNCN (bảng con quan hệ hay JSONB).
- Chiến lược sinh mã ca làm việc và tính toán thuộc tính suy ra (ca qua đêm, số giờ công).
- Chiến lược sinh lịch ngày lễ chuẩn và tra cứu ngày âm lịch.

## Decision

### 1. Singleton pattern cho `GeneralSetting` bằng khóa định danh cố định
- Bảng `general_settings` trong PostgreSQL sử dụng khóa chính cố định: `id = "DEFAULT"`.
- Thao tác đọc (`GET /settings/general`) truy vấn qua `findUnique({ where: { id: "DEFAULT" } })`. Nếu DB chưa có bản ghi (lần đầu triển khai), hệ thống tự động khởi tạo bằng bộ giá trị chuẩn luật Việt Nam (`upsert`).
- Thao tác cập nhật (`PUT /settings/general`) và khôi phục (`POST /settings/general/restore-default`) dùng `upsert` với `where: { id: "DEFAULT" }`.
- **Độ sẵn sàng mở rộng**: Khi doanh nghiệp cần đa chi nhánh / đa pháp nhân trong tương lai (OQ-hr-29), `id` có thể chuyển thành `tenantId` hoặc `branchId` mà không cần đập đi xây lại cấu trúc trường dữ liệu.

### 2. Lưu trữ Biểu thuế TNCN dưới dạng JSONB (`taxBrackets: Json`)
- Thay vì tạo thêm bảng quan hệ `tax_brackets` với khóa ngoại nối về `general_settings`, trường `taxBrackets` được định nghĩa kiểu `Json` (`@db.JsonB` trên Postgres).
- Định dạng mảng: `[{ khoang: number, thueSuat: number }]`.
- **Lý do**:
  - Dữ liệu bậc thuế luôn được đọc và ghi đồng thời cùng toàn bộ cấu hình (1 payload duy nhất).
  - Không có nhu cầu query/join độc lập từng bậc thuế từ bảng khác.
  - Hỗ trợ linh hoạt $N$ bậc thuế (giải quyết triệt để OQ-hr-28: hỗ trợ được cả biểu 5 bậc theo dự thảo lẫn biểu 7 bậc theo luật thuế TNCN hiện hành mà không cần migrate schema DB).
  - Ràng buộc lũy tiến (`thue_suat[i] > thue_suat[i-1]`, BR-hr-022) được validate chặt chẽ ở tầng NestJS DTO validator (class-validator / custom validator) trước khi lưu.

### 3. Ca làm việc (`WorkShift`): Sinh mã tự động & Computed Properties
- **Mã ca**: Sinh tự động dạng `CA` + 2 số (`CA01` đến `CA99`). Vì số lượng ca của doanh nghiệp vừa và nhỏ thường dưới 50 ca, việc sinh mã sử dụng thuật toán quét các mã đã dùng trong bảng `work_shifts` để tìm số nhỏ nhất còn trống (first available gap) — tương tự logic frontend mock, không cần tạo Postgres sequence riêng như Mã nhân viên (ADR-001) vì tần suất tạo ca làm việc rất thấp (vài lần/năm) và số lượng bản ghi rất nhỏ.
- **Thuộc tính suy ra**:
  - `isOvernight` (`gio_ra <= gio_vao`) và `workingHours` (`(tổng phút làm - phút nghỉ) / 60`) được tính toán ở tầng Application / Service và gắn vào Response DTO khi trả về client.
  - Không lưu cột thừa trong DB để đảm bảo nguyên tắc chuẩn hóa dữ liệu, tránh bất nhất khi người dùng cập nhật giờ vào/ra.

### 4. Lịch ngày lễ (`Holiday`): Unique Constraint & Idempotent Quick Generate
- Ràng buộc duy nhất: `@@unique([date, name])` trên PostgreSQL (BR-hr-027), ngăn ngừa việc trùng ngày và tên lễ.
- Ràng buộc âm lịch: Validate ở DTO/Service nếu `type === "LUNAR"` thì ép `isAnnual = false` (BR-hr-026).
- **Tính năng "Tạo nhanh" (`POST /holidays/quick-generate`)**:
  - Tích hợp module tra cứu âm lịch tĩnh hỗ trợ từ năm 2024 đến 2030 (A-hr-17) cho Tết Nguyên đán (5 ngày) và Giỗ Tổ Hùng Vương (1 ngày), kết hợp 5 ngày lễ dương lịch cố định (01/01, 30/04, 01/05, 02/09, 03/09).
  - Sử dụng `prisma.holiday.createMany({ data: newHolidays, skipDuplicates: true })` — đảm bảo tính Idempotent (chạy nhiều lần không gây lỗi, chỉ chèn các bản ghi còn thiếu theo BR-hr-028).

## Alternatives

| Vấn đề | Phương án chọn | Phương án thay thế | Lý do từ chối phương án thay thế |
|---|---|---|---|
| Lưu Singleton | Record cố định `id: "DEFAULT"` | Bảng KV (key-value) hoặc biến môi trường .env | Bảng KV làm mất type-safety của Prisma và khó validate cấu trúc phức tạp; file .env không cho phép thay đổi động qua giao diện quản trị |
| Biểu thuế TNCN | `Json @db.JsonB` | Bảng quan hệ phụ `tax_brackets (setting_id FK)` | Over-engineering, tăng số câu lệnh join khi đọc và cần transaction xoá/tạo lại các dòng bậc thuế khi cập nhật |
| Sinh mã ca | Quét gap trong bảng (CA01..CA99) | Postgres sequence | Không cần thiết cho danh mục dưới 100 bản ghi, tạo sequence riêng gây cồng kềnh hạ tầng migration |
| Tính giờ ca | Tính động trong Application DTO | Cột Generated Column / Stored column | Logic giờ qua đêm và nghỉ giữa ca đơn giản, xử lý ở code TypeScript giúp dễ test unit và linh hoạt định dạng hiển thị |

## Trade-offs

- **Lợi ích**:
  - Triển khai nhanh, gọn gàng, phù hợp hoàn hảo với kiến trúc Modular Monolith hiện tại của backend NestJS + Prisma.
  - Type-safe hoàn toàn, tương thích 1-1 với frontend mock đã có.
  - Cấu trúc JSONB cho bậc thuế giúp hệ thống sẵn sàng thích ứng với mọi thay đổi luật thuế trong tương lai mà không cần can thiệp DB schema.
- **Rủi ro & Biện pháp khắc phục**:
  - Dữ liệu âm lịch chỉ có sẵn từ 2024 đến 2030: Đã ghi nhận rõ trong Assumption A-hr-17; khi sang thập kỷ tiếp theo có thể bổ sung bảng tra hoặc tích hợp thuật toán chuyển đổi âm dương hoàn chỉnh.

## Consequences

- Cần thêm 3 model (`GeneralSetting`, `WorkShift`, `Holiday`) và 4 enum (`WorkDayMethod`, `DayPolicy`, `ShiftStatus`, `HolidayType`) vào `Backend/prisma/schema.prisma`.
- Cần tạo migration Prisma mới `add_settings_work_shifts_holidays`.
- Seed ban đầu (`prisma/seed.ts`) sẽ tự động nạp `GeneralSetting` mặc định theo đúng chuẩn BLLĐ 2019 và danh sách ca làm việc mẫu.

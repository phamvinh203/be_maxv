---
type: adr
feature: hr
status: accepted
updated: 2026-09-05
---

# ADR-002 — Chống chồng lấn ngày hiệu lực Hợp đồng (BR-hr-013)

## Context

Sau khi tách "Hợp đồng" thành entity `Contract` riêng có lịch sử (A-hr-6, `hr-spec.md` Mục 6.4), BR-hr-013 yêu cầu: "hệ thống từ chối tạo hoặc sửa một Hợp đồng nếu khoảng [Ngày bắt đầu, Ngày kết thúc] của hợp đồng đó chồng lấn với khoảng thời gian của bất kỳ Hợp đồng nào khác đã có của CÙNG một Nhân viên (Ngày kết thúc bỏ trống được coi là tới vô cực khi kiểm tra chồng lấn)". Đây là ràng buộc **đa-bản-ghi** (so 1 khoảng ngày với TẤT CẢ bản ghi khác cùng `employeeId`) — khác các FK/unique đơn giản đã có trong module (BR-hr-002, BR-hr-008), và có nguy cơ race condition thật: 2 request tạo/gia hạn Hợp đồng đồng thời cho CÙNG một Nhân viên với khoảng ngày chồng nhau đều có thể đọc "chưa có gì chồng lấn" trước khi cả hai cùng ghi — tạo ra 2 Hợp đồng chồng lấn thật sự trong DB nếu chỉ dựa vào kiểm tra ở tầng ứng dụng.

`hr-architecture.md` Mục 5 đã xác lập nguyên tắc: "toàn vẹn dữ liệu do ràng buộc khai báo ở tầng database đảm bảo — đây là nguồn đúng cuối cùng chống race condition... KHÔNG phải câu lệnh SELECT kiểm tra trước ở service." Nguyên tắc này đã được áp dụng nhất quán cho BR-hr-002 (FK) và BR-hr-008 (FK `Restrict` + pre-check). Câu hỏi đặt ra: BR-hr-013 có xứng đáng một cơ chế DB-level tương đương, hay chỉ cần pre-check service-layer (như đã cân nhắc, tham khảo cách BR-hr-002/BR-hr-008 dùng)?

## Decision

**Kết hợp 2 lớp, đúng tinh thần đã dùng cho BR-hr-008:**

1. **Service-layer pre-check (Rule 1, nhanh, thông báo rõ):** trước khi `INSERT`/`UPDATE` một `Contract`, service truy vấn toàn bộ Hợp đồng KHÁC của cùng `employeeId` (loại trừ chính bản ghi đang sửa nếu là update), so khoảng `[effectiveFrom, effectiveTo ?? +∞]` có giao nhau không. Có → `E-hr-020` (400) ngay, không cần round-trip DB thô.
2. **Postgres `EXCLUDE` constraint (lớp bảo vệ THẬT, race-condition-safe):**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_no_overlap"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[]') WITH &&
  );
```

`EXCLUDE USING gist` là tính năng Postgres chuyên dụng cho đúng lớp bài toán "không cho phép 2 hàng có cùng khoá X VÀ khoảng giá trị Y giao nhau" — khớp 1-1 với BR-hr-013 (khoá = `employeeId`, khoảng = `daterange`). `btree_gist` (extension chuẩn trong `contrib` của Postgres, không phải extension lạ/bên thứ 3) cần thiết để dùng toán tử `=` trên cột `uuid` bên trong 1 GiST index (mặc định GiST chỉ hỗ trợ toán tử khoảng/hình học, `btree_gist` bổ sung toán tử so sánh chuẩn cho kiểu dữ liệu vô hướng).

Vi phạm constraint này (2 request đua nhau, cả hai pass pre-check, cả hai cùng `INSERT`) khiến Postgres từ chối 1 trong 2 câu lệnh — Backend Engineer bắt lỗi DB tương ứng và trả `E-hr-020` giống hệt pre-check (xem `hr-api-contract.md` Mục 5, ghi chú bắt lỗi cuối Mục 5).

**Cập nhật 2026-09-05 (verify bằng test tích hợp thật, `Backend/test/contracts.e2e-spec.ts`):** dự đoán ban đầu ở Mục Consequences (mã Prisma `P2004`) SAI trong thực tế. Qua driver adapter `@prisma/adapter-pg` đang dùng, vi phạm `EXCLUDE` constraint trả về `PrismaClientKnownRequestError` code **`P2039`** ("Database error" generic), với SQLSTATE gốc `23P01` nằm sâu trong `error.meta.driverAdapterError.cause.originalCode` — không phải `P2004` như tài liệu Prisma gợi ý ở thời điểm viết ADR này. Hành vi cuối vẫn ĐÚNG (trả `E-hr-020`) vì `ContractsService` đã có sẵn lớp dự phòng đối chiếu tên constraint (`contracts_no_overlap`) trong `error.message` thay vì chỉ dựa vào `error.code` — đây mới là cơ chế bắt lỗi THẬT SỰ hoạt động, không phải `error.code === 'P2004'`.

## Alternatives

| Phương án | Mô tả | Ưu | Nhược | Kết luận |
|---|---|---|---|---|
| **A. Service pre-check + `EXCLUDE` constraint (2 lớp)** ✓ | Như Decision | Đúng cả 2 mục tiêu: UX nhanh cho 99% trường hợp (lỗi nhập liệu thật) + correctness tuyệt đối dưới concurrency (1% trường hợp race) cho một rule ảnh hưởng trực tiếp tính lương/BHXH/thuế | Thêm 1 extension Postgres chưa từng dùng trong dự án; Prisma DSL không biểu diễn được `EXCLUDE` → phải tay thêm vào migration.sql (như ADR-001 đã làm cho sequence) | **Chọn** — chi phí thấp (khoảng 10 dòng SQL, 1 lần), lợi ích cao (bảo vệ đúng 1 invariant tài chính-pháp lý cốt lõi của cả module) |
| B. CHỈ service-layer pre-check (không có DB constraint) | Giống pattern kiểm tra tuần tự đã dùng cho BR-hr-002 | Không cần extension mới; code đơn giản, nhất quán với đa số check khác trong module | **Có race window thật** — 2 request đồng thời cho cùng 1 Nhân viên (vd 1 nhân sự gia hạn hợp đồng đúng lúc 1 nhân sự khác sửa hợp đồng cũ của người đó) có thể tạo dữ liệu chồng lấn thật, không thể phát hiện lại sau đó (không có ràng buộc nào chặn ở tầng ghi). Vi phạm chính nguyên tắc `hr-architecture.md` Mục 5 đã tự đặt ra ("service pre-check... KHÔNG thay thế được ràng buộc DB") — áp dụng nguyên tắc đó chọn lọc (chỉ cho FK/unique, bỏ qua cho rule tài chính quan trọng hơn) là thiếu nhất quán | Không chọn làm phương án DUY NHẤT — tần suất tạo Hợp đồng thấp (thao tác admin) làm race hiếm xảy ra, nhưng "hiếm" không đồng nghĩa "chấp nhận được" khi hệ quả là dữ liệu lương/BHXH sai lệch âm thầm |
| C. CHỈ `EXCLUDE` constraint (không pre-check) | Bỏ qua bước kiểm tra nhanh, để DB tự từ chối mọi trường hợp | Ít code hơn ở service | UX kém cho trường hợp phổ biến nhất (lỗi nhập liệu thông thường, không phải race) — lỗi trả về là exception DB generic, khó map chính xác 1-1 sang field cụ thể để hiển thị form so với 1 pre-check tự viết trả thẳng `E-hr-020` | Không chọn làm phương án DUY NHẤT — bỏ pre-check nhanh là đánh đổi UX không cần thiết khi chi phí giữ cả 2 lớp rất thấp |
| D. Application-level lock (vd Redis lock theo `employeeId` trước khi check+insert) | Serialize thao tác ghi Hợp đồng theo từng Nhân viên bằng lock phân tán | Không cần extension DB | Cần thêm hạ tầng Redis — dự án đã quyết định KHÔNG thêm cache/lock ngoài Postgres ở giai đoạn này (`hr-architecture.md` Mục 9, nhất quán ADR Postgres-only của auth); phức tạp hơn hẳn 1 constraint DB có sẵn cho đúng use case này | Không chọn — over-engineering so với 1 tính năng Postgres native đã giải quyết gọn vấn đề |

## Trade-offs

- **Nhận:** thêm 1 Postgres extension (`btree_gist`) và 1 loại constraint (`EXCLUDE`) chưa từng xuất hiện trong dự án — tăng nhẹ bề mặt kiến thức Backend Engineer cần nắm, và lặp lại đúng loại rủi ro đã chấp nhận ở ADR-001 (constraint nằm ngoài khả năng biểu diễn của Prisma schema DSL, phải tay thêm vào migration, tiềm ẩn "biến mất khỏi nhận thức" nếu ai đó chạy `prisma db pull`).
- **Nhận:** lỗi race-condition hiếm gặp (constraint DB từ chối) surface qua Prisma dưới dạng lỗi generic hơn `P2002`/`P2003` quen thuộc — cần Backend Engineer verify bằng test tích hợp thật, không chỉ suy đoán từ tài liệu Prisma (xem `hr-api-contract.md` Mục 5 ghi chú bắt lỗi).
- **Đổi lấy:** đảm bảo TUYỆT ĐỐI (do Postgres, không phụ thuộc logic ứng dụng) rằng dữ liệu Hợp đồng — nguồn đầu vào trực tiếp cho tính lương/BHXH/thuế TNCN (Business Goal, `hr-spec.md` Mục 1) — không bao giờ chồng lấn dưới bất kỳ điều kiện đồng thời nào, kể cả các đường ghi dữ liệu trong tương lai không đi qua `ContractsService` hiện tại (vd script migration dữ liệu, thao tác `$queryRaw` khác) — constraint DB bảo vệ ở mọi đường ghi, pre-check service chỉ bảo vệ đường đi qua đúng service đó.

## Consequences

- Migration cho `Contract` (xem `hr-data-model.md` Mục 11) phải có bước tay thêm `CREATE EXTENSION IF NOT EXISTS btree_gist;` và khối `EXCLUDE` — dễ quên khi review PR, nên thêm comment nhắc ngay trong migration.sql (cùng cách đã làm cho `hr_employee_code_seq`, ADR-001).
- Backend Engineer cần viết ÍT NHẤT 1 test tích hợp thật (không mock Prisma) tạo 2 Hợp đồng chồng lấn đồng thời cho cùng 1 Nhân viên để xác nhận constraint hoạt động VÀ để xác định chính xác mã lỗi Prisma cần bắt — không suy đoán suông. **Đã làm (2026-09-05):** mã thật là `P2039` kèm đối chiếu `error.message`, không phải `P2004` (xem cập nhật ở Decision).
- Nếu tương lai cần đổi hành vi BR-hr-013 (vd cho phép chồng lấn có kiểm soát, hoặc đổi ngưỡng "chồng lấn"), phải sửa CẢ pre-check service LẪN constraint DB — 2 nơi, không phải 1; đây là chi phí bảo trì thực tế của thiết kế 2 lớp, chấp nhận được vì 2 lớp phục vụ 2 mục tiêu khác nhau (UX vs correctness), không phải trùng lặp vô nghĩa.
- Không ảnh hưởng tới các bảng/entity khác trong module — `btree_gist` chỉ cần thiết cho constraint trên `contracts`.

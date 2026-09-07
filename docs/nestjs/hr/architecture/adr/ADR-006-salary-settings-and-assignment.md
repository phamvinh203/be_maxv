---
type: adr
feature: hr-salary-settings
status: accepted
updated: 2026-09-06
author: Architect-Agent
links:
  - docs/hr/srs/salary-settings-spec.md
  - docs/hr/architecture/salary-settings-data-model.md
  - docs/hr/architecture/salary-settings-api-contract.md
---

# ADR-006 — Thiết kế Kiến trúc Dữ liệu Cài đặt lương & Quy trình Phê duyệt Lương

## Context

Theo đặc tả nghiệp vụ `docs/hr/srs/salary-settings-spec.md` (chuẩn hóa từ UI components tại `maxv_v2/hdđt_maxv/src/features/hrm/components/cai_dat_luong` và mock hooks), hệ thống cần bổ sung phân hệ **Cài đặt lương** với 3 cụm nghiệp vụ:
1. **Danh mục khoản lương (`SalaryItem`)**: 7 loại khoản (lương phụ cấp, hỗ trợ, nghiệm thu, phần trăm, KPI, thưởng, chuyên cần) với các cờ pháp lý BHXH, Thuế TNCN và tỷ lệ %.
2. **Cấu trúc lương khung (`SalaryStructure`)**: Khung lương chuẩn của doanh nghiệp theo kỳ hiệu lực, xác định khoản nào được áp dụng, cờ tăng ca (`isOvertimeBase`), tiêu thức tính (`calculationMethod`), xử lý thuế (`taxTreatment`) và mức tiền mặc định.
3. **Thiết lập mức lương nhân viên (`EmployeeSalary`)**: Áp khung chuẩn cho từng nhân sự, ghi nhận số tiền từng khoản, quản lý số lần thiết lập (`setupVersion`) và quy trình phê duyệt (`PENDING_APPROVAL` -> `APPROVED`).

Các thách thức kiến trúc cần giải quyết:
- Làm thế nào để đảm bảo tính nhất quán giữa danh mục khoản lương, cấu trúc khung và bảng lương cá nhân?
- Chiến lược versioning (số lần thiết lập) và reset trạng thái phê duyệt khi có sửa đổi.
- Quy trình duyệt lương hàng loạt (Batch approval) an toàn, idempotent.
- Khả năng tích hợp liên thông với `Contract` (Hợp đồng) và sẵn sàng làm dữ liệu đầu vào cho `Payroll Engine` (Kỳ tính lương).

---

## Decision

### 1. Phân rã mô hình 3 tầng (Normalized 3-Tier Domain Model)
- **Tầng 1 - Danh mục (`SalaryItem`)**: Độc lập, đại diện cho bản chất kinh tế/pháp lý của khoản tiền.
  - Sinh mã `KL01`-`KL99` bằng thuật toán first-available-gap (tương tự mã ca `CA01`-`CA99` tại ADR-005) vì số khoản lương của doanh nghiệp thường từ 10-30 khoản.
  - Chặn xóa cứng (`Restrict`) nếu đã được tham chiếu trong cấu trúc lương hoặc bảng lương nhân viên; chỉ cho phép đổi sang `INACTIVE`.
- **Tầng 2 - Cấu trúc khung (`SalaryStructure` & `SalaryStructureItem`)**:
  - `SalaryStructure` quản lý theo thời gian hiệu lực (`effectiveFrom`, `effectiveTo`). Bật cờ `isActive = true` cho cấu trúc hiện hành.
  - `SalaryStructureItem` đóng vai trò bảng cầu nối $M-N$ giữa `SalaryStructure` và `SalaryItem`, nhưng mang thuộc tính cấu hình ngữ cảnh: `taxTreatment` (`TAXABLE` / `EXEMPT`), `isOvertimeBase` (Boolean), `calculationMethod` (`MONTHLY_FIXED`, `ACTUAL_WORKDAYS`, `HOURLY`, `OUTPUT_BASED`), `defaultAmount` (Int).
  - Ràng buộc duy nhất: `@@unique([salaryStructureId, salaryItemId])`.
- **Tầng 3 - Mức lương nhân sự (`EmployeeSalary` & `EmployeeSalaryItem`)**:
  - `EmployeeSalary`: Đại diện cho gói lương áp dụng của nhân viên. Ràng buộc `@@unique([employeeId])` cho gói lương hiện hành (1 nhân viên có 1 gói lương đang active).
  - `EmployeeSalaryItem`: Lưu số tiền thực tế (`amount: Int`) cho từng khoản của nhân viên.
  - Ràng buộc: Danh sách khoản của `EmployeeSalaryItem` bắt buộc phải là tập con hoặc khớp toàn bộ với `SalaryStructureItem` của cấu trúc lương hiện hành.

### 2. Nguyên tử hóa thao tác lưu mức lương & Tự động tăng Version
- Khi tạo mới hoặc cập nhật mức lương nhân viên (`PUT /employee-salaries/:employeeId`):
  - Toàn bộ thao tác thực hiện trong một Prisma `$transaction`.
  - Nếu đã tồn tại bản ghi: Tăng `setupVersion = setupVersion + 1`.
  - Tự động tính tổng tiền: `totalAmount = sum(item.amount)`. Validate `totalAmount > 0`.
  - **Bất biến phê duyệt**: Luôn ép trạng thái về `PENDING_APPROVAL`, reset `approvedByUserId = null` và `approvedAt = null`. Việc này ngăn chặn việc lọt các mức lương mới sửa đổi vào kỳ tính lương mà chưa qua rà soát của Kế toán trưởng/HR Director.

### 3. Thiết kế Phê duyệt lương hàng loạt (Batch Approval)
- Endpoint `POST /employee-salaries/approve`:
  - Thực hiện cập nhật hàng loạt qua `updateMany({ where: { status: { not: "APPROVED" } }, data: { status: "APPROVED", approvedByUserId: req.user.id, approvedAt: new Date() } })`.
  - Nếu client truyền danh sách `employeeIds: string[]`, chỉ duyệt những người trong danh sách.
  - Trả về `{ approvedCount: number }`, đảm bảo Idempotent (gọi lại nhiều lần không sinh lỗi, trả về 0 nếu không có ai cần duyệt).

### 4. Tích hợp liên thông với Hợp đồng (`Contract`)
- Khi khởi tạo mức lương cho nhân viên chưa từng được set lương:
  - Hệ thống tự động truy vấn Hợp đồng lao động hiện hành (`hopDongHienHanh`) của nhân viên.
  - Nếu khoản lương mang mã `KL01` (hoặc tên "Lương cơ bản"), hệ thống ưu tiên lấy giá trị `Contract.baseSalary` làm mức tiền mặc định ban đầu, giúp HR không phải gõ lại số liệu đã nhập ở hợp đồng.

---

## Consequences

### Ưu điểm
1. **Toàn vẹn dữ liệu tuyệt đối**: Các ràng buộc khóa ngoại `onDelete: Restrict` ở cấp danh mục ngăn chặn việc xoá nhầm các khoản lương đang được dùng để tính tiền.
2. **Tuân thủ chặt chẽ nguyên tắc kế toán**: Versioning và quy trình reset duyệt bảo vệ tính toàn vẹn của bảng lương, tránh gian lận hoặc sai sót khi thay đổi thu nhập.
3. **Sẵn sàng cho Payroll Module**: Khi kỳ lương phát sinh, payroll engine chỉ cần query `EmployeeSalary` có `status = APPROVED` và đọc chi tiết các dòng `EmployeeSalaryItem` để làm dữ liệu gốc tính công, bảo hiểm và thuế.

### Nhược điểm & Đánh đổi
- Cần chạy Prisma `$transaction` cho các thao tác lưu lương nhân viên (do phải cập nhật cả bảng cha và các dòng chi tiết). Đánh đổi này là hoàn toàn xứng đáng để đảm bảo tính nguyên tử (Atomicity).

---

## Addendum — Round 2 Rà soát Độc lập (2026-09-06, Architect)

> Bối cảnh: BA Round 2 (`docs/hr/srs/salary-settings-spec.md` Mục 14, `docs/hr/CONTEXT_SUMMARY.md` Mục 11) xác nhận qua đọc trực tiếp code rằng **BR-sal-005** và **BR-sal-008/E-sal-009** CHƯA được `EmployeeSalariesService.setSalary()` triển khai, dù QA/Code-Review Round 1 báo PASS (PASS ảo). Phần này chốt phương án kỹ thuật cho 2 gap CHẶN (OQ-sal-01, OQ-sal-03) và ghi nhận khuyến nghị cho OQ-sal-02/04/05/06. **KHÔNG thay đổi business requirement** — BR-sal-005/BR-sal-008 giữ nguyên như BA đã chốt; phần dưới đây chỉ quyết định CÁCH triển khai kỹ thuật.

### A1. OQ-sal-01 — Cơ sở kỹ thuật xác định "nhân viên đã nghỉ việc" (BR-sal-008/E-sal-009)

**Quyết định: Phương án (a) — suy luận từ Hợp đồng, KHÔNG thêm field mới vào `Employee`.**

- **Định nghĩa**: một nhân viên được coi là "đang làm việc" (đủ điều kiện Set lương) khi và chỉ khi tồn tại **ít nhất 1 `Contract`** của nhân viên đó thỏa `effectiveFrom <= now AND (effectiveTo IS NULL OR effectiveTo >= now)`. Không có bản ghi nào thỏa ⇒ coi là "đã nghỉ việc" theo nghĩa BR-sal-008.
- Đây CHÍNH XÁC là định nghĩa "hợp đồng hiện hành" (`currentContract`) mà `EmployeeSalariesService.findAll()` và `findByEmployeeId()` ĐÃ dùng (cùng where-clause) để suy luận `contractType` hiển thị và giá trị mặc định `KL01` (BR-sal-009) — **tái dùng nguyên vẹn**, không tạo ra 2 khái niệm "hiện hành" khác nhau trong cùng 1 feature.
- **Lý do chọn (a) thay vì (b) thêm field `Employee.status`**:
  1. `Employee` là entity ĐÃ hoàn thành, đã pass QA (`CONTEXT_SUMMARY.md` Mục 1). Thêm field trạng thái mới đòi hỏi mở lại một entity đã chốt và kéo theo câu hỏi nghiệp vụ MỚI ngoài phạm vi Salary Settings (ai đặt field này, đặt lúc nào, có quy trình "cho nghỉ việc"/offboarding nào không) — đây là một business process mới không có trong `hr-spec.md` gốc; Architect không có thẩm quyền tự bịa quy trình nghiệp vụ này.
  2. Module HR đã có sẵn dữ liệu đủ để suy luận (`Contract.effectiveFrom/effectiveTo`) — đúng tinh thần đã dùng nhất quán trong toàn module (ADR-002 định nghĩa "hợp đồng hiện hành"; BR-sal-009 đã tái dùng chính suy luận đó).
  3. Không cần migration nào lên `employees` — giảm khối lượng/rủi ro thay đổi cho Round 2.
- **Trade-off chấp nhận (ghi nhận minh bạch, KHÔNG phải "nghỉ việc" 100% chính xác)**:
  - Nhân viên có hợp đồng cũ hết hạn nhưng đang chờ ký hợp đồng mới (gap hành chính, vẫn thực tế đi làm) sẽ bị chặn NHẦM. Chấp nhận được vì tần suất thấp; quy trình chuẩn là HR gia hạn/tạo Hợp đồng mới trước khi Set lương.
  - Nhân viên có hợp đồng ký trước nhưng `effectiveFrom` ở tương lai (chưa tới ngày bắt đầu) cũng bị coi là "chưa đủ điều kiện" — hợp lý về nghiệp vụ (chưa chính thức làm việc).
  - Nếu tương lai cần phân biệt rạch ròi "tạm hoãn hợp đồng" khỏi "nghỉ việc hẳn", đây là lúc cân nhắc lại phương án (b) — không đóng cửa hoàn toàn, chỉ hoãn tới khi có tín hiệu nghiệp vụ rõ ràng hơn.
- **Điểm triển khai (Backend Engineer)**: trong `EmployeeSalariesService.setSalary()`, TRƯỚC khi mở `$transaction`, truy vấn hợp đồng hiện hành (tái dùng where-clause đã có ở `findByEmployeeId`). Không tìm thấy ⇒ `throw new HrError({ code: 'E-sal-009', httpStatus: 400 })`.
- **Phạm vi áp dụng — CẢ nhánh create VÀ update**: BR-sal-008 viết "không cho phép tạo mới set lương cho nhân viên đã thôi việc", nhưng mục tiêu nghiệp vụ (chặn tiền lương cho người không còn hợp đồng hiệu lực) sẽ bị vô hiệu hoá nếu chỉ áp dụng cho nhánh tạo mới — nhân viên đã có `EmployeeSalary` từ trước, sau đó hết hợp đồng, vẫn có thể bị SỬA (tăng) lương qua nhánh update nếu không chặn. Architect quyết định áp dụng check này cho MỌI lệnh gọi `setSalary()` — đây là quyết định về CÁCH triển khai một rule đã chốt, không phải mở rộng phạm vi nghiệp vụ. Nếu BA/PO có ý định hẹp hơn (chỉ chặn create), cần trao đổi lại.
- **Không cần ràng buộc DB bổ sung**: đây là kiểm tra "đọc rồi quyết định" dựa trên trạng thái một entity liên quan (giống hàng loạt pre-check FK-exists khác đã có trong module: department tồn tại, salary item tồn tại...), KHÔNG phải bất biến ghi đồng thời trên CÙNG một bảng như BR-hr-013 (2 Hợp đồng chồng lấn). Rủi ro race (HR set lương đúng lúc Admin/HR khác sửa Hợp đồng làm hết hiệu lực) tương đương mọi pre-check khác trong hệ thống — không đủ đặc biệt để cần EXCLUDE/trigger kiểu ADR-002.

### A2. OQ-sal-03 — Thiết kế enforcement cho BR-sal-005 (mã lỗi `E-sal-010`)

**Quyết định: Service-layer pre-check trong `setSalary()`, KHÔNG cần ràng buộc DB bổ sung.**

- **Validate**: mọi `dto.items[].salaryItemId` gửi lên PHẢI thuộc tập `salaryItemId` của `SalaryStructureItem` trong `SalaryStructure` đang `isActive = true` (cấu trúc khung hiện hành, cùng định nghĩa A-sal-04). Bất kỳ ID nào KHÔNG thuộc tập này ⇒ từ chối TOÀN BỘ request (không chấp nhận một phần).
- **Cách lấy "cấu trúc khung hiện hành"**: `setSalary()` PHẢI gọi lại `SalaryStructuresService.getCurrent()` (tái dùng) thay vì tự query `prisma.salaryStructure.findFirst({ isActive: true })` như hiện tại — lý do: `getCurrent()` đã có sẵn cơ chế auto-init khi chưa từng có cấu trúc nào (FR-sal-016). Nếu `setSalary()` tiếp tục tự query riêng, 2 nhánh GET/PUT có thể lệch pha: GET luôn thấy có cấu trúc (nhờ auto-init) còn PUT vẫn có thể thấy `null` nếu gọi trước khi FE từng load màn GET — dẫn tới hành vi khó đoán (chấp nhận mọi item vì "chưa có khung nào để so"). Dùng chung 1 nguồn loại bỏ hẳn lệch pha này.
- **Thứ tự validate trong `setSalary()`** (chốt để Backend Engineer + Tester-QA viết test nhất quán):
  1. Employee tồn tại — 404 `NOT_FOUND`.
  2. Employee đang làm việc (BR-sal-008) — 400 `E-sal-009` (xem A1).
  3. Toàn bộ `items[].salaryItemId` thuộc cấu trúc khung hiện hành (BR-sal-005) — 400 `E-sal-010` (MỚI).
  4. Tổng lương > 0 (BR-sal-006) — 400 `E-sal-008` (giữ nguyên, đã triển khai).
  5. Mở `$transaction`, ghi dữ liệu (giữ nguyên logic versioning hiện có).
- **Mã lỗi `E-sal-010`** (bổ sung `hr-errors.ts`):
  - Message đăng ký mặc định: `"Khoản lương không thuộc cấu trúc lương khung hiện hành."`
  - HTTP status: `400` (đối xứng với `E-sal-006` — cùng loại rule nhưng áp cho chiều PUT `/salary-structures/current`; `E-sal-010` áp cho chiều PUT `/employee-salaries/:employeeId`).
  - Override message tại throw-site liệt kê khoản vi phạm, ví dụ: `Khoản lương "Thưởng nóng" (KL15) không thuộc cấu trúc lương khung hiện hành.` (nhiều khoản vi phạm → nối bằng dấu phẩy).
- **Không cần ràng buộc DB bổ sung**: "cấu trúc khung hiện hành" là một VIEW LỌC ĐỘNG (`isActive = true` + `createdAt` mới nhất), không phải FK tĩnh — không thể biểu diễn bằng FK/CHECK constraint kiểu ADR-002. Rủi ro race (Admin đổi cấu trúc khung ĐÚNG lúc HR đang Set lương) đòi hỏi 2 thao tác admin đồng thời hiếm gặp, khác hẳn quy mô rủi ro của BR-hr-013 (input trực tiếp từ nhiều luồng, ảnh hưởng trực tiếp cơ sở tính BHXH/thuế). Service pre-check là đủ tương xứng.

### A3. OQ-sal-02 — Khuyến nghị: bổ sung UNIQUE index DB cho `(category, name)` (KHÔNG chặn Round 2, nhưng khuyến nghị làm ngay)

- **Khuyến nghị của Architect: NÊN bổ sung**, không chỉ "chấp nhận rủi ro". Lý do nhất quán kiến trúc: ADR-002 đã xác lập nguyên tắc "service pre-check KHÔNG thay thế được ràng buộc DB chống race condition" — `ADR-006` gốc đã KHÔNG tuân theo nguyên tắc này cho BR-sal-002 (chỉ có pre-check `findFirst` ở Service, xác nhận qua `migration.sql` KHÔNG có unique index composite) — đây là một GAP triển khai (không phải alternative có lý do tường minh như ADR-002 đã làm). Bổ sung ngay để dứt nợ kiến trúc, chi phí thấp (1 index).
- **Vì sao KHÔNG chặn Round 2 (khác OQ-sal-01/03)**: rủi ro thấp hơn hẳn BR-hr-013 — `SalaryItem` là danh mục do ADMIN/HR thao tác tần suất thấp (khác luồng tạo Hợp đồng có thể đồng thời từ nhiều người), và trùng tên khoản lương KHÔNG trực tiếp làm sai lệch số tiền/thuế/BHXH đã ghi (khác chồng lấn ngày Hợp đồng — hỏng ngay cơ sở tính lương). Có thể làm cùng Round 2 (khuyến nghị, vì đang sửa chung service liên quan) hoặc dời Round 3 tuỳ ưu tiên Backend Engineer.
- **Thiết kế migration cụ thể** (Backend Engineer thêm migration MỚI, Prisma DSL không hỗ trợ expression index — cùng tiền lệ EXCLUDE constraint ở ADR-002):
```sql
-- Chuẩn hoá đúng BR-sal-002: "không phân biệt chữ hoa/thường và khoảng trắng thừa"
-- UNIQUE(category, name) trần KHÔNG đủ (Postgres so sánh phân biệt hoa/thường theo mặc định)
-- → dùng expression index trên lower(trim(name))
CREATE UNIQUE INDEX "salary_items_category_name_ci_key"
  ON "salary_items" (category, lower(trim(name)));
```
  - Backend Engineer cần bắt lỗi vi phạm index này ở `SalaryItemsService.create()`/`update()` và map về `E-sal-002` (409, giữ nguyên message hiện có) — VERIFY THẬT bằng test tích hợp (không suy đoán mã lỗi Prisma, theo đúng bài học ADR-002 Mục Consequences — mã lỗi thật có thể khác `P2002` chuẩn vì đây là raw SQL index ngoài Prisma schema DSL).
  - Giữ NGUYÊN pre-check Service hiện tại (không xoá) — đúng mô hình 2 lớp của ADR-002.

### A4. Khuyến nghị cho OQ-sal-04, OQ-sal-05, OQ-sal-06 (không chặn)

- **OQ-sal-04 (audit trail lịch sử sửa lương)**: Khuyến nghị **KHÔNG triển khai ở Round 2**. Đây là nhu cầu thuộc một module "Audit Log nghiệp vụ chung" (khác `AuditLog` hiện có trong schema — vốn chỉ phục vụ sự kiện Auth: `LOGIN_SUCCESS`...; mở rộng enum đó cho sự kiện HR là thay đổi kiến trúc lớn hơn phạm vi Salary Settings). Ghi nhận: mô hình dữ liệu hiện tại của `EmployeeSalary` (ghi đè tại chỗ + counter `setupVersion`) khác hẳn triết lý "lưu lịch sử đầy đủ" của `Contract` (mỗi lần đổi tạo bản ghi mới, giữ nguyên bản ghi cũ) — 2 chiến lược vòng đời dữ liệu khác nhau, có chủ đích (A-sal-01) nhưng chưa từng được so sánh tường minh trong ADR-006 gốc (xem A5). Nếu tương lai BA/PO quyết định cần audit đầy đủ, khuyến nghị kỹ thuật là chuyển `EmployeeSalary` sang mô hình "append lịch sử" giống `Contract`, thay vì bolt-on một bảng log riêng — đây là thay đổi kiến trúc đáng kể, không làm trong Round 2.
- **OQ-sal-05 (tách vai trò lập đề xuất/duyệt lương)**: Quyết định CHÍNH SÁCH nội bộ doanh nghiệp, không phải gap kỹ thuật — Architect KHÔNG tự quyết thay BA/PO. Đường mở rộng kỹ thuật đã sẵn sàng nếu được yêu cầu sau này: thêm cột `lastModifiedByUserId` vào `EmployeeSalary` (migration nhỏ) + check "người duyệt ≠ người sửa cuối" trong `approve()`. KHÔNG làm trong Round 2 vì chưa có quyết định nghiệp vụ.
- **OQ-sal-06 (giá trị mặc định hard-code khi tự khởi tạo cấu trúc lương, FR-sal-016)**: Khuyến nghị giữ nguyên giá trị hard-code hiện tại như fallback tạm cho môi trường mới triển khai (không cấu hình hoá qua `GeneralSetting`/env — over-engineering cho một nhánh code chỉ chạy đúng 1 lần trong vòng đời hệ thống). Khuyến nghị bổ sung 1 test Unit/E2E riêng cho nhánh "chưa từng có cấu trúc lương nào" (hiện chưa có, theo BA Round 2 xác nhận) — việc của Backend Engineer/Tester-QA ở Round 2, không phải thay đổi thiết kế.

### A5. Đối chiếu tính nhất quán pattern với ADR-002/ADR-003 (research)

| Nguyên tắc đã xác lập | Áp dụng ở ADR-006 (Round 1) | Đánh giá Round 2 |
|---|---|---|
| `$transaction` cho ghi nhiều bảng liên quan (ADR-003) | `setSalary()` bọc `EmployeeSalary` + xoá/tạo lại `EmployeeSalaryItem` trong 1 `$transaction` | ✅ Đúng pattern, không cần sửa |
| Service pre-check KHÔNG thay thế ràng buộc DB cho bất biến ghi đồng thời cùng bảng (ADR-002) | BR-sal-002 (trùng tên trong loại) CHỈ có pre-check Service, KHÔNG có index DB | ⚠️ Lệch pattern — xác nhận GAP thật (không phải alternative có lý do), khuyến nghị bổ sung (A3) |
| Ràng buộc chỉ cần DB-level khi rủi ro race + hệ quả tài chính/pháp lý cao (tinh thần ADR-002 Alternative B) | BR-sal-005 (item ngoài khung), BR-sal-008 (nhân viên nghỉ việc) | Rủi ro race thấp hơn hẳn BR-hr-013 (không phải ghi đồng thời cùng bảng, tần suất đổi cấu trúc/hợp đồng thấp) → service pre-check ĐỦ, không cần DB constraint (A1, A2) |
| Không tạo entity/field mới nếu đã suy luận được từ dữ liệu hiện có | OQ-sal-01 | Áp dụng: chọn suy luận từ `Contract`, không thêm `Employee.status` (A1) |

**Kết luận research**: ADR-006 gốc nhất quán TỐT với ADR-003 (transaction boundary), nhưng có 1 GAP thật (không phải lệch pattern có chủ đích) so với ADR-002 ở đúng 1 điểm (BR-sal-002 thiếu DB constraint) — đã khuyến nghị vá ở A3. Quyết định KHÔNG thêm DB constraint cho BR-sal-005/BR-sal-008 (A1, A2) KHÔNG phải là lệch pattern — là áp dụng ĐÚNG tinh thần ADR-002 (chỉ cần DB constraint khi rủi ro race + hệ quả đủ cao), không phải áp dụng máy móc "mọi rule đều cần EXCLUDE constraint".

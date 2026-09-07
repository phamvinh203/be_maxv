# BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN (CODE REVIEW REPORT) — PHÂN HỆ CÀI ĐẶT LƯƠNG — ROUND 2 (RÀ SOÁT ĐỘC LẬP)

## Phân hệ: HR Payroll — Danh mục khoản lương, Cấu trúc lương & Thiết lập lương nhân viên

> Báo cáo này BỔ SUNG, KHÔNG thay thế [`docs/hr/code-reviewer/code-review-report-salary-settings.md`](./code-review-report-salary-settings.md) (Round 1) — giữ nguyên làm lịch sử. Round 1 đã được BA/Architect Round 2 xác nhận có pass ảo (tuyên bố sai "đã đánh index unique composite [category, name]" khi thực tế migration không có). Báo cáo này là kết quả rà soát ĐỘC LẬP sau khi Backend Engineer vá 2 gap CHẶN (BR-sal-008/E-sal-009, BR-sal-005/E-sal-010) và sau khi Tester-QA Round 2 tự phát hiện thêm 2 finding mới (Bug #1 Low, Bug #2 Medium). Không tin suông bất kỳ báo cáo tự khai nào (Backend Engineer Mục 13, QA Mục 14 của CONTEXT_SUMMARY.md) — mọi kết luận dưới đây dựa trên việc tự đọc code, tự chạy lại lint/build/test, và tự truy vấn trực tiếp Postgres thật (container hrm_accounting, port 5435) để đối chiếu.

- **Người thực hiện**: Agent Code-Reviewer (rà soát độc lập, round 2)
- **Thời gian đánh giá**: 2026-09-06
- **Mã đợt review**: CR-HR-SALARY-SETTINGS-ROUND2
- **Trạng thái phê duyệt**: APPROVE WITH COMMENTS (2 gap CHẶN Round 1 đã vá đúng — approve phần patch này; nhưng có nhiều Non-blocking cần Backend Engineer xử lý Round 3 trước khi coi phân hệ hoàn thiện, sẵn sàng bàn giao Frontend/DevOps không điều kiện)
- **Số lượng Blockers**: 0
- **Số lượng Non-blocking**: 4 (gồm 1 xác nhận lại từ QA — Bug #2 — cộng 3 finding MỚI/tổng hợp phát hiện qua rà soát độc lập này)
- **Số lượng Suggestion**: 3

---

## 0. Phạm vi rà soát và phương pháp

Xác định phạm vi qua git status/git diff (không tin theo danh sách file được giao sẵn):

| File | Trạng thái git | Đã đọc trực tiếp |
|---|---|---|
| Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts | mới (untracked, thuộc feature) | Có, toàn bộ |
| Backend/src/common/hr-errors.ts | modified | Có, toàn bộ |
| Backend/src/hr/salary/salary-items/salary-items.service.ts | mới | Có, toàn bộ |
| Backend/prisma/schema.prisma (đoạn SalaryItem/SalaryStructure/EmployeeSalary/EmployeeSalaryItem) | modified | Có |
| Backend/prisma/migrations/20260906030741_add_salary_item_name_ci_unique/migration.sql | mới | Có, cộng đối chiếu trực tiếp với Postgres thật (lệnh \d salary_items) |
| Backend/src/hr/salary/employee-salaries/employee-salaries.service.spec.ts | mới | Có, toàn bộ |
| Backend/src/hr/salary/salary-items/salary-items.service.spec.ts | mới | Có (phần P2002/race liên quan) |
| Backend/test/salary-settings.e2e-spec.ts | mới | Có (phần AC-sal-08/09 mới thêm) |
| Backend/test/salary-settings-qa-round2-independent.e2e-spec.ts | mới | Có, toàn bộ, cộng tự chạy lại độc lập |
| Backend/src/hr/salary/employee-salaries/employee-salaries.controller.ts | mới | Có |
| Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts | mới | Có, toàn bộ |
| Backend/src/hr/salary/salary-structures/salary-structures.service.ts | mới | Có, toàn bộ |
| Backend/src/common/pipes/hr-zod-validation.pipe.ts | không đổi round 2, đọc để xác minh Bug #1 | Có |
| Backend/src/common/filters/http-exception.filter.ts | không đổi round 2, đọc để xác minh không lộ stack trace | Có |
| Backend/src/hr/employees/employee-code.service.ts | không đổi, đọc để đối chiếu pattern ADR-001 với Bug #2 | Có |
| Backend/src/hr/hr.module.ts | modified | Có (chỉ đăng ký provider, không có logic) |

Tự chạy lại (không tin số liệu báo cáo cũ):
- `npm run lint` — kết quả: 0 lỗi (khớp báo cáo BE/QA).
- `npm run build` — kết quả: 0 lỗi (khớp báo cáo BE/QA).
- `npx vitest run src/hr/salary` (unit, 3 file) — kết quả: 24/24 pass (tự chạy trực tiếp, không qua báo cáo).
- `npx vitest run test/salary-settings-qa-round2-independent.e2e-spec.ts --config ./vitest.config.e2e.ts` (cô lập, không chạy chung suite) — kết quả: 11/11 pass.
- Truy vấn trực tiếp Postgres thật (docker exec hrm_accounting psql): xác nhận index `salary_items_category_name_ci_key UNIQUE, btree (category, lower(TRIM(BOTH FROM name)))` tồn tại thật trong DB (không chỉ trong file migration.sql chưa áp dụng) và 0 dòng trùng case-insensitive hiện có (migration áp dụng an toàn, không có dữ liệu vi phạm bị bỏ sót).
- Truy vấn thêm 2 bảng liên quan để xác minh độc lập 2 finding MỚI của chính tôi (Mục 5): index `employee_salary_items_employeeSalaryId_salaryItemId_key UNIQUE` và `employee_salaries_employeeId_key UNIQUE` — cả hai đều tồn tại thật trong DB, xác nhận 2 race condition nêu ở Mục 5.2/5.3 là có cơ sở thật (không phải suy đoán lý thuyết suông).

---

## 1. Xác nhận ĐỘC LẬP: 2 gap CHẶN Round 1 đã được vá ĐÚNG

Đọc trực tiếp EmployeeSalariesService.setSalary() (dòng 245-356), xác nhận thứ tự validate đúng như Architect Round 2 đã chốt (Mục 12.4 CONTEXT_SUMMARY.md):

1. Employee tồn tại (prisma.employee.findUnique) — 404 NOT_FOUND nếu không có.
2. BR-sal-008/E-sal-009 (assertEmployeeIsActive(), dòng 27-39) — query Contract với effectiveFrom <= now AND (effectiveTo IS NULL OR effectiveTo >= now); áp dụng CẢ create lẫn update (không rẽ nhánh riêng, code dùng chung 1 đường) — throw E-sal-009 (400) nếu không có Contract hiệu lực.
3. BR-sal-005/E-sal-010 — gọi SalaryStructuresService.getCurrent() (tái dùng, có auto-init FR-sal-016, tránh lệch pha GET/PUT đúng như Architect cảnh báo), đối chiếu từng items[].salaryItemId với tập hợp item thuộc cấu trúc active; có phần tử ngoài khung — throw E-sal-010 (400), message liệt kê đúng tên và mã cụ thể qua salaryItem.findMany (đã unit-test cả trường hợp fallback ID lạ hoàn toàn không tồn tại trong danh mục).
4. BR-sal-006/E-sal-008 (tổng > 0) — giữ nguyên logic cũ.
5. Ghi trong $transaction — logic versioning (setupVersion tăng, reset PENDING_APPROVAL, xoá/tạo lại EmployeeSalaryItem) giữ nguyên không đổi.

Xác nhận qua test tự chạy (không chỉ đọc code tĩnh): cả unit (employee-salaries.service.spec.ts, 2 test E-sal-009 create và update branch, 2 test E-sal-010 bao gồm case fallback ID lạ) và e2e độc lập tự viết bởi QA (salary-settings-qa-round2-independent.e2e-spec.ts, 11 case) đều PASS khi tôi tự chạy lại. Case thứ tự ưu tiên bắt buộc (nhân viên hết hạn HĐ cộng item ngoài khung cùng lúc, phải trả E-sal-009 chứ không phải E-sal-010) đã được test và đúng.

Kết luận Mục 1: 2 gap CHẶN Round 1 (nguyên nhân khiến Round 1 QA/Code-Review PASS ảo) nay đã được vá đúng, xác nhận độc lập lần 2 (BA/Architect rồi QA rồi Code-Reviewer đều đồng thuận). Không phát hiện thêm gap nào trong 2 rule này.

---

## 2. Đánh giá Bug #1 (QA báo Low — sai lệch tài liệu vs hành vi thật)

Đã tự xác minh qua đọc code, không chỉ tin báo cáo QA: đọc set-employee-salary.schema.ts (dòng 14-30) xác nhận setEmployeeSalarySchema có .refine() kiểm tra total > 0 NGAY TẦNG ZOD, và employee-salaries.controller.ts (dòng 68-75) áp dụng pipe này qua @Body(new HrZodValidationPipe(setEmployeeSalarySchema, ...)) — NestJS Pipe chạy validate/transform tham số TRƯỚC KHI handler (và do đó cả setSalary() trong service) được gọi. Do đó khi totalAmount <= 0, request luôn bị chặn ở tầng Pipe (E-sal-008), bất kể employeeId có tồn tại hay không, bất kể item có thuộc khung hay không — đúng như QA mô tả.

Đánh giá độc lập của tôi: Đây không phải sai business rule (request vẫn luôn bị từ chối đúng, không có false-negative an toàn nào) — chỉ là tài liệu salary-settings-api-contract.md Mục 4.4 liệt kê 4 bước như một chuỗi tuần tự duy nhất trong khi thực tế có 2 tầng khác nhau (Pipe DTO-shape vs Service business-rule). Đồng ý với QA: phân loại Suggestion, không chặn — chỉ cần Architect làm rõ lại tài liệu (tách rõ 2 lớp), không cần sửa code.

Phát hiện bổ sung của tôi liên quan trực tiếp đến Bug #1 (xem Mục 5.1): vì Pipe luôn chặn totalAmount <= 0 trước khi vào service, đoạn code kiểm tra E-sal-008 bên trong setSalary() (dòng 287-295) đã trở thành dead code không thể chạm tới qua HTTP thật — nêu chi tiết ở Mục 5.1 (finding MỚI, Non-blocking).

---

## 3. Đánh giá nghiêm túc Bug #2 (QA báo Medium — race condition sinh mã KLxx)

### 3.1 Xác nhận độc lập bug có thật

Đọc trực tiếp SalaryItemsService.generateNextCode() (dòng 33-54) và create() (dòng 113-177):

- generateNextCode() đọc toàn bộ code hiện có bằng findMany, tính số kế tiếp trong bộ nhớ JS (usedNums Set), không dùng cơ chế atomic nào ở tầng Postgres (không sequence, không SELECT ... FOR UPDATE).
- create() bọc lệnh prisma.salaryItem.create() trong try/catch, nhưng catch CHỈ xử lý 1 loại P2002 — vi phạm index case-insensitive tên (isSalaryItemNameConflict(), kiểm qua meta.driverAdapterError.cause.constraint.index). Nếu P2002 xảy ra vì trùng code (có meta.target là mảng chứa "code") thì isSalaryItemNameConflict() trả false ngay từ dòng đầu (kiểm tra Array.isArray(target) && target.length > 0) — lỗi bị ném nguyên trạng ở dòng 175 (throw error), không có mã nghiệp vụ.
- HttpExceptionFilter (đã đọc, Mục Security findings bên dưới) không có nhánh bắt Prisma.PrismaClientKnownRequestError cụ thể nào cho case này — rơi vào nhánh không lường trước (dòng 136-141 của filter) — trả 500 Internal Server Error.
- Xác nhận thêm: salary-items.service.spec.ts dòng 140 có 1 test tên "does NOT map an unrelated P2002 (duplicate code) to E-sal-002, rethrows as-is" — nghĩa là hành vi "không xử lý, ném nguyên trạng" này là chủ đích đã được test hoá, không phải lỗ hổng ẩn không ai biết. Điều này xác nhận đây là gap có thật và đã được biết tới ở mức implementation, chỉ là chưa được đánh giá đúng tầm ảnh hưởng cho tới khi QA Round 2 tái hiện qua concurrency thật.

Kết luận: Bug #2 CÓ THẬT, xác nhận độc lập qua đọc code (không chỉ tin QA).

### 3.2 So sánh với EmployeeCodeService (ADR-001), có phải bất nhất pattern nghiêm trọng?

Đọc Backend/src/hr/employees/employee-code.service.ts — pattern ADR-001 dùng:
- Postgres SEQUENCE thật (hr_employee_code_seq, nextval() qua raw SQL) — atomic ở tầng DB, không có khoảng hở giữa đọc số hiện có và dùng số đó (khác hẳn cách SalaryItemsService đọc snapshot rồi tính trong JS).
- generateAndCreate() có retry-on-conflict tối đa 5 lần (EMPLOYEE_CODE_MAX_RETRY), chỉ retry đúng loại lỗi (isEmployeeCodeConflict, P2002 trên field employeeCode), lỗi khác ném ngay không retry.

SalaryItemsService.generateNextCode()/create() không áp dụng pattern này dù cùng module HR, cùng loại bài toán (sinh mã tự động unique khi không truyền tay). Đây đúng là bất nhất pattern trong cùng module — ADR-001 đã thiết lập chuẩn giải quyết đúng bài toán này từ trước, nhưng khi làm SalaryItem (Round 1, trước cả Round 2 patch), Backend Engineer đã không tái sử dụng hoặc tham chiếu pattern đã có, tự viết lại theo cách kém an toàn hơn. Round 1 Code Review (đã supersede) không bắt được vì bảng checklist Mục 2.3 chỉ ghi chung chung "Đã đánh index unique trên SalaryItem (code)" mà không kiểm tra cơ chế sinh mã có an toàn concurrency hay không.

### 3.3 Phân loại mức độ nghiêm trọng (theo khung Code Reviewer .claude/CLAUDE.md)

Đối chiếu định nghĩa:
- Không phải "Security vulnerability": không injection, không lộ dữ liệu — HttpExceptionFilter xác nhận response 500 chỉ trả error code INTERNAL với message chung chung, không có message hoặc stack trace nội bộ (xem Mục 6).
- Không phải "Data corruption": request thua cuộc bị Postgres từ chối ở tầng UNIQUE constraint trước khi ghi — không có 2 SalaryItem nào trùng code lọt vào DB. Dữ liệu vẫn toàn vẹn, chỉ là request hợp lệ bị lỗi 500 oan thay vì được tạo thành công hoặc bị từ chối có kiểm soát.
- Không phải "Incorrect business logic": không có nhánh nào cho ra kết quả nghiệp vụ sai — chỉ là thiếu graceful handling cho 1 tình huống hiếm.
- Không phải "Breaking API"/"Critical regression": đây là gap PRE-EXISTING từ Round 1 (đã xác nhận qua timeline — salary-items.service.ts không đổi phần generateNextCode()/create() catch-block ở Round 2 patch), không phải regression do patch Round 2 gây ra, và không nằm trong phạm vi 2 gap CHẶN được giao vá ở Round 2.

Phân loại: Non-blocking cho việc merge/đóng patch Round 2 hiện tại (đúng phạm vi, không phải lỗi Round 2 gây ra). Nhưng đây là nợ kỹ thuật thật, tái hiện được (QA đã có stack trace P2002 trên salary_items_code_key), và đã tồn tại đủ lâu qua 2 vòng review mà không ai bắt được — khuyến nghị bắt buộc xử lý ở Round 3 trước khi coi phân hệ sẵn sàng production với nhiều người dùng đồng thời. Không nâng lên Blocking vì: (a) ngoài phạm vi 2 gap CHẶN Round 2 được giao, (b) tần suất xảy ra thực tế thấp (tạo khoản lương không truyền code đồng thời là thao tác admin hiếm), (c) không gây mất hoặc sai dữ liệu.

Đề xuất cụ thể cho Backend Engineer Round 3 (2 lựa chọn, không tự quyết thay Backend/Architect):
- (a) Retry-on-conflict theo đúng pattern EmployeeCodeService: bắt P2002 khi meta.target chứa "code", gọi lại generateNextCode() cộng create() tối đa N lần (khuyến nghị dùng lại hằng số kiểu EMPLOYEE_CODE_MAX_RETRY cho nhất quán).
- (b) Chuyển sang Postgres SEQUENCE atomic như hr_employee_code_seq (nhất quán kiến trúc hơn, nhưng cần migration mới và đổi format KLxx sang lấy từ nextval()).

---

## 4. Đánh giá Bug #1 có cần Blocking hay chỉ note cho Architect

Đã phân tích ở Mục 2 — không cần Blocking. Đây thuần tuý là gap giữa tài liệu (salary-settings-api-contract.md Mục 4.4) và cách triển khai 2 tầng validate (Pipe DTO-shape chạy trước Service business-rule) — hành vi thực tế vẫn an toàn (luôn từ chối đúng, không có lỗ hổng cho phép request sai lọt qua). Phân loại: Suggestion, khuyến nghị Architect cập nhật lại Mục 4.4 để tách rõ 2 lớp thay vì liệt kê như 1 chuỗi thứ tự cố định duy nhất — không bắt buộc trước khi merge.

---

## 5. Finding MỚI phát hiện qua rà soát độc lập round 2 (không có trong báo cáo BA/Architect/Backend/QA)

### 5.1 [Suggestion] Dead code — kiểm tra E-sal-008 trong EmployeeSalariesService.setSalary() không thể chạm tới qua HTTP

File: Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts, dòng 287-295.

Vì setEmployeeSalarySchema.refine() (tầng Zod Pipe, chạy trước controller/service, xem Mục 2) đã đảm bảo total > 0 trước khi request tới được setSalary(), đoạn code tính totalAmount rồi kiểm tra totalAmount <= 0 để throw E-sal-008 không bao giờ throw được qua đường HTTP thật — chỉ có thể throw khi có code khác gọi thẳng service.setSalary() mà bỏ qua Pipe (ví dụ batch job nội bộ, hoặc, như đang xảy ra, unit test gọi thẳng service). Đây là lý do unit test "throws E-sal-008 if total amount <= 0" (dòng 81-89 employee-salaries.service.spec.ts) PASS dù đường HTTP thật không bao giờ đi qua nhánh này — test không sai, nhưng tạo ảo giác rằng đây là 1 đường code sống trên production traffic.

Vì sao đáng lưu ý (không phải nitpick): nếu sau này có thêm 1 nơi gọi setSalary() không qua HTTP (worker, script migrate dữ liệu, gRPC nội bộ...) thì lớp bảo vệ này mới thực sự có tác dụng — nên không đề xuất xoá, chỉ đề xuất thêm 1 dòng comment nói rõ đây là defense-in-depth cho caller không qua HTTP Pipe, không phải đường chính, để tránh nhầm lẫn cho người đọc code sau này (đúng tinh thần Bug #1, tài liệu/comment nên phản ánh đúng thực tế 2 tầng).

### 5.2 [Non-blocking] Duplicate salaryItemId trong items của PUT /employee-salaries/:employeeId không được validate, dẫn tới 500 thay vì 400

File: Backend/src/hr/salary/employee-salaries/dto/set-employee-salary.schema.ts cộng employee-salaries.service.ts (dòng 337-343).

Đã xác nhận qua đọc code (schema không có bất kỳ .refine() hoặc check nào cho tính duy nhất của salaryItemId trong mảng items) và xác nhận qua truy vấn Postgres thật: bảng employee_salary_items có UNIQUE INDEX employee_salary_items_employeeSalaryId_salaryItemId_key trên (employeeSalaryId, salaryItemId).

Nếu client gửi 1 request PUT với items chứa 2 phần tử cùng salaryItemId (khác amount) — Zod schema chấp nhận (không kiểm tra trùng phần tử mảng), offendingIds/totalAmount check đều pass bình thường (không quan tâm trùng lặp), rồi lệnh tx.employeeSalaryItem.createMany cố insert 2 dòng cùng cặp (employeeSalaryId, salaryItemId) — Postgres từ chối bằng P2002 bên trong $transaction, không có try/catch nào bao quanh — lỗi bay thẳng lên HttpExceptionFilter, trả 500 Internal Server Error (transaction tự rollback an toàn, không có dữ liệu hỏng, nhưng request hợp lệ về mặt hình thức JSON lại nhận lỗi hệ thống thay vì lỗi nghiệp vụ 400 rõ ràng).

Mức độ: cùng nhóm lỗi với Bug #2 (uncaught unique-constraint violation dẫn tới 500 không kiểm soát), nhưng ở 1 điểm khác trong code. Khả năng xảy ra trong thực tế: có thể xảy ra nếu UI Frontend (chưa xây) cho phép chọn cùng 1 khoản lương 2 lần trong form nhiều dòng (repeater) mà không tự loại trùng ở client, hoặc do double-submit/replay. Chưa re-produce trực tiếp trong phiên review này (chỉ xác nhận qua truy vết logic cộng đối chiếu ràng buộc DB thật, không dựng lại HTTP request để ép lỗi, do giới hạn thời gian phiên review) — mức độ tin cậy cao vì đường đi code rất tường minh, không có nhánh nào chặn trước.

Đề xuất Backend Engineer (Round 3, gộp chung nhóm sửa với Bug #2): thêm .refine() vào setEmployeeSalarySchema kiểm tra tính duy nhất của salaryItemId trong mảng items (so sánh kích thước mảng gốc với kích thước Set các salaryItemId), trả lỗi nghiệp vụ rõ ràng (map field priority tương tự E-sal-007/E-sal-008, cần Architect/BA đặt tên mã lỗi mới hoặc tái dùng mã hiện có nếu phù hợp, không tự đặt mã lỗi thay).

### 5.3 [Non-blocking] Race condition khi 2 request PUT đồng thời cho cùng 1 employeeId (double-submit), pattern find-rồi-create/update không atomic

File: Backend/src/hr/salary/employee-salaries/employee-salaries.service.ts, dòng 301-335 (bên trong $transaction).

Logic hiện tại: đọc existing bằng tx.employeeSalary.findUnique theo employeeId, nếu có thì tx.employeeSalary.update, nếu không thì tx.employeeSalary.create. Đã xác nhận qua Postgres thật: EmployeeSalary.employeeId có UNIQUE INDEX employee_salaries_employeeId_key. Ở mức isolation mặc định của Postgres (READ COMMITTED), nếu 2 request PUT tới cùng employeeId gần như đồng thời (2 HR/Admin cùng sửa 1 nhân viên, hoặc double-click submit từ UI trong tương lai chưa có debounce), cả 2 transaction đều có thể findUnique thấy existing là null trước khi transaction nào commit, rồi cả 2 cùng gọi create() — transaction thắng cuộc commit thành công, transaction thua cuộc nhận P2002 trên employee_salaries_employeeId_key, không có try/catch, dẫn tới 500 Internal Server Error (tương tự cấu trúc lỗi ở Mục 5.2/Bug #2).

Mức độ: PRE-EXISTING từ Round 1 (khối $transaction này không bị Round 2 patch sửa đổi cấu trúc, Round 2 chỉ thêm 3 bước validate phía trước khối này). Không phải regression Round 2. Khả năng xảy ra trong thực tế: thấp (yêu cầu 2 request ghi đồng thời đúng 1 employeeId khi chưa từng có EmployeeSalary; nhánh update dùng update() theo employeeId nên ít rủi ro hơn vì update trên record đã tồn tại không tạo xung đột unique mới, dù vẫn có thể có lost-update kiểu ghi đè lẫn nhau nếu không dùng optimistic locking, nhưng đó là vấn đề khác, ít nghiêm trọng hơn).

Đề xuất Backend Engineer (Round 3, cân nhắc gộp cùng đợt sửa Bug #2/5.2): thay pattern find-rồi-nhánh bằng tx.employeeSalary.upsert (where theo employeeId, create và update tương ứng) — Postgres xử lý atomic (INSERT ... ON CONFLICT DO UPDATE), loại bỏ hoàn toàn khoảng hở race. Cần lưu ý: upsert cần logic tính setupVersion tăng thêm 1 — Prisma upsert cho phép dùng increment ở nhánh update (atomic increment ở tầng DB), phù hợp để thay thế.

### 5.4 Ghi nhận thêm, không phải finding mới nhưng cần lưu ý — Round 1 Code Review có thêm 1 tuyên bố sai (thứ 3), ngoài lỗi đã biết

BA Round 2 (Mục 11.6 điểm 3 CONTEXT_SUMMARY.md) đã bắt được Round 1 Code Review tuyên bố sai "đã đánh index unique composite [category, name]" (Mục 2.3 báo cáo Round 1) trong khi thực tế không có ràng buộc DB nào, chỉ có pre-check Service. Qua rà soát Round 2 này, tôi phát hiện thêm 1 tuyên bố sai thứ 3 trong chính báo cáo Round 1 (Mục 1.5, dòng mô tả file dto/set-employee-salary.schema.ts): báo cáo đó viết là DTO này có "kiểm tra trùng khoản mục (E-sal-006)".

Đã xác nhận qua grep toàn bộ Backend/src/hr/salary/: mã lỗi E-sal-006 chỉ tồn tại và được throw trong SalaryStructuresService.updateCurrent() (kiểm tra salaryItemId trong DTO cập nhật cấu trúc khung có tồn tại trong danh mục hay không), hoàn toàn không liên quan đến việc kiểm tra trùng khoản mục trong DTO set-employee-salary.schema.ts. Thực tế (xác nhận Mục 5.2) DTO này không có bất kỳ check trùng lặp salaryItemId nào trong mảng items.

Ý nghĩa: đây không phải finding cần fix (đã supersede bởi báo cáo Round 2 này), nhưng củng cố thêm kết luận của BA/Architect rằng phương pháp review Round 1 mang tính mô tả ý định/tên biến hơn là xác minh hành vi runtime thật (đọc tên field/comment rồi suy diễn thay vì trace code path cộng đối chiếu DB thật). Ghi nhận để hiệu chỉnh phương pháp review cho các đợt sau, không lặp lại kiểu review checklist mô tả này.

---

## 6. Security findings

- Không lộ stack trace hoặc thông tin nội bộ qua lỗi 500 — đã tự đọc HttpExceptionFilter.normalize() (nhánh 6, dòng 136-141): mọi exception không lường trước (bao gồm cả Bug #2 và 2 finding mới ở Mục 5.2/5.3) đều trả về error code INTERNAL với message chung chung "Lỗi hệ thống. Vui lòng thử lại sau." — log chi tiết chỉ ra console.error phía server. Xác nhận độc lập claim của QA, không chỉ tin báo cáo.
- RBAC nhất quán: PUT /employee-salaries/:employeeId và POST/PATCH/DELETE /salary-items chỉ cho phép ADMIN và HR; đọc (GET) mở rộng thêm ACCOUNTANT. Khớp đúng ma trận RBAC đã thiết lập cho toàn bộ module HR, không có endpoint nào bị thiếu decorator Roles (đã rà từng controller).
- Injection: Toàn bộ truy vấn qua Prisma Client (parameterized) — bao gồm cả biểu thức lower(trim(name)) trong migration.sql (raw SQL trong migration, không nhận input runtime, an toàn). Zod .strict() chặn extra fields ở mọi DTO liên quan. Không phát hiện injection vector mới.
- Message lỗi E-sal-010 liệt kê tên và mã khoản lương vi phạm — dữ liệu nghiệp vụ nội bộ (không phải PII), chấp nhận được cho user đã authenticated và authorized (ADMIN/HR). Đồng ý đánh giá của QA.
- Không phát hiện lỗ hổng mới trong phạm vi thay đổi Round 2 (validate order mới không mở thêm input surface nào).

## 7. Performance findings

- setSalary() sau khi thêm 3 bước validate mới: tổng số round-trip DB cho 1 request không bị tăng theo kích thước items (không có N+1, truy vấn salaryItem.findMany cho danh sách offendingIds chỉ chạy 1 lần cho toàn bộ danh sách, không lặp per-item). Không có vấn đề hiệu năng mới.
- SalaryStructuresService.getCurrent() được gọi lại mỗi lần setSalary() — 1 query findFirst (cộng include items) mỗi request PUT; chấp nhận được cho endpoint set lương (tần suất thấp, không phải hot path list/pagination). Không cần cache ở giai đoạn này (đúng nguyên tắc không over-engineer khi chưa cần, theo .claude/CLAUDE.md).
- Migration CREATE UNIQUE INDEX không dùng CONCURRENTLY — sẽ khoá bảng salary_items khi build index. Với quy mô hiện tại (19 dòng, xác nhận qua seed cộng query thật) rủi ro gần như bằng 0; nêu ra chỉ như lưu ý cho các migration UNIQUE index tương lai trên bảng lớn hơn nhiều, không phải finding cho migration này.

---

## 8. Đánh giá test mới (Backend Engineer cộng QA Round 2)

- Unit test (employee-salaries.service.spec.ts, salary-items.service.spec.ts): mock đúng shape, không vacuous — mỗi test mới đều assert cụ thể mã lỗi cộng hệ quả (ví dụ kiểm tra $transaction không được gọi để xác nhận validate chặn trước khi ghi DB, không phải chặn sau). Test case fallback ID lạ cho E-sal-010 (dòng 238-250) là điểm cộng, bao phủ edge case thực tế (client gửi UUID ngẫu nhiên). Đúng convention hiện có của repo (mock PrismaService qua object literal, không dùng thư viện mock ngoài).
- E2E độc lập của QA (salary-settings-qa-round2-independent.e2e-spec.ts): chất lượng cao, tự chạy lại xác nhận 11/11 pass ổn định, cleanup đầy đủ qua afterAll (đã kiểm tra logic xoá đúng thứ tự FK, employeeSalary trước employee, salaryItem sau), có xác nhận trạng thái DB trực tiếp sau mỗi lỗi mong đợi (ví dụ query employeeSalary phải null) thay vì chỉ tin response HTTP, đây là thực hành tốt, đúng pattern contracts.e2e-spec.ts và hr.e2e-spec.ts đã có. Không phát hiện brittle hoặc flaky trong chính file này khi chạy độc lập.
- E2E của Backend Engineer (salary-settings.e2e-spec.ts): thêm 3 fixture nhân viên (terminatedEmployeeId, expiringEmployeeId) cộng outOfStructureItemId hợp lý, che phủ đúng AC-sal-08 (cả 2 nhánh create/update) cộng AC-sal-09. Điểm cần lưu ý: file này tạo SalaryItem không truyền code (dựa vào generateNextCode()), đây chính là điểm khiến suite bị flaky khi chạy song song với file QA mới (Bug #2). Không coi đây là lỗi thiết kế test (test đúng dùng flow thật của API, phơi bày đúng 1 bug thật của production code) — nhưng khuyến nghị: sau khi Backend Engineer vá Bug #2 ở Round 3, nên giữ nguyên cách test này (không né tránh bằng cách luôn truyền code tay) để làm regression test tự nhiên cho race condition đã vá.
- Không phát hiện test nào bị skip, xfail, hoặc giả định sai (không lặp lại kiểu lỗi PASS ảo của Round 1).

---

## 9. Đánh giá migration 20260906030741_add_salary_item_name_ci_unique

- An toàn trên dữ liệu hiện có: xác nhận qua Backend Engineer và tự tôi query lại — 0 dòng vi phạm case-insensitive trước khi migrate, migration áp dụng không lỗi.
- Rollback path: theo đúng convention forward-only của toàn bộ project (đã kiểm tra 7 migration trước đó, không migration nào có down-script riêng), nhất quán, không phải gap riêng của migration này.
- P2002 to E-sal-002 mapping: đã xác nhận logic isSalaryItemNameConflict() phân biệt đúng qua trường driverAdapterError.cause.constraint.index (vì đây là expression index, Prisma không tự suy được meta.target), khớp với bằng chứng thật (không suy đoán) mà Backend Engineer đã probe trên Postgres thật.
- False positive/negative với item INACTIVE: đã xác nhận qua đọc schema.prisma (enum SalaryItemStatus gồm ACTIVE và INACTIVE) và migration SQL — UNIQUE index tính trên toàn bộ dòng bất kể status, nghĩa là 1 khoản lương đã bị đổi sang INACTIVE (ngừng dùng, không bị xoá, hàm remove() chỉ hard-delete khi chưa từng được dùng ở đâu theo BR-sal-003) vẫn chiếm giữ "slot" tên cộng loại, chặn việc tạo mới 1 khoản ACTIVE cùng tên cộng loại sau này. Đây không phải regression của migration Round 2 — hành vi này nhất quán với pre-check Service đã có từ Round 1 (truy vấn findFirst trong create()/update() cũng không filter theo status). Phân loại: Suggestion — nêu ra để Architect/BA xác nhận đây có phải chủ đích (tránh trùng tên vĩnh viễn kể cả khoản đã ngừng dùng, phục vụ audit/báo cáo lịch sử) hay là 1 gap cần filter theo status ACTIVE trong cả 2 tầng (Service pre-check cộng migration), đây là quyết định business, Code Reviewer không tự chọn thay.

---

## 10. Tổng hợp Finding

### Blocking
Không có.

### Non-blocking
1. Bug #2 (xác nhận lại từ QA) — Race condition trong SalaryItemsService.generateNextCode()/create() (sinh mã KLxx không atomic, không retry-on-conflict) gây 500 Internal Server Error khi 2 request đồng thời tạo SalaryItem không truyền code. PRE-EXISTING từ Round 1, bất nhất với pattern EmployeeCodeService/ADR-001 đã thiết lập trong cùng module HR. Backend Engineer vá Round 3 (Mục 3.3 có 2 phương án đề xuất).
2. Finding MỚI — Duplicate salaryItemId trong items của PUT /employee-salaries/:employeeId không được validate, gây 500 (uncaught P2002 trên employee_salary_items_employeeSalaryId_salaryItemId_key) thay vì lỗi 400 nghiệp vụ rõ ràng (Mục 5.2). Backend Engineer thêm refine dedupe ở Zod schema, Round 3, gộp cùng đợt sửa Bug #2.
3. Finding MỚI — Race condition double-submit cho cùng 1 employeeId trong setSalary() — pattern find-rồi-create/update không atomic, có thể gây 500 (uncaught P2002 trên employee_salaries_employeeId_key) khi 2 request PUT đồng thời cho nhân viên chưa từng có EmployeeSalary (Mục 5.3). Backend Engineer cân nhắc đổi sang tx.employeeSalary.upsert, Round 3.
4. Bug #1 (xác nhận lại từ QA) — Sai lệch tài liệu salary-settings-api-contract.md Mục 4.4 vs hành vi thật (Zod Pipe layer chạy trước Service layer). Không sai business rule, chỉ cần Architect làm rõ lại tài liệu.

### Suggestion
1. Dead code kiểm tra E-sal-008 trong setSalary() (Mục 5.1) — thêm comment làm rõ đây là defense-in-depth cho caller không qua HTTP Pipe, tránh nhầm lẫn tài liệu/code sau này.
2. UNIQUE index case-insensitive SalaryItem không filter theo status (Mục 9) — xác nhận với Architect/BA có phải chủ đích (khoản INACTIVE vẫn chiếm slot tên) hay cần thu hẹp phạm vi.
3. Ghi nhận phương pháp review (Mục 5.4): Round 1 Code Review có tuyên bố sai thứ 3 (E-sal-006 không liên quan tới dedupe items) — khuyến nghị các đợt review sau luôn trace code path cộng đối chiếu DB thật thay vì mô tả theo tên biến/comment.

---

## 11. Final Recommendation

APPROVE WITH COMMENTS.

- Approve phần patch Round 2 cụ thể (2 gap CHẶN BR-sal-008/E-sal-009 cộng BR-sal-005/E-sal-010): đã xác nhận độc lập (đọc code cộng tự chạy test cộng tự truy vấn Postgres thật) là đúng, đầy đủ, đúng thứ tự ưu tiên đã chốt, không gây regression cho các luồng hợp lệ, không có Blocking issue nào trong phạm vi patch này.
- Không coi phân hệ Salary Settings là hoàn thiện 100%, sẵn sàng bàn giao Frontend Engineer/DevOps Engineer không điều kiện — đồng thuận với BA/Architect/QA: cần Round 3 Backend Engineer xử lý gộp 3 finding cùng nhóm "uncaught unique-constraint violation dẫn tới 500 không kiểm soát" trước khi coi feature production-ready cho nhiều người dùng đồng thời:
  1. Bug #2, race condition sinh mã KLxx (Medium, QA phát hiện, Code Reviewer xác nhận độc lập).
  2. Duplicate salaryItemId trong items (MỚI, Code Reviewer phát hiện).
  3. Double-submit race trên setSalary() cùng employeeId (MỚI, Code Reviewer phát hiện).
- Bug #1 (tài liệu) cộng 2 Suggestion không chặn tiến độ — có thể xử lý song song hoặc sau, không cần Round 3 Backend Engineer riêng cho việc này (thuộc Architect/BA).
- Trả lời câu hỏi có cần Round 3 Backend Engineer trước khi tới DevOps hay không: CÓ, khuyến nghị Round 3 trước khi bàn giao chính thức cho DevOps/Frontend không điều kiện — không phải vì patch Round 2 sai, mà vì rà soát độc lập lần này phát hiện thêm 2 gap robustness cùng nhóm với Bug #2 mà nếu không xử lý cùng lúc sẽ phải mở thêm 1 vòng review nữa sau này. Nếu team quyết định ưu tiên tốc độ, có thể bàn giao DevOps/Frontend ngay cho 2 gap CHẶN đã đóng (rủi ro thấp, thao tác admin không thường xuyên), miễn là 3 finding Non-blocking được ghi nhận thành backlog rõ ràng cộng Frontend được cảnh báo không cho phép UI gửi items trùng salaryItemId (giảm thiểu finding 5.2 từ phía client trong lúc chờ Backend vá).

Người review tiếp theo: Backend Engineer (Round 3, xử lý Mục 10 Non-blocking số 1 tới số 3) rồi tới Tester-QA (re-verify Round 3) rồi tới Code-Reviewer (re-verify Round 3, nếu cần).

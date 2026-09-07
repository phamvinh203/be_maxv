# Nhật Ký Vấn Đề, Lỗi & Khuyến Nghị Nâng Cấp (Issues, Bug Log & Engineering Considerations)
## Phân hệ: Dữ liệu Tính Lương (du_lieu_tinh_luong / HRM-PAYROLL-DATA)

> **Mã tài liệu**: `QA-ISSUES-DLTL-PHASE4`  
> **Phiên bản**: 1.0.0  
> **Ngày lập**: 2026-09-06  
> **Vai trò**: QA Test Lead & Dynamic Verification Engineer  
> **Giai đoạn**: Phase 4 (Phase B: Dynamic Test Execution & Verification)  
> **Tài liệu liên quan**:  
> - Báo cáo Kiểm thử: [`docs/du_lieu_tinh_luong/qa/test-report.md`](./test-report.md)  
> - Ma trận Truy vết: [`docs/du_lieu_tinh_luong/qa/test-matrix.md`](./test-matrix.md)  
> - Working Memory: [`docs/du_lieu_tinh_luong/CONTEXT_SUMMARY.md`](../CONTEXT_SUMMARY.md)  

---

## 1. Bảng Tóm Tắt Tình Trạng Lỗi (Defect & Issue Summary)

```
========================================================================================
                          DEFECT & ISSUE TRACKING SUMMARY
========================================================================================
 Mức độ Nghiêm trọng (Severity)       Phát hiện      Đã Khắc phục     Còn tồn đọng (Open)
----------------------------------------------------------------------------------------
 Blocker (Lỗi chặn hệ thống)              0               0                   0
 Critical (Lỗi tài chính/bảo mật)         0               0                   0
 Major (Lỗi chức năng chính)              0               0                   0
 Minor (Lỗi test runner / timing)         1               1                   0 (Đã fix)
 Trivial (Cảnh báo linter code style)     4               4                   0 (Đã dọn sạch)
----------------------------------------------------------------------------------------
 TỔNG CỘNG LỖI MÃ NGUỒN PHÁT HIỆN:        0 Lỗi Logic / 0 Lỗi Nghiệp vụ
========================================================================================
```

---

## 2. Danh Mục Các Lỗi / Issues Phát Hiện & Đã Xử Lý (Resolved Issues Log)

### ISSUE-DLTL-01 (Resolved): Flaky Clock Drift trong Unit Test `src/common/session-idle.spec.ts`
- **Phân loại**: Minor / Test Environment Flakiness
- **Mô tả hiện tượng**:
  Khi chạy toàn bộ test suite tự động với `npm test`, ca kiểm thử:
  `SessionIdle.extendIfNeeded > còn đúng nửa cửa sổ (== 4h) → KHÔNG update DB (biên: chỉ update khi NHỎ HƠN nửa cửa sổ)`
  thỉnh thoảng bị fail với lỗi:
  ```text
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  ```
- **Nguyên nhân gốc rễ (Root Cause Analysis)**:
  Trong file test, đối tượng session được khởi tạo với:
  ```typescript
  const session = { id: 's1', idleExpiresAt: new Date(Date.now() + 4 * 3600_000) };
  ```
  Khi hàm `SessionIdle.extendIfNeeded` được thực thi ở dòng tiếp theo, hàm lại gọi `Date.now()` một lần nữa. Do có độ trễ mili-giây tự nhiên giữa 2 lần gọi `Date.now()`, hiệu số `session.idleExpiresAt.getTime() - now` bị giảm đi 1ms (ví dụ còn `14.399.999ms`), nhỏ hơn ngưỡng `halfWindowMs` (`14.400.000ms`), khiến logic hiểu nhầm là đã dưới nửa cửa sổ và kích hoạt lệnh update DB.
- **Giải pháp khắc phục (Resolution)**:
  Sử dụng Vitest Fake Timers trong file `src/common/session-idle.spec.ts` để cố định thời gian hệ thống và loại bỏ hoàn toàn hiện tượng trôi mili-giây:
  ```typescript
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  ```
- **Kết quả xác minh**: Test suite chạy lại đạt **342 / 342 tests pass 100%**, ổn định và deterministic.

---

### ISSUE-DLTL-02 (Resolved): Cảnh báo Unused Imports trong các File Test Spec của Payroll
- **Phân loại**: Trivial / Code Style Cleanliness
- **Mô tả hiện tượng**:
  Lệnh `npm run lint` hiển thị 4 cảnh báo:
  1. `src/hr/payroll/periods/payroll-periods.service.spec.ts`: `PayrollError` is imported but never used.
  2. `src/hr/payroll/catalogs/payroll-catalogs.service.spec.ts`: `PayrollError` is imported but never used.
  3. `src/hr/payroll/calculation/payroll-calculation.service.spec.ts`: `AttendanceType` is imported but never used.
  4. `src/hr/payroll/calculation/payroll-calculation.service.spec.ts`: `OvertimeType` is imported but never used.
- **Giải pháp khắc phục**:
  Đã loại bỏ toàn bộ các import thừa trên trong cả 3 file spec.
- **Kết quả xác minh**: `npm run lint` chạy lại trả về **0 error, 0 warning**, hoàn toàn sạch sẽ.

---

## 3. Các Điểm Lưu Ý Kỹ Thuật & Giới Hạn Đã Biết (Engineering Considerations & Known Limitations)

### CONSIDERATION-01: Giá trị Ngày công chuẩn mặc định trong `PayrollCalculationService`
- **Hiện trạng**:
  Trong `src/hr/payroll/calculation/payroll-calculation.service.ts` (dòng 192), biến `standardWorkDays` đang được khởi tạo giá trị cố định:
  ```typescript
  const standardWorkDays = 26.0;
  ```
- **Đánh giá rủi ro**: Thấp đối với giai đoạn hiện tại (chuẩn chung tại Việt Nam là 24 hoặc 26 ngày).
- **Khuyến nghị cho Sprint tiếp theo**:
  Khi phân hệ Cài đặt Chấm công (`GeneralSetting`) được tích hợp sâu, cần bổ sung logic đọc phương pháp tính ngày công chuẩn từ `GeneralSetting` (cố định 24, cố định 26 hoặc theo số ngày làm việc thực tế của từng tháng cụ thể) để gán cho `standardWorkDays`.

---

### CONSIDERATION-02: Kiểu dữ liệu Tiền tệ 32-bit `Int` vs Doanh số Doanh nghiệp Lớn
- **Hiện trạng**:
  Trong `Backend/prisma/schema.prisma`, các cột tiền tệ như `amount`, `baseSalaryMonthly`, `totalAmount`, `grossIncome` đang sử dụng kiểu dữ liệu `Int` của PostgreSQL.
- **Giới hạn kỹ thuật**:
  Kiểu `Int` trong PostgreSQL là số nguyên 32-bit có dấu, với giá trị tối đa là $2.147.483.647$ (khoảng **2.14 tỷ VNĐ**).
- **Đánh giá rủi ro**:
  - Với lương cá nhân của một nhân viên thông thường, con số 2.14 tỷ VNĐ/tháng là hoàn toàn dư dả.
  - Tuy nhiên, đối với cột `baseAmount` (doanh số cơ sở để tính lương phần trăm) của nhân viên kinh doanh bất động sản, xe hơi cao cấp, hoặc tổng quỹ lương công ty `totalCompanyCost`, con số có thể vượt qua 2.14 tỷ VNĐ.
- **Khuyến nghị**:
  Trong Phase tiếp theo hoặc khi tối ưu hóa cơ sở dữ liệu doanh nghiệp lớn (Enterprise Edition), nên migrate các cột:
  - `commission_records.base_amount`
  - `payroll_sheet_lines.total_company_cost`
  sang kiểu `BigInt` hoặc `Decimal(15, 0)` để hỗ trợ doanh số lên tới hàng ngàn tỷ đồng mà không lo bị tràn số (Integer Overflow).

---

### CONSIDERATION-03: Cảnh báo `TSConfckParseError` ngoài Workspace khi chạy Vitest
- **Hiện trạng**:
  Khi chạy `vitest run`, terminal xuất hiện một số dòng cảnh báo:
  `[tsconfig-paths] An error occurred while parsing "C:\Users\Admin\AppData\Local\Programs\cursor\...`
- **Nguyên nhân**:
  Plugin `vite-tsconfig-paths` mặc định tự động quét tìm tất cả các file `tsconfig.json` trên ổ đĩa, bao gồm cả thư mục tiện ích mở rộng của VS Code và Cursor Editor.
- **Khuyến nghị**:
  Nên cấu hình tùy chọn `ignoreConfigErrors: true` hoặc giới hạn `projects: ['./tsconfig.json']` trong `vitest.config.ts` để triệt tiêu các thông báo không liên quan này, giúp log CI/CD gọn gàng hơn.

---

### CONSIDERATION-04: Xử lý Hiệu năng khi Khóa sổ cho Doanh nghiệp Quy mô lớn (> 5.000 Nhân sự)
- **Hiện trạng**:
  Phương thức `PayrollPeriodsService.lock()` hiện đang thực hiện:
  1. `this.calculationService.calculatePeriodPayroll(id)` (Fetch toàn bộ nhân viên và 8 phân hệ vào bộ nhớ RAM và tính toán).
  2. Lưu toàn bộ bản ghi snapshot trong một `$transaction` duy nhất.
- **Đánh giá**:
  - Với công ty dưới 1.000 nhân sự: Thời gian thực thi cực nhanh ($< 500\text{ms}$).
  - Với công ty trên 5.000 nhân sự: Một `$transaction` duy nhất có thể giữ connection pool lâu hơn 5 giây và tiêu tốn nhiều bộ nhớ.
- **Khuyến nghị**:
  Đối với phiên bản Enterprise, nên áp dụng kỹ thuật **Batch Chunking** (chia thành các batch 500 nhân viên) hoặc đưa tác vụ tính toán vào Background Job Queue (BullMQ) với cơ chế Worker độc lập.

---

## 4. Đề Xuất Cải Tiến Cho Tương Lai (Future Enhancements Roadmap)

| Mã Đề Xuất | Tên Tính Năng Đề Xuất | Lợi ích Mang Lại | Dự kiến Triển khai |
|---|---|---|:---:|
| **ENH-DLTL-01** | **Bù trừ Tự động Đa kỳ (Cross-Period Debt Carryover)** | Khi một nhân viên có thực lĩnh âm (`netTakeHomeSalary < 0`) ở kỳ $T$, hệ thống tự động sinh khoản bù trừ loại `tru` (Thu hồi công nợ tạm ứng, mã `BT02`) ở kỳ $T+1$ mà không cần kế toán phải nhập tay. | Sprint 4 (Payroll Auto-Adjust) |
| **ENH-DLTL-02** | **Xuất Phiếu Lương PDF & Gửi Email Hàng Loạt** | Sau khi kỳ lương chuyển sang `PAID`, hệ thống cung cấp nút bấm "Gửi phiếu lương", tự động render PDF phiếu lương có bảo mật mật khẩu (số CCCD/ngày sinh) và gửi email tự động cho từng nhân viên. | Sprint 5 (Employee Portal) |
| **ENH-DLTL-03** | **Tích hợp Webhook & Notification Real-time** | Gửi thông báo WebSocket / Telegram / Slack cho Giám đốc khi bảng lương chuyển sang trạng thái `LOCKED` chờ duyệt, và thông báo cho Kế toán khi có yêu cầu Reopen kèm lý do. | Sprint 5 (Integrations) |
| **ENH-DLTL-04** | **Phân tích Biến động Chi phí Lương (Payroll Analytics Diff)** | Cung cấp báo cáo so sánh tự động giữa kỳ này và kỳ trước: Tăng/giảm chi phí lương bao nhiêu %, nhân viên nào có biến động thu nhập đột biến ($> 30\%$) để cảnh báo sai sót trước khi duyệt. | Sprint 6 (BI & Reporting) |

---

## 5. Kết Luận (Phase 4 — nguyên trạng lúc ký, 2026-09-06 đợt 5)

> ⚠️ **Đã bị rút lại một phần bởi rà soát retrospective Đợt 6 (2026-09-06) — xem Mục 6 bên dưới.** Kết luận dưới đây chỉ đúng trong phạm vi các test case đã thực sự tự động hoá ở Phase 4; audit độc lập sau đó phát hiện một số hạng mục được ghi nhận "✅ PASS" thực chất chưa có test hoặc chưa có code tương ứng.

Phân hệ **Dữ liệu Tính Lương (`du_lieu_tinh_luong`)** ở Phase 4:
- **0 Lỗi Nghiêm trọng phát hiện được trong phạm vi test tự động Phase 4** (Zero Blocker/Critical/Major Defects *trong các test đã chạy* — không đồng nghĩa không còn gap, xem Mục 6).
- Các issue nhỏ phát sinh trong quá trình test runner (flaky clock, unused imports) đã được xử lý triệt để 100%.
- Các điểm lưu ý và đề xuất cải tiến (Mục 3, 4) đã được ghi chép làm tài liệu tham chiếu.
- ~~Hệ thống hoàn toàn sẵn sàng cho quá trình tích hợp giao diện Frontend và nghiệm thu người dùng (UAT).~~ **Không còn đúng** — xem khuyến nghị Gate mới ở Mục 6.5.

---

## 6. Rà soát Retrospective Đợt 6 (2026-09-06) — Gate 4 Sign-off RÚT LẠI

> **Quy trình**: BA rà soát lại toàn bộ artifact đối chiếu code → Architect + Tester-QA thẩm định độc lập song song → BA chốt (mục này). Cả 3 vai trò xác nhận thống nhất các phát hiện dưới đây. Chi tiết đầy đủ (path:line, effort, migration) lưu trong transcript audit — mục này là bản tóm tắt chính thức làm căn cứ hành động.

### 6.1. Phát hiện mức 🔴 P0 (chặn Gate, đã giao Backend Engineer sửa ngay)

| Mã | Vấn đề | Bằng chứng | Quyết định BA (locked) |
|---|---|---|---|
| **RETRO-01** | **BR-dltl-002 chưa cài đặt**: 8 input services + `payroll-scope.dto.ts` + `payroll-calculation.service.ts` chỉ check nhân viên tồn tại (`!emp`), không check `Contract` còn hiệu lực tại kỳ lương → nhân viên nghỉ việc vẫn được tính lương qua phạm vi "toàn công ty"/"phòng ban". | `attendance.service.ts:129`, `payroll-scope.dto.ts:59-89`, `payroll-calculation.service.ts:92-108` (7 điểm tương tự khác) | Xác định "đang làm việc" = có `Contract` bao phủ kỳ (đã sửa wording BR-dltl-002 trong `srs/du_lieu_tinh_luong-spec.md`). Phạm vi `nhan_vien` (chọn thủ công) trúng nhân viên không active → từ chối rõ bằng `E-dltl-002`; phạm vi `phong_ban`/`toan_cong_ty` → lọc âm thầm. Không thêm field `Employee.status` mới. |
| **RETRO-02** | **Excel IO là stub giả**: `importExcel()` không ghi DB, không `$transaction`; `exportExcel()` trả `data: []` cứng; giao thức API nhận JSON thay vì multipart `.xlsx` như `api-contract.md` đã đặc tả. 0 test cho module. | `Backend/src/hr/payroll/excel/payroll-excel.service.ts:32-87`, `payroll-excel.controller.ts:33-39`, `package.json` (không có `exceljs`/`xlsx`) | Chọn **Phương án A**: giữ đúng contract đã duyệt — multipart `.xlsx` thật, dùng `exceljs`, validate-then-commit 2 pha trong 1 `$transaction`, router theo `moduleName` tái sử dụng 8 service input sẵn có. Lý do: Frontend chưa triển khai (tạm hoãn theo `.claude/CLAUDE.md`) nên đổi giao thức bây giờ không gây rework FE, và giữ đúng tinh thần "Excel IO" ban đầu cho người dùng cuối (kế toán) — họ cần file Excel thật, không phải JSON. |
| **RETRO-03** | **Báo cáo test sai lệch tính trung thực**: `test-report.md` ghi "✅ PASS" cho nhiều case không có test thật hoặc code không khớp mô tả (TC-DLTL-014, 016, 064, 071, 072, 076; tuyên bố "26/26 mã lỗi 100%" trong khi Tester-QA audit độc lập xác nhận chỉ 17/26 mã có test thật — 9 mã thiếu test: `E-dltl-002,003,004,008,013,018,021,024,026`; `E-dltl-026` chưa từng được `throw` ở bất kỳ đâu — dead code). | Xem báo cáo Tester-QA Đợt 6 (bảng audit 26 mã lỗi đầy đủ) | Ghi nhận là lỗi quy trình QA (ưu tiên "làm đẹp con số" hơn đối chiếu trung thực với SRS) — không sửa lại `test-report.md` gốc (giữ nguyên làm hồ sơ lịch sử), addendum cảnh báo đã thêm ở đầu Mục 5. Yêu cầu Tester-QA viết bổ sung ≥9 test case thiếu (danh sách chi tiết trong báo cáo audit) trước khi ký lại Gate 4. |

### 6.2. Phát hiện mức 🟠 P1 (chưa giao sửa ngay — theo dõi sprint kế tiếp)

- **RETRO-04 — Race condition khi `lock()`**: `calculatePeriodPayroll()` đọc dữ liệu NGOÀI transaction trước khi flip status → 2 request đồng thời có thể làm mất dữ liệu vừa ghi mà không cảnh báo (TOCTOU). Đề xuất: flip `status=LOCKED` bằng `updateMany(... WHERE status IN (DRAFT,PENDING_REVIEW))` TRƯỚC khi tính toán.
- **RETRO-05 — Thiếu audit log cho `lock()/approve()/markPaid()/archive()`**: chỉ `reopen()` có ghi `audit_logs`, vi phạm ADR-001 §3.4/§4.1. Cần thêm event `PAYROLL_PERIOD_LOCKED` vào enum `AuditEvent` + 4 điểm gọi log.
- **RETRO-06 — `GeneralSetting` bị hardcode toàn diện** (không chỉ ngày công/OT như CONSIDERATION-01 ghi nhận, mà cả bảo hiểm 10.5%/21.5%, công đoàn, giảm trừ thuế, 7 bậc thuế TNCN). Rủi ro "âm ỉ": chỉ lộ sai khi khách hàng đổi cấu hình khỏi giá trị mặc định. Snapshot đã LOCKED không bị ảnh hưởng (an toàn ngược), chỉ kỳ đang DRAFT bị sai.
- **RETRO-07 — EC-01 (nhân viên vào làm giữa tháng)**: `payroll-calculation.service.ts` không liên kết `Contract.effectiveFrom` để loại trừ ngày trước khi vào làm; nếu thiếu attendance override, mặc định tính đủ `standardWorkDays` (26 công) — sai lệch lương thật cho nhân viên mới.
- **RETRO-08 — Tràn số Int32** cho `commission_records.baseAmount/.totalAmount` — cần thêm `.max()` validate ở DTO (nhỏ, nên làm sớm), đổi sang `Decimal(15,0)` để sau.

### 6.3. Phát hiện mức 🟡 P2 (backlog, chỉ cần sửa wording tài liệu ngay)

- **RETRO-09 — EC-03 / ADR-001 mâu thuẫn với chính `ENH-DLTL-01`**: ADR-001 khẳng định "tự động đưa sang khoản BT02 kỳ sau" đã tồn tại, nhưng code chưa có (0 kết quả grep `carryover`/`BT02`), và chính Mục 4 file này đã liệt kê nó là `ENH-DLTL-01` (đề xuất tương lai). Phần "giữ số âm không ép về 0" thì **đã đúng và có test thật**. Cần sửa wording ADR-001/EC-03 để không ngụ ý đã tự động hoá — để lại cho lần cập nhật ADR-001 kế tiếp, không chặn Gate P0.
- **RETRO-10 — `E-dltl-026`/EC-05 (optimistic lock khi 2 người cùng áp dụng bảng)**: mã lỗi tồn tại nhưng chưa từng implement cơ chế lock thật. Tạm chấp nhận last-write-wins cho MVP; đánh dấu "reserved, chưa implement" thay vì coi là đã có.

### 6.3.5. Cập nhật sau khi Backend fix RETRO-01/02 — phát hiện thêm 1 Blocker mới

Sau khi Backend Engineer hoàn thành RETRO-01/RETRO-02 (376/376 test pass) và Tester-QA verify lại đạt cả 2, Tester-QA được giao bổ sung 7 test case còn thiếu (E-dltl-003/004/008/013/018/021/026 — đã hoàn thành, 9/9 mã lỗi nay có coverage thật, 388/388 test pass). Trong lúc viết e2e test thật cho luồng multipart Excel (`Backend/test/payroll-excel.e2e-spec.ts`), phát hiện:

| Mã | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| **RETRO-11** | **Toàn bộ schema payroll (14 model, 6 enum, ~10 bảng) chưa từng được migrate ra Postgres thật** — `prisma migrate diff` (live DB vs `schema.prisma`) trả về 14 `CreateTable` + 6 `CreateEnum` hoàn toàn mới. `prisma/migrations/` chỉ có 7 folder cũ, không có folder nào cho payroll. `data-model.md` Mục 5 đã chỉ định rõ tên file migration cần tạo (`..._add_payroll_data_module`) kèm **16 CHECK constraint** bảo vệ toàn vẹn dữ liệu tài chính (giờ công 0-24h, hệ số OT 100-500%, KPI target > 0...) — migration này chưa từng được viết. | `npx prisma migrate status`/`migrate diff` trong `Backend/`; lỗi thật khi chạy e2e: `PrismaClientKnownRequestError: The table "public.payroll_periods" does not exist` | 🔴 **Blocker — nghiêm trọng hơn RETRO-01/02**: module không thể chạy thật ở BẤT KỲ môi trường nào (dev/staging/production), dù 388/388 unit test mock đều xanh. |

**Nguyên nhân**: toàn bộ 388 unit test của phân hệ dùng Prisma mock, chưa từng có test nào (kể cả trước Đợt 6) chạm Postgres thật cho payroll — nên gap này không lộ ra qua bất kỳ vòng QA nào trước đó.

**Đã xử lý (2026-09-06, cùng ngày)**: Backend Engineer tạo migration `Backend/prisma/migrations/20260906112206_add_payroll_data_module/migration.sql` (14 CreateTable + 6 CreateEnum + đủ 16/16 CHECK constraint theo `data-model.md` Mục 5, verify trực tiếp qua `pg_constraint`), áp dụng vào **DB local test/dev** (`localhost:5435`, xác nhận qua `prisma migrate status` — không đụng staging/production Render). Sau đó fix 1 lỗi nhỏ trong chính test data của `test/payroll-excel.e2e-spec.ts` (mã kỳ lương tự sinh vượt `VARCHAR(20)`) và chạy lại: **4/4 kịch bản e2e Excel pass thật trên Postgres thật**; chạy thêm toàn bộ e2e suite dự án: 11/12 file pass, 1 file (`salary-settings.e2e-spec.ts`) timeout khi chạy chung do nghẽn connection pool — chạy lại độc lập thì 23/23 pass, xác nhận đây là nhiễu môi trường (flaky khi chạy nhiều e2e suite liên tiếp), không phải regression từ migration. Unit test vẫn 388/388, lint/build sạch.

### 6.4. Nguồn tham chiếu

Toàn bộ chi tiết path:line, effort estimate, migration plan nằm trong báo cáo audit của BA/Architect/Tester-QA chạy ngày 2026-09-06 (không xuất thành file riêng theo yêu cầu read-only-audit; các quyết định đã khoá ở Mục 6.1 là căn cứ chính thức cho Backend Engineer).

### 6.5. Quyết định Gate (BA Final Sign-off)

**Cập nhật 2026-09-06 — GATE 4 KÝ LẠI (APPROVED, có điều kiện theo dõi backlog)**. Cả 4 điều kiện đã đạt:
1. ✅ Backend Engineer hoàn thành RETRO-01 (chặn nhân viên nghỉ việc) và RETRO-02 (Excel IO thật) — Tester-QA verify độc lập ĐẠT, 376/376 test, không hồi quy.
2. ✅ Tester-QA viết bổ sung đủ 9/9 mã lỗi thiếu coverage (388/388 test).
3. ✅ RETRO-11 (migration DB chưa từng áp dụng) — đã tạo + áp dụng migration vào DB local, e2e Excel 4/4 pass thật trên Postgres thật.
4. ✅ BA ký lại `CONTEXT_SUMMARY.md` Mục 9 (mục này).

**Ghi chú cho lần ký lại này**: khác Gate 4 Đợt 5 (dựa hoàn toàn vào test mock, chưa từng chạm DB thật), Gate 4 Đợt 6 có bằng chứng e2e thật trên Postgres thật cho luồng quan trọng nhất (Excel IO + chặn nhân viên nghỉ việc + khóa sổ). Đây là cải thiện chất lượng nghiệm thu đáng kể so với quy trình cũ.

RETRO-04..10 (P1/P2: race condition khi `lock()`, thiếu audit log, `GeneralSetting` hardcode, EC-01, EC-03/ADR-001 wording, tràn Int32, `E-dltl-026` reserved) **không chặn Gate 4** nhưng PHẢI đưa vào backlog sprint kế tiếp — không được để trôi thành "quên" như CONSIDERATION-01 từng bị đánh giá thấp hơn thực tế trong Đợt 5. Khuyến nghị ưu tiên sprint kế tiếp theo đúng thứ tự Architect đã đề xuất: RETRO-04 (race condition) và RETRO-08 (validate Int32) trước vì effort nhỏ mà rủi ro không nhỏ, RETRO-06 (GeneralSetting) làm trọn vẹn 1 đợt vì chung root cause.

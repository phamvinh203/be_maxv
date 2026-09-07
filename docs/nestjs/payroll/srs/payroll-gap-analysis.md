---
type: srs
feature: payroll
status: draft
updated: 2026-09-06
links:
  - docs/payroll/srs/payroll-spec.md
  - docs/payroll/srs/payroll-states.md
  - docs/payroll/srs/payroll-erd.md
  - docs/payroll/srs/payroll-flows.md
  - docs/payroll/architecture/api-contract.md
  - docs/payroll/architecture/data-model.md
  - docs/payroll/qa/test-matrix.md
  - docs/payroll/qa/test-cases.md
  - docs/payroll/qa/test-report.md
  - docs/payroll/qa/issues-and-bugs.md
  - docs/payroll/CONTEXT_SUMMARY.md
---

# Rà soát Độc lập & Phân tích Lỗ hổng Hồ sơ Phân hệ Bảng lương (Payroll Gap Analysis)

> **Mã tài liệu**: `GAP-PAY-001`
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)
> **Người thực hiện**: Lead Business Analyst (rà soát độc lập, hoài nghi có chủ đích)
> **Ngày lập**: 2026-09-06
> **Phạm vi**: Toàn bộ 12 tài liệu trong `docs/payroll/` + đối chiếu chéo với mã nguồn thật (`Backend/prisma/schema.prisma`, `Backend/src/hr/payroll/`)
> **Tính chất**: Tài liệu **đề xuất**, chưa merge vào `payroll-spec.md`. Không sửa bất kỳ file nào khác.

---

## 0. Bối cảnh & Kết luận Điều hành

Hồ sơ hiện tại tự tuyên bố tại `docs/payroll/CONTEXT_SUMMARY.md:115` rằng kết quả đối soát là *"100% khớp nối, không còn bất kỳ mâu thuẫn hay lỗ hổng nghiệp vụ nào"* và chấm **10/10** cho cả 4 tiêu chí sẵn sàng (`CONTEXT_SUMMARY.md:155-158`). Đợt rà soát độc lập này **bác bỏ tuyên bố đó**.

**Kết quả tổng hợp:**

| Nhóm phát hiện | Số lượng | Mức nghiêm trọng cao nhất |
|---|:---:|:---:|
| Mâu thuẫn nội bộ giữa các tài liệu (Mục 1) | **31** | P0 |
| Sai lệch giữa tài liệu và mã nguồn/schema thật (Mục 1) | **17** | P0 |
| Khiếm khuyết định nghĩa/số học trong ví dụ Gherkin (Mục 2) | **9** | P0 |
| Lỗ hổng nghiệp vụ chưa được đặc tả (Mục 3) | **24** | P0 |
| Mục bắt buộc của một SRS bị thiếu hoàn toàn | **5** | P0 |

**Ba kết luận quan trọng nhất:**

1. **Hồ sơ không phải là một SRS hoàn chỉnh.** Không tồn tại Yêu cầu chức năng (`FR-pay-*`), Yêu cầu phi chức năng (`NFR-pay-*`), Phạm vi/Ngoài phạm vi, Giả định, Ràng buộc, Câu hỏi mở. Kiểm chứng: tìm kiếm chuỗi `NFR` trên toàn bộ `docs/payroll/` trả về **0 kết quả**.
2. **Hai nghiệp vụ có rủi ro tài chính trực tiếp đang bị bỏ trắng**: (a) hợp đồng lương **NET** được tính hệt như GROSS, nhân viên nhận sai số tiền đã cam kết; (b) giảm trừ **người phụ thuộc** được tính trên tổng số NPT đăng ký, không lọc theo tháng hiệu lực, dẫn tới khấu trừ thiếu thuế và rủi ro truy thu.
3. **Chuỗi truy vết bị đứt ở nhiều điểm**: số ca kiểm thử thật là **41**, không phải 40; phân bổ ưu tiên trong ma trận (18/16/6) lệch hoàn toàn so với thực tế (28/11/2); ba mã `TC-PAY-071/072/074` bị gán hai nghĩa khác nhau trong cùng bộ hồ sơ.

---

## 1. Bảng Audit Tính Nhất quán Nội bộ (Consistency Audit)

Ký hiệu mức: **P0** = phải sửa trước khi release/bàn giao tiếp; **P1** = sửa trong đợt kế tiếp; **P2** = ghi nhận nợ tài liệu.

### 1.1. Nhóm A — Mâu thuẫn giữa các tài liệu nghiệp vụ

| # | Vị trí (file:line) | Mô tả mâu thuẫn | Mức |
|:---:|---|---|:---:|
| A-01 | `qa/test-cases.md:901` vs đếm thật toàn file | Tài liệu ghi **"40 Scenarios"**; đếm thật các định danh `TC-PAY-xxx` được định nghĩa cho ra **41 ca** (Nhóm 1: 3, Nhóm 2: 4, Nhóm 3: 4, Nhóm 4: 4, Nhóm 5: 4, Nhóm 6: 5, Nhóm 7: 6, Nhóm 8: 11). Con số 40 được nhân bản sang `test-matrix.md:56`, `CONTEXT_SUMMARY.md:96` và `CONTEXT_SUMMARY.md:152`. | P1 |
| A-02 | `qa/test-matrix.md:53-56` vs `qa/test-cases.md` (toàn file) | Phân bổ ưu tiên trong ma trận là **P0=18 (45%), P1=16 (40%), P2=6 (15%)**. Đếm thật nhãn "Mức ưu tiên" trong từng ca: **P0=28, P1=11, P2=2**. Lệch 10 ca ở P0 — nghĩa là khối lượng kiểm thử chặn phát hành bị đánh giá thấp hơn thực tế 55%. | P0 |
| A-03 | `CONTEXT_SUMMARY.md:211-213` vs `qa/test-cases.md:704,721,755` | Ba mã bị gán **hai nghĩa xung đột**: `TC-PAY-071` (bộ chuẩn: `E-pay-002` tính lại khi đã khóa) bị mô tả là "thực lĩnh âm"; `TC-PAY-072` (bộ chuẩn: `E-pay-003` cấu hình sai) bị mô tả là "chặn sàn chuyên cần"; `TC-PAY-074` (bộ chuẩn: `E-pay-005` không có NV hợp lệ) bị mô tả là "giảm trừ > thu nhập". Mã đúng lần lượt là `TC-PAY-060`, `TC-PAY-061`, `TC-PAY-062`. | P0 |
| A-04 | `CONTEXT_SUMMARY.md:211-213` vs `CONTEXT_SUMMARY.md:230` | Ngay trong cùng một file: Mục 8.2 dùng bộ mã sai (071/072/074), Mục 9.1 dùng bộ mã đúng (060/061/062/063). Tự mâu thuẫn. | P0 |
| A-05 | `srs/payroll-spec.md:57` | Tiêu đề Mục 4 ghi phạm vi **`BR-pay-001` .. `BR-pay-020`** nhưng chỉ định nghĩa tới `BR-pay-011`. Chín mã bị "đặt chỗ" mà không có nội dung. | P1 |
| A-06 | `architecture/api-contract.md:67,507` vs `srs/payroll-states.md:74,114` | **Quyền khóa sổ từ `DRAFT`**: API Contract cho phép `lock` ở `PENDING_REVIEW` *hoặc* `DRAFT`; State Machine chỉ cho `PENDING_REVIEW → LOCKED` và đánh dấu `DRAFT`→lock là ❌. Nếu theo API Contract, cổng đối soát của Kế toán bị vô hiệu hóa hoàn toàn. | P0 |
| A-07 | `architecture/api-contract.md:71,511` vs `srs/payroll-states.md:78,118` vs `qa/test-matrix.md:142` | **Quyền lưu trữ (`archive`)**: API Contract = "CHỈ `ADMIN`"; State Machine và Test Matrix = `ACCOUNTANT` + `ADMIN`. | P1 |
| A-08 | `architecture/api-contract.md:70` vs `qa/test-cases.md:861`, `qa/test-matrix.md:141`, `srs/payroll-states.md:49` | **Đường dẫn endpoint khác nhau**: Contract định nghĩa `POST /payroll/periods/:id/mark-paid`; QA và State Machine gọi `POST /payroll/periods/{id}/pay`. Ca `TC-PAY-079` chạy theo tài liệu QA sẽ nhận 404 thay vì `E-pay-010`. | P0 |
| A-09 | `architecture/api-contract.md:60-72` vs `srs/payroll-states.md:72-73`, `qa/test-matrix.md:136-137` | **Thiếu hoàn toàn 2 endpoint**: `POST /periods/:id/submit` (`DRAFT → PENDING_REVIEW`) và `POST /periods/:id/reject` (`PENDING_REVIEW → DRAFT`) có trong máy trạng thái và ma trận RBAC nhưng **không nằm trong danh mục 11 endpoint** của Hợp đồng API. Hai trong tám chuyển trạng thái không có giao diện để kích hoạt. | P0 |
| A-10 | `architecture/api-contract.md:63-64` vs `architecture/api-contract.md:503-504` | Tự mâu thuẫn trong cùng file: Mục 2 ghi `GET /payroll/sheet-lines` chỉ áp dụng cho `LOCKED, APPROVED, PAID, ARCHIVED`; Mục 5 lại ghi "⚠️ Đọc nháp" ở `DRAFT` và `PENDING_REVIEW`. | P1 |
| A-11 | `architecture/api-contract.md:66` vs `architecture/api-contract.md:506` | Tự mâu thuẫn: Mục 2 ghi `GET /payroll/payslips/my` cho `EMPLOYEE, ADMIN, HR, ACCT`; Mục 5 chỉ ghi `EMPLOYEE`. | P2 |
| A-12 | `architecture/api-contract.md:44-53` vs `qa/issues-and-bugs.md:56-63` | **Hai định dạng phong bì lỗi khác nhau**: Contract quy định `{ "success": false, "errorCode": "...", "message": "..." }`; QA lại yêu cầu `{ "error": { "code": "E-pay-008", "message": "..." } }`. Frontend/QA không thể viết assert thống nhất. | P0 |
| A-13 | `srs/payroll-states.md:88` vs `qa/test-cases.md:504` | Cùng mã `E-dltl-001` nhưng hai wording khác nhau: *"Kỳ lương đã khóa sổ, không thể chỉnh sửa dữ liệu"* vs *"Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu."* | P2 |
| A-14 | `srs/payroll-flows.md:12` vs `srs/payroll-flows.md:17` | Mục 1 mang tiêu đề **"Sơ đồ Phân làn Nghiệp vụ (Swimlane / Activity Diagram)"** nhưng nội dung là `sequenceDiagram`. Cả 4 sơ đồ trong file đều là sequence. Theo `.claude/CLAUDE.md`, quy trình ≥2 vai trò bắt buộc phải có Activity/Swimlane — deliverable này thực chất còn thiếu. `CONTEXT_SUMMARY.md:46` khẳng định đã có "Sơ đồ phân làn (Swimlane/Activity)". | P1 |
| A-15 | `srs/payroll-flows.md:19-21`, `srs/payroll-spec.md:36` vs `qa/test-matrix.md:129` | Sơ đồ và Ma trận Stakeholder có vai **"Ban Giám đốc (CEO/CFO)"** như một chủ thể phê duyệt độc lập, nhưng mô hình RBAC chỉ có **4 vai**: `ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE`. Vai Giám đốc bị gộp vào `ADMIN` — xem GAP-PAY-19 (vi phạm phân tách nhiệm vụ). | P0 |
| A-16 | `srs/payroll-spec.md:132` (BR-pay-008) vs `CONTEXT_SUMMARY.md:186` | **Hai công thức thực lĩnh khác nhau**. SRS: `gross − BH − CĐ − thuế − adjustmentNetAmount` (5 khoản trừ). CONTEXT_SUMMARY mô tả code: `gross − insurance − tradeUnion − pit − otherDeductions − advance` (6 khoản trừ). ERD không có cột `otherDeductions` hay `advance`. | P1 |
| A-17 | `qa/test-matrix.md:67` vs `qa/test-cases.md:108,398` | Ma trận khai `BR-pay-002 → TC-PAY-001, TC-PAY-003, TC-PAY-041`, nhưng `TC-PAY-003` chỉ truy vết `US-PAY-01, BR-pay-001, BR-pay-009` và `TC-PAY-041` chỉ truy vết `US-PAY-05, BR-pay-003`. Ánh xạ **một chiều**, không phải "hai chiều 100%" như tuyên bố ở `test-matrix.md` tiêu đề Mục 3. Thực tế `BR-pay-002` chỉ có **1** ca hậu thuẫn. | P1 |
| A-18 | `qa/test-report.md:76` vs `qa/test-matrix.md:70` | Báo cáo nghiệm thu ghi `BR-pay-005 → TC-PAY-010/011/012` (bỏ `TC-PAY-013`); ma trận thiết kế ghi đủ 4 ca. | P2 |
| A-19 | `qa/test-matrix.md:74` vs `qa/test-cases.md:108` | Ma trận khai `BR-pay-009 → TC-PAY-061` (1 ca), nhưng `TC-PAY-003` cũng truy vết `BR-pay-009` mà không được ghi nhận. Ánh xạ ngược thiếu. | P2 |
| A-20 | `qa/issues-and-bugs.md:22` vs `:28-30` vs `:112-138` | Ba con số khác nhau cho cùng một thứ: prose ghi "1 Bug Medium **và 3 Issues**"; bảng thống kê ghi Bugs=2, Issues=**2**, tổng 4; phần 3 liệt kê thật **3 issues** (`ISSUE-PAY-01/02/03`). `CONTEXT_SUMMARY.md:262-266` lại ghi **4 suggestions**. | P2 |
| A-21 | `qa/issues-and-bugs.md:82` | `BUG-PAY-02` khai "(kế thừa `RETRO-10` / **`EC-pay-006`**)". `EC-pay-006` là "Hợp đồng Thử việc chuyển sang Chính thức giữa tháng" — không liên quan gì tới optimistic lock. Tham chiếu sai. | P2 |
| A-22 | `qa/issues-and-bugs.md:74,104` vs `CONTEXT_SUMMARY.md:259-261` | `issues-and-bugs.md` đã đánh dấu cả `BUG-PAY-01` và `BUG-PAY-02` là **FIXED & VERIFIED**; `CONTEXT_SUMMARY.md` Mục 10.2 vẫn liệt kê chúng như 2 non-blocking issue còn tồn đọng. (Đã được main thread xác nhận; ghi lại để trọn ma trận.) | P1 |
| A-23 | `CONTEXT_SUMMARY.md:183,212` vs `srs/payroll-spec.md:119,135` | Gán sai mã quy tắc: "chặn sàn chuyên cần" bị gán `BR-pay-007` (thực tế `BR-pay-007` = Công đoàn; chặn sàn chuyên cần là `BR-pay-009`). (Đã được main thread xác nhận.) | P1 |
| A-24 | `CONTEXT_SUMMARY.md:5` vs `:162` vs `:242` | Ba chuỗi trạng thái khác nhau cùng tồn tại: `Status: Completed & Signed Off by Code Reviewer`, `Status: Ready for Backend`, `Status: Ready for Code Review`. Không có trường trạng thái duy nhất đọc được bằng máy. | P2 |
| A-25 | `CONTEXT_SUMMARY.md:215-216` vs `:229-230,252` vs kết quả chạy thật | Ba bộ số kiểm thử: 405/405 & 113/113 (Mục 8.2), 413/413 & 121/121 (Mục 9.1 và 10.1). Kết quả chạy thật đã xác minh: **414 tests PASSED / 33 files**. Không con số nào trong hồ sơ khớp thực tế. | P1 |
| A-26 | `srs/payroll-spec.md:320` (EC-pay-004), `qa/test-cases.md:619` vs `srs/payroll-erd.md:143` | **Một tên trường mang hai nghĩa pháp lý khác nhau.** `taxableIncome` được ERD định nghĩa là *"Thu nhập chịu thuế sau khi trừ các khoản miễn thuế"* (dùng đúng ở `TC-PAY-001`), nhưng `EC-pay-004`/`TC-PAY-062` lại dùng chính tên đó cho *"Thu nhập tính thuế"* (sau giảm trừ gia cảnh). Đây là hai khái niệm thuế riêng biệt. | P0 |
| A-27 | `srs/payroll-erd.md:94,170` vs `qa/test-cases.md` Nhóm 5 | Miền giá trị `item_category` không có giá trị nào dành cho khoản **ăn giữa ca**; `BENEFIT` là nhóm gộp. Không có cơ chế định danh khoản ăn trưa — xem GAP-PAY-08. | P0 |
| A-28 | `srs/payroll-spec.md:311` (EC-pay-001) | Quy định cứng *"Số ngày công chuẩn vẫn giữ nguyên theo kỳ (26.0)"* trong khi hệ thống có tham số `WorkDayMethod` với 2 chế độ (`FIXED_26` / `ACTUAL`). Đặc tả bỏ qua nhánh `ACTUAL`. | P1 |
| A-29 | `qa/test-matrix.md:56` | Tuyên bố "**Bao phủ 100% SRS, Flow, State và ERD**" nhưng ma trận không có bất kỳ dòng nào truy vết tới `payroll-flows.md` (6 Stage / 4 sơ đồ) hay các cột dữ liệu của `payroll-erd.md`. | P2 |
| A-30 | `srs/payroll-states.md` (toàn file) | Máy trạng thái **không có đường lùi** từ `APPROVED` hay `PAID` (không có `unapprove`, không có `cancel`, không có kỳ điều chỉnh). Thực tế nghiệp vụ luôn phát sinh sai sót sau khi duyệt/chi trả — xem GAP-PAY-03. | P0 |
| A-31 | `srs/payroll-spec.md` (toàn file) | **Thiếu 5 mục bắt buộc của một SRS**: Phạm vi & Ngoài phạm vi; Yêu cầu chức năng có mã `FR-pay-*`; Yêu cầu phi chức năng `NFR-pay-*`; Giả định (Assumptions); Ràng buộc (Constraints) và Câu hỏi mở (Open Questions). Đối chiếu `.claude/rules/naming-conventions.md` (Mục ID conventions) và `.claude/CLAUDE.md` (Deliverables của Business Analyst). | P0 |

### 1.2. Nhóm B — Sai lệch giữa tài liệu và mã nguồn/schema thật

Các phát hiện dưới đây được xác minh trực tiếp trên `Backend/prisma/schema.prisma` và `Backend/src/hr/payroll/calculation/payroll-calculation.service.ts`.

| # | Tài liệu nói | Thực tế trong mã nguồn | Mức |
|:---:|---|---|:---:|
| B-01 | `CONTEXT_SUMMARY.md:172` mô tả model mới gồm `payrollSheetLineId`, `itemType`, `amount`, `taxTreatment`, `calculationMethod`. | `schema.prisma:1136-1177` thực tế là `sheetLineId`, `itemCategory`, `configuredAmount`, `workDaysRatio`, `calculatedAmount`, `isTaxable`, `taxableAmount`, `taxExemptAmount`, `isSocialInsurance`, `insuranceAmount`. **5 tên trường sai, 6 trường bị bỏ sót.** ERD (`payroll-erd.md`) mới là bản đúng. | P1 |
| B-02 | `payroll-spec.md:64` (BR-pay-001) và `test-cases.md:53-54` dùng `CALCULATION_METHOD = WORK_DAYS`. | `schema.prisma:248-253`: enum `CalculationMethod` chỉ có `MONTHLY_FIXED`, `ACTUAL_WORKDAYS`, `HOURLY`, `OUTPUT_BASED`. **`WORK_DAYS` không tồn tại.** Service phải viết nhánh phòng thủ chấp nhận cả hai (`payroll-calculation.service.ts:356-357`), còn unit test lại mock giá trị không tồn tại (`payroll-calculation.pipeline.spec.ts:100,111,706,756,809`) — nghĩa là nhánh `ACTUAL_WORKDAYS` (giá trị DB thật) gần như không được kiểm chứng. | P0 |
| B-03 | `payroll-spec.md:64-66` (BR-pay-001) chỉ định nghĩa 2 phương thức tính. | Enum có **4** giá trị. `HOURLY` và `OUTPUT_BASED` không có quy tắc nghiệp vụ nào; khi gặp, code rơi vào nhánh đoán mò theo **tên khoản** (`payroll-calculation.service.ts:361-369`: chứa "điện thoại"/"phone" thì cố định tháng, còn lại tính theo công). Hành vi này không có trong bất kỳ BR nào. | P0 |
| B-04 | `payroll-spec.md:96` (BR-pay-005): giảm trừ `soNPT × 4.400.000`. | `payroll-calculation.service.ts:286` đếm `emp.dependents?.length` — **toàn bộ NPT đăng ký**, không lọc theo `taxReliefFromMonth/Year`..`taxReliefToMonth/Year` mà `schema.prisma:394-397` đã có sẵn. Xem GAP-PAY-01. | P0 |
| B-05 | `payroll-spec.md:96`: mức giảm trừ 11.000.000đ / 4.400.000đ. | `payroll-calculation.service.ts:744` **hard-code** `11_000_000 + dependentCount * 4_400_000`, trong khi `GeneralSetting.personalDeduction` / `dependentDeduction` (`schema.prisma:528-529`) tồn tại và còn được validate ở `service.ts:139` nhưng **không bao giờ được dùng**. Khi mức giảm trừ thay đổi theo luật, sửa cấu hình không có tác dụng. | P0 |
| B-06 | `payroll-spec.md:104,110` (BR-pay-006): trần 46.8tr = 20 × lương cơ sở; 99.2tr = 20 × LTT vùng. | `payroll-calculation.service.ts:651-652,666` dùng hằng số `CAP_BHXH_BHYT`/`CAP_BHTN` hard-code, không suy ra từ `GeneralSetting.baseSalary` / `regionMinSalary` (`schema.prisma:517-518`). Tỷ lệ 8%/1.5%/1%/17.5%/3% cũng hard-code (`service.ts:654-661`) dù `GeneralSetting` có đủ 6 cột tỷ lệ. | P0 |
| B-07 | `payroll-spec.md:81` (BR-pay-004): `standardHoursPerDay` là biến. | `payroll-calculation.service.ts:407` hard-code `standardWorkDays * 8.0`, bỏ qua `GeneralSetting.standardHoursPerDay` (`schema.prisma:505`). | P1 |
| B-08 | `payroll-spec.md:67-69` (BR-pay-002): cờ `isSocialInsurance` quyết định khoản nào tính đóng BHXH. | `payroll-calculation.service.ts:284-285`: `insuranceSalaryBase = contract.socialInsuranceSalary ?? baseSalaryMonthly` — một con số nhập tay trên hợp đồng. Cờ `isSocialInsurance` chỉ được ghi vào cột `insuranceAmount` của breakdown rồi **không bao giờ được cộng dồn**. **`BR-pay-002` hiện là quy tắc trang trí: không ảnh hưởng một đồng nào tới tiền bảo hiểm.** Không có ca kiểm thử nào thay đổi cờ này để chứng minh tác động. | P0 |
| B-09 | `payroll-erd.md:94,170`: miền `item_category` = `BASE, FIXED_ALLOWANCE, BENEFIT, KPI, BONUS, COMMISSION, PIECEWORK, DILIGENCE, ADJUSTMENT`. | Code ghi vào cùng cột **hai hệ giá trị trộn lẫn**: giá trị tổng hợp (`BASE`, `OVERTIME`, `KPI`, `BONUS`, `PIECEWORK`, `COMMISSION`, `DILIGENCE` — `service.ts:315,458,499,519,541,563,615`) và giá trị chuyển tiếp từ danh mục (`FIXED_ALLOWANCE`, `BENEFIT_ALLOWANCE`, `ATTENDANCE_ALLOWANCE`, `DELIVERY_PIECEWORK`, `COMMISSION_PERCENTAGE`, `KPI_PERFORMANCE`, `PERIODIC_BONUS` — enum `SalaryItemCategory`, `schema.prisma:225-233`). `OVERTIME` được ghi nhưng không có trong miền tài liệu; `ADJUSTMENT` có trong tài liệu nhưng không bao giờ được ghi. Cột là `VARCHAR(50)` **không có CHECK constraint, không có enum**. Hệ quả trực tiếp: chỉ mục `@@index([periodId, itemCategory])` và tab `luong-ho-tro` gom nhóm sai. | P0 |
| B-10 | `payroll-erd.md:54`, `payroll-spec.md` không có quy tắc nào cho `salaryType`. | `schema.prisma:193-195` có `SalaryType.NET` = *"công ty gross-up và đóng thuế thay"*. Trong `payroll-calculation.service.ts`, `salaryType` chỉ xuất hiện ở dòng 278 (đọc), 789 và 868 (ghi snapshot) — **không tham gia bất kỳ phép tính nào**. Hợp đồng NET được tính y hệt GROSS. Xem GAP-PAY-02. | P0 |
| B-11 | `payroll-spec.md:61` (BR-pay-001): lấy khoản từ `EmployeeSalary` "còn hiệu lực". | `schema.prisma:646` có `EmployeeSalary.status: SalaryApprovalStatus` (`DRAFT`/`PENDING_APPROVAL`/`APPROVED`/`REJECTED`, mặc định `PENDING_APPROVAL`). **Không BR nào yêu cầu chỉ dùng bản `APPROVED`**, và code không lọc. Có thể tính lương từ mức lương chưa được phê duyệt. | P0 |
| B-12 | `payroll-spec.md:61` hàm ý có nhiều bản ghi `EmployeeSalary` theo hiệu lực. | `schema.prisma:641`: `employeeId String @unique` — **mỗi nhân viên chỉ có đúng 1 bản ghi lương**, dù model có `setupVersion`, `effectiveFrom`, `effectiveTo`. Không lưu được lịch sử lương → không thể tính lại kỳ cũ sau khi tăng lương, không thể truy lĩnh. Mâu thuẫn với cam kết audit tại `payroll-spec.md:25` (BG-PAY-03). | P0 |
| B-13 | `payroll-spec.md:73` (BR-pay-003): "tiền ăn giữa ca, ăn trưa". | `payroll-calculation.service.ts:685-692` nhận diện khoản ăn trưa bằng **so khớp chuỗi tiếng Việt mờ**: `itemCategory === 'BENEFIT_ALLOWANCE'` và tên chứa `'ăn trưa'`/`'ăn ca'` hoặc mã chứa `ANTRUA`/`AN_TRUA`. Đặt tên khoản là "Hỗ trợ bữa trưa" hay "Phụ cấp cơm" → không khớp → toàn bộ số tiền bị tính thuế. Không BR nào định nghĩa cách nhận diện. Lưu ý `'BENEFIT_ALLOWANCE'` cũng khác miền `BENEFIT` mà ERD công bố. | P0 |
| B-14 | Không tài liệu nào nhắc trần giờ làm thêm. | `schema.prisma:514-516` đã có `otMonthlyLimitHours=40`, `otYearlyWarningHours=200`, `otYearlyLimitHours=300`. **Không có BR / EC / TC nào tham chiếu.** Cấu hình tồn tại nhưng không được thực thi. Xem GAP-PAY-11. | P0 |
| B-15 | `payroll-spec.md:82` (BR-pay-004) và toàn bộ `test-cases.md` Nhóm 3 chỉ nói tới hệ số **150 / 200 / 300 / 390%**. | `schema.prisma:709-716` có **6** loại OT, gồm `ngay_thuong_dem` (200%) và `chu_nhat_dem` (**270%**). Hệ số 270% **không xuất hiện một lần nào** trong toàn bộ hồ sơ nghiệp vụ, không có ca kiểm thử. Ngoài ra `ngay_thuong_dem` (200%) trùng số với `chu_nhat_ngay` (200%) nên `TC-PAY-021` không phân biệt được hai loại. Cấu thành 30% phụ cấp đêm không được đặc tả. Xem GAP-PAY-12. | P0 |
| B-16 | `payroll-states.md:102`, `test-cases.md:824,887` yêu cầu ghi nhật ký kiểm toán. | `schema.prisma:43-60` enum `AuditEvent` chỉ có **một** sự kiện payroll: `PAYROLL_PERIOD_REOPENED`. Không có `PAYROLL_LOCKED`, `PAYROLL_APPROVED`, `PAYROLL_PAID`, `PAYSLIP_VIEWED`, `PAYROLL_EXPORTED`. `TC-PAY-080:887` yêu cầu "ghi log cảnh báo vi phạm an ninh" cho một sự kiện không tồn tại. Xem GAP-PAY-20. | P0 |
| B-17 | Không tài liệu nào nhắc chế độ ốm đau/thai sản, phép năm. | `schema.prisma:697-706` `AttendanceType` đã có `nghi_phep` (1.0 công), `nghi_le` (1.0 công), `om` (*"Nghỉ ốm đau hưởng chế độ BHXH — 0 công doanh nghiệp"*). `GeneralSetting.basePaidLeaveDays=12` và `seniorityYearsPerDay=5` (`schema.prisma:506-507`) cũng đã có. **Không quy tắc nghiệp vụ nào của phân hệ lương tiêu thụ các dữ liệu này.** Xem GAP-PAY-04, GAP-PAY-05. | P0 |

---

## 2. Bảng Khiếm khuyết trong Ví dụ Gherkin (Tính lại từng ca)

Tôi đã **tính lại thủ công** toàn bộ số liệu tài chính của 14 kịch bản trọng yếu. Kết luận về **số học thuần túy**: các phép tính đều **đúng** — bao gồm hai ca mà main thread yêu cầu kiểm chứng.

**Xác nhận hai ca được yêu cầu:**

| Ca | Phép tính trong tài liệu | Tính lại | Kết luận |
|---|---|---|:---:|
| `US-PAY-02` sc.2 (`payroll-spec.md:198-205`) | 20.000.000 − 1.050.000 − 15.400.000 = 3.550.000; × 5% = 177.500 | 20.000.000 − 1.050.000 = 18.950.000; − 15.400.000 = **3.550.000**; 3.550.000 ≤ 5.000.000 → bậc 1, × 5% = **177.500** | ✅ Đúng |
| `US-PAY-04` / `TC-PAY-032` (`payroll-spec.md:242`, `test-cases.md:365`) | 3.744.000 + 702.000 + 992.000 = 5.438.000 | 46.800.000×8% = **3.744.000**; 46.800.000×1.5% = **702.000**; 99.200.000×1% = **992.000**; tổng = **5.438.000**. Phần DN: 8.190.000 + 1.404.000 + 992.000 = **10.586.000** ✅ | ✅ Đúng |

Các ca còn lại cũng đúng số học: `TC-PAY-001` (215.750 / 16.329.250 / 22.495.000), `TC-PAY-002` (5.500.000 / 2.900.000 / 26.300.000), `TC-PAY-003` (26.200.000 / 1.500.000), `TC-PAY-012` (1.153.846), `TC-PAY-020..023`, `TC-PAY-030/031/033`, `TC-PAY-042` (650.000 / 365.000 / 285.000), `TC-PAY-064` (7.000.000 / 1.400.000 / 393.077).

**Tuy nhiên, phép tính đúng không có nghĩa là ví dụ đúng.** Chín khiếm khuyết về **định nghĩa, giả thiết ẩn và tính kiểm chứng được** dưới đây có tác động tài chính hoặc làm ca kiểm thử mất tính tất định:

| # | Ca / Vị trí | Khiếm khuyết | Tác động tiền | Mức |
|:---:|---|---|---|:---:|
| G-01 | `test-cases.md:71` (`TC-PAY-001`) | Thu nhập tính thuế trừ cả **đoàn phí công đoàn 170.000đ**: `17.270.000 − 1.785.000 − 170.000 − 11.000.000`. **Không quy tắc nào cho phép điều này**: `BR-pay-005` (`payroll-spec.md:97`) chỉ nêu "trừ các khoản trích nộp **bảo hiểm bắt buộc**". Chính `US-PAY-02` sc.2 (`payroll-spec.md:204`) **không** trừ đoàn phí. Code thì có trừ (`payroll-calculation.service.ts:749`). Tính hợp pháp của việc giảm trừ đoàn phí khỏi thu nhập tính thuế **cần xác minh** với agent pháp lý. | Nếu không được trừ: thuế = 4.485.000 × 5% = **224.250đ** (thay vì 215.750đ), thực lĩnh 16.320.750đ. Chênh **8.500đ/người/tháng**. | **P0** |
| G-02 | `test-cases.md:619` (`TC-PAY-062`), `payroll-spec.md:320` (`EC-pay-004`) | Dùng chính tên trường `taxableIncome` cho **"thu nhập tính thuế"**, trong khi `TC-PAY-001` và `payroll-erd.md:143` dùng nó cho **"thu nhập chịu thuế"**. Hai đại lượng pháp lý khác nhau, một cột dữ liệu. Không có cột nào lưu thu nhập tính thuế, tổng giảm trừ gia cảnh, hay số NPT được giảm trừ thực tế. | Không sai số trực tiếp, nhưng **phiếu lương không thể trình bày cách ra số thuế** → nhân viên không đối chiếu được, doanh nghiệp không giải trình được khi thanh tra. | **P0** |
| G-03 | `test-cases.md:625-643` (`TC-PAY-063`), `payroll-spec.md:335` (`EC-pay-009`) | Khẳng định `Math.round()` **"tương đương `ROUND_HALF_UP`"**. Sai với số âm: trong JavaScript `Math.round(-2.5) === -2`, còn `ROUND_HALF_UP` (làm tròn ra xa số 0, chuẩn tài chính) cho `-3`. Ba trường hợp kiểm thử đều là số dương nên **không bẫy được lỗi này**. | Sai tối đa 1đ/phép tính trên nhánh âm (`adjustmentNetAmount` khi bù > trừ, thực lĩnh âm). Nhỏ nhưng vi phạm nguyên tắc "Zero Financial Discrepancy" (`test-matrix.md:21`). | P2 |
| G-04 | `test-cases.md:139-151` (`TC-PAY-010`) | Kết luận `netTakeHomeSalary = 12.000.000 − 1.200.000 = 10.800.000` ngầm giả định **không đóng bảo hiểm và không đoàn phí**, nhưng phần `Given` **không khai** `hasSocialInsurance`. Nếu hợp đồng thử việc có tham gia BHXH, kết quả khác hoàn toàn. Ca không tất định. | Có thể lệch tới 1.260.000đ (10.5% của 12tr). | P1 |
| G-05 | `test-cases.md:69-70` (`TC-PAY-001`) | Hỗ trợ điện thoại 500.000đ được miễn thuế **100%** chỉ vì cờ `isTaxable = false`. Không có trần, không có căn cứ "mức khoán theo quy chế tài chính doanh nghiệp". Tương tự `other_tax_exempt_amount` (`payroll-erd.md:142`) gộp "trang phục, công tác phí" mà không có trần nào — trong khi khoản trang phục có định mức miễn thuế theo năm (**cần xác minh** mức chính xác). | Rủi ro bị loại khỏi chi phí miễn thuế khi thanh tra; truy thu thuế TNCN trên phần vượt. | **P0** |
| G-06 | `test-cases.md:183-186` (`TC-PAY-012`) và `payroll-calculation.service.ts:737` | Ngưỡng 2.000.000đ được áp lên **`taxableIncome`** (thu nhập sau khi trừ các khoản miễn thuế). Căn cứ pháp lý nói về mức **chi trả** từng lần. Hai cách hiểu cho kết quả khác nhau khi có phụ cấp miễn thuế. Đặc tả không nêu rõ chọn cách nào. **Cần xác minh** với agent pháp lý. | Với người có ăn trưa 730k, chi trả 2.5tr → taxableIncome 1.77tr → **không khấu trừ** thay vì khấu trừ 250.000đ. | **P0** |
| G-07 | `test-cases.md:660-662` (`TC-PAY-064`) | Dòng `Then` ghi *"Hạn mức miễn thuế ăn trưa tối đa = 393.077"* nhưng cột dữ liệu `lunch_tax_exempt_amount` lưu **số tiền được miễn thực tế** (`min(tiền ăn thực trả, hạn mức)`). Ca không khai nhân viên có khoản ăn trưa hay không → không assert được. | Ca kiểm thử không thể tự động hóa đúng. | P1 |
| G-08 | `test-cases.md:58-74` (`TC-PAY-001`) | `insuranceSalaryBase = 17.000.000` được cho sẵn như dữ liệu hợp đồng, đồng thời cũng đúng bằng lương cơ bản 15tr + phụ cấp trách nhiệm 2tr (khoản duy nhất có `Đóng BHXH = true`). **Hai nguồn chân lý trùng nhau một cách tình cờ**, che mất mâu thuẫn B-08: đặc tả không nói nguồn nào thắng khi hai giá trị lệch nhau. | Khi phụ cấp thay đổi mà `socialInsuranceSalary` không cập nhật, tiền BHXH sai và không ca kiểm thử nào phát hiện. | **P0** |
| G-09 | `test-cases.md:107-126` (`TC-PAY-003`) | Ca tự nhận "bao phủ đầy đủ 8 phân hệ" và truy vết `BR-pay-001` + `BR-pay-009`, nhưng: Gross **không chứa** khoản phụ cấp cố định nào (nên không kiểm chứng `BR-pay-001`), và `diligenceSalary = 500.000` được **cho sẵn** thay vì tính từ mức hưởng trừ tiền phạt (nên không kiểm chứng `BR-pay-009`). | Hai quy tắc được ghi nhận "PASS" nhờ một ca không thực sự kiểm chứng chúng. | P1 |

---

## 3. Danh mục Lỗ hổng Nghiệp vụ Chưa được Đặc tả

Định dạng mỗi mục: **(a)** nghiệp vụ thiếu · **(b)** căn cứ · **(c)** ưu tiên · **(d)** mã mới đề xuất · **(e)** tác động data model / API.

> **Lưu ý về căn cứ pháp lý**: các trích dẫn dưới đây ở mức định hướng. Mọi con số, số hiệu văn bản và định mức đều đánh dấu **cần xác minh** và sẽ được đối chiếu với kết quả của agent nghiên cứu pháp lý chạy song song trước khi merge vào `payroll-spec.md`.

### 3.1. Nhóm Thuế TNCN

| ID | (a) Nghiệp vụ thiếu | (b) Căn cứ | (c) Ưu tiên | (d) Mã mới | (e) Tác động Data Model / API |
|---|---|---|:---:|---|---|
| **GAP-PAY-01** | **Hiệu lực đăng ký người phụ thuộc theo tháng.** Hệ thống đếm tổng số NPT trong hồ sơ, không kiểm tra NPT đó có hiệu lực giảm trừ trong tháng tính lương hay không. NPT đăng ký tháng 9 vẫn được giảm trừ cho kỳ tháng 1. | TT 111/2013/TT-BTC — giảm trừ NPT tính từ tháng phát sinh nghĩa vụ nuôi dưỡng/tháng đăng ký (*cần xác minh*). Dữ liệu đã sẵn: `Dependent.taxReliefFrom/To Month/Year`. | **P0** | `BR-pay-012`, `EC-pay-011`, `E-pay-011` | Thêm 3 cột vào `payroll_sheet_lines`: `eligible_dependent_count`, `personal_deduction_amount`, `dependent_deduction_amount`. Response `GET /payroll/sheet-lines/:id` và `payslips/my` bổ sung khối `taxDeductionDetail`. |
| **GAP-PAY-02** | **Hợp đồng lương NET không được gross-up.** `SalaryType.NET` được lưu nhưng không tham gia tính toán; nhân viên NET nhận `net = gross − khấu trừ` thay vì đúng số NET đã cam kết. | Thỏa thuận dân sự + nghĩa vụ khấu trừ thuế của tổ chức chi trả. Đây là **lỗi tài chính trực tiếp**, không phải vấn đề pháp lý. | **P0** | `BR-pay-013`, `EC-pay-012` | Thêm `agreed_net_salary`, `grossed_up_amount`, `gross_up_iterations` vào `payroll_sheet_lines`. Không đổi API path; đổi payload `sheet-lines`. |
| **GAP-PAY-03** | **Quyết toán thuế TNCN cuối năm.** Hệ thống chỉ tính thuế tạm khấu trừ hàng tháng. Không có: tổng hợp thu nhập/thuế đã khấu trừ cả năm, xác định số phải nộp thêm / được hoàn, ủy quyền quyết toán, chứng từ khấu trừ thuế cho người tự quyết toán. | Luật Thuế TNCN + TT 111/2013; mẫu tờ khai **05/QTT-TNCN** và phụ lục bảng kê (*số hiệu cần xác minh*). | **P0** | `BR-pay-014`, `BR-pay-015`, `E-pay-012` | Bảng mới `pit_annual_settlements` (1 dòng/NV/năm) + `pit_withholding_certificates`. Endpoint mới `POST /payroll/pit/annual-settlement`, `GET /payroll/pit/annual-settlement/:year`, `GET /payroll/pit/withholding-certificate/:employeeId/:year`. |
| **GAP-PAY-04** | **Cam kết không khấu trừ 10% cho người thu nhập thấp** (mẫu **08/CK-TNCN**, *số hiệu cần xác minh*). Người ký cam kết, chỉ có thu nhập tại một nơi, ước tính cả năm dưới ngưỡng chịu thuế thì tạm không khấu trừ 10%. Hệ thống hiện khấu trừ máy móc mọi HĐ `PROBATION`/`SERVICE_CONTRACT` ≥ 2tr. | TT 111/2013/TT-BTC (*cần xác minh*). | **P1** | `BR-pay-016`, `EC-pay-013` | Thêm vào hồ sơ nhân sự: `has_low_income_commitment`, `commitment_year`, `commitment_document_id`. Cột snapshot `commitment_applied` trong `payroll_sheet_lines`. |
| **GAP-PAY-05** | **Cá nhân không cư trú.** Không có khái niệm cư trú/không cư trú trong toàn bộ hồ sơ và schema. Cá nhân không cư trú chịu thuế suất toàn phần trên thu nhập phát sinh tại Việt Nam, không giảm trừ gia cảnh. Ghi nhận: `TC-PAY-032` lại lấy ví dụ *"Chuyên gia **nước ngoài**"* (`test-cases.md:355`) — đúng đối tượng rủi ro nhưng lại chỉ kiểm thử trần bảo hiểm. | Luật Thuế TNCN — thuế suất toàn phần cho cá nhân không cư trú (mức **cần xác minh**, thường nêu là 20%). | **P1** | `BR-pay-017`, `EC-pay-014`, `E-pay-013` | Thêm `residency_status` (`RESIDENT`/`NON_RESIDENT`) vào hồ sơ nhân sự + snapshot vào `payroll_sheet_lines`. |
| **GAP-PAY-06** | **Nhiều nguồn thu nhập / làm nhiều nơi.** Không có cơ chế ghi nhận cam kết "chỉ tính giảm trừ gia cảnh tại một nơi". Nếu nhân viên đang được nơi khác giảm trừ, doanh nghiệp giảm trừ trùng. | Nguyên tắc giảm trừ gia cảnh chỉ tại một nơi chi trả (*cần xác minh*). | **P1** | `BR-pay-018` | Thêm cờ `family_relief_registered_here` (mặc định `true`) vào hồ sơ nhân sự; nếu `false` thì `familyRelief = 0`. |
| **GAP-PAY-07** | **Không có trần cho các khoản miễn thuế "khác".** `other_tax_exempt_amount` gộp trang phục, công tác phí, điện thoại... và miễn 100% chỉ dựa vào cờ `isTaxable=false`, không có định mức. | TT 111/2013 quy định định mức miễn thuế cho từng loại khoản (trang phục theo năm, điện thoại/công tác phí theo quy chế tài chính) — **định mức cần xác minh**. | **P0** | `BR-pay-019`, `EC-pay-015` | Thêm `tax_exempt_cap_amount` và `tax_exempt_cap_period` (`MONTH`/`YEAR`) vào `salary_items`; thêm cột `exempt_cap_applied` vào breakdown. |
| **GAP-PAY-08** | **Không có cách định danh khoản ăn giữa ca.** Quy tắc trần 730k phụ thuộc vào việc nhận diện đúng khoản, nhưng cơ chế hiện tại là dò chuỗi tiếng Việt trong tên khoản (B-13). Đổi tên khoản làm hỏng ưu đãi thuế mà không có cảnh báo. | Yêu cầu về tính xác định của quy tắc nghiệp vụ (`.claude/CLAUDE.md` — "Requirement phải testable"). | **P0** | `BR-pay-020`, `E-pay-014` | Thêm `tax_exempt_type` (enum: `NONE`, `MEAL`, `UNIFORM`, `TRAVEL`, `PHONE`, `HOUSING`...) vào `salary_items`. Cấm dò theo tên. Cảnh báo cấu hình nếu kỳ có ≥1 NV mà không khoản nào gắn `MEAL`. |

### 3.2. Nhóm Chế độ Lao động & Bảo hiểm

| ID | (a) Nghiệp vụ thiếu | (b) Căn cứ | (c) Ưu tiên | (d) Mã mới | (e) Tác động Data Model / API |
|---|---|---|:---:|---|---|
| **GAP-PAY-09** | **Chế độ ốm đau / thai sản do BHXH chi trả.** `AttendanceType.om` đã tồn tại và được tính 0 công doanh nghiệp, nhưng **không có quy tắc nào** tính trợ cấp BHXH, tách nó khỏi tiền lương do DN trả, hay loại nó khỏi thu nhập chịu thuế TNCN. Nhân viên nghỉ thai sản cả tháng hiện ra Gross = 0 (`EC-pay-007`) — sai bản chất. | Luật BHXH — trợ cấp ốm đau/thai sản do quỹ BHXH chi trả, không phải tiền lương, và thuộc thu nhập miễn thuế TNCN (*mức hưởng và điều kiện cần xác minh*). | **P0** | `BR-pay-021`, `BR-pay-022`, `EC-pay-016` | Bảng mới `social_insurance_benefits` (loại chế độ, số ngày, mức hưởng, kỳ chi trả). Thêm `siBenefitAmount` vào `payroll_sheet_lines` (miễn thuế, không tính BHXH, hiển thị riêng trên phiếu lương). |
| **GAP-PAY-10** | **Nghỉ phép năm & thanh toán phép chưa nghỉ hết.** `GeneralSetting.basePaidLeaveDays=12` và `seniorityYearsPerDay=5` đã có nhưng không quy tắc nào dùng. Không có số dư phép, không có tích lũy theo thâm niên, không có thanh toán phép còn lại khi nghỉ việc/cuối năm. | BLLĐ 2019 về nghỉ hằng năm và thanh toán những ngày chưa nghỉ khi thôi việc (*điều khoản cần xác minh*). | **P1** | `BR-pay-023`, `BR-pay-024`, `EC-pay-017` | Bảng mới `leave_balances` (NV, năm, số phép được hưởng, đã dùng, còn lại, chuyển tiếp). Thêm `unusedLeavePayment` vào `payroll_sheet_lines`. Endpoint `GET /payroll/leave-balances`. |
| **GAP-PAY-11** | **Không kiểm soát trần giờ làm thêm.** Cấu hình 40h/tháng, 200h & 300h/năm đã có trong DB nhưng không quy tắc nào cảnh báo hay chặn. Kỳ lương có thể chốt với nhân viên vượt trần mà không ai biết. | BLLĐ 2019 giới hạn giờ làm thêm theo tháng và theo năm (*các mức 40h/200h/300h cần xác minh*). | **P0** | `BR-pay-025`, `EC-pay-018`, `E-pay-015` | Không cần cột mới trên `payroll_sheet_lines` (có `otConvertedHours`); cần thêm `ot_actual_hours_month`, `ot_actual_hours_ytd` để so trần. Response `GET /payroll/calculate` bổ sung mảng `warnings[]`. |
| **GAP-PAY-12** | **Phụ cấp làm việc ban đêm 30% không được tách bạch, và thiếu hệ số 270%.** Hồ sơ chỉ nói 150/200/300/390% như những con số nguyên khối, không giải thích cấu thành (lương làm thêm + 30% phụ cấp đêm + 20% tính trên đơn giá ban ngày). Loại `chu_nhat_dem` (270%) không xuất hiện ở đâu trong hồ sơ. Không tách được phần "phụ cấp đêm" khỏi phần "làm thêm giờ" cho mục đích miễn thuế. | Điều 98 BLLĐ 2019 (*cần xác minh cách cấu thành chính xác*). | **P0** | `BR-pay-026`, `EC-pay-019` | Thêm `nightShiftAllowance` (tách khỏi `otAmount`) vào `payroll_sheet_lines`; breakdown OT ghi rõ 3 cấu phần: cơ bản, phụ cấp đêm, phần làm thêm. |
| **GAP-PAY-13** | **Đơn giá giờ làm thêm chỉ dựa trên lương cơ bản.** `BR-pay-004` dùng `baseSalaryMonthly`, bỏ qua cờ `isOvertimeBase` đã tồn tại trên `SalaryStructureItem` (`schema.prisma:625`). Nhân viên có phụ cấp lương lớn bị trả thiếu tiền làm thêm. | BLLĐ + NĐ 145/2020 — tiền lương làm căn cứ trả làm thêm là tiền lương thực trả theo công việc đang làm (*điều khoản cần xác minh*). | **P0** | `BR-pay-027` | Thêm `overtime_base_salary` vào `payroll_sheet_lines` (khác `base_salary_monthly`). Breakdown ghi rõ khoản nào cấu thành đơn giá OT. |
| **GAP-PAY-14** | **Lương tối thiểu vùng chỉ cảnh báo, và chỉ có một vùng.** `EC-pay-010` chỉ log warning. Không kiểm tra lương **thực trả** ≥ LTT vùng. `GeneralSetting.regionMinSalary` là **một giá trị duy nhất** cho toàn hệ thống — không có khái niệm vùng của công ty/chi nhánh, trong khi Việt Nam có 4 vùng. Nhân viên qua đào tạo nghề còn có mức sàn cao hơn (*cần xác minh*). | NĐ 74/2024/NĐ-CP về mức lương tối thiểu vùng (*mức từng vùng cần xác minh*). | **P0** | `BR-pay-028`, `E-pay-016`, `EC-pay-020` | Thêm bảng `region_minimum_wages` (vùng, mức tháng, mức giờ, hiệu lực). Thêm `region_code` vào `departments`/`employees`. Snapshot `applied_region_min_salary` vào `payroll_sheet_lines`. |
| **GAP-PAY-15** | **Nguồn chân lý của lương đóng bảo hiểm không xác định.** Xem B-08: `socialInsuranceSalary` nhập tay là nguồn duy nhất, cờ `isSocialInsurance` vô tác dụng. Khi cơ cấu lương thay đổi, mức đóng BHXH không tự cập nhật. | Điều 30 TT 59/2015/TT-BLĐTBXH — tiền lương tháng đóng BHXH gồm mức lương, phụ cấp lương và các khoản bổ sung xác định (*cần xác minh*). | **P0** | `BR-pay-029`, `E-pay-017` | Không thêm cột; thêm `derived_insurance_salary_base` để so sánh, và chặn/cảnh báo khi lệch `socialInsuranceSalary` quá ngưỡng. |

### 3.3. Nhóm Chu trình Kỳ lương & Kiểm soát

| ID | (a) Nghiệp vụ thiếu | (b) Căn cứ | (c) Ưu tiên | (d) Mã mới | (e) Tác động Data Model / API |
|---|---|---|:---:|---|---|
| **GAP-PAY-16** | **Truy lĩnh / truy thu kỳ trước không có cơ chế.** `BR-pay-008` nói thực lĩnh âm "ghi nhận công nợ để khấu trừ kỳ kế tiếp" nhưng: không có cột lưu công nợ chuyển tiếp, không có bản ghi bù trừ nào được tạo tự động ở kỳ sau, không có quy trình đối soát. Việc chuyển tiếp hiện là thao tác thủ công qua phân hệ Bù trừ mà không ai được yêu cầu làm. | Chuẩn mực kế toán về công nợ phải thu người lao động; yêu cầu truy vết (`.claude/CLAUDE.md` — Traceability). | **P0** | `BR-pay-030`, `EC-pay-021`, `E-pay-018` | Thêm `carried_forward_debt_in` và `carried_forward_debt_out` vào `payroll_sheet_lines`. Endpoint `POST /payroll/periods/:id/carry-forward-debts`. |
| **GAP-PAY-17** | **Không có kỳ điều chỉnh / không có đường lùi sau khi duyệt.** Máy trạng thái không cho `APPROVED → LOCKED`, `PAID → *`. Sai sót phát hiện sau khi chi trả không có lối xử lý hợp lệ nào ngoài việc dùng quyền `ADMIN` reopen từ `LOCKED` (mà `APPROVED`/`PAID` thì không reopen được). | Thực tiễn vận hành; nguyên tắc kiểm soát nội bộ (không sửa lịch sử, chỉ ghi bút toán điều chỉnh). | **P0** | `BR-pay-031`, `BR-pay-032`, `E-pay-019` | Thêm trạng thái `ADJUSTING` hoặc bảng `payroll_adjustment_periods` liên kết kỳ gốc. Endpoint `POST /payroll/periods/:id/create-adjustment`. Cập nhật `payroll-states.md`. |
| **GAP-PAY-18** | **Snapshot không đóng băng tham số pháp lý.** `BG-PAY-03` (`payroll-spec.md:25`) cam kết dữ liệu kỳ đã khóa bất biến "dù cài đặt lương tương lai có biến động", nhưng `GeneralSetting` (lương cơ sở, LTT vùng, 6 tỷ lệ bảo hiểm, biểu thuế 7 bậc, mức giảm trừ) **không được snapshot**. Sau khi lương cơ sở thay đổi, không ai giải thích được vì sao kỳ cũ dùng trần 46.8tr. | Chuẩn kiểm toán — khả năng tái lập kết quả (reproducibility). | **P0** | `BR-pay-033` | Thêm cột `statutory_params_snapshot JSONB` vào `payroll_periods` (ghi tại thời điểm `LOCKED`), hoặc bảng `payroll_period_settings_snapshots`. |
| **GAP-PAY-19** | **Vi phạm phân tách nhiệm vụ (Segregation of Duties).** Không có vai `DIRECTOR`. `ADMIN` vừa được **mở lại** kỳ đã khóa (`E-pay-008` khẳng định "CHỈ ADMIN"), vừa được **phê duyệt** kỳ lương thay Ban Giám đốc (`api-contract.md:69`). Một tài khoản có thể mở khóa, sửa số, khóa lại và tự duyệt mà không ai chặn. Đây là quyền quản trị kỹ thuật bị dùng làm quyền phê duyệt tài chính. | Nguyên tắc kiểm soát nội bộ; `.claude/CLAUDE.md` mục Security ("Bypass authorization"). | **P0** | `BR-pay-034`, `E-pay-020` | Thêm vai `DIRECTOR` vào enum Role. Chuyển `approve` sang `DIRECTOR`. Cấm cùng một `userId` vừa `lockedByUserId` vừa `approvedByUserId`. Cập nhật toàn bộ ma trận RBAC ở 3 tài liệu. |
| **GAP-PAY-20** | **Không có nhật ký truy cập dữ liệu lương.** Chỉ có 1 sự kiện `PAYROLL_PERIOD_REOPENED`. Không ghi ai khóa sổ, ai duyệt, ai chi trả, **ai xem phiếu lương của ai**, ai xuất Excel toàn công ty. Dữ liệu lương là dữ liệu cá nhân nhạy cảm. | Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (*phạm vi áp dụng và nghĩa vụ cụ thể cần xác minh*). | **P0** | `BR-pay-035`, `NFR-pay-009` | Bổ sung enum `AuditEvent`: `PAYROLL_LOCKED`, `PAYROLL_REJECTED`, `PAYROLL_APPROVED`, `PAYROLL_PAID`, `PAYROLL_ARCHIVED`, `PAYSLIP_VIEWED`, `PAYROLL_SHEET_VIEWED`, `PAYROLL_EXPORTED`. Không đổi API path. |
| **GAP-PAY-21** | **Mức lương chưa phê duyệt vẫn được dùng để tính lương.** `EmployeeSalary.status` có quy trình duyệt 4 trạng thái nhưng phân hệ lương không lọc (B-11). | Kiểm soát nội bộ; nhất quán với `SalaryApprovalStatus` đã thiết kế ở phân hệ Cài đặt lương. | **P0** | `BR-pay-036`, `E-pay-021` | Không thêm cột; thêm điều kiện lọc + snapshot `employee_salary_id` và `employee_salary_version` vào `payroll_sheet_lines` để truy vết mức lương đã dùng. |
| **GAP-PAY-22** | **Làm tròn khi chi trả.** Hệ thống tính tới đơn vị 1đ nhưng ngân hàng/thực tế chi trả thường làm tròn tới 1.000đ (hoặc 100đ). Không có quy tắc làm tròn khi lập ủy nhiệm chi, không có cơ chế xử lý chênh lệch tích lũy. Cũng chưa có quy tắc đa tiền tệ cho hợp đồng ngoại tệ. | Thực tiễn thanh toán ngân hàng; nguyên tắc khớp sổ. | **P1** | `BR-pay-037`, `EC-pay-022` | Thêm `payment_rounded_amount` và `rounding_carry_forward` vào `payroll_sheet_lines`. Cấu hình `payment_rounding_unit` trong `GeneralSetting`. |
| **GAP-PAY-23** | **Không có biểu mẫu & báo cáo bắt buộc.** Hồ sơ chỉ có "xuất Excel đối soát đa chiều" tự định nghĩa. Thiếu: Bảng thanh toán tiền lương theo mẫu chế độ kế toán (mẫu **02-LĐTL** theo TT 200/TT 133), tờ khai khấu trừ thuế TNCN kỳ (**05/KK-TNCN**), báo cáo tăng/giảm lao động BHXH (**D02-LT**), bảng kê quyết toán năm. *(Toàn bộ số hiệu mẫu cần xác minh.)* | TT 200/2014/TT-BTC hoặc TT 133/2016/TT-BTC; quy định khai thuế và khai BHXH (*cần xác minh*). | **P1** | `BR-pay-038` | Không đổi schema cốt lõi. Endpoint mới: `GET /payroll/reports/02-ldtl`, `GET /payroll/reports/05-kk-tncn`, `GET /payroll/reports/d02-lt`. |
| **GAP-PAY-24** | **Chưa xác định phạm vi & giả định.** Không có mục Scope/Out-of-Scope nên không rõ những điều trên là "cố ý để sau" hay "bị bỏ quên". Không có Assumptions (ví dụ: giả định toàn bộ nhân sự là cá nhân cư trú; giả định 1 vùng lương tối thiểu; giả định không có hợp đồng NET), không có Open Questions. | `.claude/CLAUDE.md` — Deliverables của Business Analyst; `.claude/rules/naming-conventions.md`. | **P0** | Mục mới trong `payroll-spec.md` | Không tác động kỹ thuật; tác động tới cam kết bàn giao. |

---

## 4. Đề xuất Business Rules Mới (`BR-pay-012` .. `BR-pay-038`)

> Viết theo đúng văn phong và cấu trúc Mục 4 của `payroll-spec.md`. Các mã dưới đây **chưa được dùng** trong hồ sơ hiện tại (hồ sơ hiện dừng ở `BR-pay-011`).

### Nhóm 6: Giảm trừ Gia cảnh & Phân loại Người nộp thuế

- **`BR-pay-012` (Hiệu lực Đăng ký Người phụ thuộc theo Tháng)** — *P0*
  - Chỉ những người phụ thuộc có khoảng hiệu lực giảm trừ **bao trùm tháng tính lương** mới được tính. Gọi kỳ lương là $(m, y)$, mỗi NPT $d$ có mốc bắt đầu $(m^{from}_d, y^{from}_d)$ và mốc kết thúc tùy chọn $(m^{to}_d, y^{to}_d)$. Quy đổi về chỉ số tháng tuyệt đối $T(m,y) = 12y + m$:
    $$\text{eligible}(d) = \big(T^{from}_d \le T_{ky}\big) \wedge \big(T^{to}_d \text{ rỗng} \vee T_{ky} \le T^{to}_d\big)$$
    $$\text{soNPTGiamTru} = \big|\{\, d \in \text{Dependents}(nv) \mid \text{eligible}(d) \,\}\big|$$
  - NPT chưa khai mốc bắt đầu (`taxReliefFromMonth`/`Year` rỗng) **KHÔNG được giảm trừ** và hệ thống phát cảnh báo cấu hình (`E-pay-011`). Tuyệt đối không suy diễn mốc từ ngày tạo bản ghi.
  - Snapshot bắt buộc: `eligibleDependentCount` (số NPT thực được giảm trừ) tách riêng khỏi `dependentCount` (tổng NPT trong hồ sơ) để đối chiếu khi thanh tra.

- **`BR-pay-013` (Quy đổi Lương NET sang GROSS — Gross-up)** — *P0*
  - Áp dụng khi `salaryType = NET`. Số tiền thỏa thuận là **thực lĩnh**; doanh nghiệp chịu thuế TNCN và phần bảo hiểm của người lao động theo thỏa thuận.
  - Bài toán: tìm $G$ (thu nhập gộp) sao cho $\text{Net}(G) = N$ với $N$ là mức NET cam kết, trong đó $\text{Net}(G) = G - BH(G) - CD(G) - \text{Thue}(G)$.
  - Do biểu thuế lũy tiến từng phần là hàm bậc thang, giải bằng **lặp hội tụ** (Newton hoặc chia đôi) trên khoảng $[N, 3N]$:
    $$G_{k+1} = G_k + \big(N - \text{Net}(G_k)\big), \qquad \text{dừng khi } |N - \text{Net}(G_k)| \le 1 \text{ VNĐ}$$
  - Giới hạn tối đa **50 vòng lặp**; không hội tụ thì ném `E-pay-...` và không cho khóa sổ. Số vòng lặp thực tế phải được snapshot để tái lập.
  - Mọi khoản miễn thuế (ăn trưa, OT dôi dư) vẫn áp dụng bên trong hàm $\text{Net}(G)$ trước khi tính thuế.

- **`BR-pay-014` (Quyết toán Thuế TNCN Cuối năm)** — *P0*
  - Cuối năm dương lịch, với mỗi nhân viên hệ thống tổng hợp từ các kỳ lương ở trạng thái `PAID` hoặc `ARCHIVED` thuộc năm $Y$:
    $$\text{TNCT}_Y = \sum_{k \in Y} \text{taxableIncome}_k, \quad \text{ThueDaKT}_Y = \sum_{k \in Y} \text{personalIncomeTax}_k$$
    $$\text{TNTT}_Y = \max\Big(0,\ \text{TNCT}_Y - \sum_{k \in Y}\big(BH_k + GT^{banThan}_k + GT^{NPT}_k\big)\Big)$$
    $$\text{ThuePhaiNop}_Y = \text{LuyTienNam}(\text{TNTT}_Y), \qquad \text{ChenhLech}_Y = \text{ThuePhaiNop}_Y - \text{ThueDaKT}_Y$$
  - $\text{ChenhLech}_Y > 0$: phải nộp thêm. $< 0$: được hoàn/bù trừ. Biểu thuế năm dùng ngưỡng bậc **nhân 12** so với biểu tháng.
  - Chỉ tổng hợp cho nhân viên **ủy quyền quyết toán** và có thu nhập duy nhất tại doanh nghiệp. Người không ủy quyền: hệ thống chỉ phát hành chứng từ khấu trừ thuế (`BR-pay-015`).
  - Kỳ chưa `PAID` không được đưa vào quyết toán.

- **`BR-pay-015` (Chứng từ Khấu trừ Thuế TNCN)** — *P1*
  - Với người **không ủy quyền quyết toán** hoặc người có thu nhập bị khấu trừ 10% tại nguồn, hệ thống phát hành chứng từ khấu trừ ghi rõ: tổng thu nhập chi trả, tổng thuế đã khấu trừ, kỳ chi trả, mã số thuế cá nhân.
  - Chứng từ chỉ được phát hành từ dữ liệu snapshot kỳ `PAID`/`ARCHIVED`; mỗi lần phát hành ghi số hiệu tăng dần và không cho phép sửa. Phát hành lại phải đánh dấu bản thay thế và ghi audit log.

- **`BR-pay-016` (Cam kết Thu nhập thấp — Tạm không Khấu trừ 10%)** — *P1*
  - Với hợp đồng thuộc diện `BR-pay-005` (khấu trừ 10%), nếu nhân viên có cam kết còn hiệu lực trong năm tính thuế **và** có mã số thuế cá nhân **và** chỉ có thu nhập tại một nơi:
    $$\text{thueTNCN} = 0 \quad \text{khi} \quad \text{has\_low\_income\_commitment} = \text{true} \wedge \text{taxCode} \ne \varnothing$$
  - Cam kết chỉ có hiệu lực trong năm đăng ký; sang năm mới, hệ thống tự đặt lại về `false` và cảnh báo C&B thu lại bản cam kết mới.
  - Nếu thu nhập lũy kế trong năm vượt ngưỡng chịu thuế, hệ thống cảnh báo và ngừng áp dụng cam kết từ kỳ phát hiện (*ngưỡng cần xác minh*).

- **`BR-pay-017` (Cá nhân Không cư trú — Thuế suất Toàn phần)** — *P1*
  - Nhân viên có `residencyStatus = NON_RESIDENT`:
    $$\text{thueTNCN} = \text{round}\big(\text{thuNhapChiuThue} \times r_{nonres}\big)$$
    với $r_{nonres}$ là thuế suất toàn phần lấy từ `GeneralSetting` (*mức cần xác minh, thường nêu là 20%*).
  - **Tuyệt đối không** áp dụng giảm trừ gia cảnh, không áp dụng biểu lũy tiến, không áp dụng ngưỡng 2 triệu của `BR-pay-005`.
  - Mặc định `residencyStatus = RESIDENT`. Chuyển sang `NON_RESIDENT` phải có căn cứ hồ sơ và ghi audit log.

- **`BR-pay-018` (Giảm trừ Gia cảnh chỉ tại Một nơi Chi trả)** — *P1*
  - Nếu `familyReliefRegisteredHere = false`, hệ thống đặt $GT^{banThan} = 0$ và $GT^{NPT} = 0$ bất kể số NPT đã khai, đồng thời vẫn giữ khấu trừ bảo hiểm.
  - Giá trị mặc định là `true`; mọi lần đổi phải ghi audit log kèm người thực hiện.

### Nhóm 7: Định mức Miễn thuế & Nhận diện Khoản lương

- **`BR-pay-019` (Trần Miễn thuế theo Từng loại Khoản)** — *P0*
  - Mỗi khoản trong danh mục `SalaryItem` phải khai `taxExemptCapAmount` và `taxExemptCapPeriod` (`MONTH` hoặc `YEAR`). Phần vượt trần bắt buộc chịu thuế:
    $$\text{mienThue}_i = \min\big(\text{tienThucTe}_i,\ \text{tranKyQuyDoi}_i\big), \qquad \text{chiuThue}_i = \text{tienThucTe}_i - \text{mienThue}_i$$
    $$\text{tranKyQuyDoi}_i = \begin{cases} \text{cap}_i \times \min\!\big(1, \tfrac{\text{actualWorkDays}}{\text{standardWorkDays}}\big) & \text{nếu } \text{capPeriod}_i = \text{MONTH} \\[4pt] \max\big(0,\ \text{cap}_i - \text{luyKeMienThueTrongNam}_i\big) & \text{nếu } \text{capPeriod}_i = \text{YEAR} \end{cases}$$
  - Khoản không khai trần (`taxExemptCapAmount` rỗng) mà lại có `isTaxable = false` sẽ bị hệ thống **cảnh báo cấu hình** khi tính lương; kỳ vẫn tính được nhưng cảnh báo phải hiển thị cho C&B.
  - Quy tắc này **thay thế** cơ chế "miễn thuế 100% chỉ dựa vào cờ `isTaxable`" đang dùng.

- **`BR-pay-020` (Định danh Khoản Miễn thuế bằng Cờ Danh mục, không bằng Tên)** — *P0*
  - Mỗi `SalaryItem` phải khai `taxExemptType` thuộc tập `{NONE, MEAL, UNIFORM, TRAVEL, PHONE, HOUSING, OTHER}`.
  - Trần 730.000đ/tháng của `BR-pay-003` chỉ áp cho các khoản có `taxExemptType = MEAL`. **Nghiêm cấm** nhận diện khoản ăn giữa ca bằng cách so khớp chuỗi trong tên khoản hoặc mã khoản.
  - Nếu một kỳ lương có nhiều khoản `MEAL`, trần 730k áp trên **tổng** các khoản đó, không áp riêng lẻ:
    $$\text{hanMucMienThueAnTrua} = \text{round}\Big(730.000 \times \min\big(1, \tfrac{\text{actualWorkDays}}{\text{standardWorkDays}}\big)\Big), \qquad \text{mienThue} = \min\Big(\sum_{i \in MEAL} \text{tienThucTe}_i,\ \text{hanMucMienThueAnTrua}\Big)$$
  - Nếu kỳ lương có nhân viên nhưng **không khoản nào** mang `taxExemptType = MEAL`, hệ thống ghi cảnh báo cấu hình (không chặn tính lương).

### Nhóm 8: Chế độ Bảo hiểm, Nghỉ phép & Làm thêm giờ

- **`BR-pay-021` (Trợ cấp Ốm đau / Thai sản do BHXH chi trả — Tách khỏi Tiền lương)** — *P0*
  - Ngày công loại `om` và các ngày nghỉ thai sản **không phát sinh tiền lương do doanh nghiệp trả** (đã đúng ở hiện trạng), nhưng phần trợ cấp do quỹ BHXH chi trả phải được ghi nhận thành một cấu phần riêng `siBenefitAmount`.
  - Cấu phần này: **không** cộng vào `insuranceSalaryBase`, **không** chịu thuế TNCN, **không** tính đoàn phí, nhưng **có** cộng vào số tiền thực nhận hiển thị trên phiếu lương (nếu doanh nghiệp chi hộ):
    $$\text{thucLinh} = \text{grossIncome} + \text{siBenefitAmount} - BH - CD - \text{thue} - \text{adjustmentNetAmount}$$
  - Mức hưởng và số ngày hưởng lấy từ hồ sơ chế độ BHXH đã được cơ quan BHXH duyệt, **không** do phân hệ lương tự tính (*mức hưởng cần xác minh*).

- **`BR-pay-022` (Không đóng Bảo hiểm cho Tháng không phát sinh Tiền lương)** — *P1*
  - Nếu trong kỳ nhân viên không có ngày công hưởng lương nào từ doanh nghiệp (toàn bộ là `om`, `khong_luong`, `khac`), thì $BH_{NLD} = 0$, $BH_{DN} = 0$, $CD = 0$.
  - Quy tắc này làm rõ `EC-pay-007` hiện tại và phải phân biệt hai tình huống khác nhau: **nghỉ không lương** (quan hệ lao động vẫn còn, không đóng BHXH tháng đó) và **nghỉ thai sản** (được ghi nhận chế độ, hưởng trợ cấp BHXH). *(Điều kiện chính xác cần xác minh.)*

- **`BR-pay-023` (Số dư Phép năm & Tích lũy theo Thâm niên)** — *P1*
  - Số ngày phép được hưởng trong năm:
    $$\text{phepNam}(nv, Y) = \text{basePaidLeaveDays} + \Big\lfloor \tfrac{\text{soNamThamNien}(nv, Y)}{\text{seniorityYearsPerDay}} \Big\rfloor$$
  - Nhân viên vào làm giữa năm được hưởng theo tỷ lệ số tháng làm việc:
    $$\text{phepNamProrated} = \text{round}\Big(\text{phepNam} \times \tfrac{\text{soThangLamViecTrongNam}}{12}\Big)$$
  - Ngày công loại `nghi_phep` trừ vào số dư; số dư không được âm. Vượt số dư thì ngày vượt chuyển thành `khong_luong` và hệ thống cảnh báo.

- **`BR-pay-024` (Thanh toán Phép năm chưa nghỉ hết)** — *P1*
  - Khi chấm dứt hợp đồng, hoặc theo chính sách cuối năm nếu doanh nghiệp có quy định:
    $$\text{tienPhepChuaNghi} = \text{round}\Big(\tfrac{\text{luongLamCanCu}}{\text{standardWorkDays}} \times \text{soNgayPhepConLai}\Big)$$
  - Khoản này **chịu thuế TNCN** và không tính đóng bảo hiểm (*cần xác minh*). Ghi nhận thành cấu phần breakdown riêng, không trộn vào `proratedWorkSalary`.

- **`BR-pay-025` (Kiểm soát Trần Giờ làm thêm)** — *P0*
  - Hệ thống kiểm tra ba ngưỡng, lấy từ `GeneralSetting`:
    $$\text{H}^{thang} = \sum_{k} h_k \le \text{otMonthlyLimitHours} \ (40)$$
    $$\text{H}^{nam} = \sum_{\text{các kỳ trong năm}} \text{H}^{thang} \le \text{otYearlyLimitHours} \ (300), \quad \text{cảnh báo khi} > \text{otYearlyWarningHours} \ (200)$$
  - Vượt trần **tháng** hoặc trần **năm**: hệ thống vẫn tính đủ tiền cho người lao động (không được trừ quyền lợi) nhưng ghi cảnh báo tuân thủ vào kết quả tính lương và **chặn khóa sổ** cho tới khi người có thẩm quyền xác nhận đã biết (`E-pay-015`).
  - Trần 300h/năm chỉ áp cho ngành nghề được phép; ngành khác là 200h (*danh mục ngành nghề cần xác minh*).

- **`BR-pay-026` (Cấu thành Hệ số Làm thêm giờ & Phụ cấp Ca đêm)** — *P0*
  - Hệ thống hỗ trợ đủ **6** loại làm thêm với hệ số mặc định: ngày thường ban ngày 150%, ngày thường ban đêm 200%, ngày nghỉ hàng tuần ban ngày 200%, **ngày nghỉ hàng tuần ban đêm 270%**, ngày lễ ban ngày 300%, ngày lễ ban đêm 390%.
  - Với ca làm thêm ban đêm, tiền được tách thành ba cấu phần để phục vụ hạch toán và miễn thuế:
    $$\text{tienOT}_k = \underbrace{\text{donGia} \times h_k}_{\text{phần chuẩn}} + \underbrace{\text{donGia} \times h_k \times 30\%}_{\text{phụ cấp đêm}} + \underbrace{\text{donGia} \times h_k \times (r_k - 1 - 0{,}3)}_{\text{phần trả thêm do làm thêm giờ}}$$
  - Phần chuẩn chịu thuế TNCN; **phụ cấp đêm và phần trả thêm được miễn thuế** theo `BR-pay-004`. Ba cấu phần phải xuất hiện thành các dòng breakdown riêng.
  - Hệ số lấy từ `GeneralSetting`, **không hard-code**. Hệ số cấu hình thấp hơn mức sàn luật định thì hệ thống từ chối lưu cấu hình.

- **`BR-pay-027` (Tiền lương làm Căn cứ tính Đơn giá Làm thêm giờ)** — *P0*
  - Đơn giá giờ làm thêm tính trên **tiền lương thực trả theo công việc đang làm**, gồm lương cơ bản cộng các khoản có cờ `isOvertimeBase = true`:
    $$\text{luongCanCuOT} = \text{baseSalaryMonthly} + \sum_{i:\ \text{isOvertimeBase}_i} \text{configuredAmount}_i$$
    $$\text{donGiaGioChuan} = \frac{\text{luongCanCuOT}}{\text{standardWorkDays} \times \text{standardHoursPerDay}}$$
  - `standardHoursPerDay` lấy từ `GeneralSetting`, không hard-code 8.0.
  - Giá trị `luongCanCuOT` phải được snapshot vào cột riêng `overtimeBaseSalary` để tái lập được đơn giá khi kiểm toán.

### Nhóm 9: Lương tối thiểu vùng & Nguồn Chân lý Lương đóng Bảo hiểm

- **`BR-pay-028` (Kiểm soát Lương tối thiểu Vùng theo Địa bàn)** — *P0*
  - Mỗi phòng ban hoặc chi nhánh phải khai `regionCode` thuộc `{I, II, III, IV}`. Mức tối thiểu tra từ bảng `region_minimum_wages` theo vùng và ngày hiệu lực (*4 mức cần xác minh*).
  - Hai phép kiểm tra bắt buộc, thực hiện **trước khi cho khóa sổ**:
    $$\text{(1) } \text{insuranceSalaryBase} \ge \text{LTT}_{vung} \qquad \text{(2) } \text{proratedWorkSalary} + \text{fixedAllowanceSalary}^{\text{tính vào lương}} \ge \text{LTT}_{vung} \times \tfrac{\text{actualWorkDays}}{\text{standardWorkDays}}$$
  - Vi phạm (2) là **lỗi chặn khóa sổ** (`E-pay-016`), không phải cảnh báo — vì trả lương dưới mức tối thiểu vùng là vi phạm pháp luật lao động. Vi phạm (1) là cảnh báo (giữ hành vi hiện tại của `EC-pay-010`).
  - Mức áp dụng cho lao động đã qua đào tạo nghề có thể cao hơn mức sàn chung (*cần xác minh*); nếu doanh nghiệp áp dụng, khai trong `region_minimum_wages` thành cột riêng.
  - Mức vùng đã áp dụng phải được snapshot vào `payroll_sheet_lines`.

- **`BR-pay-029` (Nguồn Chân lý của Lương đóng Bảo hiểm)** — *P0*
  - Lương làm căn cứ đóng bảo hiểm được **suy ra** từ cơ cấu lương, không nhập tay:
    $$\text{insuranceSalaryBase}^{suyRa} = \text{baseSalaryMonthly} + \sum_{i:\ \text{isSocialInsurance}_i = \text{true}} \text{configuredAmount}_i$$
  - Nếu hợp đồng có khai `socialInsuranceSalary` thủ công và giá trị đó **nhỏ hơn** giá trị suy ra, hệ thống ghi cảnh báo tuân thủ và **chặn khóa sổ** (`E-pay-017`) cho tới khi được xác nhận có căn cứ.
  - Nếu giá trị khai thủ công **lớn hơn hoặc bằng** giá trị suy ra, chấp nhận (doanh nghiệp có quyền đóng cao hơn).
  - Quy tắc này làm cho cờ `isSocialInsurance` của `BR-pay-002` có tác dụng thật, và phải có ca kiểm thử thay đổi cờ để chứng minh số tiền bảo hiểm thay đổi.

### Nhóm 10: Truy lĩnh, Điều chỉnh & Kiểm soát Chu trình

- **`BR-pay-030` (Kết chuyển Công nợ Thực lĩnh Âm sang Kỳ kế tiếp)** — *P0*
  - Khi kỳ $k$ có $\text{netTakeHomeSalary}_k < 0$, số âm đó là công nợ nhân viên nợ doanh nghiệp và phải được kết chuyển tự động sang kỳ $k+1$:
    $$\text{carriedForwardDebtIn}_{k+1} = \max\big(0,\ -\text{netTakeHomeSalary}_k\big)$$
    $$\text{thucLinh}_{k+1} = \text{grossIncome}_{k+1} - BH - CD - \text{thue} - \text{adjustmentNetAmount}_{k+1} - \text{carriedForwardDebtIn}_{k+1}$$
  - Kết chuyển chỉ thực hiện từ kỳ ở trạng thái `PAID` hoặc `ARCHIVED` (đã chốt tiền thật), không kết chuyển từ kỳ `DRAFT`.
  - Nếu kỳ $k+1$ tiếp tục âm, công nợ tiếp tục kết chuyển sang $k+2$; hệ thống cảnh báo khi công nợ tồn quá 3 kỳ liên tiếp.
  - Kỳ $k$ bị `reopen` và tính lại thì công nợ đã kết chuyển ở $k+1$ phải được hủy và tính lại (`E-pay-018` nếu $k+1$ đã `LOCKED`).

- **`BR-pay-031` (Kỳ lương Điều chỉnh — Không sửa Lịch sử)** — *P0*
  - Sai sót phát hiện sau khi kỳ đã `APPROVED` hoặc `PAID` **không được** xử lý bằng `reopen`. Phải tạo một **kỳ lương điều chỉnh** tham chiếu tới kỳ gốc:
    $$\text{soDieuChinh}_{nv} = \text{giaTriDung}_{nv} - \text{giaTriDaChot}_{nv}$$
  - Kỳ điều chỉnh chỉ chứa các nhân viên có $\text{soDieuChinh} \ne 0$, đi qua đúng vòng đời chuẩn (`DRAFT → PENDING_REVIEW → LOCKED → APPROVED → PAID`), và snapshot riêng.
  - Kỳ gốc giữ nguyên tuyệt đối. Báo cáo năm cộng gộp kỳ gốc và kỳ điều chỉnh.

- **`BR-pay-032` (Giới hạn Phạm vi Reopen)** — *P0*
  - `reopen` chỉ áp dụng cho trạng thái `LOCKED` (giữ nguyên `BR-pay-011`). Kỳ `APPROVED`, `PAID`, `ARCHIVED` **tuyệt đối không** được reopen (`E-pay-019`) — dùng `BR-pay-031` thay thế.
  - Số lần reopen của một kỳ được đếm và hiển thị; vượt 3 lần thì hệ thống cảnh báo kiểm soát nội bộ và yêu cầu phê duyệt cấp cao hơn.

- **`BR-pay-033` (Snapshot Tham số Pháp lý tại Thời điểm Khóa sổ)** — *P0*
  - Khi kỳ chuyển sang `LOCKED`, hệ thống ghi bất biến toàn bộ tham số dùng để tính, gồm tối thiểu: lương cơ sở, lương tối thiểu vùng theo từng vùng, 6 tỷ lệ bảo hiểm, tỷ lệ và trần đoàn phí, mức giảm trừ bản thân và NPT, biểu thuế 7 bậc, `standardHoursPerDay`, 6 hệ số OT, trần miễn thuế ăn trưa.
  - Mọi báo cáo và mọi lần tính lại của kỳ đã khóa **phải đọc từ snapshot này**, không đọc `GeneralSetting` hiện hành.
  - Không có snapshot tham số thì kỳ không đủ điều kiện `APPROVED`.

- **`BR-pay-034` (Phân tách Nhiệm vụ trong Chu trình Duyệt lương)** — *P0*
  - Bổ sung vai `DIRECTOR`. Phân công lại: `ACCOUNTANT` khóa sổ, `DIRECTOR` phê duyệt, `ACCOUNTANT` xác nhận chi trả, `ADMIN` **chỉ** được mở lại kỳ (thao tác kỹ thuật có kiểm toán).
  - Ràng buộc bất biến: với cùng một kỳ lương, $\text{lockedByUserId} \ne \text{approvedByUserId}$ và $\text{approvedByUserId} \ne \text{paidByUserId}$. Vi phạm ném `E-pay-020`.
  - `ADMIN` **không còn** được phê duyệt bảng lương. Ma trận RBAC ở `payroll-states.md`, `api-contract.md` và `test-matrix.md` phải được cập nhật đồng bộ.

- **`BR-pay-035` (Nhật ký Truy cập Dữ liệu Lương)** — *P0*
  - Mọi hành động sau đây phải ghi `AuditLog` với `actorId`, `targetEmployeeId` (nếu có), `periodId`, thời điểm và địa chỉ IP: khóa sổ, từ chối, phê duyệt, xác nhận chi trả, lưu trữ, mở lại, **xem bảng lương toàn công ty**, **xem phiếu lương của người khác**, **xuất Excel**.
  - Nhân viên xem phiếu lương của chính mình cũng được ghi nhận (mức thông tin, không cảnh báo).
  - Nhật ký là bất biến, chỉ ghi thêm, và được giữ tối thiểu theo `NFR-pay-010`.

- **`BR-pay-036` (Chỉ dùng Mức lương đã được Phê duyệt)** — *P0*
  - Chỉ bản ghi `EmployeeSalary` có `status = APPROVED` **và** còn hiệu lực tại ngày cuối kỳ mới được dùng để tính lương.
  - Nhân viên chưa có mức lương `APPROVED`: hệ thống loại khỏi kỳ tính và liệt kê trong danh sách cảnh báo (`E-pay-021`), **không** âm thầm dùng mức `PENDING_APPROVAL`.
  - Snapshot `employeeSalaryId` và `setupVersion` đã dùng vào `payroll_sheet_lines` để truy vết.

- **`BR-pay-037` (Làm tròn khi Chi trả)** — *P1*
  - Số tiền hạch toán giữ nguyên đơn vị 1đ. Số tiền lập lệnh chuyển khoản làm tròn xuống theo `paymentRoundingUnit` (mặc định 1.000đ):
    $$\text{soTienChiTra} = \Big\lfloor \tfrac{\text{netTakeHomeSalary}}{u} \Big\rfloor \times u, \qquad \text{chenhLechLamTron} = \text{netTakeHomeSalary} - \text{soTienChiTra}$$
  - $\text{chenhLechLamTron}$ được kết chuyển sang kỳ sau như một khoản bù (`direction = bu`), không bị mất.
  - Chỉ áp dụng khi $\text{netTakeHomeSalary} > 0$. Số âm giữ nguyên không làm tròn.

- **`BR-pay-038` (Biểu mẫu & Báo cáo Bắt buộc)** — *P1*
  - Hệ thống phải xuất được, từ dữ liệu snapshot của kỳ đã `LOCKED` trở đi: bảng thanh toán tiền lương theo mẫu chế độ kế toán, tờ khai khấu trừ thuế TNCN kỳ, bảng kê quyết toán thuế năm, báo cáo tăng/giảm lao động BHXH. *(Số hiệu mẫu và cấu trúc cột cần xác minh.)*
  - Mọi báo cáo phải ghi rõ nguồn dữ liệu là snapshot kỳ nào, thời điểm kết xuất, người kết xuất; và phải khớp 100% với `payroll_sheet_lines` của kỳ đó.

---

## 5. Đề xuất Yêu cầu Phi chức năng (`NFR-pay-001` .. `NFR-pay-014`)

> Hồ sơ hiện tại **không có bất kỳ NFR nào** (tìm kiếm chuỗi `NFR` trên `docs/payroll/` cho 0 kết quả). Toàn bộ mục này là mới. Mỗi NFR đều kèm cách đo để bảo đảm kiểm chứng được.

### 5.1. Hiệu năng & Quy mô

| Mã | Yêu cầu | Cách đo / Tiêu chí đạt |
|---|---|---|
| **`NFR-pay-001`** | Tính lương toàn kỳ cho **1.000 nhân viên** hoàn tất trong **≤ 30 giây** (p95); cho **5.000 nhân viên** trong **≤ 150 giây** (p95). | Chạy `GET /payroll/calculate` trên bộ dữ liệu chuẩn 1.000 và 5.000 NV, lặp 20 lần, lấy p95. |
| **`NFR-pay-002`** | Đọc bảng lương snapshot (`GET /payroll/sheet-lines`, 1 kỳ, phân trang 50 dòng) trả về trong **≤ 500ms** (p95) ở quy mô 10.000 dòng/kỳ. | Đo trên DB đã seed 24 kỳ × 10.000 dòng. Đối chiếu cam kết "dưới 15ms" ở `CONTEXT_SUMMARY.md:65` — cam kết đó là thời gian truy vấn DB, **không phải** thời gian phản hồi API; cần tách bạch. |
| **`NFR-pay-003`** | Giao dịch khóa sổ (`POST /lock`) cho **5.000 nhân viên** (~40.000 dòng breakdown) hoàn tất trong **≤ 180 giây** và không giữ transaction quá **300 giây** (tránh timeout mặc định của Postgres/Prisma). | Chèn theo lô ≤ 1.000 bản ghi (giải quyết `ISSUE-PAY-02`). Đo thời gian transaction thực tế. |
| **`NFR-pay-004`** | Hệ thống hỗ trợ tối thiểu **10.000 nhân viên đang hoạt động** và **120 kỳ lương** (10 năm) mà không suy giảm quá 20% so với `NFR-pay-001`/`002`. | Kiểm thử tải theo kịch bản tăng dần; ghi nhận điểm gãy. |

### 5.2. Tính đúng đắn & Toàn vẹn Tài chính

| Mã | Yêu cầu | Cách đo / Tiêu chí đạt |
|---|---|---|
| **`NFR-pay-005`** | **Sai lệch tài chính bằng 0**: với cùng đầu vào, hai lần tính liên tiếp cho kết quả giống hệt tới từng đồng; và tổng các dòng breakdown khớp tuyệt đối với dòng tổng hợp. | Bật kiểm tra checksum trước khi commit snapshot (`ISSUE-PAY-01`, `E-pay-007`). Chạy kiểm thử tính hai lần trên 1.000 NV, so khớp toàn bộ 41 cột. |
| **`NFR-pay-006`** | Toàn bộ số tiền lưu dạng số nguyên VNĐ; quy tắc làm tròn được **định nghĩa một chỗ duy nhất** và đúng với cả số âm (làm tròn ra xa số 0). | Bộ kiểm thử đơn vị cho hàm làm tròn phải phủ: `−2.5 → −3`, `2.5 → 3`, `−0.5 → −1`, `0.5 → 1`. (Hiện `TC-PAY-063` chỉ phủ số dương.) |
| **`NFR-pay-007`** | Khả năng **tái lập kết quả (reproducibility)**: có thể tính lại chính xác kết quả của bất kỳ kỳ đã khóa nào, chỉ từ dữ liệu snapshot, kể cả sau khi cấu hình và mức lương đã thay đổi. | Kiểm thử: khóa kỳ → đổi toàn bộ `GeneralSetting` và mức lương → chạy lại báo cáo kỳ cũ → đối chiếu từng đồng. Phụ thuộc `BR-pay-033`. |
| **`NFR-pay-008`** | Không có tính toán tài chính nào dùng số học dấu phẩy động cho phép cộng dồn tiền; mọi phép chia phải làm tròn ngay tại điểm phát sinh, không tích lũy sai số. | Rà soát tĩnh + kiểm thử với 10.000 dòng ngẫu nhiên, so tổng cộng dồn với tổng tính lại. |

### 5.3. Bảo mật, Quyền riêng tư & Kiểm toán

| Mã | Yêu cầu | Cách đo / Tiêu chí đạt |
|---|---|---|
| **`NFR-pay-009`** | Dữ liệu lương được phân loại là **dữ liệu cá nhân nhạy cảm**. Mọi truy cập phải qua xác thực và kiểm tra quyền ở tầng service (không chỉ tầng controller). Nhân viên chỉ truy cập được dữ liệu của chính mình, kể cả khi thao tác trực tiếp tham số truy vấn. | Kiểm thử bảo mật: thử 20 biến thể IDOR trên `payslips/my`, `sheet-lines/:id`, `export-excel`. Tất cả phải trả 403. Căn cứ NĐ 13/2023/NĐ-CP (*phạm vi nghĩa vụ cần xác minh*). |
| **`NFR-pay-010`** | Nhật ký kiểm toán (`BR-pay-035`) là **append-only**, giữ tối thiểu **10 năm**, và không thể bị xóa/sửa bởi bất kỳ vai nào qua giao diện ứng dụng. | Kiểm thử: không tồn tại endpoint xóa/sửa `audit_logs`. Kiểm tra quyền DB của tài khoản ứng dụng. |
| **`NFR-pay-011`** | Snapshot bảng lương (`payroll_sheet_lines`, `payroll_sheet_item_breakdowns`) được lưu giữ tối thiểu **10 năm** kể từ kỳ tính, phục vụ thanh tra thuế và BHXH. Không có tác vụ nào được phép xóa dữ liệu kỳ ở trạng thái `PAID`/`ARCHIVED`. | Kiểm tra ràng buộc: `ON DELETE CASCADE` từ `payroll_periods` hiện cho phép xóa kỳ kéo theo xóa snapshot — cần chặn xóa kỳ không ở `DRAFT` ở tầng service. *(Thời hạn lưu trữ cần xác minh.)* |
| **`NFR-pay-012`** | Không ghi số tiền lương cá nhân, mã số thuế, số tài khoản ngân hàng vào log ứng dụng ở mức `info`/`debug` trên môi trường production. | Rà soát tĩnh chuỗi log + kiểm thử: chạy 1 kỳ tính lương, grep log tìm mẫu số tiền và số tài khoản. |

### 5.4. Vận hành & Khả năng phục hồi

| Mã | Yêu cầu | Cách đo / Tiêu chí đạt |
|---|---|---|
| **`NFR-pay-013`** | Trước mỗi thao tác `LOCK` và `REOPEN`, hệ thống phải bảo đảm có bản sao lưu dữ liệu hồi phục được về thời điểm ngay trước thao tác (point-in-time recovery). Thời gian phục hồi mục tiêu **RTO ≤ 4 giờ**, mất mát dữ liệu mục tiêu **RPO ≤ 15 phút**. | Diễn tập phục hồi định kỳ; ghi nhận thời gian thực tế. |
| **`NFR-pay-014`** | Hai yêu cầu khóa sổ đồng thời trên cùng kỳ: đúng **một** thành công, yêu cầu còn lại nhận `E-pay-006` (409). Không xảy ra ghi đè (last-write-wins) trong mọi trường hợp. | Kiểm thử đồng thời 10 luồng × 20 lần lặp. (`BUG-PAY-02` đã vá; NFR này biến nó thành yêu cầu thường trực có kiểm thử hồi quy.) |

---

## 6. Khuyến nghị Lộ trình

### 6.1. Nguyên tắc phân đợt

Phân loại theo hai trục: **rủi ro tài chính/pháp lý** và **chi phí thay đổi**. Những gì làm ra **số tiền sai** hoặc **vi phạm pháp luật** được ưu tiên tuyệt đối, kể cả khi tốn công; những gì chỉ làm tài liệu lệch nhau xếp sau.

### 6.2. Đợt 0 — Sửa hồ sơ trước khi nói chuyện code (0.5–1 ngày, làm ngay)

Chỉ sửa tài liệu, không đụng code. Mục tiêu: hồ sơ ngừng nói dối về chính nó.

| Việc | Căn cứ |
|---|---|
| Sửa `CONTEXT_SUMMARY.md`: bộ mã TC sai (A-03), mã BR sai (A-23), trạng thái 2 bug đã vá (A-22), mô tả model sai 5 tên trường (B-01), con số test 414 (A-25), gộp 3 chuỗi Status thành 1 (A-24) | A-03, A-22, A-23, A-24, A-25, B-01 |
| Sửa tiêu đề Mục 4 `payroll-spec.md` từ `BR-pay-020` về `BR-pay-011` | A-05 |
| Sửa `test-matrix.md`: phân bổ ưu tiên thật (28/11/2, tổng 41) | A-01, A-02 |
| Chốt **một** đường dẫn endpoint chi trả (`mark-paid` hay `pay`) và sửa đồng bộ 4 tài liệu | A-08 |
| Chốt **một** định dạng phong bì lỗi và sửa đồng bộ | A-12 |
| Thêm mục **Phạm vi / Ngoài phạm vi / Giả định / Câu hỏi mở** vào `payroll-spec.md` — ghi rõ những gì trong Mục 3 là "cố ý để sau" | A-31, GAP-PAY-24 |

### 6.3. Đợt 1 — Chặn phát hành (P0, ~2–3 tuần)

Không được đưa phân hệ vào vận hành thật khi chưa xong nhóm này.

| Nhóm | Nội dung | Mã liên quan |
|---|---|---|
| **Số tiền sai** | Hiệu lực NPT theo tháng; gross-up hợp đồng NET; đơn giá OT theo lương thực trả; nguồn chân lý lương đóng BHXH | `BR-pay-012`, `013`, `027`, `029` · GAP-PAY-01, 02, 13, 15 |
| **Vi phạm pháp luật** | Trần giờ làm thêm; kiểm tra lương tối thiểu vùng theo địa bàn; đủ 6 hệ số OT và tách phụ cấp đêm | `BR-pay-025`, `026`, `028` · GAP-PAY-11, 12, 14 |
| **Kiểm soát nội bộ** | Phân tách nhiệm vụ (vai `DIRECTOR`); chỉ dùng mức lương `APPROVED`; nhật ký truy cập dữ liệu lương | `BR-pay-034`, `035`, `036` · GAP-PAY-19, 20, 21 |
| **Khả năng kiểm toán** | Snapshot tham số pháp lý; tách "thu nhập chịu thuế" khỏi "thu nhập tính thuế" và lưu các khoản giảm trừ | `BR-pay-033` · GAP-PAY-18, G-02 |
| **Tính xác định của quy tắc** | Định danh khoản miễn thuế bằng cờ (`taxExemptType`), bỏ dò tên; chuẩn hóa miền `item_category` thành enum có CHECK; xóa giá trị `WORK_DAYS` không tồn tại khỏi spec, test và mã | `BR-pay-019`, `020` · GAP-PAY-07, 08 · B-02, B-03, B-09, B-13 |
| **Cấu hình phải có tác dụng** | Bỏ hard-code: 11tr/4.4tr, trần 46.8tr/99.2tr, tỷ lệ BH, `standardHoursPerDay` — đọc từ `GeneralSetting` | B-05, B-06, B-07 |
| **Chu trình** | Bổ sung endpoint `submit`/`reject`; chốt quyền khóa sổ chỉ từ `PENDING_REVIEW`; cấm reopen sau `APPROVED` | `BR-pay-032` · A-06, A-09 |
| **Lịch sử lương** | Bỏ `@unique` trên `EmployeeSalary.employeeId`, cho phép nhiều bản ghi theo hiệu lực (điều kiện tiên quyết của truy lĩnh) | B-12 |

### 6.4. Đợt 2 — Trước khi chạy kỳ lương thật đầu tiên (P0/P1, ~2–3 tuần)

| Nội dung | Mã liên quan |
|---|---|
| Kết chuyển công nợ thực lĩnh âm sang kỳ sau (tự động, có truy vết) | `BR-pay-030` · GAP-PAY-16 |
| Kỳ lương điều chỉnh (không sửa lịch sử) | `BR-pay-031` · GAP-PAY-17 |
| Trợ cấp ốm đau / thai sản tách khỏi lương, miễn thuế | `BR-pay-021`, `022` · GAP-PAY-09 |
| Trần miễn thuế theo từng loại khoản (điện thoại, trang phục, công tác phí) | `BR-pay-019` · GAP-PAY-07 |
| Làm tròn khi chi trả và kết chuyển chênh lệch | `BR-pay-037` · GAP-PAY-22 |
| Cam kết thu nhập thấp; cá nhân không cư trú; giảm trừ chỉ tại một nơi | `BR-pay-016`, `017`, `018` · GAP-PAY-04, 05, 06 |
| Bổ sung toàn bộ NFR + bộ kiểm thử tương ứng | `NFR-pay-001`..`014` |

### 6.5. Đợt 3 — Trước kỳ quyết toán năm đầu tiên (P0 theo thời điểm, ~3–4 tuần)

| Nội dung | Mã liên quan |
|---|---|
| Quyết toán thuế TNCN năm, ủy quyền quyết toán, chênh lệch phải nộp/được hoàn | `BR-pay-014` · GAP-PAY-03 |
| Chứng từ khấu trừ thuế TNCN | `BR-pay-015` |
| Biểu mẫu và báo cáo bắt buộc (bảng thanh toán tiền lương, tờ khai khấu trừ, báo cáo BHXH) | `BR-pay-038` · GAP-PAY-23 |
| Nghỉ phép năm: số dư, tích lũy thâm niên, thanh toán phép chưa nghỉ | `BR-pay-023`, `024` · GAP-PAY-10 |

### 6.6. Backlog (P2 — nợ tài liệu, không chặn)

- Vẽ lại sơ đồ phân làn thật bằng `/activity-swimlane` cho `payroll-flows.md` Mục 1 (A-14).
- Thống nhất wording mã lỗi `E-dltl-001` giữa các tài liệu (A-13).
- Sửa tham chiếu sai `EC-pay-006` trong `BUG-PAY-02` (A-21) và các con số thống kê lỗi mâu thuẫn (A-20).
- Bổ sung ánh xạ ngược thiếu trong ma trận truy vết (A-17, A-18, A-19).
- Bổ sung ca kiểm thử cho `WorkDayMethod.ACTUAL` (A-28), cho hệ số OT 270% và 200% ban đêm (B-15).
- Sửa `TC-PAY-063` để phủ số âm; sửa `TC-PAY-010` khai đủ `hasSocialInsurance`; sửa `TC-PAY-003` để thực sự kiểm chứng `BR-pay-001` và `BR-pay-009` (G-03, G-04, G-09).
- Định nghĩa bộ `FR-pay-*` đầy đủ để hồ sơ đạt chuẩn SRS (A-31).

### 6.7. Điều kiện tiên quyết trước khi merge tài liệu này

1. **Chờ kết quả agent nghiên cứu pháp lý** để thay thế mọi chỗ đánh dấu *cần xác minh* bằng căn cứ chính xác — đặc biệt: mức giảm trừ gia cảnh hiện hành, các định mức miễn thuế theo loại khoản, 4 mức lương tối thiểu vùng, thuế suất cá nhân không cư trú, trần giờ làm thêm theo ngành, số hiệu biểu mẫu, thời hạn lưu trữ chứng từ, và tính hợp pháp của việc giảm trừ đoàn phí công đoàn khỏi thu nhập tính thuế (G-01).
2. **Quyết định của chủ sở hữu sản phẩm** về phạm vi: những GAP nào nhận vào phiên bản này, những GAP nào ghi rõ là **Out of Scope** trong `payroll-spec.md`. Một lỗ hổng được tuyên bố ngoài phạm vi là chấp nhận được; một lỗ hổng bị bỏ quên thì không.
3. **Đánh số lại** nếu chủ sở hữu chọn tập con: giữ nguyên mã đã đề xuất cho phần được nhận, không tái sử dụng mã của phần bị loại.

---

*Tài liệu này được lập bằng phương pháp rà soát độc lập có chủ đích hoài nghi: mọi phát hiện đều dẫn chiếu vị trí cụ thể trong tài liệu hoặc mã nguồn, mọi con số tài chính đều được tính lại thủ công, và mọi căn cứ pháp lý chưa chắc chắn đều được đánh dấu rõ thay vì khẳng định.*

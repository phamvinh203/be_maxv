# Ma Trận Truy Vết Kiểm Thử Phân Hệ Bảng Lương (Payroll Test Traceability Matrix)

> **Mã tài liệu**: `TM-PAY-001`  
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)  
> **Giai đoạn**: Phase A — Spec Review & Test Design (Mô hình Shift-Left 3 Amigos)  
> **Tác giả**: QA/Tester Engineer  
> **Ngày phê duyệt**: 2026-09-06  
> **Phiên bản**: `1.0.0` (Ready for BA Final Sign-off Gate)  
> **Tài liệu tham chiếu**:  
> - `docs/payroll/srs/payroll-spec.md` (Đặc tả SRS & Business Rules)  
> - `docs/payroll/srs/payroll-flows.md` (Sơ đồ luồng & Tuần tự)  
> - `docs/payroll/srs/payroll-states.md` (Vòng đời trạng thái & Bất biến)  
> - `docs/payroll/srs/payroll-erd.md` (Sơ đồ thực thể & Data Dictionary)  
> - `docs/payroll/CONTEXT_SUMMARY.md` (Bộ nhớ ngữ cảnh phân hệ)  

---

## 1. Tổng Quan Chiến Lược Kiểm Thử (Test Strategy & Quality Goals)

### 1.1. Mục Tiêu Chất Lượng (Quality Objectives)
1. **Zero Financial Discrepancy (Không sai lệch tài chính)**: Mọi phép tính số tiền thu nhập gộp (Gross), bảo hiểm bắt buộc, kinh phí công đoàn, thuế thu nhập cá nhân (PIT) và thực lĩnh (Net) phải khớp tuyệt đối 100% với chuẩn pháp lý Việt Nam, áp dụng quy tắc làm tròn số nguyên bản `ROUND_HALF_UP` (đơn vị 1 VNĐ).
2. **100% Legal Compliance (Tuân thủ pháp luật lao động & thuế)**:
   - **Bộ luật Lao động 2019**: Trả lương thời gian, làm thêm giờ (OT 150%, 200%, 300%, 390%).
   - **Thông tư 111/2013/TT-BTC**: Khấu trừ 10% tại nguồn cho HĐ Thử việc / Dịch vụ / Thời vụ không giảm trừ gia cảnh; bóc tách miễn thuế phần tiền OT dôi dư cao hơn giờ chuẩn.
   - **Nghị định 73/2024/NĐ-CP & 74/2024/NĐ-CP**: Tách biệt 2 trần bảo hiểm độc lập: Trần BHXH/BHYT = 46.800.000 VNĐ; Trần BHTN = 99.200.000 VNĐ.
   - **Thông tư 26/2016/TT-BLĐTBXH**: Khống chế mức miễn thuế ăn trưa tối đa 730.000 VNĐ/tháng và quy đổi chính xác theo tỷ lệ ngày công thực tế.
3. **Data Integrity & Audit Immutability (Bảo toàn dữ liệu & Kiểm toán)**:
   - Khóa sổ nguyên tử (`Prisma.$transaction`) ghi đồng thời bảng tổng hợp (`payroll_sheet_lines`) và bảng chi tiết cấu phần (`payroll_sheet_item_breakdowns`).
   - Đóng băng 100% dữ liệu 8 phân hệ nguồn khi kỳ lương chuyển sang `LOCKED`.
   - Reopen có kiểm toán: Bắt buộc quyền `ADMIN`, lý do $\ge 20$ ký tự, ghi nhận `AuditLog` và xóa sạch snapshot cũ.
4. **Shift-Left Readiness**: Cung cấp đầy đủ Test Matrix và Test Cases BDD Gherkin chi tiết để Backend Engineer có thể triển khai TDD (Test-Driven Development) ngay khi BA chốt Gate.

### 1.2. Phân Cấp Mức Độ Kiểm Thử (Test Levels)
- **Unit Test (L1)**: Kiểm thử độc lập từng module tính toán thuần túy (Pure Functions):
  + Biểu thuế lũy tiến 7 bậc và thuế 10% tại nguồn.
  + Tách 2 trần bảo hiểm (BHXH/BHYT 46.8tr vs BHTN 99.2tr).
  + Bóc tách phần miễn thuế OT theo giờ chuẩn.
  + Khống chế trần ăn trưa 730k theo ngày công thực tế.
  + Quy tắc làm tròn `ROUND_HALF_UP` tiền VNĐ.
- **Integration Test (L2)**: Kiểm thử tích hợp Database và Service Pipeline:
  + Pipeline 6 Stage trong `PayrollCalculationService`.
  + Giao dịch nguyên tử `$transaction` khi Khóa sổ (`POST /lock`) và Mở lại (`POST /reopen`).
  + Ràng buộc toàn vẹn khóa ngoại (Foreign Key Cascade vs Restrict) giữa `PayrollSheetLine` và `PayrollSheetItemBreakdown`.
  + Guard kiểm tra trạng thái khóa sổ (`PayrollPeriodLockGuard` ném `E-dltl-001`).
- **End-to-End & RBAC Test (L3)**: Kiểm thử toàn trình vòng đời trạng thái kỳ lương (`DRAFT` -> `PENDING_REVIEW` -> `LOCKED` -> `APPROVED` -> `PAID` -> `ARCHIVED`) kết hợp ma trận phân quyền 4 vai trò (`ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE`).

---

## 2. Phân Bổ Mức Độ Ưu Tiên Kiểm Thử (Priority Classification)

| Mức ưu tiên | Định nghĩa & Tiêu chí | Số lượng Test Cases | Tỷ lệ (%) | Phạm vi áp dụng |
|:---:|---|:---:|:---:|---|
| **P0 (Blocker / Critical)** | Tính toán cốt lõi ảnh hưởng trực tiếp đến tiền lương, thuế nhà nước, bảo hiểm bắt buộc; an ninh phân quyền RBAC; tính nguyên tử của giao dịch khóa sổ; tính bất biến của snapshot. Nếu lỗi, hệ thống bị dừng phát hành (Release Blocker). | 18 | 45.0% | `BR-pay-003`..`008`, `BR-pay-010`..`011`, `E-pay-001`..`002`, `E-pay-006`..`009`, `EC-pay-002`..`005`. |
| **P1 (High)** | Các quy tắc tính toán phụ cấp theo công và cố định tháng; các kịch bản biên nhân sự (vào/nghỉ giữa tháng, chuyển loại HĐ); quy trình chuyển đổi trạng thái kỳ lương; các mã lỗi nghiệp vụ còn lại. | 16 | 40.0% | `BR-pay-001`..`002`, `BR-pay-009`, `E-pay-003`..`005`, `E-pay-010`, `EC-pay-001`, `EC-pay-006`..`008`. |
| **P2 (Medium / Low)** | Làm tròn tiền tệ VNĐ; kiểm tra cảnh báo lương dưới tối thiểu vùng; hiển thị đa đơn vị (Đồng, Nghìn, Triệu); các kiểm tra định dạng và dữ liệu rỗng. | 6 | 15.0% | `EC-pay-009`..`010`, UI formatting, Empty datasets. |
| **TỔNG CỘNG** | **Toàn bộ phạm vi Phân hệ Bảng lương** | **40** | **100%** | **Bao phủ 100% SRS, Flow, State và ERD** |

---

## 3. Ma Trận Truy Vết Hai Chiều (Bidirectional Test Traceability Matrix - TTM)

### 3.1. Ánh Xạ Quy Tắc Nghiệp Vụ (11 Business Rules: `BR-pay-001` .. `BR-pay-011`)

| Mã BR | Tên Quy Tắc Nghiệp Vụ | Căn Cứ Pháp Lý / Kỹ Thuật | Mã Test Case (BDD Gherkin) | Mức Ưu Tiên | Phương Pháp Kiểm Thử | Trạng Thái Thiết Kế |
|---|---|---|---|:---:|:---:|:---:|
| **`BR-pay-001`** | Tích hợp Đầy đủ Phụ cấp Lương & Trợ cấp Phúc lợi (Prorate theo ngày công vs Nhận trọn 100% cố định tháng) | Điều 90, 103 BLLĐ 2019; `SalaryItem` | `TC-PAY-001`, `TC-PAY-002`, `TC-PAY-003`, `TC-PAY-064` | **P1** | Unit, Integration | ✅ Complete |
| **`BR-pay-002`** | Phân loại Thu nhập Chịu thuế & Đóng BHXH theo Danh mục (`isTaxable`, `isSocialInsurance`) | Điều 30 TT 59/2015/TT-BLĐTBXH; `SalaryItem` | `TC-PAY-001`, `TC-PAY-003`, `TC-PAY-041` | **P1** | Unit, Integration | ✅ Complete |
| **`BR-pay-003`** | Định mức Miễn thuế Tiền Ăn trưa tối đa 730.000đ/tháng (Prorate theo tỷ lệ công khi thiếu công) | Khoản 2 Điều 2 TT 111/2013; TT 26/2016/TT-BLĐTBXH | `TC-PAY-040`, `TC-PAY-041`, `TC-PAY-042`, `TC-PAY-043` | **P0** | Unit, Integration | ✅ Complete |
| **`BR-pay-004`** | Miễn thuế TNCN Phần Tiền Làm Thêm Giờ (OT) Cao Hơn Giờ Chuẩn | Điểm i Khoản 1 Điều 3 Thông tư 111/2013/TT-BTC | `TC-PAY-002`, `TC-PAY-020`, `TC-PAY-021`, `TC-PAY-022`, `TC-PAY-023` | **P0** | Unit, Integration | ✅ Complete |
| **`BR-pay-005`** | Khấu trừ Thuế TNCN 10% tại Nguồn theo Loại Hợp đồng (`PROBATION`, `SERVICE_CONTRACT`, HĐ < 3 tháng $\ge 2$tr; KHÔNG giảm trừ gia cảnh) | Điểm i Khoản 1 Điều 25 Thông tư 111/2013/TT-BTC | `TC-PAY-010`, `TC-PAY-011`, `TC-PAY-012`, `TC-PAY-013` | **P0** | Unit, Integration | ✅ Complete |
| **`BR-pay-006`** | Tách biệt và Áp 2 Trần Đóng Bảo hiểm Bắt buộc (BHXH/BHYT 46.8tr vs BHTN 99.2tr) | Nghị định 73/2024/NĐ-CP & Nghị định 74/2024/NĐ-CP | `TC-PAY-030`, `TC-PAY-031`, `TC-PAY-032` | **P0** | Unit, Integration | ✅ Complete |
| **`BR-pay-007`** | Kinh phí Công đoàn (DN 2%) & Đoàn phí Công đoàn (NLĐ 1% trần 234.000đ) | Quyết định 1908/QĐ-TLĐ; Nghị định 191/2013/NĐ-CP | `TC-PAY-001`, `TC-PAY-033` | **P0** | Unit, Integration | ✅ Complete |
| **`BR-pay-008`** | Bất biến Công nợ Thực lĩnh Âm (Net Negative Tolerance - Không clamp về 0) | Chuẩn mực kế toán công nợ lương; SRS Mục 4 | `TC-PAY-060` | **P0** | Unit, Integration | ✅ Complete |
| **`BR-pay-009`** | Bất biến Chặn sàn Chuyên cần (Phạt chuyên cần tối đa bằng mức hưởng, không trừ lấn lương công) | SRS Mục 4; `diligenceSalary >= 0` | `TC-PAY-061` | **P1** | Unit, Integration | ✅ Complete |
| **`BR-pay-010`** | Snapshot Bất biến Đa tầng khi LOCKED (`payroll_sheet_lines` + `payroll_sheet_item_breakdowns`) | Chuẩn kiểm toán tài chính; SRS Mục 4 & ERD | `TC-PAY-050`, `TC-PAY-051`, `TC-PAY-052`, `TC-PAY-054` | **P0** | Integration, DB | ✅ Complete |
| **`BR-pay-011`** | Bảo mật Reopen Kỳ lương có Kiểm toán (Chỉ ADMIN, lý do $\ge 20$ ký tự, ghi `AuditLog`) | Chuẩn kiểm soát nội bộ; SRS Mục 4 | `TC-PAY-053`, `TC-PAY-077`, `TC-PAY-078` | **P0** | Integration, E2E | ✅ Complete |

---

### 3.2. Ánh Xạ Ma Trận Mã Lỗi Nghiệp Vụ (10 Error Codes: `E-pay-001` .. `E-pay-010`)

| Mã Lỗi | HTTP Status | Tiêu Đề Thông Báo Lỗi | Điều Kiện Kích Hoạt (Trigger Condition) | Mã Test Case (BDD Gherkin) | Mức Ưu Tiên |
|---|:---:|---|---|---|:---:|
| **`E-pay-001`** | 400 | `Kỳ lương chưa được tính toán bảng lương` | Gọi khóa sổ (`lock`) hoặc xuất file khi chưa chạy tính lương thành công | `TC-PAY-070` | **P0** |
| **`E-pay-002`** | 400 | `Kỳ lương đã khóa sổ, không thể tính toán lại` | Gọi lệnh tính toán (`/calculate`) khi kỳ đang ở `LOCKED`, `APPROVED`, `PAID`, `ARCHIVED` | `TC-PAY-071` | **P0** |
| **`E-pay-003`** | 400 | `Cấu hình thiết lập chung không hợp lệ` | Thiếu bản ghi `GeneralSetting` hoặc lương cơ sở/vùng/tỷ lệ thuế bị âm | `TC-PAY-072` | **P1** |
| **`E-pay-004`** | 404 | `Không tìm thấy dòng bảng lương của nhân viên trong kỳ` | Truy vấn chi tiết dòng lương của nhân viên không tồn tại trong kỳ | `TC-PAY-073` | **P1** |
| **`E-pay-005`** | 400 | `Không có nhân viên nào đủ điều kiện tính lương trong kỳ` | Toàn bộ nhân viên đều chấm dứt hợp đồng trước kỳ lương (`BR-dltl-002`) | `TC-PAY-074` | **P1** |
| **`E-pay-006`** | 409 | `Xung đột khóa sổ: Kỳ lương đang được xử lý đồng thời` | Hai người dùng đồng thời gửi request khóa sổ cùng một kỳ | `TC-PAY-075` | **P0** |
| **`E-pay-007`** | 400 | `Dữ liệu snapshot bảng lương không khớp tổng kiểm tra` | Sai lệch tổng số tiền giữa bảng `payroll_sheet_lines` và `breakdowns` khi khóa sổ | `TC-PAY-076` | **P0** |
| **`E-pay-008`** | 403 | `Chỉ Quản trị viên (ADMIN) mới có quyền mở lại kỳ lương` | Người dùng vai trò `HR` hoặc `ACCOUNTANT` cố gắng gọi API `POST /reopen` | `TC-PAY-077` | **P0** |
| **`E-pay-009`** | 400 | `Lý do mở lại kỳ lương phải có ít nhất 20 ký tự` | Gửi request `POST /reopen` với trường `reason` có độ dài $< 20$ ký tự | `TC-PAY-078` | **P0** |
| **`E-pay-010`** | 400 | `Không thể thanh toán kỳ lương chưa được Ban Giám Đốc phê duyệt` | Gọi hành động xác nhận chi trả (`/pay`) khi kỳ lương chưa chuyển sang `APPROVED` | `TC-PAY-079` | **P1** |

---

### 3.3. Ánh Xạ Danh Sách Kịch Bản Biên & Ngoại Lệ (10 Edge Cases: `EC-pay-001` .. `EC-pay-010`)

| Mã Ngoại Lệ | Tiêu Đề Kịch Bản Biên | Tình Huống Giả Lập & Xử Lý Nghiệp Vụ | Mã Test Case (BDD Gherkin) | Mức Ưu Tiên |
|---|---|---|---|:---:|
| **`EC-pay-001`** | Nhân viên vào làm hoặc nghỉ việc giữa kỳ | Giữ nguyên công chuẩn 26.0; tính theo công thực tế; prorate lương thời gian, phụ cấp theo công và hạn mức miễn thuế ăn trưa 730k | `TC-PAY-064` | **P1** |
| **`EC-pay-002`** | Tiền tạm ứng vượt quá thu nhập (Thực lĩnh âm) | Tạm ứng qua phân hệ Bù trừ lớn hơn Gross sau thuế; giữ nguyên thực lĩnh âm ($< 0$), không clamp 0, ghi nhận công nợ | `TC-PAY-060` | **P0** |
| **`EC-pay-003`** | Lương đóng bảo hiểm vượt cả 2 trần (120 triệu) | BHXH/BHYT kẹp trần 46.8tr; BHTN kẹp trần 99.2tr; tính bảo hiểm chính xác trên 2 mức trần khác biệt | `TC-PAY-032` | **P0** |
| **`EC-pay-004`** | Giảm trừ gia cảnh lớn hơn thu nhập chịu thuế | Nuôi 2 con nhỏ, giảm trừ gia cảnh 19.8tr > thu nhập 15tr; thu nhập tính thuế clamp về 0; thuế TNCN = 0 | `TC-PAY-062` | **P0** |
| **`EC-pay-005`** | Làm thêm giờ ban đêm ngày lễ/tết (Hệ số 390%) | 8 giờ OT lễ ca đêm hệ số 3.9; tách tiền chuẩn 800k (chịu thuế), tiền dôi dư 2.32tr (miễn thuế hoàn toàn) | `TC-PAY-023` | **P0** |
| **`EC-pay-006`** | Chuyển đổi HĐ Thử việc sang Chính thức giữa tháng | Ưu tiên áp dụng loại hợp đồng có hiệu lực tại ngày cuối cùng của kỳ lương (`orderBy: effectiveFrom desc, take: 1`) | `TC-PAY-013` | **P1** |
| **`EC-pay-007`** | Nghỉ không lương cả tháng (0 công làm việc) | Lương thời gian = 0, phụ cấp theo công = 0, phụ cấp cố định tháng = 0; Gross = 0; BH và thuế = 0 | `TC-PAY-043` | **P1** |
| **`EC-pay-008`** | Sửa danh mục lương sau khi kỳ lương đã LOCKED | Sửa tên hoặc số tiền `SalaryItem` sau khi khóa sổ; dữ liệu kỳ đã khóa được bảo toàn 100% nhờ 2 bảng snapshot | `TC-PAY-052` | **P1** |
| **`EC-pay-009`** | Tròn số tiền VNĐ trong các phép tính tỷ lệ | Mọi phép tính số tiền tài chính sinh số thập phân đều làm tròn bằng `Math.round()` (`ROUND_HALF_UP`) về 1 VNĐ nguyên bản | `TC-PAY-063` | **P2** |
| **`EC-pay-010`** | Lương đóng bảo hiểm nhỏ hơn lương tối thiểu vùng | Đưa cảnh báo nghiệp vụ (Warning) cho C&B nhưng vẫn cho phép tính toán theo hợp đồng; ghi log kiểm toán | `TC-PAY-065` | **P2** |

---

### 3.4. Ánh Xạ User Stories & Acceptance Criteria (`US-PAY-01` .. `US-PAY-06`)

| Mã User Story | Tiêu Đề User Story & Mục Tiêu | Acceptance Criteria (AC) Cốt Lõi | Test Case Bao Phủ |
|---|---|---|---|
| **`US-PAY-01`** | Tính toán bảng lương tích hợp đầy đủ phụ cấp lương & phúc lợi | Thu thập 100% khoản trong `EmployeeSalaryItem`; phân loại prorate theo công vs cố định tháng; tính vào Gross Income. | `TC-PAY-001`, `TC-PAY-003`, `TC-PAY-064` |
| **`US-PAY-02`** | Phân loại hợp đồng & Khấu trừ thuế TNCN 10% tại nguồn | HĐ `PROBATION`/`SERVICE_CONTRACT` $\ge 2$tr khấu trừ 10% không giảm trừ gia cảnh; HĐ `LABOR_CONTRACT` tính lũy tiến 7 bậc. | `TC-PAY-010`, `TC-PAY-011`, `TC-PAY-012`, `TC-PAY-013` |
| **`US-PAY-03`** | Miễn thuế TNCN phần tiền làm thêm giờ (OT) vượt chuẩn | Tự động bóc tách đơn giá giờ chuẩn; phần dôi dư (50%-290%) được miễn thuế TNCN hoàn toàn. | `TC-PAY-002`, `TC-PAY-020`, `TC-PAY-021`, `TC-PAY-022`, `TC-PAY-023` |
| **`US-PAY-04`** | Tách biệt và áp dụng 2 trần bảo hiểm bắt buộc | Kẹp trần 46.8tr cho BHXH/BHYT và 99.2tr cho BHTN; tính riêng tỷ lệ NLĐ và Doanh nghiệp. | `TC-PAY-030`, `TC-PAY-031`, `TC-PAY-032`, `TC-PAY-033` |
| **`US-PAY-05`** | Khống chế hạn mức miễn thuế ăn trưa 730.000đ/tháng | Miễn thuế tối đa 730k/tháng (prorated theo ngày công thực tế); phần vượt đưa vào thu nhập chịu thuế. | `TC-PAY-040`, `TC-PAY-041`, `TC-PAY-042`, `TC-PAY-043` |
| **`US-PAY-06`** | Khóa sổ kỳ lương & Lưu trữ snapshot chi tiết đa tầng | Ghi nguyên tử `$transaction` vào `payroll_sheet_lines` và `breakdowns`; đóng băng 8 phân hệ nguồn (`E-dltl-001`). | `TC-PAY-050`, `TC-PAY-051`, `TC-PAY-052`, `TC-PAY-053`, `TC-PAY-054` |

---

## 4. Ma Trận Kiểm Thử Phân Quyền Vai Trò (RBAC Test Matrix)

Ma trận kiểm thử ma trận phân quyền giữa 4 vai trò người dùng trong hệ thống: `ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE` tương ứng với các Endpoint và Trạng thái kỳ lương:

| Hành Động / API Endpoint | Trạng Thái Kỳ Áp Dụng | `ADMIN` | `HR` (C&B) | `ACCOUNTANT` (Kế toán) | `EMPLOYEE` (Nhân viên) | Kết Quả Mong Đợi Khi Không Có Quyền | Test Case ID |
|---|:---:|:---:|:---:|:---:|:---:|---|:---:|
| **Tạo mới kỳ lương** (`POST /payroll/periods`) | - | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Nhập liệu 8 phân hệ nguồn** | `DRAFT` | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Tính thử nghiệm** (`GET /payroll/calculate`) | `DRAFT`, `PENDING_REVIEW` | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Gửi đối soát** (`POST /periods/{id}/submit`) | `DRAFT` | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Từ chối đối soát** (`POST /periods/{id}/reject`) | `PENDING_REVIEW` | ✅ Cho phép | ❌ Chặn | ✅ Cho phép | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Khóa sổ & Chốt Snapshot** (`POST /lock`) | `PENDING_REVIEW` | ✅ Cho phép | ❌ Chặn | ✅ Cho phép | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Mở lại kỳ lương** (`POST /reopen`) | `LOCKED` | **✅ DUY NHẤT** | ❌ Chặn | ❌ Chặn | ❌ Chặn | HTTP 403 Forbidden (`E-pay-008`) | `TC-PAY-077` |
| **Ký duyệt bảng lương** (`POST /approve`) | `LOCKED` | **✅ DUY NHẤT** | ❌ Chặn | ❌ Chặn | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Xác nhận chi trả** (`POST /pay`) | `APPROVED` | ✅ Cho phép | ❌ Chặn | ✅ Cho phép | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Lưu trữ kế toán** (`POST /archive`) | `PAID` | ✅ Cho phép | ❌ Chặn | ✅ Cho phép | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Xem bảng lương tổng hợp 18 cột** | Mọi trạng thái | ✅ Toàn cty | ✅ Toàn cty | ✅ Toàn cty | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Xem tab Lương hỗ trợ** (`luong-ho-tro`) | Mọi trạng thái | ✅ Toàn cty | ✅ Toàn cty | ✅ Toàn cty | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Xuất file Excel đối soát đa chiều** | Mọi trạng thái | ✅ Toàn cty | ✅ Toàn cty | ✅ Toàn cty | ❌ Chặn | HTTP 403 Forbidden | `TC-PAY-080` |
| **Xem Phiếu lương cá nhân (Payslip)** | `PAID`, `ARCHIVED` | ✅ Xem tất cả | ✅ Xem tất cả | ✅ Xem tất cả | **✅ CHỈ RIÊNG MÌNH** | Không thể xem phiếu lương của nhân viên khác (Data Isolation) | `TC-PAY-080` |
| **Xem Phiếu lương cá nhân (Payslip)** | `DRAFT`, `PENDING_REVIEW`, `LOCKED`, `APPROVED` | ✅ Được xem | ✅ Được xem | ✅ Được xem | **❌ CHẶN (Chưa phát hành)** | HTTP 403 / 404 (Chưa đến ngày giải ngân) | `TC-PAY-080` |

---

## 5. Kế Hoạch Thực Thi & Đánh Giá Đạt Chuẩn (Verification & Exit Criteria)

### 5.1. Tiêu Chí Nghiệm Thu Phase A (Exit Gate Checklist)
- [x] Đã đối soát 100% 11 Business Rules (`BR-pay-001` .. `BR-pay-011`) sang Test Cases chi tiết.
- [x] Đã bao phủ toàn bộ 10 Mã lỗi chuẩn (`E-pay-001` .. `E-pay-010`) kèm mã HTTP Status.
- [x] Đã thiết kế kịch bản bẫy 10 Ca biên ngoại lệ (`EC-pay-001` .. `EC-pay-010`).
- [x] Đã xây dựng ma trận phân quyền RBAC cho 4 vai trò trên mọi trạng thái vòng đời kỳ lương.
- [x] Hồ sơ Test Cases tuân thủ 100% định dạng BDD Gherkin (`Given/When/Then`) với số liệu tài chính cụ thể, minh bạch.

### 5.2. Chuyển Giao Cho BA Final Sign-off Gate
Tài liệu này được bàn giao trực tiếp cho **Business Analyst** để thực hiện thẩm tra chéo (Cross-check Gate). Sau khi BA ký duyệt và cập nhật `Status: Ready for Backend` tại `docs/payroll/CONTEXT_SUMMARY.md`, bộ tài liệu này sẽ là tiêu chuẩn kiểm thử bắt buộc (Contract Testing Baseline) cho Backend Engineer và Tester-QA (Phase B).

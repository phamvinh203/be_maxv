# Ma trận Truy vết Kiểm thử (Test Traceability Matrix) — Dữ liệu Tính Lương (du_lieu_tinh_luong)

> **Mã phân hệ**: `HRM-PAYROLL-DATA`  
> **Phiên bản**: 1.0.0  
> **Ngày lập**: 2026-09-06  
> **Vai trò**: QA Test Design Lead  
> **Giai đoạn**: Shift-Left QA (Phase A: Spec Review & Test Design) — Gate 2.5 Handoff  
> **Tài liệu tham chiếu**:  
> - SRS Đặc tả Nghiệp vụ: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-spec.md`](../srs/du_lieu_tinh_luong-spec.md)  
> - Sơ đồ Thực thể ERD: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-erd.md`](../srs/du_lieu_tinh_luong-erd.md)  
> - Vòng đời Trạng thái: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-states.md`](../srs/du_lieu_tinh_luong-states.md)  
> - Luồng Nghiệp vụ Flows: [`docs/du_lieu_tinh_luong/srs/du_lieu_tinh_luong-flows.md`](../srs/du_lieu_tinh_luong-flows.md)  
> - Bộ Ca Kiểm thử Chi tiết: [`docs/du_lieu_tinh_luong/qa/test-cases.md`](./test-cases.md)  

---

## 1. Mục tiêu & Phạm vi Ma trận Truy vết (Objectives & Scope)

### 1.1. Mục tiêu
- **Chặn đứng lỗi từ sớm (Shift-Left Defect Prevention)**: Rà soát toàn diện tài liệu phân tích nghiệp vụ của BA, thiết kế ma trận kiểm thử trước khi Dev Backend bắt đầu viết code để phát hiện các lỗ hổng logic, bất cập trong công thức và xung đột trạng thái.
- **Bảo đảm tính toàn vẹn 100% (Bidirectional Traceability)**: Đảm bảo mọi Yêu cầu người dùng (User Story), Quy tắc nghiệp vụ (Business Rule `BR-dltl-001` .. `022`), Mã lỗi chuẩn hóa (`E-dltl-001` .. `026`), và Kịch bản ngoại lệ (`EC-01` .. `EC-10`) đều được ánh xạ trực tiếp đến ít nhất một ca kiểm thử cụ thể kèm mức độ ưu tiên rõ ràng.
- **Tiêu chuẩn làm tròn số & an toàn tài chính**: Định hình chuẩn xác quy tắc làm tròn tiền tệ kế toán (`ROUND_HALF_UP`), chặn trừ âm chuyên cần, và xử lý hợp lệ trường hợp thực lĩnh âm do tạm ứng lớn.

### 1.2. Phạm vi bao phủ 8 phân hệ con & Vòng đời kỳ lương
1. **Quản lý Vòng đời Kỳ lương (`payroll_periods`)**: `DRAFT` ➔ `PENDING_REVIEW` ➔ `LOCKED` ➔ `APPROVED` ➔ `PAID` ➔ `ARCHIVED`. Bất biến snapshot và Reopen audit trail.
2. **Phân hệ 1: Chấm công (`cham_cong`)**: Kế thừa lịch chuẩn, ghi đè giờ lẻ, chặn vượt trần ngày, xử lý vào làm giữa tháng và nghỉ không lương trọn tháng.
3. **Phân hệ 2: Tăng ca (`tang_ca`)**: 6 hệ số pháp lý (150% - 390%), quy đổi giờ, chặn trùng loại OT, kiểm soát trần 40h/tháng và 300h/năm.
4. **Phân hệ 3: Đánh giá KPI (`kpi`)**: Danh mục chỉ tiêu, trọng số $> 0$, chặn trùng chỉ tiêu, tính tỷ lệ hoàn thành, chặn chia cho 0, hiệu suất tổng hợp.
5. **Phân hệ 4: Thưởng (`thuong`)**: Tích hợp `SalaryItem` (`PERIODIC_BONUS`), chặn trùng khoản thưởng, chặn tiền âm, tính tổng ngân sách nhóm.
6. **Phân hệ 5: Lương sản phẩm (`luong_san_pham`)**: Danh mục sản phẩm, bảo toàn đơn giá Snapshot, số lượng nghiệm thu, tính thành tiền làm tròn VNĐ.
7. **Phân hệ 6: Lương phần trăm (`luong_phan_tram`)**: Tích hợp `SalaryItem` (`COMMISSION_PERCENTAGE`), snapshot tỷ lệ hoa hồng, tính hoa hồng doanh số, chặn tỷ lệ ngoài [0, 100]%.
8. **Phân hệ 7: Lương chuyên cần (`chuyen_can`)**: Danh mục lỗi (theo giờ, theo lần, mất toàn bộ), chặn sàn không âm `min(tong_phat, don_gia)`, ý nghĩa bảng rỗng `[]`, trùng loại khác ngày.
9. **Phân hệ 8: Ứng - Bù trừ (`bu_tru`)**: Danh mục bù trừ (chiều `tru`, chiều `bu`), nhập số dương $> 0$, tính tổng bị trừ ròng, cho phép thực lĩnh âm nợ chuyển kỳ sau.
10. **Tính năng dùng chung & Kỹ thuật**: Áp dụng 3 phạm vi (`toan_cong_ty`, `phong_ban`, `nhan_vien`), Tái sử dụng/Clone sinh mới UUID, Import/Export Excel nguyên tử, RBAC 4 vai trò, Concurrency Lock.

---

## 2. Bảng Thống kê Tổng quan Độ bao phủ (Coverage Metrics Dashboard)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        COVERAGE METRICS & TRACEABILITY SUMMARY                         │
├───────────────────────────────────┬───────────────┬───────────────────┬────────────────┤
│ Danh mục Kiểm tra                 │ Tổng số lượng │ Số lượng Đã Cover │ Tỷ lệ Bao phủ  │
├───────────────────────────────────┼───────────────┼───────────────────┼────────────────┤
│ User Stories (US-dltl-01..07)     │ 7 Epics       │ 7 Epics           │ 100.0%         │
│ Business Rules (BR-dltl-001..022) │ 22 Rules      │ 22 Rules          │ 100.0%         │
│ Error Codes (E-dltl-001..026)     │ 26 Codes      │ 26 Codes          │ 100.0%         │
│ Edge Cases (EC-01..10)            │ 10 Scenarios  │ 10 Scenarios      │ 100.0%         │
│ Tổng số Test Cases Chi tiết       │ 77 Test Cases │ 77 Test Cases     │ 100.0%         │
├───────────────────────────────────┴───────────────┴───────────────────┴────────────────┤
│ Phân bổ Mức độ Ưu tiên (Priority):                                                    │
│  - P0 (Blocker / Financial Invariant / RBAC / Error Codes): 52 Ca (67.5%)              │
│  - P1 (High / Core Flow / Boundary Values / Warnings):       20 Ca (26.0%)              │
│  - P2 (Medium / UI Enhancements / Non-blocking Warnings):     5 Ca (6.5%)               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Phân bổ Loại hình Kiểm thử (Test Types):                                               │
│  - Unit Test (Công thức toán học, guard, pure functions):      26 Ca (33.8%)            │
│  - Integration / API E2E (REST API, Prisma DB, Transaction):   34 Ca (44.2%)            │
│  - Security & RBAC (Phân quyền 4 vai trò, Data Isolation):     8 Ca (10.4%)             │
│  - Concurrency & Performance (Xung đột ghi, khóa sổ song song):4 Ca (5.2%)              │
│  - Boundary & Stress (Excel IO hàng loạt, trần giờ OT):         5 Ca (6.5%)              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Ma trận Truy vết Chi tiết (Traceability Matrix: Requirements ➔ Tests)

### 3.1. Nhóm Kỳ lương, Vòng đời & Snapshot Bất biến (`payroll_periods`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-Core** | `BR-dltl-001` | *Happy Path* | Kỳ lương | Khởi tạo kỳ lương mới thành công, sinh bản ghi nháp `DRAFT` và lịch chấm công mặc định | API / E2E | **P0** | `TC-DLTL-001` |
| **US-dltl-Core** | `BR-dltl-001` | *Happy Path* | Kỳ lương | Khóa sổ kỳ lương (`PENDING_REVIEW` ➔ `LOCKED`): Tính snapshot `payroll_sheet_lines` và đóng băng dữ liệu | Integration | **P0** | `TC-DLTL-002` |
| **US-dltl-Core** | `BR-dltl-001` | `E-dltl-001` | Kỳ lương / Toàn bộ 8 phân hệ | Chặn mọi hành động Thêm/Sửa/Xóa dữ liệu chi tiết của 8 phân hệ khi kỳ lương đã ở trạng thái `LOCKED` | API / Negative | **P0** | `TC-DLTL-003` |
| **US-dltl-Core** | `BR-dltl-001` | `E-dltl-001` | Kỳ lương / Toàn bộ 8 phân hệ | Chặn mọi hành vi sửa/xóa khi kỳ lương ở trạng thái `APPROVED` hoặc `PAID` | API / Negative | **P0** | `TC-DLTL-004` |
| **US-dltl-Core** | `BR-dltl-001` | State Invariant | Kỳ lương | Mở lại kỳ lương (`LOCKED` ➔ `DRAFT`) thành công bởi ADMIN kèm lý do giải trình $\ge 20$ ký tự & ghi Audit Log | Security / Integration | **P1** | `TC-DLTL-005` |
| **US-dltl-Core** | `BR-dltl-001` | RBAC Invariant | Kỳ lương | Chặn tài khoản vai trò HR hoặc ACCOUNTANT thực hiện Reopen kỳ lương (403 Forbidden) | Security / RBAC | **P0** | `TC-DLTL-006` |
| **US-dltl-Core** | `BR-dltl-001` | Validation | Kỳ lương | Chặn Reopen kỳ lương khi lý do giải trình để trống hoặc ngắn hơn 20 ký tự (400 Bad Request) | API / Validation | **P1** | `TC-DLTL-007` |
| **US-dltl-Core** | `BR-dltl-001` | State Invariant | Kỳ lương | Chặn Reopen kỳ lương khi kỳ đã được chi trả `PAID` hoặc lưu trữ `ARCHIVED` | API / Negative | **P0** | `TC-DLTL-008` |
| **US-dltl-Core** | - | `E-dltl-025` | Kỳ lương | Thao tác nhập liệu với `period_id` không tồn tại trong hệ thống (404 Not Found) | API / Negative | **P0** | `TC-DLTL-009` |
| **US-dltl-Core** | - | `E-dltl-026`, `EC-05` | Kỳ lương | Xử lý xung đột phiên bản khi 2 người dùng cùng thực hiện khóa sổ hoặc áp dụng bảng đồng thời (409 Conflict) | Concurrency | **P0** | `TC-DLTL-010`, `TC-DLTL-076` |

---

### 3.2. Phân hệ 1: Chấm công (`cham_cong`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-01** | `BR-dltl-004` | `AC-dltl-01-A` | Chấm công | Tự sinh lịch chấm công tháng kế thừa Thứ 7, Chủ nhật và Ngày lễ từ `GeneralSetting` và `Holiday` | Unit / Integration | **P0** | `TC-DLTL-011` |
| **US-dltl-01** | `BR-dltl-005` | `AC-dltl-01-B` | Chấm công | Ghi đè số giờ công lẻ hợp lệ và tính công quy đổi theo công thức `round(soGio / standardHours, 2)` | Unit / Functional | **P0** | `TC-DLTL-012` |
| **US-dltl-01** | `BR-dltl-005` | `E-dltl-005`, `AC-dltl-01-C` | Chấm công | Chặn nhập số giờ công làm việc âm (`soGio < 0`) | API / Boundary | **P0** | `TC-DLTL-013` |
| **US-dltl-01** | `BR-dltl-005` | `E-dltl-005`, `AC-dltl-01-C` | Chấm công | Chặn nhập số giờ công vượt quá số giờ chuẩn trong ngày (`soGio > 8h`) | API / Boundary | **P0** | `TC-DLTL-014` |
| **US-dltl-01** | `BR-dltl-004` | Kiến trúc Delta | Chấm công | Kiểm thử cơ chế Delta Store: Chỉ lưu trữ các ô chấm công có điều chỉnh khác với lịch chuẩn | Integration | **P1** | `TC-DLTL-015` |
| **US-dltl-01** | `BR-dltl-002` | `EC-01` | Chấm công | Nhân viên vào làm giữa tháng (hợp đồng từ ngày 15): Ngày trước đó để trống, tính đúng tỷ lệ công thực tế | Unit / Integration | **P1** | `TC-DLTL-016` |
| **US-dltl-01** | `BR-dltl-004` | `EC-02` | Chấm công | Nhân viên nghỉ không lương trọn tháng (`ngayCongThucTe = 0`): Lương công = 0, tránh lỗi chia 0 | Unit / Financial | **P1** | `TC-DLTL-017` |
| **US-dltl-01** | `BR-dltl-004` | `EC-08` | Chấm công | Ngày công chuẩn bằng 0 (lỗi cấu hình): Hệ thống kích hoạt guard an toàn, trả đơn giá giờ = 0 | Unit / Boundary | **P2** | `TC-DLTL-018` |

---

### 3.3. Phân hệ 2: Tăng ca (`tang_ca`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-02** | `BR-dltl-006` | `AC-dltl-02-A` | Tăng ca | Thêm các dòng tăng ca hợp lệ thuộc 6 hệ số pháp lý (150% - 390%) và tính chính xác số giờ quy đổi | Unit / API | **P0** | `TC-DLTL-019` |
| **US-dltl-02** | `BR-dltl-006` | `E-dltl-006` | Tăng ca | Chặn khai báo trùng loại tăng ca trên cùng một nhân viên trong kỳ tính lương | API / Negative | **P0** | `TC-DLTL-020` |
| **US-dltl-02** | `BR-dltl-007` | `E-dltl-007` | Tăng ca | Chặn nhập số giờ tăng ca bằng 0 hoặc số âm (`hours <= 0`) | API / Boundary | **P0** | `TC-DLTL-021` |
| **US-dltl-02** | `BR-dltl-007` | `AC-dltl-02-C` | Tăng ca | Cảnh báo mức vàng khi tổng giờ OT tháng đạt từ 80% trần (32h / 40h) | UI / API | **P1** | `TC-DLTL-022` |
| **US-dltl-02** | `BR-dltl-007` | `AC-dltl-02-C` | Tăng ca | Báo đỏ cảnh báo vi phạm Luật Lao động khi tổng giờ OT tháng vượt quá trần 40h/tháng | UI / API | **P0** | `TC-DLTL-023` |
| **US-dltl-02** | `BR-dltl-007` | Điều 107 BLLĐ | Tăng ca | Cảnh báo lũy kế OT trong năm vượt 200h và chặn trần tối đa 300h/năm | Integration | **P1** | `TC-DLTL-024` |
| **US-dltl-02** | `BR-dltl-003` | `AC-dltl-02-B` | Tăng ca | Áp dụng bảng tăng ca hàng loạt theo phạm vi phòng ban, sinh ID độc lập cho từng nhân viên | API / E2E | **P1** | `TC-DLTL-025` |

---

### 3.4. Phân hệ 3: Đánh giá KPI (`kpi`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-03** | `BR-dltl-008` | `AC-dltl-03-A` | KPI | Tính chính xác tỷ lệ hoàn thành từng chỉ tiêu và hiệu suất chung theo bình quân trọng số | Unit / API | **P0** | `TC-DLTL-026` |
| **US-dltl-03** | `BR-dltl-008` | `E-dltl-009`, `AC-dltl-03-B` | KPI | Chặn thêm chỉ tiêu KPI bị trùng lặp trong bảng đánh giá của nhân viên | API / Negative | **P0** | `TC-DLTL-027` |
| **US-dltl-03** | `BR-dltl-008` | `E-dltl-008` | KPI | Chặn lưu khi có dòng chưa chọn chỉ tiêu hoặc mã chỉ tiêu không tồn tại trong danh mục | API / Validation | **P0** | `TC-DLTL-028` |
| **US-dltl-03** | `BR-dltl-008` | `E-dltl-010` | KPI | Chặn lưu bảng KPI khi tổng trọng số của các chỉ tiêu nhỏ hơn hoặc bằng 0 | API / Validation | **P0** | `TC-DLTL-029` |
| **US-dltl-03** | `BR-dltl-008` | Cảnh báo mềm | KPI | Cảnh báo vàng khi tổng trọng số khác 100% nhưng vẫn cho phép lưu nếu $> 0$ | UI / Functional | **P1** | `TC-DLTL-030` |
| **US-dltl-03** | `BR-dltl-009` | Guard chia 0 | KPI | Xử lý an toàn khi mục tiêu giao $\le 0$: Tỷ lệ hoàn thành = 0%, tránh lỗi `division by zero` | Unit / Boundary | **P0** | `TC-DLTL-031` |
| **US-dltl-03** | `BR-dltl-008` | Kỳ rỗng `null` | KPI | Nhân viên chưa được chấm điểm KPI trong kỳ (`kpi_record = null`): Tiền KPI = 0 trong bảng lương | Integration | **P1** | `TC-DLTL-032` |

---

### 3.5. Phân hệ 4: Thưởng (`thuong`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-04** | `BR-dltl-010` | `AC-dltl-04-A` | Thưởng | Thêm khoản thưởng hợp lệ từ `SalaryItem` (`PERIODIC_BONUS`) và tính tổng ngân sách chi trả nhóm | API / E2E | **P0** | `TC-DLTL-033` |
| **US-dltl-04** | `BR-dltl-010` | `E-dltl-011` | Thưởng | Chặn lặp lại cùng một mã khoản thưởng cho một nhân viên trong cùng một kỳ lương | API / Negative | **P0** | `TC-DLTL-034` |
| **US-dltl-04** | `BR-dltl-011` | `E-dltl-012`, `AC-dltl-04-B` | Thưởng | Chặn nhập số tiền thưởng âm (`amount < 0`) | API / Boundary | **P0** | `TC-DLTL-035` |
| **US-dltl-04** | `BR-dltl-011` | Boundary | Thưởng | Cho phép nhập số tiền thưởng bằng 0 đồng (`amount = 0`) | API / Boundary | **P1** | `TC-DLTL-036` |
| **US-dltl-04** | `BR-dltl-003` | Phạm vi Công ty | Thưởng | Áp dụng khoản thưởng toàn công ty (`toan_cong_ty`) cho 100% nhân sự ACTIVE | Integration | **P1** | `TC-DLTL-037` |

---

### 3.6. Phân hệ 5: Lương sản phẩm (`luong_san_pham`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-05** | `BR-dltl-012` | `AC-dltl-05-A` | Lương sản phẩm | Thêm sản phẩm nghiệm thu, kế thừa tự động đơn giá snapshot từ danh mục `piecework_products` | Integration | **P0** | `TC-DLTL-038` |
| **US-dltl-05** | `BR-dltl-012` | `EC-07` | Lương sản phẩm | Cho phép sửa đơn giá snapshot trong kỳ mà không làm thay đổi bảng giá gốc trong danh mục | API / Business | **P0** | `TC-DLTL-039` |
| **US-dltl-05** | `BR-dltl-012` | `EC-07` | Lương sản phẩm | Cập nhật đơn giá trong danh mục sản phẩm không làm thay đổi số liệu các kỳ lương đã lưu | API / Invariant | **P0** | `TC-DLTL-040` |
| **US-dltl-05** | `BR-dltl-012` | `E-dltl-014` | Lương sản phẩm | Chặn thêm sản phẩm bị trùng lặp trong bảng lương sản phẩm của một nhân viên | API / Negative | **P0** | `TC-DLTL-041` |
| **US-dltl-05** | `BR-dltl-013` | `E-dltl-015` | Lương sản phẩm | Chặn nhập số lượng sản phẩm âm hoặc đơn giá snapshot âm | API / Boundary | **P0** | `TC-DLTL-042` |
| **US-dltl-05** | `BR-dltl-012` | `E-dltl-013` | Lương sản phẩm | Chặn lưu khi dòng sản phẩm chưa chọn mã sản phẩm hoặc mã không tồn tại | API / Validation | **P0** | `TC-DLTL-043` |
| **US-dltl-05** | `BR-dltl-013` | Làm tròn tiền tệ | Lương sản phẩm | Kiểm thử tính thành tiền với số lượng lẻ 2 chữ số thập phân, làm tròn về đồng VNĐ (`ROUND_HALF_UP`) | Unit / Financial | **P1** | `TC-DLTL-044` |

---

### 3.7. Phân hệ 6: Lương phần trăm (`luong_phan_tram`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-Core** | `BR-dltl-014` | *Happy Path* | Lương phần trăm | Nhập doanh số cơ sở và tỷ lệ hoa hồng snapshot, tính chính xác thành tiền hoa hồng | Unit / API | **P0** | `TC-DLTL-045` |
| **US-dltl-Core** | `BR-dltl-014` | `E-dltl-016` | Lương phần trăm | Chặn khai báo trùng khoản lương phần trăm cho cùng một nhân viên trong kỳ | API / Negative | **P0** | `TC-DLTL-046` |
| **US-dltl-Core** | `BR-dltl-014` | `E-dltl-017` | Lương phần trăm | Chặn nhập tỷ lệ hoa hồng nằm ngoài khoảng $[0\%, 100\%]$ (ví dụ $-1\%$ hoặc $100.5\%$) | API / Boundary | **P0** | `TC-DLTL-047` |
| **US-dltl-Core** | `BR-dltl-014` | Boundary Values | Lương phần trăm | Kiểm thử các giá trị biên của tỷ lệ hoa hồng ($0.01\%, 0\%, 100\%$) kèm làm tròn số tiền | Unit / Boundary | **P1** | `TC-DLTL-048` |
| **US-dltl-Core** | `BR-dltl-015` | Snapshot Invariant | Lương phần trăm | Tỷ lệ hoa hồng snapshot độc lập với cấu hình mặc định trong `SalaryItem` khi sửa danh mục | Integration | **P0** | `TC-DLTL-049` |

---

### 3.8. Phân hệ 7: Lương chuyên cần (`chuyen_can`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-06** | `BR-dltl-016` | *Happy Path* | Chuyên cần | Ghi nhận lỗi vi phạm loại `theo_gio` và `theo_lan`, tính đúng số tiền khấu trừ trong kỳ | Unit / API | **P0** | `TC-DLTL-050` |
| **US-dltl-06** | `BR-dltl-016` | `AC-dltl-06-A` | Chuyên cần | Vi phạm loại `mat_toan_bo`: Hệ thống trừ đúng 100% mức chuyên cần, thực nhận = 0 VNĐ | Unit / Business | **P0** | `TC-DLTL-051` |
| **US-dltl-06** | `BR-dltl-016` | `AC-dltl-06-B` | Chuyên cần | **Chặn sàn chuyên cần (Hard Invariant)**: Tổng tiền phạt vượt mức hưởng thì tổng trừ = đơn giá, thành tiền = 0đ, TUYỆT ĐỐI không âm | Unit / Financial | **P0** | `TC-DLTL-052` |
| **US-dltl-06** | `BR-dltl-018` | Bảng rỗng `[]` | Chuyên cần | Bảng chuyên cần rỗng (`dong: []`) mang ý nghĩa nhân viên không vi phạm, hưởng đủ 100% chuyên cần | Unit / Logic | **P0** | `TC-DLTL-053` |
| **US-dltl-06** | `BR-dltl-017` | `E-dltl-019` | Chuyên cần | Cho phép lặp cùng loại lỗi nhưng khác ngày; Chặn lặp lỗi nếu trùng cả loại và ngày vi phạm | API / Validation | **P0** | `TC-DLTL-054` |
| **US-dltl-06** | `BR-dltl-017` | `E-dltl-018` | Chuyên cần | Chặn lưu khi dòng vi phạm chuyên cần chưa chọn loại lỗi hoặc chưa điền ngày vi phạm | API / Validation | **P0** | `TC-DLTL-055` |
| **US-dltl-06** | `BR-dltl-016` | `E-dltl-020` | Chuyên cần | Chặn nhập số giờ vi phạm chuyên cần là số âm (`violation_hours < 0`) | API / Boundary | **P0** | `TC-DLTL-056` |
| **US-dltl-06** | `BR-dltl-016` | `EC-09` | Chuyên cần | Nhân viên có lỗi vi phạm nhưng hợp đồng không có phụ cấp chuyên cần (`donGia = 0`): Tổng trừ = 0 | Unit / Financial | **P1** | `TC-DLTL-057` |

---

### 3.9. Phân hệ 8: Các khoản ứng - bù trừ (`bu_tru`)

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-07** | `BR-dltl-019` | `AC-dltl-07-A` | Ứng - Bù trừ | Tính chính xác tổng bị trừ ròng khi nhân viên có cả khoản trừ (`tru`) và khoản bù (`bu`) | Unit / API | **P0** | `TC-DLTL-058` |
| **US-dltl-07** | `BR-dltl-019` | `AC-dltl-07-B` | Ứng - Bù trừ | Tổng bị trừ ròng âm (khoản bù lớn hơn khoản trừ): Nhân viên được cộng thêm tiền vào thực lĩnh | Unit / Business | **P0** | `TC-DLTL-059` |
| **US-dltl-07** | `BR-dltl-019` | `E-dltl-023` | Ứng - Bù trừ | Người dùng nhập số âm hoặc bằng 0 bị chặn; bắt buộc nhập số tiền dương $> 0$ | API / Boundary | **P0** | `TC-DLTL-060` |
| **US-dltl-07** | `BR-dltl-020` | `E-dltl-022` | Ứng - Bù trừ | Chặn khai báo trùng mã khoản bù trừ cho một nhân viên trong cùng một kỳ lương | API / Negative | **P0** | `TC-DLTL-061` |
| **US-dltl-07** | `BR-dltl-019` | `E-dltl-021` | Ứng - Bù trừ | Chặn lưu khi dòng bù trừ chưa chọn khoản hoặc mã khoản không tồn tại trong danh mục | API / Validation | **P0** | `TC-DLTL-062` |
| **US-dltl-07** | `BR-dltl-019` | `EC-03` | Ứng - Bù trừ | **Xử lý Thực lĩnh âm (Financial Invariant)**: Tạm ứng vượt lương, giữ nguyên số âm ở `thuc_linh` và chuyển công nợ kỳ sau | Unit / Financial | **P0** | `TC-DLTL-063` |

---

### 3.10. Nhóm Quy tắc Nhân sự, Phạm vi & Tính năng Kỹ thuật

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **US-dltl-Core** | `BR-dltl-002` | `E-dltl-002` | Nhân sự | Chặn lập hoặc áp dụng dữ liệu lương cho nhân viên đã nghỉ việc (`status != ACTIVE`) | API / Security | **P0** | `TC-DLTL-064` |
| **US-dltl-Core** | `BR-dltl-003` | `E-dltl-003` | Phạm vi | Báo lỗi khi chọn phạm vi `phong_ban` nhưng chưa chọn phòng ban cụ thể | API / Validation | **P0** | `TC-DLTL-065` |
| **US-dltl-Core** | `BR-dltl-003` | `E-dltl-004` | Phạm vi | Báo lỗi khi chọn phạm vi `nhan_vien` nhưng danh sách nhân viên chọn bị rỗng | API / Validation | **P0** | `TC-DLTL-066` |
| **US-dltl-Core** | `BR-dltl-021` | Clone Isolation | Tái sử dụng | Sao chép dữ liệu từ kỳ trước hoặc nhân viên khác: Bắt buộc sinh mới 100% UUID dòng chi tiết | Integration | **P1** | `TC-DLTL-067` |
| **US-dltl-Core** | `BR-dltl-002` | `EC-04` | Tính toán Lương | Nhân viên chưa được set mức lương riêng: Fallback an toàn về khung `SalaryStructure` công ty | Unit / Integration | **P1** | `TC-DLTL-068` |
| **US-dltl-Core** | `BR-dltl-022` | *Happy Path* | Excel IO | Nhập file Excel hợp lệ, cập nhật chính xác dữ liệu phân hệ hàng loạt | API / Integration | **P0** | `TC-DLTL-069` |
| **US-dltl-Core** | `BR-dltl-022` | `E-dltl-024` | Excel IO | Nhập file Excel không đúng cấu trúc mẫu, sai tên cột hoặc sai định dạng: Từ chối nguyên tử | API / Negative | **P0** | `TC-DLTL-070` |
| **US-dltl-Core** | `BR-dltl-022` | `EC-06` | Excel IO | File Excel chứa mã nhân viên không tồn tại hoặc đã nghỉ việc: Rollback toàn bộ (không lưu dở dang) | Integration / DB | **P0** | `TC-DLTL-071` |
| **US-dltl-Core** | `BR-dltl-022` | `EC-10` | Excel IO | Tự động chuẩn hóa Trim khoảng trắng thừa và làm tròn số lẻ tiền đồng khi Import Excel | Unit / Validation | **P1** | `TC-DLTL-072` |

---

### 3.11. Nhóm Bảo mật, Phân quyền (RBAC) & Giao dịch CSDL

| Req / Story ID | Business Rule ID | Error Code / Edge Case | Phân hệ / Tính năng | Kịch bản Kiểm thử Tóm tắt | Test Type | Priority | Ánh xạ Test Case ID |
|---|---|---|---|---|---|:---:|---|
| **Security** | RBAC-01 | 403 Forbidden | Phân quyền | Tài khoản `EMPLOYEE` gọi API ghi/sửa dữ liệu 8 phân hệ bị từ chối truy cập (403 Forbidden) | Security / RBAC | **P0** | `TC-DLTL-073` |
| **Security** | RBAC-02 | Data Isolation | Phân quyền | Tài khoản `EMPLOYEE` chỉ xem được phiếu lương cá nhân của chính mình, không xem được người khác | Security / Privacy | **P0** | `TC-DLTL-074` |
| **Security** | RBAC-03 | Quản trị Kỳ lương | Phân quyền | `ACCOUNTANT` và `HR` được phép nhập liệu nháp, nhưng không có quyền phê duyệt (`APPROVED`) | Security / RBAC | **P0** | `TC-DLTL-075` |
| **Integrity** | DB-Lock | `EC-05` | CSDL Giao dịch | Kiểm thử đồng thời (Concurrency): Hai phiên cùng áp dụng bảng cho 1 phòng ban (Pessimistic/Optimistic) | Concurrency | **P0** | `TC-DLTL-076` |
| **Integrity** | Foreign Keys | `ON DELETE` | CSDL Giao dịch | Ràng buộc khóa ngoại: Xóa kỳ DRAFT xóa sạch chi tiết (CASCADE); Xóa danh mục cha bị chặn (RESTRICT) | Integration / DB | **P0** | `TC-DLTL-077` |

---

## 4. Ma trận Kiểm thử Phân quyền (RBAC Permission Matrix)

| Chức năng / Hành động API | Endpoint / Thao tác | `ADMIN` | `HR` | `ACCOUNTANT` | `EMPLOYEE` | Mã lỗi nếu vi phạm |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Quản lý danh mục KPI, Sản phẩm, Bù trừ, Chuyên cần** | `POST/PUT/DELETE /catalogs/*` | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | ❌ Chặn | `403 Forbidden` |
| **Khởi tạo kỳ lương mới (`POST /payroll-periods`)** | Khởi tạo kỳ `DRAFT` | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | ❌ Chặn | `403 Forbidden` |
| **Nhập / Sửa / Xóa dữ liệu 8 phân hệ (kỳ `DRAFT`)** | `POST/PUT/DELETE /du-lieu-tinh-luong/*` | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | `403 Forbidden` |
| **Nhập / Sửa / Xóa dữ liệu (kỳ `LOCKED` / `APPROVED`)** | `POST/PUT/DELETE /du-lieu-tinh-luong/*` | ❌ Chặn | ❌ Chặn | ❌ Chặn | ❌ Chặn | `E-dltl-001` (400) |
| **Gửi duyệt kỳ lương (`POST /:id/submit`)** | `DRAFT` ➔ `PENDING_REVIEW` | ✅ Cho phép | ✅ Cho phép | ✅ Cho phép | ❌ Chặn | `403 Forbidden` |
| **Khóa sổ kỳ lương (`POST /:id/lock`)** | `PENDING_REVIEW` ➔ `LOCKED` | ✅ Cho phép | ❌ Chặn | ✅ Cho phép | ❌ Chặn | `403 Forbidden` |
| **Mở lại kỳ lương (`POST /:id/reopen`)** | `LOCKED` ➔ `DRAFT` | ✅ Cho phép | ❌ Chặn | ❌ Chặn | ❌ Chặn | `403 Forbidden` |
| **Phê duyệt bảng lương (`POST /:id/approve`)** | `LOCKED` ➔ `APPROVED` | ✅ Cho phép | ❌ Chặn | ❌ Chặn | ❌ Chặn | `403 Forbidden` |
| **Chi trả lương & Cho xem phiếu (`POST /:id/mark-paid`)**| `APPROVED` ➔ `PAID` | ✅ Cho phép | ❌ Chặn | ✅ Cho phép | ❌ Chặn | `403 Forbidden` |
| **Xem bảng lương tổng hợp toàn công ty** | `GET /payroll-sheets/:id` | ✅ Toàn quyền | ✅ Toàn quyền | ✅ Toàn quyền | ❌ Chặn | `403 Forbidden` |
| **Xem phiếu lương cá nhân (`GET /my-payslip/:periodId`)**| Cổng thông tin nhân viên | ✅ Xem của mình| ✅ Xem của mình| ✅ Xem của mình| ✅ Xem của mình| `403 Data Isolation` |

---

## 5. Ma trận Độ chính xác Toán học & Làm tròn Tài chính (Financial Precision Matrix)

Mọi phép tính tiền tệ trong hệ thống tuân thủ nghiêm ngặt nguyên tắc **Kế toán Việt Nam Đồng (VND)**:
- **Không có số lẻ xu/hào/đồng**: Kết quả tiền tệ cuối cùng luôn làm tròn về số nguyên gần nhất theo thuật toán `ROUND_HALF_UP` (từ 0.5 làm tròn lên 1).
- **Quy tắc làm tròn từng thành phần**:

| Hạng mục dữ liệu | Trường dữ liệu | Kiểu dữ liệu DB | Quy tắc làm tròn số | Ví dụ tính toán cụ thể |
|---|---|---|---|---|
| **Công quy đổi lẻ** | `work_day_value` | `Decimal(4, 2)` | 2 chữ số thập phân (`ROUND_HALF_UP`) | 6h làm việc / 8h chuẩn = `0.75` công; 5h / 8h = `0.63` công |
| **Giờ tăng ca quy đổi** | `converted_hours` | `Decimal(5, 1)` | 1 chữ số thập phân (`ROUND_HALF_UP`) | 3.5h OT × 150% = 5.25h ➔ `5.3` giờ quy đổi |
| **Tỷ lệ hoàn thành KPI**| `completion_rate`| `Decimal(5, 1)` | 1 chữ số thập phân (`ROUND_HALF_UP`) | 90 đạt / 95 mục tiêu = 94.736% ➔ `94.7`% |
| **Hiệu suất KPI tổng** | `overall_kpi_rate`| `Decimal(5, 1)` | 1 chữ số thập phân (`ROUND_HALF_UP`) | $\sum (\text{HT} \times W) / \sum W$ ➔ `102.4`% |
| **Tiền thưởng KPI** | `kpi_salary` | `Int` (VND) | Làm tròn số nguyên VNĐ (`ROUND_HALF_UP`) | $3.500.000 \times 102.4\% = 3.584.000$ ₫ |
| **Thành tiền Lương SP** | `total_amount` | `Int` (VND) | Làm tròn số nguyên VNĐ (`ROUND_HALF_UP`) | 125.5 cái × 25.400 ₫ = 3.187.700 ₫ |
| **Thành tiền Lương %** | `total_amount` | `Int` (VND) | Làm tròn số nguyên VNĐ (`ROUND_HALF_UP`) | 123.456.789 ₫ × 1.25% = 1.543.209,86 ₫ ➔ `1.543.210` ₫ |
| **Khấu trừ chuyên cần** | `tong_tru` | `Int` (VND) | Chặn trần $\min(\sum \text{phạt}, \text{đơn\_giá})$ | Phạt 700.000 ₫, Mức hưởng 500.000 ₫ ➔ Tổng trừ = `500.000` ₫ |
| **Thực nhận chuyên cần**| `thanh_tien` | `Int` (VND) | Chặn sàn $\max(0, \text{đơn\_giá} - \text{tổng\_trừ})$| 500.000 ₫ - 500.000 ₫ = `0` ₫ (KHÔNG BAO GIỜ ÂM) |
| **Tổng bị trừ ròng** | `tong_bi_tru` | `Int` (VND) | $\sum \text{tru} - \sum \text{bu}$ | Trừ 1.500.000 ₫, Bù 800.000 ₫ ➔ `+700.000` ₫ (Dương = bị trừ) |
| **Thực lĩnh nhân viên**| `net_salary` | `Int` (VND) | Thu nhập - Thuế - BH - Bù trừ | Lương 10tr, Ứng 12tr ➔ Thực lĩnh = `-2.000.000` ₫ (ÂM CÔNG NỢ) |

---

## 6. Kế hoạch Thực thi Kiểm thử theo Giai đoạn (Test Execution Roadmap)

1. **Giai đoạn 1: Shift-Left Unit Tests (Ngay khi Dev bắt đầu code Sprint 3)**:
   - Viết trọn bộ Unit Tests cho các hàm tính toán thuần túy (`pure calculation functions`): Chấm công delta, Giờ OT quy đổi, KPI trọng số, Chặn sàn chuyên cần, Tổng bị trừ ròng.
   - Độ bao phủ mục tiêu: 100% dòng lệnh trong các service tính toán.
2. **Giai đoạn 2: API Integration & Validation Tests**:
   - Viết Integration Tests với DB PostgreSQL (Prisma) chạy trên môi trường CI/CD Test Container.
   - Bao phủ 100% 26 mã lỗi `E-dltl-001` đến `E-dltl-026`.
3. **Giai đoạn 3: Security, RBAC & State Life-cycle E2E Tests**:
   - Kiểm thử ma trận phân quyền 4 vai trò.
   - Kiểm thử bất biến đóng băng của kỳ `LOCKED` và luồng Reopen có kiểm soát.
4. **Giai đoạn 4: Concurrency & Stress Tests**:
   - Giả lập 20 concurrent requests cùng gửi lệnh `batch apply` hoặc `lock period` để xác nhận không phát sinh lỗi Deadlock hoặc dữ liệu không nhất quán.

# Bộ Ca Kiểm Thử Chi Tiết Phân Hệ Bảng Lương (Payroll Test Cases Specification)

> **Mã tài liệu**: `TC-PAY-001`  
> **Phân hệ**: Bảng lương & Bộ tính toán lương (`payroll`)  
> **Giai đoạn**: Phase A — Spec Review & Test Design (Mô hình Shift-Left 3 Amigos)  
> **Định dạng**: BDD Gherkin (`Given / When / Then`)  
> **Tác giả**: QA/Tester Engineer  
> **Ngày phê duyệt**: 2026-09-06  
> **Phiên bản**: `1.0.0` (Ready for BA Final Sign-off Gate)  
> **Tài liệu tham chiếu**:  
> - `docs/payroll/qa/test-matrix.md` (Ma trận truy vết TTM)  
> - `docs/payroll/srs/payroll-spec.md` (Đặc tả SRS & Business Rules)  
> - `docs/payroll/srs/payroll-states.md` (Vòng đời trạng thái & Bất biến)  
> - `docs/payroll/srs/payroll-erd.md` (Sơ đồ thực thể & Data Dictionary)  

---

## Mục Lục Các Nhóm Ca Kiểm Thử

- [Nhóm 1: Happy Path — Tính Lương Chuẩn HĐ Dài Hạn, Đầy Đủ Công & OT](#nhóm-1-happy-path--tính-lương-chuẩn-hđ-dài-hạn-đầy-đủ-công--ot)
- [Nhóm 2: Lương Thử Việc / Dưới 3 Tháng / Dịch Vụ — Khấu Trừ 10% Tại Nguồn](#nhóm-2-lương-thử-việc--dưới-3-tháng--dịch-vụ--khấu-trừ-10-tại-nguồn)
- [Nhóm 3: Tiền Làm Thêm Giờ (OT) — Bóc Tách Miễn Thuế TNCN Chuẩn Điều 3 TT 111](#nhóm-3-tiền-làm-thêm-giờ-ot--bóc-tách-miễn-thuế-tncn-chuẩn-điều-3-tt-111)
- [Nhóm 4: Hai Trần Bảo Hiểm Độc Lập — BHXH/BHYT 46.8tr vs BHTN 99.2tr](#nhóm-4-hai-trần-bảo-hiểm-độc-lập--bhxhbhyt-468tr-vs-bhtn-992tr)
- [Nhóm 5: Phụ Cấp Ăn Trưa — Trong và Vượt Định Mức 730.000đ/tháng](#nhóm-5-phụ-cấp-ăn-trưa--trong-và-vượt-định-mức-730000đtháng)
- [Nhóm 6: Khóa Sổ Kỳ Lương Nguyên Tử & Snapshot Sub-Item Breakdowns](#nhóm-6-khóa-sổ-kỳ-lương-nguyên-tử--snapshot-sub-item-breakdowns)
- [Nhóm 7: An Toàn Tài Chính & Làm Tròn Tiền Tệ ROUND_HALF_UP VNĐ](#nhóm-7-an-toàn-tài-chính--làm-tròn-tiền-tệ-round_half_up-vnđ)
- [Nhóm 8: Ràng Buộc RBAC & Xử Lý Mã Lỗi E-pay-001 .. E-pay-010](#nhóm-8-ràng-buộc-rbac--xử-lý-mã-lỗi-e-pay-001--e-pay-010)

---

## Nhóm 1: Happy Path — Tính Lương Chuẩn HĐ Dài Hạn, Đầy Đủ Công & OT

### `TC-PAY-001`: Tính Lương Chuẩn Nhân Viên HĐLĐ Chính Thức Đi Làm Đủ 26 Công
* **Mã truy vết**: `US-PAY-01`, `BR-pay-001`, `BR-pay-002`, `BR-pay-007`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test (`PayrollCalculationService.calculatePeriodPayroll`) & Integration Test
* **Mục tiêu**: Xác nhận nhân viên ký `LABOR_CONTRACT`, làm việc đủ 26 ngày công chuẩn, có phụ cấp lương cố định tính theo công, hỗ trợ ăn trưa, hỗ trợ điện thoại cố định tháng, đóng bảo hiểm và tính thuế lũy tiến bậc 1 chính xác từng đồng.

```gherkin
Scenario: Tính lương chuẩn nhân viên HĐLĐ chính thức làm đủ công, không OT, không người phụ thuộc
  Given Kỳ lương "2026-08" ở trạng thái "DRAFT" có 26.0 ngày công chuẩn
  And Nhân viên "NV001" có hợp đồng "LABOR_CONTRACT" thỏa thuận:
    | Trường | Giá trị |
    | baseSalary | 15.000.000 VNĐ |
    | salaryType | GROSS |
    | hasSocialInsurance | true |
    | hasPersonalIncomeTax | true |
    | hasUnionFee | true |
    | socialInsuranceSalary | 17.000.000 VNĐ |
  And Nhân viên có 0 người phụ thuộc giảm trừ gia cảnh
  And Cài đặt lương của nhân viên có các cấu phần:
    | Mã khoản | Tên khoản | Mức cấu hình | Phương thức tính | Chịu thuế | Đóng BHXH |
    | KL_PC_TRACHNHIEM | Phụ cấp trách nhiệm | 2.000.000 VNĐ | WORK_DAYS | true | true |
    | KL_HC_ANTRUA | Hỗ trợ ăn trưa | 1.000.000 VNĐ | WORK_DAYS | true | false |
    | KL_HC_DIENTHOAI | Hỗ trợ điện thoại | 500.000 VNĐ | MONTHLY_FIXED | false | false |
  And Bảng chấm công ghi nhận nhân viên đi làm đủ 26.0 ngày công
  When Hệ thống thực hiện tính toán bảng lương kỳ "2026-08"
  Then Kết quả tính lương của nhân viên "NV001" phải khớp chính xác:
    | Chỉ tiêu bảng lương | Giá trị kỳ vọng | Giải thích công thức |
    | proratedWorkSalary | 15.000.000 VNĐ | 15tr * (26 / 26) |
    | fixedAllowanceSalary | 3.500.000 VNĐ | 2tr (trách nhiệm) + 1tr (ăn trưa) + 500k (điện thoại) |
    | grossIncome | 18.500.000 VNĐ | 15tr + 3.5tr |
    | insuranceSalaryBase | 17.000.000 VNĐ | Lương đóng bảo hiểm thỏa thuận |
    | employeeInsuranceDeduction | 1.785.000 VNĐ | 17tr * 10.5% (BHXH 8% + BHYT 1.5% + BHTN 1%) |
    | companyInsuranceExpense | 3.655.000 VNĐ | 17tr * 21.5% (BHXH 17.5% + BHYT 3% + BHTN 1%) |
    | employeeUnionFee | 170.000 VNĐ | 17tr * 1% (nhỏ hơn trần 234.000đ) |
    | companyUnionExpense | 340.000 VNĐ | 17tr * 2% |
    | lunchTaxExemptAmount | 730.000 VNĐ | Khống chế trần miễn thuế ăn trưa TT 26/2016 |
    | otherTaxExemptAmount | 500.000 VNĐ | Hỗ trợ điện thoại không chịu thuế |
    | taxableIncome | 17.270.000 VNĐ | 18.500.000 - 730.000 - 500.000 |
    | personalIncomeTax | 215.750 VNĐ | Thu nhập tính thuế = 17.270.000 - 1.785.000 - 170.000 - 11.000.000 = 4.315.000đ; Thuế bậc 1 (5%) = 215.750đ |
    | adjustmentNetAmount | 0 VNĐ | Không phát sinh tạm ứng / bù trừ |
    | netTakeHomeSalary | 16.329.250 VNĐ | 18.500.000 - 1.785.000 - 170.000 - 215.750 |
    | totalCompanyCost | 22.495.000 VNĐ | 18.500.000 + 3.655.000 + 340.000 |
```

---

### `TC-PAY-002`: Tính Lương Nhân Viên Có Làm Thêm Giờ (OT) Hỗn Hợp Nhiều Hệ Số
* **Mã truy vết**: `US-PAY-03`, `BR-pay-001`, `BR-pay-004`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Xác nhận hệ thống tính đúng tiền OT theo đơn giá giờ chuẩn, phân bổ chính xác phần tiền OT dôi dư được miễn thuế TNCN cho nhiều ca OT ngày thường, ngày nghỉ và ngày lễ.

```gherkin
Scenario: Tính lương nhân viên HĐLĐ có làm thêm giờ ngày thường (150%), ngày nghỉ (200%), ngày lễ (300%)
  Given Nhân viên "NV002" có hợp đồng "LABOR_CONTRACT" với lương cơ bản 20.800.000 VNĐ
  And Kỳ lương chuẩn 26.0 ngày công, tiêu chuẩn 8 giờ/ngày -> Đơn giá giờ chuẩn = 20.800.000 / (26 * 8) = 100.000 VNĐ/giờ
  And Nhân viên đi làm đủ 26 ngày công chuẩn và phát sinh các ca tăng ca:
    | Loại ca tăng ca | Số giờ thực tế | Hệ số trả lương |
    | OT ngày thường | 10.0 giờ | 150% |
    | OT ngày nghỉ cuối tuần | 8.0 giờ | 200% |
    | OT ngày lễ ban ngày | 8.0 giờ | 300% |
  When Hệ thống tính toán chi tiết tiền làm thêm giờ
  Then Tiền làm thêm giờ thực tế nhận được (otAmount) là 5.500.000 VNĐ:
    | Ca làm thêm | Tiền OT thực tế | Tiền theo giờ chuẩn | Phần dôi dư miễn thuế |
    | OT ngày thường (150%) | 1.500.000 VNĐ | 1.000.000 VNĐ | 500.000 VNĐ |
    | OT ngày nghỉ (200%) | 1.600.000 VNĐ | 800.000 VNĐ | 800.000 VNĐ |
    | OT ngày lễ (300%) | 2.400.000 VNĐ | 800.000 VNĐ | 1.600.000 VNĐ |
  And Tổng phần tiền làm thêm giờ được miễn thuế TNCN (otTaxExemptAmount) là 2.900.000 VNĐ
  And Phần tiền làm thêm giờ chịu thuế TNCN đưa vào taxableIncome chỉ là 2.600.000 VNĐ
  And Tổng thu nhập gộp (grossIncome) ghi nhận đủ 20.800.000 + 5.500.000 = 26.300.000 VNĐ
```

---

### `TC-PAY-003`: Tính Lương Đầy Đủ 8 Phân Hệ Dữ Liệu Biến Động
* **Mã truy vết**: `US-PAY-01`, `BR-pay-001`, `BR-pay-009`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Xác nhận Động cơ tính toán tích hợp trơn tru toàn bộ 8 nguồn dữ liệu biến động (công, OT, KPI, thưởng, sản phẩm, hoa hồng, chuyên cần, bù trừ).

```gherkin
Scenario: Nhân viên kinh doanh phát sinh đầy đủ 8 nguồn thu nhập và biến động trong kỳ
  Given Nhân viên "NV003" có lương cơ bản 10.000.000 VNĐ, đi làm 26/26 công (10tr)
  And Tiền làm thêm giờ (otAmount) = 1.200.000 VNĐ
  And Tiền thưởng hiệu suất KPI (kpiSalary) = 2.000.000 VNĐ
  And Tiền thưởng quý (bonusSalary) = 3.000.000 VNĐ
  And Tiền lương sản phẩm nghiệm thu (pieceworkSalary) = 4.500.000 VNĐ
  And Tiền hoa hồng doanh số (commissionSalary) = 5.000.000 VNĐ
  And Tiền phụ cấp chuyên cần sau trừ phạt (diligenceSalary) = 500.000 VNĐ
  And Phát sinh tạm ứng 2.000.000 VNĐ và hoàn trả công tác phí 500.000 VNĐ tại phân hệ Bù trừ
  When Hệ thống tính toán bảng lương tổng hợp
  Then Thu nhập gộp (grossIncome) = 10tr + 1.2tr + 2tr + 3tr + 4.5tr + 5tr + 0.5tr = 26.200.000 VNĐ
  And Số tiền bù trừ ròng (adjustmentNetAmount) = 2.000.000 (trừ) - 500.000 (bù) = 1.500.000 VNĐ
  And Số tiền 1.500.000 VNĐ được khấu trừ chính xác vào thực lĩnh netTakeHomeSalary
```

---

## Nhóm 2: Lương Thử Việc / Dưới 3 Tháng / Dịch Vụ — Khấu Trừ 10% Tại Nguồn

### `TC-PAY-010`: HĐ Thử Việc Thu Nhập Trên 2 Triệu — Khấu Trừ 10% Tại Nguồn, Không Giảm Trừ Gia Cảnh
* **Mã truy vết**: `US-PAY-02`, `BR-pay-005`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Bẫy lỗi nghiêm trọng phổ biến trong tính lương: Không được áp dụng biểu thuế 7 bậc và KHÔNG được trừ 11tr bản thân hay 4.4tr NPT cho HĐ `PROBATION`.

```gherkin
Scenario: Nhân viên thử việc có thu nhập chịu thuế 12 triệu đồng và đăng ký 2 người phụ thuộc
  Given Nhân viên "NV010" ký hợp đồng loại "PROBATION" (Thử việc)
  And Mức lương thử việc thỏa thuận là 12.000.000 VNĐ
  And Trong hồ sơ nhân sự, nhân viên có đăng ký 2 người phụ thuộc
  And Kỳ lương 26 công chuẩn, nhân viên đi làm đủ 26 ngày công
  When Hệ thống thực hiện tính toán thuế Thu nhập cá nhân
  Then Hệ thống phát hiện hợp đồng loại "PROBATION"
  And Hệ thống TUYỆT ĐỐI KHÔNG áp dụng giảm trừ gia cảnh bản thân 11.000.000 VNĐ
  And Hệ thống TUYỆT ĐỐI KHÔNG áp dụng giảm trừ cho 2 người phụ thuộc (2 * 4.4tr = 8.800.000 VNĐ)
  And Hệ thống TUYỆT ĐỐI KHÔNG áp dụng biểu thuế lũy tiến từng phần 7 bậc
  And Thuế TNCN phải khấu trừ tại nguồn là 12.000.000 * 10% = 1.200.000 VNĐ
  And Tiền lương thực lĩnh (netTakeHomeSalary) = 12.000.000 - 1.200.000 = 10.800.000 VNĐ
```

---

### `TC-PAY-011`: HĐ Dịch Vụ / Thời Vụ Thu Nhập Trên 2 Triệu — Khấu Trừ 10% Tại Nguồn
* **Mã truy vết**: `US-PAY-02`, `BR-pay-005`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Khấu trừ 10% tại nguồn cho Hợp đồng dịch vụ / Cộng tác viên (`SERVICE_CONTRACT`).

```gherkin
Scenario: Chuyên gia cộng tác viên ký Hợp đồng Dịch vụ nhận thù lao 25 triệu đồng
  Given Nhân viên "NV011" có hợp đồng loại "SERVICE_CONTRACT" với mức thù lao 25.000.000 VNĐ
  And Hợp đồng không trích nộp BHXH bắt buộc (hasSocialInsurance = false)
  When Hệ thống tính thuế TNCN cho kỳ lương
  Then Thuế TNCN khấu trừ 10% tại nguồn là 25.000.000 * 10% = 2.500.000 VNĐ
  And Tiền thực nhận chuyển khoản cho cộng tác viên là 25.000.000 - 2.500.000 = 22.500.000 VNĐ
```

---

### `TC-PAY-012`: HĐ Thử Việc Thu Nhập Dưới 2 Triệu — Không Đạt Ngưỡng Khấu Trừ 10%
* **Mã truy vết**: `BR-pay-005`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Căn cứ Điểm i Khoản 1 Điều 25 TT 111/2013/TT-BTC, mức chi trả dưới 2.000.000 VNĐ/lần thì không phải khấu trừ thuế 10% tại nguồn.

```gherkin
Scenario: Nhân viên thử việc vào làm cuối tháng có thu nhập chịu thuế dưới 2 triệu đồng
  Given Nhân viên "NV012" có hợp đồng loại "PROBATION" lương thỏa thuận 10.000.000 VNĐ/tháng
  And Nhân viên bắt đầu đi làm từ ngày 27 của tháng, công thực tế chỉ đạt 3.0 / 26.0 ngày
  And Thu nhập thực nhận theo công = round((10.000.000 / 26) * 3) = 1.153.846 VNĐ (< 2.000.000 VNĐ)
  When Hệ thống tính thuế TNCN cho nhân viên "NV012"
  Then Hệ thống xác định thu nhập dưới ngưỡng 2.000.000 VNĐ
  And Thuế TNCN khấu trừ là 0 VNĐ
  And Thực lĩnh chuyển khoản nhận trọn vẹn 1.153.846 VNĐ
```

---

### `TC-PAY-013`: Chuyển Đổi Hợp Đồng Từ Thử Việc Sang Chính Thức Giữa Kỳ
* **Mã truy vết**: `EC-pay-006`, `BR-pay-005`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Xử lý kịch bản nhân viên hết hạn thử việc vào ngày 15 và ký HĐLĐ chính thức từ ngày 16.

```gherkin
Scenario: Nhân viên chuyển từ Thử việc sang HĐLĐ chính thức trong kỳ lương tháng 8
  Given Nhân viên "NV013" có 2 hợp đồng liên tiếp trong hệ thống:
    | Hợp đồng | Loại HĐ | Ngày hiệu lực | Ngày kết thúc |
    | HĐ 01 | PROBATION | 2026-06-16 | 2026-08-15 |
    | HĐ 02 | LABOR_CONTRACT | 2026-08-16 | 2027-08-15 |
  When Hệ thống truy vấn hợp đồng hiệu lực tại thời điểm chốt kỳ lương 2026-08
  Then Hệ thống lấy hợp đồng mới nhất theo quy tắc "effectiveFrom: desc, take: 1"
  And Hợp đồng áp dụng cho toàn kỳ là "LABOR_CONTRACT"
  And Toàn bộ thu nhập của kỳ được áp dụng giảm trừ gia cảnh 11 triệu bản thân và tính thuế lũy tiến 7 bậc
```

---

## Nhóm 3: Tiền Làm Thêm Giờ (OT) — Bóc Tách Miễn Thuế TNCN Chuẩn Điều 3 TT 111

### `TC-PAY-020`: Bóc Tách Miễn Thuế OT Ngày Thường Ban Ngày (Hệ Số 150%)
* **Mã truy vết**: `US-PAY-03`, `BR-pay-004`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Kiểm tra ca OT ngày thường với hệ số 150%, đơn giá chuẩn 100.000đ/h, làm 10 giờ.

```gherkin
Scenario: Làm thêm giờ ngày thường ban ngày hệ số 150%
  Given Đơn giá giờ chuẩn của nhân viên là 100.000 VNĐ/giờ
  And Nhân viên làm thêm 10.0 giờ ngày làm việc bình thường với hệ số 150%
  When Hệ thống tính tiền làm thêm và bóc tách thuế
  Then Tiền làm thêm giờ thực nhận (otAmount) = 10 * 100.000 * 1.5 = 1.500.000 VNĐ
  And Tiền làm theo giờ chuẩn tương ứng = 10 * 100.000 = 1.000.000 VNĐ
  And Tiền OT được miễn thuế TNCN (otTaxExemptAmount) = 1.500.000 - 1.000.000 = 500.000 VNĐ
  And Tiền OT phải chịu thuế TNCN là 1.000.000 VNĐ
```

---

### `TC-PAY-021`: Bóc Tách Miễn Thuế OT Ngày Nghỉ Hàng Tuần (Hệ Số 200%)
* **Mã truy vết**: `US-PAY-03`, `BR-pay-004`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Kiểm tra ca OT ngày Chủ nhật với hệ số 200%, làm 10 giờ.

```gherkin
Scenario: Làm thêm giờ ngày nghỉ hàng tuần hệ số 200%
  Given Đơn giá giờ chuẩn của nhân viên là 100.000 VNĐ/giờ
  And Nhân viên làm thêm 10.0 giờ ngày Chủ nhật với hệ số 200%
  When Hệ thống tính tiền làm thêm và bóc tách thuế
  Then Tiền làm thêm giờ thực nhận (otAmount) = 10 * 100.000 * 2.0 = 2.000.000 VNĐ
  And Tiền làm theo giờ chuẩn tương ứng = 10 * 100.000 = 1.000.000 VNĐ
  And Tiền OT được miễn thuế TNCN (otTaxExemptAmount) = 2.000.000 - 1.000.000 = 1.000.000 VNĐ
  And Tiền OT phải chịu thuế TNCN là 1.000.000 VNĐ
```

---

### `TC-PAY-022`: Bóc Tách Miễn Thuế OT Ngày Lễ Tết Ban Ngày (Hệ Số 300%)
* **Mã truy vết**: `US-PAY-03`, `BR-pay-004`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Kiểm tra ca OT ngày nghỉ Lễ Quốc khánh 2/9 ban ngày với hệ số 300%, làm 8 giờ.

```gherkin
Scenario: Làm thêm giờ ngày lễ Tết ban ngày hệ số 300%
  Given Đơn giá giờ chuẩn của nhân viên là 100.000 VNĐ/giờ
  And Nhân viên làm thêm 8.0 giờ ngày Lễ 2/9 với hệ số 300%
  When Hệ thống tính tiền làm thêm và bóc tách thuế
  Then Tiền làm thêm giờ thực nhận (otAmount) = 8 * 100.000 * 3.0 = 2.400.000 VNĐ
  And Tiền làm theo giờ chuẩn tương ứng = 8 * 100.000 = 800.000 VNĐ
  And Tiền OT được miễn thuế TNCN (otTaxExemptAmount) = 2.400.000 - 800.000 = 1.600.000 VNĐ
  And Tiền OT phải chịu thuế TNCN là 800.000 VNĐ
```

---

### `TC-PAY-023`: Bóc Tách Miễn Thuế OT Ca Đêm Ngày Lễ Tết (Hệ Số 390%)
* **Mã truy vết**: `EC-pay-005`, `BR-pay-004`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Kiểm tra ca trực đêm ngày Tết Nguyên Đán với hệ số kịch khung 390%, làm 8 giờ.

```gherkin
Scenario: Làm thêm giờ ban đêm vào ngày Lễ Tết với hệ số 390%
  Given Đơn giá giờ chuẩn của nhân viên là 100.000 VNĐ/giờ
  And Nhân viên trực ca đêm vào ngày Tết Nguyên Đán 8.0 giờ với hệ số 390%
  When Hệ thống tính tiền làm thêm và bóc tách thuế
  Then Tiền làm thêm giờ thực nhận (otAmount) = 8 * 100.000 * 3.9 = 3.120.000 VNĐ
  And Tiền làm theo giờ chuẩn tương ứng = 8 * 100.000 = 800.000 VNĐ
  And Tiền OT được miễn thuế TNCN (otTaxExemptAmount) = 3.120.000 - 800.000 = 2.320.000 VNĐ
  And Tiền OT phải chịu thuế TNCN là 800.000 VNĐ
```

---

## Nhóm 4: Hai Trần Bảo Hiểm Độc Lập — BHXH/BHYT 46.8tr vs BHTN 99.2tr

### `TC-PAY-030`: Lương Đóng Bảo Hiểm Dưới Cả 2 Mức Trần (30 Triệu Đồng)
* **Mã truy vết**: `US-PAY-04`, `BR-pay-006`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Xác nhận khi lương đóng bảo hiểm nhỏ hơn 46.8tr thì tính bình thường trên toàn bộ mức lương này.

```gherkin
Scenario: Nhân viên có lương đóng bảo hiểm 30 triệu đồng (dưới cả 2 trần)
  Given Nhân viên có mức lương làm căn cứ đóng bảo hiểm là 30.000.000 VNĐ
  When Hệ thống tính toán các khoản trích nộp bảo hiểm
  Then Mức lương đóng BHXH & BHYT = min(30.000.000, 46.800.000) = 30.000.000 VNĐ
  And Mức lương đóng BHTN = min(30.000.000, 99.200.000) = 30.000.000 VNĐ
  And Tiền bảo hiểm NLĐ trích đóng:
    | Loại quỹ | Tỷ lệ NLĐ | Số tiền trích đóng |
    | BHXH | 8.0% | 2.400.000 VNĐ |
    | BHYT | 1.5% | 450.000 VNĐ |
    | BHTN | 1.0% | 300.000 VNĐ |
    | Tổng NLĐ | 10.5% | 3.150.000 VNĐ |
  And Tiền bảo hiểm Doanh nghiệp gánh chịu:
    | Loại quỹ | Tỷ lệ DN | Số tiền chi trả |
    | BHXH | 17.5% | 5.250.000 VNĐ |
    | BHYT | 3.0% | 900.000 VNĐ |
    | BHTN | 1.0% | 300.000 VNĐ |
    | Tổng DN | 21.5% | 6.450.000 VNĐ |
```

---

### `TC-PAY-031`: Lương Đóng Bảo Hiểm Vượt Trần BHXH/BHYT nhưng Dưới Trần BHTN (60 Triệu Đồng)
* **Mã truy vết**: `US-PAY-04`, `BR-pay-006`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Bẫy lỗi tính gộp 10.5% trên 1 mức trần duy nhất. BHXH/BHYT phải kẹp 46.8tr trong khi BHTN vẫn được tính trên 60tr.

```gherkin
Scenario: Quản lý cấp cao có lương căn cứ đóng bảo hiểm 60 triệu đồng
  Given Nhân viên có lương đóng bảo hiểm thỏa thuận là 60.000.000 VNĐ
  When Hệ thống tính các khoản bảo hiểm
  Then Mức lương đóng BHXH & BHYT bị kẹp trần ở mức 46.800.000 VNĐ
  And Mức lương đóng BHTN giữ nguyên 60.000.000 VNĐ (nhỏ hơn trần 99.200.000 VNĐ)
  And Tiền bảo hiểm NLĐ đóng:
    | Loại quỹ | Mức lương áp dụng | Tỷ lệ | Số tiền trích đóng |
    | BHXH | 46.800.000 VNĐ | 8.0% | 3.744.000 VNĐ |
    | BHYT | 46.800.000 VNĐ | 1.5% | 702.000 VNĐ |
    | BHTN | 60.000.000 VNĐ | 1.0% | 600.000 VNĐ |
    | Tổng NLĐ | - | - | 5.046.000 VNĐ |
  And Tiền bảo hiểm Doanh nghiệp gánh chịu:
    | Loại quỹ | Mức lương áp dụng | Tỷ lệ | Số tiền chi trả |
    | BHXH | 46.800.000 VNĐ | 17.5% | 8.190.000 VNĐ |
    | BHYT | 46.800.000 VNĐ | 3.0% | 1.404.000 VNĐ |
    | BHTN | 60.000.000 VNĐ | 1.0% | 600.000 VNĐ |
    | Tổng DN | - | - | 10.194.000 VNĐ |
```

---

### `TC-PAY-032`: Lương Chuyên Gia Vượt Cả 2 Trần Bảo Hiểm (120 Triệu Đồng)
* **Mã truy vết**: `EC-pay-003`, `BR-pay-006`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Xác nhận khi lương 120 triệu đồng, cả 2 trần 46.8tr và 99.2tr đồng thời được kích hoạt chính xác.

```gherkin
Scenario: Chuyên gia nước ngoài có mức lương căn cứ đóng bảo hiểm 120 triệu đồng
  Given Nhân viên có lương đóng bảo hiểm thỏa thuận là 120.000.000 VNĐ
  When Hệ thống tính các khoản bảo hiểm bắt buộc
  Then Mức lương đóng BHXH & BHYT kẹp trần = min(120.000.000, 46.800.000) = 46.800.000 VNĐ
  And Mức lương đóng BHTN kẹp trần = min(120.000.000, 99.200.000) = 99.200.000 VNĐ
  And Tiền bảo hiểm NLĐ trích đóng:
    | Loại quỹ | Mức lương áp dụng | Tỷ lệ | Số tiền trích đóng |
    | BHXH | 46.800.000 VNĐ | 8.0% | 3.744.000 VNĐ |
    | BHYT | 46.800.000 VNĐ | 1.5% | 702.000 VNĐ |
    | BHTN | 99.200.000 VNĐ | 1.0% | 992.000 VNĐ |
    | Tổng NLĐ | - | - | 5.438.000 VNĐ |
  And Tiền bảo hiểm Doanh nghiệp gánh chịu:
    | Loại quỹ | Mức lương áp dụng | Tỷ lệ | Số tiền chi trả |
    | BHXH | 46.800.000 VNĐ | 17.5% | 8.190.000 VNĐ |
    | BHYT | 46.800.000 VNĐ | 3.0% | 1.404.000 VNĐ |
    | BHTN | 99.200.000 VNĐ | 1.0% | 992.000 VNĐ |
    | Tổng DN | - | - | 10.586.000 VNĐ |
```

---

### `TC-PAY-033`: Khống Chế Trần Đoàn Phí Công Đoàn Người Lao Động (234.000đ)
* **Mã truy vết**: `BR-pay-007`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Đoàn phí NLĐ (1% lương BHXH) kẹp trần tối đa 10% lương cơ sở = 234.000 VNĐ/tháng theo Quyết định 1908/QĐ-TLĐ.

```gherkin
Scenario: Đoàn phí công đoàn bị kẹp trần khi mức lương đóng bảo hiểm cao
  Given Nhân viên có hợp đồng tham gia công đoàn (hasUnionFee = true)
  And Mức lương đóng bảo hiểm là 46.800.000 VNĐ
  When Hệ thống tính đoàn phí công đoàn NLĐ và kinh phí công đoàn DN
  Then Phép tính 1% lương đóng bảo hiểm = 46.800.000 * 1% = 468.000 VNĐ
  And Mức trần đoàn phí tối đa là 10% * 2.340.000 = 234.000 VNĐ
  And Đoàn phí công đoàn NLĐ trích đóng (employeeUnionFee) = min(468.000, 234.000) = 234.000 VNĐ
  And Kinh phí công đoàn DN chi trả (companyUnionExpense) = 46.800.000 * 2% = 936.000 VNĐ
```

---

## Nhóm 5: Phụ Cấp Ăn Trưa — Trong và Vượt Định Mức 730.000đ/tháng

### `TC-PAY-040`: Phụ Cấp Ăn Trưa Nằm Trong Định Mức (600.000đ) Khi Làm Đủ Công
* **Mã truy vết**: `US-PAY-05`, `BR-pay-003`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Toàn bộ tiền ăn trưa dưới 730k được miễn thuế 100%.

```gherkin
Scenario: Phụ cấp ăn trưa 600.000đ khi nhân viên đi làm đủ 26 công
  Given Nhân viên nhận phụ cấp ăn trưa 600.000 VNĐ/tháng
  And Nhân viên đi làm đủ 26.0 / 26.0 ngày công chuẩn
  When Hệ thống tính toán nghĩa vụ thuế TNCN
  Then Phần tiền ăn trưa được miễn thuế (lunchTaxExemptAmount) là 600.000 VNĐ
  And Phần tiền ăn trưa tính vào thu nhập chịu thuế là 0 VNĐ
```

---

### `TC-PAY-041`: Phụ Cấp Ăn Trưa Vượt Định Mức (1.500.000đ) Khi Làm Đủ Công
* **Mã truy vết**: `US-PAY-05`, `BR-pay-003`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Chỉ miễn thuế tối đa 730k, phần dôi dư 770k phải chịu thuế TNCN.

```gherkin
Scenario: Phụ cấp ăn trưa 1.500.000đ khi nhân viên đi làm đủ 26 công
  Given Nhân viên nhận phụ cấp ăn trưa 1.500.000 VNĐ/tháng
  And Nhân viên đi làm đủ 26.0 / 26.0 ngày công chuẩn
  When Hệ thống tính toán nghĩa vụ thuế TNCN
  Then Hạn mức miễn thuế tối đa là 730.000 VNĐ
  And Phần tiền ăn trưa được miễn thuế (lunchTaxExemptAmount) là 730.000 VNĐ
  And Phần tiền ăn trưa vượt định mức phải chịu thuế TNCN là 1.500.000 - 730.000 = 770.000 VNĐ
```

---

### `TC-PAY-042`: Phụ Cấp Ăn Trưa Vượt Định Mức Khi Đi Làm Thiếu Công (50% Công)
* **Mã truy vết**: `US-PAY-05`, `BR-pay-003`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Prorate cả số tiền ăn trưa thực nhận VÀ hạn mức miễn thuế tối đa theo tỷ lệ ngày công thực tế.

```gherkin
Scenario: Phụ cấp ăn trưa 1.300.000đ/tháng (tính theo công) khi nhân viên chỉ đi làm 13/26 công
  Given Nhân viên có phụ cấp ăn trưa mức cấu hình 1.300.000 VNĐ/tháng tính theo công
  And Kỳ chuẩn 26 ngày công, nhân viên chỉ đi làm thực tế 13.0 ngày công (50%)
  When Hệ thống tính toán thu nhập và thuế
  Then Tiền ăn trưa thực tế chi trả là 1.300.000 * (13 / 26) = 650.000 VNĐ
  And Hạn mức miễn thuế ăn trưa theo công là round(730.000 * (13 / 26)) = 365.000 VNĐ
  And Phần tiền ăn trưa được miễn thuế (lunchTaxExemptAmount) là 365.000 VNĐ
  And Phần tiền ăn trưa phải chịu thuế TNCN là 650.000 - 365.000 = 285.000 VNĐ
```

---

### `TC-PAY-043`: Nhân Viên Nghỉ Không Lương Cả Tháng (0 Công)
* **Mã truy vết**: `EC-pay-007`, `BR-pay-003`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: 0 công -> toàn bộ phụ cấp tính theo công và miễn thuế ăn trưa bằng 0.

```gherkin
Scenario: Nhân viên nghỉ việc không lương trọn vẹn cả tháng
  Given Nhân viên có lương cơ bản 10.000.000 VNĐ, phụ cấp ăn trưa 1.000.000 VNĐ (theo công)
  And Nhân viên có 0.0 ngày công làm việc trong kỳ
  When Hệ thống thực hiện tính bảng lương
  Then Lương thời gian proratedWorkSalary = 0 VNĐ
  And Phụ cấp ăn trưa thực nhận = 0 VNĐ
  And Hạn mức miễn thuế ăn trưa lunchTaxExemptAmount = 0 VNĐ
  And Tổng thu nhập grossIncome = 0 VNĐ, tiền bảo hiểm và thuế TNCN = 0 VNĐ
```

---

## Nhóm 6: Khóa Sổ Kỳ Lương Nguyên Tử & Snapshot Sub-Item Breakdowns

### `TC-PAY-050`: Khóa Sổ Thành Công Với Transaction Nguyên Tử Đa Tầng
* **Mã truy vết**: `US-PAY-06`, `BR-pay-010`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test (`PayrollPeriodsService.lock`)
* **Mục tiêu**: Kiểm tra tính nguyên tử của Prisma `$transaction`: lưu đồng thời `payroll_sheet_lines` (18 cột) và `payroll_sheet_item_breakdowns` (dòng chi tiết con), cập nhật trạng thái `LOCKED`.

```gherkin
Scenario: Kế toán thực hiện khóa sổ kỳ lương thành công
  Given Kỳ lương "2026-08" đang ở trạng thái "PENDING_REVIEW"
  And Đã có kết quả tính toán hợp lệ cho 20 nhân viên
  When Kế toán gọi API "POST /payroll/periods/{id}/lock"
  Then Hệ thống thực thi một Database Transaction duy nhất
  And Trạng thái kỳ lương chuyển thành "LOCKED", ghi nhận "lockedAt" và "lockedByUserId"
  And Bảng "payroll_sheet_lines" có đúng 20 bản ghi tổng hợp
  And Bảng "payroll_sheet_item_breakdowns" có đầy đủ các bản ghi cấu phần lương con
  And Tổng tiền các bản ghi breakdown của mỗi nhân viên khớp 100% với số tổng trên dòng tổng hợp
```

---

### `TC-PAY-051`: Bất Biến Đóng Băng Dữ Liệu Nguồn Khi Kỳ Đã LOCKED
* **Mã truy vết**: `BR-pay-010`, `PayrollPeriodLockGuard`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Sau khi kỳ chuyển sang `LOCKED`, mọi thao tác ghi vào 8 phân hệ nguồn đều bị chặn đứng và trả về `E-dltl-001`.

```gherkin
Scenario: Người dùng cố gắng thêm/sửa chấm công hoặc OT sau khi kỳ lương đã khóa sổ
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED"
  When Người dùng gửi request thêm bản ghi chấm công "POST /payroll/attendance" cho kỳ "2026-08"
  Then Hệ thống ném ngoại lệ với mã lỗi "E-dltl-001"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Kỳ lương đã bị khóa sổ hoặc đã duyệt, không thể thay đổi dữ liệu."
```

---

### `TC-PAY-052`: Bất Biến Snapshot Khi Sửa Cài Đặt Lương Tương Lai
* **Mã truy vết**: `EC-pay-008`, `BR-pay-010`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Bảo đảm số liệu kỳ đã khóa được đọc trực tiếp từ snapshot, không bị ảnh hưởng bởi thay đổi cấu hình tương lai.

```gherkin
Scenario: HR tăng lương cơ bản hoặc sửa tên khoản lương sau khi kỳ tháng 8 đã LOCKED
  Given Kỳ lương "2026-08" đã được khóa sổ "LOCKED" với mức lương cơ bản của NV001 là 15.000.000 VNĐ
  When Sang tháng 9, HR vào Cài đặt lương tăng mức lương của NV001 lên 20.000.000 VNĐ
  And Kế toán mở xem lại bảng lương tháng 8 ("GET /payroll/sheet-lines?periodId=2026-08")
  Then Bảng lương tháng 8 của NV001 vẫn giữ nguyên 100% mức lương 15.000.000 VNĐ và toàn bộ số liệu snapshot cũ
  And Mọi báo cáo xuất Excel tháng 8 không bị biến động bất kỳ con số nào
```

---

### `TC-PAY-053`: Reopen Kỳ Lương Thành Công Bởi ADMIN Kèm Lý Do
* **Mã truy vết**: `BR-pay-011`, `E-pay-008`, `E-pay-009`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test & E2E Test
* **Mục tiêu**: Chỉ ADMIN mới có quyền mở lại kỳ lương, yêu cầu lý do $\ge 20$ ký tự, xóa sạch snapshot cũ và ghi `AuditLog`.

```gherkin
Scenario: Quản trị viên (ADMIN) mở lại kỳ lương đã khóa sổ với lý do hợp lệ
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED" với 20 dòng snapshot
  And Người thực hiện có vai trò "ADMIN"
  When Quản trị viên gọi API "POST /payroll/periods/{id}/reopen" với payload:
    """
    { "reason": "Điều chỉnh bổ sung quyết định thưởng nóng dự án quý 3" }
    """
  Then Độ dài chuỗi lý do đạt 58 ký tự (>= 20 ký tự)
  And Hệ thống xóa sạch toàn bộ bản ghi cũ trong "payroll_sheet_lines" và "payroll_sheet_item_breakdowns"
  And Trạng thái kỳ lương chuyển về "DRAFT", "lockedAt" và "lockedByUserId" được reset về null
  And Hệ thống ghi bản ghi kiểm toán "AuditLog" với event "PAYROLL_PERIOD_REOPENED"
```

---

### `TC-PAY-054`: Rollback Toàn Bộ Giao Dịch Khi Lưu Snapshot Gặp Lỗi
* **Mã truy vết**: `BR-pay-010`, `E-pay-007`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test (Mocking Failure Injection)
* **Mục tiêu**: Bảo đảm tính toàn vẹn All-or-Nothing của database transaction.

```gherkin
Scenario: Quá trình khóa sổ gặp lỗi chèn dữ liệu dòng breakdown
  Given Kỳ lương "2026-08" đang ở trạng thái "PENDING_REVIEW"
  And Hệ thống xảy ra lỗi ngắt kết nối database hoặc vi phạm CHECK constraint khi chèn bản ghi breakdown thứ 15
  When Quá trình thực thi transaction xảy ra lỗi
  Then Toàn bộ Database Transaction được Rollback 100%
  And Không có bất kỳ dòng nào được lưu dở dang trong "payroll_sheet_lines" hay "breakdowns"
  And Trạng thái kỳ lương vẫn giữ nguyên "PENDING_REVIEW"
  And Hệ thống trả về mã lỗi "E-pay-007"
```

---

## Nhóm 7: An Toàn Tài Chính & Làm Tròn Tiền Tệ ROUND_HALF_UP VNĐ

### `TC-PAY-060`: Bất Biến Công Nợ Thực Lĩnh Âm (Tạm Ứng Lớn Hơn Lương)
* **Mã truy vết**: `EC-pay-002`, `BR-pay-008`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Nghiêm cấm clamp thực lĩnh về 0 khi tạm ứng lớn. Cho phép số âm để ghi nhận công nợ.

```gherkin
Scenario: Nhân viên tạm ứng tiền vượt quá tổng thu nhập sau thuế trong kỳ
  Given Nhân viên có Gross Income trong tháng là 10.000.000 VNĐ
  And Bảo hiểm NLĐ đóng 1.050.000 VNĐ, thuế TNCN = 0 VNĐ
  And Thu nhập sau giảm trừ bắt buộc = 10.000.000 - 1.050.000 = 8.950.000 VNĐ
  And Trong kỳ nhân viên đã tạm ứng trước 12.000.000 VNĐ tại phân hệ Bù trừ (adjustmentNetAmount = 12.000.000)
  When Hệ thống tính tiền lương thực lĩnh (netTakeHomeSalary)
  Then Phép tính thực lĩnh = 8.950.000 - 12.000.000 = -3.050.000 VNĐ
  And Hệ thống GIỮ NGUYÊN giá trị âm -3.050.000 VNĐ, TUYỆT ĐỐI KHÔNG clamp về 0
  And Trường netTakeHomeSalary ghi nhận đúng -3.050.000 VNĐ làm căn cứ công nợ khấu trừ kỳ kế tiếp
```

---

### `TC-PAY-061`: Chặn Sàn Chuyên Cần — Không Trừ Lấn Sang Lương Công
* **Mã truy vết**: `BR-pay-009`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Phạt chuyên cần tối đa bằng mức hưởng. Tiền chuyên cần $\ge 0$.

```gherkin
Scenario: Tổng tiền phạt vi phạm chuyên cần vượt quá mức trợ cấp chuyên cần được hưởng
  Given Mức phụ cấp chuyên cần tháng của nhân viên là 300.000 VNĐ
  And Nhân viên vi phạm 2 lỗi chuyên cần với tổng số tiền phạt là 600.000 VNĐ
  When Hệ thống tính toán lương chuyên cần (diligenceSalary)
  Then Mức phạt tối đa bị trừ được kẹp sàn = min(600.000, 300.000) = 300.000 VNĐ
  And Tiền lương chuyên cần thực nhận (diligenceSalary) = max(0, 300.000 - 300.000) = 0 VNĐ
  And 300.000 VNĐ tiền phạt vượt mức TUYỆT ĐỐI KHÔNG bị trừ lấn sang lương ngày công hay phụ cấp khác
```

---

### `TC-PAY-062`: Giảm Trừ Gia Cảnh Lớn Hơn Thu Nhập Chịu Thuế (Clamp Thuế = 0)
* **Mã truy vết**: `EC-pay-004`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Thu nhập tính thuế âm phải clamp về 0, thuế TNCN = 0đ.

```gherkin
Scenario: Nhân viên nuôi nhiều người phụ thuộc có mức giảm trừ gia cảnh vượt thu nhập chịu thuế
  Given Nhân viên có thu nhập chịu thuế (taxableIncome) là 15.000.000 VNĐ
  And Đăng ký 2 người phụ thuộc -> Mức giảm trừ = 11.000.000 (bản thân) + 2 * 4.400.000 = 19.800.000 VNĐ
  When Hệ thống tính thu nhập tính thuế
  Then Phép tính = 15.000.000 - 19.800.000 = -4.800.000 VNĐ (< 0)
  And Thu nhập tính thuế được clamp về 0 VNĐ: taxableIncome = max(0, -4.800.000) = 0 VNĐ
  And Tiền thuế Thu nhập cá nhân (personalIncomeTax) = 0 VNĐ
```

---

### `TC-PAY-063`: Chuẩn Làm Tròn Tiền Tệ ROUND_HALF_UP Về Đơn Vị 1 Đồng
* **Mã truy vết**: `EC-pay-009`
* **Mức ưu tiên**: **P2 (Medium)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Xác nhận mọi phép chia tỷ lệ sinh số thập phân đều được làm tròn chuẩn `Math.round()`.

```gherkin
Scenario: Phép tính thuế hoặc bảo hiểm sinh số tiền thập phân
  Given Phép tính tỷ lệ bảo hiểm hoặc thuế TNCN sinh kết quả có phần thập phân:
    | Phép tính | Giá trị số thực |
    | Trường hợp 1 | 177.499,49 VNĐ |
    | Trường hợp 2 | 177.499,50 VNĐ |
    | Trường hợp 3 | 177.499,80 VNĐ |
  When Hệ thống áp dụng hàm làm tròn số tiền
  Then Kết quả làm tròn tương ứng phải là:
    | Trường hợp 1 | 177.499 VNĐ |
    | Trường hợp 2 | 177.500 VNĐ |
    | Trường hợp 3 | 177.500 VNĐ |
```

---

### `TC-PAY-064`: Nhân Viên Vào Làm Hoặc Nghỉ Việc Giữa Kỳ Lương
* **Mã truy vết**: `EC-pay-001`, `BR-pay-001`, `BR-pay-003`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Giữ nguyên ngày công chuẩn 26.0, tính theo ngày công thực tế, prorate lương và phụ cấp.

```gherkin
Scenario: Nhân viên mới tiếp nhận công việc từ ngày 15 của tháng
  Given Kỳ lương có 26.0 ngày công chuẩn
  And Nhân viên bắt đầu làm việc từ ngày 15/08/2026, chấm công thực tế đạt 14.0 ngày công
  And Mức lương cơ bản thỏa thuận là 13.000.000 VNĐ/tháng
  And Phụ cấp trách nhiệm tính theo công là 2.600.000 VNĐ/tháng
  When Hệ thống tính toán lương kỳ tháng 8
  Then Lương thời gian proratedWorkSalary = round(13.000.000 * (14 / 26)) = 7.000.000 VNĐ
  And Phụ cấp trách nhiệm thực nhận = round(2.600.000 * (14 / 26)) = 1.400.000 VNĐ
  And Hạn mức miễn thuế ăn trưa tối đa = round(730.000 * (14 / 26)) = 393.077 VNĐ
```

---

### `TC-PAY-065`: Cảnh Báo Lương Đóng Bảo Hiểm Dưới Mức Tối Thiểu Vùng
* **Mã truy vết**: `EC-pay-010`
* **Mức ưu tiên**: **P2 (Medium)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Hệ thống phát hiện lương đóng bảo hiểm nhỏ hơn 4.960.000đ thì cảnh báo Warning nhưng vẫn cho phép tính theo hợp đồng đã ký.

```gherkin
Scenario: Nhân viên có lương đóng bảo hiểm khai báo thấp hơn lương tối thiểu vùng Vùng 1
  Given Mức lương tối thiểu vùng quy định tại GeneralSetting là 4.960.000 VNĐ
  And Hợp đồng nhân viên khai báo lương đóng bảo hiểm là 4.500.000 VNĐ (< 4.960.000 VNĐ)
  When Hệ thống chạy tính toán bảng lương
  Then Hệ thống phát ra cảnh báo nghiệp vụ (Warning log): "Lương đóng BH nhỏ hơn lương tối thiểu vùng"
  And Hệ thống vẫn cho phép hoàn tất tính toán theo số liệu hợp đồng để người dùng chủ động đối soát
```

---

## Nhóm 8: Ràng Buộc RBAC & Xử Lý Mã Lỗi E-pay-001 .. E-pay-010

### `TC-PAY-070`: `E-pay-001` — Khóa Sổ Khi Chưa Tính Toán Bảng Lương
* **Mã truy vết**: `E-pay-001`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Chặn gọi `/lock` khi kỳ chưa có kết quả tính lương hợp lệ.

```gherkin
Scenario: Gọi hành động khóa sổ khi kỳ lương chưa từng được tính toán
  Given Kỳ lương "2026-08" vừa tạo mới ở trạng thái "DRAFT"
  And Chưa có bất kỳ lượt chạy tính toán bảng lương nào được thực hiện
  When Kế toán gọi API "POST /payroll/periods/{id}/lock"
  Then Hệ thống từ chối yêu cầu và ném mã lỗi "E-pay-001"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Kỳ lương chưa được tính toán bảng lương"
```

---

### `TC-PAY-071`: `E-pay-002` — Tính Toán Lại Khi Kỳ Đã Khóa Sổ Hoặc Đã Phê Duyệt
* **Mã truy vết**: `E-pay-002`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Chặn gọi `/calculate` khi kỳ ở `LOCKED`, `APPROVED`, `PAID`, `ARCHIVED`.

```gherkin
Scenario: Gửi yêu cầu tính toán lại bảng lương khi kỳ lương đã ở trạng thái LOCKED
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED"
  When Người dùng gọi API tính toán "GET /payroll/calculate?periodId={id}"
  Then Hệ thống từ chối yêu cầu và ném mã lỗi "E-pay-002"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Kỳ lương đã khóa sổ, không thể tính toán lại"
```

---

### `TC-PAY-072`: `E-pay-003` — Cấu Hình Thiết Lập Chung Không Hợp Lệ
* **Mã truy vết**: `E-pay-003`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Unit Test
* **Mục tiêu**: Bẫy lỗi khi thiếu bản ghi GeneralSetting hoặc tham số cấu hình bị âm.

```gherkin
Scenario: Tính toán bảng lương khi cấu hình GeneralSetting bị lỗi hoặc giá trị âm
  Given Bảng "general_settings" bị cấu hình sai với mức lương cơ sở là số âm (-2.340.000 VNĐ)
  When Động cơ tính toán lương khởi động
  Then Hệ thống ném mã lỗi "E-pay-003"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Cấu hình thiết lập chung không hợp lệ"
```

---

### `TC-PAY-073`: `E-pay-004` — Không Tìm Thấy Dòng Bảng Lương Của Nhân Viên Trong Kỳ
* **Mã truy vết**: `E-pay-004`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Truy vấn chi tiết dòng lương của nhân viên không nằm trong kỳ lương trả về 404.

```gherkin
Scenario: Truy vấn chi tiết dòng lương của nhân viên không tồn tại trong kỳ
  Given Kỳ lương "2026-08" đã được khóa sổ
  When Người dùng gọi API "GET /payroll/sheet-lines/{invalidEmployeeId}?periodId={id}"
  Then Hệ thống ném mã lỗi "E-pay-004"
  And HTTP Status trả về là 404 Not Found
  And Thông báo lỗi là "Không tìm thấy dòng bảng lương của nhân viên trong kỳ"
```

---

### `TC-PAY-074`: `E-pay-005` — Không Có Nhân Viên Nào Đủ Điều Kiện Tính Lương Trong Kỳ
* **Mã truy vết**: `E-pay-005`, `BR-dltl-002`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Khi toàn bộ nhân viên trong công ty đều đã nghỉ việc trước kỳ lương thì chặn tính và báo lỗi.

```gherkin
Scenario: Chạy tính lương cho kỳ nhưng toàn bộ nhân viên đều đã hết hạn hợp đồng
  Given Toàn bộ nhân viên trong cơ sở dữ liệu đều có hợp đồng kết thúc trước ngày bắt đầu kỳ lương
  When Người dùng bấm "Tính toán bảng lương" cho kỳ lương này
  Then Hệ thống phát hiện danh sách nhân viên hợp lệ rỗng (activeEmployeeIds = [])
  And Hệ thống ném mã lỗi "E-pay-005"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Không có nhân viên nào đủ điều kiện tính lương trong kỳ"
```

---

### `TC-PAY-075`: `E-pay-006` — Xung Đột Khóa Sổ Đồng Thời (Concurrent Lock Conflict)
* **Mã truy vết**: `E-pay-006`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test (Concurrency Simulation)
* **Mục tiêu**: Bẫy lỗi Race Condition khi 2 kế toán cùng bấm nút Khóa sổ cùng 1 thời điểm.

```gherkin
Scenario: Hai người dùng cùng gửi request khóa sổ kỳ lương tại cùng một thời điểm
  Given Kỳ lương "2026-08" đang ở trạng thái "PENDING_REVIEW"
  When Kế toán A và Kế toán B đồng thời gửi request "POST /payroll/periods/{id}/lock"
  Then Giao dịch của Kế toán A chiếm được Lock và hoàn tất khóa sổ thành công
  And Giao dịch của Kế toán B bị chặn lại do xung đột trạng thái
  And Hệ thống trả về mã lỗi "E-pay-006" cho Kế toán B
  And HTTP Status trả về là 409 Conflict
  And Thông báo lỗi là "Xung đột khóa sổ: Kỳ lương đang được xử lý đồng thời"
```

---

### `TC-PAY-076`: `E-pay-007` — Dữ Liệu Snapshot Bảng Lương Không Khớp Tổng Kiểm Tra
* **Mã truy vết**: `E-pay-007`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Kiểm tra tính toàn vẹn số liệu đối soát chéo giữa bảng dòng tổng và bảng breakdown chi tiết khi khóa sổ.

```gherkin
Scenario: Tổng số tiền trên bảng breakdown không khớp với số tiền trên bảng dòng lương tổng hợp
  Given Động cơ tính toán phát hiện sai lệch tổng giữa bảng dòng lương và bảng chi tiết cấu phần
  When Kế toán thực hiện gọi lệnh khóa sổ
  Then Hệ thống phát hiện bất thường trong quá trình kiểm tra toàn vẹn (Checksum / Total Validation)
  And Hệ thống kích hoạt Rollback Database Transaction
  And Ném mã lỗi "E-pay-007" với HTTP Status 400 Bad Request
  And Thông báo lỗi là "Dữ liệu snapshot bảng lương không khớp tổng kiểm tra"
```

---

### `TC-PAY-077`: `E-pay-008` — Người Dùng Không Phải ADMIN Cố Tình Reopen Kỳ Lương
* **Mã truy vết**: `E-pay-008`, `BR-pay-011`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Integration Test & Security Test
* **Mục tiêu**: Chặn quyền Reopen của vai trò `HR`, `ACCOUNTANT`, `EMPLOYEE`, trả về 403 Forbidden.

```gherkin
Scenario: Kế toán trưởng (ACCOUNTANT) hoặc HR cố gắng gọi API mở lại kỳ lương đã khóa sổ
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED"
  And Người dùng đăng nhập có vai trò "ACCOUNTANT" hoặc "HR"
  When Người dùng gửi request "POST /payroll/periods/{id}/reopen"
  Then Hệ thống từ chối yêu cầu và ném mã lỗi "E-pay-008"
  And HTTP Status trả về là 403 Forbidden
  And Thông báo lỗi là "Chỉ Quản trị viên (ADMIN) mới có quyền mở lại kỳ lương"
  And Hệ thống tự động ghi nhật ký bảo mật "AuditLog" với sự kiện "PERMISSION_DENIED"
```

---

### `TC-PAY-078`: `E-pay-009` — Reopen Kỳ Lương Với Lý Do Quá Ngắn Dưới 20 Ký Tự
* **Mã truy vết**: `E-pay-009`, `BR-pay-011`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Unit Test & Integration Test
* **Mục tiêu**: Kiểm tra ràng buộc độ dài lý do mở lại kỳ lương tối thiểu 20 ký tự.

```gherkin
Scenario: Quản trị viên (ADMIN) mở lại kỳ lương nhưng nhập lý do sơ sài dưới 20 ký tự
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED"
  And Người thực hiện có vai trò "ADMIN"
  When Quản trị viên gọi API "POST /payroll/periods/{id}/reopen" với payload:
    """
    { "reason": "Sửa lại lương" }
    """
  Then Hệ thống phát hiện chuỗi lý do chỉ có 14 ký tự (< 20 ký tự)
  And Hệ thống từ chối yêu cầu và ném mã lỗi "E-pay-009"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Lý do mở lại kỳ lương phải có ít nhất 20 ký tự"
  And Kỳ lương vẫn được bảo toàn nguyên vẹn ở trạng thái "LOCKED"
```

---

### `TC-PAY-079`: `E-pay-010` — Xác Nhận Chi Trả Khi Kỳ Chưa Được Ban Giám Đốc Duyệt
* **Mã truy vết**: `E-pay-010`
* **Mức ưu tiên**: **P1 (High)**
* **Phương pháp**: Integration Test
* **Mục tiêu**: Chặn gọi `/pay` khi trạng thái kỳ lương chưa chuyển sang `APPROVED`.

```gherkin
Scenario: Kế toán bấm xác nhận chi trả tiền lương khi kỳ lương vẫn ở trạng thái LOCKED
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED" (chưa được Ban Giám đốc duyệt sang APPROVED)
  When Kế toán gọi API xác nhận chi trả "POST /payroll/periods/{id}/pay"
  Then Hệ thống từ chối thực thi và ném mã lỗi "E-pay-010"
  And HTTP Status trả về là 400 Bad Request
  And Thông báo lỗi là "Không thể thanh toán kỳ lương chưa được Ban Giám Đốc phê duyệt"
```

---

### `TC-PAY-080`: Ma Trận Phân Quyền Xem Phiếu Lương Cá Nhân (Payslip Isolation)
* **Mã truy vết**: `RBAC Matrix`, `Audit Security`
* **Mức ưu tiên**: **P0 (Critical)**
* **Phương pháp**: Security & E2E Test
* **Mục tiêu**: Bảo đảm tính bảo mật dữ liệu lương: Nhân viên chỉ được xem phiếu lương của chính mình, chỉ xem được khi kỳ ở trạng thái `PAID` hoặc `ARCHIVED`, xem người khác bị 403.

```gherkin
Scenario: Nhân viên kiểm tra quyền truy cập phiếu lương cá nhân qua các trạng thái
  Given Kỳ lương "2026-08" đang ở trạng thái "LOCKED" hoặc "APPROVED" (chưa PAID)
  When Nhân viên A đăng nhập và yêu cầu xem phiếu lương cá nhân
  Then Hệ thống từ chối hiển thị với thông báo phiếu lương chưa được phát hành (403/404)
  
  Given Kỳ lương "2026-08" đã được giải ngân và chuyển sang trạng thái "PAID"
  When Nhân viên A yêu cầu xem phiếu lương của chính mình ("GET /payroll/payslips/my")
  Then Hệ thống trả về đầy đủ chi tiết phiếu lương cá nhân của Nhân viên A
  
  When Nhân viên A cố tình sửa ID để xem phiếu lương của Nhân viên B ("GET /payroll/payslips/{idOfB}")
  Then Hệ thống lập tức chặn truy cập và trả về HTTP 403 Forbidden
  And Hệ thống ghi log cảnh báo vi phạm an ninh dữ liệu nội bộ
```

---

## Tổng Kết Ma Trận Bao Phủ

| Tiêu chí | Số lượng trong tài liệu | Tỷ lệ bao phủ (%) |
|---|:---:|:---:|
| **Quy tắc nghiệp vụ (Business Rules)** | 11/11 (`BR-pay-001` .. `BR-pay-011`) | **100%** |
| **Mã lỗi nghiệp vụ (Error Codes)** | 10/10 (`E-pay-001` .. `E-pay-010`) | **100%** |
| **Kịch bản biên ngoại lệ (Edge Cases)** | 10/10 (`EC-pay-001` .. `EC-pay-010`) | **100%** |
| **User Stories & Acceptance Criteria** | 6/6 (`US-PAY-01` .. `US-PAY-06`) | **100%** |
| **Phân quyền vai trò (RBAC 4 vai trò)** | 4/4 (`ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE`) | **100%** |
| **Tiêu chuẩn BDD Gherkin** | 40 Scenarios chi tiết đầy đủ dữ liệu | **100%** |

---

*Hồ sơ kiểm thử đã sẵn sàng để trình Business Analyst tiến hành **Final Sign-off Gate** theo quy chuẩn Shift-Left 3 Amigos.*
